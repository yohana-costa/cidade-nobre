/* ============ gestão da barbearia ============ */
const ANAV = [
  { id: 'dash', label: 'Visão geral', icon: 'dash' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'servicos', label: 'Serviços e equipe', icon: 'scissors' },
  { id: 'estoque', label: 'Estoque', icon: 'box' },
  { id: 'cardapio', label: 'Cardápio', icon: 'glass' },
  { id: 'fidelidade', label: 'Fidelidade', icon: 'crown' },
  { id: 'oportunidades', label: 'Oportunidades', icon: 'target' },
  { id: 'config', label: 'Configurações', icon: 'edit' },
];
const ATITLE = { dash: ['Visão geral', 'Indicadores calculados a partir da agenda'], agenda: ['Agenda', 'Atendimentos por dia e profissional'], clientes: ['Clientes', 'Histórico, frequência e pontos de cada cliente'], servicos: ['Serviços e equipe', 'Catálogo, durações, preços e quem realiza cada serviço'], estoque: ['Estoque', 'Produtos à venda, entradas, vendas e reposição'], cardapio: ['Cardápio', 'Pedidos de bebida do site e os itens do cardápio'], fidelidade: ['Clube Cidade Nobre', 'Saldos, movimentações, benefícios e indicações'], oportunidades: ['Oportunidades de retorno', 'Clientes que pedem uma ação de relacionamento'], config: ['Configurações', 'Regras do clube, funcionamento, agenda e equipe de acesso'] };
const PERFIS = { ADMIN: 'Administrador', GERENTE: 'Gerente', OPERADOR: 'Operador' };
const canManage = () => STAFF && ['ADMIN', 'GERENTE'].includes(STAFF.perfil);
const isAdmin = () => STAFF && STAFF.perfil === 'ADMIN';

const statusPill = s => `<span class="pill st-${s}">${STATUS[s]}</span>`;
function delta(cur, prev, fmt = v => v, invert = false) {
  if (prev === null || prev === undefined) return '';
  if (!prev && !cur) return `<span class="eq">sem variação</span>`;
  if (!prev) return `<span class="eq">sem base anterior</span>`;
  const d = (cur - prev) / prev;
  const good = invert ? d < 0 : d > 0;
  if (Math.abs(d) < 0.005) return `<span class="eq">= ${fmt(prev)}</span>`;
  return `<span class="${good ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</span> <span>(${fmt(prev)})</span>`;
}
const deltaPP = (cur, prev) => { const d = Math.round((cur - prev) * 100); return d === 0 ? `<span class="eq">= ${pct(prev)}</span>` : `<span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} p.p.</span> <span>(${pct(prev)})</span>`; };
// carrega uma leitura da gestão; enquanto não chega, mostra carregando (ou o erro com "tentar de novo")
function load(key, path) { const d = need(key, path, 'staff'); return { d, wait: d ? '' : needErr(key) ? vError(needErr(key), key) : vLoading() }; }

