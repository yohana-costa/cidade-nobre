import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { falha } from '../lib/erros';
import { apptInclude, apptView } from '../lib/base';
import * as agenda from './agenda.service';
import * as mp from './mercado-pago.service';

/*
 * Agendamento pago pelo site.
 * - Com a conta do Mercado Pago conectada e a cobranca ligada, o horario e reservado como
 *   "aguardando pagamento" por alguns minutos e o cliente vai para o Checkout Pro.
 * - O pagamento aprovado chega por dois caminhos: o aviso do Mercado Pago (notification_url
 *   da preferencia) e a conciliacao a cada 2 minutos. Os dois consultam a API com o token
 *   da barbearia antes de marcar como pago, entao um aviso forjado nao paga nada.
 * - Sem pagamento dentro do prazo, o horario e cancelado e volta a ficar livre.
 */

export async function agendarComPagamento(body: unknown, clienteLogadoId: string | null) {
  const token = await mp.tokenSeCobrarOnline();
  const expiraEm = new Date(Date.now() + config.mercadoPago.prazoPagamentoMin * 60 * 1000);
  const r = await agenda.agendarPublico(body, clienteLogadoId, token ? { expiraEm } : null);
  if (!token || !r.cobrar) return r;
  try {
    const nomes = r.appt.items.map((i) => i.name).join(' + ');
    const p = await mp.criarPreferencia(token, {
      titulo: `Cidade Nobre: ${nomes} em ${r.appt.date.split('-').reverse().join('/')} às ${r.appt.time}`,
      centavos: Math.round(r.appt.price * 100),
      agendamentoId: r.appt.id,
      expiraEm,
      nome: r.cliente.nome,
      email: r.cliente.email,
    });
    const a = await prisma.agendamento.update({
      where: { id: r.appt.id },
      data: { pagamentoPreferenciaId: p.preferenciaId, pagamentoLink: p.link },
      include: apptInclude,
    });
    return { ...r, appt: apptView(a) };
  } catch (e) {
    // sem link de pagamento o horario nao pode ficar preso
    await prisma.agendamento.update({ where: { id: r.appt.id }, data: { status: 'cancelado', pagamentoStatus: 'cancelado' } });
    console.error('[pagamento] falha ao criar a cobranca do agendamento', r.appt.id, e);
    throw falha(502, 'Não foi possível gerar o pagamento agora. Tente de novo em instantes.');
  }
}

/* ============ aplicar o resultado de um pagamento ============ */
const PREFIXO = 'agendamento-';

async function aplicarPagamento(p: mp.PagamentoMp) {
  const ref = p.external_reference || '';
  if (!ref.startsWith(PREFIXO)) return;
  const id = ref.slice(PREFIXO.length);
  if (p.status === 'approved') {
    await prisma.$transaction(async (tx) => {
      const trava = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM agendamentos WHERE id = ${id} FOR UPDATE`;
      if (!trava.length) return;
      const a = await tx.agendamento.findUniqueOrThrow({ where: { id } });
      if (a.pagamentoStatus === 'pago') return;
      // pago depois de expirar: volta para a agenda se o horario continuar livre
      const voltar = a.status === 'cancelado' && a.pagamentoStatus !== 'cancelado' && (await agenda.reativarSeLivre(tx, id));
      await tx.agendamento.update({
        where: { id },
        data: {
          pagamentoStatus: 'pago',
          pagamentoId: String(p.id),
          pagoEm: p.date_approved ? new Date(p.date_approved) : new Date(),
          ...(voltar ? { status: 'agendado' } : {}),
        },
      });
      console.log(`[pagamento] agendamento ${id} pago (pagamento ${p.id})${a.status === 'cancelado' && !voltar ? ' DEPOIS de cancelado: estornar ou remarcar' : ''}`);
    });
  } else if (p.status === 'refunded' || p.status === 'charged_back') {
    await prisma.agendamento.updateMany({ where: { id, pagamentoId: String(p.id) }, data: { pagamentoStatus: 'estornado' } });
  }
  // rejected / cancelled / pending: o cliente ainda pode tentar de novo na mesma pagina ate o prazo
}

async function conferirAgendamento(token: string, id: string) {
  const lista = await mp.pagamentosDaReferencia(token, mp.referenciaDe(id));
  const aprovado = lista.find((p) => p.status === 'approved');
  if (aprovado) await aplicarPagamento(aprovado);
  return !!aprovado;
}

/* ============ aviso do Mercado Pago (webhook) ============ */
// Aceita os dois formatos: ?type=payment&data.id=123 (webhook) e ?topic=payment&id=123 (IPN).
export async function processarAviso(query: Record<string, unknown>, body: any) {
  const tipo = String(body?.type || query.type || query.topic || '');
  const pagamentoId = String(body?.data?.id || query['data.id'] || (tipo === 'payment' ? query.id : '') || '');
  if (tipo !== 'payment' || !pagamentoId || !/^\d+$/.test(pagamentoId)) return;
  const token = await mp.tokenDaLoja();
  if (!token) return;
  const p = await mp.buscarPagamento(token, pagamentoId);
  await aplicarPagamento(p);
}

/* ============ situacao para a tela de volta do pagamento ============ */
export async function situacao(id: string) {
  const a = await prisma.agendamento.findUnique({ where: { id }, include: apptInclude });
  if (!a || a.origem !== 'site') throw falha(404, 'Agendamento não encontrado.');
  if (a.pagamentoStatus === 'pendente' || a.pagamentoStatus === 'expirado') {
    const token = await mp.tokenDaLoja();
    if (token) {
      try {
        if (await conferirAgendamento(token, id)) return apptView(await prisma.agendamento.findUniqueOrThrow({ where: { id }, include: apptInclude }));
      } catch (e) {
        console.error('[pagamento] falha ao consultar o agendamento', id, e);
      }
    }
  }
  return apptView(a);
}

/* ============ conciliacao periodica ============ */
let rodando = false;
export async function conciliar() {
  if (rodando) return;
  rodando = true;
  try {
    const agora = Date.now();
    const lista = await prisma.agendamento.findMany({
      where: {
        OR: [
          { pagamentoStatus: 'pendente' },
          // expirado ha pouco: o Pix pode ter sido pago no ultimo minuto
          { pagamentoStatus: 'expirado', pagamentoExpiraEm: { gte: new Date(agora - 6 * 3600 * 1000) } },
        ],
      },
      select: { id: true, pagamentoStatus: true, pagamentoExpiraEm: true },
      take: 200,
    });
    if (!lista.length) return;
    const token = await mp.tokenDaLoja();
    for (const a of lista) {
      let pago = false;
      if (token) {
        try { pago = await conferirAgendamento(token, a.id); }
        catch (e) { console.error('[pagamento] conciliacao falhou para', a.id, e); continue; }
      }
      // 2 minutos de folga depois do prazo para o aviso de um pagamento de ultima hora chegar
      const venceu = a.pagamentoExpiraEm && a.pagamentoExpiraEm.getTime() + 2 * 60 * 1000 < agora;
      if (!pago && a.pagamentoStatus === 'pendente' && venceu) {
        const r = await prisma.agendamento.updateMany({ where: { id: a.id, pagamentoStatus: 'pendente' }, data: { status: 'cancelado', pagamentoStatus: 'expirado' } });
        if (r.count) console.log(`[pagamento] agendamento ${a.id} expirou sem pagamento; horário liberado`);
      }
    }
  } catch (e) {
    console.error('[pagamento] falha na conciliação', e);
  } finally {
    rodando = false;
  }
}
