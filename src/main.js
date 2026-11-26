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
  vitBars();
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
  else if (L.kind === 'cat-photo') inner = vCatPhoto(L.id, L);
  else if (L.kind === 'prod-edit') inner = vProdEdit(L.id, L);
  else if (L.kind === 'stk-move') inner = vStkMove(L);
  else if (L.kind === 'card-edit') inner = vCardEdit(L.id, L);
  else if (L.kind === 'pedido') inner = vPedido(L);
  else if (L.kind === 'bar') inner = vBarStatus();
  else if (L.kind === 'prod-view') inner = vProdView(L);
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

/* ---- fotos da gestão ---- */
const PHOTO_PATH = { svc: id => `/gestao/servicos/${id}/imagem`, pro: id => `/gestao/profissionais/${id}/foto`, prod: id => `/gestao/produtos/${id}/foto`, card: id => `/gestao/cardapio/${id}/foto`, cat: id => `/gestao/categorias/${id}/foto` };
// Recarrega o catálogo da gestão e o do site e redesenha o formulário aberto com a foto nova.
async function photoChanged(kind) {
  if (kind === 'prod') CACHE.estoque = { data: await API.get('/gestao/estoque', 'staff'), at: Date.now() };
  else if (kind === 'card') { CACHE.cardapio = { data: await API.get('/gestao/cardapio', 'staff'), at: Date.now() }; CARD = null; }
  else { CACHE['cat-gestao'] = { data: await API.get('/gestao/catalogo', 'staff'), at: Date.now() }; adminChanged(); await loadCatalog(); }
  if (LAYER) { LAYER.keep = true; LAYER.v = formSnapshot(); renderLayer(); }
  render(true);
}
const cardForm = () => ({ name: val('in-cdname'), cat: val('in-cdcat'), price: val('in-cdprice'), visible: !!document.getElementById('in-cdvis')?.checked });
const prodForm = () => ({ name: val('in-prname'), desc: val('in-prdesc'), price: val('in-prprice'), cost: val('in-prcost'), min: val('in-prmin'), qty: val('in-prqty'), shelf: val('in-prshelf') || 'casa', cat: val('in-prcat') });
// o que já foi digitado no formulário aberto (a foto vem do servidor)
function formSnapshot() {
  const g = id => document.getElementById(id);
  if (g('in-sname')) return { name: val('in-sname'), desc: val('in-sdesc'), cat: val('in-scat'), dur: Number(val('in-dur')), price: Number(val('in-price')), visible: g('in-svis').checked };
  if (g('in-pname')) return { name: val('in-pname') };
  if (g('in-prname')) return prodForm();
  if (g('in-cdname')) return cardForm();
  return null;
}

