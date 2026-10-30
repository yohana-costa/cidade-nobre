/* ============ gestão da barbearia ============ */
const ANAV = [
  { id: 'dash', label: 'Visão geral', icon: 'dash' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'servicos', label: 'Serviços e equipe', icon: 'scissors' },
  { id: 'fidelidade', label: 'Fidelidade', icon: 'crown' },
  { id: 'oportunidades', label: 'Oportunidades', icon: 'target' },
];
const ATITLE = { dash: ['Visão geral', 'Indicadores calculados a partir da agenda demonstrativa'], agenda: ['Agenda', 'Atendimentos por dia e profissional'], clientes: ['Clientes', 'Histórico, frequência e pontos de cada cliente'], servicos: ['Serviços e equipe', 'Catálogo, durações, preços e quem realiza cada serviço'], fidelidade: ['Clube Cidade Nobre', 'Saldos, movimentações, benefícios e indicações'], oportunidades: ['Oportunidades de retorno', 'Clientes que pedem uma ação de relacionamento'] };

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

/* ---------- charts (single scale, recessive grid, hover tooltips) ---------- */
function barChart(points, opts = {}) {
  // points: [{label, value, tip, hi}]
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

/* ---------- Visão geral ---------- */
function vDash() {
  const pr = periodRange(UI.period);
  const m = metrics(pr.from, pr.to), pm = metrics(pr.prevFrom, pr.prevTo, null, UI.period === 'hoje' ? nowMin() : undefined);
  const lapsed = lapsedClients();
  const T = todayStr();
  const kpi = (k, icon, v, d, lead) => `<div class="kpi ${lead ? 'lead' : ''}"><span class="k">${ic(icon)}${k}</span><span class="v">${v}</span><span class="d">${d}</span></div>`;
  // chart data
  let pts, chartTitle, ref = 0;
  if (UI.period === 'hoje') {
    chartTitle = 'Agenda de hoje por horário';
    pts = [];
    for (let h = 9; h < 19; h++) {
      const l = m.list.filter(a => a.status !== 'cancelado' && Math.floor(tmin(a.time) / 60) === h);
      pts.push({ label: `${h}h`, value: l.length, tip: `${h}h–${h + 1}h · ${l.length} atendimento${l.length === 1 ? '' : 's'}` });
    }
  } else {
    chartTitle = 'Faturamento simulado por dia';
    pts = []; let d = pr.from;
    while (d <= pr.to) {
      const mm = metrics(d, d);
      const dd = parseD(d);
      pts.push({ label: UI.period === '7' ? `${WD[dd.getDay()]} ${dd.getDate()}` : `${dd.getDate()}/${dd.getMonth() + 1}`, value: mm.rev, hi: d === T, tip: `${WD[dd.getDay()]}, ${fDM(d)} · ${money0(mm.rev)} · ${mm.done} concluído${mm.done === 1 ? '' : 's'}` });
      d = addDays(d, 1);
    }
    const n = Number(UI.period); ref = pm.rev / openDaysBetween(pr.prevFrom, pr.prevTo);
  }
  const upcoming = DB.appts.filter(a => isOpenStatus(a) && (a.date > T || (a.date === T && tmin(a.time) + a.dur > nowMin()))).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 7);
  const byPro = DB.pros.map(p => ({ p, m: metrics(pr.from, pr.to, p.id) }));
  const maxRev = Math.max(1, ...byPro.map(x => x.m.rev));
  const pendRef = DB.referrals.filter(r => r.status === 'pendente').length;
  const pointsIssued = DB.moves.filter(x => x.points > 0 && x.at.slice(0, 10) >= pr.from && x.at.slice(0, 10) <= pr.to).reduce((t, x) => t + x.points, 0);
  const redeems = DB.moves.filter(x => x.type === 'resgate' && x.at.slice(0, 10) >= pr.from && x.at.slice(0, 10) <= pr.to).length;
  return `
  <div class="toolbar">
    <div class="seg2" role="tablist" aria-label="Período">${[['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias']].map(([k, l]) => `<button class="${UI.period === k ? 'on' : ''}" data-act="period" data-p="${k}">${l}</button>`).join('')}</div>
    <span class="note">${pr.label} · comparação ${pr.cmp}</span>
  </div>
  <div class="kpis">
    ${kpi(UI.period === 'hoje' ? 'Agendamentos do dia' : 'Agendamentos', 'calendar', num(m.total), delta(m.total, pm.total, num))}
    ${kpi('Atendimentos concluídos', 'check', num(m.done), delta(m.done, pm.done, num))}
    ${kpi('Cancelamentos', 'ban', `${num(m.canc)} <small style="font-size:14px;color:var(--muted)">${pct(m.cancRate)}</small>`, delta(m.canc, pm.canc, num, true))}
    ${kpi('Faturamento simulado', 'wallet', money0(m.rev), delta(m.rev, pm.rev, money0), true)}
    ${kpi('Ticket médio', 'ticket', money0(m.ticket), delta(m.ticket, pm.ticket, money0))}
    ${kpi('Ocupação da agenda', 'pie', pct(m.occ), deltaPP(m.occ, pm.occ))}
    ${kpi('Clientes que retornaram', 'repeat', m.unique ? pct(m.returning / m.unique) : '—', `${m.returning} de ${m.unique} atendidos · ${pm.unique ? deltaPP(m.returning / m.unique, pm.returning / pm.unique) : ''}`)}
    ${kpi(`Sem retorno há ${LAPSE_DAYS}+ dias`, 'hourglass', num(lapsed.length), `<button class="link" data-act="opp" data-k="lapsed">Ver oportunidades</button>`)}
  </div>
  <div class="grid-2">
    <section class="panel">
      <div class="panel-h"><h2>${chartTitle}</h2><div class="r legend2">${UI.period === 'hoje' ? `<span><i style="background:#c99d5c"></i>Atendimentos marcados</span>` : `<span><i style="background:#c99d5c"></i>Faturamento do dia</span><span><i style="background:transparent;border-top:2px dashed #8c867c;height:0;border-radius:0;width:14px"></i>Média diária do período anterior</span>`}</div></div>
      <div class="panel-b" style="position:relative" data-chart>${barChart(pts, { w: Math.round(Math.min(640, Math.max(300, (innerWidth >= 1100 ? (innerWidth - 300) * 0.6 : innerWidth - (innerWidth >= 1024 ? 330 : 70))))), h: innerWidth < 600 ? 200 : 230, aria: chartTitle, ref, fmtAxis: UI.period === 'hoje' ? num : v => v >= 1000 ? `${num(v / 1000)} mil` : num(v), maxLabels: innerWidth < 600 ? (UI.period === '30' ? 5 : 7) : (UI.period === '30' ? 8 : 10) })}</div>
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Próximos agendamentos</h2><button class="link" data-act="anav" data-id="agenda">Abrir agenda</button></div>
      <div class="panel-b"><div class="list">${upcoming.length ? upcoming.map(a => { const c = cli(a.clientId); return `<button class="lrow" data-act="appt" data-id="${a.id}"><span class="tm">${a.time}<small>${a.date === T ? 'hoje' : fDM(a.date)}</small></span><span style="min-width:0"><span class="nm" style="display:block">${esc(c.name)}${a.source === 'site' ? ' <span class="tag tag-gold">Site</span>' : ''}</span><span class="ds" style="display:block">${esc(svcLabel(a.serviceIds))} · ${pro(a.proId).name}</span></span>${statusPill(a.status)}</button>`; }).join('') : '<div class="empty">Nenhum agendamento futuro.</div>'}</div></div>
    </section>
  </div>
  <div class="grid-2 even">
    <section class="panel">
      <div class="panel-h"><h2>Resumo por profissional</h2><span class="note">${pr.label}</span></div>
      <div class="panel-b">
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Profissional</th><th class="r">Concluídos</th><th class="r">Faturamento</th><th>Ocupação</th></tr></thead><tbody>
        ${byPro.map(({ p, m }) => `<tr><td><span class="nm" style="font-family:var(--serif);font-size:15px;font-weight:500">${p.name}</span><span class="sm">nome demonstrativo</span></td><td class="r">${m.done}</td><td class="r"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">${money0(m.rev)}<div class="mbar" style="width:90px"><i style="width:${Math.round(m.rev / maxRev * 100)}%"></i></div></div></td><td><div class="prog"><div class="mbar"><i style="width:${Math.round(m.occ * 100)}%"></i></div><small>${pct(m.occ)}</small></div></td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </section>
    <section class="panel">
      <div class="panel-h"><h2>Clube e atalhos</h2></div>
      <div class="panel-b">
        <div class="cd-kpis" style="margin-bottom:12px"><div><small>Pontos emitidos</small><b>${num(pointsIssued)}</b></div><div><small>Resgates</small><b>${redeems}</b></div><div><small>Indicações pendentes</small><b>${pendRef}</b></div><div><small>Perto do resgate</small><b>${nearReward().length}</b></div></div>
        <div class="shortcuts">
          <button class="sc" data-act="anav" data-id="agenda">${ic('calendar')}Agenda<small>Dia a dia</small></button>
          <button class="sc" data-act="anav" data-id="clientes">${ic('users')}Clientes<small>${DB.clients.length} cadastrados</small></button>
          <button class="sc" data-act="anav" data-id="fidelidade">${ic('crown')}Fidelidade<small>Saldos e indicações</small></button>
        </div>
      </div>
    </section>
  </div>
  <p class="note">Resultados simulados a partir de dados fictícios. Ocupação = minutos agendados ÷ ${DB.pros.length} profissionais × ${DAY_CAP / 60}h por dia de funcionamento (seg. a sáb.).</p>`;
}
const nearReward = () => DB.clients.map(c => ({ c, b: balance(c.id) })).filter(x => x.b >= 180 && x.b < DB.benefit.cost).sort((a, b) => b.b - a.b);

/* ---------- Agenda ---------- */
function vAgenda() {
  const D = UI.agDate, T = todayStr();
  const pros = UI.agPro === 'all' ? DB.pros : DB.pros.filter(p => p.id === UI.agPro);
  const list = DB.appts.filter(a => a.date === D && pros.some(p => p.id === a.proId)).sort((a, b) => a.time.localeCompare(b.time));
  const cnt = s => list.filter(a => a.status === s).length;
  const HH = 64; // px por hora
  const hours = []; for (let h = OPEN / 60; h <= CLOSE / 60; h++) hours.push(h);
  const H = (CLOSE - OPEN) / 60 * HH;
  const block = a => { const c = cli(a.clientId); const top = (tmin(a.time) - OPEN) / 60 * HH; const h = Math.max(26, a.dur / 60 * HH - 3); return `<button class="blk st-${a.status} ${UI.hl === a.id ? 'hl' : ''}" style="top:${top + 1}px;height:${h}px" data-act="appt" data-id="${a.id}" title="${esc(c.name)} · ${a.time}"><b>${a.time} · ${esc(c.name)}</b>${h > 40 ? `<span>${esc(svcLabel(a.serviceIds))}</span>` : ''}${h > 58 ? `<span>${STATUS[a.status]}${a.source === 'site' ? ' · site' : ''}</span>` : ''}</button>`; };
  const nowTop = D === T && nowMin() > OPEN && nowMin() < CLOSE ? (nowMin() - OPEN) / 60 * HH : null;
  return `
  <div class="toolbar">
    <div class="datenav"><button class="ib" data-act="ag-day" data-n="-1" aria-label="Dia anterior">${ic('left')}</button><div class="dl">${fDayLong(D).replace(/^./, x => x.toUpperCase())}<small>${D === T ? 'Hoje' : fRel(D)}${isOpen(D) ? '' : ' · fechado (domingo)'}</small></div><button class="ib" data-act="ag-day" data-n="1" aria-label="Próximo dia">${ic('right')}</button>${D !== T ? `<button class="btn btn-ghost btn-sm" data-act="ag-today">Hoje</button>` : ''}</div>
    <div class="seg2">${[['all', 'Todos'], ...DB.pros.map(p => [p.id, p.name])].map(([k, l]) => `<button class="${UI.agPro === k ? 'on' : ''}" data-act="ag-pro" data-p="${k}">${l}</button>`).join('')}</div>
  </div>
  <div class="ag-sum">${['agendado', 'confirmado', 'concluido', 'cancelado'].map(s => `<span class="pill st-${s}">${STATUS[s]} · ${cnt(s)}</span>`).join('')}<span class="note" style="align-self:center">${list.length} no dia · clique para ver detalhes</span></div>
  <div class="desk-only">
    <div class="tl-wrap"><div class="tl" style="grid-template-columns:58px repeat(${pros.length}, minmax(220px,1fr));--hh:${HH}px">
      <div class="tl-hcell" style="padding:10px 8px"></div>
      ${pros.map(p => { const l = list.filter(a => a.proId === p.id && a.status !== 'cancelado'); return `<div class="tl-hcell">${p.name}<small>${l.length} atend. · ${pct(l.reduce((t, a) => t + a.dur, 0) / DAY_CAP)}</small></div>`; }).join('')}
      <div class="tl-times" style="height:${H}px">${hours.map(h => `<span style="top:${(h * 60 - OPEN) / 60 * HH}px">${pad(h)}:00</span>`).join('')}</div>
      ${pros.map(p => `<div class="tl-col" style="height:${H}px">${list.filter(a => a.proId === p.id).map(block).join('')}${nowTop !== null ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}</div>`).join('')}
    </div></div>
  </div>
  <div class="mobile-only"><div class="ag-list">${list.length ? list.map(a => { const c = cli(a.clientId); return `<button class="ag-card ${UI.hl === a.id ? 'hl' : ''}" data-act="appt" data-id="${a.id}"><span class="tm">${a.time}<small>${a.dur} min</small></span><span><span class="top"><span class="nm">${esc(c.name)}</span>${statusPill(a.status)}</span><span class="ds" style="display:block">${esc(svcLabel(a.serviceIds))}</span><span class="pr" style="display:block">${pro(a.proId).name}${a.source === 'site' ? ' · agendado pelo site' : ''}</span></span></button>`; }).join('') : `<div class="empty">${isOpen(D) ? 'Nenhum atendimento neste dia.' : 'Barbearia fechada aos domingos na agenda demonstrativa.'}</div>`}</div></div>`;
}

/* appointment detail modal */
function vApptModal(id) {
  const a = appt(id); if (!a) return '';
  const c = cli(a.clientId), T = todayStr();
  const mv = DB.moves.find(m => m.type === 'servico' && m.apptId === a.id);
  const rf = DB.referrals.find(r => r.referredId === a.clientId);
  const firstVisit = !DB.appts.some(b => b.clientId === a.clientId && b.status === 'concluido' && b.id !== a.id);
  const v = voucherOf(a.clientId);
  const ask = UI.confirmAct;
  const canConclude = a.date <= T;
  let impact = '';
  if (a.status === 'concluido') {
    impact = `<div class="callout ok">${ic('check')}<span>${mv ? `+${mv.points} pontos creditados em ${fStamp(mv.at)}.` : 'Atendimento sem valor elegível para pontos.'}${a.discount ? ` Benefício aplicado: −${money(a.discount)}.` : ''}${rf && rf.apptId === a.id ? ` Liberou +${DB.rules.referral} pts para ${esc(shortName(cli(rf.referrerId).name))} (indicação).` : ''}</span></div>`;
  } else if (a.status !== 'cancelado') {
    const est = a.price - (v ? Math.min(v.value, a.price) : 0);
    impact = `<div class="callout gold">${ic('crown')}<span>Ao concluir: +${est} pts para ${esc(firstName(c.name))} (regra ilustrativa: 1 pt por R$ 1)${v ? `, com o benefício de ${money(v.value)} aplicado` : ''}.${rf && rf.status === 'pendente' && firstVisit ? ` Primeiro atendimento de um indicado: libera +${DB.rules.referral} pts para ${esc(shortName(cli(rf.referrerId).name))}.` : ''}</span></div>`;
  }
  const acts = [];
  if (a.status === 'agendado') acts.push(`<button class="btn btn-line" data-act="st" data-id="${a.id}" data-s="confirmado">${ic('check')} Confirmar</button>`);
  if (isOpenStatus(a)) {
    acts.push(`<button class="btn btn-ghost" data-act="ask" data-id="${a.id}" data-s="cancelado">Cancelar</button>`);
    acts.push(canConclude ? `<button class="btn btn-gold" data-act="ask" data-id="${a.id}" data-s="concluido">Marcar como concluído</button>` : `<span class="note" style="align-self:center">Conclusão disponível no dia do atendimento</span>`);
  }
  if (a.status === 'cancelado') acts.push(`<button class="btn btn-line" data-act="st" data-id="${a.id}" data-s="agendado">${ic('refresh')} Reativar</button>`);
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh">
    <div class="modal-h"><div><h3 id="mh">${esc(c.name)}</h3><p>${fDayLong(a.date).replace(/^./, x => x.toUpperCase())} · ${a.time}–${tstr(tmin(a.time) + a.dur)} · <button class="link" data-act="client" data-id="${c.id}">Ver cliente</button></p></div><div style="display:flex;gap:8px;align-items:center">${statusPill(a.status)}<button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div></div>
    <div class="modal-b">
      <div class="det">
        <div class="full"><small>Serviços</small><b>${a.serviceIds.map(i => `${esc(svc(i).name)} <span class="note">(${svc(i).dur} min)</span>`).join('<br>')}</b></div>
        <div><small>Profissional</small><b>${pro(a.proId).name}</b></div>
        <div><small>Valor demonstrativo</small><b class="tnum">${money(a.price)}${a.discount ? ` <span class="note">−${money(a.discount)}</span>` : ''}</b></div>
        <div><small>Telefone</small><b>${esc(c.phone)}</b></div>
        <div><small>Origem</small><b>${a.source === 'site' ? 'Site / app (demonstração)' : 'Balcão / WhatsApp'}</b></div>
        <div class="full"><small>Registrado em</small><b>${fStamp(a.createdAt)}</b></div>
      </div>
      ${impact}
      ${ask && ask.id === a.id ? `<div class="confirm-box"><p>${ask.s === 'concluido' ? `Confirmar a conclusão? Os pontos serão creditados uma única vez para este atendimento.` : 'Cancelar este atendimento na agenda demonstrativa?'}</p><div class="row"><button class="btn btn-ghost btn-sm" data-act="ask-cancel">Voltar</button><button class="btn btn-gold btn-sm" data-act="st" data-id="${a.id}" data-s="${ask.s}">${ask.s === 'concluido' ? 'Concluir atendimento' : 'Cancelar atendimento'}</button></div></div>` : ''}
    </div>
    ${(ask && ask.id === a.id) || !acts.length ? '' : `<div class="modal-f">${acts.join('')}</div>`}
  </div>`;
}

