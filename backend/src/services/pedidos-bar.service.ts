import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { reais } from '../lib/base';
import { config } from '../config/env';
import * as mp from './mercado-pago.service';

// Pedido do site: bebidas do cardapio e produtos da vitrine. O preco vem sempre do cadastro (nunca do navegador)
// Com o Mercado Pago conectado o cliente paga na hora (Pix ou cartao) e o pedido so aparece
// para a equipe depois de pago; sem conexao, paga na barbearia. A equipe muda o status na gestao.
export const STATUS = ['novo', 'preparando', 'entregue', 'cancelado'] as const;
type Item = { id: string; name: string; price: number; qty: number };
type Row = { id: string; numero: number; nome: string; profissionalId: string | null; observacao: string; itens: unknown; totalCentavos: number; status: string; pagamentoStatus: string; pagamentoLink: string | null; pagoEm: Date | null; criadoEm: Date; atualizadoEm: Date };

const view = (p: Row, pros?: Map<string, string>) => ({
  id: p.id, number: p.numero, name: p.nome, note: p.observacao, items: p.itens as Item[], total: reais(p.totalCentavos),
  status: p.status, payStatus: p.pagamentoStatus, payLink: p.pagamentoStatus === 'pendente' ? p.pagamentoLink : null, paidAt: p.pagoEm ? p.pagoEm.toISOString() : null,
  proId: p.profissionalId, pro: p.profissionalId ? pros?.get(p.profissionalId) || null : null,
  at: p.criadoEm.toISOString(), updatedAt: p.atualizadoEm.toISOString(),
});

// freio contra envio em massa (robo). Atras do Traefik + nginx o IP pode ser o mesmo para todos,
// entao o limite e folgado: 40 pedidos a cada 10 minutos por endereco.
const janela = new Map<string, number[]>();
function frear(ip: string) {
  const agora = Date.now();
  const lista = (janela.get(ip) || []).filter((t) => agora - t < 10 * 60000);
  if (lista.length >= 40) throw falha(429, 'Muitos pedidos seguidos. Chame a equipe da barbearia.');
  lista.push(agora);
  janela.set(ip, lista);
  if (janela.size > 5000) janela.clear();
}

const novoSchema = z.object({
  // com pagamento online o nome e opcional (o cliente toca em Pedir e ja vai pagar)
  name: z.string().trim().max(60).default(''),
  proId: z.string().max(60).optional().nullable(),
  note: z.string().trim().max(140, 'Use até 140 letras na observação.').default(''),
  items: z.array(z.object({ id: z.string().max(80), qty: z.number().int().min(1).max(20) })).min(1, 'Seu pedido está vazio.').max(30),
});

export async function criarPedido(body: unknown, ip: string, clienteId: string | null) {
  const d = novoSchema.parse(body);
  const ids = [...new Set(d.items.map((i) => i.id))];
  // bebida do cardapio ou produto da vitrine (Kauan Cell / produtos da barbearia)
  const [cadastro, produtos] = await Promise.all([
    prisma.itemCardapio.findMany({ where: { id: { in: ids }, ativo: true, visivel: true } }),
    prisma.produto.findMany({ where: { id: { in: ids }, ativo: true, vitrine: { in: ['celular', 'barbearia'] }, precoCentavos: { gt: 0 } } }),
  ]);
  const porId = new Map<string, { nome: string; precoCentavos: number; saldo: number | null }>();
  for (const c of cadastro) porId.set(c.id, { nome: c.nome, precoCentavos: c.precoCentavos, saldo: null });
  for (const p of produtos) porId.set(p.id, { nome: p.nome, precoCentavos: p.precoCentavos, saldo: p.quantidade });
  const qtd = new Map<string, number>();
  for (const i of d.items) qtd.set(i.id, Math.min(20, (qtd.get(i.id) || 0) + i.qty));
  const itens: Item[] = [];
  for (const [id, q] of qtd) {
    const c = porId.get(id);
    if (!c || c.saldo === 0) throw falha(409, 'Um item do seu pedido não está mais disponível. Confira o pedido e envie de novo.');
    if (c.saldo !== null && q > c.saldo) throw falha(409, `Temos só ${c.saldo} de ${c.nome} agora. Diminua a quantidade e envie de novo.`);
    itens.push({ id, name: c.nome, price: reais(c.precoCentavos), qty: q });
  }
  let proId: string | null = null;
  if (d.proId) {
    const pro = await prisma.profissional.findFirst({ where: { id: d.proId, ativo: true }, select: { id: true } });
    proId = pro ? pro.id : null;
  }
  frear(ip);
  const total = [...qtd].reduce((s, [id, q]) => s + porId.get(id)!.precoCentavos * q, 0);
  const token = total > 0 ? await mp.tokenDaLoja() : null;
  if (!token && d.name.length < 2) throw falha(400, 'Informe seu nome para a equipe saber de quem é o pedido.');
  const nome = d.name.length >= 2 ? d.name : SEM_NOME;
  const expiraEm = new Date(Date.now() + config.mercadoPago.prazoPagamentoMin * 60 * 1000);
  const p = await prisma.pedidoBar.create({
    data: { nome, profissionalId: proId, observacao: d.note, itens, totalCentavos: total, clienteId, ...(token ? { pagamentoStatus: 'pendente', pagamentoExpiraEm: expiraEm } : {}) },
  });
  if (!token) return view(p);
  // checkout transparente: o cliente paga dentro do site (Pix ou cartao), sem ir para o Mercado Pago
  return { ...view(p), publicKey: await mp.chavePublica() };
}

