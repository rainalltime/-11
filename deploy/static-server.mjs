// 零依赖静态服务器:在 Windows 侧跑,给 natapp 隧道当本地后端。
// 用法:node deploy/static-server.mjs <目录> <端口> [绑定地址]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = normalize(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 80);
const host = process.argv[4] ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      if (p === '/' || p.endsWith('/')) p += 'index.html';
      const file = normalize(join(root, p));
      if (!file.startsWith(root + '\\') && !file.startsWith(root + '/') && file !== root) {
        res.writeHead(403);
        return res.end('forbidden');
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  })
  .listen(port, host, () => {
    console.log(`[static-server] ${root} → http://${host}:${port}`);
  });
