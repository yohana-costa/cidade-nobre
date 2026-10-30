import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { carimbo, dataDe, diffDays, addDays, dow, tmin } from './datas';
import { Cfg } from '../services/configuracao.service';

/*
 * Formatos que a API devolve para as telas (os mesmos nomes de campo do prototipo)
 * e as regras de leitura portadas de core.js: clientStats, club, metrics, periodRange,
 * lapsedClients. Ficam num lugar so para que cada indicador tenha uma unica formula.
 */

export interface ItemV { id: string; name: string; dur: number; price: number }
export interface ApptV {
  id: string; clientId: string; proId: string; chosenPro: string; serviceIds: string[]; items: ItemV[];
  date: string; time: string; dur: number; price: number; discount: number; status: string; source: string;
  note: string | null; createdAt: string; concludedAt: string | null;
}
export interface ClientV { id: string; name: string; phone: string; email: string; code: string; createdAt: string; referredBy: string | null; hasAccount: boolean }
export interface MoveV { id: string; clientId: string; type: string; points: number; apptId: string | null; referralId: string | null; voucherId: string | null; at: string; note: string | null }
export interface RefV { id: string; referrerId: string; referredId: string; status: string; apptId: string | null; createdAt: string; doneAt: string | null }
export interface VoucherV { id: string; clientId: string; title: string; value: number; cost: number; status: string; createdAt: string; usedApptId: string | null; usedAt: string | null }

export const reais = (c: number) => Math.round(c) / 100;

export const fmtPhone = (s: string) => {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const apptInclude = { itens: { orderBy: { ordem: 'asc' } } } satisfies Prisma.AgendamentoInclude;
type ApptRow = Prisma.AgendamentoGetPayload<{ include: typeof apptInclude }>;

export function apptView(a: ApptRow): ApptV {
  return {
    id: a.id,
    clientId: a.clienteId,
    proId: a.profissionalId,
    chosenPro: a.profissionalEscolhidoId || 'any',
    serviceIds: a.itens.map((i) => i.servicoId),
    items: a.itens.map((i) => ({ id: i.servicoId, name: i.nome, dur: i.duracaoMin, price: reais(i.precoCentavos) })),
    date: a.data,
    time: a.hora,
    dur: a.duracaoMin,
    price: reais(a.precoCentavos),
    discount: reais(a.descontoCentavos),
    status: a.status,
    source: a.origem,
    note: a.observacao,
    createdAt: carimbo(a.criadoEm),
    concludedAt: a.concluidoEm ? carimbo(a.concluidoEm) : null,
  };
}

type ClienteRow = Prisma.ClienteGetPayload<{ include: { indicacaoRecebida: true } }>;
export function clientView(c: ClienteRow): ClientV {
  return {
    id: c.id,
    name: c.nome,
    phone: fmtPhone(c.telefone),
    email: c.email || '',
    code: c.codigo,
    createdAt: dataDe(c.criadoEm),
    referredBy: c.indicacaoRecebida?.indicadorId || null,
    hasAccount: !!c.senha,
  };
}

export function moveView(m: Prisma.MovimentoPontosGetPayload<object>): MoveV {
  return { id: m.id, clientId: m.clienteId, type: m.tipo, points: m.pontos, apptId: m.agendamentoId, referralId: m.indicacaoId, voucherId: m.voucherId, at: carimbo(m.criadoEm), note: m.descricao };
}

export function refView(r: Prisma.IndicacaoGetPayload<object>): RefV {
  return { id: r.id, referrerId: r.indicadorId, referredId: r.indicadoId, status: r.status, apptId: r.agendamentoId, createdAt: dataDe(r.criadoEm), doneAt: r.concluidaEm ? carimbo(r.concluidaEm) : null };
}

export function voucherView(v: Prisma.VoucherGetPayload<object>): VoucherV {
  return { id: v.id, clientId: v.clienteId, title: v.titulo, value: reais(v.valorCentavos), cost: v.custoPontos, status: v.status, createdAt: carimbo(v.criadoEm), usedApptId: v.agendamentoUsoId, usedAt: v.usadoEm ? carimbo(v.usadoEm) : null };
}

/* ============ base completa para os relatorios da gestao ============ */
export interface Base {
  cfg: Cfg;
  T: string;
  nowMin: number;
  clients: ClientV[];
  pros: { id: string; name: string; services: string[] }[];
  appts: ApptV[];
  moves: MoveV[];
  referrals: RefV[];
  vouchers: VoucherV[];
  // indices
  cli: Map<string, ClientV>;
  byClient: Map<string, ApptV[]>; // ordem cronologica
  movesBy: Map<string, MoveV[]>; // mais recente primeiro
  apptById: Map<string, ApptV>;
}

export async function carregarBase(cfg: Cfg, T: string, nowMin: number): Promise<Base> {
  const [clientes, pros, ags, movs, inds, vs] = await Promise.all([
    prisma.cliente.findMany({ include: { indicacaoRecebida: true } }),
    prisma.profissional.findMany({ where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }], include: { servicos: { where: { ativo: true }, select: { id: true } } } }),
    prisma.agendamento.findMany({ include: apptInclude }),
    prisma.movimentoPontos.findMany({ orderBy: { criadoEm: 'asc' } }),
    prisma.indicacao.findMany(),
    prisma.voucher.findMany({ orderBy: { criadoEm: 'asc' } }),
  ]);
  const b: Base = {
    cfg, T, nowMin,
    clients: clientes.map(clientView),
    pros: pros.map((p) => ({ id: p.id, name: p.nome, services: p.servicos.map((s) => s.id) })),
    appts: ags.map(apptView),
    moves: movs.map(moveView),
    referrals: inds.map(refView),
    vouchers: vs.map(voucherView),
    cli: new Map(), byClient: new Map(), movesBy: new Map(), apptById: new Map(),
  };
  for (const c of b.clients) { b.cli.set(c.id, c); b.byClient.set(c.id, []); b.movesBy.set(c.id, []); }
  for (const a of b.appts) { b.apptById.set(a.id, a); b.byClient.get(a.clientId)?.push(a); }
  for (const l of b.byClient.values()) l.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  b.moves.forEach((m) => b.movesBy.get(m.clientId)?.push(m));
  for (const l of b.movesBy.values()) l.reverse(); // ja vieram em ordem crescente de criacao
  return b;
}