/* ============ checkout transparente ============ */
const CARTAO_RECUSADO: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Cartão sem limite suficiente. Tente outro cartão ou pague com Pix.',
  cc_rejected_bad_filled_security_code: 'Código de segurança (CVV) incorreto. Confira e tente de novo.',
  cc_rejected_bad_filled_date: 'Data de validade incorreta. Confira e tente de novo.',
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto. Confira e tente de novo.',
  cc_rejected_bad_filled_other: 'Algum dado do cartão está incorreto. Confira e tente de novo.',
  cc_rejected_call_for_authorize: 'O banco pediu autorização para esta compra. Ligue para o banco ou pague com Pix.',
  cc_rejected_card_disabled: 'Cartão bloqueado ou não habilitado. Ligue para o banco ou pague com Pix.',
  cc_rejected_duplicated_payment: 'Este pagamento já foi feito. Confira seu pedido.',
  cc_rejected_high_risk: 'O pagamento foi recusado pela análise de segurança. Tente com Pix.',
  cc_rejected_max_attempts: 'Muitas tentativas com este cartão. Use outro cartão ou Pix.',
};
async function pedidoParaPagar(id: string) {
  const p = await prisma.pedidoBar.findUnique({ where: { id } });
  if (!p) throw falha(404, 'Pedido não encontrado.');
  if (p.pagamentoStatus === 'pago') throw falha(409, 'Este pedido já está pago.');
  if (p.pagamentoStatus !== 'pendente' || (p.pagamentoExpiraEm && p.pagamentoExpiraEm.getTime() < Date.now())) throw falha(409, 'O prazo para pagar este pedido acabou. Faça o pedido de novo.');
  const token = await mp.tokenDaLoja();
  if (!token) throw falha(409, 'O pagamento online está desligado. Pague na barbearia.');
  return { p, token };
}
const titulo = (p: { numero: number; itens: unknown }) => `Cidade Nobre: pedido nº ${p.numero} (${(p.itens as Item[]).map((i) => `${i.qty}x ${i.name}`).join(', ')})`.slice(0, 250);
const emailPadrao = (n: number) => `cliente.pedido${n}@cidadenobre.com.br`;

