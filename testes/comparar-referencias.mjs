// Gera imagens lado a lado (referência | protótipo) das 4 telas aprovadas, na mesma largura de celular.
//   npm run comparar  -> build/comparacao/*.jpg  (precisa de python3 build.py antes)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serve, ROOT } from './servidor.mjs';

const OUT = path.join(ROOT, 'build', 'comparacao');
await mkdir(OUT, { recursive: true });
const { srv, base } = await serve();
const W = 390, H = 822, DSF = 759 / 390; // mesma escala dos prints de referência
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF })).newPage();
await p.goto(base + 'dist/Cidade-Nobre-Prototipo-SMG.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
const shot = async n => { await p.waitForTimeout(450); return p.screenshot({ type: 'png' }); };
const shots = {};
shots.home = await shot();
await p.click('.bnav [data-go="servicos"]'); await p.click('[data-act="svc-toggle"][data-id="s1"]'); shots.servicos = await shot();
await p.click('[data-act="svc-continue"]');
const days = await p.$$('[data-act="day"]'); if (days[1]) await days[1].click();
const s = await p.$('[data-act="slot"][data-time="14:30"]'); if (s) await s.click();
shots.agendar = await shot();
await p.click('.bnav [data-go="clube"]'); shots.clube = await shot();
// monta lado a lado no próprio navegador (sem dependências extras)
for (const [name, png] of Object.entries(shots)) {
  const ref = base + 'referencias/' + name + '.jpg';
  const c = await (await b.newContext({ viewport: { width: 1540, height: 1600 } })).newPage();
  await c.setContent(`<body style="margin:0;background:#f0f;display:flex;gap:20px"><img src="${ref}" style="width:760px;height:1600px;object-fit:cover"><img src="data:image/png;base64,${png.toString('base64')}" style="width:760px;height:1600px;object-fit:cover"></body>`);
  await c.waitForTimeout(300);
  await c.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 85 });
  await c.close();
}
await b.close(); srv.close();
console.log('Comparações salvas em build/comparacao/ (esquerda: referência, direita: protótipo).');
