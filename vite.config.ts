import { defineConfig } from 'vite';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** 开发服务器:把 public/ 下的文本类静态资源(levels.json / js / css)按 gzip 传输,省流量。 */
function gzipPublic(): Plugin {
  return {
    name: 'gzip-public',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        const accepts = (req.headers['accept-encoding'] || '').includes('gzip');
        if (!accepts || !/\.(json|js|css|txt|html)$/.test(url)) return next();
        const file = resolve('public', url.replace(/^\//, ''));
        let raw: Buffer;
        try {
          raw = readFileSync(file);
        } catch {
          return next();
        }
        const type =
          url.endsWith('.json') ? 'application/json' :
          url.endsWith('.js') ? 'application/javascript' :
          url.endsWith('.css') ? 'text/css' :
          url.endsWith('.html') ? 'text/html' : 'text/plain';
        const gz = gzipSync(raw, { level: 9 });
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Encoding': 'gzip',
          'Content-Length': gz.length,
          'Cache-Control': 'no-cache',
          'Vary': 'Accept-Encoding',
        });
        res.end(gz);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [gzipPublic()],
  server: {
    host: true,
    port: 5173,
    // natapp 免费隧道域名是系统随机分配的,直接放行所有 Host(开发期共享用)
    allowedHosts: true,
    // WSL 挂载盘(/mnt/d)的 inotify 不可靠,用轮询保证代码改动能被检测到
    watch: { usePolling: true, interval: 200 },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
