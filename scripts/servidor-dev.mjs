// Servidor de desenvolvimento do site (sem dependências):
//   npm run dev                      -> http://localhost:8092 servindo a raiz do projeto
//   PORT=8092 API_URL=http://localhost:3341 DIR=dist npm run dev
// - /api/* é repassado para o backend (API_URL), como a Vercel faz em produção;
// - qualquer caminho que não seja arquivo devolve index.html (/gestao, /indique/CODIGO).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.DIR || '.');
const PORT = Number(process.env.PORT || 8092);
const API = new URL(process.env.API_URL || 'http://localhost:3341');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };

function proxy(req, res) {
  const p = http.request({ hostname: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, host: API.host } }, r => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  p.on('error', () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'API fora do ar. Rode npm run dev:api.' })); });
  req.pipe(p);
}

const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/api') return proxy(req, res);
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    let file = path.resolve(ROOT, rel || 'index.html');
    if (!file.startsWith(ROOT)) throw new Error('fora da raiz');
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) file = path.join(ROOT, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('404');
  }
});
srv.listen(PORT, () => console.log(`Site em http://localhost:${PORT} (API: ${API.origin}, pasta: ${ROOT})`));
