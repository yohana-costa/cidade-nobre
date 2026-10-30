/* ============ render + events ============ */
const $app = document.getElementById('app');
const $layer = document.getElementById('layer');
const $toast = document.getElementById('toast');
let LAYER = null; // {kind, id, k}

const vBoot = () => `<div class="cx"><div class="scr pf"><div class="d-page"><div class="wrap auth-wrap" style="text-align:center">
  <img src="${A.crest}" alt="Cidade Nobre, Barbearia Premium" style="width:110px;height:auto;display:block;margin:0 auto">
  <div style="margin-top:22px">${DB.error ? vError(DB.error, '__boot') : vLoading('Carregando a Cidade Nobre…')}</div>
</div></div></div></div>`;

// Guarda o que a pessoa esta digitando quando a tela e redesenhada por uma resposta da API
// que chegou em segundo plano (senao o campo seria apagado no meio da digitacao).
function snapshotInputs() {
  const vals = {};
  document.querySelectorAll('#app input[id], #app select[id], #layer input[id], #layer select[id], #layer textarea[id]').forEach(el => { vals[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  const f = document.activeElement;
  return { vals, focus: f && f.id ? { id: f.id, s: f.selectionStart, e: f.selectionEnd } : null };
}
function restoreInputs(snap) {
  Object.entries(snap.vals).forEach(([id, v]) => { const el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else if (el.value !== v) el.value = v; });
  if (snap.focus) { const el = document.getElementById(snap.focus.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(snap.focus.s, snap.focus.e); } catch (e) { /* campo sem cursor */ } } }
}

function render(keepScroll, background) {
  const y = window.scrollY;
  const snap = background ? snapshotInputs() : null;
  document.body.classList.toggle('admin-on', UI.mode === 'admin' && !!STAFF && DB.loaded);
  $app.innerHTML = !DB.loaded ? vBoot() : UI.mode === 'admin' ? vAdmin() : vClient();
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  renderLayer();
  if (snap) restoreInputs(snap);
  if (UI.hl && !background) { const el = document.querySelector('.blk.hl, .ag-card.hl'); if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); setTimeout(() => { UI.hl = null; }, 3000); }
}
function go(screen, keep) { UI.screen = screen; UI.mode = 'client'; LAYER = null; saveUI(); render(keep); }
function toast(msg, icon = 'check') {
  $toast.innerHTML = `<div class="toast" role="status">${ic(icon)}<span>${esc(msg)}</span></div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $toast.innerHTML = ''; }, 4200);
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
  else if (L.kind === 'client') inner = vClientModal(L.id, L);
  else if (L.kind === 'svc-edit') inner = vSvcEdit(L.id, L);
  else if (L.kind === 'pro-edit') inner = vProEdit(L.id, L);
  else if (L.kind === 'new-appt') inner = vNewAppt(L);
  else if (L.kind === 'draft') inner = vDraftMsg(L.id, L.k);
  else inner = vSheet(L);
  const prevScroll = $layer.querySelector('.modal')?.scrollTop || 0;
  const wasOpen = !!$layer.innerHTML;
  $layer.className = `layer ${L.kind === 'menu' || L.kind === 'amenu' ? '' : 'sheet-l'}`;
  $layer.innerHTML = `<div class="scrim" data-act="close"></div>${inner}`;
  const m = $layer.querySelector('.modal'); if (m && (L.keep || wasOpen)) m.scrollTop = prevScroll;
  document.body.style.overflow = 'hidden';
  const f = $layer.querySelector('.x, [data-act="close"]:not(.scrim)'); if (f && !L.keep && !wasOpen) f.focus({ preventScroll: true });
}
function sheet(title, sub, body, foot) {
  return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh"><div class="modal-h"><div><h3 id="mh">${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-act="close" aria-label="Fechar">${ic('x')}</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
}
function vSheet(L) {
  if (L.kind === 'rule' && L.id === 'servico') return sheet('Serviços concluídos', 'Como funciona', `<div class="rules" style="grid-template-columns:1fr"><div class="rule">${ic('scissors')}<b>${DB.rules.perReal} ponto${DB.rules.perReal === 1 ? '' : 's'} para cada R$ 1 pago</b><small>Um atendimento de ${money(60)} gera ${60 * DB.rules.perReal} pontos.</small></div><div class="rule">${ic('clock')}<b>Crédito após a conclusão</b><small>Agendar não gera pontos. O crédito acontece quando a barbearia marca o atendimento como concluído, uma única vez por atendimento.</small></div><div class="rule">${ic('gift')}<b>${esc(DB.benefit.title)} com ${DB.benefit.cost} pontos</b><small>O resgate consome ${DB.benefit.cost} pontos e o desconto é aplicado no próximo atendimento.</small></div></div>`);
  if (L.kind === 'rule' && L.id === 'indicacao') return sheet('Indique e ganhe', 'Como funciona', `<div class="rules" style="grid-template-columns:1fr"><div class="rule">${ic('link')}<b>Compartilhe seu link</b><small>Copiar ou compartilhar o link não gera pontos.</small></div><div class="rule">${ic('userPlus')}<b>Seu amigo agenda e é atendido</b><small>A indicação fica pendente até o primeiro atendimento dele ser concluído.</small></div><div class="rule">${ic('crown')}<b>+${DB.rules.referral} pontos para você</b><small>Liberados automaticamente quando a barbearia conclui esse primeiro atendimento.</small></div></div>`);
  if (L.kind === 'move' && ME) {
    const m = ME.moves.find(x => x.id === L.id); if (!m) return '';
    let body = '';
    if (m.type === 'servico') { const a = ME.appts.find(x => x.id === m.apptId); body = a ? `<div class="det"><div class="full"><small>Atendimento</small><b>${esc(apptNames(a).join(' + '))}</b></div><div><small>Data</small><b>${fDM(a.date)} às ${a.time}</b></div><div><small>Profissional</small><b>${esc(proName(a.proId, ME.proNames))}</b></div><div><small>Valor pago</small><b>${money(paid(a))}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">+${m.points} pts</b></div></div>${a.discount ? `<div class="callout gold">${ic('gift')}<span>Benefício de ${money(a.discount)} aplicado neste atendimento.</span></div>` : ''}` : ''; }
    else if (m.type === 'indicacao') { const r = ME.referralsGiven.find(x => x.id === m.referralId); body = `<div class="det"><div><small>Amigo indicado</small><b>${esc(r ? ME.names[r.referredId] || '' : '')}</b></div><div><small>Pontos</small><b style="color:var(--gold-hi)">+${m.points} pts</b></div></div>`; }
    else { const v = ME.vouchers.find(x => x.id === m.voucherId); body = `<div class="det"><div><small>Benefício</small><b>${esc(v ? v.title : DB.benefit.title)}</b></div><div><small>Pontos</small><b>−${Math.abs(m.points)} pts</b></div>${v ? `<div class="full"><small>Situação</small><b>${v.status === 'utilizado' ? `Usado em ${fStamp(v.usedAt)}` : 'Aguardando o próximo atendimento'}</b></div>` : ''}</div>`; }
    return sheet((MOVE[m.type] || MOVE.ajuste)[0], fStamp(m.at), body);
  }
  if (L.kind === 'redeem') { const c = club(); return sheet(`Resgatar ${esc(DB.benefit.title)}?`, 'Clube Cidade Nobre', `<div class="det"><div><small>Saldo atual</small><b>${c.balance} pts</b></div><div><small>Saldo após o resgate</small><b>${c.balance - DB.benefit.cost} pts</b></div></div><div class="callout gold">${ic('info')}<span>O desconto fica disponível para o próximo atendimento e é aplicado quando a barbearia concluir esse atendimento.</span></div>`, `<button class="btn btn-ghost" data-act="close">Agora não</button><button class="btn btn-gold" data-act="redeem">Confirmar resgate</button>`); }
  if (L.kind === 'cancel' && ME) { const a = ME.appts.find(x => x.id === L.id); if (!a) return ''; return sheet('Cancelar este horário?', `${fDM(a.date)} às ${a.time} · ${esc(apptLabel(a))}`, `<p style="margin:0;color:var(--muted)">O horário volta a ficar livre na agenda da barbearia.</p>`, `<button class="btn btn-ghost" data-act="close">Manter horário</button><button class="btn btn-gold" data-act="cancel-appt" data-id="${a.id}">Cancelar horário</button>`); }
  if (L.kind === 'profile' && ME) { const c = ME.client; const e = L.errs || {}; const f = (id, l, t, v, x = '') => `<div class="fld ${e[id] ? 'err' : ''}"><label for="pf-${id}">${l}</label><input id="pf-${id}" type="${t}" value="${esc(v)}" ${x}>${e[id] ? `<div class="msg">${ic('alert')}${esc(e[id])}</div>` : ''}</div>`; return sheet('Editar meus dados', 'Usados nos seus agendamentos', `<form class="form" style="margin-top:0" id="pf-form" novalidate>${f('name', 'Nome', 'text', L.v?.name ?? c.name, 'autocomplete="name"')}${f('phone', 'Telefone (WhatsApp)', 'tel', L.v?.phone ?? c.phone, 'inputmode="numeric"')}${f('email', 'E-mail (opcional)', 'email', L.v?.email ?? c.email ?? '')}</form>`, `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="save-profile">Salvar</button>`); }
  if (L.kind === 'cpass') return sheet('Alterar senha', 'Conta do Clube Cidade Nobre', `<form class="form" style="margin-top:0" id="cp-form" novalidate><div class="fld"><label for="cp-cur">Senha atual</label><input id="cp-cur" type="password" autocomplete="current-password"></div><div class="fld"><label for="cp-new">Nova senha</label><input id="cp-new" type="password" autocomplete="new-password" placeholder="Mínimo de 6 caracteres"></div>${L.err ? `<div class="fld err"><div class="msg">${ic('alert')}${esc(L.err)}</div></div>` : ''}</form>`, `<button class="btn btn-ghost" data-act="close">Cancelar</button><button class="btn btn-gold" data-act="client-pass-save">Salvar</button>`);
  return '';
}