/* ---------- charts (single scale, recessive grid, hover tooltips) ---------- */
function barChart(points, opts = {}) {
  const W = opts.w || 640, H = opts.h || 220, L = 44, Rr = 8, Tp = 14, B = 26;
  const max = Math.max(1, ...points.map(p => p.value), opts.ref || 0);
  const nice = niceMax(max);
  const iw = W - L - Rr, ih = H - Tp - B;
  const bw = Math.min(26, (iw / points.length) * 0.62);
  const step = iw / points.length;
  const ticks = [0, nice / 2, nice];
  const y = v => Tp + ih - (v / nice) * ih;
  const every = Math.ceil(points.length / (opts.maxLabels || 10));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || '')}">`;
  ticks.forEach(t => { s += `<line class="gl" x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${opts.fmtAxis ? opts.fmtAxis(t) : num(t)}</text>`; });
  points.forEach((p, i) => {
    const x = L + step * i + (step - bw) / 2;
    const h = Math.max(p.value > 0 ? 2 : 0, (p.value / nice) * ih);
    const top = Tp + ih - h, r = Math.min(4, bw / 2, h);
    if (h > 0) s += `<path class="bar-r ${p.hi ? 'hi' : ''}" d="M${x},${Tp + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${Tp + ih} Z"/>`;
    s += `<rect x="${L + step * i}" y="${Tp}" width="${step}" height="${ih}" fill="transparent" data-tip="${esc(p.tip)}"/>`;
    if (i % every === 0 || i === points.length - 1) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>`;
  });
  if (opts.ref) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(opts.ref)}" y2="${y(opts.ref)}" stroke="#8c867c" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  s += `</svg>`;
  return s;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10; return n * p; }

/* ---------- Visão geral (indicadores calculados no servidor) ---------- */
function vDash() {
  const { d: P, wait } = load('painel:' + UI.period, `/gestao/painel?periodo=${UI.period}`);
  const toolbar = `<div class="toolbar">
    <div class="seg2" role="tablist" aria-label="Período">${[['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias']].map(([k, l]) => `<button class="${UI.period === k ? 'on' : ''}" data-act="period" data-p="${k}">${l}</button>`).join('')}</div>
    ${P ? `<span class="note">${P.range.label} · comparação ${P.range.cmp}</span>` : ''}
  </div>`;
  if (!P) return toolbar + wait;
  const m = P.cur, pm = P.prev, T = P.today;
  const kpi = (k, icon, v, d, lead) => `<div class="kpi ${lead ? 'lead' : ''}"><span class="k">${ic(icon)}${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  let pts, chartTitle;
  if (P.chart.kind === 'hours') {
    chartTitle = 'Agenda de hoje por horário';
    pts = P.chart.points.map(p => ({ label: `${p.key}h`, value: p.value, tip: `${p.key}h às ${Number(p.key) + 1}h · ${p.value} atendimento${p.value === 1 ? '' : 's'}` }));
  } else {
    chartTitle = 'Faturamento por dia';
    pts = P.chart.points.map(p => { const dd = parseD(p.key); return { label: UI.period === '7' ? `${WD[dd.getDay()]} ${dd.getDate()}` : `${dd.getDate()}/${dd.getMonth() + 1}`, value: p.value, hi: p.key === T, tip: `${WD[dd.getDay()]}, ${fDM(p.key)} · ${money0(p.value)} · ${p.done} concluído${p.done === 1 ? '' : 's'}` }; });
  }
  const maxRev = Math.max(1, ...P.byPro.map(x => x.m.rev));
  return `${toolbar}
  <div class="kpis">
    ${kpi(UI.period === 'hoje' ? 'Agendamentos do dia' : 'Agendamentos', 'calendar', num(m.total), delta(m.total, pm.total, num))}
    ${kpi('Atendimentos concluídos', 'check', num(m.done), delta(m.done, pm.done, num))}
    ${kpi('Cancelamentos', 'ban', `${num(m.canc)} <small style="font-size:14px;color:var(--muted)">${pct(m.cancRate)}</small>`, delta(m.canc, pm.canc, num, true))}
    ${kpi('Faturamento', 'wallet', money0(m.rev), delta(m.rev, pm.rev, money0), true)}
    ${kpi('Ticket médio', 'ticket', money0(m.ticket), delta(m.ticket, pm.ticket, money0))}
    ${kpi('Ocupação da agenda', 'pie', pct(m.occ), deltaPP(m.occ, pm.occ))}
    ${kpi('Clientes que retornaram', 'repeat', m.unique ? pct(m.returning / m.unique) : '-', `${m.returning} de ${m.unique} atendidos${pm.unique && m.unique ? ' · ' + deltaPP(m.returning / m.unique, pm.returning / pm.unique) : ''}`)}
    ${kpi(`Sem retorno há ${LAPSE_DAYS}+ dias`, 'hourglass', num(P.lapsedCount), `<button class="link" data-act="opp" data-k="lapsed">Ver oportunidades</button>`)}
  </div>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-h"><h2>${chartTitle}</h2><div class="r legend2">${UI.period === 'hoje' ? `<span><i style="background:#c99d5c"></i>Atendimentos marcados</span>` : `<span><i style="background:#c99d5c"></i>Faturamento do dia</span><span><i style="background:transparent;border-top:2px dashed #8c867c;height:0;border-radius:0;width:14px"></i>Média diária do período anterior</span>`}</div></div>
      <div class="panel-b" style="position:relative" data-chart>${barChart(pts, { w: Math.round(Math.min(640, Math.max(300, (innerWidth >= 1100 ? (innerWidth - 300) * 0.6 : innerWidth - (innerWidth >= 1024 ? 330 : 70))))), h: innerWidth < 600 ? 200 : 230, aria: chartTitle, ref: P.chart.ref, fmtAxis: UI.period === 'hoje' ? num : v => v >= 1000 ? `${num(v / 1000)} mil` : num(v), maxLabels: innerWidth < 600 ? (UI.period === '30' ? 5 : 7) : (UI.period === '30' ? 8 : 10) })}</div>
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Próximos agendamentos</h2><button class="link" data-act="anav" data-id="agenda">Abrir agenda</button></div>
      <div class="panel-b"><div class="list">${P.upcoming.length ? P.upcoming.map(a => `<button class="lrow" data-act="appt" data-id="${a.id}"><span class="tm">${a.time}<small>${a.date === T ? 'hoje' : fDM(a.date)}</small></span><span style="min-width:0"><span class="nm" style="display:block">${esc(a.clientName)}${a.source === 'site' ? ' <span class="tag tag-gold">Site</span>' : ''}</span><span class="ds" style="display:block">${esc(apptLabel(a))} · ${esc(proName(a.proId))}</span></span>${statusPill(a.status)}</button>`).join('') : '<div class="empty">Nenhum agendamento futuro.</div>'}</div></div>
    </section>
  </div>
  <div class="grid-2 even">
    <section class="panel">
      <div class="panel-h"><h2>Resumo por profissional</h2><span class="note">${P.range.label}</span></div>
      <div class="panel-b">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Profissional</th><th class="r">Concluídos</th><th class="r">Faturamento</th><th>Ocupação</th></tr></thead><tbody>
        ${P.byPro.map(({ name, m }) => `<tr><td><span class="nm" style="font-family:var(--serif);font-size:15px;font-weight:500">${esc(name)}</span></td><td class="r">${m.done}</td><td class="r"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">${money0(m.rev)}<div class="mbar" style="width:90px"><i style="width:${Math.round(m.rev / maxRev * 100)}%"></i></div></div></td><td><div class="prog"><div class="mbar"><i style="width:${Math.round(Math.min(1, m.occ) * 100)}%"></i></div><small>${pct(m.occ)}</small></div></td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Clube e atalhos</h2></div>
      <div class="panel-b">
        <div class="cd-kpis" style="margin-bottom:12px"><div><small>Pontos emitidos</small><b>${num(P.club.pointsIssued)}</b></div><div><small>Resgates</small><b>${P.club.redeems}</b></div><div><small>Indicações pendentes</small><b>${P.club.pendingReferrals}</b></div><div><small>Perto do resgate</small><b>${P.club.nearReward}</b></div></div>
        <div class="shortcuts">
          <button class="sc" data-act="anav" data-id="agenda">${ic('calendar')}Agenda<small>Dia a dia</small></button>
          <button class="sc" data-act="anav" data-id="clientes">${ic('users')}Clientes<small>${P.clientsCount} cadastrados</small></button>
          <button class="sc" data-act="anav" data-id="fidelidade">${ic('crown')}Fidelidade<small>Saldos e indicações</small></button>
        </div>
      </div>
    </section>
  </div>
  <p class="note">Faturamento considera atendimentos concluídos, já com benefícios descontados. Ocupação = minutos agendados ÷ ${P.prosCount} profissiona${P.prosCount === 1 ? 'l' : 'is'} × ${num(P.dayCapHours)}h por dia de funcionamento.</p>`;
}

/* ---------- Agenda ---------- */
function vAgenda() {
  const T = todayStr();
  const D = UI.agDate || T;
  const { d: G, wait } = load('agenda:' + D, `/gestao/agenda?data=${D}`);
  const pros = UI.agPro === 'all' ? DB.pros : DB.pros.filter(p => p.id === UI.agPro);
  const toolbar = `<div class="toolbar">
    <div class="datenav"><button class="ib" data-act="ag-day" data-n="-1" aria-label="Dia anterior">${ic('left')}</button><div class="dl">${fDayLong(D).replace(/^./, x => x.toUpperCase())}<small>${D === T ? 'Hoje' : fRel(D)}${isOpen(D) ? '' : ' · fechado'}</small></div><button class="ib" data-act="ag-day" data-n="1" aria-label="Próximo dia">${ic('right')}</button>${D !== T ? `<button class="btn btn-ghost btn-sm" data-act="ag-today">Hoje</button>` : ''}</div>
    <div class="seg2">${[['all', 'Todos'], ...DB.pros.map(p => [p.id, p.name])].map(([k, l]) => `<button class="${UI.agPro === k ? 'on' : ''}" data-act="ag-pro" data-p="${k}">${esc(l)}</button>`).join('')}</div>
    <button class="btn btn-gold btn-sm" data-act="new-appt">${ic('plus')} Novo atendimento</button>
  </div>`;
  if (!G) return toolbar + wait;
  const list = G.appts.filter(a => UI.agPro === 'all' || a.proId === UI.agPro);
  const cnt = s => list.filter(a => a.status === s).length;
  const HH = 64;
  const hours = []; for (let h = Math.floor(OPEN / 60); h <= Math.ceil(CLOSE / 60); h++) hours.push(h);
  const H = (CLOSE - OPEN) / 60 * HH;
  const block = a => { const top = (tmin(a.time) - OPEN) / 60 * HH; const h = Math.max(26, a.dur / 60 * HH - 3); return `<button class="blk st-${a.status} ${UI.hl === a.id ? 'hl' : ''}" style="top:${top + 1}px;height:${h}px" data-act="appt" data-id="${a.id}" title="${esc(a.clientName)} · ${a.time}"><b>${a.time} · ${esc(a.clientName)}</b>${h > 40 ? `<span>${esc(apptLabel(a))}</span>` : ''}${h > 58 ? `<span>${a.payment && PAY[a.payment.status] ? PAY[a.payment.status][0] : STATUS[a.status]}${a.source === 'site' ? ' · site' : ''}</span>` : ''}</button>`; };
  const nowTop = D === T && nowMin() > OPEN && nowMin() < CLOSE ? (nowMin() - OPEN) / 60 * HH : null;
  // atendimento de profissional que saiu da equipe continua aparecendo na lista do celular
  return `${toolbar}
  <div class="ag-sum">${['agendado', 'confirmado', 'concluido', 'cancelado'].map(s => `<span class="pill st-${s}">${STATUS[s]} · ${cnt(s)}</span>`).join('')}<span class="note" style="align-self:center">${list.length} no dia · clique para ver detalhes</span></div>
  <div class="desk-only">
    <div class="tl-wrap"><div class="tl" style="grid-template-columns:58px repeat(${pros.length}, minmax(220px,1fr));--hh:${HH}px">
      <div class="tl-hcell" style="padding:10px 8px"></div>
      ${pros.map(p => { const l = list.filter(a => a.proId === p.id && a.status !== 'cancelado'); return `<div class="tl-hcell">${esc(p.name)}<small>${l.length} atend. · ${pct(l.reduce((t, a) => t + a.dur, 0) / DAY_CAP)}</small></div>`; }).join('')}
      <div class="tl-times" style="height:${H}px">${hours.map(h => `<span style="top:${(h * 60 - OPEN) / 60 * HH}px">${pad(h)}:00</span>`).join('')}</div>
      ${pros.map(p => `<div class="tl-col" style="height:${H}px">${list.filter(a => a.proId === p.id).map(block).join('')}${nowTop !== null ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}</div>`).join('')}
    </div></div>
  </div>
  <div class="mobile-only"><div class="ag-list">${list.length ? list.map(a => `<button class="ag-card ${UI.hl === a.id ? 'hl' : ''}" data-act="appt" data-id="${a.id}"><span class="tm">${a.time}<small>${a.dur} min</small></span><span><span class="top"><span class="nm">${esc(a.clientName)}</span>${statusPill(a.status)}</span><span class="ds" style="display:block">${esc(apptLabel(a))}</span><span class="pr" style="display:block">${esc(proName(a.proId))}${a.source === 'site' ? ' · agendado pelo site' : ''}</span>${a.payment ? `<span style="display:block;margin-top:4px">${payPill(a)}</span>` : ''}</span></button>`).join('') : `<div class="empty">${G.open ? 'Nenhum atendimento neste dia.' : 'Barbearia fechada neste dia.'}</div>`}</div></div>`;
}

/* appointment detail modal */
function vApptModal(id) {
  const k = 'appt:' + id;
  const X = need(k, `/gestao/agendamentos/${id}`, 'staff');
  if (!X) return sheet('Atendimento', '', needErr(k) ? vError(needErr(k), k) : vLoading());
  const a = X.appt, c = X.client, T = X.today, R = X.rules;
  const ask = UI.confirmAct;
  const canConclude = a.date <= T;
  let impact = '';
  if (a.status === 'concluido') {
    impact = `<div class="callout ok">${ic('check')}<span>${X.move ? `+${X.move.points} pontos creditados${X.move.at ? ' em ' + fStamp(X.move.at) : ''}.` : 'Atendimento sem valor elegível para pontos.'}${a.discount ? ` Benefício aplicado: −${money(a.discount)}.` : ''}${X.referral && X.referral.apptId === a.id ? ` Liberou +${R.referralBonus} pts para ${esc(shortName(X.referral.referrerName))} (indicação).` : ''}</span></div>`;
  } else if (a.status !== 'cancelado') {
    const est = Math.floor((a.price - (X.voucher ? Math.min(X.voucher.value, a.price) : 0)) * R.pointsPerReal);
    impact = `<div class="callout gold">${ic('crown')}<span>Ao concluir: +${est} pts para ${esc(firstName(c.name))} (${R.pointsPerReal} pt por R$ 1)${X.voucher ? `, com o benefício de ${money(X.voucher.value)} aplicado` : ''}.${X.referral && X.referral.status === 'pendente' && X.firstVisit ? ` Primeiro atendimento de um indicado: libera +${R.referralBonus} pts para ${esc(shortName(X.referral.referrerName))}.` : ''}</span></div>`;
  }
  const acts = [];
  if (a.status === 'agendado') acts.push(`<button class="btn btn-line" data-act="st" data-id="${a.id}" data-s="confirmado">${ic('check')} Confirmar</button>`);
  if (isOpenStatus(a)) {
    acts.push(`<button class="btn btn-ghost" data-act="ask" data-id="${a.id}" data-s="cancelado">Cancelar</button>`);
    acts.push(canConclude ? `<button class="btn btn-gold" data-act="ask" data-id="${a.id}" data-s="concluido">Marcar como concluído</button>` : `<span class="note" style="align-self:center">Conclusão disponível no dia do atendimento</span>`);
  }
  if (a.status === 'cancelado') acts.push(`<button class="btn btn-line" data-act="st" data-id="${a.id}" data-s="agendado">${ic('refresh')} Reativar</button>`);
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh">
    <div class="modal-h"><div><h3 id="mh">${esc(c.name)}</h3><p>${fDayLong(a.date).replace(/^./, x => x.toUpperCase())} · ${a.time} às ${tstr(tmin(a.time) + a.dur)} · <button class="link" data-act="client" data-id="${c.id}">Ver cliente</button></p></div><div style="display:flex;gap:8px;align-items:center">${statusPill(a.status)}<button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div></div>
    <div class="modal-b">
      <div class="det">
        <div class="full"><small>Serviços</small><b>${a.items.map(i => `${esc(i.name)} <span class="note">(${i.dur} min)</span>`).join('<br>')}</b></div>
        <div><small>Profissional</small><b>${esc(X.proName)}</b></div>
        <div><small>Valor</small><b class="tnum">${money(a.price)}${a.discount ? ` <span class="note">−${money(a.discount)}</span>` : ''}</b></div>
        <div><small>Telefone</small><b>${esc(fmtPhone(c.phone))}</b></div>
        <div><small>Origem</small><b>${a.source === 'site' ? 'Site' : 'Balcão / WhatsApp'}</b></div>
        ${a.payment ? `<div class="full"><small>Pagamento online (Mercado Pago)</small><b>${payPill(a)} <span class="tnum">${money(a.payment.amount)}</span>${a.payment.paidAt ? ` <span class="note">em ${fStamp(a.payment.paidAt)}</span>` : a.payment.status === 'pendente' ? ` <span class="note">até as ${payUntil(a)}</span>` : ''}</b></div>` : ''}
        <div class="full"><small>Registrado em</small><b>${fStamp(a.createdAt)}</b></div>
        ${a.note ? `<div class="full"><small>Observação</small><b>${esc(a.note)}</b></div>` : ''}
      </div>
      ${impact}
      ${a.payment && a.payment.status === 'pago' && a.status === 'cancelado' ? `<div class="callout gold">${ic('alert')}<span>Este horário foi pago online e está cancelado. Faça o estorno pelo Mercado Pago ou remarque com o cliente.</span></div>` : ''}
      ${a.payment && a.payment.status === 'pendente' ? `<div class="callout gold">${ic('hourglass')}<span>O cliente ainda não pagou. Se não pagar até as ${payUntil(a)}, o horário é cancelado sozinho e volta a ficar livre.</span></div>` : ''}
      ${ask && ask.id === a.id ? `<div class="confirm-box"><p>${ask.s === 'concluido' ? `Confirmar a conclusão? Os pontos serão creditados uma única vez para este atendimento.` : 'Cancelar este atendimento na agenda?'}</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="ask-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="st" data-id="${a.id}" data-s="${ask.s}">${ask.s === 'concluido' ? 'Concluir atendimento' : 'Cancelar atendimento'}</button></div></div>` : ''}
    </div>
    ${(ask && ask.id === a.id) || !acts.length ? '' : `<div class="modal-f">${acts.join('')}</div>`}
  </div>`;
}

/* novo atendimento (balcão / WhatsApp) */
function vNewAppt(L) {
  const v = L.v || {};
  const e = L.err;
  const date = v.date || UI.agDate || todayStr();
  return sheet('Novo atendimento', 'Registrar cliente de balcão ou WhatsApp na agenda', `<form class="form" id="na-form" style="margin-top:0" novalidate>
    <div class="fld-row"><div class="fld"><label for="na-name">Nome do cliente</label><input id="na-name" value="${esc(v.name || '')}" autocomplete="off"></div><div class="fld"><label for="na-phone">Telefone</label><input id="na-phone" type="tel" inputmode="numeric" value="${esc(v.phone || '')}" placeholder="(00) 00000-0000"></div></div>
    <div class="fld"><label>Serviços</label><div class="pchips">${DB.services.map(s => `<label class="pchip ${v.svc && v.svc.includes(s.id) ? 'on' : ''}"><input type="checkbox" name="na-svc" value="${s.id}" ${v.svc && v.svc.includes(s.id) ? 'checked' : ''} style="accent-color:var(--gold)">${esc(s.name)}</label>`).join('')}</div></div>
    <div class="fld-row"><div class="fld"><label for="na-pro">Profissional</label><select id="na-pro">${DB.pros.map(p => `<option value="${p.id}" ${v.pro === p.id || (!v.pro && UI.agPro === p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div class="fld"><label for="na-date">Data</label><input id="na-date" type="date" value="${date}"></div></div>
    <div class="fld-row"><div class="fld"><label for="na-time">Horário</label><input id="na-time" type="time" step="300" min="${tstr(OPEN)}" max="${tstr(CLOSE)}" value="${esc(v.time || '')}"></div><div class="fld"><label for="na-note">Observação<em>opcional</em></label><input id="na-note" value="${esc(v.note || '')}" maxlength="300"></div></div>
    ${e ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(e)}</div></div>` : ''}
  </form><div class="callout gold">${ic('info')}<span>O telefone identifica o cliente: se já existir cadastro, o atendimento entra no histórico dele.</span></div>`,
  `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="new-appt-save">Registrar</button>`);
}

/* ---------- Clientes ---------- */
function clientRows(all) {
  const q = UI.clientQ.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let rows = all.slice();
  if (q) rows = rows.filter(({ c }) => c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) || onlyDigits(c.phone).includes(onlyDigits(q) || '§'));
  if (UI.clientFilter === 'next') rows = rows.filter(r => r.s.next);
  if (UI.clientFilter === 'lapsed') rows = rows.filter(r => r.s.last && r.s.sinceLast > LAPSE_DAYS && !r.s.next);
  if (UI.clientFilter === 'points') rows = rows.filter(r => r.s.points > 0);
  const sorters = { recent: (a, b) => ((b.s.last?.date || '') + (b.s.next?.date || '')).localeCompare((a.s.last?.date || '') + (a.s.next?.date || '')) || b.c.createdAt.localeCompare(a.c.createdAt), name: (a, b) => a.c.name.localeCompare(b.c.name), spent: (a, b) => b.s.spent - a.s.spent, points: (a, b) => b.s.points - a.s.points, visits: (a, b) => b.s.visits - a.s.visits };
  rows.sort(sorters[UI.clientSort] || sorters.recent);
  return rows;
}
function vClientsList() {
  const C = CACHE.clientes && CACHE.clientes.data;
  if (!C) return vLoading();
  const rows = clientRows(C.rows);
  if (!C.rows.length) return `<div class="empty">Nenhum cliente cadastrado ainda. Os clientes entram aqui ao agendar pelo site ou quando a equipe registra um atendimento.</div>`;
  if (!rows.length) return `<div class="empty">Nenhum cliente encontrado${UI.clientQ ? ` para “${esc(UI.clientQ)}”` : ' neste filtro'}.</div>`;
  const shown = rows.slice(0, 80);
  return `<div class="desk-only"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Último atendimento</th><th class="r">Atendimentos</th><th class="r">Total gasto</th><th class="r">Pontos</th><th>Próximo agendamento</th></tr></thead><tbody>
    ${shown.map(({ c, s }) => `<tr class="click" data-act="client" data-id="${c.id}" tabindex="0"><td><span class="nm">${esc(c.name)}</span><span class="sm">${esc(c.phone)}</span></td><td>${s.last ? `${fDM(s.last.date)} <span class="sm">${fRel(s.last.date)}</span>` : '<span class="sm">-</span>'}</td><td class="r">${s.visits}</td><td class="r">${money0(s.spent)}</td><td class="r gold">${s.points}</td><td>${s.next ? `${fDM(s.next.date)} · ${s.next.time} <span class="sm">${STATUS[s.next.status]}</span>` : '<span class="sm">-</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="mobile-only"><div class="ccards">${shown.map(({ c, s }) => `<button class="ccard" data-act="client" data-id="${c.id}"><span class="ini">${initials(c.name)}</span><span style="min-width:0"><span class="nm" style="display:block">${esc(c.name)}</span><span class="ds" style="display:block">${s.visits} atend. · ${s.last ? 'último ' + fDM(s.last.date) : 'sem atendimento'}${s.next ? ' · próximo ' + fDM(s.next.date) : ''}</span></span><span class="pt">${s.points}<small>pts</small></span></button>`).join('')}</div></div>
  ${rows.length > shown.length ? `<p class="note" style="margin-top:10px">Mostrando ${shown.length} de ${rows.length}. Refine a busca para ver outros clientes.</p>` : ''}`;
}
function vClientes() {
  const { d: C, wait } = load('clientes', '/gestao/clientes');
  if (!C) return wait;
  const all = C.rows.map(r => r.s);
  const f = [['all', 'Todos', C.rows.length], ['next', 'Com agendamento', all.filter(s => s.next).length], ['lapsed', `Sem retorno ${LAPSE_DAYS}+ dias`, all.filter(s => s.last && s.sinceLast > LAPSE_DAYS && !s.next).length], ['points', 'Com pontos', all.filter(s => s.points > 0).length]];
  return `
  <div class="toolbar">
    <label class="search">${ic('search')}<input id="client-q" type="search" placeholder="Buscar por nome ou telefone" value="${esc(UI.clientQ)}" aria-label="Buscar cliente"></label>
    <select class="sel" id="client-sort" aria-label="Ordenar">${[['recent', 'Atividade recente'], ['name', 'Nome (A a Z)'], ['visits', 'Mais atendimentos'], ['spent', 'Maior gasto'], ['points', 'Mais pontos']].map(([k, l]) => `<option value="${k}" ${UI.clientSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
  </div>
  <div class="seg2">${f.map(([k, l, n]) => `<button class="${UI.clientFilter === k ? 'on' : ''}" data-act="cfilter" data-k="${k}">${l}<span class="n">${n}</span></button>`).join('')}</div>
  <section class="panel"><div class="panel-b" id="client-results">${vClientsList()}</div></section>`;
}
function vClientModal(id, L) {
  const k = 'cliente:' + id;
  const V = need(k, `/gestao/clientes/${id}`, 'staff');
  if (!V) return sheet('Cliente', '', needErr(k) ? vError(needErr(k), k) : vLoading());
  const c = V.client, s = V.stats, cb = V.club;
  const ap = V.appts.slice().reverse();
  const ms = V.moves;
  const nm = cid => V.names[cid] || '';
  const given = V.referralsGiven, got = V.referralGot;
  const draftK = s.next ? 'next' : s.sinceLast > LAPSE_DAYS ? 'lapsed' : cb.balance >= Math.round(DB.benefit.cost * 0.72) ? 'near' : 'recurring';
  const code = L && L.code;
  return `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mh">
    <div class="modal-h"><div style="display:flex;gap:12px;align-items:center"><span class="ini" style="width:46px;height:46px;font-size:17px">${initials(c.name)}</span><div><h3 id="mh">${esc(c.name)}</h3><p>${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''} · cliente desde ${fDM(c.createdAt)}/${parseD(c.createdAt).getFullYear()} · ${c.hasAccount ? 'com conta no site' : 'sem conta no site'}</p></div></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-b">
      <div class="cd-kpis"><div><small>Atendimentos</small><b>${s.visits}</b></div><div><small>Total gasto</small><b>${money0(s.spent)}</b></div><div><small>Ticket médio</small><b>${s.visits ? money0(s.spent / s.visits) : '-'}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">${cb.balance}</b></div></div>
      ${code ? `<div class="callout ok">${ic('check')}<span>Código de primeiro acesso: <b style="font-size:17px;letter-spacing:.12em">${esc(code.code)}</b>. Válido por 48 horas. O cliente entra no site em Perfil, opção "Tenho um código", com o telefone ${esc(c.phone)}.${code.hasAccount ? ' Usar o código troca a senha atual dele.' : ''}</span></div>` : ''}
      <div class="cd-sec"><h4>Agendamentos</h4><div class="mini">${ap.length ? ap.slice(0, 12).map(a => `<button data-act="appt" data-id="${a.id}"><span class="l"><b>${fDM(a.date)}/${parseD(a.date).getFullYear()} · ${a.time}</b><small>${esc(apptNames(a).join(' + '))} · ${esc(proName(a.proId, V.proNames))} · ${money(a.price)}</small></span>${statusPill(a.status)}</button>`).join('') : '<div>Nenhum agendamento.</div>'}</div>${ap.length > 12 ? `<p class="note" style="margin-top:6px">+${ap.length - 12} agendamentos anteriores</p>` : ''}</div>
      <div class="cd-sec"><h4>Movimentações de pontos</h4><div class="mini">${ms.length ? ms.slice(0, 10).map(m => { const a = m.apptId && V.appts.find(x => x.id === m.apptId); const r = m.referralId && given.find(x => x.id === m.referralId); return `<div><span class="l"><b>${(MOVE[m.type] || MOVE.ajuste)[0]}</b><small>${fStamp(m.at)}${a ? ' · ' + esc(apptLabel(a)) : ''}${r ? ' · ' + esc(shortName(nm(r.referredId))) : ''}</small></span><span class="${m.points > 0 ? 'plus' : 'minus'}">${m.points > 0 ? '+' : '−'}${Math.abs(m.points)} pts</span></div>`; }).join('') : '<div>Nenhuma movimentação ainda.</div>'}</div></div>
      <div class="cd-sec"><h4>Indicações</h4><div class="mini">
        ${got ? `<div><span class="l"><b>Indicado por ${esc(nm(got.referrerId))}</b><small>${got.status === 'concluida' ? 'Primeiro atendimento concluído' : 'Aguardando primeiro atendimento'}</small></span>${got.status === 'concluida' ? statusPill('concluido') : '<span class="pill st-confirmado">Pendente</span>'}</div>` : ''}
        ${given.map(r => `<div><span class="l"><b>Indicou ${esc(nm(r.referredId))}</b><small>${fDM(r.createdAt)} · ${r.status === 'concluida' ? `+${DB.rules.referral} pts liberados` : 'aguardando primeiro atendimento'}</small></span>${r.status === 'concluida' ? statusPill('concluido') : '<span class="pill st-confirmado">Pendente</span>'}</div>`).join('')}
        ${!got && !given.length ? '<div>Nenhuma indicação registrada.</div>' : ''}
      </div></div>
    </div>
    <div class="modal-f"><button class="btn btn-ghost" data-act="access-code" data-id="${c.id}">${ic('user')} Gerar código de acesso</button><button class="btn btn-line" data-act="draft-msg" data-id="${c.id}" data-k="${draftK}">${ic('msg')} Preparar mensagem</button></div>
  </div>`;
}

/* ---------- Serviços e equipe ---------- */
function vServAdmin() {
  const tab = UI.svcTab;
  const { d: K, wait } = load('cat-gestao', '/gestao/catalogo');
  const can = canManage();
  const toolbar = `<div class="toolbar"><div class="seg2">${[['servicos', 'Serviços'], ['equipe', 'Profissionais'], ['categorias', 'Categorias']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="svctab" data-k="${k}">${l}</button>`).join('')}</div>
    ${can && tab === 'servicos' ? `<button class="btn btn-gold btn-sm" data-act="svc-new">${ic('plus')} Novo serviço</button>` : ''}${can && tab === 'equipe' ? `<button class="btn btn-gold btn-sm" data-act="pro-new">${ic('plus')} Novo profissional</button>` : ''}
    ${can ? '' : '<span class="note">Somente gerentes e administradores alteram o catálogo.</span>'}</div>`;
  if (!K) return toolbar + wait;
  const catName = id => (K.categories.find(c => c.id === id) || {}).name || id;
  return `${toolbar}
  ${tab === 'servicos' ? `<section class="panel"><div class="panel-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Serviço</th><th>Categoria</th><th class="r">Duração</th><th class="r">Preço</th><th>Profissionais</th><th>No site</th><th></th></tr></thead><tbody>
    ${K.services.length ? K.services.map(s => `<tr><td><div class="svc-cell"><img src="${img(s.img)}" alt=""><span><span class="nm">${esc(s.name)}</span><span class="sm">${esc(s.desc)}</span></span></div></td><td>${esc(catName(s.cat))}</td><td class="r">${s.dur} min</td><td class="r">${money(s.price)}</td><td>${K.pros.filter(p => p.services.includes(s.id)).map(p => esc(p.name)).join(', ') || '-'}</td><td><button class="switch ${s.visible ? 'on' : ''}" role="switch" aria-checked="${s.visible}" aria-label="Exibir ${esc(s.name)} no site" ${can ? `data-act="svc-vis" data-id="${s.id}"` : 'disabled'}></button></td><td class="r">${can ? `<button class="link" data-act="svc-edit" data-id="${s.id}">Editar</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="7"><div class="empty">Nenhum serviço cadastrado.</div></td></tr>'}
  </tbody></table></div><p class="note" style="margin-top:10px">Ocultar um serviço remove o item do catálogo do cliente. Mudanças de preço e duração valem para os próximos agendamentos; os já marcados mantêm o valor da reserva.</p></div></section>` : ''}
  ${tab === 'equipe' ? `<div class="pro-cards">${K.pros.map(p => `<section class="panel"><div class="panel-h"><h2 class="pro-h">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span>${initials(p.name)}</span>`}${esc(p.name)}</h2>${can ? `<button class="link" data-act="pro-edit" data-id="${p.id}">Editar</button>` : ''}</div><div class="panel-b"><div class="cd-kpis"><div><small>Hoje</small><b>${p.stats.today}</b></div><div><small>Ocupação 7 dias</small><b>${pct(p.stats.occ7)}</b></div><div><small>Concluídos 7 dias</small><b>${p.stats.done7}</b></div><div><small>Faturamento 7 dias</small><b>${money0(p.stats.rev7)}</b></div></div><div class="note" style="margin-top:12px">Serviços que realiza${can ? ' (toque para alternar)' : ''}</div><div class="pchips">${K.services.map(s => { const on = p.services.includes(s.id); return `<button class="pchip ${on ? 'on' : ''}" ${can ? `data-act="pro-svc" data-p="${p.id}" data-s="${s.id}"` : 'disabled'} aria-pressed="${on}">${ic(on ? 'check' : 'plus')}${esc(s.name)}</button>`; }).join('')}</div></div></section>`).join('')}</div>` : ''}
  ${tab === 'categorias' ? `<section class="panel"><div class="panel-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Categoria</th><th>Serviços</th><th class="r">Atendimentos (30 dias)</th></tr></thead><tbody>${K.categories.map(c => `<tr><td class="nm" style="font-family:var(--serif);font-size:16px;font-weight:500">${esc(c.name)}</td><td>${K.services.filter(s => s.cat === c.id).map(s => esc(s.name)).join(', ') || '-'}</td><td class="r">${c.count30}</td></tr>`).join('')}</tbody></table></div></div></section>` : ''}`;
}
function vSvcEdit(id, L) {
  const K = CACHE['cat-gestao'] && CACHE['cat-gestao'].data;
  if (!K) return sheet('Serviço', '', vLoading());
  const s = id ? K.services.find(x => x.id === id) : { name: '', desc: '', cat: K.categories[0]?.id, dur: 30, price: 0, img: '', visible: true };
  if (!s) return sheet('Serviço', '', '<div class="empty">Serviço não encontrado.</div>');
  const v = Object.assign({}, s, L.v || {});
  const uploaded = v.img && v.img.startsWith('/uploads/');
  const src = L.preview || (v.img ? img(v.img) : '');
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">${id ? esc(s.name) : 'Novo serviço'}</h3><p>${id ? 'Editar dados do serviço' : 'Adicionar ao catálogo'}</p></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="modal-b"><form id="svc-form" class="form" style="margin-top:0" novalidate>
    ${photoField('svc', id, src, uploaded || !!L.preview, false)}
    <div class="fld"><label for="in-sname">Nome</label><input id="in-sname" maxlength="80" value="${esc(v.name)}"></div>
    <div class="fld"><label for="in-sdesc">Descrição<em>opcional</em></label><input id="in-sdesc" maxlength="160" value="${esc(v.desc)}"></div>
    <div class="fld-row"><div class="fld"><label for="in-scat">Categoria</label><select id="in-scat">${K.categories.map(c => `<option value="${c.id}" ${v.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div class="fld"><label for="in-simg">${uploaded ? 'Imagem' : 'Ou uma imagem pronta'}</label><select id="in-simg">${uploaded ? `<option value="${esc(v.img)}" selected>Foto enviada</option>` : ''}${K.images.map(i => `<option value="${i}" ${v.img === i ? 'selected' : ''}>${i.replace(/^svc_|^cat_/, '').replace(/_/g, ' ')}</option>`).join('')}</select></div></div>
    <div class="fld-row"><div class="fld"><label for="in-dur">Duração (min)</label><input id="in-dur" type="number" min="5" max="240" step="5" value="${v.dur}"></div><div class="fld"><label for="in-price">Preço (R$)</label><input id="in-price" type="number" min="0" max="2000" step="0.01" value="${v.price}"></div></div>
    <label class="note" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="in-svis" ${v.visible ? 'checked' : ''} style="accent-color:var(--gold)"> Exibir no site para o cliente</label>
    ${L.err ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(L.err)}</div></div>` : ''}
  </form>
  ${L.confirmDel ? `<div class="confirm-box"><p>Remover ${esc(s.name)} do catálogo? Os atendimentos já registrados continuam no histórico.</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="svc-del-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="svc-del" data-id="${id}">Remover serviço</button></div></div>` : ''}</div>
  <div class="modal-f">${id ? `<button class="btn btn-ghost" data-act="svc-del-ask">Remover</button>` : ''}<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="svc-save" data-id="${id || ''}">Salvar</button></div></div>`;
}
function photoField(kind, id, src, hasUpload, round) {
  return `<div class="fld"><label>Foto${kind === 'svc' ? '<em>aparece no site para o cliente</em>' : ''}</label><div class="photo-up">${src ? `<img class="${round ? 'round' : ''}" src="${esc(src)}" alt="">` : `<span class="photo-ph ${round ? 'round' : ''}">${ic(kind === 'svc' ? 'scissors' : kind === 'prod' ? 'box' : kind === 'card' ? 'glass' : 'userF')}</span>`}
    <div class="photo-acts"><label class="btn btn-line btn-sm" for="up-photo">${ic('plus')} ${hasUpload ? 'Trocar foto' : 'Enviar foto'}</label><input id="up-photo" class="sr" type="file" accept="image/jpeg,image/png,image/webp" data-up="${kind}" data-id="${id || ''}">${hasUpload ? `<button type="button" class="link" data-act="photo-rm" data-k="${kind}" data-id="${id || ''}">Remover foto</button>` : ''}</div></div>
    <p class="note" style="margin-top:6px">JPG, PNG ou WEBP. A foto é reduzida antes do envio.</p></div>`;
}
function vProEdit(id, L) {
  const K = CACHE['cat-gestao'] && CACHE['cat-gestao'].data;
  if (!K) return sheet('Profissional', '', vLoading());
  const p = id ? K.pros.find(x => x.id === id) : { name: '', services: K.services.map(s => s.id) };
  if (!p) return sheet('Profissional', '', '<div class="empty">Profissional não encontrado.</div>');
  const v = Object.assign({}, p, L.v || {});
  return sheet(id ? esc(p.name) : 'Novo profissional', id ? 'Editar profissional' : 'Adicionar à equipe', `<form class="form" id="pro-form" style="margin-top:0" novalidate>
    ${photoField('pro', id, L.preview || p.photo || '', !!(p.photo || L.preview), true)}
    <div class="fld"><label for="in-pname">Nome</label><input id="in-pname" maxlength="60" value="${esc(v.name)}"></div>
    ${id ? '' : `<div class="fld"><label>Serviços que realiza</label><div class="pchips">${K.services.map(s => `<label class="pchip"><input type="checkbox" name="pro-svc" value="${s.id}" ${v.services.includes(s.id) ? 'checked' : ''} style="accent-color:var(--gold)">${esc(s.name)}</label>`).join('')}</div></div>`}
    ${L.err ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(L.err)}</div></div>` : ''}
  </form>${L.confirmDel ? `<div class="confirm-box"><p>Remover ${esc(p.name)} da equipe? Ele deixa de aparecer no agendamento. O histórico continua.</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="svc-del-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="pro-del" data-id="${id}">Remover profissional</button></div></div>` : ''}`,
  `${id ? `<button class="btn btn-ghost" data-act="svc-del-ask">Remover</button>` : ''}<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="pro-save" data-id="${id || ''}">Salvar</button>`);
}

/* ---------- Estoque (produtos vendidos no balcão, no modelo do Doutor do Celular) ---------- */
const STK_ST = { ok: ['Disponível', 'st-concluido'], baixo: ['Estoque baixo', 'st-confirmado'], esgotado: ['Esgotado', 'st-cancelado'] };
const STK_MOV = { entrada: ['Entrada', 'st-agendado'], venda: ['Venda', 'st-concluido'], ajuste: ['Ajuste', 'st-confirmado'] };
const stkPill = p => `<span class="pill ${STK_ST[p.status][1]}">${STK_ST[p.status][0]}</span>`;
const prodThumb = p => p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span class="prod-ph">${ic('box')}</span>`;
function stkRows(E) {
  const q = (UI.stkQ || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return E.products.filter(p => (UI.stkSit === 'repor' ? p.status !== 'ok' : true) && (!q || (p.name + ' ' + p.desc + ' ' + (p.cat || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
}
function vStockList(E) {
  const rows = stkRows(E);
  const can = canManage();
  if (!E.products.length) return `<div class="empty">Nenhum produto cadastrado ainda.${can ? ' Use "Novo produto" para colocar a pomada, o shampoo e o que mais a barbearia vende.' : ''}</div>`;
  if (!rows.length) return `<div class="empty">Nenhum produto ${UI.stkQ ? `para “${esc(UI.stkQ)}”` : 'neste filtro'}.</div>`;
  const acts = p => `<button class="btn btn-gold btn-sm" data-act="stk-move" data-id="${p.id}" data-t="venda" ${p.qty ? '' : 'disabled'}>Vender</button><button class="btn btn-line btn-sm" data-act="stk-move" data-id="${p.id}" data-t="entrada">${ic('plus')} Entrada</button>${can ? `<button class="link" data-act="prod-edit" data-id="${p.id}">Editar</button>` : ''}`;
  return `<div class="desk-only"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produto</th><th class="r">Preço</th><th class="r">Em estoque</th><th>Situação</th><th></th></tr></thead><tbody>
    ${rows.map(p => `<tr><td><div class="svc-cell prod-cell">${prodThumb(p)}<span><span class="nm">${esc(p.name)}</span><span class="sm">${p.shelf === 'celular' ? 'Site: Kauan Cell' : p.shelf === 'barbearia' ? 'Site: barbearia' : 'Só balcão'}${p.cat ? ' · ' + esc(p.cat) : ''} · aviso com ${p.min} ou menos</span></span></div></td><td class="r">${money(p.price)}</td><td class="r"><span class="stk-n ${p.status}">${num(p.qty)}</span></td><td>${stkPill(p)}</td><td class="r"><div class="stk-acts">${acts(p)}</div></td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="mobile-only"><div class="ccards">${rows.map(p => `<div class="prod-card"><div class="prod-top">${prodThumb(p)}<span style="min-width:0"><span class="nm" style="display:block">${esc(p.name)}</span><span class="ds" style="display:block">${money(p.price)} · ${stkPill(p)}</span></span><span class="stk-n ${p.status}">${num(p.qty)}<small>un.</small></span></div><div class="stk-acts">${acts(p)}</div></div>`).join('')}</div></div>`;
}
function vEstoque() {
  const { d: E, wait } = load('estoque', '/gestao/estoque');
  const can = canManage();
  const tab = UI.stkTab || 'produtos';
  const toolbar = `<div class="toolbar"><div class="seg2">${[['produtos', 'Produtos'], ['movs', 'Movimentações']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="stktab" data-k="${k}">${l}</button>`).join('')}</div>
    ${can ? `<button class="btn btn-gold btn-sm" data-act="prod-new">${ic('plus')} Novo produto</button>` : '<span class="note">Somente gerentes e administradores cadastram produtos. Qualquer pessoa da equipe registra vendas e entradas.</span>'}</div>`;
  if (!E) return toolbar + wait;
  const K = E.kpis;
  const kpi = (k, icon, v, d, lead) => `<div class="kpi ${lead ? 'lead' : ''}"><span class="k">${ic(icon)}${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  let body;
  if (tab === 'movs') {
    body = E.moves.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="r">Quantidade</th><th class="r">Saldo</th><th class="r">Valor</th><th>Quem / motivo</th></tr></thead><tbody>${E.moves.map(m => `<tr><td>${fStamp(m.at)}</td><td class="nm">${esc(m.product)}</td><td><span class="pill ${STK_MOV[m.type][1]}">${STK_MOV[m.type][0]}</span></td><td class="r ${m.qty > 0 ? 'gold' : ''}">${m.qty > 0 ? '+' : '−'}${Math.abs(m.qty)}</td><td class="r">${m.balance}</td><td class="r">${m.value === null ? '-' : money(m.value)}</td><td><span class="sm" style="font-size:12.5px">${esc(m.user || '-')} · ${esc(m.reason)}</span></td></tr>`).join('')}</tbody></table></div><p class="note" style="margin-top:10px">Últimas ${E.moves.length} movimentações. Cada venda, entrada ou ajuste fica registrado com quem fez.</p>` : '<div class="empty">Nenhuma movimentação ainda. Elas aparecem ao registrar vendas, entradas ou ajustes.</div>';
  } else {
    body = `<div class="toolbar stk-tools" style="margin-bottom:12px"><label class="search">${ic('search')}<input id="stk-q" type="search" placeholder="Buscar produto" value="${esc(UI.stkQ || '')}" aria-label="Buscar produto"></label>
      <div class="seg2">${[['all', 'Todos', E.products.length], ['repor', 'Para repor', K.low + K.out]].map(([k, l, n]) => `<button class="${(UI.stkSit || 'all') === k ? 'on' : ''}" data-act="stksit" data-k="${k}">${l}<span class="n">${n}</span></button>`).join('')}</div></div>
      <div id="stk-results">${vStockList(E)}</div>`;
  }
  return `${toolbar}
  <div class="kpis">
    ${kpi('Vendas de produtos', 'wallet', money0(K.revenue30), `${num(K.sold30)} unidade${K.sold30 === 1 ? '' : 's'} nos últimos 30 dias`, true)}
    ${kpi('Unidades em estoque', 'box', num(K.units), `${K.products} produto${K.products === 1 ? '' : 's'} cadastrado${K.products === 1 ? '' : 's'}`)}
    ${kpi('Valor em estoque', 'ticket', money0(K.stockValue), `pelo preço de venda · custo ${money0(K.stockCost)}`)}
    ${kpi('Para repor', 'alert', num(K.low + K.out), `${K.low} com estoque baixo · ${K.out} esgotado${K.out === 1 ? '' : 's'}`)}
  </div>
  <section class="panel"><div class="panel-b">${body}</div></section>
  <p class="note">O estoque nunca fica negativo: a venda só é registrada se houver unidades. Venda de produto não entra no faturamento dos atendimentos da Visão geral.</p>`;
}
function vProdEdit(id, L) {
  const E = CACHE.estoque && CACHE.estoque.data;
  if (!E) return sheet('Produto', '', vLoading());
  const p = id ? E.products.find(x => x.id === id) : { name: '', desc: '', price: '', cost: '', min: 3, qty: 0, photo: null, shelf: 'casa', cat: '' };
  if (!p) return sheet('Produto', '', '<div class="empty">Produto não encontrado.</div>');
  const v = Object.assign({}, p, L.v || {});
  return sheet(id ? esc(p.name) : 'Novo produto', id ? 'Editar dados do produto' : 'Cadastrar produto para vender no balcão', `<form class="form" id="prod-form" style="margin-top:0" novalidate>
    ${photoField('prod', id, L.preview || p.photo || '', !!(p.photo || L.preview), false)}
    <div class="fld"><label for="in-prname">Nome</label><input id="in-prname" maxlength="80" value="${esc(v.name)}" placeholder="Ex.: Pomada modeladora 120 g"></div>
    <div class="fld"><label for="in-prdesc">Descrição<em>opcional</em></label><input id="in-prdesc" maxlength="160" value="${esc(v.desc)}"></div>
    <div class="fld-row"><div class="fld"><label for="in-prshelf">No site</label><select id="in-prshelf">${[['casa', 'Não aparece (só balcão)'], ['celular', 'Acessórios Kauan Cell'], ['barbearia', 'Produtos da barbearia']].map(([k, l]) => `<option value="${k}" ${v.shelf === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="fld"><label for="in-prcat">Categoria<em>opcional</em></label><input id="in-prcat" maxlength="40" list="prcat-list" value="${esc(v.cat || '')}" placeholder="Ex.: Capinhas"><datalist id="prcat-list">${[...new Set([...E.products.map(x => x.cat).filter(Boolean), 'Capinhas', 'Carregadores', 'Cabos', 'Fones', 'Películas', 'Portáteis', 'Caixas de som', 'Pomadas', 'Shampoos', 'Óleos para barba'])].map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
    <p class="note" style="margin-top:-4px">Com estoque, o produto aparece sozinho no site, na vitrine do início e no catálogo, e some quando acaba. Escolha Kauan Cell para capinha, carregador etc. e Produtos da barbearia para pomada, gel, óleo etc. A categoria vira o filtro. Bebidas ficam só no balcão.</p>
    <div class="fld-row"><div class="fld"><label for="in-prprice">Preço de venda (R$)</label><input id="in-prprice" type="number" min="0" max="10000" step="0.01" value="${esc(v.price)}"></div><div class="fld"><label for="in-prcost">Custo (R$)<em>opcional</em></label><input id="in-prcost" type="number" min="0" max="10000" step="0.01" value="${esc(v.cost)}"></div></div>
    <div class="fld-row"><div class="fld"><label for="in-prqty">${id ? 'Quantidade em estoque' : 'Quantidade que já tem'}</label><input id="in-prqty" type="number" inputmode="numeric" min="0" max="99999" step="1" value="${esc(v.qty)}"></div><div class="fld"><label for="in-prmin">Avisar estoque baixo com</label><input id="in-prmin" type="number" min="0" max="999" step="1" value="${esc(v.min)}"></div></div>
    ${id ? `<p class="note">Mudou a quantidade? Ao salvar fica registrado como ajuste de contagem no histórico. Vendas e entradas do dia a dia continuam pelos botões Vender e Entrada.</p>` : ''}
    ${L.err ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(L.err)}</div></div>` : ''}
  </form>${L.confirmDel ? `<div class="confirm-box"><p>Remover ${esc(p.name)} do estoque? Ele sai da lista; as vendas e entradas antigas continuam nas movimentações.</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="svc-del-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="prod-del" data-id="${id}">Remover produto</button></div></div>` : ''}`,
  `${id ? `<button class="btn btn-ghost" data-act="svc-del-ask">Remover</button>` : ''}<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="prod-save" data-id="${id || ''}">Salvar</button>`);
}
/* ---------- cardápio de bebidas ---------- */
const BST = { novo: ['Novo', 'st-confirmado'], preparando: ['Preparando', 'st-agendado'], entregue: ['Entregue', 'st-concluido'], cancelado: ['Cancelado', 'st-cancelado'] };
const ago = iso => { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
const hhmm = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
function barOrder(o) {
  const open = o.status === 'novo' || o.status === 'preparando';
  return `<div class="bo st-${o.status}">
    <div class="bo-h"><b>Nº ${o.number}</b><span class="pill ${BST[o.status][1]}">${BST[o.status][0]}</span><span class="bo-t">${hhmm(o.at)} · ${ago(o.at)}</span></div>
    <div class="bo-who">${ic('user')}<b>${esc(o.name)}</b>${o.pro ? `<span>com ${esc(o.pro)}</span>` : ''}</div>
    <ul class="bo-items">${o.items.map(i => `<li><b>${i.qty}×</b> ${esc(i.name)}</li>`).join('')}</ul>
    ${o.note ? `<div class="bo-note">${ic('msg')}${esc(o.note)}</div>` : ''}
    <div class="bo-f"><span class="bo-tot tnum">${money(o.total)}</span>${open ? `<span class="bo-acts">${o.status === 'novo' ? `<button class="btn btn-line btn-sm" data-act="bar-st" data-id="${o.id}" data-st="preparando">Preparar</button>` : ''}<button class="btn btn-gold btn-sm" data-act="bar-st" data-id="${o.id}" data-st="entregue">${ic('check')} Entregue</button><button class="link" data-act="bar-st" data-id="${o.id}" data-st="cancelado">Cancelar</button></span>` : ''}</div>
  </div>`;
}
function vBarOrders() {
  const { d: P, wait } = load('pedidos-bar', '/gestao/pedidos-bar');
  if (!P) return wait;
  const open = P.orders.filter(o => o.status === 'novo' || o.status === 'preparando').sort((a, b) => a.at.localeCompare(b.at));
  const done = P.orders.filter(o => o.status === 'entregue' || o.status === 'cancelado');
  return `<p class="note" style="margin:0 0 12px">Os pedidos chegam aqui sozinhos, com aviso e som. Pagamento na barbearia.</p>
    <section class="panel"><div class="panel-h"><h2>Para atender</h2><span class="note">${open.length}</span></div><div class="panel-b">${open.length ? `<div class="bo-grid">${open.map(barOrder).join('')}</div>` : '<div class="empty">Nenhum pedido esperando. Quando um cliente pedir pelo site, ele aparece aqui.</div>'}</div></section>
    ${done.length ? `<section class="panel" style="margin-top:14px"><div class="panel-h"><h2>Atendidos nas últimas 12 horas</h2><span class="note">${done.length}</span></div><div class="panel-b"><div class="bo-grid">${done.map(barOrder).join('')}</div></div></section>` : ''}`;
}
function vCardAdmin() {
  const tab = UI.cdTab || 'pedidos';
  const N = CACHE.contadores && CACHE.contadores.data;
  const tabs = `<div class="seg2" style="margin-bottom:14px">${[['pedidos', `Pedidos${N && N.barOpen ? `<span class="n">${N.barOpen}</span>` : ''}`], ['itens', 'Itens do cardápio']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="cdtab" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (tab === 'pedidos') return tabs + vBarOrders();
  return tabs + vCardItems();
}
function vCardItems() {
  const { d: C, wait } = load('cardapio', '/gestao/cardapio');
  const can = canManage();
  const toolbar = `<div class="toolbar"><span class="note">O que estiver visível aparece na tela Cardápio do site, na ordem desta lista.</span>${can ? `<button class="btn btn-gold btn-sm" data-act="card-new">${ic('plus')} Novo item</button>` : ''}</div>`;
  if (!C) return toolbar + wait;
  return toolbar + C.categories.map(c => {
    const its = C.items.filter(i => i.cat === c.id);
    return `<section class="panel cdm-panel"><div class="panel-h"><h2>${esc(c.name)}</h2><span class="note">${its.length} ite${its.length === 1 ? 'm' : 'ns'}</span></div><div class="panel-b">
      ${its.length ? `<div class="cdm-list">${its.map((i, k) => `<div class="cdm-row ${i.visible ? '' : 'off'}">
        <span class="cdm-ph">${i.photo ? `<img src="${esc(i.photo)}" alt="">` : ic(CD_ICON[i.cat] || 'glass')}</span>
        <span class="cdm-nm"><b>${esc(i.name)}</b><small>${money(i.price)}${i.visible ? '' : ' · escondido do site'}</small></span>
        ${can ? `<span class="cdm-acts"><button class="ib" data-act="card-move" data-id="${i.id}" data-dir="up" aria-label="Subir" ${k ? '' : 'disabled'}>${ic('up')}</button><button class="ib" data-act="card-move" data-id="${i.id}" data-dir="down" aria-label="Descer" ${k < its.length - 1 ? '' : 'disabled'}>${ic('down')}</button><button class="link" data-act="card-vis" data-id="${i.id}">${i.visible ? 'Esconder' : 'Mostrar'}</button><button class="btn btn-line btn-sm" data-act="card-edit" data-id="${i.id}">Editar</button></span>` : ''}
      </div>`).join('')}</div>` : '<div class="empty">Nenhum item nesta categoria.</div>'}
    </div></section>`;
  }).join('');
}
function vCardEdit(id, L) {
  const C = CACHE.cardapio && CACHE.cardapio.data;
  if (!C) return sheet('Cardápio', '', vLoading());
  const it = id ? C.items.find(x => x.id === id) : { name: '', cat: L.cat || 'drinks', price: '', visible: true, photo: null };
  if (!it) return sheet('Cardápio', '', '<div class="empty">Item não encontrado.</div>');
  const v = Object.assign({}, it, L.v || {});
  return sheet(id ? esc(it.name) : 'Novo item do cardápio', id ? 'Editar item' : 'Aparece na tela Cardápio do site', `<form class="form" id="card-form" style="margin-top:0" novalidate>
    ${photoField('card', id, L.preview || it.photo || '', !!(it.photo || L.preview), false)}
    <div class="fld"><label for="in-cdname">Nome</label><input id="in-cdname" maxlength="60" value="${esc(v.name)}" placeholder="Ex.: Gin Tônica"></div>
    <div class="fld-row"><div class="fld"><label for="in-cdcat">Categoria</label><select id="in-cdcat">${C.categories.map(c => `<option value="${c.id}" ${v.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="fld"><label for="in-cdprice">Preço (R$)</label><input id="in-cdprice" type="number" min="0" max="10000" step="0.01" value="${esc(v.price)}"></div></div>
    <label class="cd-chk"><input type="checkbox" id="in-cdvis" ${v.visible ? 'checked' : ''}> Aparece no cardápio do site</label>
    ${L.err ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(L.err)}</div></div>` : ''}
  </form>${L.confirmDel ? `<div class="confirm-box"><p>Apagar ${esc(it.name)} do cardápio?</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="svc-del-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="card-del" data-id="${id}">Apagar item</button></div></div>` : ''}`,
  `${id ? `<button class="btn btn-ghost" data-act="svc-del-ask">Apagar</button>` : ''}<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="card-save" data-id="${id || ''}">Salvar</button>`);
}
function vStkMove(L) {
  const E = CACHE.estoque && CACHE.estoque.data;
  const p = E && E.products.find(x => x.id === L.id);
  if (!p) return sheet('Estoque', '', E ? '<div class="empty">Produto não encontrado.</div>' : vLoading());
  const t = L.t, v = L.v || {};
  const qty = v.qty !== undefined ? v.qty : 1;
  const titles = { venda: 'Registrar venda', entrada: 'Registrar entrada', ajuste: 'Ajustar contagem' };
  const subs = { venda: 'Baixa as unidades vendidas no balcão', entrada: 'Mercadoria que chegou na barbearia', ajuste: 'Corrige o saldo depois de contar as unidades' };
  return sheet(titles[t], `${esc(p.name)} · ${p.qty} em estoque`, `<form class="form" id="stk-form" style="margin-top:0" novalidate>
    <div class="seg2" style="margin-bottom:6px">${[['venda', 'Venda'], ['entrada', 'Entrada'], ['ajuste', 'Ajuste']].map(([k, l]) => `<button type="button" class="${t === k ? 'on' : ''}" data-act="stk-move" data-id="${p.id}" data-t="${k}">${l}</button>`).join('')}</div>
    ${t === 'ajuste'
      ? `<div class="fld"><label for="in-stkqty">Quantas unidades tem de fato</label><input id="in-stkqty" type="number" min="0" max="99999" step="1" value="${esc(v.qty !== undefined ? v.qty : p.qty)}"></div>`
      : `<div class="fld-row"><div class="fld"><label for="in-stkqty">${t === 'venda' ? 'Unidades vendidas' : 'Unidades que chegaram'}</label><input id="in-stkqty" type="number" min="1" max="${t === 'venda' ? p.qty : 9999}" step="1" value="${esc(qty)}" data-price="${p.price}"></div>${t === 'venda' ? `<div class="fld"><label for="in-stkval">Total recebido (R$)</label><input id="in-stkval" type="number" min="0" step="0.01" value="${esc(v.value !== undefined ? v.value : (Number(qty) || 0) * p.price)}"></div>` : ''}</div>`}
    <div class="fld"><label for="in-stkwhy">Observação<em>opcional</em></label><input id="in-stkwhy" maxlength="200" value="${esc(v.reason || '')}" placeholder="${t === 'venda' ? 'Ex.: vendido junto com o corte' : t === 'entrada' ? 'Ex.: compra do fornecedor' : 'Ex.: contagem do fim do mês'}"></div>
    ${L.err ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(L.err)}</div></div>` : ''}
  </form>`,
  `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="stk-save" data-id="${p.id}" data-t="${t}">${t === 'venda' ? 'Registrar venda' : t === 'entrada' ? 'Registrar entrada' : 'Salvar contagem'}</button>`);
}

/* ---------- Fidelidade ---------- */
function vFidelidade() {
  const { d: F, wait } = load('fidelidade', '/gestao/fidelidade');
  if (!F) return wait;
  const K = F.kpis;
  const tab = UI.fidTab;
  const tabs = [['saldos', 'Saldos'], ['movs', 'Movimentações'], ['indicacoes', 'Indicações'], ['beneficios', 'Benefícios']];
  let body = '';
  if (tab === 'saldos') {
    body = F.balances.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="r">Saldo</th><th>Progresso até ${DB.benefit.cost} pts</th><th>Situação</th></tr></thead><tbody>${F.balances.map(({ id, name, balance: b, hasVoucher }) => { const p = Math.min(1, b / DB.benefit.cost); return `<tr class="click" data-act="client" data-id="${id}"><td><span class="nm">${esc(name)}</span></td><td class="r gold">${b}</td><td><div class="prog"><div class="mbar"><i style="width:${Math.round(p * 100)}%"></i></div><small>${pct(p)}</small></div></td><td>${b >= DB.benefit.cost ? '<span class="pill st-concluido">Pode resgatar</span>' : b >= K.nearThreshold ? '<span class="pill st-confirmado">Perto do resgate</span>' : hasVoucher ? '<span class="tag tag-gold">Benefício ativo</span>' : '<span class="sm">Acumulando</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Nenhum cliente com pontos ainda. Os pontos entram quando um atendimento é concluído.</div>';
  } else if (tab === 'movs') {
    body = F.moves.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Origem</th><th class="r">Pontos</th></tr></thead><tbody>${F.moves.map(m => `<tr class="click" data-act="${m.appt ? 'appt' : 'client'}" data-id="${m.appt ? m.appt.id : m.clientId}"><td>${fDM(m.at.slice(0, 10))} <span class="sm">${m.at.slice(11)}</span></td><td class="nm">${esc(m.clientName)}</td><td>${(MOVE[m.type] || MOVE.ajuste)[0]}</td><td><span class="sm" style="font-size:12.5px">${m.appt ? `Atendimento ${fDM(m.appt.date)} · ${esc(m.appt.label)}` : m.referredName ? `1º atendimento de ${esc(m.referredName)}` : esc(DB.benefit.title)}</span></td><td class="r ${m.points > 0 ? 'gold' : ''}">${m.points > 0 ? '+' : '−'}${Math.abs(m.points)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhuma movimentação ainda.</div>';
  } else if (tab === 'indicacoes') {
    body = F.referrals.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quem indicou</th><th>Indicado</th><th>Data</th><th>Status</th><th>Atendimento que liberou</th></tr></thead><tbody>${F.referrals.map(r => `<tr class="click" data-act="client" data-id="${r.referredId}"><td class="nm">${esc(r.referrerName)}</td><td>${esc(r.referredName)}</td><td>${fDM(r.createdAt)}</td><td>${r.status === 'concluida' ? `<span class="pill st-concluido">+${DB.rules.referral} pts liberados</span>` : '<span class="pill st-confirmado">Aguardando 1º atendimento</span>'}</td><td><span class="sm" style="font-size:12.5px">${r.appt ? `${fDM(r.appt.date)} · ${esc(r.appt.label)}` : r.next ? `Agendado para ${fDM(r.next.date)} às ${r.next.time}` : 'Sem agendamento ainda'}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhuma indicação ainda. Elas aparecem quando alguém agenda pelo link de um cliente.</div>';
  } else {
    body = `<div class="rules" style="margin-bottom:14px">
      <div class="rule">${ic('gift')}<b>${esc(DB.benefit.title)}</b><small>Resgate com ${DB.benefit.cost} pontos · aplicado no próximo atendimento concluído</small></div>
      <div class="rule">${ic('ticket')}<b>${K.redeems} resgate${K.redeems === 1 ? '' : 's'}</b><small>${K.activeVouchers} benefício${K.activeVouchers === 1 ? '' : 's'} aguardando uso</small></div>
      <div class="rule">${ic('trend')}<b>${K.nearReward} clientes perto da meta</b><small>Entre ${K.nearThreshold} e ${DB.benefit.cost - 1} pontos</small></div></div>
      <div class="mini">${F.vouchers.length ? F.vouchers.map(v => `<button data-act="client" data-id="${v.clientId}"><span class="l"><b>${esc(v.clientName)}</b><small>Resgatado em ${fStamp(v.createdAt)}</small></span><span class="tag tag-gold">Aguardando uso</span></button>`).join('') : '<div>Nenhum benefício aguardando uso.</div>'}</div>`;
  }
  return `
  <div class="kpis">
    <div class="kpi lead"><span class="k">${ic('crown')}Pontos em circulação</span><span class="v">${num(K.circulating)}</span><span class="d">${K.members} membros com movimentação</span></div>
    <div class="kpi"><span class="k">${ic('trend')}Pontos emitidos</span><span class="v">${num(K.issued30)}</span><span class="d">últimos 30 dias</span></div>
    <div class="kpi"><span class="k">${ic('gift')}Resgates</span><span class="v">${K.redeems}</span><span class="d">desde o início do clube (${fDM(F.clubStart)})</span></div>
    <div class="kpi"><span class="k">${ic('userPlus')}Indicações pendentes</span><span class="v">${K.pendingReferrals}</span><span class="d">liberam pontos no 1º atendimento</span></div>
  </div>
  <div class="rules">
    <div class="rule">${ic('scissors')}<b>${DB.rules.perReal} ponto${DB.rules.perReal === 1 ? '' : 's'} por R$ 1</b><small>Creditado só quando o atendimento é concluído</small></div>
    <div class="rule">${ic('userPlus')}<b>+${DB.rules.referral} pontos por indicação</b><small>Após o primeiro atendimento concluído do indicado</small></div>
    <div class="rule">${ic('gift')}<b>${esc(DB.benefit.title)}</b><small>${DB.benefit.cost} pontos · regras em Configurações</small></div>
  </div>
  <div class="seg2">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="fidtab" data-k="${k}">${l}</button>`).join('')}</div>
  <section class="panel"><div class="panel-b">${body}</div></section>`;
}

/* ---------- Oportunidades ---------- */
function vOpp() {
  const { d: O, wait } = load('opp', '/gestao/oportunidades');
  if (!O) return wait;
  const lists = O.lists;
  const k = lists[UI.opp] ? UI.opp : 'lapsed';
  const rows = lists[k].rows;
  return `
  <div class="seg2">${Object.entries(lists).map(([key, o]) => `<button class="${k === key ? 'on' : ''}" data-act="opp" data-k="${key}">${esc(o.label)}<span class="n">${o.rows.length}</span></button>`).join('')}</div>
  <div class="callout gold" style="margin-top:0">${ic('info')}<span>As mensagens são rascunhos para copiar e enviar pelo WhatsApp da barbearia. Nada é enviado automaticamente.</span></div>
  <div style="display:flex;flex-direction:column;gap:8px">${rows.length ? rows.slice(0, 40).map(({ c, why }) => `<div class="opp-row"><span class="ini">${initials(c.name)}</span><div style="min-width:0"><div class="nm" style="font-weight:600">${esc(c.name)}</div><div class="why">${esc(why)}</div></div><div class="acts"><button class="btn btn-ghost btn-sm" data-act="client" data-id="${c.id}">Abrir cliente</button><button class="btn btn-line btn-sm" data-act="draft-msg" data-id="${c.id}" data-k="${k}">${ic('msg')} Preparar mensagem</button></div></div>`).join('') : '<div class="empty">Nenhum cliente nesta lista agora.</div>'}</div>
  ${rows.length > 40 ? `<p class="note">Mostrando 40 de ${rows.length}.</p>` : ''}`;
}
function vDraftMsg(cid, k) {
  const key = 'cliente:' + cid;
  const V = need(key, `/gestao/clientes/${cid}`, 'staff');
  if (!V) return sheet('Rascunho', '', needErr(key) ? vError(needErr(key), key) : vLoading());
  const c = V.client, s = V.stats, b = V.club.balance;
  const fn = firstName(c.name);
  const T = {
    lapsed: `Olá, ${fn}! Aqui é da Cidade Nobre. Faz um tempo desde seu último ${s.last ? (apptNames(s.last)[0] || 'atendimento').toLowerCase() : 'atendimento'}. Quando quiser renovar o visual, é só escolher o melhor horário pelo nosso agendamento.`,
    recurring: `Olá, ${fn}! Obrigado por fazer parte da Cidade Nobre. Você está com ${b} pontos no Clube. Quer que a gente reserve seu próximo horário?`,
    next: `Olá, ${fn}! Passando para lembrar do seu horário ${s.next ? `em ${fDM(s.next.date)} às ${s.next.time}` : ''} na Cidade Nobre. Se precisar alterar, responda esta mensagem.`,
    near: `Olá, ${fn}! Você está com ${b} pontos no Clube Cidade Nobre. ${b >= DB.benefit.cost ? `Já pode resgatar ${DB.benefit.title}.` : `Faltam ${DB.benefit.cost - b} para ${DB.benefit.title}.`}`,
    referral: `Olá, ${fn}! Que bom ter você por indicação de um cliente da Cidade Nobre. Seu primeiro horário pode ser marcado pelo nosso agendamento.`,
  };
  const txt = T[k] || T.recurring;
  const wa = `https://wa.me/55${onlyDigits(c.phone)}?text=${encodeURIComponent(txt)}`;
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">Rascunho para ${esc(fn)}</h3><p>${esc(c.phone)} · sugestão de mensagem</p></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="modal-b"><div class="draft" id="draft-txt">${esc(txt)}</div><div class="callout gold">${ic('info')}<span>Nada é enviado automaticamente. Copie o texto ou abra a conversa no WhatsApp e revise antes de enviar.</span></div></div>
  <div class="modal-f"><button class="btn btn-ghost" data-act="close">Fechar</button><button class="btn btn-line" data-act="copy-draft">${ic('copy')} Copiar texto</button><a class="btn btn-gold" href="${wa}" target="_blank" rel="noopener">${ic('wa')} Abrir no WhatsApp</a></div></div>`;
}

/* ---------- Configurações ---------- */
function vConfig() {
  const { d: C, wait } = load('config', '/gestao/configuracoes');
  if (!C) return wait;
  const adm = isAdmin();
  const dis = adm ? '' : 'disabled';
  const e = UI.cfgErr;
  const fld = (id, label, val, extra = '', hint = '') => `<div class="fld"><label for="cf-${id}">${label}${hint ? `<em>${hint}</em>` : ''}</label><input id="cf-${id}" value="${esc(val)}" ${extra} ${dis}></div>`;
  let users = '';
  if (adm) {
    const U = need('usuarios', '/usuarios', 'staff');
    users = `<section class="panel"><div class="panel-h"><h2>Equipe com acesso à gestão</h2></div><div class="panel-b">
      ${U ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th></tr></thead><tbody>${U.map(u => `<tr><td class="nm">${esc(u.nome)}${u.id === STAFF.id ? ' <span class="sm">você</span>' : ''}</td><td>${esc(u.email)}</td><td><select class="sel" data-user-perfil="${u.id}" ${u.id === STAFF.id ? 'disabled' : ''}>${Object.entries(PERFIS).map(([k, l]) => `<option value="${k}" ${u.perfil === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><button class="switch ${u.ativo ? 'on' : ''}" role="switch" aria-checked="${u.ativo}" aria-label="Acesso de ${esc(u.nome)}" ${u.id === STAFF.id ? 'disabled' : `data-act="user-toggle" data-id="${u.id}" data-on="${u.ativo}"`}></button></td></tr>`).join('')}</tbody></table></div>` : vLoading()}
      <form class="form" id="user-form" novalidate><div class="fld-row"><div class="fld"><label for="nu-nome">Nome</label><input id="nu-nome" maxlength="80"></div><div class="fld"><label for="nu-email">E-mail</label><input id="nu-email" type="email"></div></div>
      <div class="fld-row"><div class="fld"><label for="nu-senha">Senha inicial</label><input id="nu-senha" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></div><div class="fld"><label for="nu-perfil">Perfil</label><select id="nu-perfil">${Object.entries(PERFIS).map(([k, l]) => `<option value="${k}" ${k === 'OPERADOR' ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div><button class="btn btn-line btn-sm" data-act="user-add">${ic('plus')} Adicionar pessoa</button></div></form>
      <p class="note" style="margin-top:10px">Operador: agenda, clientes e listas. Gerente: também serviços e equipe. Administrador: também regras e acessos.</p>
    </div></section>`;
  }
  return `
  ${vPagamentoOnline(adm)}
  <section class="panel"><div class="panel-h"><h2>Regras do Clube e da agenda</h2>${adm ? '' : '<span class="note">Somente administradores alteram estas regras.</span>'}</div><div class="panel-b">
    <form class="form" id="cfg-form" style="margin-top:0" novalidate>
      <div class="fld-row">${fld('perReal', 'Pontos por R$ 1 pago', C.pointsPerReal, 'type="number" min="0" max="100" step="1"')}${fld('referral', 'Bônus por indicação (pontos)', C.referralBonus, 'type="number" min="0" step="1"')}</div>
      <div class="fld-row">${fld('cost', 'Pontos para o resgate', C.redeemPoints, 'type="number" min="1" step="1"')}${fld('value', 'Valor do benefício (R$)', C.redeemValue, 'type="number" min="0" step="0.01"')}</div>
      <div class="fld-row">${fld('open', 'Abre às', C.openTime, 'type="time"')}${fld('close', 'Fecha às', C.closeTime, 'type="time"')}</div>
      <div class="fld"><label>Dias fechados</label><div class="pchips">${WD.map((d, i) => `<label class="pchip ${C.closedDays.includes(i) ? 'on' : ''}"><input type="checkbox" name="cf-closed" value="${i}" ${C.closedDays.includes(i) ? 'checked' : ''} ${dis} style="accent-color:var(--gold)">${d}</label>`).join('')}</div></div>
      ${fld('slots', 'Horários oferecidos no site', C.slotTimes.join(', '), '', 'separados por vírgula')}
      <div class="fld-row">${fld('lapse', 'Dias para considerar "sem retorno"', C.lapseDays, 'type="number" min="1" max="365"')}${fld('advance', 'Antecedência mínima (min)', C.minAdvanceMin, 'type="number" min="0" max="1440"')}</div>
      <div class="fld-row">${fld('days', 'Dias exibidos no agendamento', C.bookingDays, 'type="number" min="1" max="14"')}${fld('domain', 'Domínio do link de indicação', C.referralDomain, 'placeholder="https://seusite.com.br"', 'vazio = endereço do site')}</div>
      ${e ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(e)}</div></div>` : ''}
      ${adm ? `<div><button class="btn btn-gold" data-act="cfg-save">Salvar regras</button></div>` : ''}
    </form>
  </div></section>
  ${users}
  <section class="panel"><div class="panel-h"><h2>Minha senha</h2><span class="note">${esc(STAFF.nome)} · ${esc(STAFF.email)}</span></div><div class="panel-b">
    <form class="form" id="pw-form" style="margin-top:0" novalidate><div class="fld-row"><div class="fld"><label for="pw-cur">Senha atual</label><input id="pw-cur" type="password" autocomplete="current-password"></div><div class="fld"><label for="pw-new">Nova senha</label><input id="pw-new" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></div><div class="fld"><label for="pw-new2">Repita a nova senha</label><input id="pw-new2" type="password" autocomplete="new-password"></div></div>
    <div><button class="btn btn-line btn-sm" data-act="pw-save">Alterar senha</button></div></form>
  </div></section>`;
}

/* pagamento online: a barbearia conecta a conta dela no Mercado Pago (OAuth) */
function vPagamentoOnline(adm) {
  const { d: M, wait } = load('mp', '/gestao/mercado-pago');
  const head = `<div class="panel-h"><h2>Pagamento online</h2><span class="note">Mercado Pago</span></div>`;
  if (!M) return `<section class="panel">${head}<div class="panel-b">${wait}</div></section>`;
  let body;
  if (!M.configurado) body = `<div class="callout gold">${ic('info')}<span>A conexão com o Mercado Pago ainda não foi configurada no servidor.</span></div>`;
  else if (!M.conectado) body = `<p class="note" style="margin:0 0 12px">Conecte a conta do Mercado Pago da barbearia para o cliente pagar o agendamento pelo site, com Pix ou cartão. O dinheiro cai direto na conta conectada.</p>
    ${adm ? `<button class="btn btn-gold" data-act="mp-connect">${ic('wallet')} Conectar Mercado Pago</button>` : '<span class="note">Somente administradores conectam a conta.</span>'}`;
  else body = `<div class="callout ok" style="margin-top:0">${ic('check')}<span>Conta conectada${M.contaId ? ` (Mercado Pago nº ${esc(M.contaId)})` : ''}. ${M.cobrarOnline ? `O cliente paga ao agendar pelo site e tem ${M.prazoMinutos} minutos para concluir; sem pagamento, o horário é liberado sozinho.` : 'A cobrança online está desligada: o cliente agenda e paga na barbearia.'}</span></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:14px"><button class="switch ${M.cobrarOnline ? 'on' : ''}" role="switch" aria-checked="${M.cobrarOnline}" aria-label="Cobrar o agendamento online" ${adm ? `data-act="mp-toggle" data-on="${M.cobrarOnline}"` : 'disabled'}></button><span>Cobrar o agendamento do site online</span></div>
    ${adm ? (UI.mpAsk ? `<div class="confirm-box"><p>Desconectar a conta? Os próximos agendamentos do site passam a ser pagos na barbearia.</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="mp-disconnect-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="mp-disconnect">Desconectar</button></div></div>` : `<div style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-act="mp-disconnect-ask">Desconectar conta</button></div>`) : ''}`;
  return `<section class="panel">${head}<div class="panel-b">${body}</div></section>`;
}

/* ---------- login da equipe ---------- */
function vStaffLogin() {
  const e = UI.staffErr;
  return `<div class="cx"><div class="scr pf"><div class="d-page"><div class="wrap auth-wrap">
    <div style="text-align:center"><img src="${A.crest}" alt="Cidade Nobre, Barbearia Premium" style="width:110px;height:auto;display:block;margin:0 auto"></div>
    <div class="club-hd" style="text-align:center"><div class="kick">Gestão da barbearia</div><h1>Entrar</h1><p>Acesso restrito à equipe da Cidade Nobre.</p></div>
    <form class="form" id="staff-form" novalidate>
      <div class="fld"><label for="st-email">E-mail</label><input id="st-email" type="email" autocomplete="username" value="${esc(UI.staffEmail || '')}"></div>
      <div class="fld"><label for="st-pass">Senha</label><input id="st-pass" type="password" autocomplete="current-password"></div>
      ${e ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(e)}</div></div>` : ''}
      <button class="btn btn-gold btn-serif" data-act="login-staff" type="submit">Entrar na gestão ${ic('right')}</button>
    </form>
    <div style="text-align:center;margin-top:18px"><a class="link" href="/" data-act="to-site">Voltar ao site</a></div>
  </div></div></div></div>`;
}

/* ---------- admin shell ---------- */
function adminNav() {
  const N = need('contadores', '/gestao/contadores', 'staff', 60000);
  const counts = N ? { agenda: N.agendaToday, oportunidades: N.lapsed, ...(N.stockLow ? { estoque: N.stockLow } : {}), ...(N.barOpen ? { cardapio: N.barOpen } : {}) } : {};
  return `<div class="anav">${ANAV.map(n => `<button class="${UI.admin === n.id ? 'on' : ''}" data-act="anav" data-id="${n.id}">${ic(n.icon)}${n.label}${counts[n.id] !== undefined ? `<span class="ct">${counts[n.id]}</span>` : ''}</button>`).join('')}</div>`;
}
function vAdmin() {
  if (!STAFF) return vStaffLogin();
  if (!ATITLE[UI.admin]) UI.admin = 'dash';
  const [t, sub] = ATITLE[UI.admin];
  const map = { dash: vDash, agenda: vAgenda, clientes: vClientes, servicos: vServAdmin, estoque: vEstoque, cardapio: vCardAdmin, fidelidade: vFidelidade, oportunidades: vOpp, config: vConfig };
  return `<div class="ad">
    <aside class="ad-side">
      <div class="ad-logo">${lockup(42)}<small>Gestão da barbearia</small></div>
      ${adminNav()}
      <div class="side-foot">
        <a class="btn btn-line" href="/" data-act="to-site">${ic('swap')} Ver o site</a>
        <button class="btn btn-ghost" data-act="logout-staff">Sair</button>
        <div class="demo-chip" style="padding:6px 4px 0">${esc(STAFF.nome)} · ${PERFIS[STAFF.perfil] || STAFF.perfil}</div>
      </div>
    </aside>
    <div class="ad-main">
      <header class="ad-head"><button class="mb" data-act="amenu" aria-label="Abrir menu">${ic('menu')}</button><div><h1>${t}</h1><div class="sub">${sub}</div></div><div class="r"><button class="sim" data-act="refresh-admin" title="Atualizar dados">${ic('refresh')} Atualizar</button></div></header>
      <div class="ad-body scr">${map[UI.admin]()}</div>
    </div>
  </div>`;
}
function vAdminMenu() {
  return `<div class="drawer left" role="dialog" aria-modal="true" aria-label="Menu da gestão">
    <div class="drawer-top">${lockup(38)}<button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
    <div class="note" style="letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px 4px">Gestão da barbearia</div>
    ${adminNav()}
    <div class="foot"><a class="btn btn-line" href="/" data-act="to-site">${ic('swap')} Ver o site</a><button class="btn btn-ghost" data-act="logout-staff">Sair</button><div class="demo-chip">${esc(STAFF.nome)} · ${PERFIS[STAFF.perfil] || STAFF.perfil}</div></div>
  </div>`;
}
