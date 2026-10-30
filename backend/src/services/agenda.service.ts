import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { DATA_RE, HORA_RE, addDays, agoraMin, hoje, tmin } from '../lib/datas';
import { apptInclude, apptView, isOpenDay } from '../lib/base';
import { Cfg, obterConfiguracao } from './configuracao.service';
import { gerarCodigoCliente } from './clientes.service';

type Tx = Prisma.TransactionClient;

/* ============ disponibilidade (mesmas regras de slotFree/bookingDays do prototipo) ============ */
interface Ctx {
  cfg: Cfg;
  T: string;
  nowMin: number;
  pros: { id: string; services: string[] }[];
  svc: Map<string, { dur: number; price: number; name: string }>;
  appts: { id: string; proId: string; date: string; time: string; dur: number }[]; // so nao cancelados
}

async function montarCtx(db: Tx | typeof prisma, de: string, ate: string, cfg?: Cfg): Promise<Ctx> {
  const [c, pros, servicos, ags] = await Promise.all([
    cfg ? Promise.resolve(cfg) : obterConfiguracao(),
    db.profissional.findMany({ where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }], include: { servicos: { where: { ativo: true }, select: { id: true } } } }),
    db.servico.findMany({ where: { ativo: true } }),
    db.agendamento.findMany({ where: { data: { gte: de, lte: ate }, status: { not: 'cancelado' } }, select: { id: true, profissionalId: true, data: true, hora: true, duracaoMin: true } }),
  ]);
  return {
    cfg: c, T: hoje(), nowMin: agoraMin(),
    pros: pros.map((p) => ({ id: p.id, services: p.servicos.map((s) => s.id) })),
    svc: new Map(servicos.map((s) => [s.id, { dur: s.duracaoMin, price: s.precoCentavos, name: s.nome }])),
    appts: ags.map((a) => ({ id: a.id, proId: a.profissionalId, date: a.data, time: a.hora, dur: a.duracaoMin })),
  };
}

const sumDur = (ctx: Ctx, ids: string[]) => ids.reduce((t, i) => t + (ctx.svc.get(i)?.dur || 0), 0);
const canDo = (ctx: Ctx, pid: string, ids: string[]) => {
  const p = ctx.pros.find((x) => x.id === pid);
  return !!p && ids.every((i) => p.services.includes(i));
};
const proBusy = (ctx: Ctx, pid: string, date: string, s: number, e: number, ignore?: string | null) =>
  ctx.appts.some((a) => a.proId === pid && a.date === date && a.id !== ignore && s < tmin(a.time) + a.dur && e > tmin(a.time));
const dayLoad = (ctx: Ctx, pid: string, date: string) => ctx.appts.filter((a) => a.proId === pid && a.date === date).reduce((t, a) => t + a.dur, 0);

// Devolve o profissional que atende (ou null). "any" escolhe o de menor carga no dia.
// equipe = true libera horarios fora da grade do site e datas passadas (registro de balcao).
function slotFree(ctx: Ctx, date: string, time: string, proSel: string, ids: string[], ignore?: string | null, equipe = false): string | null {
  const d = Math.max(sumDur(ctx, ids), 15), s = tmin(time), e = s + d;
  if (s < ctx.cfg.open || e > ctx.cfg.close) return null;
  if (!equipe && date === ctx.T && s <= ctx.nowMin + ctx.cfg.minAdvanceMin) return null;
  const cand = proSel === 'any' ? ctx.pros.map((p) => p.id) : [proSel];
  const ok = cand.filter((p) => canDo(ctx, p, ids) && !proBusy(ctx, p, date, s, e, ignore));
  if (!ok.length) return null;
  ok.sort((a, b) => dayLoad(ctx, a, date) - dayLoad(ctx, b, date));
  return ok[0];
}

function bookingDays(ctx: Ctx, ids: string[], proSel: string, ignore?: string | null) {
  const out: { date: string; any: boolean; free: number; slots: { time: string; proId: string | null }[] }[] = [];
  let d = ctx.T, guard = 0;
  while (out.length < ctx.cfg.bookingDays && guard++ < 21) {
    if (isOpenDay(ctx.cfg, d)) {
      const slots = ctx.cfg.slotTimes.map((t) => ({ time: t, proId: slotFree(ctx, d, t, proSel, ids, ignore) }));
      const free = slots.filter((x) => x.proId).length;
      // hoje entra na lista so se ainda houver horarios suficientes
      if (d !== ctx.T || free >= 3) out.push({ date: d, any: free > 0, free, slots });
    }
    d = addDays(d, 1);
  }
  return out;
}