// Pix: devolve o QR Code e o copia e cola. Reabrir a tela devolve o mesmo Pix enquanto valer.
export async function pagarPix(id: string, body: unknown) {
  const { p, token } = await pedidoParaPagar(id);
  if (p.pagamentoId && p.pagamentoLink === 'pix') {
    const atual = await mp.lerPagamento(token, p.pagamentoId);
    const qr = atual.point_of_interaction?.transaction_data;
    if (atual.status === 'pending' && qr?.qr_code) return { status: 'pending', qrCode: qr.qr_code, qrImage: qr.qr_code_base64 || null, expiresAt: p.pagamentoExpiraEm?.toISOString() || null };
    if (atual.status === 'approved') { await aplicarPagamento(atual); return { status: 'approved' }; }
  }
  const email = z.object({ email: z.string().trim().email().max(120).optional().catch(undefined) }).parse(body || {}).email;
  const fee = mp.taxaPlataforma(p.totalCentavos);
  const [nome, ...resto] = (p.nome === SEM_NOME ? 'Cliente' : p.nome).split(/\s+/);
  const r = await mp.criarPagamento(token, {
    transaction_amount: p.totalCentavos / 100,
    description: titulo(p),
    payment_method_id: 'pix',
    payer: { email: email || emailPadrao(p.numero), first_name: nome, last_name: resto.join(' ') || undefined },
    external_reference: REF + p.id,
    notification_url: `${config.siteUrl}/api/webhook/mercado-pago`,
    date_of_expiration: mp.dataMp(p.pagamentoExpiraEm || new Date(Date.now() + 30 * 60000)),
    statement_descriptor: 'CIDADE NOBRE',
    ...(fee > 0 ? { application_fee: fee } : {}),
  }, `pix-${p.id}-${Date.now()}`);
  const qr = r.point_of_interaction?.transaction_data;
  if (!qr?.qr_code) { console.error('[pagamento] Pix sem QR Code', p.id, r.status, r.status_detail); throw falha(502, 'Não foi possível gerar o Pix agora. Tente de novo em instantes.'); }
  await prisma.pedidoBar.update({ where: { id: p.id }, data: { pagamentoId: String(r.id), pagamentoLink: 'pix' } });
  return { status: 'pending', qrCode: qr.qr_code, qrImage: qr.qr_code_base64 || null, expiresAt: p.pagamentoExpiraEm?.toISOString() || null };
}

// Cartao: o navegador manda o token do cartao gerado pelo formulario do Mercado Pago (os dados do cartao
// nunca passam pelo nosso servidor). Aprovado na hora vira pago; recusado devolve o motivo.
const cartaoSchema = z.object({
  token: z.string().min(8).max(200),
  payment_method_id: z.string().min(2).max(40),
  issuer_id: z.union([z.string(), z.number()]).optional().nullable(),
  installments: z.number().int().min(1).max(12).default(1),
  payer: z.object({
    email: z.string().trim().email('Informe um e-mail válido.').max(120),
    identification: z.object({ type: z.string().max(10), number: z.string().max(20) }).optional().nullable(),
  }),
});
export async function pagarCartao(id: string, body: unknown) {
  const d = cartaoSchema.parse(body);
  const { p, token } = await pedidoParaPagar(id);
  const fee = mp.taxaPlataforma(p.totalCentavos);
  const r = await mp.criarPagamento(token, {
    transaction_amount: p.totalCentavos / 100,
    token: d.token,
    description: titulo(p),
    installments: d.installments,
    payment_method_id: d.payment_method_id,
    ...(d.issuer_id ? { issuer_id: Number(d.issuer_id) } : {}),
    payer: { email: d.payer.email, ...(d.payer.identification?.number ? { identification: d.payer.identification } : {}) },
    external_reference: REF + p.id,
    notification_url: `${config.siteUrl}/api/webhook/mercado-pago`,
    statement_descriptor: 'CIDADE NOBRE',
    binary_mode: true, // aprova ou recusa na hora, sem ficar "em analise"
    ...(fee > 0 ? { application_fee: fee } : {}),
  }, `card-${p.id}-${d.token}`);
  if (r.status === 'approved') { await aplicarPagamento(r); return { status: 'approved', order: await verPedido(id) }; }
  console.log(`[pagamento] cartao recusado no pedido ${p.id}: ${r.status} ${r.status_detail}`);
  return { status: r.status, message: CARTAO_RECUSADO[r.status_detail || ''] || 'Pagamento não aprovado. Confira os dados, tente outro cartão ou pague com Pix.' };
}

