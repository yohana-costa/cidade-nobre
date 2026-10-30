/* ============ client experience ============ */
const A = window.ASSETS || {};
const img = k => A[k] || A.cat_cabelo;
const crest = (cls) => `<div class="crest ${cls}"><img src="${A.crest}" alt="Cidade Nobre, Barbearia Premium" width="221" height="229"></div>`;
const crestD = (w) => `<div class="crest-d" style="width:${w}px"><img src="${A.crest}" alt="Cidade Nobre, Barbearia Premium" width="221" height="229"></div>`;
const lockup = (h = 44) => `<img src="${A.lockup}" alt="Cidade Nobre, Barbearia Premium" style="height:${h}px;width:auto" width="735" height="184">`;

// estados de carregamento e erro dentro do layout existente
const vLoading = (msg = 'Carregando…') => `<div class="empty" role="status"><span class="spin"></span> ${msg}</div>`;
const vError = (msg, key) => `<div class="empty" role="alert">${ic('alert')} ${esc(msg)}${key ? `<div style="margin-top:12px"><button class="btn btn-line btn-sm" data-act="retry" data-k="${esc(key)}">${ic('refresh')} Tentar de novo</button></div>` : ''}</div>`;

const NAV = [
  { id: 'home', label: 'Início', icon: 'home', on: 'homeF' },
  { id: 'servicos', label: 'Serviços', icon: 'scissors' },
  { id: 'agendar', label: 'Agendar', icon: 'calendarDot', on: 'calendar' },
  { id: 'clube', label: 'Clube', icon: 'crown', on: 'crownF' },
  { id: 'perfil', label: 'Perfil', icon: 'user' },
];
const NAV_OF = { home: 'home', servicos: 'servicos', agendar: 'agendar', dados: 'agendar', confirmado: 'agendar', clube: 'clube', perfil: 'perfil', entrar: 'perfil' };

function bottomNav(screen) {
  const cur = NAV_OF[screen];
  return `<nav class="bnav" aria-label="Navegação principal"><div class="bnav-row">${NAV.map(n => `<button class="${n.id === cur ? 'on' : ''}" data-go="${n.id}" ${n.id === cur ? 'aria-current="page"' : ''}>${ic(n.id === cur && n.on ? n.on : n.icon)}<span>${n.label}</span></button>`).join('')}</div></nav>`;
}
function topBar(screen) {
  const cur = NAV_OF[screen];
  return `<header class="cx-top"><button class="logo" data-go="home" aria-label="Início">${lockup(46)}</button>
  <nav>${NAV.map(n => `<button class="${n.id === cur ? 'on' : ''}" data-go="${n.id}">${n.label === 'Clube' ? 'Clube Cidade Nobre' : n.label}</button>`).join('')}</nav>
  <button class="btn btn-line btn-sm" data-go="perfil">${ic('user')} ${ME ? esc(firstName(ME.client.name)) : 'Entrar'}</button>
  <button class="menu-btn" data-act="menu" aria-label="Abrir menu">${ic('menu')}</button></header>`;
}
const backBtn = (to) => `<button class="back" data-go="${to}" aria-label="Voltar">${ic('left')}</button>`;
const backD = (to, label = 'Voltar') => `<button class="link back-d" data-go="${to}">${ic('left')} ${label}</button>`;

function stepper(steps) {
  return `<ol class="stepper" aria-label="Etapas do agendamento">${steps.map(s => `<li class="step ${s.st}" ${s.st === 'cur' ? 'aria-current="step"' : ''}><span class="dot">${s.st === 'done' ? ic('check') : s.n}</span><span>${s.label}</span></li>`).join('')}</ol>`;
}

