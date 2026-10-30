// Servidor estático mínimo para os testes (serve a raiz do projeto).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
export function serve() {
  return new Promise(resolve => {
    const srv = http.createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'dev.html';
        const file = path.resolve(ROOT, rel);
        if (!file.startsWith(ROOT)) throw new Error('fora da raiz');
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(body);
      } catch { res.writeHead(404); res.end('404'); }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