/* ============ pagamento online do pedido ============ */
export const REF = 'pedido-';
const SEM_NOME = 'Cliente do site';
// chamado pelo aviso do Mercado Pago e pela conciliacao; o pagamento ja veio conferido na API
export async function aplicarPagamento(p: mp.PagamentoMp) {
  const id = (p.external_reference || '').slice(REF.length);
  if (p.status === 'approved') {
    const r = await prisma.pedidoBar.updateMany({
      where: { id, pagamentoStatus: { in: ['pendente', 'expirado'] } },
      // pago depois do prazo: volta como novo para a equipe entregar
      data: { pagamentoStatus: 'pago', pagamentoId: String(p.id), pagoEm: p.date_approved ? new Date(p.date_approved) : new Date(), status: 'novo' },
    });
    if (r.count) console.log(`[pagamento] pedido do bar ${id} pago (pagamento ${p.id})`);
    // pediu sem nome: usa o nome de quem pagou, quando o Mercado Pago informa
    const pagador = [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(' ').trim().slice(0, 60);
    if (r.count && pagador.length >= 2) await prisma.pedidoBar.updateMany({ where: { id, nome: SEM_NOME }, data: { nome: pagador } });
  } else if (p.status === 'refunded' || p.status === 'charged_back') {
    await prisma.pedidoBar.updateMany({ where: { id, pagamentoId: String(p.id) }, data: { pagamentoStatus: 'estornado' } });
  }
}
async function conferir(token: string, id: string) {
  const lista = await mp.pagamentosDaReferencia(token, REF + id);
  const ok = lista.find((x) => x.status === 'approved');
  if (ok) await aplicarPagamento(ok);
  return !!ok;
}
// a cada 2 minutos (junto com a dos agendamentos)
export async function conciliarPedidos() {
  const agora = Date.now();
  const lista = await prisma.pedidoBar.findMany({
    where: { OR: [{ pagamentoStatus: 'pendente' }, { pagamentoStatus: 'expirado', pagamentoExpiraEm: { gte: new Date(agora - 6 * 3600 * 1000) } }] },
    select: { id: true, pagamentoStatus: true, pagamentoExpiraEm: true }, take: 200,
  });
  if (!lista.length) return;
  const token = await mp.tokenDaLoja();
  for (const a of lista) {
    let pago = false;
    if (token) {
      try { pago = await conferir(token, a.id); } catch (e) { console.error('[pagamento] conciliacao do pedido falhou', a.id, e); continue; }
    }
    const venceu = a.pagamentoExpiraEm && a.pagamentoExpiraEm.getTime() + 2 * 60 * 1000 < agora;
    if (!pago && a.pagamentoStatus === 'pendente' && venceu) {
      await prisma.pedidoBar.updateMany({ where: { id: a.id, pagamentoStatus: 'pendente' }, data: { status: 'cancelado', pagamentoStatus: 'expirado' } });
    }
  }
}
// pedido que a equipe deve ver: pago online ou para pagar na barbearia
const VISIVEL = { pagamentoStatus: { in: ['nenhum', 'pago', 'estornado'] } };

// o id do pedido (uuid) so quem pediu tem
export async function verPedido(id: string) {
  let p = await prisma.pedidoBar.findUnique({ where: { id } });
  if (!p) throw falha(404, 'Pedido não encontrado.');
  // volta do Mercado Pago: confere na hora, sem esperar o aviso
  if (p.pagamentoStatus === 'pendente' || p.pagamentoStatus === 'expirado') {
    const token = await mp.tokenDaLoja();
    if (token) {
      try { if (await conferir(token, id)) p = await prisma.pedidoBar.findUniqueOrThrow({ where: { id } }); }
      catch (e) { console.error('[pagamento] falha ao consultar o pedido', id, e); }
    }
  }
  return p.pagamentoStatus === 'pendente' ? { ...view(p), publicKey: await mp.chavePublica() } : view(p);
}

async function nomesPros() {
  const pros = await prisma.profissional.findMany({ select: { id: true, nome: true } });
  return new Map(pros.map((p) => [p.id, p.nome]));
}

// abertos + os fechados das ultimas 12 horas
export async function listaGestao() {
  const desde = new Date(Date.now() - 12 * 3600000);
  const [lista, pros] = await Promise.all([
    prisma.pedidoBar.findMany({
      where: { ...VISIVEL, OR: [{ status: { in: ['novo', 'preparando'] } }, { atualizadoEm: { gte: desde } }] },
      orderBy: { criadoEm: 'desc' }, take: 200,
    }),
    nomesPros(),
  ]);
  return { orders: lista.map((p) => view(p, pros)) };
}

export async function mudarStatus(id: string, body: unknown) {
  const { status } = z.object({ status: z.enum(STATUS) }).parse(body);
  const p = await prisma.pedidoBar.findUnique({ where: { id } });
  if (!p) throw falha(404, 'Pedido não encontrado.');
  const n = await prisma.pedidoBar.update({ where: { id }, data: { status } });
  return view(n, await nomesPros());
}

export const pedidosAbertos = () => prisma.pedidoBar.count({ where: { ...VISIVEL, status: { in: ['novo', 'preparando'] } } });