/* ---------- Início ---------- */
const HOME_CATS = [['cabelo', 'scissors', 'cat_cabelo', 'Corte masculino com degradê'], ['barba', 'beardF', 'cat_barba', 'Barba sendo desenhada com máquina'], ['cuidados', 'lotus', 'cat_cuidados', 'Produtos de cuidado masculino']];
function vHome() {
  const cb = club();
  const cats = DB.categories.map(c => { const h = HOME_CATS.find(x => x[0] === c.id); return [c.id, c.name, h ? h[1] : 'scissors', h ? h[2] : 'cat_cabelo', h ? h[3] : c.name]; });
  return `<div class="scr home">
  <div class="home-bar"><button class="menu-btn" data-act="menu" aria-label="Abrir menu">${ic('menu')}</button></div>
  ${crest('m-only')}
  <div class="d-page">
    <section class="hero">
      <div class="hero-media"><img src="${A.hero_home}" alt="Salão da Cidade Nobre com cadeiras de couro e espelhos iluminados" width="759" height="804"></div>
      <div class="home-copy">
        ${crestD(118)}
        <div class="eyebrow">Cidade Nobre</div>
        <h1 class="htitle">Seu estilo.<br>Seu lugar.</h1>
        <p class="home-sub">Cuidado completo. Presença em cada detalhe.</p>
        <div class="home-ctas">
          <button class="btn btn-gold" data-act="start-booking">Agendar meu horário ${ic('arrow')}</button>
          <button class="btn btn-line" data-act="scroll-exp">Conheça a experiência ${ic('down')}</button>
        </div>
      </div>
    </section>
    <section class="home-sec wrap" id="experiencia">
      <div class="lined"><h2>Muito além do corte</h2></div>
      <div class="cats">
        ${cats.map(([id, n, i, im, alt]) => `
        <button class="cat" data-act="cat" data-cat="${esc(id)}"><div class="cat-img"><img src="${img(im)}" alt="${esc(alt)}" loading="lazy"></div><div class="cat-lbl">${ic(i)}<span>${esc(n)}</span>${ic('right', 'chev')}</div></button>`).join('')}
      </div>
      <button class="club-tease" data-go="clube">
        <span class="ring">${ic('crown')}</span>
        <span><b>Clube Cidade Nobre</b><small>${!ME ? `A cada ${money0(1)} pago você ganha ${DB.rules.perReal} ponto${DB.rules.perReal === 1 ? '' : 's'}. Entre para ver seu saldo.` : cb.eligible ? 'Sua recompensa já está disponível para resgate.' : `Você tem ${cb.balance} pontos. Faltam ${cb.left} para a próxima recompensa.`}</small></span>
        ${ic('right', 'chev')}
      </button>
    </section>
  </div></div>`;
}

