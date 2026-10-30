/* ============ utils ============ */
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
// "hoje" vem do servidor (fuso da barbearia); o relogio local so cobre a diferenca desde o carregamento
let SERVER_TODAY = null;
const todayStr = () => SERVER_TODAY || dstr(new Date());
const dow = s => parseD(s).getDay();
const tmin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const tstr = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const diffDays = (a, b) => Math.round((parseD(a) - parseD(b)) / 86400000);
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WDL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fDM = s => { const d = parseD(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const fLong = s => { const d = parseD(s); return `${d.getDate()} de ${MES[d.getMonth()]} de ${d.getFullYear()}`; };
const fDayLong = s => { const d = parseD(s); return `${WDL[d.getDay()]}, ${d.getDate()} de ${MESL[d.getMonth()]}`; };
const fMonthYear = s => { const d = parseD(s); return `${MESL[d.getMonth()]} de ${d.getFullYear()}`; };
const fRel = s => { const n = diffDays(s, todayStr()); if (n === 0) return 'Hoje'; if (n === 1) return 'Amanhã'; if (n === -1) return 'Ontem'; return n < 0 ? `há ${-n} dias` : `em ${n} dias`; };
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const money = v => BRL.format(v);
const money0 = v => BRL0.format(Math.round(v));
const num = v => new Intl.NumberFormat('pt-BR').format(v);
const pct = v => `${Math.round(v * 100)}%`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const firstName = n => String(n || '').split(/\s+/)[0];
const shortName = n => { const p = String(n || '').split(/\s+/).filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : (p[0] || ''); };
const onlyDigits = s => String(s || '').replace(/\D/g, '');
const fmtPhone = s => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/* ============ regras vindas do servidor (Gestão > Configurações) ============ */
let OPEN = tmin('09:00'), CLOSE = tmin('19:00'), DAY_CAP = CLOSE - OPEN;
let SLOT_TIMES = [], LAPSE_DAYS = 45, CLOSED_DAYS = [0];
const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };
const isOpen = s => !CLOSED_DAYS.includes(dow(s));

// DB: catalogo publico (servicos, categorias, profissionais e regras). Dados de clientes
// nunca ficam aqui: o cliente le so a propria conta (ME) e a equipe le pela API da gestao.
const DB = { loaded: false, error: null, services: [], categories: [], pros: [], benefit: { title: '', cost: 250, value: 20 }, rules: { perReal: 1, referral: 50 }, settings: {} };
let ME = null;      // conta do cliente logado (GET /api/conta)
let STAFF = null;   // usuario da equipe logado (GET /api/auth/me)
let UI, VER = 0;

function applyCatalog(c) {
  const s = c.settings;
  SERVER_TODAY = c.today;
  OPEN = tmin(s.openTime); CLOSE = tmin(s.closeTime); DAY_CAP = CLOSE - OPEN;
  SLOT_TIMES = s.slotTimes; LAPSE_DAYS = s.lapseDays; CLOSED_DAYS = s.closedDays;
  Object.assign(DB, {
    loaded: true, error: null, settings: s, services: c.services, categories: c.categories, pros: c.pros,
    benefit: { title: s.benefitTitle, cost: s.redeemPoints, value: s.redeemValue },
    rules: { perReal: s.pointsPerReal, referral: s.referralBonus },
  });
  VER++;
}
async function loadCatalog() {
  try { applyCatalog(await API.get('/publico/catalogo')); }
  catch (e) { DB.error = e.message; }
}
async function loadMe() {
  if (!API.token('client')) { ME = null; return; }
  try { ME = await API.get('/conta', 'client'); if (ME.today) SERVER_TODAY = ME.today; }
  catch (e) { if (e.status === 401) ME = null; }
  VER++;
}

/* ============ estado da tela (só preferências de navegação no navegador) ============ */
const UIKEY = 'cn-ui-v5';
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponivel: segue em memoria */ } },
};
function defaultUI() {
  return { mode: 'client', screen: 'home', cat: 'todos', draft: emptyDraft(), lastBooking: null, histOpen: false, admin: 'dash', period: '7', agDate: null, agPro: 'all', clientQ: '', clientSort: 'recent', clientFilter: 'all', fidTab: 'saldos', svcTab: 'servicos', opp: 'lapsed', hl: null, refCode: null, authTab: 'entrar' };
}
function emptyDraft() { return { serviceIds: [], proId: 'any', date: null, time: null, name: '', phone: '', email: '', password: '', editingId: null, touched: false }; }
function loadUI() {
  UI = Object.assign(defaultUI(), store.get(UIKEY) || {});
  UI.draft = Object.assign(emptyDraft(), UI.draft || {}, { password: '' });
}
function saveUI() { const { draft, ...rest } = UI; store.set(UIKEY, { ...rest, draft: { ...draft, password: '' } }); }