const idsSchema = z.array(z.string().min(1)).min(1, 'Escolha ao menos um serviço.').max(10).refine((l) => new Set(l).size === l.length, 'Serviço repetido.');

export async function disponibilidade(q: { serviceIds?: string; proId?: string }, ignorarId: string | null) {
  const ids = idsSchema.parse(String(q.serviceIds || '').split(',').filter(Boolean));
  const proSel = q.proId || 'any';
  const T = hoje();
  const ctx = await montarCtx(prisma, T, addDays(T, 21));
  for (const i of ids) if (!ctx.svc.has(i)) throw falha(400, 'Serviço indisponível. Atualize a página.');
  if (proSel !== 'any' && !ctx.pros.some((p) => p.id === proSel)) throw falha(400, 'Profissional indisponível.');
  return { today: ctx.T, nowMin: ctx.nowMin, days: bookingDays(ctx, ids, proSel, ignorarId) };
}

/* ============ gravar agendamento ============ */
// Trava por dia: dois pedidos para o mesmo dia entram em fila dentro da transacao,
// entao o segundo ja enxerga o primeiro e nao ha dupla reserva para o mesmo profissional.
const travarDia = (tx: Tx, date: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'agenda:' + date}))`;

interface Reserva {
  serviceIds: string[];
  proId: string;
  date: string;
  time: string;
  ignore?: string | null;
  equipe?: boolean;
  publico?: boolean; // site: so servicos visiveis e horarios da grade
}

async function validarReserva(tx: Tx, r: Reserva) {
  if (!DATA_RE.test(r.date) || !HORA_RE.test(r.time)) throw falha(400, 'Data ou horário inválido.');
  await travarDia(tx, r.date);
  const ctx = await montarCtx(tx, r.date, r.date);
  const servs = r.serviceIds.map((i) => ctx.svc.get(i));
  if (servs.some((s) => !s)) throw falha(400, 'Serviço indisponível. Atualize a página e escolha de novo.');
  if (r.publico) {
    const vis = await tx.servico.count({ where: { id: { in: r.serviceIds }, visivel: true, ativo: true } });
    if (vis !== r.serviceIds.length) throw falha(400, 'Serviço indisponível. Atualize a página e escolha de novo.');
    if (!ctx.cfg.slotTimes.includes(r.time)) throw falha(400, 'Horário fora da grade de agendamento.');
    if (r.date > addDays(ctx.T, 60)) throw falha(400, 'Agendamentos abrem com até 60 dias de antecedência.');
  }
  if (!r.equipe && r.date < ctx.T) throw falha(400, 'Escolha uma data a partir de hoje.');
  if (!isOpenDay(ctx.cfg, r.date)) throw falha(400, 'A barbearia não abre neste dia.');
  if (r.proId !== 'any' && !ctx.pros.some((p) => p.id === r.proId)) throw falha(400, 'Profissional indisponível.');
  if (r.proId !== 'any' && !canDo(ctx, r.proId, r.serviceIds)) throw falha(400, 'Este profissional não realiza um dos serviços escolhidos.');
  const pro = slotFree(ctx, r.date, r.time, r.proId, r.serviceIds, r.ignore, !!r.equipe);
  if (!pro) throw falha(409, 'Esse horário acabou de ficar indisponível. Escolha outro horário.');
  const itens = r.serviceIds.map((id, ordem) => {
    const s = ctx.svc.get(id)!;
    return { servicoId: id, nome: s.name, duracaoMin: s.dur, precoCentavos: s.price, ordem };
  });
  return {
    pro, itens,
    dur: itens.reduce((t, i) => t + i.duracaoMin, 0),
    preco: itens.reduce((t, i) => t + i.precoCentavos, 0),
    cfg: ctx.cfg,
  };
}

const onlyDigits = (s: string) => String(s || '').replace(/\D/g, '');
export const telefoneSchema = z
  .string()
  .transform(onlyDigits)
  .refine((d) => d.length >= 10 && d.length <= 11, 'O telefone precisa ter DDD + número (10 ou 11 dígitos).');
const emailSchema = z
  .string()
  .trim()
  .max(120)
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Confira o e-mail ou deixe o campo em branco.')
  .optional();
const nomeSchema = z.string().trim().min(3, 'Informe seu nome com pelo menos 3 letras.').max(80);

export const agendamentoPublicoSchema = z.object({
  serviceIds: idsSchema,
  proId: z.string().min(1).default('any'),
  date: z.string().regex(DATA_RE, 'Data inválida.'),
  time: z.string().regex(HORA_RE, 'Horário inválido.'),
  name: nomeSchema,
  phone: telefoneSchema,
  email: emailSchema,
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.').max(72).optional().or(z.literal('')),
  referralCode: z.string().trim().max(20).optional().nullable(),
});

// Indicacao: vale no primeiro agendamento de quem ainda nao foi atendido e nao tem indicacao.
async function aplicarIndicacao(tx: Tx, clienteId: string, codigo?: string | null) {
  if (!codigo) return;
  const indicador = await tx.cliente.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!indicador || indicador.id === clienteId) return;
  const ja = await tx.indicacao.findUnique({ where: { indicadoId: clienteId } });
  if (ja) return;
  const atendidos = await tx.agendamento.count({ where: { clienteId, status: 'concluido' } });
  if (atendidos > 0) return;
  // evita ciclo: quem me indicou nao pode ter sido indicado por mim
  const ciclo = await tx.indicacao.findFirst({ where: { indicadorId: clienteId, indicadoId: indicador.id } });
  if (ciclo) return;
  await tx.indicacao.create({ data: { indicadorId: indicador.id, indicadoId: clienteId } });
}

/*
 * Agendamento pelo site. Funciona sem conta: o cliente e identificado pelo telefone.
 * - Cliente logado: usa a conta dele (nome e e-mail podem ser atualizados).
 * - Telefone novo: cria o cadastro (e a conta, se informou senha).
 * - Telefone ja cadastrado sem login: agenda no cadastro existente sem mexer nos dados dele.
 */
export async function agendarPublico(body: unknown, clienteLogadoId: string | null) {
  const d = agendamentoPublicoSchema.parse(body);
  const senhaHash = d.password ? await bcrypt.hash(d.password, 10) : null;
  return prisma.$transaction(async (tx) => {
    const v = await validarReserva(tx, { serviceIds: d.serviceIds, proId: d.proId, date: d.date, time: d.time, publico: true });
    let cliente;
    let conta: 'logado' | 'criada' | 'existente' | 'sem-conta' = 'sem-conta';
    if (clienteLogadoId) {
      const outro = await tx.cliente.findUnique({ where: { telefone: d.phone } });
      if (outro && outro.id !== clienteLogadoId) throw falha(409, 'Este telefone já pertence a outro cadastro.');
      cliente = await tx.cliente.update({ where: { id: clienteLogadoId }, data: { nome: d.name, telefone: d.phone, ...(d.email !== undefined ? { email: d.email || null } : {}) } });
      conta = 'logado';
    } else {
      cliente = await tx.cliente.findUnique({ where: { telefone: d.phone } });
      if (cliente) {
        conta = cliente.senha ? 'existente' : 'sem-conta';
      } else {
        cliente = await tx.cliente.create({ data: { nome: d.name, telefone: d.phone, email: d.email || null, codigo: await gerarCodigoCliente(tx), senha: senhaHash } });
        conta = senhaHash ? 'criada' : 'sem-conta';
      }
    }
    await aplicarIndicacao(tx, cliente.id, d.referralCode);
    const a = await tx.agendamento.create({
      data: {
        clienteId: cliente.id, profissionalId: v.pro, profissionalEscolhidoId: d.proId === 'any' ? null : d.proId,
        data: d.date, hora: d.time, duracaoMin: v.dur, precoCentavos: v.preco, status: 'agendado', origem: 'site',
        itens: { create: v.itens },
      },
      include: apptInclude,
    });
    return { appt: apptView(a), clienteId: cliente.id, conta, senhaIgnorada: !!senhaHash && conta !== 'criada' && conta !== 'logado' };
  });
}

/* ============ cliente logado: alterar e cancelar o proprio horario ============ */
const alterarSchema = z.object({
  serviceIds: idsSchema,
  proId: z.string().min(1).default('any'),
  date: z.string().regex(DATA_RE, 'Data inválida.'),
  time: z.string().regex(HORA_RE, 'Horário inválido.'),
});

async function apptDoCliente(id: string, clienteId: string) {
  const a = await prisma.agendamento.findUnique({ where: { id } });
  if (!a || a.clienteId !== clienteId) throw falha(404, 'Agendamento não encontrado.');
  if (!['agendado', 'confirmado'].includes(a.status) || a.data < hoje()) throw falha(400, 'Este agendamento não pode mais ser alterado.');
  return a;
}

export async function alterarDoCliente(id: string, clienteId: string, body: unknown) {
  const d = alterarSchema.parse(body);
  await apptDoCliente(id, clienteId);
  return prisma.$transaction(async (tx) => {
    const v = await validarReserva(tx, { ...d, ignore: id, publico: true });
    await tx.agendamentoServico.deleteMany({ where: { agendamentoId: id } });
    const a = await tx.agendamento.update({
      where: { id },
      data: {
        profissionalId: v.pro, profissionalEscolhidoId: d.proId === 'any' ? null : d.proId, data: d.date, hora: d.time,
        duracaoMin: v.dur, precoCentavos: v.preco, status: 'agendado', itens: { create: v.itens },
      },
      include: apptInclude,
    });
    return apptView(a);
  });
}

export async function cancelarDoCliente(id: string, clienteId: string) {
  await apptDoCliente(id, clienteId);
  const a = await prisma.agendamento.update({ where: { id }, data: { status: 'cancelado' }, include: apptInclude });
  return apptView(a);
}

/* ============ equipe: registrar atendimento de balcao / WhatsApp ============ */
export const agendamentoEquipeSchema = z.object({
  clientId: z.string().optional().nullable(),
  name: nomeSchema.optional(),
  phone: telefoneSchema.optional(),
  email: emailSchema,
  serviceIds: idsSchema,
  proId: z.string().min(1),
  date: z.string().regex(DATA_RE, 'Data inválida.'),
  time: z.string().regex(HORA_RE, 'Horário inválido.'),
  note: z.string().trim().max(300).optional(),
});

export async function agendarEquipe(body: unknown) {
  const d = agendamentoEquipeSchema.parse(body);
  if (d.proId === 'any') throw falha(400, 'Escolha o profissional.');
  return prisma.$transaction(async (tx) => {
    const v = await validarReserva(tx, { serviceIds: d.serviceIds, proId: d.proId, date: d.date, time: d.time, equipe: true });
    let clienteId = d.clientId || null;
    if (clienteId) {
      const c = await tx.cliente.findUnique({ where: { id: clienteId } });
      if (!c) throw falha(404, 'Cliente não encontrado.');
    } else {
      if (!d.name || !d.phone) throw falha(400, 'Informe nome e telefone do cliente.');
      const c = await tx.cliente.findUnique({ where: { telefone: d.phone } });
      clienteId = c
        ? c.id
        : (await tx.cliente.create({ data: { nome: d.name, telefone: d.phone, email: d.email || null, codigo: await gerarCodigoCliente(tx) } })).id;
    }
    const a = await tx.agendamento.create({
      data: {
        clienteId, profissionalId: v.pro, profissionalEscolhidoId: d.proId, data: d.date, hora: d.time,
        duracaoMin: v.dur, precoCentavos: v.preco, status: 'agendado', origem: 'balcao', observacao: d.note || null,
        itens: { create: v.itens },
      },
      include: apptInclude,
    });
    return apptView(a);
  });
}

/* ============ equipe: status e conclusao ============ */
const statusSchema = z.object({ status: z.enum(['agendado', 'confirmado', 'concluido', 'cancelado']) });

export async function alterarStatus(id: string, body: unknown) {
  const { status } = statusSchema.parse(body);
  if (status === 'concluido') return concluir(id);
  return prisma.$transaction(async (tx) => {
    const a = await tx.agendamento.findUnique({ where: { id }, include: { itens: true } });
    if (!a) throw falha(404, 'Agendamento não encontrado.');
    if (a.status === 'concluido') throw falha(409, 'Atendimento já concluído. Os pontos já foram creditados.');
    // reativar um cancelado: o horario pode ter sido ocupado por outro cliente nesse meio tempo
    if (a.status === 'cancelado' && status !== 'cancelado') {
      await validarReserva(tx, { serviceIds: a.itens.map((i) => i.servicoId), proId: a.profissionalId, date: a.data, time: a.hora, ignore: a.id, equipe: true }).catch((e) => {
        if (e?.status === 409) throw falha(409, 'O horário deste atendimento já foi ocupado. Registre um novo horário.');
        throw e;
      });
    }
    const up = await tx.agendamento.update({ where: { id }, data: { status }, include: apptInclude });
    return { appt: apptView(up) };
  });
}

/*
 * Conclusao (antes conclude() em core.js):
 * - so atendimentos de hoje ou de datas anteriores;
 * - aplica o beneficio disponivel do cliente (um por atendimento);
 * - credita os pontos uma unica vez por atendimento;
 * - no primeiro atendimento concluido de um indicado, libera o bonus de quem indicou.
 * A linha do agendamento e travada (FOR UPDATE) e os indices unicos do extrato
 * garantem que dois cliques simultaneos nao gerem credito duplicado.
 */
export async function concluir(id: string) {
  return prisma.$transaction(async (tx) => {
    const trava = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM agendamentos WHERE id = ${id} FOR UPDATE`;
    if (!trava.length) throw falha(404, 'Agendamento não encontrado.');
    const a = await tx.agendamento.findUniqueOrThrow({ where: { id } });
    if (a.status === 'concluido') throw falha(409, 'Atendimento já concluído. Os pontos já foram creditados.');
    if (a.status === 'cancelado') throw falha(400, 'Reative o atendimento antes de concluir.');
    if (a.data > hoje()) throw falha(400, 'Só é possível concluir atendimentos de hoje ou de datas anteriores.');
    const cfg = await obterConfiguracao();
    const agora = new Date();
    const antes = await tx.agendamento.count({ where: { clienteId: a.clienteId, status: 'concluido' } });
    const out: { points: number; voucher: { value: number } | null; referral: { referrerId: string; referrerName: string; points: number } | null } = { points: 0, voucher: null, referral: null };

    let desconto = a.descontoCentavos;
    const v = await tx.voucher.findFirst({ where: { clienteId: a.clienteId, status: 'disponivel' }, orderBy: { criadoEm: 'asc' } });
    if (v && !desconto) {
      const usado = await tx.voucher.updateMany({ where: { id: v.id, status: 'disponivel' }, data: { status: 'utilizado', agendamentoUsoId: a.id, usadoEm: agora } });
      if (usado.count === 1) {
        desconto = Math.min(v.valorCentavos, a.precoCentavos);
        out.voucher = { value: desconto / 100 };
      }
    }
    await tx.agendamento.update({ where: { id }, data: { status: 'concluido', concluidoEm: agora, descontoCentavos: desconto } });

    const pontos = Math.floor(((a.precoCentavos - desconto) * cfg.pointsPerReal) / 100);
    const jaCreditado = await tx.movimentoPontos.findFirst({ where: { tipo: 'servico', agendamentoId: a.id } });
    if (pontos > 0 && !jaCreditado) {
      await tx.movimentoPontos.create({ data: { clienteId: a.clienteId, tipo: 'servico', pontos, agendamentoId: a.id, criadoEm: agora } });
      out.points = pontos;
    }

    const rf = await tx.indicacao.findUnique({ where: { indicadoId: a.clienteId }, include: { indicador: { select: { nome: true } } } });
    if (rf && rf.status === 'pendente' && antes === 0) {
      await tx.indicacao.update({ where: { id: rf.id }, data: { status: 'concluida', agendamentoId: a.id, concluidaEm: agora } });
      if (cfg.referralBonus > 0) {
        await tx.movimentoPontos.create({ data: { clienteId: rf.indicadorId, tipo: 'indicacao', pontos: cfg.referralBonus, indicacaoId: rf.id, criadoEm: agora } });
      }
      out.referral = { referrerId: rf.indicadorId, referrerName: rf.indicador.nome, points: cfg.referralBonus };
    }
    const fim = await tx.agendamento.findUniqueOrThrow({ where: { id }, include: apptInclude });
    return { appt: apptView(fim), ...out };
  });
}