/* ---------- Serviços ---------- */
function vServicos() {
  const d = UI.draft;
  const list = DB.services.filter(s => s.visible && (UI.cat === 'todos' || s.cat === UI.cat));
  const n = d.serviceIds.length;
  return `<div class="scr svc">
  ${backBtn('home')}
  ${crest('m-only')}
  <div class="d-page">
    <section class="hero">
      <div class="hero-media"><img src="${A.hero_servicos}" alt="Cadeiras de barbeiro da Cidade Nobre" width="756" height="505"></div>
      <div class="svc-copy">
        ${backD('home', 'Início')}
        ${crestD(92)}
        <span class="gold-rule"></span>
        <div class="eyebrow">Escolha sua experiência</div>
        <h1 class="htitle">Cuidado em<br>cada detalhe.</h1>
        <p>Selecione um ou mais serviços</p>
      </div>
    </section>
    <div class="wrap">
      <div class="chips" role="tablist" aria-label="Categorias">
        ${[['todos', 'Todos'], ...DB.categories.map(c => [c.id, c.name])].map(([id, l]) => `<button class="chip ${UI.cat === id ? 'on' : ''}" role="tab" aria-selected="${UI.cat === id}" data-act="cat-filter" data-cat="${esc(id)}">${esc(l)}</button>`).join('')}
      </div>
      <div class="svc-list" id="svc-list">
        ${list.length ? list.map(s => {
          const on = d.serviceIds.includes(s.id);
          return `<button class="svc-item ${on ? 'on' : ''}" data-act="svc-toggle" data-id="${s.id}" aria-pressed="${on}">
            <span class="svc-thumb"><img src="${img(s.img)}" alt="" loading="lazy"></span>
            <span class="svc-txt"><b>${esc(s.name)}</b><small>${esc(s.desc)}${s.desc ? ' · ' : ''}${s.dur} min · ${money(s.price)}</small></span>
            <span class="svc-tog"><span>${ic(on ? 'check' : 'plus')}</span></span>
          </button>`;
        }).join('') : `<div class="empty">Nenhum serviço disponível nesta categoria.</div>`}
      </div>
      <div class="svc-cta">
        <button class="btn btn-gold btn-serif" data-act="svc-continue" ${n ? '' : 'disabled'}>${n ? `Continuar com ${n} ${n > 1 ? 'serviços' : 'serviço'}` : 'Selecione um serviço'} ${ic('right')}</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------- Agendar (profissional + dia + horário) ---------- */
function ensureBookingDefaults(av) {
  const d = UI.draft;
  if (d.proId !== 'any' && !canDo(d.proId, d.serviceIds)) d.proId = 'any';
  if (!av) return null;
  const days = av.days;
  // dia sem horario livre (ex.: trocou de profissional) cai para o proximo dia com vaga
  if (!d.date || !days.some(x => x.date === d.date && x.any)) { d.date = (days.find(x => x.free >= 4) || days.find(x => x.any) || days[0])?.date || null; d.time = null; }
  if (d.time && !slotFree(av, d.date, d.time)) d.time = null;
  return days;
}
function vAgendar() {
  const d = UI.draft;
  d.serviceIds = d.serviceIds.filter(i => svc(i));
  if (d.proId !== 'any' && !canDo(d.proId, d.serviceIds)) d.proId = 'any';
  const av = avail(d);
  const avErr = needErr(availKey(d));
  const days = ensureBookingDefaults(av);
  const editing = !!d.editingId;
  const proCards = [{ id: 'any', label: 'Sem preferência', icon: 'usersF' }, ...DB.pros.map(p => ({ id: p.id, label: p.name, icon: 'userF' }))];
  const sumTxt = d.time ? `${esc(svcLabel(d.serviceIds))} &nbsp;•&nbsp; ${fDM(d.date)} às ${d.time}` : `${esc(svcLabel(d.serviceIds))} &nbsp;•&nbsp; <span class="ph">escolha um horário</span>`;
  return `<div class="scr bk">
  ${backBtn(editing ? 'perfil' : 'servicos')}
  ${crest('m-only')}
  <div class="d-page">
    <section class="hero">
      <div class="hero-media"><img src="${A.hero_agendar}" alt="Bancadas e espelhos iluminados da Cidade Nobre" width="756" height="470"></div>
      <div class="bk-copy">
        ${backD(editing ? 'perfil' : 'servicos', editing ? 'Perfil' : 'Serviços')}
        ${crestD(92)}
        <div class="eyebrow">${editing ? 'Alterar<br>agendamento' : 'Seu próximo visual<br>começa aqui'}</div>
        <span class="gold-rule"></span>
        <h1 class="htitle">Reserve seu<br>momento.</h1>
        ${stepper([{ n: 1, label: 'Serviço', st: 'done' }, { n: 2, label: 'Profissional', st: 'done' }, { n: 3, label: 'Horário', st: 'cur' }])}
      </div>
    </section>
    <div class="wrap bk-grid">
      <div class="bk-body">
        <div class="svc-sum">
          <span class="ring">${ic('scissors')}</span>
          <span class="svc-sum-t"><b>${esc(svcLabel(d.serviceIds))}</b>${d.serviceIds.length > 1 ? `<small>${d.serviceIds.length} serviços · ${sumDur(d.serviceIds)} min</small>` : ''}</span>
          <button class="alt" data-go="servicos">Alterar ${ic('right')}</button>
        </div>
        <div class="bk-h"><h2 class="h-sec h-sec-u">Com quem você quer agendar?</h2></div>
        <div class="pros" role="radiogroup" aria-label="Profissional">
          ${proCards.map(p => {
            const able = p.id === 'any' || canDo(p.id, d.serviceIds);
            const on = d.proId === p.id;
            const miss = able ? '' : (svcNames(d.serviceIds.filter(i => !pro(p.id).services.includes(i)))[0] || '');
            return `<button class="pro ${on ? 'on' : ''} ${able ? '' : 'off'}" role="radio" aria-checked="${on}" ${able ? `data-act="pro" data-id="${p.id}"` : 'aria-disabled="true"'}>
              ${on ? `<span class="chk">${ic('check')}</span>` : ''}
              <span class="av">${ic(p.icon)}</span><span class="lbl">${esc(p.label)}</span>${able ? '' : `<span class="why">Não realiza ${esc(miss.toLowerCase())}</span>`}
            </button>`;
          }).join('')}
        </div>
        <div class="bk-h"><h2 class="h-sec h-sec-u">Escolha o dia</h2></div>
        ${avErr ? vError(avErr, availKey(d)) : !days ? vLoading('Buscando horários livres…') : !days.length ? `<div class="empty">Sem dias com horários livres nos próximos dias. Tente outro profissional.</div>` : `
        <div class="days" role="radiogroup" aria-label="Dia">
          ${days.map(x => { const dd = parseD(x.date); const on = d.date === x.date; return `<button class="day ${on ? 'on' : ''} ${x.any ? '' : 'full'}" role="radio" aria-checked="${on}" ${x.any ? `data-act="day" data-date="${x.date}"` : 'aria-disabled="true" title="Sem horários livres"'}><small>${WD[dd.getDay()]}</small><b>${dd.getDate()}</b></button>`; }).join('')}
        </div>
        <div class="bk-h"><h2 class="h-sec h-sec-u">Horários</h2></div>
        <div class="slots" role="radiogroup" aria-label="Horário">
          ${SLOT_TIMES.map(t => { const ok = d.date && slotFree(av, d.date, t); const on = d.time === t; return `<button class="slot ${on ? 'on' : ''}" role="radio" aria-checked="${on}" ${ok ? `data-act="slot" data-time="${t}"` : 'disabled aria-label="' + t + ' indisponível"'}>${t}</button>`; }).join('')}
        </div>`}
      </div>
      <aside class="bk-side">
        <div class="sumbar">${ic('calendar')}<span>${sumTxt}</span></div>
        <div class="bk-cta"><button class="btn btn-gold btn-serif" data-act="to-dados" ${d.time ? '' : 'disabled'}>Continuar para meus dados ${ic('right')}</button></div>
      </aside>
    </div>
  </div></div>`;
}

/* ---------- Dados do cliente ---------- */
function prefillDraft() {
  const d = UI.draft;
  if (ME && !d.touched && !d.name && !d.phone) { d.name = ME.client.name; d.phone = ME.client.phone; d.email = ME.client.email || ''; }
}
function validate(d) {
  const e = {};
  if (d.name.trim().length < 3) e.name = 'Informe seu nome com pelo menos 3 letras.';
  const ph = onlyDigits(d.phone);
  if (!ph) e.phone = 'Informe um telefone com DDD.'; else if (ph.length < 10 || ph.length > 11) e.phone = 'O telefone precisa ter DDD + número (10 ou 11 dígitos).';
  if ((d.email || '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Confira o e-mail ou deixe o campo em branco.';
  if (d.password && d.password.length < 6) e.password = 'A senha precisa ter pelo menos 6 caracteres.';
  return e;
}
function recapCard(o) {
  const p = o.proId === 'any' ? 'Sem preferência' : proName(o.proId);
  const names = o.items ? o.items.map(i => i.name) : svcNames(o.serviceIds);
  const dur = o.items ? o.items.reduce((t, i) => t + i.dur, 0) : sumDur(o.serviceIds);
  return `<div class="recap">
    <div class="recap-row">${ic('scissors')}<div><small>${names.length > 1 ? 'Serviços' : 'Serviço'}</small>${names.map(n => `<b>${esc(n)}</b>`).join('')}</div>${o.editable ? `<button class="link" data-go="servicos">Alterar</button>` : `<span class="v">${dur} min</span>`}</div>
    <div class="recap-row">${ic('user')}<div><small>Profissional</small><b>${esc(p)}</b>${o.assigned && o.proId === 'any' ? `<span class="note">Atribuído: ${esc(proName(o.assigned))}</span>` : ''}</div>${o.editable ? `<button class="link" data-go="agendar">Alterar</button>` : ''}</div>
    <div class="recap-row">${ic('calendar')}<div><small>Data e horário</small><b>${fDayLong(o.date).replace(/^./, m => m.toUpperCase())} às ${o.time}</b></div>${o.editable ? `<button class="link" data-go="agendar">Alterar</button>` : ''}</div>
    ${o.total ? `<div class="recap-total"><div><span>Total estimado</span><br><b class="tnum">${money(o.total)}</b></div><div style="text-align:right"><span>Pontos previstos</span><br><span class="pts">+${Math.floor(o.total * DB.rules.perReal)} pts</span></div></div>` : ''}
  </div>`;
}
function vDados() {
  const d = UI.draft;
  prefillDraft();
  const errs = UI.formErrors || {};
  const editing = !!d.editingId;
  const fld = (id, label, type, val, ph, extra = '', opt = false) => `<div class="fld ${errs[id] ? 'err' : ''}" id="f-${id}"><label for="in-${id}">${label}${opt ? '<em>opcional</em>' : ''}</label><input id="in-${id}" name="${id}" type="${type}" value="${esc(val)}" placeholder="${ph}" ${extra} aria-invalid="${!!errs[id]}" ${errs[id] ? `aria-describedby="m-${id}"` : ''}>${errs[id] ? `<div class="msg" id="m-${id}">${ic('alert')}${errs[id]}</div>` : ''}</div>`;
  return `<div class="scr bk">
  ${backBtn('agendar')}
  ${crest('m-only')}
  <div class="d-page">
    <section class="hero">
      <div class="hero-media"><img src="${A.hero_agendar}" alt="" width="756" height="470"></div>
      <div class="bk-copy">
        ${backD('agendar', 'Horário')}
        ${crestD(92)}
        <div class="eyebrow">Quase lá<br>só faltam seus dados</div>
        <span class="gold-rule"></span>
        <h1 class="htitle">Seus<br>dados.</h1>
        ${stepper([{ n: 3, label: 'Horário', st: 'done' }, { n: 4, label: 'Seus dados', st: 'cur' }, { n: 5, label: 'Confirmação', st: 'todo' }])}
      </div>
    </section>
    <div class="wrap bk-grid">
      <div class="bk-body">
        ${recapCard({ ...d, editable: true, total: sumPrice(d.serviceIds) })}
        <form class="form" id="dados-form" novalidate>
          ${fld('name', 'Nome', 'text', d.name, 'Como você gostaria de ser chamado', 'autocomplete="name"')}
          ${fld('phone', 'Telefone (WhatsApp)', 'tel', d.phone, '(00) 00000-0000', 'inputmode="numeric" autocomplete="tel"')}
          ${fld('email', 'E-mail', 'email', d.email, 'voce@email.com', 'autocomplete="email"', true)}
          ${ME ? '' : fld('password', 'Crie uma senha para acompanhar seus pontos', 'password', d.password || '', 'Mínimo de 6 caracteres', 'autocomplete="new-password"', true)}
        </form>
        ${ME && !d.touched ? `<div class="prefill"><span>Preenchido com os dados da sua conta.</span><button class="link" data-act="clear-form">Limpar campos</button></div>` : ''}
        ${!ME ? `<p class="note" style="margin-top:10px">Já tem conta? <button class="link" data-act="go-entrar">Entre</button> para agendar com seus dados e acumular pontos.</p>` : ''}
      </div>
      <aside class="bk-side">
        <div class="sumbar">${ic('calendar')}<span>${esc(svcLabel(d.serviceIds))} &nbsp;•&nbsp; ${fDM(d.date)} às ${d.time}</span></div>
        <div class="bk-cta"><button class="btn btn-gold btn-serif" data-act="confirm-booking" id="confirm-btn">${editing ? 'Salvar alterações' : 'Confirmar agendamento'} ${ic('right')}</button></div>
        <div class="info">${ic('info')}O pagamento é feito na barbearia. Os pontos do Clube entram depois que o atendimento é concluído.</div>
      </aside>
    </div>
  </div></div>`;
}

/* ---------- Confirmação ---------- */
function vConfirmado() {
  const b = UI.lastBooking;
  if (!b || !b.appt) return vHome();
  const a = b.appt;
  const edited = b.edited;
  const contaMsg = b.account === 'criada' ? 'Sua conta foi criada. Acompanhe seus pontos no Clube.'
    : b.passwordIgnored ? 'Este telefone já tem uma conta. Entre com a sua senha para acompanhar seus pontos.'
    : b.account === 'sem-conta' && !ME ? 'Para acompanhar seus pontos, peça na barbearia o código de primeiro acesso ou crie uma senha no próximo agendamento.' : '';
  return `<div class="scr bk cf">
  <div class="d-page cf-wrap">
    <div class="wrap" style="padding-top:calc(18px + env(safe-area-inset-top,0px))">
      <div class="cf-head">
        <img src="${A.crest}" alt="Cidade Nobre, Barbearia Premium" style="width:84px;height:auto">
        <span class="ok-mark">${ic('check')}</span>
        <div class="eyebrow" style="font-size:9.5px">Agendamento confirmado</div>
        <h1>${edited ? 'Alteração registrada' : `Tudo certo, ${esc(firstName(b.name))}.`}</h1>
        <p>${edited ? 'Seu horário foi atualizado na agenda da barbearia.' : 'Seu horário está reservado na agenda da barbearia.'}</p>
      </div>
      <div style="display:flex;justify-content:center;margin-top:16px">${stepper([{ n: 3, label: 'Horário', st: 'done' }, { n: 4, label: 'Seus dados', st: 'done' }, { n: 5, label: 'Confirmação', st: 'done' }]).replace('class="stepper"', 'class="stepper" style="width:100%;padding-right:0;margin-top:0"')}</div>
      <div class="recap" style="margin-top:16px">
        <div class="recap-row">${ic('user')}<div><small>Cliente</small><b>${esc(b.name)}</b><span class="note">${esc(b.phone)}${b.email ? ' · ' + esc(b.email) : ''}</span></div><span class="pill st-${a.status}">${STATUS[a.status]}</span></div>
      </div>
      ${recapCard({ items: a.items, proId: a.chosenPro, assigned: a.proId, date: a.date, time: a.time, total: a.price })}
      <div class="demo-banner">${ic('info')}<span>Os pontos entram no Clube depois que a barbearia marca o atendimento como concluído.${contaMsg ? ' ' + contaMsg : ''}</span></div>
      <div class="cf-actions">
        <button class="btn btn-gold btn-serif" data-go="perfil">${ME ? 'Ver meu perfil' : 'Entrar na minha conta'} ${ic('right')}</button>
        ${ME ? `<button class="btn btn-line" data-act="edit-appt" data-id="${a.id}">${ic('edit')} Revisar agendamento</button>` : ''}
        <button class="btn btn-ghost" data-go="home">Voltar ao início</button>
      </div>
    </div>
  </div></div>`;
}

/* ---------- Entrar (conta do cliente) ---------- */
function vEntrar(from) {
  const tab = UI.authTab === 'codigo' ? 'codigo' : 'entrar';
  const e = UI.authErr || '';
  const why = from === 'clube' ? 'Entre para ver seus pontos, benefícios e indicações.' : 'Entre para ver seus agendamentos e seus dados.';
  return `<div class="scr pf">
  <header class="phead"><span></span><span class="logo">${lockup(44)}</span><button class="menu-btn" data-act="menu" aria-label="Abrir menu">${ic('menu')}</button></header>
  <div class="d-page"><div class="wrap" style="max-width:520px;margin:0 auto">
    <div class="club-hd">
      <div class="kick">${from === 'clube' ? 'Clube Cidade Nobre' : 'Minha conta'}</div>
      <h1>${tab === 'codigo' ? 'Primeiro acesso' : 'Entrar'}</h1>
      <p>${tab === 'codigo' ? 'Use o código de 6 dígitos que a barbearia enviou e crie sua senha.' : why}</p>
    </div>
    <div class="seg2" role="tablist" style="margin-top:14px">${[['entrar', 'Tenho senha'], ['codigo', 'Tenho um código']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="auth-tab" data-k="${k}">${l}</button>`).join('')}</div>
    <form class="form" id="entrar-form" novalidate>
      <div class="fld"><label for="en-phone">Telefone (WhatsApp)</label><input id="en-phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(00) 00000-0000" value="${esc(UI.authPhone || '')}"></div>
      ${tab === 'codigo' ? `<div class="fld"><label for="en-code">Código de acesso</label><input id="en-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"></div>` : ''}
      <div class="fld"><label for="en-pass">${tab === 'codigo' ? 'Crie sua senha' : 'Senha'}</label><input id="en-pass" type="password" autocomplete="${tab === 'codigo' ? 'new-password' : 'current-password'}" placeholder="${tab === 'codigo' ? 'Mínimo de 6 caracteres' : 'Sua senha'}"></div>
      ${e ? `<div class="fld err"><div class="msg" role="alert">${ic('alert')}${esc(e)}</div></div>` : ''}
      <button class="btn btn-gold btn-serif" data-act="${tab === 'codigo' ? 'first-access' : 'login-client'}" type="submit">${tab === 'codigo' ? 'Criar senha e entrar' : 'Entrar'} ${ic('right')}</button>
    </form>
    <div class="info" style="margin-top:14px">${ic('info')}Ainda não tem senha? Crie uma ao fazer seu agendamento pelo site ou peça na barbearia um código de primeiro acesso.</div>
    <div style="margin-top:16px"><button class="btn btn-line" data-act="start-booking">Agendar meu horário ${ic('arrow')}</button></div>
  </div></div></div>`;
}

/* ---------- Clube ---------- */
const MOVE = { servico: ['Serviço concluído', 'scissors'], indicacao: ['Indicação concluída', 'userPlus'], resgate: ['Resgate de benefício', 'gift'], ajuste: ['Ajuste', 'edit'] };
const fStamp = s => { const [d, t] = String(s || '').split(' '); return d ? `${fLong(d)} • ${t || ''}` : ''; };
function moveRow(m) {
  const [t, i] = MOVE[m.type] || MOVE.ajuste;
  return `<button class="mrow" data-act="move" data-id="${m.id}"><span class="ring">${ic(i)}</span><span><b>${t}</b><small>${fStamp(m.at)}</small></span><span class="pts ${m.points < 0 ? 'neg' : ''}">${m.points > 0 ? '+' : '−'}${Math.abs(m.points)} pts</span>${ic('right', 'chev')}</button>`;
}
function vClube() {
  if (!ME) return vEntrar('clube');
  const c = ME.client, cb = club(), v = voucherOf();
  const ms = ME.moves;
  const shown = UI.histOpen ? ms : ms.slice(0, 2);
  const refs = ME.referralsGiven;
  const link = refLink(c.code);
  const p = Math.round(cb.progress * 100);
  return `<div class="scr club">
  <header class="phead"><span></span><span class="logo">${lockup(44)}</span><button class="menu-btn" data-act="menu" aria-label="Abrir menu">${ic('menu')}</button></header>
  <div class="d-page"><div class="wrap">
    <div class="club-hd">
      <div class="kick">Seu estilo merece recompensas</div>
      <h1>Clube Cidade Nobre</h1>
      <p>Cuide do visual. Acumule pontos. Aproveite.</p>
    </div>
    <div class="club-grid"><div>
      <section class="bal" aria-label="Seu saldo">
        <img class="wm" src="${A.crown_wm}" alt="">
        <div class="lbl">Seu saldo</div>
        <div class="num"><b class="tnum" id="bal-num">${cb.balance}</b><span>pontos</span></div>
        <span class="badge-member">${ic('crownF')}Membro Nobre</span>
        <p class="left">${cb.eligible ? 'Você atingiu a meta. Sua recompensa está disponível.' : `Faltam ${cb.left} pontos para sua próxima recompensa`}</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${cb.goal}" aria-valuenow="${Math.min(cb.balance, cb.goal)}" aria-label="Progresso até a recompensa"><i style="width:${p}%">${p >= 16 ? `<em>${p}%</em>` : ''}</i></div>
        <div class="bar-ends"><span>${cb.balance} pts</span><span>${cb.goal} pts</span></div>
      </section>
      <section class="ben ${cb.eligible ? 'ready' : ''}">
        <span class="gift">${ic('gift')}</span>
        <div class="ben-t"><small>${cb.eligible ? 'Benefício liberado' : 'Seu próximo benefício'}</small><b>${esc(DB.benefit.title)}</b><span>Resgate com ${DB.benefit.cost} pontos</span></div>
        <div class="ben-wrap">${cb.eligible ? `<button class="btn btn-gold" data-act="redeem-ask">Resgatar agora</button>` : `<button class="btn btn-ghost" aria-disabled="true" disabled>Resgatar ao atingir a meta</button>`}</div>
      </section>
      ${v ? `<div class="voucher">${ic('ticket')}<div><b>${esc(v.title)} disponível</b><br>Aplicado automaticamente no próximo atendimento concluído.</div></div>` : ''}
      <h2 class="h-bold h-gp">Ganhe pontos</h2>
      <div class="earn">
        <button class="earn-c" data-act="rule" data-rule="servico"><span class="ring">${ic('scissors')}</span><span><b>Serviços concluídos</b><small>A cada R$ 1 pago, ganhe ${DB.rules.perReal} ponto${DB.rules.perReal === 1 ? '' : 's'}</small></span>${ic('right', 'chev')}</button>
        <button class="earn-c" data-act="rule" data-rule="indicacao"><span class="ring">${ic('userPlus')}</span><span><b>Indique e ganhe</b><small>Ganhe ${DB.rules.referral} pontos após o primeiro atendimento do seu amigo</small></span>${ic('right', 'chev')}</button>
      </div>
    </div><div>
      <div class="ref-h"><h2 class="h-bold">Seu link de indicação</h2><p>Convide um amigo para conhecer a Cidade Nobre.</p></div>
      <div class="linkbox">${ic('link')}<input id="ref-link" readonly value="${esc(link)}" aria-label="Seu link de indicação"><button data-act="copy-link" aria-label="Copiar link">${ic('copy')}</button>${typeof navigator !== 'undefined' && navigator.share ? `<button data-act="share-native" aria-label="Compartilhar pelo sistema">${ic('share')}</button>` : ''}</div>
      <div class="ref-actions">
        <button class="btn btn-gold" data-act="copy-link">${ic('copy')} Copiar meu link</button>
        <a class="btn btn-line" data-act="share-wa" href="https://wa.me/?text=${encodeURIComponent(`Conheça a Cidade Nobre, Barbearia Premium. Agende pelo meu link: ${link}`)}" target="_blank" rel="noopener">${ic('wa')} Compartilhar no WhatsApp</a>
      </div>
      <div class="info">${ic('info')}Pontos liberados após o primeiro atendimento concluído do seu amigo.</div>
      <div class="hr"></div>
      <h2 class="h-bold">Últimos pontos</h2>
      <div class="mlist">${shown.length ? shown.map(moveRow).join('') : `<div class="empty" style="border:0">Nenhuma movimentação ainda. Os pontos aparecem aqui após o primeiro atendimento concluído.</div>`}
        ${ms.length > 2 ? `<button class="more" data-act="hist-toggle">${UI.histOpen ? 'Mostrar menos' : `Ver histórico completo (${ms.length})`}</button>` : ''}
      </div>
      ${refs.length ? `<h2 class="h-bold" style="margin-top:18px;font-size:18px">Suas indicações</h2><div class="refs">${refs.map(r => `<div class="ref-it"><div><b>${esc(ME.names[r.referredId] || '')}</b><small>Indicado em ${fDM(r.createdAt)}</small></div>${r.status === 'concluida' ? `<span class="pill st-concluido">+${DB.rules.referral} pts liberados</span>` : `<span class="pill st-confirmado">Aguardando 1º atendimento</span>`}</div>`).join('')}</div>` : ''}
    </div></div>
  </div></div></div>`;
}

/* ---------- Perfil ---------- */
function vPerfil() {
  if (!ME) return vEntrar('perfil');
  const c = ME.client, s = ME.stats, cb = club();
  const T = todayStr();
  const list = ME.appts;
  const all = list.slice().reverse();
  const upcoming = list.filter(a => isOpenStatus(a) && a.date >= T);
  const next = upcoming[0];
  const past = all.filter(a => !(isOpenStatus(a) && a.date >= T));
  const hist = past.slice(0, UI.pfMore ? 50 : 5);
  const later = upcoming.slice(1);
  const pn = id => esc(proName(id, ME.proNames));
  return `<div class="scr pf">
  <header class="phead"><span></span><span class="logo">${lockup(44)}</span><button class="menu-btn" data-act="menu" aria-label="Abrir menu">${ic('menu')}</button></header>
  <div class="d-page"><div class="wrap">
    <div class="pf-grid"><div>
      <section class="pf-card">
        <span class="avatar">${initials(c.name)}</span>
        <div><h1>${esc(c.name)}</h1><p>Cliente desde ${fMonthYear(c.createdAt)}</p><span class="badge-member">${ic('crownF')}Membro Nobre</span></div>
      </section>
      <button class="pf-pts" data-go="clube">
        <div><small>Clube Cidade Nobre</small><b class="tnum">${cb.balance} pts</b><div class="bar"><i style="width:${Math.round(cb.progress * 100)}%"></i></div></div>
        <span class="link">${cb.eligible ? 'Resgatar recompensa' : `Faltam ${cb.left} pts`} ${ic('right')}</span>
      </button>
      <section class="sec">
        <div class="sec-h"><h2 class="h-bold" style="font-size:19px">${upcoming.length > 1 ? 'Próximos agendamentos' : 'Próximo agendamento'}</h2>${upcoming.length > 1 ? `<span class="note">${upcoming.length} horários marcados</span>` : ''}</div>
        ${next ? `<div class="next">
          <div class="next-top"><div><div class="when">${fDayLong(next.date).replace(/^./, m => m.toUpperCase())}<br>às ${next.time}</div><div class="what">${esc(apptNames(next).join(' + '))} · ${pn(next.proId)}</div></div><span class="pill st-${next.status}">${STATUS[next.status]}</span></div>
          <div class="next-actions"><button class="btn btn-line" data-act="edit-appt" data-id="${next.id}">${ic('edit')} Alterar</button><button class="btn btn-ghost" data-act="cancel-ask" data-id="${next.id}">Cancelar</button></div>
        </div>${later.length ? `<div class="hist" style="margin-top:8px">${later.map(a => { const dd = parseD(a.date); return `<div class="hrow"><div class="hdate"><b>${pad(dd.getDate())}</b><small>${MES[dd.getMonth()].replace('.', '')}</small></div><div><div class="t">${esc(apptNames(a).join(' + '))}</div><div class="s">${a.time} · ${pn(a.proId)}</div></div><button class="link" data-act="edit-appt" data-id="${a.id}">Alterar</button></div>`; }).join('')}</div>` : ''}` : `<div class="next" style="text-align:center"><div class="what" style="margin:0 0 12px">Você não tem horários marcados.</div><button class="btn btn-gold" data-act="start-booking">Agendar meu horário ${ic('arrow')}</button></div>`}
      </section>
    </div><div>
      <section class="sec">
        <div class="sec-h"><h2 class="h-bold" style="font-size:19px">Histórico de atendimentos</h2><span class="note">${s.visits} concluído${s.visits === 1 ? '' : 's'}</span></div>
        <div class="hist">${hist.length ? hist.map(a => { const dd = parseD(a.date); const mv = ME.moves.find(m => m.type === 'servico' && m.apptId === a.id); return `<div class="hrow"><div class="hdate"><b>${pad(dd.getDate())}</b><small>${MES[dd.getMonth()].replace('.', '')}</small></div><div><div class="t">${esc(apptNames(a).join(' + '))}</div><div class="s">${a.time} · ${pn(a.proId)}${mv ? ` · +${mv.points} pts` : ''}</div></div><span class="pill st-${a.status}">${STATUS[a.status]}</span></div>`; }).join('') : `<div class="empty" style="border:0">Nenhum atendimento anterior.</div>`}</div>
        ${past.length > 5 ? `<button class="more" style="border:0" data-act="pf-more">${UI.pfMore ? 'Mostrar menos' : 'Ver todos'}</button>` : ''}
      </section>
      <section class="sec">
        <div class="sec-h"><h2 class="h-bold" style="font-size:19px">Meus dados</h2><button class="link" data-act="edit-profile">${ic('edit')} Editar</button></div>
        <div class="kv"><div><span>Nome</span><b>${esc(c.name)}</b></div><div><span>Telefone</span><b>${esc(c.phone)}</b></div><div><span>E-mail</span><b>${esc(c.email || 'não informado')}</b></div><div><span>Código de indicação</span><b>${esc(c.code)}</b></div></div>
        <div style="display:flex;gap:14px;margin-top:12px;flex-wrap:wrap"><button class="link" data-act="client-pass">Alterar senha</button><button class="link" data-act="logout-client">Sair da conta</button></div>
      </section>
    </div></div>
  </div></div></div>`;
}

/* ---------- menu drawer ---------- */
function vMenu() {
  const cur = NAV_OF[UI.screen];
  return `<div class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="drawer-top">${lockup(40)}<button class="x" data-act="close" aria-label="Fechar menu">${ic('x')}</button></div>
    <div class="dnav">${NAV.map(n => `<button class="${n.id === cur ? 'on' : ''}" data-go="${n.id}">${ic(n.icon)}${n.id === 'clube' ? 'Clube Cidade Nobre' : n.id === 'perfil' ? 'Meu perfil' : n.label}</button>`).join('')}</div>
    <div class="foot">
      ${ME ? `<div class="note">Conectado como <b style="color:var(--text)">${esc(ME.client.name)}</b></div><button class="btn btn-ghost" data-act="logout-client">Sair da conta</button>` : `<button class="btn btn-line" data-go="perfil">${ic('user')} Entrar na minha conta</button>`}
      <a class="demo-chip" href="/gestao" data-act="to-admin" style="text-decoration:none">Área da equipe</a>
    </div>
  </div>`;
}

function vClient() {
  const s = UI.screen;
  const map = { home: vHome, servicos: vServicos, agendar: vAgendar, dados: vDados, confirmado: vConfirmado, clube: vClube, perfil: vPerfil, entrar: () => vEntrar('perfil') };
  const body = (map[s] || vHome)();
  return `<div class="cx">${topBar(s)}${body}${bottomNav(s)}</div>`;
}
