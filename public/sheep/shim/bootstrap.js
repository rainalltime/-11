/* Boot the unpacked Unity WebGL game against the browser wx shim. */
(function () {
  'use strict';
  var boot = document.getElementById('boot');
  var bar = document.getElementById('boot-bar');
  var errBox = document.getElementById('boot-err');

  function setProgress(p) { if (bar) bar.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function showError(e) {
    // 没有理由的 rejection（undefined）在插件里很常见，对玩家没有意义，直接忽略。
    if (e == null) { console.warn('[pigrun] ignored empty rejection'); return; }
    var msg = (e && (e.stack || e.message)) || String(e);
    console.error('[pigrun] error object:', e, 'type:', typeof e);
    // 资源已加载 / 游戏已启动后，网络/广告等非致命异常只记录，不再用红色遮罩打断玩家。
    if (window.__pigrunAssetsLoaded || window.__pigrunGameStarted) return;
    if (errBox) errBox.textContent += msg + '\n';
    if (boot) boot.classList.remove('hide');
  }
  window.addEventListener('error', function (e) { showError(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { showError(e.reason); });

  var CODE = '4c710eea40ebf9f9.webgl.wasm.code.unityweb.wasm';
  var CODE_BR = CODE + '.br';
  var DATA = '43ed31168ecfce8e.webgl.data.unityweb.bin';

  var NG = { 'ngrok-skip-browser-warning': '1' };
  async function fetchBuffer(url) {
    var lastErr = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      try {
        var r = await fetch(url, { headers: NG });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
        return await r.arrayBuffer();
      } catch (e) {
        lastErr = e;
        await new Promise(function (res) { setTimeout(res, 400 * (attempt + 1)); });
      }
    }
    throw lastErr;
  }
  // 先在本地解 gzip 再交给引擎：隧道/弱网下 39MB→12MB，首屏快 3 倍。
  async function fetchMaybeGz(url) {
    var qi = url.indexOf('?');
    var gzUrl = qi < 0 ? url + '.gz' : url.slice(0, qi) + '.gz' + url.slice(qi);
    if (typeof DecompressionStream !== 'undefined') {
      for (var attempt = 0; attempt < 5; attempt++) {
        try {
          var r = await fetch(gzUrl, { headers: NG });
          if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + gzUrl);
          var cl = Number(r.headers.get('content-length') || 0);
          var buf = await r.arrayBuffer();
          if (cl && buf.byteLength !== cl) throw new Error('truncated ' + buf.byteLength + '/' + cl);
          var ds = new DecompressionStream('gzip');
          return await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
        } catch (e) {
          console.warn('[pigrun] gz attempt ' + (attempt + 1) + ' failed', String(e));
          await new Promise(function (res) { setTimeout(res, 500 * (attempt + 1)); });
        }
      }
    }
    return fetchBuffer(url);
  }

  (async function () {
    try {
      setProgress(5);
      var wasm = await fetchMaybeGz('wasmcode/' + CODE);
      setProgress(35);
      var data = await fetchMaybeGz('data-package/' + DATA + (window.__PIGRUN_DATA_VERSION ? '?v=' + window.__PIGRUN_DATA_VERSION : ''));
      setProgress(60);

      window.__pigrunWasmBuffer = wasm;
      window.__pigrunAssetsLoaded = true;
      window.__pigrunDataSize = data.byteLength;
      window.__pigrun.putFile(CODE, wasm);
      window.__pigrun.putFile(CODE_BR, wasm);
      window.__pigrun.putFile('wasmcode/' + CODE, wasm);
      window.__pigrun.putFile('wasmcode/' + CODE_BR, wasm);
      window.__pigrun.putFile(DATA, data);
      window.__pigrun.putFile(DATA + '.txt', data);
      window.__pigrun.putFile('data-package/' + DATA, data);
      window.__pigrun.putFile('data-package/' + DATA + '.txt', data);

      // Optional local asset bundles (falls back to the CDN via the proxy).
      var abList = window.__PIGRUN_PRELOAD_AB || [];
      if (abList.length) {
        setProgress(65);
        await Promise.all(abList.map(function (name) {
          return fetch('ab/' + name).then(function (r) {
            return r.ok ? r.arrayBuffer() : null;
          }).then(function (buf) {
            if (!buf) return;
            ['wxfile://usr/__GAME_FILE_CACHE/AB/' + name, 'wxfile://tmp/' + name, name, 'AB/' + name].forEach(function (p) {
              window.__pigrun.putFile(p, buf);
            });
          }).catch(function (e) { console.warn('[pigrun] ab preload failed', name, e); });
        }));
        console.log('[pigrun] local AB preloaded', abList.length);
      }

      setProgress(70);
      console.log('[pigrun] assets loaded', { wasm: wasm.byteLength, data: data.byteLength });

      window.require('game.js');
      setProgress(85);

      // Instrument the Unity main loop so a hang can be localised quickly.
      // Browser.mainLoop is created lazily, so keep polling until it appears.
      var instrumentTimer = setInterval(function () {
        try {
          var un = window.unityNamespace;
          var ml = un && un.Browser && un.Browser.mainLoop;
          if (!ml || typeof ml.runIter !== 'function' || ml.__pigrunWrapped) return;
          ml.__pigrunWrapped = true;
          var orig = ml.runIter, n = 0;
          ml.runIter = function () {
            n++;
            window.__pigrunGameStarted = true;
            var t0 = performance.now();
            if (n <= 8) console.log('[pigrun] runIter start', n, 'visible=', window.manager && window.manager.isVisible);
            var r;
            try {
              r = orig.apply(this, arguments);
            } catch (e) {
              // A C# exception can escape as a wasm trap and would otherwise
              // halt the whole player. Keep the loop alive.
              console.error('[pigrun] runIter threw (kept alive):', e && (e.message || e));
            }
            if (n <= 8) console.log('[pigrun] runIter end', n, 'ms=', (performance.now() - t0).toFixed(1));
            return r;
          };
          console.log('[pigrun] mainLoop instrumented later', Object.keys(ml));
          clearInterval(instrumentTimer);
        } catch (e) { console.error('[pigrun] mainLoop poll failed', e); }
      }, 250);

      setTimeout(function () { if (boot) boot.classList.add('hide'); }, 1500);
    } catch (e) {
      showError(e);
    }
  })();
})();