/* ---- sessão ---- */
async function loadStaff() {
  if (!API.token('staff')) { STAFF = null; return; }
  try { STAFF = await API.get('/auth/me', 'staff'); } catch (e) { if (e.status === 401) STAFF = null; }
}
function onSessionLost(kind) {
  if (kind === 'staff') { STAFF = null; Object.keys(CACHE).forEach(k => delete CACHE[k]); LAYER = null; toast('Sua sessão terminou. Entre novamente.', 'info'); }
  else { ME = null; dropCache('av:'); }
  setTimeout(() => render(true), 0);
}
function setMode(mode, push) {
  UI.mode = mode; LAYER = null;
  if (push) history.pushState(null, '', mode === 'admin' ? '/gestao' : '/');
  saveUI(); render();
}

/* ---- booking helpers ---- */
function startBooking() { if (UI.draft.editingId) UI.draft = emptyDraft(); go('servicos'); }
function editAppt(id) {
  const a = ME && ME.appts.find(x => x.id === id); if (!a) return;
  const c = ME.client;
  UI.draft = { ...emptyDraft(), serviceIds: a.serviceIds.filter(i => svc(i)), proId: a.chosenPro && pro(a.chosenPro) ? a.chosenPro : 'any', date: a.date, time: a.time, name: c.name, phone: c.phone, email: c.email || '', editingId: a.id, touched: true };
  go(UI.draft.serviceIds.length ? 'agendar' : 'servicos');
}
function readForm() {
  const d = UI.draft;
  const n = document.getElementById('in-name'), p = document.getElementById('in-phone'), e = document.getElementById('in-email'), s = document.getElementById('in-password');
  if (n) { d.name = n.value; d.phone = p.value; d.email = e.value; d.password = s ? s.value : ''; }
}
const val = id => (document.getElementById(id)?.value || '').trim();
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove(); return ok;
}
async function copyText(text, inputId) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (err) {
    if (legacyCopy(text)) return true;
    const el = inputId && document.getElementById(inputId); if (el) { el.focus(); el.select(); } return false;
  }
}
function busy(t, label) { if (!t) return () => {}; const html = t.innerHTML; t.disabled = true; t.innerHTML = `<span class="spin"></span> ${label}`; return () => { if (document.body.contains(t)) { t.disabled = false; t.innerHTML = html; } }; }
// depois de qualquer alteração na gestão: dados ficam "velhos" e recarregam em segundo plano
function adminChanged() { invalidate(); }

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-go]');
  if (!t) return;
  if (t.matches('[aria-disabled="true"]')) return;
  const act = t.dataset.act, D = t.dataset;
  if (D.go && !act) {
    e.preventDefault();
    if (D.go === 'agendar' && !UI.draft.serviceIds.length) { go('servicos'); toast('Escolha ao menos um serviço para ver os horários.', 'info'); return; }
    if (D.go === 'dados' && !UI.draft.time) { go('agendar'); return; }
    go(D.go); return;
  }
  try {
    switch (act) {
      case 'menu': openLayer({ kind: 'menu' }); break;
      case 'amenu': openLayer({ kind: 'amenu' }); break;
      case 'close': closeLayer(); break;
      case 'retry':
        if (D.k === '__boot') { DB.error = null; render(); await Promise.all([loadCatalog(), loadMe()]); render(); break; }
        invalidate(D.k); render(true); break;
      case 'to-admin': e.preventDefault(); await loadStaff(); setMode('admin', true); break;
      case 'to-site': e.preventDefault(); setMode('client', true); break;
      case 'start-booking': startBooking(); break;
      case 'scroll-exp': document.getElementById('experiencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'cat': UI.cat = D.cat; go('servicos'); break;
      case 'cat-filter': UI.cat = D.cat; saveUI(); render(true); break;
      case 'svc-toggle': { const ids = UI.draft.serviceIds; const i = ids.indexOf(D.id); i >= 0 ? ids.splice(i, 1) : ids.push(D.id); saveUI(); render(true); break; }
      case 'svc-continue': if (!UI.draft.serviceIds.length) { toast('Selecione ao menos um serviço.', 'info'); break; } go('agendar'); break;
      case 'pro': UI.draft.proId = D.id; saveUI(); render(true); break;
      case 'day': UI.draft.date = D.date; saveUI(); render(true); break;
      case 'slot': UI.draft.time = D.time; saveUI(); render(true); break;
      case 'to-dados': if (!UI.draft.time) { toast('Escolha um horário para continuar.', 'info'); break; } UI.formErrors = null; go('dados'); break;
      case 'clear-form': Object.assign(UI.draft, { name: '', phone: '', email: '', touched: true }); saveUI(); render(true); document.getElementById('in-name')?.focus(); break;
      case 'go-entrar': UI.afterLogin = 'dados'; UI.authErr = null; go('entrar'); break;
      case 'confirm-booking': {
        readForm();
        const errs = validate(UI.draft);
        UI.formErrors = errs;
        if (Object.keys(errs).length) { render(true); const f = document.querySelector('.fld.err input'); f?.focus(); f?.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Confira os campos destacados.', 'alert'); break; }
        const done = busy(t, 'Registrando…');
        const d = UI.draft;
        try {
          let res;
          if (d.editingId) {
            const appt = await API.put(`/conta/agendamentos/${d.editingId}`, { serviceIds: d.serviceIds, proId: d.proId, date: d.date, time: d.time }, 'client');
            res = { appt, account: 'logado', edited: true };
          } else {
            res = await API.post('/publico/agendamentos', { serviceIds: d.serviceIds, proId: d.proId, date: d.date, time: d.time, name: d.name.trim(), phone: d.phone, email: d.email.trim(), password: d.password || undefined, referralCode: UI.refCode || undefined }, 'client');
          }
          if (res.token) API.setToken('client', res.token);
          if (!d.editingId) UI.refCode = null;
          UI.lastBooking = { ...res, name: d.name.trim(), phone: fmtPhone(d.phone), email: d.email.trim() };
          UI.draft = emptyDraft(); UI.formErrors = null;
          dropCache('av:');
          await loadMe();
          go('confirmado');
        } catch (err) {
          done();
          toast(err.message, 'alert');
          if (err.status === 409 && /horário/i.test(err.message)) { dropCache('av:'); UI.draft.time = null; go('agendar'); }
        }
        break;
      }
      case 'edit-appt': editAppt(D.id); break;
      case 'hist-toggle': UI.histOpen = !UI.histOpen; saveUI(); render(true); break;
      case 'pf-more': UI.pfMore = !UI.pfMore; render(true); break;
      case 'rule': openLayer({ kind: 'rule', id: D.rule }); break;
      case 'move': openLayer({ kind: 'move', id: D.id }); break;
      case 'redeem-ask': openLayer({ kind: 'redeem' }); break;
      case 'redeem': {
        const done = busy(t, 'Resgatando…');
        try { await API.post('/conta/resgatar', {}, 'client'); await loadMe(); closeLayer(); render(true); toast(`Resgate registrado: ${DB.benefit.title} disponível para o próximo atendimento.`, 'gift'); }
        catch (err) { done(); toast(err.message, 'alert'); }
        break;
      }
      case 'copy-link': { const v = document.getElementById('ref-link').value; const ok = await copyText(v, 'ref-link'); toast(ok ? 'Link copiado. Os pontos entram depois do primeiro atendimento do seu amigo.' : 'Não foi possível copiar automaticamente. O link está selecionado para você copiar.', ok ? 'copy' : 'info'); break; }
      case 'share-wa': break;
      case 'share-native': {
        try { await navigator.share({ title: 'Cidade Nobre, Barbearia Premium', text: 'Agende pelo meu link de indicação:', url: document.getElementById('ref-link').value }); }
        catch (err) { if (!err || err.name !== 'AbortError') toast('Compartilhamento do sistema indisponível aqui. Use o botão do WhatsApp ou copie o link.', 'info'); }
        break;
      }
      case 'cancel-ask': openLayer({ kind: 'cancel', id: D.id }); break;
      case 'cancel-appt': {
        const done = busy(t, 'Cancelando…');
        try { await API.post(`/conta/agendamentos/${D.id}/cancelar`, {}, 'client'); dropCache('av:'); await loadMe(); closeLayer(); render(true); toast('Horário cancelado.', 'check'); }
        catch (err) { done(); toast(err.message, 'alert'); }
        break;
      }
      case 'edit-profile': openLayer({ kind: 'profile' }); break;
      case 'save-profile': {
        const v = { name: val('pf-name'), phone: val('pf-phone'), email: val('pf-email') };
        const errs = validate({ ...v, password: '' });
        if (Object.keys(errs).length) { openLayer({ kind: 'profile', errs, v }); break; }
        try { await API.put('/conta', v, 'client'); await loadMe(); closeLayer(); render(true); toast('Dados atualizados.'); }
        catch (err) { openLayer({ kind: 'profile', errs: { [/telefone/i.test(err.message) ? 'phone' : 'name']: err.message }, v }); }
        break;
      }
      case 'client-pass': openLayer({ kind: 'cpass' }); break;
      case 'client-pass-save': {
        try { await API.post('/conta/senha', { currentPassword: val('cp-cur'), newPassword: document.getElementById('cp-new').value }, 'client'); closeLayer(); toast('Senha alterada.'); }
        catch (err) { openLayer({ kind: 'cpass', err: err.message }); }
        break;
      }
      case 'auth-tab': UI.authTab = D.k; UI.authErr = null; UI.authPhone = val('en-phone'); render(true); break;
      case 'login-client':
      case 'first-access': {
        e.preventDefault();
        const phone = val('en-phone'), password = document.getElementById('en-pass')?.value || '';
        UI.authPhone = phone;
        const done = busy(t, 'Entrando…');
        try {
          const r = act === 'login-client' ? await API.post('/conta/entrar', { phone, password }) : await API.post('/conta/primeiro-acesso', { phone, code: val('en-code'), password });
          API.setToken('client', r.token); UI.authErr = null;
          await loadMe(); dropCache('av:');
          const next = UI.afterLogin || (UI.screen === 'entrar' ? 'perfil' : UI.screen); UI.afterLogin = null;
          if (next === 'dados') Object.assign(UI.draft, { name: '', phone: '', email: '', touched: false });
          go(next);
          toast(`Olá, ${firstName(ME.client.name)}!`, 'user');
        } catch (err) { done(); UI.authErr = err.message; render(true); }
        break;
      }
      case 'logout-client': API.setToken('client', ''); ME = null; dropCache('av:'); LAYER = null; UI.draft = emptyDraft(); go('home'); toast('Você saiu da sua conta.', 'info'); break;
      /* gestão */
      case 'login-staff': {
        e.preventDefault();
        const email = val('st-email'), senha = document.getElementById('st-pass')?.value || '';
        UI.staffEmail = email;
        const done = busy(t, 'Entrando…');
        try { const r = await API.post('/auth/login', { email, senha }); API.setToken('staff', r.token); STAFF = r.user; UI.staffErr = null; saveUI(); render(); }
        catch (err) { done(); UI.staffErr = err.message; render(true); }
        break;
      }
      case 'logout-staff': API.setToken('staff', ''); STAFF = null; Object.keys(CACHE).forEach(k => { if (!k.startsWith('av:')) delete CACHE[k]; }); LAYER = null; render(); break;
      case 'refresh-admin': adminChanged(); await loadCatalog(); render(true); toast('Dados atualizados.', 'refresh'); break;
      case 'anav': UI.admin = D.id; UI.mode = 'admin'; LAYER = null; saveUI(); render(); break;
      case 'period': UI.period = D.p; saveUI(); render(true); break;
      case 'ag-day': UI.agDate = addDays(UI.agDate || todayStr(), Number(D.n)); saveUI(); render(true); break;
      case 'ag-today': UI.agDate = todayStr(); saveUI(); render(true); break;
      case 'ag-pro': UI.agPro = D.p; saveUI(); render(true); break;
      case 'appt': openLayer({ kind: 'appt', id: D.id }); break;
      case 'ask': UI.confirmAct = { id: D.id, s: D.s }; LAYER.keep = true; renderLayer(); break;
      case 'ask-cancel': UI.confirmAct = null; renderLayer(); break;
      case 'st': {
        const done = busy(t, 'Salvando…');
        try {
          const res = await API.patch(`/gestao/agendamentos/${D.id}/status`, { status: D.s }, 'staff');
          UI.confirmAct = null;
          adminChanged();
          LAYER = { kind: 'appt', id: D.id, keep: true };
          render(true);
          if (D.s === 'concluido') {
            const parts = ['Atendimento concluído'];
            if (res.points) parts.push(`+${res.points} pts para o cliente`);
            if (res.voucher) parts.push(`benefício de ${money(res.voucher.value)} aplicado`);
            if (res.referral) parts.push(`+${res.referral.points} pts de indicação para ${firstName(res.referral.referrerName)}`);
            toast(parts.join(' · '), 'crown');
          } else toast(D.s === 'cancelado' ? 'Atendimento cancelado.' : D.s === 'confirmado' ? 'Presença confirmada.' : 'Atendimento reativado.');
        } catch (err) { done(); UI.confirmAct = null; renderLayer(); toast(err.message, 'alert'); }
        break;
      }
      case 'new-appt': openLayer({ kind: 'new-appt', v: {} }); break;
      case 'new-appt-save': {
        const v = { name: val('na-name'), phone: val('na-phone'), svc: [...document.querySelectorAll('input[name="na-svc"]:checked')].map(x => x.value), pro: val('na-pro'), date: val('na-date'), time: val('na-time'), note: val('na-note') };
        if (!v.svc.length) { openLayer({ kind: 'new-appt', v, err: 'Escolha ao menos um serviço.' }); break; }
        if (!v.time) { openLayer({ kind: 'new-appt', v, err: 'Informe o horário.' }); break; }
        const done = busy(t, 'Registrando…');
        try {
          const a = await API.post('/gestao/agendamentos', { name: v.name, phone: v.phone, serviceIds: v.svc, proId: v.pro, date: v.date, time: v.time, note: v.note || undefined }, 'staff');
          closeLayer(); adminChanged(); dropCache('av:');
          UI.admin = 'agenda'; UI.agDate = a.date; UI.hl = a.id; saveUI(); render(true);
          toast(`Atendimento registrado para ${fDM(a.date)} às ${a.time}.`, 'calendar');
        } catch (err) { done(); openLayer({ kind: 'new-appt', v, err: err.message }); }
        break;
      }
      case 'client': openLayer({ kind: 'client', id: D.id }); break;
      case 'access-code': {
        const done = busy(t, 'Gerando…');
        try { const r = await API.post(`/gestao/clientes/${D.id}/codigo-acesso`, {}, 'staff'); LAYER = { kind: 'client', id: D.id, code: r }; renderLayer(); }
        catch (err) { done(); toast(err.message, 'alert'); }
        break;
      }
      case 'cfilter': UI.clientFilter = D.k; saveUI(); render(true); break;
      case 'svctab': UI.svcTab = D.k; saveUI(); render(true); break;
      case 'svc-vis': {
        const K = CACHE['cat-gestao'].data; const s = K.services.find(x => x.id === D.id);
        try { await API.put(`/gestao/servicos/${s.id}`, { visible: !s.visible }, 'staff'); s.visible = !s.visible; adminChanged(); await loadCatalog(); UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i)); render(true); toast(s.visible ? `${s.name} voltou ao catálogo do cliente.` : `${s.name} foi ocultado do catálogo do cliente.`, 'eye'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'svc-new': openLayer({ kind: 'svc-edit', id: null }); break;
      case 'svc-edit': openLayer({ kind: 'svc-edit', id: D.id }); break;
      case 'svc-del-ask': LAYER.confirmDel = true; LAYER.keep = true; renderLayer(); break;
      case 'svc-del-cancel': LAYER.confirmDel = false; renderLayer(); break;
      case 'svc-save': {
        const v = { name: val('in-sname'), desc: val('in-sdesc'), cat: val('in-scat'), img: val('in-simg'), dur: Math.round(Number(val('in-dur'))), price: Math.round(Number(val('in-price')) * 100) / 100, visible: document.getElementById('in-svis').checked };
        if (!(v.dur >= 5 && v.dur <= 240) || !(v.price >= 0 && v.price <= 2000)) { openLayer({ kind: 'svc-edit', id: D.id || null, v, err: 'Use duração entre 5 e 240 min e preço entre R$ 0 e R$ 2.000.' }); break; }
        try {
          if (D.id) await API.put(`/gestao/servicos/${D.id}`, v, 'staff'); else await API.post('/gestao/servicos', { ...v, proIds: DB.pros.map(p => p.id) }, 'staff');
          closeLayer(); adminChanged(); await loadCatalog(); render(true); toast(`${v.name} salvo.`);
        } catch (err) { openLayer({ kind: 'svc-edit', id: D.id || null, v, err: err.message }); }
        break;
      }
      case 'svc-del': {
        try { await API.del(`/gestao/servicos/${D.id}`, 'staff'); closeLayer(); adminChanged(); await loadCatalog(); UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i)); render(true); toast('Serviço removido do catálogo.'); }
        catch (err) { LAYER.confirmDel = false; LAYER.err = err.message; renderLayer(); }
        break;
      }
      case 'pro-new': openLayer({ kind: 'pro-edit', id: null }); break;
      case 'pro-edit': openLayer({ kind: 'pro-edit', id: D.id }); break;
      case 'pro-save': {
        const v = { name: val('in-pname') };
        const boxes = document.querySelectorAll('input[name="pro-svc"]');
        if (boxes.length) v.services = [...boxes].filter(x => x.checked).map(x => x.value);
        try {
          if (D.id) await API.put(`/gestao/profissionais/${D.id}`, v, 'staff'); else await API.post('/gestao/profissionais', v, 'staff');
          closeLayer(); adminChanged(); await loadCatalog(); render(true); toast(`${v.name} salvo.`);
        } catch (err) { openLayer({ kind: 'pro-edit', id: D.id || null, v: { ...v, services: v.services || [] }, err: err.message }); }
        break;
      }
      case 'pro-del': {
        try { await API.del(`/gestao/profissionais/${D.id}`, 'staff'); closeLayer(); adminChanged(); await loadCatalog(); if (UI.agPro === D.id) UI.agPro = 'all'; render(true); toast('Profissional removido da equipe.'); }
        catch (err) { LAYER.confirmDel = false; LAYER.err = err.message; renderLayer(); }
        break;
      }
      case 'pro-svc': {
        const K = CACHE['cat-gestao'].data; const p = K.pros.find(x => x.id === D.p);
        const list = p.services.includes(D.s) ? p.services.filter(x => x !== D.s) : [...p.services, D.s];
        if (!list.length) { toast('Cada profissional precisa realizar ao menos um serviço.', 'info'); break; }
        try { await API.put(`/gestao/profissionais/${p.id}`, { services: list }, 'staff'); p.services = list; adminChanged(); await loadCatalog(); render(true); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'fidtab': UI.fidTab = D.k; saveUI(); render(true); break;
      case 'opp': { const inOpp = UI.admin === 'oportunidades'; UI.opp = D.k; UI.admin = 'oportunidades'; saveUI(); render(inOpp); break; }
      case 'draft-msg': openLayer({ kind: 'draft', id: D.id, k: D.k }); break;
      case 'copy-draft': { const ok = await copyText(document.getElementById('draft-txt').textContent); toast(ok ? 'Texto copiado. Nenhuma mensagem foi enviada.' : 'Selecione o texto para copiar.', ok ? 'copy' : 'info'); break; }
      case 'cfg-save': {
        e.preventDefault();
        const n = id => Number(val('cf-' + id));
        const body = {
          pointsPerReal: n('perReal'), referralBonus: n('referral'), redeemPoints: n('cost'), redeemValue: n('value'),
          openTime: val('cf-open'), closeTime: val('cf-close'),
          closedDays: [...document.querySelectorAll('input[name="cf-closed"]:checked')].map(x => Number(x.value)),
          slotTimes: val('cf-slots').split(/[,;\s]+/).filter(Boolean).map(s => s.replace(/^(\d):/, '0$1:')),
          lapseDays: n('lapse'), minAdvanceMin: n('advance'), bookingDays: n('days'), referralDomain: val('cf-domain'),
        };
        const done = busy(t, 'Salvando…');
        try { const c = await API.put('/gestao/configuracoes', body, 'staff'); CACHE.config = { data: c, at: Date.now() }; UI.cfgErr = null; adminChanged(); dropCache('av:'); await loadCatalog(); render(true); toast('Regras salvas. Já valem para o site e para a gestão.'); }
        catch (err) { done(); UI.cfgErr = err.message; render(true); }
        break;
      }
      case 'user-add': {
        e.preventDefault();
        try { await API.post('/usuarios', { nome: val('nu-nome'), email: val('nu-email'), senha: document.getElementById('nu-senha').value, perfil: val('nu-perfil') }, 'staff'); invalidate('usuarios'); render(true); toast('Acesso criado.'); ['nu-nome', 'nu-email', 'nu-senha'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'user-toggle': {
        try { await API.put(`/usuarios/${D.id}`, { ativo: D.on !== 'true' }, 'staff'); invalidate('usuarios'); render(true); toast(D.on === 'true' ? 'Acesso desativado.' : 'Acesso reativado.'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'pw-save': {
        e.preventDefault();
        try { await API.post('/usuarios/senha', { senhaAtual: document.getElementById('pw-cur').value, novaSenha: document.getElementById('pw-new').value }, 'staff'); document.getElementById('pw-cur').value = ''; document.getElementById('pw-new').value = ''; toast('Senha alterada.'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
    }
  } catch (err) {
    console.warn(err);
    toast(err.message || 'Algo deu errado. Tente de novo.', 'alert');
  }
});
// keyboard access for clickable table rows
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && LAYER) { closeLayer(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.click')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (['in-phone', 'pf-phone', 'en-phone', 'na-phone'].includes(t.id)) t.value = fmtPhone(t.value);
  if (['in-name', 'in-phone', 'in-email', 'in-password'].includes(t.id)) {
    UI.draft.touched = true; readForm(); saveUI();
    const fld = t.closest('.fld'); if (fld && fld.classList.contains('err')) { const errs = validate(UI.draft); const k = t.id.slice(3); if (!errs[k]) { fld.classList.remove('err'); fld.querySelector('.msg')?.remove(); if (UI.formErrors) delete UI.formErrors[k]; } }
    const pf = document.querySelector('.prefill'); if (pf) pf.remove();
  }
  if (t.id === 'client-q') { UI.clientQ = t.value; document.getElementById('client-results').innerHTML = vClientsList(); }
  if (t.name === 'na-svc' || t.name === 'pro-svc' || t.name === 'cf-closed') t.closest('.pchip')?.classList.toggle('on', t.checked);
});
document.addEventListener('change', async e => {
  if (e.target.id === 'client-sort') { UI.clientSort = e.target.value; saveUI(); document.getElementById('client-results').innerHTML = vClientsList(); }
  if (e.target.dataset.userPerfil) {
    try { await API.put(`/usuarios/${e.target.dataset.userPerfil}`, { perfil: e.target.value }, 'staff'); invalidate('usuarios'); render(true); toast('Perfil atualizado.'); }
    catch (err) { toast(err.message, 'alert'); invalidate('usuarios'); render(true); }
  }
});
document.addEventListener('focusout', e => {
  const t = e.target;
  if (!['in-name', 'in-phone', 'in-email', 'in-password'].includes(t.id)) return;
  if (!t.value && t.id !== 'in-email' && !UI.formErrors) return;
  const k = t.id.slice(3), errs = validate(UI.draft), fld = t.closest('.fld');
  if (errs[k] && t.value) { if (!fld.classList.contains('err')) { fld.classList.add('err'); fld.insertAdjacentHTML('beforeend', `<div class="msg">${ic('alert')}${errs[k]}</div>`); } }
});
const SUBMIT = { 'dados-form': '#confirm-btn', 'pf-form': '[data-act="save-profile"]', 'svc-form': '[data-act="svc-save"]', 'pro-form': '[data-act="pro-save"]', 'entrar-form': '#entrar-form .btn-gold', 'staff-form': '[data-act="login-staff"]', 'na-form': '[data-act="new-appt-save"]', 'cfg-form': '[data-act="cfg-save"]', 'pw-form': '[data-act="pw-save"]', 'user-form': '[data-act="user-add"]', 'cp-form': '[data-act="client-pass-save"]' };
document.addEventListener('submit', e => {
  e.preventDefault();
  const sel = SUBMIT[e.target.id];
  // botoes de envio dentro do proprio form ja disparam o clique; os de fora sao acionados aqui
  if (sel && !(e.submitter && e.submitter.matches(sel))) document.querySelector(sel)?.click();
});
window.addEventListener('popstate', () => { UI.mode = /^\/gestao/.test(location.pathname) ? 'admin' : 'client'; LAYER = null; render(); });
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
(async function boot() {
  loadUI();
  // link de indicação: /indique/CODIGO (ou ?indique=CODIGO) guarda o código para o primeiro agendamento
  const m = location.pathname.match(/^\/indique\/([A-Za-z0-9]{3,20})\/?$/) || location.search.match(/[?&]indique=([A-Za-z0-9]{3,20})/);
  let ref = null;
  if (m) { ref = m[1].toUpperCase(); UI.refCode = ref; UI.screen = 'home'; history.replaceState(null, '', '/'); }
  UI.mode = /^\/gestao/.test(location.pathname) ? 'admin' : 'client';
  UI.hl = null; UI.confirmAct = null; UI.staffErr = null; UI.authErr = null; UI.cfgErr = null;
  render();
  await Promise.all([loadCatalog(), loadMe(), UI.mode === 'admin' ? loadStaff() : Promise.resolve()]);
  if (UI.screen === 'confirmado' && !(UI.lastBooking && UI.lastBooking.appt)) UI.screen = 'home';
  UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i));
  if (UI.draft.editingId && !ME) UI.draft = emptyDraft();
  if (UI.screen === 'dados' && !UI.draft.time) UI.screen = UI.draft.serviceIds.length ? 'agendar' : 'servicos';
  if (UI.screen === 'agendar' && !UI.draft.serviceIds.length) UI.screen = 'servicos';
  saveUI();
  render();
  if (ref) {
    try { const r = await API.get(`/publico/indicacao/${encodeURIComponent(ref)}`); toast(`Você foi indicado por ${r.firstName}. Agende seu primeiro horário.`, 'userPlus'); }
    catch (e) { if (e.status === 404) { UI.refCode = null; saveUI(); } }
  }
})();