/* ============ cache de leituras da API (telas pedem, a resposta redesenha) ============ */
// need(chave, caminho, auth) devolve os dados ja carregados ou undefined (e dispara a busca).
// Dados "velhos" (invalidate) continuam na tela enquanto a versao nova chega.
const CACHE = {};
function need(key, path, auth, ttl) {
  let e = CACHE[key];
  const old = e && ttl && e.at && Date.now() - e.at > ttl;
  if (!e || ((e.stale || old) && !e.loading)) {
    e = CACHE[key] = Object.assign(e || {}, { loading: true, path, auth });
    API.get(path, auth)
      .then(d => { Object.assign(e, { data: d, err: null, stale: false, at: Date.now() }); if (d && d.today) SERVER_TODAY = d.today; })
      .catch(err => { Object.assign(e, { err: err.message, stale: false, at: Date.now() }); })
      .finally(() => { e.loading = false; VER++; if (typeof render === 'function') render(true, true); });
  }
  return e.data;
}
const needErr = key => CACHE[key] && CACHE[key].err && !CACHE[key].data ? CACHE[key].err : null;
function invalidate(...prefixes) { Object.keys(CACHE).forEach(k => { if (!prefixes.length || prefixes.some(p => k.startsWith(p))) CACHE[k].stale = true; }); }
function dropCache(...prefixes) { Object.keys(CACHE).forEach(k => { if (prefixes.some(p => k.startsWith(p))) delete CACHE[k]; }); }

/* ============ seletores do catálogo ============ */
let IDX = null, IDXV = -1;
function idx() {
  if (IDXV === VER && IDX) return IDX;
  const I = { svc: {}, pro: {} };
  DB.services.forEach(s => I.svc[s.id] = s);
  DB.pros.forEach(p => I.pro[p.id] = p);
  IDX = I; IDXV = VER; return I;
}
const svc = id => idx().svc[id];
const pro = id => idx().pro[id];
const proName = (id, names) => pro(id)?.name || (names && names[id]) || 'Profissional';
const svcNames = ids => ids.map(i => svc(i)?.name).filter(Boolean);
const svcLabel = ids => { const n = svcNames(ids); return n.length <= 1 ? (n[0] || '') : n.length === 2 ? `${n[0]} + ${n[1]}` : `${n[0]} + ${n.length - 1} serviços`; };
// agendamentos trazem os serviços com nome congelado no momento da reserva
const apptNames = a => (a.items || []).map(i => i.name);
const apptLabel = a => { const n = apptNames(a); return n.length <= 1 ? (n[0] || '') : n.length === 2 ? `${n[0]} + ${n[1]}` : `${n[0]} + ${n.length - 1} serviços`; };
const sumDur = ids => ids.reduce((t, i) => t + (svc(i)?.dur || 0), 0);
const sumPrice = ids => ids.reduce((t, i) => t + (svc(i)?.price || 0), 0);
const paid = a => a.price - (a.discount || 0);
const isOpenStatus = a => a.status === 'agendado' || a.status === 'confirmado';
function canDo(pid, ids) { const p = pro(pid); return !!p && ids.every(i => p.services.includes(i)); }
const club = () => ME ? ME.club : { balance: 0, goal: DB.benefit.cost, progress: 0, left: DB.benefit.cost, eligible: false };
const voucherOf = () => ME ? ME.vouchers.find(v => v.status === 'disponivel') : null;
const refLink = code => `${(DB.settings.referralDomain || location.origin).replace(/\/+$/, '')}/indique/${code}`;

/* ============ disponibilidade (calculada no servidor) ============ */
const availKey = d => `av:${d.serviceIds.join(',')}|${d.proId}|${d.editingId || ''}`;
function avail(d) {
  if (!d.serviceIds.length) return { days: [] };
  const q = `/publico/disponibilidade?serviceIds=${encodeURIComponent(d.serviceIds.join(','))}&proId=${encodeURIComponent(d.proId)}${d.editingId ? `&ignore=${encodeURIComponent(d.editingId)}` : ''}`;
  return need(availKey(d), q, 'client', 60000);
}
function slotFree(av, date, time) {
  const day = av && av.days.find(x => x.date === date);
  const s = day && day.slots.find(x => x.time === time);
  return s ? s.proId : null;
}
