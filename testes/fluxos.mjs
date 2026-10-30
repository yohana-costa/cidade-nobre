// Testes funcionais do protótipo (Playwright).
//   npm install && npx playwright install chromium
//   npm test                -> testa dist/Cidade-Nobre-Prototipo-SMG.html (rode python3 build.py antes)
//   npm run test:dev        -> testa dev.html (código de src/ sem build)
// Cobre os 14 cenários do briefing + persistência, em celular, tablet e desktop.
import { chromium } from 'playwright';
import { serve } from './servidor.mjs';

const TARGET = process.argv.includes('--dev') ? 'dev.html' : 'dist/Cidade-Nobre-Prototipo-SMG.html';
const VIEWPORTS = [[390, 844, 'celular'], [820, 1180, 'tablet'], [1366, 860, 'desktop']];
const { srv, base } = await serve();
const URL = base + TARGET;
const b = await chromium.launch();
let fails = 0, total = 0;

async function run(W, H, label) {
  console.log(`\n=== ${label} (${W}x${H}) — ${TARGET}`);
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new globalThis.URL(base).origin });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const log = (ok, msg) => { total++; if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };
  const txt = async sel => (await p.textContent(sel))?.replace(/\s+/g, ' ').trim();
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  const nav = W >= 960 ? '.cx-top nav' : '.bnav';
  // 1
  await p.click(`${nav} [data-go="servicos"]`);
  for (const id of ['s1', 's2', 's6']) await p.click(`[data-act="svc-toggle"][data-id="${id}"]`);
  log((await txt('[data-act="svc-continue"]')).includes('3 serviços'), '1a três serviços selecionados');
  await p.click('[data-act="svc-toggle"][data-id="s2"]');
  log((await txt('[data-act="svc-continue"]')).includes('2 serviços') && await p.getAttribute('[data-id="s2"]', 'aria-pressed') === 'false', '1b remover um serviço atualiza contagem');
  await p.click('[data-act="cat-filter"][data-cat="barba"]');
  await p.click('[data-act="cat-filter"][data-cat="todos"]');
  log(await p.getAttribute('[data-id="s1"]', 'aria-pressed') === 'true', '1c seleção mantida ao trocar categoria');
  // 2
  await p.click('[data-act="svc-continue"]');
  const sum1 = await txt('.svc-sum-t b');
  log(sum1.includes('Corte masculino') && sum1.includes('Sobrancelhas'), `2a resumo mostra serviços: ${sum1}`);
  await p.click(W >= 960 ? '.back-d' : '.back');
  log(await p.getAttribute('[data-id="s6"]', 'aria-pressed') === 'true', '2b voltar preserva serviços');
  await p.click('[data-act="svc-continue"]');
  // 3
  await p.click('[data-act="pro"][data-id="p1"]');
  log((await p.getAttribute('[data-act="pro"][data-id="p1"]', 'aria-checked')) === 'true', '3a profissional selecionado');
  const days = await p.$$('[data-act="day"]'); await days[2].click();
  const slots = await p.$$('[data-act="slot"]'); await slots[slots.length - 1].click();
  let sb = await txt('.sumbar span');
  log(/às \d\d:\d\d/.test(sb), `3b dia e horário no resumo: ${sb}`);
  await p.click('[data-act="pro"][data-id="p2"]');
  const d3 = await p.$$('[data-act="day"]'); await d3[3].click();
  const s3 = await p.$$('[data-act="slot"]'); await s3[0].click();
  sb = await txt('.sumbar span'); log(/às \d\d:\d\d/.test(sb), `3c alterar profissional, dia e horário: ${sb}`);
  const chosen = await p.evaluate(() => ({ ...UI.draft }));
  // 4
  await p.click('[data-act="to-dados"]');
  await p.click('[data-act="clear-form"]');
  await p.click('[data-act="confirm-booking"]'); await p.waitForTimeout(200);
  log((await p.$$('.fld.err')).length === 2 && await p.evaluate(() => UI.screen) === 'dados', '4 campos obrigatórios vazios bloqueiam e mostram erro');
  // back and forth keeps choices
  await p.click(W >= 960 ? '.back-d' : '.back');
  const kept = await p.evaluate(() => UI.draft);
  log(kept.time === chosen.time && kept.date === chosen.date && kept.proId === 'p2', '2c voltar do formulário mantém dia/horário/profissional');
  await p.click('[data-act="to-dados"]');
  // 5
  await p.fill('#in-name', 'Carlos Demonstração');
  await p.fill('#in-phone', '11977776666');
  log(await p.inputValue('#in-phone') === '(11) 97777-6666', '5a máscara de telefone');
  await p.click('[data-act="confirm-booking"]'); await p.waitForTimeout(1300);
  log(await p.evaluate(() => UI.screen) === 'confirmado' && (await txt('.cf-head h1')).includes('Carlos'), '5b agendamento concluído com confirmação');
  const newId = await p.evaluate(() => UI.lastAppt);
  const pfName = await p.evaluate(() => cli(DB.activeClientId).name);
  log(pfName === 'Carlos Demonstração', '5c perfil passa a ser do cliente que agendou');
  // 6
  await p.click('[data-act="see-in-admin"]'); await p.waitForTimeout(300);
  const hl = await p.$(`.blk[data-id="${newId}"], .ag-card[data-id="${newId}"]`);
  log(!!hl, '6 agendamento aparece na agenda administrativa');
  // 7
  await p.click(`${W >= 760 ? '.blk' : '.ag-card'}[data-id="${newId}"]`);
  await p.click('.modal [data-act="client"]'); await p.waitForTimeout(150);
  const cm = await txt('.modal');
  log(cm.includes('Carlos Demonstração') && cm.includes('Corte masculino + Sobrancelhas'.split(' + ')[0]), '7 histórico do cliente no painel');
  await p.keyboard.press('Escape');
  // 8 / 9 / 10
  await p.evaluate(() => { DB.activeClientId = 'c1'; save(); });
  await p.evaluate(() => { UI.mode = 'client'; UI.screen = 'clube'; render(); });
  log((await txt('#bal-num')) === '180' && (await txt('.bal .left')).includes('Faltam 70') && (await txt('.bar i em')) === '72%', '10 saldo 180, faltam 70, 72%');
  log(await p.isDisabled('.ben .btn-ghost'), '11a resgate indisponível abaixo da meta');
  await p.click('.ref-actions [data-act="copy-link"]'); await p.waitForTimeout(150);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  log(clip === 'https://cidade-nobre.exemplo/indique/CN180' && (await txt('#toast')).includes('copiado'), `8 copiar link (${clip})`);
  const href = await p.getAttribute('[data-act="share-wa"]', 'href');
  log(href.startsWith('https://wa.me/?text=') && !/phone=/.test(href) && await p.getAttribute('[data-act="share-wa"]', 'target') === '_blank', '9 WhatsApp abre com texto pronto, sem destinatário nem envio');
  const balAfterCopy = await p.evaluate(() => balance('c1'));
  log(balAfterCopy === 180, '9b copiar/compartilhar não gera pontos');
  // 11/12: concluir indicação (Diego) e atendimento do Lucas no painel
  const ids = await p.evaluate(() => ({ diego: DB.appts.find(a => a.clientId === 'c3' && a.status === 'confirmado').id, lucas: DB.appts.find(a => a.clientId === 'c1' && a.status === 'confirmado').id, date: DB.appts.find(a => a.clientId === 'c3' && a.status === 'confirmado').date }));
  await p.evaluate(d => { UI.mode = 'admin'; UI.admin = 'agenda'; UI.agDate = d; render(); }, ids.date);
  for (const id of [ids.diego, ids.lucas]) {
    await p.click(`${W >= 760 ? '.blk' : '.ag-card'}[data-id="${id}"]`);
    await p.click('.modal [data-act="ask"][data-s="concluido"]');
    await p.click('.modal .confirm-box [data-act="st"]'); await p.waitForTimeout(150);
    log((await txt('#toast')).includes('pts'), `11 conclusão gera pontos: ${await txt('#toast')}`);
    await p.keyboard.press('Escape');
  }
  const bal2 = await p.evaluate(() => balance('c1'));
  log(bal2 === 275, `11b saldo após indicação (+50) e atendimento (+45): ${bal2}`);
  const dup = await p.evaluate(id => { conclude(id); conclude(id); return DB.moves.filter(m => m.apptId === id).length; }, ids.lucas);
  const refMoves = await p.evaluate(() => DB.moves.filter(m => m.type === 'indicacao' && m.referralId === 'r2').length);
  log(dup === 1 && refMoves === 1, '12 sem créditos duplicados para o mesmo atendimento/indicação');
  await p.evaluate(() => { UI.mode = 'client'; UI.screen = 'clube'; render(); });
  log(await p.isVisible('[data-act="redeem-ask"]') && (await txt('.bar i em')) === '100%', '11c meta atingida libera resgate');
  await p.click('[data-act="redeem-ask"]'); await p.click('[data-act="redeem"]'); await p.waitForTimeout(150);
  const r11 = { bal: await txt('#bal-num'), hist: (await txt('.mlist')).slice(0, 80), v: await p.isVisible('.voucher') };
  log(r11.bal === '25' && r11.hist.includes('Resgate de benefício') && r11.v, `11d resgate consome 250 e entra no histórico ${JSON.stringify(r11)}`);
  // 13
  await p.evaluate(() => { UI.mode = 'admin'; UI.admin = 'dash'; render(); });
  const vals = {};
  for (const k of ['hoje', '7', '30']) {
    await p.click(`[data-act="period"][data-p="${k}"]`);
    const shown = await p.$$eval('.kpi .v', n => n.map(x => x.textContent.trim()));
    const exp = await p.evaluate(k => { const r = periodRange(k); const m = metrics(r.from, r.to); return [m.total, m.done]; }, k);
    vals[k] = shown[0];
    log(shown[0] === String(exp[0]) && shown[1] === String(exp[1]), `13 período ${k}: agendamentos ${shown[0]}, concluídos ${shown[1]}`);
  }
  log(new Set(Object.values(vals)).size === 3, '13b filtros alteram os indicadores');
  // 14
  if (W < 1024) await p.click('[data-act="amenu"]');
  await p.click(W < 1024 ? '#layer [data-act="reset-ask"]' : '.ad-side [data-act="reset-ask"]'); await p.click('[data-act="reset"]'); await p.waitForTimeout(150);
  const after = await p.evaluate(() => ({ b: balance('c1'), n: DB.appts.filter(a => a.fromDemo).length, act: DB.activeClientId }));
  log(after.b === 180 && after.n === 0 && after.act === 'c1', '14 restaurar dados iniciais');
  // persistence
  await p.evaluate(() => { UI.mode = 'client'; go('servicos'); }); await p.click('[data-act="svc-toggle"][data-id="s3"]'); await p.reload(); await p.waitForTimeout(300);
  log(await p.evaluate(() => UI.screen === 'servicos' && UI.draft.serviceIds.includes('s3')), '15 estado persiste após recarregar');  log(errs.length === 0, `sem erros no console ${errs.length ? JSON.stringify(errs) : ''}`);
  await ctx.close();
}

for (const [w, h, l] of VIEWPORTS) await run(w, h, l);
await b.close(); srv.close();
console.log(`\n${total - fails}/${total} verificações passaram.`);
process.exit(fails ? 1 : 0);