/* ---------- Clientes ---------- */
function clientRows() {
  const q = UI.clientQ.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let rows = DB.clients.map(c => ({ c, s: clientStats(c.id) }));
  if (q) rows = rows.filter(({ c }) => c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) || onlyDigits(c.phone).includes(onlyDigits(q) || '§'));
  if (UI.clientFilter === 'next') rows = rows.filter(r => r.s.next);
  if (UI.clientFilter === 'lapsed') rows = rows.filter(r => r.s.last && r.s.sinceLast > LAPSE_DAYS && !r.s.next);
  if (UI.clientFilter === 'points') rows = rows.filter(r => r.s.points > 0);
  const sorters = { recent: (a, b) => ((b.s.last?.date || '') + (b.s.next?.date || '')).localeCompare((a.s.last?.date || '') + (a.s.next?.date || '')), name: (a, b) => a.c.name.localeCompare(b.c.name), spent: (a, b) => b.s.spent - a.s.spent, points: (a, b) => b.s.points - a.s.points, visits: (a, b) => b.s.visits - a.s.visits };
  rows.sort(sorters[UI.clientSort] || sorters.recent);
  return rows;
}
function vClientsList() {
  const rows = clientRows();
  if (!rows.length) return `<div class="empty">Nenhum cliente encontrado para “${esc(UI.clientQ)}”.</div>`;
  const shown = rows.slice(0, 80);
  return `<div class="desk-only"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Último atendimento</th><th class="r">Atendimentos</th><th class="r">Total gasto</th><th class="r">Pontos</th><th>Próximo agendamento</th></tr></thead><tbody>
    ${shown.map(({ c, s }) => `<tr class="click" data-act="client" data-id="${c.id}" tabindex="0"><td><span class="nm">${esc(c.name)}</span><span class="sm">${esc(c.phone)}</span></td><td>${s.last ? `${fDM(s.last.date)} <span class="sm">${fRel(s.last.date)}</span>` : '<span class="sm">—</span>'}</td><td class="r">${s.visits}</td><td class="r">${money0(s.spent)}</td><td class="r gold">${s.points}</td><td>${s.next ? `${fDM(s.next.date)} · ${s.next.time} <span class="sm">${STATUS[s.next.status]}</span>` : '<span class="sm">—</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="mobile-only"><div class="ccards">${shown.map(({ c, s }) => `<button class="ccard" data-act="client" data-id="${c.id}"><span class="ini">${initials(c.name)}</span><span style="min-width:0"><span class="nm" style="display:block">${esc(c.name)}</span><span class="ds" style="display:block">${s.visits} atend. · ${s.last ? 'último ' + fDM(s.last.date) : 'sem atendimento'}${s.next ? ' · próximo ' + fDM(s.next.date) : ''}</span></span><span class="pt">${s.points}<small>pts</small></span></button>`).join('')}</div></div>
  ${rows.length > shown.length ? `<p class="note" style="margin-top:10px">Mostrando ${shown.length} de ${rows.length}. Refine a busca para ver outros clientes.</p>` : ''}`;
}
function vClientes() {
  const all = DB.clients.map(c => clientStats(c.id));
  const f = [['all', 'Todos', DB.clients.length], ['next', 'Com agendamento', all.filter(s => s.next).length], ['lapsed', `Sem retorno ${LAPSE_DAYS}+ dias`, all.filter(s => s.last && s.sinceLast > LAPSE_DAYS && !s.next).length], ['points', 'Com pontos', all.filter(s => s.points > 0).length]];
  return `
  <div class="toolbar">
    <label class="search">${ic('search')}<input id="client-q" type="search" placeholder="Buscar por nome ou telefone" value="${esc(UI.clientQ)}" aria-label="Buscar cliente"></label>
    <select class="sel" id="client-sort" aria-label="Ordenar">${[['recent', 'Atividade recente'], ['name', 'Nome (A–Z)'], ['visits', 'Mais atendimentos'], ['spent', 'Maior gasto'], ['points', 'Mais pontos']].map(([k, l]) => `<option value="${k}" ${UI.clientSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
  </div>
  <div class="seg2">${f.map(([k, l, n]) => `<button class="${UI.clientFilter === k ? 'on' : ''}" data-act="cfilter" data-k="${k}">${l}<span class="n">${n}</span></button>`).join('')}</div>
  <section class="panel"><div class="panel-b" id="client-results">${vClientsList()}</div></section>`;
}
function vClientModal(id) {
  const c = cli(id), s = clientStats(id), cb = club(id);
  const ap = apptsOf(id).slice().reverse();
  const ms = movesOf(id);
  const given = DB.referrals.filter(r => r.referrerId === id), got = DB.referrals.find(r => r.referredId === id);
  return `<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="mh">
    <div class="modal-h"><div style="display:flex;gap:12px;align-items:center"><span class="ini" style="width:46px;height:46px;font-size:17px">${initials(c.name)}</span><div><h3 id="mh">${esc(c.name)}</h3><p>${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''} · cliente desde ${fDM(c.createdAt)}/${parseD(c.createdAt).getFullYear()}</p></div></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-b">
      <div class="cd-kpis"><div><small>Atendimentos</small><b>${s.visits}</b></div><div><small>Total gasto</small><b>${money0(s.spent)}</b></div><div><small>Ticket médio</small><b>${s.visits ? money0(s.spent / s.visits) : '—'}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">${cb.balance}</b></div></div>
      <div class="cd-sec"><h4>Agendamentos</h4><div class="mini">${ap.length ? ap.slice(0, 12).map(a => `<button data-act="appt" data-id="${a.id}"><span class="l"><b>${fDM(a.date)}/${parseD(a.date).getFullYear()} · ${a.time}</b><small>${esc(svcNames(a.serviceIds).join(' + '))} · ${pro(a.proId).name} · ${money(a.price)}</small></span>${statusPill(a.status)}</button>`).join('') : '<div>Nenhum agendamento.</div>'}</div>${ap.length > 12 ? `<p class="note" style="margin-top:6px">+${ap.length - 12} agendamentos anteriores</p>` : ''}</div>
      <div class="cd-sec"><h4>Movimentações de pontos</h4><div class="mini">${ms.length ? ms.slice(0, 10).map(m => `<div><span class="l"><b>${MOVE[m.type][0]}</b><small>${fStamp(m.at)}${m.apptId && appt(m.apptId) ? ' · ' + esc(svcLabel(appt(m.apptId).serviceIds)) : ''}${m.referralId ? ' · ' + esc(shortName(cli(DB.referrals.find(r => r.id === m.referralId).referredId).name)) : ''}</small></span><span class="${m.points > 0 ? 'plus' : 'minus'}">${m.points > 0 ? '+' : '−'}${Math.abs(m.points)} pts</span></div>`).join('') : '<div>Nenhuma movimentação. O clube começou em ' + fDM(DB.clubStart) + '.</div>'}</div></div>
      <div class="cd-sec"><h4>Indicações</h4><div class="mini">
        ${got ? `<div><span class="l"><b>Indicado por ${esc(cli(got.referrerId).name)}</b><small>${got.status === 'concluida' ? 'Primeiro atendimento concluído' : 'Aguardando primeiro atendimento'}</small></span>${got.status === 'concluida' ? statusPill('concluido') : '<span class="pill st-confirmado">Pendente</span>'}</div>` : ''}
        ${given.map(r => `<div><span class="l"><b>Indicou ${esc(cli(r.referredId).name)}</b><small>${fDM(r.createdAt)} · ${r.status === 'concluida' ? `+${DB.rules.referral} pts liberados` : 'aguardando primeiro atendimento'}</small></span>${r.status === 'concluida' ? statusPill('concluido') : '<span class="pill st-confirmado">Pendente</span>'}</div>`).join('')}
        ${!got && !given.length ? '<div>Nenhuma indicação registrada.</div>' : ''}
      </div></div>
    </div>
    <div class="modal-f"><button class="btn btn-ghost" data-act="view-as" data-id="${c.id}">${ic('eye')} Ver experiência deste cliente</button><button class="btn btn-line" data-act="draft-msg" data-id="${c.id}" data-k="${s.next ? 'next' : s.sinceLast > LAPSE_DAYS ? 'lapsed' : cb.balance >= 180 ? 'near' : 'recurring'}">${ic('msg')} Preparar mensagem</button></div>
  </div>`;
}

/* ---------- Serviços e equipe ---------- */
function vServAdmin() {
  const tab = UI.svcTab;
  const T = todayStr();
  return `
  <div class="toolbar"><div class="seg2">${[['servicos', 'Serviços'], ['equipe', 'Profissionais'], ['categorias', 'Categorias']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="svctab" data-k="${k}">${l}</button>`).join('')}</div><span class="note">Alterações ficam só neste navegador · não são salvas em sistema de produção</span></div>
  ${tab === 'servicos' ? `<section class="panel"><div class="panel-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Serviço</th><th>Categoria</th><th class="r">Duração</th><th class="r">Preço</th><th>Profissionais</th><th>No site</th><th></th></tr></thead><tbody>
    ${DB.services.map(s => `<tr><td><div class="svc-cell"><img src="${A[s.img]}" alt=""><span><span class="nm">${esc(s.name)}</span><span class="sm">${esc(s.desc)}</span></span></div></td><td>${CATS.find(c => c.id === s.cat).name}</td><td class="r">${s.dur} min</td><td class="r">${money(s.price)}</td><td>${DB.pros.filter(p => p.services.includes(s.id)).map(p => p.name.replace('Barbeiro ', 'B')).join(', ') || '—'}</td><td><button class="switch ${s.visible ? 'on' : ''}" role="switch" aria-checked="${s.visible}" aria-label="Exibir ${esc(s.name)} no site" data-act="svc-vis" data-id="${s.id}"></button></td><td class="r"><button class="link" data-act="svc-edit" data-id="${s.id}">Editar</button></td></tr>`).join('')}
  </tbody></table></div><p class="note" style="margin-top:10px">Preços e durações demonstrativos, a confirmar com a barbearia. Ocultar um serviço remove o item do catálogo do cliente.</p></div></section>` : ''}
  ${tab === 'equipe' ? `<div class="pro-cards">${DB.pros.map(p => { const today = DB.appts.filter(a => a.proId === p.id && a.date === T && a.status !== 'cancelado'); const m7 = metrics(addDays(T, -6), T, p.id); return `<section class="panel"><div class="panel-h"><h2>${p.name} <span class="tag">nome demonstrativo</span></h2></div><div class="panel-b"><div class="cd-kpis"><div><small>Hoje</small><b>${today.length}</b></div><div><small>Ocupação 7 dias</small><b>${pct(m7.occ)}</b></div><div><small>Concluídos 7 dias</small><b>${m7.done}</b></div><div><small>Faturamento 7 dias</small><b>${money0(m7.rev)}</b></div></div><div class="note" style="margin-top:12px">Serviços que realiza (toque para alternar)</div><div class="pchips">${DB.services.map(s => { const on = p.services.includes(s.id); return `<button class="pchip ${on ? 'on' : ''}" data-act="pro-svc" data-p="${p.id}" data-s="${s.id}" aria-pressed="${on}">${ic(on ? 'check' : 'plus')}${esc(s.name)}</button>`; }).join('')}</div></div></section>`; }).join('')}</div>` : ''}
  ${tab === 'categorias' ? `<section class="panel"><div class="panel-b"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Categoria</th><th>Serviços</th><th class="r">Atendimentos (30 dias)</th></tr></thead><tbody>${CATS.map(c => { const ids = DB.services.filter(s => s.cat === c.id).map(s => s.id); const n = DB.appts.filter(a => a.status === 'concluido' && a.date >= addDays(T, -29) && a.serviceIds.some(i => ids.includes(i))).length; return `<tr><td class="nm" style="font-family:var(--serif);font-size:16px;font-weight:500">${c.name}</td><td>${DB.services.filter(s => s.cat === c.id).map(s => esc(s.name)).join(', ')}</td><td class="r">${n}</td></tr>`; }).join('')}</tbody></table></div></div></section>` : ''}`;
}
function vSvcEdit(id) {
  const s = svc(id);
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">${esc(s.name)}</h3><p>Edição local para a apresentação</p></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="modal-b"><form id="svc-form" class="form" style="margin-top:0" novalidate><div class="fld-row"><div class="fld"><label for="in-dur">Duração (min)</label><input id="in-dur" type="number" min="5" max="240" step="5" value="${s.dur}"></div><div class="fld"><label for="in-price">Preço (R$)</label><input id="in-price" type="number" min="0" max="2000" step="1" value="${s.price}"></div></div></form>
  <div class="callout gold">${ic('info')}<span>Valores demonstrativos. A mudança vale para novos agendamentos e para o cálculo de pontos dos próximos atendimentos.</span></div></div>
  <div class="modal-f"><button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="svc-save" data-id="${s.id}">Salvar nesta demonstração</button></div></div>`;
}

/* ---------- Fidelidade ---------- */
function vFidelidade() {
  const T = todayStr(), from = addDays(T, -29);
  const members = DB.clients.map(c => ({ c, b: balance(c.id) })).filter(x => x.b > 0 || movesOf(x.c.id).length);
  const circ = members.reduce((t, x) => t + x.b, 0);
  const issued = DB.moves.filter(m => m.points > 0 && m.at >= from).reduce((t, m) => t + m.points, 0);
  const red = DB.moves.filter(m => m.type === 'resgate');
  const pend = DB.referrals.filter(r => r.status === 'pendente');
  const tab = UI.fidTab;
  const tabs = [['saldos', 'Saldos'], ['movs', 'Movimentações'], ['indicacoes', 'Indicações'], ['beneficios', 'Benefícios']];
  let body = '';
  if (tab === 'saldos') {
    const rows = members.sort((a, b) => b.b - a.b).slice(0, 60);
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="r">Saldo</th><th>Progresso até ${DB.benefit.cost} pts</th><th>Situação</th></tr></thead><tbody>${rows.map(({ c, b }) => { const p = Math.min(1, b / DB.benefit.cost); return `<tr class="click" data-act="client" data-id="${c.id}"><td><span class="nm">${esc(c.name)}</span>${c.id === DB.activeClientId ? '<span class="sm">perfil em uso na experiência do cliente</span>' : ''}</td><td class="r gold">${b}</td><td><div class="prog"><div class="mbar"><i style="width:${Math.round(p * 100)}%"></i></div><small>${pct(p)}</small></div></td><td>${b >= DB.benefit.cost ? '<span class="pill st-concluido">Pode resgatar</span>' : b >= 180 ? '<span class="pill st-confirmado">Perto do resgate</span>' : voucherOf(c.id) ? '<span class="tag tag-gold">Benefício ativo</span>' : '<span class="sm">Acumulando</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else if (tab === 'movs') {
    const ms = DB.moves.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th>Origem</th><th class="r">Pontos</th></tr></thead><tbody>${ms.map(m => { const c = cli(m.clientId); const a = m.apptId && appt(m.apptId); const r = m.referralId && DB.referrals.find(x => x.id === m.referralId); return `<tr class="click" data-act="${a ? 'appt' : 'client'}" data-id="${a ? a.id : c.id}"><td>${fDM(m.at.slice(0, 10))} <span class="sm">${m.at.slice(11)}</span></td><td class="nm">${esc(c.name)}</td><td>${MOVE[m.type][0]}</td><td><span class="sm" style="font-size:12.5px">${a ? `Atendimento ${fDM(a.date)} · ${esc(svcLabel(a.serviceIds))}` : r ? `1º atendimento de ${esc(shortName(cli(r.referredId).name))}` : DB.benefit.title}</span></td><td class="r ${m.points > 0 ? 'gold' : ''}">${m.points > 0 ? '+' : '−'}${Math.abs(m.points)}</td></tr>`; }).join('')}</tbody></table></div>`;
  } else if (tab === 'indicacoes') {
    const rs = DB.referrals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    body = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quem indicou</th><th>Indicado</th><th>Data</th><th>Status</th><th>Atendimento que liberou</th></tr></thead><tbody>${rs.map(r => { const a = r.apptId && appt(r.apptId); const nx = clientStats(r.referredId).next; return `<tr class="click" data-act="client" data-id="${r.referredId}"><td class="nm">${esc(cli(r.referrerId).name)}</td><td>${esc(cli(r.referredId).name)}</td><td>${fDM(r.createdAt)}</td><td>${r.status === 'concluida' ? `<span class="pill st-concluido">+${DB.rules.referral} pts liberados</span>` : '<span class="pill st-confirmado">Aguardando 1º atendimento</span>'}</td><td><span class="sm" style="font-size:12.5px">${a ? `${fDM(a.date)} · ${esc(svcLabel(a.serviceIds))}` : nx ? `Agendado para ${fDM(nx.date)} às ${nx.time}` : 'Sem agendamento ainda'}</span></td></tr>`; }).join('')}</tbody></table></div>`;
  } else {
    const active = DB.vouchers.filter(v => v.status === 'disponivel');
    body = `<div class="rules" style="margin-bottom:14px">
      <div class="rule">${ic('gift')}<b>${DB.benefit.title}</b><small>Resgate com ${DB.benefit.cost} pontos · aplicado no próximo atendimento concluído</small></div>
      <div class="rule">${ic('ticket')}<b>${red.length} resgates</b><small>${active.length} benefício${active.length === 1 ? '' : 's'} aguardando uso</small></div>
      <div class="rule">${ic('trend')}<b>${nearReward().length} clientes perto da meta</b><small>Entre 180 e ${DB.benefit.cost - 1} pontos</small></div></div>
      <div class="mini">${active.length ? active.map(v => `<button data-act="client" data-id="${v.clientId}"><span class="l"><b>${esc(cli(v.clientId).name)}</b><small>Resgatado em ${fStamp(v.createdAt)}</small></span><span class="tag tag-gold">Aguardando uso</span></button>`).join('') : '<div>Nenhum benefício aguardando uso.</div>'}</div>`;
  }
  return `
  <div class="kpis">
    <div class="kpi lead"><span class="k">${ic('crown')}Pontos em circulação</span><span class="v">${num(circ)}</span><span class="d">${members.length} membros com movimentação</span></div>
    <div class="kpi"><span class="k">${ic('trend')}Pontos emitidos</span><span class="v">${num(issued)}</span><span class="d">últimos 30 dias</span></div>
    <div class="kpi"><span class="k">${ic('gift')}Resgates</span><span class="v">${red.length}</span><span class="d">desde o início do clube (${fDM(DB.clubStart)})</span></div>
    <div class="kpi"><span class="k">${ic('userPlus')}Indicações pendentes</span><span class="v">${pend.length}</span><span class="d">liberam pontos no 1º atendimento</span></div>
  </div>
  <div class="rules">
    <div class="rule">${ic('scissors')}<b>1 ponto por R$ 1</b><small>Creditado só quando o atendimento é concluído</small></div>
    <div class="rule">${ic('userPlus')}<b>+${DB.rules.referral} pontos por indicação</b><small>Após o primeiro atendimento concluído do indicado</small></div>
    <div class="rule">${ic('gift')}<b>${DB.benefit.title}</b><small>${DB.benefit.cost} pontos · regra ilustrativa, a validar</small></div>
  </div>
  <div class="seg2">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="fidtab" data-k="${k}">${l}</button>`).join('')}</div>
  <section class="panel"><div class="panel-b">${body}</div></section>`;
}

/* ---------- Oportunidades ---------- */
function oppData() {
  const T = todayStr();
  const stats = DB.clients.map(c => ({ c, s: clientStats(c.id) }));
  return {
    lapsed: { label: `Sem retorno há ${LAPSE_DAYS}+ dias`, rows: lapsedClients().map(({ c, s }) => ({ c, why: `Último atendimento há ${s.sinceLast} dias (${fDM(s.last.date)}) · ${svcLabel(s.last.serviceIds)}` })) },
    recurring: { label: 'Clientes recorrentes', rows: stats.filter(({ s }) => s.visits >= 4 && s.sinceLast !== null && s.sinceLast <= LAPSE_DAYS).sort((a, b) => b.s.visits - a.s.visits).map(({ c, s }) => ({ c, why: `${s.visits} atendimentos · ${money0(s.spent)} no histórico · último ${fRel(s.last.date)}` })) },
    next: { label: 'Com agendamento futuro', rows: stats.filter(({ s }) => s.next).sort((a, b) => (a.s.next.date + a.s.next.time).localeCompare(b.s.next.date + b.s.next.time)).map(({ c, s }) => ({ c, why: `${s.next.date === T ? 'Hoje' : fDM(s.next.date)} às ${s.next.time} · ${svcLabel(s.next.serviceIds)} · ${STATUS[s.next.status]}` })) },
    near: { label: 'Perto do resgate', rows: [...nearReward().map(({ c, b }) => ({ c, why: `${b} pontos · faltam ${DB.benefit.cost - b} para ${DB.benefit.title}` })), ...DB.clients.filter(c => balance(c.id) >= DB.benefit.cost).map(c => ({ c, why: `${balance(c.id)} pontos · já pode resgatar ${DB.benefit.title}` }))] },
    referral: { label: 'Indicações pendentes', rows: DB.referrals.filter(r => r.status === 'pendente').map(r => { const nx = clientStats(r.referredId).next; return { c: cli(r.referredId), why: `Indicado por ${shortName(cli(r.referrerId).name)} em ${fDM(r.createdAt)} · ${nx ? `1º atendimento marcado para ${fDM(nx.date)} às ${nx.time}` : 'ainda sem agendamento'}` }; }) },
  };
}
function vOpp() {
  const O = oppData();
  const k = O[UI.opp] ? UI.opp : 'lapsed';
  const rows = O[k].rows;
  return `
  <div class="seg2">${Object.entries(O).map(([key, o]) => `<button class="${k === key ? 'on' : ''}" data-act="opp" data-k="${key}">${o.label}<span class="n">${o.rows.length}</span></button>`).join('')}</div>
  <div class="callout gold" style="margin-top:0">${ic('info')}<span>Listas geradas a partir dos dados da demonstração. As mensagens são apenas rascunhos: nada é enviado e nenhuma campanha é executada.</span></div>
  <div style="display:flex;flex-direction:column;gap:8px">${rows.length ? rows.slice(0, 40).map(({ c, why }) => `<div class="opp-row"><span class="ini">${initials(c.name)}</span><div style="min-width:0"><div class="nm" style="font-weight:600">${esc(c.name)}</div><div class="why">${esc(why)}</div></div><div class="acts"><button class="btn btn-ghost btn-sm" data-act="client" data-id="${c.id}">Abrir cliente</button><button class="btn btn-line btn-sm" data-act="draft-msg" data-id="${c.id}" data-k="${k}">${ic('msg')} Preparar mensagem</button></div></div>`).join('') : '<div class="empty">Nenhum cliente nesta lista agora.</div>'}</div>
  ${rows.length > 40 ? `<p class="note">Mostrando 40 de ${rows.length}.</p>` : ''}`;
}
function vDraftMsg(cid, k) {
  const c = cli(cid), s = clientStats(cid), b = balance(cid);
  const fn = firstName(c.name);
  const T = {
    lapsed: `Olá, ${fn}! Aqui é da Cidade Nobre. Faz um tempo desde seu último ${s.last ? svcNames(s.last.serviceIds)[0].toLowerCase() : 'atendimento'}. Quando quiser renovar o visual, é só escolher o melhor horário pelo nosso agendamento.`,
    recurring: `Olá, ${fn}! Obrigado por fazer parte da Cidade Nobre. Você está com ${b} pontos no Clube. Quer que a gente reserve seu próximo horário?`,
    next: `Olá, ${fn}! Passando para lembrar do seu horário ${s.next ? `em ${fDM(s.next.date)} às ${s.next.time}` : ''} na Cidade Nobre. Se precisar alterar, responda esta mensagem.`,
    near: `Olá, ${fn}! Você está com ${b} pontos no Clube Cidade Nobre. ${b >= DB.benefit.cost ? `Já pode resgatar ${DB.benefit.title}.` : `Faltam ${DB.benefit.cost - b} para ${DB.benefit.title}.`}`,
    referral: `Olá, ${fn}! Que bom ter você por indicação de um cliente da Cidade Nobre. Seu primeiro horário pode ser marcado pelo nosso agendamento.`,
  };
  const txt = T[k] || T.recurring;
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">Rascunho para ${esc(fn)}</h3><p>${esc(c.phone)} · sugestão de mensagem</p></div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="modal-b"><div class="draft" id="draft-txt">${esc(txt)}</div><div class="callout gold">${ic('info')}<span>Demonstração: nenhuma mensagem é enviada. No sistema real, este passo poderia ser integrado ao WhatsApp da barbearia.</span></div></div>
  <div class="modal-f"><button class="btn btn-ghost" data-act="close">Fechar</button><button class="btn btn-line" data-act="copy-draft">${ic('copy')} Copiar texto</button></div></div>`;
}

/* ---------- admin shell ---------- */
function adminNav() {
  const T = todayStr();
  const counts = { agenda: DB.appts.filter(a => a.date === T && a.status !== 'cancelado').length, oportunidades: lapsedClients().length };
  return `<div class="anav">${ANAV.map(n => `<button class="${UI.admin === n.id ? 'on' : ''}" data-act="anav" data-id="${n.id}">${ic(n.icon)}${n.label}${counts[n.id] !== undefined ? `<span class="ct">${counts[n.id]}</span>` : ''}</button>`).join('')}</div>`;
}
function vAdmin() {
  const [t, sub] = ATITLE[UI.admin];
  const map = { dash: vDash, agenda: vAgenda, clientes: vClientes, servicos: vServAdmin, fidelidade: vFidelidade, oportunidades: vOpp };
  return `<div class="ad">
    <aside class="ad-side">
      <div class="ad-logo">${lockup(42)}<small>Gestão da barbearia</small></div>
      ${adminNav()}
      <div class="side-foot">
        <button class="btn btn-line" data-act="mode" data-mode="client">${ic('swap')} Experiência do cliente</button>
        <button class="btn btn-ghost" data-act="reset-ask">${ic('refresh')} Restaurar dados</button>
        <div class="demo-chip" style="padding:6px 4px 0">Protótipo demonstrativo · SMG</div>
      </div>
    </aside>
    <div class="ad-main">
      <header class="ad-head"><button class="mb" data-act="amenu" aria-label="Abrir menu">${ic('menu')}</button><div><h1>${t}</h1><div class="sub">${sub}</div></div><div class="r"><span class="sim">Dados simulados</span></div></header>
      <div class="ad-body scr">${map[UI.admin]()}</div>
    </div>
  </div>`;
}
function vAdminMenu() {
  return `<div class="drawer left" role="dialog" aria-modal="true" aria-label="Menu da gestão">
    <div class="drawer-top">${lockup(38)}<button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
    <div class="note" style="letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px 4px">Gestão da barbearia</div>
    ${adminNav()}
    <div class="mode"><small>Ambiente da demonstração</small><div class="seg"><button data-act="mode" data-mode="client">Experiência do cliente</button><button class="on" data-act="close">Gestão da barbearia</button></div></div>
    <div class="foot"><button class="btn btn-ghost" data-act="reset-ask">${ic('refresh')} Restaurar dados da demonstração</button><div class="demo-chip">Protótipo demonstrativo — dados fictícios · SMG</div></div>
  </div>`;
}
