import { prisma } from '../lib/prisma';
import { falha } from '../lib/erros';
import { DATA_RE, addDays, agoraMin, fDM, fRel, hoje, money0, tmin } from '../lib/datas';
import {
  Base, carregarBase, clientStats, club, metrics, periodRange, openDaysBetween, lapsedClients, nearReward, nearThreshold,
  balance, voucherOf, isOpenStatus, isOpenDay, svcLabel, shortName, apptInclude, apptView, ApptV,
} from '../lib/base';
import { obterConfiguracao } from './configuracao.service';
import { serviceView, IMAGENS_SERVICO } from './catalogo.service';

async function base(): Promise<Base> {
  const cfg = await obterConfiguracao();
  return carregarBase(cfg, hoje(), agoraMin());
}

const semLista = (m: ReturnType<typeof metrics>) => {
  const { list: _l, ...rest } = m;
  return rest;
};
const comCliente = (b: Base, a: ApptV) => ({ ...a, clientName: b.cli.get(a.clientId)?.name || '', clientPhone: b.cli.get(a.clientId)?.phone || '' });

/* ============ Visao geral (vDash) ============ */
export async function painel(periodo: string) {
  const p = ['hoje', '7', '30'].includes(periodo) ? periodo : '7';
  const b = await base();
  const T = b.T;
  const pr = periodRange(p, T);
  const m = metrics(b, pr.from, pr.to);
  const pm = metrics(b, pr.prevFrom, pr.prevTo, null, p === 'hoje' ? b.nowMin : undefined);
  let chart: { kind: 'hours' | 'days'; points: { key: string; value: number; done?: number }[]; ref: number };
  if (p === 'hoje') {
    const pts = [];
    for (let h = Math.floor(b.cfg.open / 60); h < Math.ceil(b.cfg.close / 60); h++) {
      const l = m.list.filter((a) => a.status !== 'cancelado' && Math.floor(tmin(a.time) / 60) === h);
      pts.push({ key: String(h), value: l.length });
    }
    chart = { kind: 'hours', points: pts, ref: 0 };
  } else {
    const pts = [];
    let d = pr.from;
    while (d <= pr.to) {
      const mm = metrics(b, d, d);
      pts.push({ key: d, value: mm.rev, done: mm.done });
      d = addDays(d, 1);
    }
    const dias = openDaysBetween(b.cfg, pr.prevFrom, pr.prevTo);
    chart = { kind: 'days', points: pts, ref: dias ? pm.rev / dias : 0 };
  }
  const upcoming = b.appts
    .filter((a) => isOpenStatus(a) && (a.date > T || (a.date === T && tmin(a.time) + a.dur > b.nowMin)))
    .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
    .slice(0, 7)
    .map((a) => comCliente(b, a));
  const byPro = b.pros.map((pro) => ({ id: pro.id, name: pro.name, m: semLista(metrics(b, pr.from, pr.to, pro.id)) }));
  const noPeriodo = (at: string) => at.slice(0, 10) >= pr.from && at.slice(0, 10) <= pr.to;
  return {
    today: T, nowMin: b.nowMin, period: p, range: pr,
    cur: semLista(m), prev: semLista(pm), chart, upcoming, byPro,
    lapsedCount: lapsedClients(b).length,
    club: {
      pointsIssued: b.moves.filter((x) => x.points > 0 && noPeriodo(x.at)).reduce((t, x) => t + x.points, 0),
      redeems: b.moves.filter((x) => x.type === 'resgate' && noPeriodo(x.at)).length,
      pendingReferrals: b.referrals.filter((r) => r.status === 'pendente').length,
      nearReward: nearReward(b).length,
    },
    clientsCount: b.clients.length,
    prosCount: b.pros.length,
    dayCapHours: b.cfg.dayCap / 60,
  };
}

/* ============ Agenda do dia ============ */
export async function agendaDoDia(data: string) {
  const T = hoje();
  const D = DATA_RE.test(data || '') ? data : T;
  const cfg = await obterConfiguracao();
  const ags = await prisma.agendamento.findMany({
    where: { data: D },
    include: { ...apptInclude, cliente: { select: { nome: true, telefone: true } } },
    orderBy: { hora: 'asc' },
  });
  return {
    today: T, nowMin: agoraMin(), date: D, open: isOpenDay(cfg, D),
    appts: ags.map((a) => ({ ...apptView(a), clientName: a.cliente.nome, clientPhone: a.cliente.telefone })),
  };
}

