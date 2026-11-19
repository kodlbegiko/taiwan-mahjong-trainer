import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const target = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    const relativePath = relative(root, target);
    if (relativePath.startsWith('..') || isAbsolute(relativePath) || relativePath.includes('node_modules')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const fileStat = await stat(target);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': `${mime[extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404).end('Not Found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Taiwan Mahjong Trainer: http://127.0.0.1:${port}`);
});