/* ---- pagamento online ---- */
// Consulta o agendamento na API (que confere o pagamento no Mercado Pago) e atualiza a tela de confirmação.
async function checkPayment(id) {
  const appt = await API.get(`/publico/agendamentos/${encodeURIComponent(id)}/pagamento`);
  const b = UI.lastBooking && UI.lastBooking.appt && UI.lastBooking.appt.id === id ? UI.lastBooking : { name: '', phone: '', email: '' };
  UI.lastBooking = { ...b, appt };
  dropCache('av:');
  await loadMe();
  saveUI();
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
      // cardapio do site (pedido fica so no aparelho)
      case 'cd-add': PED[D.id] = Math.min(20, (PED[D.id] || 0) + 1); pedSave(); if (LAYER) renderLayer(); else { render(true); toast('Adicionado ao seu pedido.', 'plus'); } break;
      case 'cd-dec': PED[D.id] = Math.max(0, (PED[D.id] || 0) - 1); if (!PED[D.id]) delete PED[D.id]; pedSave(); render(true); renderLayer(); break;
      case 'cd-clear': PED = {}; pedSave(); closeLayer(); render(true); break;
      case 'cd-send': {
        const items = pedItems().map(x => ({ id: x.it.id, qty: x.q }));
        LAYER.sending = true; LAYER.err = null; LAYER.keep = true; renderLayer();
        try {
          const b = await API.post('/publico/pedidos-bar', { name: PEDF.name, proId: PEDF.proId || null, note: PEDF.note, items }, ME ? 'client' : undefined);
          BAR = b; BAR_ID = b.id;
          try { sessionStorage.setItem(BAR_KEY, b.id); localStorage.setItem(BAR_NAME, PEDF.name); } catch (e) { /* */ }
          PED = {}; pedSave(); PEDF.note = '';
          if (b.payLink) { toast('Abrindo o pagamento…', 'clock'); location.href = b.payLink; break; }
          openLayer({ kind: 'bar' }); render(true); toast(`Pedido nº ${b.number} enviado. A equipe já recebeu.`, 'check');
        } catch (err) {
          if (err.status === 409) { CARD = null; await loadCardapio(); }
          if (LAYER) { LAYER.sending = false; LAYER.err = err.message; renderLayer(); }
        }
        break;
      }
      // produto da vitrine: abre a ficha e pede direto
      case 'prod-view': openLayer({ kind: 'prod-view', id: D.id, q: 1 }); break;
      case 'pv-inc': case 'pv-dec': {
        const p = vitFind(LAYER.id); if (!p) break;
        LAYER.q = Math.max(1, Math.min(Math.max(1, p.stock || 1), (LAYER.q || 1) + (act === 'pv-inc' ? 1 : -1))); LAYER.keep = true; renderLayer(); break;
      }
      case 'pv-send': {
        const p = vitFind(LAYER.id); if (!p) break;
        if (!String(PEDF.name || '').trim()) { LAYER.err = 'Informe seu nome para a equipe saber de quem é o pedido.'; LAYER.keep = true; renderLayer(); document.getElementById('ped-name')?.focus(); break; }
        LAYER.sending = true; LAYER.err = null; LAYER.keep = true; renderLayer();
        try {
          const b = await API.post('/publico/pedidos-bar', { name: PEDF.name, proId: PEDF.proId || null, note: '', items: [{ id: p.id, qty: LAYER.q || 1 }] }, ME ? 'client' : undefined);
          BAR = b; BAR_ID = b.id;
          try { sessionStorage.setItem(BAR_KEY, b.id); localStorage.setItem(BAR_NAME, PEDF.name); } catch (e) { /* */ }
          if (b.payLink) { toast('Abrindo o pagamento…', 'clock'); location.href = b.payLink; break; }
          openLayer({ kind: 'bar' }); render(true); toast(`Pedido nº ${b.number} enviado. A equipe já recebeu.`, 'check');
        } catch (err) {
          if (err.status === 409) { VIT = null; await loadVitrine(); render(true); }
          if (LAYER) { LAYER.sending = false; LAYER.err = err.message; renderLayer(); }
        }
        break;
      }
      case 'bar-open': await loadBar(); openLayer({ kind: 'bar' }); break;
      case 'bar-forget': BAR = null; BAR_ID = null; try { sessionStorage.removeItem(BAR_KEY); } catch (e) { /* */ } closeLayer(); render(true); break;
      case 'bar-st': {
        try {
          await API.put(`/gestao/pedidos-bar/${D.id}`, { status: D.st }, 'staff');
          CACHE['pedidos-bar'] = { data: await API.get('/gestao/pedidos-bar', 'staff'), at: Date.now() };
          invalidate('contadores'); render(true);
          toast(D.st === 'entregue' ? 'Pedido marcado como entregue.' : D.st === 'cancelado' ? 'Pedido cancelado.' : 'Pedido em preparo.', D.st === 'cancelado' ? 'x' : 'check');
        } catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'cdtab': UI.cdTab = D.k; render(true); break;
      case 'botab': UI.boTab = D.k; render(true); break;
      case 'cd-open': openLayer({ kind: 'pedido' }); break;
      case 'cd-retry': CARD_ERR = null; render(true); break;
      // cardapio na gestao
      case 'card-new': openLayer({ kind: 'card-edit', id: null }); break;
      case 'card-edit': openLayer({ kind: 'card-edit', id: D.id }); break;
      case 'card-save': {
        const v = cardForm();
        const pend = LAYER && LAYER.file ? { file: LAYER.file, preview: LAYER.preview } : {};
        try {
          const body = { name: v.name, cat: v.cat, price: Number(v.price) || 0, visible: v.visible };
          if (D.id) await API.put(`/gestao/cardapio/${D.id}`, body, 'staff');
          else { const it = await API.post('/gestao/cardapio', body, 'staff'); if (pend.file) await API.upload(PHOTO_PATH.card(it.id), pend.file, 'staff'); }
          closeLayer(); invalidate('cardapio'); CARD = null; render(true); toast(`${v.name} salvo no cardápio.`);
        } catch (err) { openLayer({ kind: 'card-edit', id: D.id || null, v, err: err.message, ...pend }); }
        break;
      }
      case 'card-del':
        try { await API.del(`/gestao/cardapio/${D.id}`, 'staff'); closeLayer(); invalidate('cardapio'); CARD = null; render(true); toast('Item apagado do cardápio.'); }
        catch (err) { LAYER.err = err.message; LAYER.confirmDel = false; renderLayer(); }
        break;
      case 'card-move':
        try { CACHE.cardapio = { data: await API.post(`/gestao/cardapio/${D.id}/mover`, { dir: D.dir }, 'staff'), at: Date.now() }; CARD = null; render(true); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      case 'card-vis': {
        const it = CACHE.cardapio && CACHE.cardapio.data.items.find(x => x.id === D.id); if (!it) break;
        try { await API.put(`/gestao/cardapio/${D.id}`, { visible: !it.visible }, 'staff'); it.visible = !it.visible; CARD = null; render(true); toast(it.visible ? `${it.name} voltou ao cardápio do site.` : `${it.name} foi escondido do site.`); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'vit-shelf': VIT_SHELF = D.shelf; VIT_SUB = 'all'; render(true); document.querySelector('.vit-chips')?.scrollTo({ left: 0 }); break;
      case 'catalogo': CATG_SUB = 'all'; go('catalogo'); window.scrollTo(0, 0); break;
      case 'catalogo-back': go('home'); requestAnimationFrame(() => document.querySelector('.vit')?.scrollIntoView({ block: 'start' })); break;
      case 'catg-shelf': VIT_SHELF = D.shelf; VIT_SUB = 'all'; CATG_SUB = 'all'; render(true); break;
      case 'catg-sub': {
        const x = document.querySelector('.vit-chips')?.scrollLeft || 0;
        CATG_SUB = D.sub; render(true);
        const row = document.querySelector('.vit-chips'); if (row) row.scrollLeft = x;
        document.querySelector('.catg-top')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        break;
      }
      case 'vit-sub': {
        // esteira de chips: guarda a rolagem e deixa o chip escolhido visivel depois de redesenhar
        const x = document.querySelector('.vit-chips')?.scrollLeft || 0;
        VIT_SUB = D.sub; render(true);
        const row = document.querySelector('.vit-chips'), on = row && row.querySelector('.vit-chip.on');
        if (row) {
          row.scrollLeft = x;
          if (on) { const r = row.getBoundingClientRect(), c = on.getBoundingClientRect(); if (c.left < r.left || c.right > r.right) row.scrollBy({ left: c.left - r.left - 16, behavior: 'smooth' }); }
        }
        break;
      }
      case 'scroll-exp': document.getElementById('experiencia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'cat': UI.cat = D.cat; go('servicos'); break;
      case 'cat-filter': UI.cat = D.cat; saveUI(); render(true); break;
      case 'svc-toggle': { const ids = UI.draft.serviceIds; const i = ids.indexOf(D.id); i >= 0 ? ids.splice(i, 1) : ids.push(D.id); saveUI(); render(true); break; }
      case 'svc-continue': if (!UI.draft.serviceIds.length) { toast('Selecione ao menos um serviço.', 'info'); break; } go('agendar'); break;
      case 'pro': UI.draft.proId = D.id; if (UI.draft.customTime) { UI.draft.time = null; UI.draft.customTime = false; } UI.ctimeRes = null; saveUI(); render(true); break;
      case 'day': UI.draft.date = D.date; if (UI.draft.customTime) { UI.draft.time = null; UI.draft.customTime = false; } UI.ctimeRes = null; saveUI(); render(true); break;
      case 'slot': UI.draft.time = D.time; UI.draft.customTime = false; UI.ctimeRes = null; saveUI(); render(true); break;
      case 'slot-custom': {
        // horário quebrado: a API confere se o barbeiro está livre pelo tempo todo do serviço
        const d = UI.draft, tm = D.time || val('in-ctime');
        const key = availKey(d);
        if (!/^\d{2}:\d{2}$/.test(tm || '')) { UI.ctimeRes = { ok: false, reason: 'Digite a hora de início, por exemplo 13:34.', date: d.date, key }; render(true); break; }
        t.disabled = true;
        try {
          const r = await API.get(`/publico/disponibilidade/horario?serviceIds=${encodeURIComponent(d.serviceIds.join(','))}&proId=${encodeURIComponent(d.proId)}&date=${d.date}&time=${tm}${d.editingId ? `&ignore=${encodeURIComponent(d.editingId)}` : ''}`, 'client');
          UI.ctimeRes = { ...r, time: tm, date: d.date, key };
          if (r.ok) { d.time = tm; d.customTime = true; }
        } catch (err) { UI.ctimeRes = { ok: false, reason: err.message, time: tm, date: d.date, key }; }
        saveUI(); render(true);
        break;
      }
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
          UI.lastBooking = { appt: res.appt, account: res.account, passwordIgnored: res.passwordIgnored, edited: res.edited, name: d.name.trim(), phone: fmtPhone(d.phone), email: d.email.trim() };
          UI.draft = emptyDraft(); UI.formErrors = null;
          dropCache('av:');
          // pagamento online: segue para o Mercado Pago; a volta cai em /?pagamento=<id>
          if (!d.editingId && res.appt.payment && res.appt.payment.status === 'pendente' && res.appt.payment.link) { UI.screen = 'confirmado'; saveUI(); location.href = res.appt.payment.link; break; }
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
      case 'pay-check': {
        const done = busy(t, 'Consultando…');
        try { await checkPayment(D.id); done(); render(true); const p = UI.lastBooking.appt.payment; toast(p && p.status === 'pago' ? 'Pagamento aprovado. Horário garantido.' : 'Ainda não recebemos a confirmação do pagamento. Pode levar alguns instantes.', p && p.status === 'pago' ? 'check' : 'info'); }
        catch (err) { done(); toast(err.message, 'alert'); }
        break;
      }
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
        const pend = LAYER && LAYER.file ? { file: LAYER.file, preview: LAYER.preview } : {};
        try {
          if (D.id) await API.put(`/gestao/servicos/${D.id}`, v, 'staff');
          else { const s = await API.post('/gestao/servicos', { ...v, proIds: DB.pros.map(p => p.id) }, 'staff'); if (pend.file) await API.upload(`/gestao/servicos/${s.id}/imagem`, pend.file, 'staff'); }
          closeLayer(); adminChanged(); await loadCatalog(); render(true); toast(`${v.name} salvo.`);
        } catch (err) { openLayer({ kind: 'svc-edit', id: D.id || null, v, err: err.message, ...pend }); }
        break;
      }
      case 'svc-del': {
        try { await API.del(`/gestao/servicos/${D.id}`, 'staff'); closeLayer(); adminChanged(); await loadCatalog(); UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i)); render(true); toast('Serviço removido do catálogo.'); }
        catch (err) { LAYER.confirmDel = false; LAYER.err = err.message; renderLayer(); }
        break;
      }
      case 'photo-rm': {
        // ainda nao salvo: so descarta a foto escolhida
        if (!D.id) { if (LAYER.preview) URL.revokeObjectURL(LAYER.preview); LAYER.file = null; LAYER.preview = null; LAYER.keep = true; renderLayer(); break; }
        try { await API.del(PHOTO_PATH[D.k](D.id), 'staff'); await photoChanged(D.k); toast('Foto removida.'); }
        catch (err) { LAYER.err = err.message; renderLayer(); }
        break;
      }
      case 'cat-photo': openLayer({ kind: 'cat-photo', id: D.id }); break;
      case 'pro-new': openLayer({ kind: 'pro-edit', id: null }); break;
      case 'pro-edit': openLayer({ kind: 'pro-edit', id: D.id }); break;
      case 'pro-save': {
        const v = { name: val('in-pname'), daysOff: [...document.querySelectorAll('input[name="pro-off"]')].filter(x => x.checked).map(x => Number(x.value)) };
        const boxes = document.querySelectorAll('input[name="pro-svc"]');
        if (boxes.length) v.services = [...boxes].filter(x => x.checked).map(x => x.value);
        const pend = LAYER && LAYER.file ? { file: LAYER.file, preview: LAYER.preview } : {};
        try {
          if (D.id) await API.put(`/gestao/profissionais/${D.id}`, v, 'staff');
          else { const p = await API.post('/gestao/profissionais', v, 'staff'); if (pend.file) await API.upload(`/gestao/profissionais/${p.id}/foto`, pend.file, 'staff'); }
          closeLayer(); adminChanged(); await loadCatalog(); render(true); toast(`${v.name} salvo.`);
        } catch (err) { openLayer({ kind: 'pro-edit', id: D.id || null, v: { ...v, services: v.services || (D.id ? undefined : []) }, err: err.message, ...pend }); }
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
      case 'stktab': UI.stkTab = D.k; saveUI(); render(true); break;
      case 'stksit': UI.stkSit = D.k; saveUI(); render(true); break;
      case 'prod-new': openLayer({ kind: 'prod-edit', id: null }); break;
      case 'prod-edit': openLayer({ kind: 'prod-edit', id: D.id }); break;
      case 'prod-save': {
        const v = prodForm();
        const pend = LAYER && LAYER.file ? { file: LAYER.file, preview: LAYER.preview } : {};
        const qty = Number(v.qty);
        if (String(v.qty).trim() === '' || !Number.isInteger(qty) || qty < 0 || qty > 99999) { openLayer({ kind: 'prod-edit', id: D.id || null, v, err: 'Informe a quantidade em estoque (número inteiro, 0 ou mais).', ...pend }); break; }
        try {
          const body = { name: v.name, desc: v.desc, price: Number(v.price) || 0, cost: Number(v.cost) || 0, min: Math.round(Number(v.min) || 0), shelf: v.shelf, cat: v.cat };
          if (D.id) {
            await API.put(`/gestao/produtos/${D.id}`, body, 'staff');
            // quantidade editada aqui vira um ajuste de contagem, para o histórico de movimentos continuar certo
            const atual = CACHE.estoque && CACHE.estoque.data && CACHE.estoque.data.products.find(x => x.id === D.id);
            if (!atual || atual.qty !== qty) await API.post(`/gestao/produtos/${D.id}/movimentos`, { type: 'ajuste', count: qty, reason: 'Ajustado na edição do produto' }, 'staff');
          }
          else { const p = await API.post('/gestao/produtos', { ...body, qty: Math.round(Number(v.qty) || 0) }, 'staff'); if (pend.file) await API.upload(PHOTO_PATH.prod(p.id), pend.file, 'staff'); }
          closeLayer(); invalidate('estoque', 'contadores'); render(true); toast(`${v.name} salvo.`);
        } catch (err) { openLayer({ kind: 'prod-edit', id: D.id || null, v, err: err.message, ...pend }); }
        break;
      }
      case 'prod-del': {
        try { await API.del(`/gestao/produtos/${D.id}`, 'staff'); closeLayer(); invalidate('estoque', 'contadores'); render(true); toast('Produto removido do estoque.'); }
        catch (err) { LAYER.confirmDel = false; LAYER.err = err.message; renderLayer(); }
        break;
      }
      case 'stk-move': openLayer({ kind: 'stk-move', id: D.id, t: D.t }); break;
      case 'stk-save': {
        const n = Math.round(Number(val('in-stkqty')));
        const reason = val('in-stkwhy') || undefined;
        const body = D.t === 'ajuste' ? { type: 'ajuste', count: n, reason } : { type: D.t, qty: n, reason, ...(D.t === 'venda' ? { value: Number(val('in-stkval')) || 0 } : {}) };
        const v = { qty: val('in-stkqty'), value: val('in-stkval'), reason: val('in-stkwhy') };
        if (!Number.isFinite(n) || n < (D.t === 'ajuste' ? 0 : 1)) { LAYER.v = v; LAYER.err = D.t === 'ajuste' ? 'Informe quantas unidades tem.' : 'Informe ao menos 1 unidade.'; LAYER.keep = true; renderLayer(); break; }
        const done = busy(t, 'Salvando…');
        try {
          const p = await API.post(`/gestao/produtos/${D.id}/movimentos`, body, 'staff');
          closeLayer(); invalidate('estoque', 'contadores'); render(true);
          toast(D.t === 'venda' ? `Venda registrada. Restam ${p.qty} de ${p.name}.` : D.t === 'entrada' ? `Entrada registrada. Agora são ${p.qty} de ${p.name}.` : `Contagem salva: ${p.qty} de ${p.name}.`);
        } catch (err) { done(); LAYER.v = v; LAYER.err = err.message; LAYER.keep = true; renderLayer(); }
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
      case 'mp-connect': {
        const done = busy(t, 'Abrindo o Mercado Pago…');
        try { const r = await API.get('/gestao/mercado-pago/conectar', 'staff'); location.href = r.url; }
        catch (err) { done(); toast(err.message, 'alert'); }
        break;
      }
      case 'mp-disconnect-ask': UI.mpAsk = true; render(true); break;
      case 'mp-disconnect-cancel': UI.mpAsk = false; render(true); break;
      case 'mp-disconnect': {
        UI.mpAsk = false;
        try { CACHE.mp = { data: await API.post('/gestao/mercado-pago/desconectar', {}, 'staff'), at: Date.now() }; await loadCatalog(); render(true); toast('Mercado Pago desconectado. Os agendamentos do site voltam a ser pagos na barbearia.', 'info'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'mp-toggle': {
        try { CACHE.mp = { data: await API.put('/gestao/mercado-pago', { cobrarOnline: D.on !== 'true' }, 'staff'), at: Date.now() }; await loadCatalog(); render(true); toast(D.on === 'true' ? 'Cobrança online desligada: o cliente paga na barbearia.' : 'Cobrança online ligada: o cliente paga ao agendar.'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
      case 'pw-save': {
        e.preventDefault();
        // sem a confirmacao, um erro de digitacao trancava a gestao com uma senha que ninguem sabe
        if (document.getElementById('pw-new').value !== document.getElementById('pw-new2').value) { toast('As duas novas senhas não são iguais. Digite de novo.', 'alert'); break; }
        try { await API.post('/usuarios/senha', { senhaAtual: document.getElementById('pw-cur').value, novaSenha: document.getElementById('pw-new').value }, 'staff'); ['pw-cur', 'pw-new', 'pw-new2'].forEach(k => { document.getElementById(k).value = ''; }); toast('Senha alterada. Use a nova senha no próximo login.'); }
        catch (err) { toast(err.message, 'alert'); }
        break;
      }
    }
  } catch (err) {
    console.warn(err);
    toast(err.message || 'Algo deu errado. Tente de novo.', 'alert');
  }
});
// O catalogo so vinha na abertura: quem deixava o site aberto no celular nao via foto, preco
// ou servico novo da gestao. Ao voltar para a aba, busca de novo (no maximo a cada 30 s).
let catalogAt = Date.now();
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || LAYER || Date.now() - catalogAt < 30000) return;
  catalogAt = Date.now();
  if (CARD) CARD = null;
  await Promise.all([loadCatalog(), loadVitrine(), UI.screen === 'cardapio' ? loadCardapio() : null, UI.screen === 'cardapio' ? loadBar() : null]);
  UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i));
  if (!LAYER) render(true, true);
});
// keyboard access for clickable table rows
// Acompanhamento ao vivo:
// - cliente com pedido aberto na tela Cardápio vê o status mudar (a cada 15 s);
// - equipe na gestão recebe aviso de pedido novo (a cada 20 s).
setInterval(async () => {
  if (document.hidden || UI.mode !== 'client' || UI.screen !== 'cardapio' || !barOpen()) return;
  if (await loadBar()) { if (LAYER && LAYER.kind === 'bar') renderLayer(); if (!LAYER) render(true, true); else { const y = window.scrollY; render(true, true); window.scrollTo(0, y); } }
}, 15000);
function bip() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [0, .18].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.12, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .15); o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + .16); }); } catch (e) { /* sem som */ }
}
setInterval(async () => {
  if (document.hidden || UI.mode !== 'admin' || !STAFF) return;
  try {
    const c = await API.get('/gestao/contadores', 'staff');
    const prev = CACHE.contadores && CACHE.contadores.data ? CACHE.contadores.data.barOpen : undefined;
    CACHE.contadores = Object.assign(CACHE.contadores || {}, { data: c, at: Date.now(), stale: false, path: '/gestao/contadores', auth: 'staff' });
    if (c.barOpen === prev) return;
    invalidate('pedidos-bar');
    if (prev !== undefined && c.barOpen > prev) { toast('Novo pedido de bebida no cardápio.', 'glass'); bip(); }
    if (!LAYER) render(true, true);
  } catch (e) { /* tenta de novo no proximo ciclo */ }
}, 20000);
document.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('vit-track')) vitBars(); }, true);
window.addEventListener('resize', vitBars);
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
  if (t.id === 'ped-name') PEDF.name = t.value;
  if (t.id === 'ped-note') PEDF.note = t.value;
  if (t.id === 'ped-pro') PEDF.proId = t.value;
  if (t.id === 'stk-q') { UI.stkQ = t.value; const E = CACHE.estoque && CACHE.estoque.data; if (E) document.getElementById('stk-results').innerHTML = vStockList(E); }
  if (t.id === 'in-stkqty' && t.dataset.price && document.getElementById('in-stkval')) document.getElementById('in-stkval').value = Math.round((Number(t.value) || 0) * Number(t.dataset.price) * 100) / 100;
  if (t.id === 'client-q') { UI.clientQ = t.value; document.getElementById('client-results').innerHTML = vClientsList(); }
  if (t.name === 'na-svc' || t.name === 'pro-svc' || t.name === 'cf-closed') t.closest('.pchip')?.classList.toggle('on', t.checked);
});
document.addEventListener('change', async e => {
  // foto de servico ou profissional (gestao)
  if (e.target.dataset.up && e.target.files && e.target.files[0] && LAYER) {
    const el = e.target, kind = el.dataset.up, id = el.dataset.id;
    try {
      const file = await reduzirImagem(el.files[0]);
      if (file.size > 5 * 1024 * 1024) throw new Error('A imagem continua grande demais (limite de 5 MB).');
      // cadastro novo: guarda a foto para enviar ao salvar, sem perder o que ja foi digitado
      if (!id) { if (LAYER.preview) URL.revokeObjectURL(LAYER.preview); Object.assign(LAYER, { file, preview: URL.createObjectURL(file), keep: true, err: null, v: { ...LAYER.v, ...formSnapshot() } }); renderLayer(); return; }
      LAYER.err = null; toast('Enviando foto…', 'info');
      await API.upload(PHOTO_PATH[kind](id), file, 'staff');
      await photoChanged(kind); toast(kind === 'prod' ? 'Foto atualizada.' : 'Foto atualizada. Já aparece no site.');
    } catch (err) { el.value = ''; LAYER.err = err.message; LAYER.keep = true; renderLayer(); }
    return;
  }
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
const SUBMIT = { 'dados-form': '#confirm-btn', 'pf-form': '[data-act="save-profile"]', 'svc-form': '[data-act="svc-save"]', 'pro-form': '[data-act="pro-save"]', 'entrar-form': '#entrar-form .btn-gold', 'staff-form': '[data-act="login-staff"]', 'na-form': '[data-act="new-appt-save"]', 'cfg-form': '[data-act="cfg-save"]', 'pw-form': '[data-act="pw-save"]', 'user-form': '[data-act="user-add"]', 'cp-form': '[data-act="client-pass-save"]', 'prod-form': '[data-act="prod-save"]', 'stk-form': '[data-act="stk-save"]', 'card-form': '[data-act="card-save"]', 'ped-form': '[data-act="cd-send"]', 'pv-form': '[data-act="pv-send"]' };
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
  // volta do pagamento do pedido: /cardapio?pedido=<id>
  const pedVolta = location.search.match(/[?&]pedido=([0-9a-f-]{36})/i);
  if (pedVolta) { BAR_ID = pedVolta[1]; try { sessionStorage.setItem(BAR_KEY, BAR_ID); } catch (e) { /* */ } }
  // QR Code da mesa: /cardapio (ou ?cardapio) abre direto no cardápio
  if (/^\/cardapio\/?$/.test(location.pathname) || /[?&]cardapio(=|&|$)/.test(location.search)) {
    UI.mode = 'client'; UI.screen = 'cardapio'; LAYER = null; history.replaceState(null, '', '/');
  }
  // volta do Mercado Pago (/?pagamento=<id>) e volta do "Conectar Mercado Pago" (/gestao?mp=ok|erro)
  const pg = location.search.match(/[?&]pagamento=([0-9a-f-]{36})/i);
  const mpVolta = location.search.match(/[?&]mp=(ok|erro)/);
  if (pg || mpVolta) history.replaceState(null, '', location.pathname);
  if (mpVolta) UI.admin = 'config';
  UI.hl = null; UI.confirmAct = null; UI.staffErr = null; UI.authErr = null; UI.cfgErr = null;
  render();
  // a vitrine chega depois e redesenha o inicio sem travar a abertura do site
  const vit = loadVitrine();
  const barP = loadBar().then(ch => { if (!pedVolta && ch && UI.mode === 'client' && UI.screen === 'cardapio' && !LAYER) render(true, true); });
  await Promise.all([loadCatalog(), loadMe(), UI.mode === 'admin' ? loadStaff() : Promise.resolve()]);
  if (pg) {
    try { await checkPayment(pg[1]); UI.screen = 'confirmado'; UI.mode = 'client'; }
    catch (e) { toast(e.message, 'alert'); }
  }
  if (mpVolta) toast(mpVolta[1] === 'ok' ? 'Mercado Pago conectado. Os agendamentos do site já podem ser pagos online.' : 'Não foi possível conectar o Mercado Pago. Tente de novo.', mpVolta[1] === 'ok' ? 'check' : 'alert');
  if (UI.screen === 'confirmado' && !(UI.lastBooking && UI.lastBooking.appt)) UI.screen = 'home';
  UI.draft.serviceIds = UI.draft.serviceIds.filter(i => svc(i));
  if (UI.draft.editingId && !ME) UI.draft = emptyDraft();
  if (UI.screen === 'dados' && !UI.draft.time) UI.screen = UI.draft.serviceIds.length ? 'agendar' : 'servicos';
  if (UI.screen === 'agendar' && !UI.draft.serviceIds.length) UI.screen = 'servicos';
  saveUI();
  render();
  if (pedVolta) {
    await barP;
    if (BAR) { openLayer({ kind: 'bar' }); if (BAR.payStatus === 'pago') toast(`Pagamento aprovado. Pedido nº ${BAR.number} enviado para a equipe.`, 'check'); }
  }
  vit.then(() => { if (UI.mode === 'client' && UI.screen === 'home' && !LAYER && DB.loaded) render(true, true); });
  if (ref) {
    try { const r = await API.get(`/publico/indicacao/${encodeURIComponent(ref)}`); toast(`Você foi indicado por ${r.firstName}. Agende seu primeiro horário.`, 'userPlus'); }
    catch (e) { if (e.status === 404) { UI.refCode = null; saveUI(); } }
  }
})();
