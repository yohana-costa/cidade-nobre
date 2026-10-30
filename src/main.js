/* ============ render + events ============ */
const $app = document.getElementById('app');
const $layer = document.getElementById('layer');
const $toast = document.getElementById('toast');
let LAYER = null; // {kind, id, k}

function render(keepScroll) {
  const y = window.scrollY;
  document.body.classList.toggle('admin-on', UI.mode === 'admin');
  $app.innerHTML = UI.mode === 'admin' ? vAdmin() : vClient();
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  renderLayer();
  if (UI.hl) { const el = document.querySelector('.blk.hl, .ag-card.hl'); if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); setTimeout(() => { UI.hl = null; }, 3000); }
}
function go(screen, keep) { UI.screen = screen; UI.mode = 'client'; LAYER = null; saveUI(); render(keep); }
function toast(msg, icon = 'check') {
  $toast.innerHTML = `<div class="toast" role="status">${ic(icon)}<span>${msg}</span></div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $toast.innerHTML = ''; }, 3600);
}
function openLayer(l) { LAYER = l; UI.confirmAct = null; renderLayer(); }
function closeLayer() { LAYER = null; UI.confirmAct = null; renderLayer(); }
function renderLayer() {
  if (!LAYER) { $layer.innerHTML = ''; $layer.className = ''; document.body.style.overflow = ''; return; }
  let inner = '';
  const L = LAYER;
  if (L.kind === 'menu') inner = vMenu();
  else if (L.kind === 'amenu') inner = vAdminMenu();
  else if (L.kind === 'appt') inner = vApptModal(L.id);
  else if (L.kind === 'client') inner = vClientModal(L.id);
  else if (L.kind === 'svc-edit') inner = vSvcEdit(L.id);
  else if (L.kind === 'draft') inner = vDraftMsg(L.id, L.k);
  else inner = vSheet(L);
  const prevScroll = $layer.querySelector('.modal')?.scrollTop || 0;
  $layer.className = `layer ${L.kind === 'menu' || L.kind === 'amenu' ? '' : 'sheet-l'}`;
  $layer.innerHTML = `<div class="scrim" data-act="close"></div>${inner}`;
  const m = $layer.querySelector('.modal'); if (m && L.keep) m.scrollTop = prevScroll;
  document.body.style.overflow = 'hidden';
  const f = $layer.querySelector('.x, [data-act="close"]:not(.scrim)'); if (f && !L.keep) f.focus({ preventScroll: true });
}
function sheet(title, sub, body, foot) {
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
}
function vSheet(L) {
  if (L.kind === 'rule' && L.id === 'servico') return sheet('Serviços concluídos', 'Regra ilustrativa, a validar com a barbearia', `<div class="rules" style="grid-template-columns:1fr"><div class="rule">${ic('scissors')}<b>1 ponto para cada R$ 1 pago</b><small>Em serviços elegíveis. Um atendimento de ${money(60)} gera 60 pontos.</small></div><div class="rule">${ic('clock')}<b>Crédito após a conclusão</b><small>Agendar não gera pontos. O crédito acontece quando a barbearia marca o atendimento como concluído, uma única vez por atendimento.</small></div><div class="rule">${ic('gift')}<b>${DB.benefit.title} com ${DB.benefit.cost} pontos</b><small>O resgate consome ${DB.benefit.cost} pontos e o desconto é aplicado no próximo atendimento.</small></div></div>`);
  if (L.kind === 'rule' && L.id === 'indicacao') return sheet('Indique e ganhe', 'Regra ilustrativa, a validar com a barbearia', `<div class="rules" style="grid-template-columns:1fr"><div class="rule">${ic('link')}<b>Compartilhe seu link</b><small>Copiar ou compartilhar o link não gera pontos.</small></div><div class="rule">${ic('userPlus')}<b>Seu amigo agenda e é atendido</b><small>A indicação fica pendente até o primeiro atendimento dele ser concluído.</small></div><div class="rule">${ic('crown')}<b>+${DB.rules.referral} pontos para você</b><small>Liberados automaticamente quando a barbearia conclui esse primeiro atendimento.</small></div></div>`);
  if (L.kind === 'move') {
    const m = DB.moves.find(x => x.id === L.id); if (!m) return '';
    let body = '';
    if (m.type === 'servico') { const a = appt(m.apptId); body = `<div class="det"><div class="full"><small>Atendimento</small><b>${esc(svcNames(a.serviceIds).join(' + '))}</b></div><div><small>Data</small><b>${fDM(a.date)} às ${a.time}</b></div><div><small>Profissional</small><b>${pro(a.proId).name}</b></div><div><small>Valor pago (demonstrativo)</small><b>${money(paid(a))}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">+${m.points} pts</b></div></div>${a.discount ? `<div class="callout gold">${ic('gift')}<span>Benefício de ${money(a.discount)} aplicado neste atendimento.</span></div>` : ''}`; }
    else if (m.type === 'indicacao') { const r = DB.referrals.find(x => x.id === m.referralId); const a = appt(r.apptId); body = `<div class="det"><div><small>Amigo indicado</small><b>${esc(shortName(cli(r.referredId).name))}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">+${m.points} pts</b></div><div class="full"><small>Liberado pelo primeiro atendimento</small><b>${a ? `${fDM(a.date)} · ${esc(svcLabel(a.serviceIds))}` : '—'}</b></div></div>`; }
    else body = `<div class="det"><div><small>Benefício</small><b>${DB.benefit.title}</b></div><div><small>Pontos</small><b>−${Math.abs(m.points)} pts</b></div></div>`;
    return sheet(MOVE[m.type][0], fStamp(m.at), body);
  }
  if (L.kind === 'redeem') { const c = club(DB.activeClientId); return sheet(`Resgatar ${DB.benefit.title}?`, 'Resgate demonstrativo', `<div class="det"><div><small>Saldo atual</small><b>${c.balance} pts</b></div><div><small>Saldo após o resgate</small><b>${c.balance - DB.benefit.cost} pts</b></div></div><div class="callout gold">${ic('info')}<span>O desconto fica disponível para o próximo atendimento e é aplicado quando a barbearia concluir esse atendimento.</span></div>`, `<button class="btn btn-ghost" data-act="close">Agora não</button><button class="btn btn-gold" data-act="redeem">Confirmar resgate</button>`); }
  if (L.kind === 'reset') return sheet('Restaurar dados da demonstração?', 'Útil antes de cada apresentação', `<p style="margin:0;color:var(--muted)">Agendamentos criados, pontos, resgates e edições voltam ao estado inicial. As datas são recalculadas a partir de hoje.</p>`, `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="reset">Restaurar dados</button>`);
  if (L.kind === 'cancel') { const a = appt(L.id); return sheet('Cancelar este horário?', `${fDM(a.date)} às ${a.time} · ${esc(svcLabel(a.serviceIds))}`, `<p style="margin:0;color:var(--muted)">O cancelamento é registrado apenas nesta demonstração e aparece na agenda da barbearia.</p>`, `<button class="btn btn-ghost" data-act="close">Manter horário</button><button class="btn btn-gold" data-act="cancel-appt" data-id="${a.id}">Cancelar horário</button>`); }
  if (L.kind === 'profile') { const c = cli(DB.activeClientId); const e = L.errs || {}; const f = (id, l, t, v, x = '') => `<div class="fld ${e[id] ? 'err' : ''}"><label for="pf-${id}">${l}</label><input id="pf-${id}" type="${t}" value="${esc(v)}" ${x}>${e[id] ? `<div class="msg">${ic('alert')}${e[id]}</div>` : ''}</div>`; return sheet('Editar meus dados', 'Alterações ficam apenas nesta demonstração', `<form class="form" style="margin-top:0" id="pf-form" novalidate>${f('name', 'Nome', 'text', L.v?.name ?? c.name, 'autocomplete="name"')}${f('phone', 'Telefone (WhatsApp)', 'tel', L.v?.phone ?? c.phone, 'inputmode="numeric"')}${f('email', 'E-mail (opcional)', 'email', L.v?.email ?? c.email ?? '')}</form>`, `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="save-profile">Salvar</button>`); }
  return '';
}

