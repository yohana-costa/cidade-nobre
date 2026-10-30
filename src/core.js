/* ============ utils ============ */
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
const todayStr = () => dstr(new Date());
const dow = s => parseD(s).getDay();
const isOpen = s => dow(s) !== 0;
const tmin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const tstr = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const nowStamp = () => `${todayStr()} ${tstr(nowMin())}`;
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
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const firstName = n => n.split(/\s+/)[0];
const shortName = n => { const p = n.split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
const onlyDigits = s => String(s || '').replace(/\D/g, '');
const fmtPhone = s => {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ============ constants ============ */
const OPEN = tmin('09:00'), CLOSE = tmin('19:00');
const DAY_CAP = CLOSE - OPEN; // minutos por profissional
const SLOT_TIMES = ['10:00', '11:00', '13:30', '14:30', '16:00', '17:30'];
const LAPSE_DAYS = 45;
const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', cancelado: 'Cancelado' };
const REF_DOMAIN = 'cidade-nobre.exemplo/indique/';

/* ============ seed ============ */
function baseServices() {
  return [
    { id: 's1', name: 'Corte masculino', desc: 'Do clássico ao degradê', cat: 'cabelo', dur: 45, price: 60, img: 'svc_corte', visible: true },
    { id: 's2', name: 'Barba e acabamento', desc: 'Desenho e cuidado', cat: 'barba', dur: 30, price: 45, img: 'svc_barba', visible: true },
    { id: 's3', name: 'Penteado e finalização', desc: 'Seu estilo em destaque', cat: 'cabelo', dur: 20, price: 30, img: 'svc_penteado', visible: true },
    { id: 's4', name: 'Manicure masculina', desc: 'Cuidado com as mãos', cat: 'cuidados', dur: 30, price: 35, img: 'svc_manicure', visible: true },
    { id: 's5', name: 'Cuidado nasal', desc: 'Acabamento dos pelos aparentes', cat: 'cuidados', dur: 10, price: 15, img: 'svc_nasal', visible: true },
    { id: 's6', name: 'Sobrancelhas', desc: 'Detalhes que valorizam', cat: 'cuidados', dur: 15, price: 20, img: 'svc_sobrancelha', visible: true },
  ];
}
const CATS = [{ id: 'cabelo', name: 'Cabelo' }, { id: 'barba', name: 'Barba' }, { id: 'cuidados', name: 'Cuidados' }];

function seed() {
  const T = todayStr();
  const R = rng(20261024);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const services = baseServices();
  const pros = [
    { id: 'p1', name: 'Barbeiro 01', services: ['s1', 's2', 's3', 's5', 's6'] },
    { id: 'p2', name: 'Barbeiro 02', services: ['s1', 's2', 's3', 's4', 's5', 's6'] },
  ];
  const S = Object.fromEntries(services.map(s => [s.id, s]));
  const clubStart = addDays(T, -60);
  const D0 = isOpen(T) ? T : addDays(T, 1);
  const clients = [], appts = [], moves = [], referrals = [], vouchers = [];
  let aSeq = 1, mSeq = 1;
  const nextA = () => `a${aSeq++}`;
  const occupied = {}; // date|pro -> [[s,e]]
  const free = (date, pro, s, e, ignore) => !(occupied[`${date}|${pro}`] || []).some(([a, b, id]) => id !== ignore && s < b && e > a);
  const occupy = (date, pro, s, e, id) => { (occupied[`${date}|${pro}`] ||= []).push([s, e, id]); };
  const dur = ids => ids.reduce((t, id) => t + S[id].dur, 0);
  const price = ids => ids.reduce((t, id) => t + S[id].price, 0);
  const capable = (pid, ids) => ids.every(id => pros.find(p => p.id === pid).services.includes(id));

  function addAppt(o) {
    const a = { id: nextA(), clientId: o.clientId, proId: o.proId, serviceIds: o.serviceIds, date: o.date, time: o.time, dur: dur(o.serviceIds), price: price(o.serviceIds), discount: 0, status: o.status, source: o.source || 'balcao', createdAt: o.createdAt || `${addDays(o.date, -ri(1, 6))} ${tstr(ri(16, 40) * 30)}` };
    occupy(a.date, a.proId, tmin(a.time), tmin(a.time) + a.dur, a.id);
    appts.push(a);
    return a;
  }
  function place(clientId, date, ids, prefPro, statusFn, src) {
    const d = dur(ids);
    for (let shift = 0; shift < 6; shift++) {
      let dt = addDays(date, shift % 2 ? Math.ceil(shift / 2) : -Math.ceil(shift / 2));
      if (!isOpen(dt)) continue;
      const proOrder = [prefPro, prefPro === 'p1' ? 'p2' : 'p1'].filter(p => capable(p, ids));
      const starts = [];
      for (let m = OPEN; m + d <= CLOSE; m += 30) starts.push(m);
      for (let i = starts.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [starts[i], starts[j]] = [starts[j], starts[i]]; }
      for (const p of proOrder) for (const s of starts) if (free(dt, p, s, s + d)) {
        return addAppt({ clientId, proId: p, serviceIds: ids, date: dt, time: tstr(s), status: statusFn(dt, s, d), source: src });
      }
    }
    return null;
  }
  const statusFor = (dt, s, d) => {
    if (dt < T) return R() < 0.07 ? 'cancelado' : 'concluido';
    if (dt === T) { if (s + d <= nowMin()) return R() < 0.05 ? 'cancelado' : 'concluido'; return R() < 0.6 ? 'confirmado' : 'agendado'; }
    const x = R(); return x < 0.05 ? 'cancelado' : x < 0.55 ? 'agendado' : 'confirmado';
  };
  const BASKETS = [[['s1'], 30], [['s1', 's2'], 30], [['s2'], 12], [['s1', 's6'], 8], [['s1', 's2', 's6'], 5], [['s1', 's3'], 5], [['s2', 's5'], 4], [['s4'], 3], [['s1', 's4'], 3]];
  const basket = () => { let x = R() * 100; for (const [b, w] of BASKETS) { if ((x -= w) < 0) return b; } return ['s1']; };

  /* --- handcrafted story clients --- */
  const mk = (id, name, phone, extra = {}) => { const c = { id, name, phone, email: '', createdAt: addDays(T, -120), referredBy: null, code: `CN${100 + clients.length}`, ...extra }; clients.push(c); return c; };
  mk('c1', 'Lucas Andrade', '(11) 90000-0001', { email: 'lucas.andrade@exemplo.com', createdAt: addDays(T, -82), code: 'CN180' });
  mk('c2', 'Bruno Sales', '(11) 90000-0002', { createdAt: addDays(T, -16), referredBy: 'c1' });
  mk('c3', 'Diego Ramos', '(11) 90000-0003', { createdAt: addDays(T, -3), referredBy: 'c1' });
  const story = [
    { clientId: 'c1', proId: 'p1', serviceIds: ['s1'], date: addDays(T, -75), time: '10:00', status: 'concluido' },
    { clientId: 'c1', proId: 'p1', serviceIds: ['s3', 's6'], date: addDays(T, -40), time: '13:00', status: 'concluido' },
    { clientId: 'c2', proId: 'p2', serviceIds: ['s1'], date: addDays(T, -14), time: '10:30', status: 'concluido', source: 'site' },
    { clientId: 'c1', proId: 'p1', serviceIds: ['s1', 's6'], date: addDays(T, -12), time: '13:30', status: 'concluido' },
    { clientId: 'c1', proId: 'p1', serviceIds: ['s2'], date: D0, time: '17:30', status: 'confirmado', source: 'site' },
    { clientId: 'c3', proId: 'p2', serviceIds: ['s1', 's2'], date: D0, time: '15:00', status: 'confirmado', source: 'site' },
    { clientId: 'c2', proId: 'p2', serviceIds: ['s1', 's2'], date: addDays(T, 9), time: '11:00', status: 'agendado', source: 'site' },
  ];
  // keep story days Sunday-safe
  const storyAppts = story.map(s => { while (!isOpen(s.date)) s.date = addDays(s.date, 1); return addAppt(s); });

  /* --- generated clients --- */
  const FN = ['Rafael', 'Gustavo', 'Pedro', 'Felipe', 'André', 'Thiago', 'Vinícius', 'Caio', 'Eduardo', 'Leonardo', 'Henrique', 'Marcelo', 'João', 'Rodrigo', 'Samuel', 'Gabriel', 'Daniel', 'Fernando', 'Ricardo', 'Paulo', 'Igor', 'Renato', 'Murilo', 'Otávio', 'Fábio', 'Hugo', 'Victor', 'Arthur', 'Enzo', 'Davi', 'Bernardo', 'Heitor', 'Lorenzo', 'Breno', 'Alexandre', 'Rogério', 'Sérgio', 'Wesley', 'Nicolas', 'Vitor', 'Júlio', 'César', 'Fabrício', 'Luan', 'Kauã', 'Márcio', 'Roberto', 'Antônio'];
  const LN = ['Costa', 'Lima', 'Alves', 'Nogueira', 'Barbosa', 'Martins', 'Prado', 'Ferreira', 'Pires', 'Dias', 'Moraes', 'Tavares', 'Lopes', 'Campos', 'Freitas', 'Rocha', 'Carvalho', 'Mendes', 'Ribeiro', 'Teixeira', 'Araújo', 'Batista', 'Cardoso', 'Monteiro', 'Rezende', 'Siqueira', 'Vieira', 'Macedo', 'Duarte', 'Fonseca', 'Pacheco', 'Queiroz', 'Sampaio', 'Coelho', 'Medeiros'];
  const used = new Set(clients.map(c => c.name));
  const N = 126;
  for (let i = 0; i < N; i++) {
    let name; do { name = `${pick(FN)} ${pick(LN)}`; } while (used.has(name)); used.add(name);
    const id = `c${clients.length + 1}`;
    const r = R();
    const kind = r < 0.68 ? 'regular' : r < 0.86 ? 'lapsed' : 'new';
    const c = mk(id, name, `(11) 90000-${String(clients.length + 1).padStart(4, '0')}`, { email: R() < 0.55 ? `${name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${name.split(' ')[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@exemplo.com` : '' });
    const pref = R() < 0.5 ? 'p1' : 'p2';
    const fav = basket();
    const cad = kind === 'lapsed' ? ri(20, 34) : ri(12, 26);
    const dates = [];
    if (kind === 'new') {
      dates.push(addDays(T, -ri(1, 22)));
      c.createdAt = addDays(dates[0], -ri(0, 3));
    } else {
      let d = kind === 'lapsed' ? addDays(T, -ri(LAPSE_DAYS + 2, 88)) : addDays(T, -ri(1, cad));
      while (diffDays(T, d) <= 95) { dates.push(d); d = addDays(d, -(cad + ri(-4, 5))); }
      c.createdAt = addDays(dates[dates.length - 1], -ri(0, 20));
    }
    dates.reverse().forEach(d => place(id, d, R() < 0.78 ? fav : basket(), pref, statusFor));
    // upcoming visit
    if (kind !== 'lapsed') {
      const last = dates[dates.length - 1];
      const due = addDays(last, cad + ri(-3, 3));
      const off = diffDays(due, T);
      if (off >= 0 && off <= 9 && R() < 0.8) place(id, due, fav, pref, statusFor, R() < 0.45 ? 'site' : 'balcao');
      else if (kind === 'new' && R() < 0.45) place(id, addDays(T, ri(1, 8)), fav, pref, statusFor, 'site');
    }
    c._kind = kind;
  }
  // fill today and the next days so the agenda reads like a real operation
  const regulars = clients.filter(c => c._kind === 'regular');
  const fill = (date, target) => {
    let guard = 0;
    while (appts.filter(a => a.date === date).length < target && guard++ < 80) {
      const c = pick(regulars);
      if (appts.some(a => a.clientId === c.id && a.date >= T && a.status !== 'cancelado')) continue;
      place(c.id, date, basket(), R() < .5 ? 'p1' : 'p2', (dt, s, d) => statusFor(dt, s, d), R() < 0.5 ? 'site' : 'balcao');
    }
  };
  for (let k = 0; k <= 8; k++) { const d = addDays(T, k); if (isOpen(d)) fill(d, k === 0 ? 11 : Math.max(2, 6 - k)); }
  for (let k = 1; k <= 64; k++) { const d = addDays(T, -k); if (isOpen(d)) fill(d, k <= 7 ? 11 : 10 - Math.floor(k / 13)); } // leve tendência de alta nas últimas semanas
  // keep a clear demo path on the reference slots: free 14:30 tomorrow-ish for both pros is not required; nothing else
  // pending referral with no visit yet
  const thiago = mk(`c${clients.length + 1}`, 'Thiago Martins', `(11) 90000-${String(clients.length + 1).padStart(4, '0')}`, { createdAt: addDays(T, -5) });
  thiago.referredBy = regulars[3].id; thiago._kind = 'new';
  used.add('Thiago Martins');
  // referrals: story + some generated (new clients referred by regulars)
  referrals.push({ id: 'r1', referrerId: 'c1', referredId: 'c2', createdAt: addDays(T, -16), status: 'pendente', apptId: null });
  referrals.push({ id: 'r2', referrerId: 'c1', referredId: 'c3', createdAt: addDays(T, -3), status: 'pendente', apptId: null });
  referrals.push({ id: 'r3', referrerId: thiago.referredBy, referredId: thiago.id, createdAt: thiago.createdAt, status: 'pendente', apptId: null });
  clients.filter(c => c._kind === 'new' && c.id !== thiago.id).slice(0, 7).forEach((c, i) => {
    const ref = regulars[(i * 7 + 5) % regulars.length];
    if (ref.id === c.id) return;
    c.referredBy = ref.id;
    referrals.push({ id: `r${referrals.length + 1}`, referrerId: ref.id, referredId: c.id, createdAt: c.createdAt, status: 'pendente', apptId: null });
  });
  clients.forEach(c => { delete c._kind; });

  /* --- loyalty ledger, replayed chronologically --- */
  const st = { clients, services, pros, appts, moves, referrals, vouchers };
  appts.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const bal = {};
  const storyIds = new Set(['c1']);
  for (const a of appts) {
    if (a.status !== 'concluido') continue;
    const stamp = `${a.date} ${tstr(tmin(a.time) + a.dur + 2)}`;
    const firstDone = !appts.some(b => b !== a && b.clientId === a.clientId && b.status === 'concluido' && (b.date + b.time) < (a.date + a.time));
    if (a.date < clubStart) continue;
    const v = vouchers.find(v => v.clientId === a.clientId && v.status === 'disponivel');
    if (v) { a.discount = Math.min(v.value, a.price); v.status = 'utilizado'; v.usedApptId = a.id; v.usedAt = stamp; }
    const paid = a.price - a.discount;
    if (paid > 0) { moves.push({ id: `m${mSeq++}`, clientId: a.clientId, type: 'servico', points: paid, apptId: a.id, at: stamp }); bal[a.clientId] = (bal[a.clientId] || 0) + paid; }
    const c = clients.find(c => c.id === a.clientId);
    const rf = referrals.find(r => r.referredId === c.id && r.status === 'pendente');
    if (firstDone && rf) {
      rf.status = 'concluida'; rf.apptId = a.id; rf.doneAt = stamp;
      const at2 = `${a.date} ${tstr(tmin(a.time) + a.dur + 5)}`;
      moves.push({ id: `m${mSeq++}`, clientId: rf.referrerId, type: 'indicacao', points: 50, referralId: rf.id, at: a.clientId === 'c2' ? `${a.date} 11:20` : at2 });
      bal[rf.referrerId] = (bal[rf.referrerId] || 0) + 50;
    }
    if (!storyIds.has(a.clientId) && (bal[a.clientId] || 0) >= 250 && R() < 0.8) {
      const at3 = `${a.date} ${tstr(tmin(a.time) + a.dur + 4)}`;
      moves.push({ id: `m${mSeq++}`, clientId: a.clientId, type: 'resgate', points: -250, benefitId: 'b1', at: at3 });
      vouchers.push({ id: `v${vouchers.length + 1}`, clientId: a.clientId, benefitId: 'b1', value: 20, status: 'disponivel', createdAt: at3 });
      bal[a.clientId] -= 250;
    }
  }
  // c2 story timing: movement at 14:32 for Lucas' service, matches the visual reference rhythm
  // (referência direta ao objeto: a data pode ter sido empurrada se caiu num domingo)
  const lucasLast = storyAppts[3];
  const mvL = lucasLast && moves.find(m => m.apptId === lucasLast.id); if (mvL) mvL.at = `${lucasLast.date} 14:32`;

  return {
    v: 4, seededOn: T, clubStart,
    clients, services, categories: CATS, pros, appts, moves, referrals, vouchers,
    benefit: { id: 'b1', title: 'R$ 20 de desconto', cost: 250, value: 20 },
    rules: { perReal: 1, referral: 50 },
    activeClientId: 'c1',
    seq: { a: aSeq, m: mSeq, c: clients.length + 1, r: referrals.length + 1, v: vouchers.length + 1 },
  };
}

/* ============ store ============ */
const KEY = 'cn-demo-data-v4', UIKEY = 'cn-demo-ui-v4';
let DB, UI, VER = 0;
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable: demo keeps working in memory */ } },
};
function defaultUI() {
  return { mode: 'client', screen: 'home', cat: 'todos', draft: emptyDraft(), lastAppt: null, histOpen: false, admin: 'dash', period: '7', agDate: todayStr(), agPro: 'all', clientQ: '', clientSort: 'recent', clientFilter: 'all', fidTab: 'saldos', svcTab: 'servicos', opp: 'lapsed', hl: null };
}
function emptyDraft() { return { serviceIds: [], proId: 'any', date: null, time: null, name: '', phone: '', email: '', editingId: null, touched: false }; }
function load() {
  const d = store.get(KEY);
  const fresh = !d || d.v !== 4 || diffDays(todayStr(), d.seededOn) > 2;
  DB = fresh ? seed() : d;
  UI = Object.assign(defaultUI(), (!fresh && store.get(UIKEY)) || {});
  if (fresh) save();
  VER++;
}
function save() { VER++; store.set(KEY, DB); store.set(UIKEY, UI); }
function saveUI() { store.set(UIKEY, UI); }
function resetDemo() { DB = seed(); UI = Object.assign(defaultUI(), { mode: UI.mode, admin: UI.admin }); save(); }

