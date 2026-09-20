#!/usr/bin/env node
// Zero-dependency static dev server for TurboPad (serves Web/dist).
// Usage: npm run dev -- --port 4173 --host 127.0.0.1
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../Web/dist', import.meta.url));

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.findIndex(arg => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index === -1) return fallback;
  const inline = args[index].split('=')[1];
  return inline ?? args[index + 1] ?? fallback;
};

const port = Number(process.env.PORT ?? option('port', 4173));
const host = process.env.HOST ?? option('host', '127.0.0.1');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}`);
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path.includes('..')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!path || path.endsWith('/')) path = join(path, 'index.html');
    const file = join(root, path);
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`TurboPad dev server → http://${host}:${port}`);
});
