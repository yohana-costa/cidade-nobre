// Teste de navegador (Playwright) contra o sistema real: site + API + banco.
//   npm run dev:api   (API na 3341, banco com seed)
//   npm run dev       (site na 8092, repassa /api)
//   npm test          (SITE_URL=http://localhost:8092 por padrão; usa o Chrome instalado)
// Percorre o fluxo do cliente (agendar, conta, clube, indicação) e o da gestão
// (login, painel, agenda, conclusão, clientes, catálogo, regras), em celular e desktop,
// e falha se aparecer erro no console ou texto de demonstração na tela.
import { chromium } from 'playwright';

const BASE = (process.env.SITE_URL || 'http://localhost:8092').replace(/\/$/, '');
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@cidadenobre.com.br', senha: process.env.ADMIN_SENHA || 'admin123' };
const VIEWPORTS = [[390, 844, 'celular'], [1366, 860, 'desktop']];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome' });
let fails = 0, total = 0, CUR = null;
const rnd = () => Math.floor(Math.random() * 1e8);
const DEMO = /demonstra|fict[ií]ci|prot[oó]tipo|ilustrativ|simulad/i;

async function run(W, H, label) {
  console.log(`\n=== ${label} (${W}x${H})`);
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const p = await ctx.newPage();
  CUR = p;
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  // 401/409 esperados (senha errada, horário ocupado) aparecem como "Failed to load resource"; o resto conta
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const log = (ok, msg) => { total++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };
  const txt = async sel => (await p.textContent(sel))?.replace(/\s+/g, ' ').trim();
  const desk = W >= 960;
  const nav = desk ? '.cx-top nav' : '.bnav';
  const toastHas = async re => { try { await p.waitForFunction(r => new RegExp(r, 'i').test(document.getElementById('toast').textContent), re.source, { timeout: 6000 }); return true; } catch { return false; } };

  /* ---------- cliente ---------- */
  await p.goto(BASE + '/'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('.home');
  log(!DEMO.test(await p.textContent('body')), 'início sem textos de demonstração');
  log(!(await p.$('[data-act="mode"]')), 'sem atalho cliente/gestão de demonstração');
  await p.click(`${nav} [data-go="servicos"]`);
  await p.waitForSelector('[data-act="svc-toggle"]');
  const ids = await p.$$eval('[data-act="svc-toggle"]', n => n.map(x => x.dataset.id));
  await p.click(`[data-act="svc-toggle"][data-id="${ids[0]}"]`);
  await p.click(`[data-act="svc-toggle"][data-id="${ids[1]}"]`);
  log((await txt('[data-act="svc-continue"]')).includes('2 serviços'), 'dois serviços selecionados');
  await p.click('[data-act="svc-continue"]');
  await p.waitForSelector('[data-act="slot"]');
  log(!DEMO.test(await p.textContent('body')), 'agendamento sem textos de demonstração');
  // escolhe um profissional; se a agenda dele estiver cheia nos próximos dias, volta para "sem preferência"
  await p.click('[data-act="pro"] >> nth=1');
  if (!(await p.waitForSelector('[data-act="slot"]', { timeout: 5000 }).catch(() => null))) { await p.click('[data-act="pro"] >> nth=0'); await p.waitForSelector('[data-act="slot"]'); }
  await p.click('[data-act="slot"] >> nth=0');
  log(/às \d\d:\d\d/.test(await txt('.sumbar span')), `horário escolhido: ${await txt('.sumbar span')}`);
  await p.click('[data-act="to-dados"]');
  await p.click('[data-act="confirm-booking"]');
  log((await p.$$('.fld.err')).length === 2, 'nome e telefone obrigatórios');
  const nomeA = `Cliente Teste ${rnd()}`, foneA = `11 9${String(rnd()).padStart(8, '0')}`;
  await p.fill('#in-name', nomeA);
  await p.fill('#in-phone', foneA);
  await p.fill('#in-password', 'senha123');
  await p.click('[data-act="confirm-booking"]');
  await p.waitForSelector('.cf-head', { timeout: 10000 });
  log((await txt('.cf-head h1')).includes(nomeA.split(' ')[0]) && !DEMO.test(await p.textContent('body')), 'agendamento confirmado e conta criada');
  const booked = await p.evaluate(() => UI.lastBooking.appt);
  await p.click(`${nav} [data-go="clube"]`);
  await p.waitForSelector('#bal-num');
  log((await txt('#bal-num')) === '0', 'clube da conta nova com 0 pontos');
  const link = await p.inputValue('#ref-link');
  log(/\/indique\/CN[A-Z0-9]{5}$/.test(link), `link de indicação ${link}`);
  await p.click('.ref-actions [data-act="copy-link"]');
  log(await p.evaluate(() => navigator.clipboard.readText().catch(() => '')) === link, 'copiar link');
  await p.click(`${nav} [data-go="perfil"]`);
  await p.waitForSelector('.pf-card');
  log((await txt('.next .when')).length > 5, 'perfil mostra o próximo agendamento');
  await p.click('.kv ~ div [data-act="logout-client"]');
  await p.click(`${nav} [data-go="clube"]`);
  log(!!(await p.$('#entrar-form')), 'clube sem login pede para entrar');
  await p.fill('#en-phone', foneA); await p.fill('#en-pass', 'errada1');
  await p.click('[data-act="login-client"]');
  await p.waitForSelector('#entrar-form .fld.err');
  log(/incorretos/.test(await txt('#entrar-form')), 'senha errada mostra erro');
  await p.fill('#en-pass', 'senha123');
  await p.click('[data-act="login-client"]');
  await p.waitForSelector('#bal-num');
  log(true, 'entrar com telefone e senha');
  await p.click(`${nav} [data-go="perfil"]`); await p.waitForSelector('.pf-card');
  await p.click('.kv ~ div [data-act="logout-client"]');
  // indicação: abrir o link e agendar como cliente novo
  await p.goto(link.replace(/^https?:\/\/[^/]+/, BASE));
  log(await toastHas(/indicado por Cliente/), 'link de indicação reconhecido');
  log(new URL(p.url()).pathname === '/', 'endereço volta para a página inicial');
  await p.click('[data-act="start-booking"]');
  await p.click(`[data-act="svc-toggle"][data-id="${ids[0]}"]`);
  await p.click('[data-act="svc-continue"]');
  await p.waitForSelector('[data-act="slot"]');
  await p.click('[data-act="slot"] >> nth=-1');
  await p.click('[data-act="to-dados"]');
  const nomeB = `Indicado Teste ${rnd()}`;
  await p.fill('#in-name', nomeB); await p.fill('#in-phone', `21 9${String(rnd()).padStart(8, '0')}`);
  await p.click('[data-act="confirm-booking"]');
  await p.waitForSelector('.cf-head', { timeout: 10000 });
  log(await p.evaluate(() => !UI.refCode), 'agendamento do indicado enviado com o código');

  /* ---------- gestão ---------- */
  await p.goto(BASE + '/gestao');
  await p.waitForSelector('#staff-form');
  log(!(await p.$('.ad')), 'gestão exige login');
  await p.fill('#st-email', ADMIN.email); await p.fill('#st-pass', 'errada');
  await p.click('[data-act="login-staff"]');
  await p.waitForSelector('#staff-form .fld.err');
  await p.fill('#st-pass', ADMIN.senha);
  await p.click('[data-act="login-staff"]');
  await p.waitForSelector('.kpi .v');
  log(!DEMO.test(await p.textContent('body')), 'painel sem textos de demonstração');
  const vals = {};
  for (const k of ['hoje', '7', '30']) {
    await p.click(`[data-act="period"][data-p="${k}"]`);
    await p.waitForFunction(k => document.querySelector(`[data-act="period"][data-p="${k}"]`).classList.contains('on') && document.querySelector('.kpi .v'), k);
    await p.waitForSelector('.kpi .v');
    vals[k] = (await p.$$eval('.kpi .v', n => n.map(x => x.textContent.trim()))).slice(0, 4).join('|');
  }
  log(Object.values(vals).every(v => v.length > 3), `indicadores dos 3 períodos ${JSON.stringify(vals)}`);
  const goAdmin = async id => { if (!desk || W < 1024) { await p.click('[data-act="amenu"]'); await p.click(`#layer [data-act="anav"][data-id="${id}"]`); } else await p.click(`.ad-side [data-act="anav"][data-id="${id}"]`); };
  // o agendamento feito pelo site aparece na agenda do dia
  await goAdmin('agenda');
  await p.waitForSelector('.ag-sum');
  await p.evaluate(d => { UI.agDate = d; render(true); }, booked.date);
  const sel = `${W >= 760 ? '.blk' : '.ag-card'}[data-id="${booked.id}"]`;
  await p.waitForSelector(sel, { timeout: 8000 }).catch(() => null);
  log(!!(await p.$(sel)), 'agendamento do site aparece na agenda');
  // registrar um atendimento de balcão hoje (ou no último dia aberto) e concluir
  await p.click('[data-act="new-appt"]');
  await p.waitForSelector('#na-form');
  await p.fill('#na-name', `Balcão Teste ${rnd()}`); await p.fill('#na-phone', `31 9${String(rnd()).padStart(8, '0')}`);
  await p.check(`input[name="na-svc"][value="${ids[0]}"]`);
  let ok = false, hlId = null;
  p.on('response', async r => { if (r.request().method() === 'POST' && r.url().endsWith('/api/gestao/agendamentos') && r.status() === 201) hlId = (await r.json()).id; });
  for (let back = 0; back < 10 && !ok; back++) {
    const d = await p.evaluate(n => addDays(todayStr(), -n), back);
    for (const t of ['09:00', '09:30', '10:30', '12:00', '12:30', '15:00', '18:00']) {
      await p.fill('#na-date', d); await p.fill('#na-time', t);
      await Promise.all([p.waitForResponse(r => r.url().endsWith('/api/gestao/agendamentos') && r.request().method() === 'POST'), p.click('[data-act="new-appt-save"]')]);
      await p.waitForTimeout(150);
      if (!(await p.$('#na-form'))) { ok = true; break; }
    }
  }
  log(ok, 'registrar atendimento de balcão');
  await p.waitForSelector(`.ad-body [data-act="appt"][data-id="${hlId}"]:visible`);
  await p.click(`.ad-body [data-act="appt"][data-id="${hlId}"]:visible`);
  await p.waitForSelector('.modal [data-act="ask"][data-s="concluido"]');
  await p.click('.modal [data-act="ask"][data-s="concluido"]');
  await p.click('.modal .confirm-box [data-act="st"]');
  log(await toastHas(/pts/), `concluir gera pontos: ${await txt('#toast')}`);
  await p.keyboard.press('Escape');
  // clientes
  await goAdmin('clientes');
  await p.waitForSelector('#client-q');
  await p.fill('#client-q', nomeA);
  await p.waitForSelector(`#client-results [data-act="client"]:visible`);
  await p.click('#client-results [data-act="client"]:visible');
  await p.waitForSelector('.modal [data-act="access-code"]');
  await p.click('.modal [data-act="access-code"]');
  await p.waitForSelector('.modal .callout.ok');
  log(/\d{6}/.test(await txt('.modal .callout.ok')), 'gerar código de primeiro acesso');
  await p.keyboard.press('Escape');
  // serviços: criar, ocultar e remover
  await goAdmin('servicos');
  await p.waitForSelector('[data-act="svc-new"]');
  await p.click('[data-act="svc-new"]');
  const nomeSvc = `Serviço Teste ${rnd()}`;
  await p.fill('#in-sname', nomeSvc); await p.fill('#in-dur', '25'); await p.fill('#in-price', '42');
  await p.click('[data-act="svc-save"]');
  await p.waitForFunction(n => document.body.textContent.includes(n) && !document.querySelector('#svc-form'), nomeSvc);
  log(true, 'criar serviço');
  const sid = await p.evaluate(n => CACHE['cat-gestao'].data.services.find(s => s.name === n)?.id || DB.services.find(s => s.name === n)?.id, nomeSvc);
  log(await p.evaluate(id => DB.services.some(s => s.id === id), sid), 'serviço novo no catálogo do site');
  await p.click(`[data-act="svc-edit"][data-id="${sid}"]`);
  await p.click('[data-act="svc-del-ask"]'); await p.click('[data-act="svc-del"]');
  await p.waitForFunction(id => !DB.services.some(s => s.id === id), sid);
  log(true, 'remover serviço');
  await p.click('[data-act="svctab"][data-k="equipe"]');
  await p.waitForSelector('[data-act="pro-svc"]');
  log((await p.$$('.pro-cards .panel')).length >= 2, 'equipe com profissionais');
  // regras
  await goAdmin('config');
  await p.waitForSelector('#cf-lapse');
  const lapse = await p.inputValue('#cf-lapse');
  await p.fill('#cf-lapse', '50'); await p.click('[data-act="cfg-save"]');
  log(await toastHas(/Regras salvas/), 'salvar regras');
  await p.fill('#cf-lapse', lapse); await p.click('[data-act="cfg-save"]'); await toastHas(/Regras salvas/);
  for (const id of ['fidelidade', 'oportunidades', 'dash']) { await goAdmin(id); await p.waitForSelector('.ad-body .seg2, .ad-body .kpis'); }
  log(!(await p.$('.ad-body [role="alert"]')), 'fidelidade, oportunidades e painel sem erro');
  await p.click(desk && W >= 1024 ? '.ad-side [data-act="logout-staff"]' : '[data-act="amenu"]');
  if (!(desk && W >= 1024)) await p.click('#layer [data-act="logout-staff"]');
  await p.waitForSelector('#staff-form');
  log(true, 'sair da gestão');
  log(errs.length === 0, `sem erros no console ${errs.length ? JSON.stringify(errs) : ''}`);
  await ctx.close();
}

for (const [w, h, l] of VIEWPORTS.filter(v => !process.env.SO || v[2] === process.env.SO)) {
  try { await run(w, h, l); } catch (e) {
    fails++; total++; console.log(`FAIL  ${l}: ${e.message.split('\n').slice(0, 4).join(' | ')}`);
    if (process.env.SHOT) await CUR.screenshot({ path: process.env.SHOT }).catch(() => {});
  }
}
await b.close();
console.log(`\n${total - fails}/${total} verificações passaram.`);
process.exit(fails ? 1 : 0);