/* ============ selectors ============ */
let IDX = null, IDXV = -1;
function idx() {
  if (IDXV === VER && IDX) return IDX;
  const I = { svc: {}, pro: {}, cli: {}, byClient: {}, movesBy: {}, apptById: {}, refBy: {} };
  DB.services.forEach(s => I.svc[s.id] = s);
  DB.pros.forEach(p => I.pro[p.id] = p);
  DB.clients.forEach(c => { I.cli[c.id] = c; I.byClient[c.id] = []; I.movesBy[c.id] = []; });
  DB.appts.forEach(a => { I.apptById[a.id] = a; (I.byClient[a.clientId] ||= []).push(a); });
  const ord = new Map(); DB.moves.forEach((m, i) => { ord.set(m, i); (I.movesBy[m.clientId] ||= []).push(m); });
  Object.values(I.byClient).forEach(l => l.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  Object.values(I.movesBy).forEach(l => l.sort((a, b) => b.at.localeCompare(a.at) || ord.get(b) - ord.get(a)));
  IDX = I; IDXV = VER; return I;
}
const svc = id => idx().svc[id];
const pro = id => idx().pro[id];
const cli = id => idx().cli[id];
const appt = id => idx().apptById[id];
const svcNames = ids => ids.map(i => svc(i)?.name).filter(Boolean);
const svcLabel = ids => { const n = svcNames(ids); return n.length <= 1 ? (n[0] || '') : n.length === 2 ? `${n[0]} + ${n[1]}` : `${n[0]} + ${n.length - 1} serviços`; };
const sumDur = ids => ids.reduce((t, i) => t + (svc(i)?.dur || 0), 0);
const sumPrice = ids => ids.reduce((t, i) => t + (svc(i)?.price || 0), 0);
const paid = a => a.price - (a.discount || 0);
const isOpenStatus = a => a.status === 'agendado' || a.status === 'confirmado';
const balance = cid => (idx().movesBy[cid] || []).reduce((t, m) => t + m.points, 0);
const movesOf = cid => idx().movesBy[cid] || [];
const apptsOf = cid => idx().byClient[cid] || [];
const voucherOf = cid => DB.vouchers.find(v => v.clientId === cid && v.status === 'disponivel');
function clientStats(cid) {
  const l = apptsOf(cid), T = todayStr();
  const done = l.filter(a => a.status === 'concluido');
  const next = l.find(a => isOpenStatus(a) && a.date >= T) || null;
  const last = done[done.length - 1] || null;
  return { visits: done.length, spent: done.reduce((t, a) => t + paid(a), 0), last, next, points: balance(cid), sinceLast: last ? diffDays(T, last.date) : null };
}
function club(cid) {
  const b = balance(cid), goal = DB.benefit.cost;
  const p = Math.max(0, Math.min(1, b / goal));
  return { balance: b, goal, progress: p, left: Math.max(0, goal - b), eligible: b >= goal };
}
function canDo(pid, ids) { const p = pro(pid); return ids.every(i => p.services.includes(i)); }
function proBusy(pid, date, s, e, ignore) {
  return DB.appts.some(a => a.proId === pid && a.date === date && a.id !== ignore && a.status !== 'cancelado' && s < tmin(a.time) + a.dur && e > tmin(a.time));
}
function slotFree(date, time, proSel, ids, ignore) {
  const d = Math.max(sumDur(ids), 15), s = tmin(time), e = s + d;
  if (e > CLOSE) return null;
  if (date === todayStr() && s <= nowMin() + 20) return null;
  const cand = proSel === 'any' ? DB.pros.map(p => p.id) : [proSel];
  const ok = cand.filter(p => canDo(p, ids) && !proBusy(p, date, s, e, ignore));
  if (!ok.length) return null;
  // sem preferência: menor carga no dia
  ok.sort((a, b) => dayLoad(a, date) - dayLoad(b, date));
  return ok[0];
}
const dayLoad = (pid, date) => DB.appts.filter(a => a.proId === pid && a.date === date && a.status !== 'cancelado').reduce((t, a) => t + a.dur, 0);
function bookingDays(ids, proSel, ignore) {
  const out = []; let d = todayStr(), guard = 0;
  while (out.length < 5 && guard++ < 14) {
    if (isOpen(d)) {
      const free = SLOT_TIMES.filter(t => slotFree(d, t, proSel, ids, ignore)).length;
      // hoje entra na lista só se ainda houver horários suficientes
      if (d !== todayStr() || free >= 3) out.push({ date: d, any: free > 0, free });
    }
    d = addDays(d, 1);
  }
  return out;
}

/* ============ actions ============ */
function nid(k) { const n = DB.seq[k]++; return `${k}${n}x`; }
function findOrCreateClient(name, phone, email) {
  const ph = onlyDigits(phone);
  let c = DB.clients.find(c => onlyDigits(c.phone) === ph);
  if (c) { c.name = name; if (email) c.email = email; return c; }
  c = { id: nid('c'), name, phone: fmtPhone(phone), email, createdAt: todayStr(), referredBy: null, code: `CN${200 + DB.clients.length}` };
  DB.clients.push(c);
  return c;
}
function commitBooking() {
  const d = UI.draft;
  const c = findOrCreateClient(d.name.trim(), d.phone, d.email.trim());
  const proId = slotFree(d.date, d.time, d.proId, d.serviceIds, d.editingId);
  if (!proId) return { error: 'Esse horário acabou de ficar indisponível na agenda demonstrativa. Escolha outro horário.' };
  let a;
  if (d.editingId && appt(d.editingId)) {
    a = appt(d.editingId);
    Object.assign(a, { clientId: c.id, proId, serviceIds: [...d.serviceIds], date: d.date, time: d.time, dur: sumDur(d.serviceIds), price: sumPrice(d.serviceIds), status: 'agendado', updatedAt: nowStamp() });
  } else {
    a = { id: nid('a'), clientId: c.id, proId, serviceIds: [...d.serviceIds], date: d.date, time: d.time, dur: sumDur(d.serviceIds), price: sumPrice(d.serviceIds), discount: 0, status: 'agendado', source: 'site', createdAt: nowStamp(), fromDemo: true };
    DB.appts.push(a);
  }
  DB.activeClientId = c.id;
  UI.lastAppt = a.id;
  UI.draft = emptyDraft();
  save();
  return { appt: a, edited: !!d.editingId };
}
function setStatus(id, st) {
  const a = appt(id); if (!a) return;
  if (a.status === 'concluido') return;
  if (st === 'concluido') return conclude(id);
  a.status = st; a.updatedAt = nowStamp();
  save();
  return { };
}
function conclude(id) {
  const a = appt(id);
  if (!a || a.status === 'concluido') return { dup: true };
  if (a.date > todayStr()) return { error: 'Só é possível concluir atendimentos de hoje ou de datas anteriores.' };
  const stamp = nowStamp();
  const before = DB.appts.filter(b => b.clientId === a.clientId && b.status === 'concluido').length;
  a.status = 'concluido'; a.concludedAt = stamp;
  const out = { points: 0, referral: null, voucher: null };
  // benefício disponível é aplicado no atendimento
  const v = voucherOf(a.clientId);
  if (v && !a.discount) { a.discount = Math.min(v.value, a.price); v.status = 'utilizado'; v.usedApptId = a.id; v.usedAt = stamp; out.voucher = v; }
  // pontos: um crédito por atendimento (sem duplicar)
  if (!DB.moves.some(m => m.type === 'servico' && m.apptId === a.id)) {
    const p = paid(a) * DB.rules.perReal;
    if (p > 0) { DB.moves.push({ id: nid('m'), clientId: a.clientId, type: 'servico', points: p, apptId: a.id, at: stamp }); out.points = p; }
  }
  // indicação: libera no primeiro atendimento concluído do indicado
  const rf = DB.referrals.find(r => r.referredId === a.clientId && r.status === 'pendente');
  if (rf && before === 0 && !DB.moves.some(m => m.type === 'indicacao' && m.referralId === rf.id)) {
    rf.status = 'concluida'; rf.apptId = a.id; rf.doneAt = stamp;
    DB.moves.push({ id: nid('m'), clientId: rf.referrerId, type: 'indicacao', points: DB.rules.referral, referralId: rf.id, at: stamp });
    out.referral = rf;
  }
  save();
  return out;
}
function redeem(cid) {
  const c = club(cid);
  if (!c.eligible) return { error: 'Saldo insuficiente para o resgate.' };
  const stamp = nowStamp();
  DB.moves.push({ id: nid('m'), clientId: cid, type: 'resgate', points: -DB.benefit.cost, benefitId: DB.benefit.id, at: stamp });
  const v = { id: nid('v'), clientId: cid, benefitId: DB.benefit.id, value: DB.benefit.value, status: 'disponivel', createdAt: stamp };
  DB.vouchers.push(v);
  save();
  return { voucher: v };
}

/* ============ metrics (single source for every indicator) ============ */
function periodRange(p) {
  const T = todayStr();
  if (p === 'hoje') return { from: T, to: T, prevFrom: addDays(T, -7), prevTo: addDays(T, -7), label: 'Hoje', cmp: 'vs. mesmo dia da semana anterior' };
  const n = Number(p);
  // dias fechados (até ontem) para comparar períodos completos
  return { from: addDays(T, -n), to: addDays(T, -1), prevFrom: addDays(T, -2 * n), prevTo: addDays(T, -n - 1), label: `Últimos ${n} dias (até ontem)`, cmp: `vs. ${n} dias anteriores` };
}
function openDaysBetween(a, b) { let n = 0, d = a; while (d <= b) { if (isOpen(d)) n++; d = addDays(d, 1); } return n; }
function metrics(from, to, proId, cut) {
  const inR = DB.appts.filter(a => a.date >= from && a.date <= to && (!proId || a.proId === proId));
  // cut: compara um dia passado só até o horário atual (para o filtro "Hoje")
  const done = inR.filter(a => a.status === 'concluido' && (cut === undefined || tmin(a.time) + a.dur <= cut));
  const canc = inR.filter(a => a.status === 'cancelado');
  const rev = done.reduce((t, a) => t + paid(a), 0);
  const booked = inR.filter(a => a.status !== 'cancelado').reduce((t, a) => t + a.dur, 0);
  const cap = openDaysBetween(from, to) * DAY_CAP * (proId ? 1 : DB.pros.length);
  const returning = new Set(done.filter(a => DB.appts.some(b => b.clientId === a.clientId && b.status === 'concluido' && (b.date + b.time) < (a.date + a.time))).map(a => a.clientId));
  const unique = new Set(done.map(a => a.clientId));
  return { total: inR.length, done: done.length, canc: canc.length, cancRate: inR.length ? canc.length / inR.length : 0, rev, ticket: done.length ? rev / done.length : 0, occ: cap ? booked / cap : 0, returning: returning.size, unique: unique.size, list: inR };
}
function lapsedClients() {
  return DB.clients.map(c => ({ c, s: clientStats(c.id) })).filter(({ s }) => s.last && s.sinceLast > LAPSE_DAYS && !s.next).sort((a, b) => a.s.sinceLast - b.s.sinceLast);
}