/* ============ regras de leitura (mesmas formulas do prototipo) ============ */
export const paid = (a: ApptV) => a.price - (a.discount || 0);
export const isOpenStatus = (a: ApptV) => a.status === 'agendado' || a.status === 'confirmado';
export const isOpenDay = (cfg: Cfg, s: string) => !cfg.closedDays.includes(dow(s));
export const balance = (b: Base, cid: string) => (b.movesBy.get(cid) || []).reduce((t, m) => t + m.points, 0);
export const voucherOf = (b: Base, cid: string) => b.vouchers.find((v) => v.clientId === cid && v.status === 'disponivel') || null;
export const nearThreshold = (cfg: Cfg) => Math.round(cfg.redeemPoints * 0.72); // 180 de 250 no prototipo

export function clientStats(b: Base, cid: string) {
  const l = b.byClient.get(cid) || [];
  const done = l.filter((a) => a.status === 'concluido');
  const next = l.find((a) => isOpenStatus(a) && a.date >= b.T) || null;
  const last = done[done.length - 1] || null;
  return { visits: done.length, spent: done.reduce((t, a) => t + paid(a), 0), last, next, points: balance(b, cid), sinceLast: last ? diffDays(b.T, last.date) : null };
}
export type Stats = ReturnType<typeof clientStats>;

export function club(cfg: Cfg, bal: number) {
  const goal = cfg.redeemPoints;
  const p = Math.max(0, Math.min(1, bal / goal));
  return { balance: bal, goal, progress: p, left: Math.max(0, goal - bal), eligible: bal >= goal };
}

export function periodRange(p: string, T: string) {
  if (p === 'hoje') return { from: T, to: T, prevFrom: addDays(T, -7), prevTo: addDays(T, -7), label: 'Hoje', cmp: 'vs. mesmo dia da semana anterior' };
  const n = Number(p);
  // dias fechados (ate ontem) para comparar periodos completos
  return { from: addDays(T, -n), to: addDays(T, -1), prevFrom: addDays(T, -2 * n), prevTo: addDays(T, -n - 1), label: `Últimos ${n} dias (até ontem)`, cmp: `vs. ${n} dias anteriores` };
}

export function openDaysBetween(cfg: Cfg, a: string, z: string) {
  let n = 0, d = a;
  while (d <= z) { if (isOpenDay(cfg, d)) n++; d = addDays(d, 1); }
  return n;
}

export function metrics(b: Base, from: string, to: string, proId?: string | null, cut?: number) {
  const inR = b.appts.filter((a) => a.date >= from && a.date <= to && (!proId || a.proId === proId));
  // cut: compara um dia passado so ate o horario atual (para o filtro "Hoje")
  const done = inR.filter((a) => a.status === 'concluido' && (cut === undefined || tmin(a.time) + a.dur <= cut));
  const canc = inR.filter((a) => a.status === 'cancelado');
  const rev = done.reduce((t, a) => t + paid(a), 0);
  const booked = inR.filter((a) => a.status !== 'cancelado').reduce((t, a) => t + a.dur, 0);
  const cap = openDaysBetween(b.cfg, from, to) * b.cfg.dayCap * (proId ? 1 : b.pros.length);
  const returning = new Set(
    done.filter((a) => (b.byClient.get(a.clientId) || []).some((x) => x.status === 'concluido' && x.date + x.time < a.date + a.time)).map((a) => a.clientId),
  );
  const unique = new Set(done.map((a) => a.clientId));
  return {
    total: inR.length, done: done.length, canc: canc.length, cancRate: inR.length ? canc.length / inR.length : 0,
    rev, ticket: done.length ? rev / done.length : 0, occ: cap ? booked / cap : 0, returning: returning.size, unique: unique.size, list: inR,
  };
}

export function lapsedClients(b: Base) {
  return b.clients
    .map((c) => ({ c, s: clientStats(b, c.id) }))
    .filter(({ s }) => s.last && (s.sinceLast as number) > b.cfg.lapseDays && !s.next)
    .sort((x, y) => (x.s.sinceLast as number) - (y.s.sinceLast as number));
}

export function nearReward(b: Base) {
  const min = nearThreshold(b.cfg);
  return b.clients.map((c) => ({ c, b: balance(b, c.id) })).filter((x) => x.b >= min && x.b < b.cfg.redeemPoints).sort((x, y) => y.b - x.b);
}

export const svcLabel = (a: ApptV) => {
  const n = a.items.map((i) => i.name);
  return n.length <= 1 ? n[0] || '' : n.length === 2 ? `${n[0]} + ${n[1]}` : `${n[0]} + ${n.length - 1} serviços`;
};
export const shortName = (n: string) => {
  const p = n.split(/\s+/).filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || '';
};