/* ---- booking helpers ---- */
function startBooking() { if (UI.draft.editingId) UI.draft = emptyDraft(); go('servicos'); }
function editAppt(id) {
  const a = appt(id), c = cli(a.clientId);
  UI.draft = { serviceIds: [...a.serviceIds], proId: a.chosenPro || a.proId, date: a.date, time: a.time, name: c.name, phone: c.phone, email: c.email || '', editingId: a.id, touched: true };
  go('agendar');
}
function readForm() {
  const d = UI.draft;
  const n = document.getElementById('in-name'), p = document.getElementById('in-phone'), e = document.getElementById('in-email');
  if (n) { d.name = n.value; d.phone = p.value; d.email = e.value; }
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove(); return ok;
}
async function copyText(text, inputId) {
  // tenta a API moderna; se o navegador bloquear (ex.: arquivo aberto localmente), usa o método clássico
  try { await navigator.clipboard.writeText(text); return true; }
  catch (err) {
    if (legacyCopy(text)) return true;
    const el = inputId && document.getElementById(inputId); if (el) { el.focus(); el.select(); } return false;
  }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-go]');
  if (!t) return;
  if (t.matches('[aria-disabled="true"]')) return;
  const act = t.dataset.act, D = t.dataset;
  if (D.go && !act) { e.preventDefault(); if (D.go === 'agendar' && !UI.draft.serviceIds.length) { go('servicos'); toast('Escolha ao menos um serviço para ver os horários.', 'info'); return; } if (D.go === 'dados' && !UI.draft.time) { go('agendar'); return; } go(D.go); return; }
  switch (act) {
    case 'menu': openLayer({ kind: 'menu' }); break;
    case 'amenu': openLayer({ kind: 'amenu' }); break;
    case 'close': closeLayer(); break;
    case 'mode': UI.mode = D.mode; LAYER = null; if (UI.mode === 'admin' && !UI.admin) UI.admin = 'dash'; saveUI(); render(); toast(D.mode === 'admin' ? 'Gestão da barbearia · dados simulados' : 'Experiência do cliente', 'swap'); break;
    case 'start-booking': startBooking(); break;
    case 'scroll-exp': document.getElementById('experiencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'cat': UI.cat = D.cat; go('servicos'); break;
    case 'cat-filter': UI.cat = D.cat; saveUI(); render(true); break;
    case 'svc-toggle': { const ids = UI.draft.serviceIds; const i = ids.indexOf(D.id); i >= 0 ? ids.splice(i, 1) : ids.push(D.id); UI.draft.time = i >= 0 ? UI.draft.time : UI.draft.time; saveUI(); render(true); break; }
    case 'svc-continue': if (!UI.draft.serviceIds.length) { toast('Selecione ao menos um serviço.', 'info'); break; } go('agendar'); break;
    case 'pro': UI.draft.proId = D.id; if (UI.draft.time && !slotFree(UI.draft.date, UI.draft.time, D.id, UI.draft.serviceIds, UI.draft.editingId)) { UI.draft.time = null; toast('O horário escolhido não está livre para este profissional. Escolha outro.', 'info'); } saveUI(); render(true); break;
    case 'day': UI.draft.date = D.date; if (UI.draft.time && !slotFree(D.date, UI.draft.time, UI.draft.proId, UI.draft.serviceIds, UI.draft.editingId)) UI.draft.time = null; saveUI(); render(true); break;
    case 'slot': UI.draft.time = D.time; saveUI(); render(true); break;
    case 'to-dados': if (!UI.draft.time) { toast('Escolha um horário para continuar.', 'info'); break; } UI.formErrors = null; go('dados'); break;
    case 'clear-form': UI.draft.name = ''; UI.draft.phone = ''; UI.draft.email = ''; UI.draft.touched = true; saveUI(); render(true); document.getElementById('in-name')?.focus(); break;
    case 'confirm-booking': {
      readForm();
      const errs = validate(UI.draft);
      UI.formErrors = errs;
      if (Object.keys(errs).length) { render(true); const f = document.querySelector('.fld.err input'); f?.focus(); f?.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Confira os campos destacados.', 'alert'); break; }
      t.disabled = true; t.innerHTML = `<span class="spin"></span> Registrando…`;
      await new Promise(r => setTimeout(r, 850));
      const chosen = UI.draft.proId;
      const res = commitBooking();
      if (res.error) { toast(res.error, 'alert'); go('agendar'); break; }
      res.appt.chosenPro = chosen; save();
      UI.lastEdited = res.edited; UI.formErrors = null;
      go('confirmado');
      break;
    }
    case 'edit-appt': editAppt(D.id); break;
    case 'see-in-admin': { const a = appt(D.id); UI.mode = 'admin'; UI.admin = 'agenda'; UI.agDate = a.date; UI.agPro = 'all'; UI.hl = a.id; saveUI(); render(); toast('Agendamento recebido na agenda da barbearia (demonstração)', 'calendar'); break; }
    case 'hist-toggle': UI.histOpen = !UI.histOpen; saveUI(); render(true); break;
    case 'pf-more': UI.pfMore = !UI.pfMore; render(true); break;
    case 'rule': openLayer({ kind: 'rule', id: D.rule }); break;
    case 'move': openLayer({ kind: 'move', id: D.id }); break;
    case 'redeem-ask': openLayer({ kind: 'redeem' }); break;
    case 'redeem': { const r = redeem(DB.activeClientId); closeLayer(); if (r.error) { toast(r.error, 'alert'); break; } render(true); toast(`Resgate registrado na demonstração: ${DB.benefit.title} disponível para o próximo atendimento.`, 'gift'); break; }
    case 'copy-link': { const v = document.getElementById('ref-link').value; const ok = await copyText(`https://${v}`, 'ref-link'); toast(ok ? 'Link copiado. Nenhum ponto é gerado só por compartilhar.' : 'Não foi possível copiar automaticamente. O link está selecionado para você copiar.', ok ? 'copy' : 'info'); break; }
    case 'share-wa': toast('Se o WhatsApp abrir, a mensagem já estará escrita. Nada é enviado sem você.', 'wa'); break;
    case 'share-native': {
      try { await navigator.share({ title: 'Cidade Nobre — Barbearia Premium', text: 'Agende pelo meu link de indicação:', url: `https://${document.getElementById('ref-link').value}` }); toast('Compartilhamento aberto. Nada é enviado sem você.', 'link'); }
      catch (err) { if (!err || err.name !== 'AbortError') toast('Compartilhamento do sistema indisponível aqui. Use o botão do WhatsApp ou copie o link.', 'info'); }
      break;
    }
    case 'cancel-ask': openLayer({ kind: 'cancel', id: D.id }); break;
    case 'cancel-appt': setStatus(D.id, 'cancelado'); closeLayer(); render(true); toast('Horário cancelado nesta demonstração.', 'check'); break;
    case 'edit-profile': openLayer({ kind: 'profile' }); break;
    case 'save-profile': {
      const v = { name: document.getElementById('pf-name').value, phone: document.getElementById('pf-phone').value, email: document.getElementById('pf-email').value };
      const errs = validate(v);
      const dup = DB.clients.find(c => c.id !== DB.activeClientId && onlyDigits(c.phone) === onlyDigits(v.phone));
      if (dup) errs.phone = 'Este telefone já pertence a outro cliente da demonstração.';
      if (Object.keys(errs).length) { openLayer({ kind: 'profile', errs, v }); break; }
      const c = cli(DB.activeClientId); c.name = v.name.trim(); c.phone = fmtPhone(v.phone); c.email = v.email.trim(); save(); closeLayer(); render(true); toast('Dados atualizados nesta demonstração.');
      break;
    }
    case 'reset-ask': openLayer({ kind: 'reset' }); break;
    case 'reset': resetDemo(); LAYER = null; render(); toast('Dados da demonstração restaurados.', 'refresh'); break;
    /* admin */
    case 'anav': UI.admin = D.id; UI.mode = 'admin'; LAYER = null; saveUI(); render(); break;
    case 'period': UI.period = D.p; saveUI(); render(true); break;
    case 'ag-day': { let d = addDays(UI.agDate, Number(D.n)); UI.agDate = d; saveUI(); render(true); break; }
    case 'ag-today': UI.agDate = todayStr(); saveUI(); render(true); break;
    case 'ag-pro': UI.agPro = D.p; saveUI(); render(true); break;
    case 'appt': openLayer({ kind: 'appt', id: D.id }); break;
    case 'ask': UI.confirmAct = { id: D.id, s: D.s }; LAYER.keep = true; renderLayer(); break;
    case 'ask-cancel': UI.confirmAct = null; renderLayer(); break;
    case 'st': {
      const a = appt(D.id); const was = a.status;
      const res = setStatus(D.id, D.s) || {};
      UI.confirmAct = null;
      if (res.error) { toast(res.error, 'alert'); renderLayer(); break; }
      render(true); LAYER = { kind: 'appt', id: D.id, keep: true }; renderLayer();
      if (D.s === 'concluido') {
        const parts = [`Atendimento concluído`];
        if (res.points) parts.push(`+${res.points} pts para ${firstName(cli(a.clientId).name)}`);
        if (res.voucher) parts.push(`benefício de ${money(res.voucher.value)} aplicado`);
        if (res.referral) parts.push(`+${DB.rules.referral} pts de indicação para ${firstName(cli(res.referral.referrerId).name)}`);
        toast(parts.join(' · '), 'crown');
      } else toast(D.s === 'cancelado' ? 'Atendimento cancelado na agenda demonstrativa.' : D.s === 'confirmado' ? 'Presença confirmada na agenda demonstrativa.' : was === 'cancelado' ? 'Atendimento reativado.' : 'Status atualizado.');
      break;
    }
    case 'client': openLayer({ kind: 'client', id: D.id }); break;
    case 'cfilter': UI.clientFilter = D.k; saveUI(); render(true); break;
    case 'svctab': UI.svcTab = D.k; saveUI(); render(true); break;
    case 'svc-vis': { const s = svc(D.id); if (s.visible && DB.services.filter(x => x.visible).length === 1) { toast('Mantenha ao menos um serviço visível no site.', 'info'); break; } s.visible = !s.visible; UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i).visible); save(); render(true); toast(s.visible ? `${s.name} voltou ao catálogo do cliente.` : `${s.name} foi ocultado do catálogo do cliente.`, 'eye'); break; }
    case 'svc-edit': openLayer({ kind: 'svc-edit', id: D.id }); break;
    case 'svc-save': { const s = svc(D.id); const du = Math.round(Number(document.getElementById('in-dur').value)); const pr = Math.round(Number(document.getElementById('in-price').value)); if (!(du >= 5 && du <= 240) || !(pr >= 0 && pr <= 2000)) { toast('Use duração entre 5 e 240 min e preço entre R$ 0 e R$ 2.000.', 'alert'); break; } s.dur = du; s.price = pr; save(); closeLayer(); render(true); toast(`${s.name} atualizado nesta demonstração.`); break; }
    case 'pro-svc': { const p = pro(D.p); const i = p.services.indexOf(D.s); if (i >= 0) { if (p.services.length === 1) { toast('Cada profissional precisa realizar ao menos um serviço.', 'info'); break; } p.services.splice(i, 1); } else p.services.push(D.s); save(); render(true); break; }
    case 'fidtab': UI.fidTab = D.k; saveUI(); render(true); break;
    case 'opp': { const inOpp = UI.admin === 'oportunidades'; UI.opp = D.k; UI.admin = 'oportunidades'; saveUI(); render(inOpp); break; }
    case 'draft-msg': openLayer({ kind: 'draft', id: D.id, k: D.k }); break;
    case 'copy-draft': { const ok = await copyText(document.getElementById('draft-txt').textContent); toast(ok ? 'Texto copiado. Nenhuma mensagem foi enviada.' : 'Selecione o texto para copiar.', ok ? 'copy' : 'info'); break; }
    case 'view-as': DB.activeClientId = D.id; UI.draft = emptyDraft(); save(); UI.mode = 'client'; LAYER = null; UI.screen = 'perfil'; saveUI(); render(); toast(`Experiência do cliente com o perfil de ${firstName(cli(D.id).name)}`, 'eye'); break;
  }
});
// keyboard access for clickable table rows
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && LAYER) { closeLayer(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.click')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'in-phone' || t.id === 'pf-phone') t.value = fmtPhone(t.value);
  if (t.id === 'in-name' || t.id === 'in-phone' || t.id === 'in-email') {
    UI.draft.touched = true; readForm(); saveUI();
    const fld = t.closest('.fld'); if (fld && fld.classList.contains('err')) { const errs = validate(UI.draft); const k = t.id.slice(3); if (!errs[k]) { fld.classList.remove('err'); fld.querySelector('.msg')?.remove(); if (UI.formErrors) delete UI.formErrors[k]; } }
    const pf = document.querySelector('.prefill'); if (pf) pf.remove();
  }
  if (t.id === 'client-q') { UI.clientQ = t.value; document.getElementById('client-results').innerHTML = vClientsList(); }
});
document.addEventListener('change', e => { if (e.target.id === 'client-sort') { UI.clientSort = e.target.value; saveUI(); document.getElementById('client-results').innerHTML = vClientsList(); } });
document.addEventListener('focusout', e => {
  const t = e.target;
  if (!['in-name', 'in-phone', 'in-email'].includes(t.id)) return;
  if (!t.value && t.id !== 'in-email' && !UI.formErrors) return;
  const k = t.id.slice(3), errs = validate(UI.draft), fld = t.closest('.fld');
  if (errs[k] && t.value) { if (!fld.classList.contains('err')) { fld.classList.add('err'); fld.insertAdjacentHTML('beforeend', `<div class="msg">${ic('alert')}${errs[k]}</div>`); } }
});
document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'dados-form') document.getElementById('confirm-btn')?.click(); if (e.target.id === 'pf-form') document.querySelector('[data-act="save-profile"]')?.click(); if (e.target.id === 'svc-form') document.querySelector('[data-act="svc-save"]')?.click(); });
// chart tooltips
const $tip = document.createElement('div');
$tip.style.cssText = 'position:fixed;z-index:95;pointer-events:none;background:#1d1b18;border:1px solid rgba(211,168,101,.4);color:#efe8dc;font-size:12.5px;padding:7px 10px;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;white-space:nowrap;font-variant-numeric:tabular-nums';
document.body.appendChild($tip);
document.addEventListener('pointermove', e => {
  const r = e.target.closest && e.target.closest('[data-tip]');
  if (!r) { $tip.style.display = 'none'; return; }
  $tip.textContent = r.dataset.tip; $tip.style.display = 'block';
  const w = $tip.offsetWidth; let x = e.clientX + 14; if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  $tip.style.left = x + 'px'; $tip.style.top = (e.clientY - 40) + 'px';
});
document.addEventListener('pointerleave', () => { $tip.style.display = 'none'; });

/* boot */
load();
if (UI.screen === 'confirmado' && !appt(UI.lastAppt)) UI.screen = 'home';
if (UI.screen === 'dados' && !UI.draft.time) UI.screen = UI.draft.serviceIds.length ? 'agendar' : 'servicos';
if (UI.screen === 'agendar' && !UI.draft.serviceIds.length) UI.screen = 'servicos';
UI.hl = null; UI.confirmAct = null;
render();
