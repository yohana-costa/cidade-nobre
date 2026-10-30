// Build do site estático para a Vercel (ou qualquer hospedagem estática): gera dist/.
//   npm run build
// - junta os scripts de src/ em um arquivo com hash no nome (cache longo sem risco);
// - copia o CSS com hash e a pasta assets/ (imagens e fontes);
// - escreve dist/index.html apontando para os arquivos novos.
// Só usa a biblioteca padrão do Node.
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
// ordem importa: api -> core (estado e regras de leitura) -> icons -> client -> admin -> main (eventos e boot)
const JS = ['api.js', 'core.js', 'icons.js', 'client.js', 'admin.js', 'main.js'];
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);

await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'static'), { recursive: true });

const js = (await Promise.all(JS.map(f => readFile(path.join(ROOT, 'src', f), 'utf8')))).join('\n;\n');
const css = await readFile(path.join(ROOT, 'src', 'styles.css'), 'utf8');
const jsName = `static/app.${hash(js)}.js`;
const cssName = `static/styles.${hash(css)}.css`;
await writeFile(path.join(DIST, jsName), js);
await writeFile(path.join(DIST, cssName), css);

await cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });

let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<!-- build:js -->[\s\S]*?<!-- endbuild -->/, `<script src="/${jsName}"></script>`);
html = html.replace('<link rel="stylesheet" href="/src/styles.css">', `<link rel="stylesheet" href="/${cssName}">`);
if (html.includes('/src/')) throw new Error('index.html ainda aponta para /src/: confira os marcadores do build.');
await writeFile(path.join(DIST, 'index.html'), html);

console.log(`dist/index.html\ndist/${jsName}  ${Math.round(js.length / 1024)} KB\ndist/${cssName}  ${Math.round(css.length / 1024)} KB\ndist/assets/`);