/* ============ Detalhe do agendamento (modal da agenda) ============ */
export async function detalheAgendamento(id: string) {
  const cfg = await obterConfiguracao();
  const a = await prisma.agendamento.findUnique({
    where: { id },
    include: {
      ...apptInclude,
      cliente: { include: { indicacaoRecebida: { include: { indicador: { select: { nome: true } } } } } },
      profissional: { select: { nome: true } },
      movimentos: { where: { tipo: 'servico' } },
    },
  });
  if (!a) throw falha(404, 'Agendamento não encontrado.');
  const outrosConcluidos = await prisma.agendamento.count({ where: { clienteId: a.clienteId, status: 'concluido', id: { not: a.id } } });
  const v = await prisma.voucher.findFirst({ where: { clienteId: a.clienteId, status: 'disponivel' }, orderBy: { criadoEm: 'asc' } });
  const rf = a.cliente.indicacaoRecebida;
  const mv = a.movimentos[0];
  return {
    today: hoje(),
    appt: apptView(a),
    client: { id: a.cliente.id, name: a.cliente.nome, phone: a.cliente.telefone },
    proName: a.profissional.nome,
    move: mv ? { points: mv.pontos, at: apptView(a).concludedAt || '' } : null,
    referral: rf ? { status: rf.status, apptId: rf.agendamentoId, referrerName: rf.indicador.nome } : null,
    firstVisit: outrosConcluidos === 0,
    voucher: v ? { value: v.valorCentavos / 100 } : null,
    rules: { pointsPerReal: cfg.pointsPerReal, referralBonus: cfg.referralBonus },
  };
}

/* ============ Clientes (lista com indicadores) ============ */
export async function listaClientes() {
  const b = await base();
  const rows = b.clients.map((c) => ({ c, s: clientStats(b, c.id) }));
  return { today: b.T, lapseDays: b.cfg.lapseDays, rows };
}

/* ============ Fidelidade ============ */
export async function fidelidade() {
  const b = await base();
  const from = addDays(b.T, -29);
  const nome = (id: string) => b.cli.get(id)?.name || '';
  const members = b.clients.map((c) => ({ c, b: balance(b, c.id) })).filter((x) => x.b > 0 || (b.movesBy.get(x.c.id) || []).length);
  const red = b.moves.filter((m) => m.type === 'resgate');
  const pend = b.referrals.filter((r) => r.status === 'pendente');
  const active = b.vouchers.filter((v) => v.status === 'disponivel');
  const refById = new Map(b.referrals.map((r) => [r.id, r]));
  return {
    today: b.T,
    clubStart: b.cfg.clubStart,
    kpis: {
      circulating: members.reduce((t, x) => t + x.b, 0),
      members: members.length,
      issued30: b.moves.filter((m) => m.points > 0 && m.at >= from).reduce((t, m) => t + m.points, 0),
      redeems: red.length,
      pendingReferrals: pend.length,
      activeVouchers: active.length,
      nearReward: nearReward(b).length,
      nearThreshold: nearThreshold(b.cfg),
    },
    balances: members
      .sort((x, y) => y.b - x.b)
      .slice(0, 100)
      .map(({ c, b: bal }) => ({ id: c.id, name: c.name, balance: bal, hasVoucher: !!voucherOf(b, c.id) })),
    moves: b.moves
      .slice()
      .sort((x, y) => y.at.localeCompare(x.at))
      .slice(0, 60)
      .map((m) => {
        const a = m.apptId ? b.apptById.get(m.apptId) : null;
        const r = m.referralId ? refById.get(m.referralId) : null;
        return {
          ...m, clientName: nome(m.clientId),
          appt: a ? { id: a.id, date: a.date, label: svcLabel(a) } : null,
          referredName: r ? shortName(nome(r.referredId)) : null,
        };
      }),
    referrals: b.referrals
      .slice()
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map((r) => {
        const a = r.apptId ? b.apptById.get(r.apptId) : null;
        const nx = clientStats(b, r.referredId).next;
        return {
          ...r, referrerName: nome(r.referrerId), referredName: nome(r.referredId),
          appt: a ? { date: a.date, label: svcLabel(a) } : null,
          next: nx ? { date: nx.date, time: nx.time } : null,
        };
      }),
    vouchers: active.map((v) => ({ ...v, clientName: nome(v.clientId) })),
  };
}

