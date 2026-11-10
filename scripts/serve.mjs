// Tiny static server for dist/. Listens on all interfaces so a phone on the same Wi-Fi can open it.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT ?? 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found. Run npm run build first.');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving dist/ on http://localhost:${port}`);
  for (const nets of Object.values(networkInterfaces())) {
    for (const n of nets ?? []) if (n.family === 'IPv4' && !n.internal) console.log(`  phone: http://${n.address}:${port}`);
  }
});