/* ============ Oportunidades de retorno ============ */
const STATUS: Record<string, string> = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };

export async function oportunidades() {
  const b = await base();
  const T = b.T;
  const L = b.cfg.lapseDays;
  const stats = b.clients.map((c) => ({ c, s: clientStats(b, c.id) }));
  const row = (c: { id: string; name: string; phone: string }, why: string) => ({ c: { id: c.id, name: c.name, phone: c.phone }, why });
  const cost = b.cfg.redeemPoints, title = b.cfg.benefitTitle;
  return {
    today: T,
    lists: {
      lapsed: { label: `Sem retorno há ${L}+ dias`, rows: lapsedClients(b).map(({ c, s }) => row(c, `Último atendimento há ${s.sinceLast} dias (${fDM(s.last!.date)}) · ${svcLabel(s.last!)}`)) },
      recurring: {
        label: 'Clientes recorrentes',
        rows: stats
          .filter(({ s }) => s.visits >= 4 && s.sinceLast !== null && s.sinceLast <= L)
          .sort((x, y) => y.s.visits - x.s.visits)
          .map(({ c, s }) => row(c, `${s.visits} atendimentos · ${money0(s.spent)} no histórico · último ${fRel(s.last!.date, T)}`)),
      },
      next: {
        label: 'Com agendamento futuro',
        rows: stats
          .filter(({ s }) => s.next)
          .sort((x, y) => (x.s.next!.date + x.s.next!.time).localeCompare(y.s.next!.date + y.s.next!.time))
          .map(({ c, s }) => row(c, `${s.next!.date === T ? 'Hoje' : fDM(s.next!.date)} às ${s.next!.time} · ${svcLabel(s.next!)} · ${STATUS[s.next!.status]}`)),
      },
      near: {
        label: 'Perto do resgate',
        rows: [
          ...nearReward(b).map(({ c, b: bal }) => row(c, `${bal} pontos · faltam ${cost - bal} para ${title}`)),
          ...b.clients.filter((c) => balance(b, c.id) >= cost).map((c) => row(c, `${balance(b, c.id)} pontos · já pode resgatar ${title}`)),
        ],
      },
      referral: {
        label: 'Indicações pendentes',
        rows: b.referrals
          .filter((r) => r.status === 'pendente')
          .map((r) => {
            const nx = clientStats(b, r.referredId).next;
            const c = b.cli.get(r.referredId)!;
            return row(c, `Indicado por ${shortName(b.cli.get(r.referrerId)?.name || '')} em ${fDM(r.createdAt)} · ${nx ? `1º atendimento marcado para ${fDM(nx.date)} às ${nx.time}` : 'ainda sem agendamento'}`);
          }),
      },
    },
  };
}

/* ============ Servicos e equipe (gestao) ============ */
export async function catalogoGestao() {
  const b = await base();
  const T = b.T;
  const [categorias, servicos] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { ordem: 'asc' } }),
    prisma.servico.findMany({ where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
  ]);
  const from30 = addDays(T, -29);
  return {
    today: T,
    images: IMAGENS_SERVICO,
    categories: categorias.map((c) => {
      const ids = servicos.filter((s) => s.categoriaId === c.id).map((s) => s.id);
      const n = b.appts.filter((a) => a.status === 'concluido' && a.date >= from30 && a.serviceIds.some((i) => ids.includes(i))).length;
      return { id: c.id, name: c.nome, count30: n };
    }),
    services: servicos.map(serviceView),
    pros: b.pros.map((p) => {
      const m7 = metrics(b, addDays(T, -6), T, p.id);
      return {
        ...p,
        stats: { today: b.appts.filter((a) => a.proId === p.id && a.date === T && a.status !== 'cancelado').length, occ7: m7.occ, done7: m7.done, rev7: m7.rev },
      };
    }),
  };
}

/* ============ Contadores do menu lateral ============ */
export async function contadores() {
  const b = await base();
  return {
    agendaToday: b.appts.filter((a) => a.date === b.T && a.status !== 'cancelado').length,
    lapsed: lapsedClients(b).length,
  };
}

export { club };
