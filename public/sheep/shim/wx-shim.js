/* Browser compatibility layer for the WeChat mini-game runtime. */
(function () {
  'use strict';
  var root = window;
  root.GameGlobal = root;
  // 有些 Unity 适配层会把 window.document 换成自己的假 DOM，先把真 DOM 存下来。
  try { root.__pigrunNativeDocument = root.document; } catch (e) {}
  // Unity/微信适配层会替换 document.body / documentElement，真节点先留好。
  try {
    root.__pigrunRealBody = root.document && root.document.body;
    root.__pigrunRealRoot = root.document && root.document.documentElement;
  } catch (e) {}

  var NativeWebAssembly = root.WebAssembly;
  var NativeAudioContext = root.AudioContext || root.webkitAudioContext;
  var NativeAudio = root.Audio;
  var NativeImage = root.Image;

  var nativeCreateElement = document.createElement.bind(document);
  try { root.__pigrunCreateElement = nativeCreateElement; } catch (e) {}
  var mainCanvas = document.getElementById('game-canvas');
  var canvasCreated = false;

  // ---------------- same-origin proxy for the studio's API / CDN ----------------
  // api.flysheeep.com does not answer CORS preflights and cdn.flysheeep.com (COS)
  // rejects them, so route those requests through our own server.
  var PROXY_HOSTS = /^https?:\/\/(api|cdn)\.flysheeep\.com\//i;
  function proxiedUrl(u) {
    if (!PROXY_HOSTS.test(u)) return null;
    return '/__proxy?url=' + encodeURIComponent(u);
  }
  // 静态托管没有后端：CDN 上的 AB 包直接用同目录 ab/<name>.u3d 兜底。
  function localAbName(u) {
    var m = /cdn\.flysheeep\.com\/.*\/AB\/([^\/?]+\.u3d)/i.exec(String(u || ''));
    return m ? m[1] : null;
  }
  function fetchLocalAb(name) {
    return fetch('ab/' + name).then(function (r) { return r.ok ? r.arrayBuffer() : null; });
  }
  if (root.fetch) {
    var origFetch = root.fetch.bind(root);
    root.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url);
      init = init || {};
      init.headers = Object.assign({ 'ngrok-skip-browser-warning': '1' }, init.headers || {});
      var p = url ? proxiedUrl(url) : null;
      if (!p) return origFetch(input, init);
      return origFetch(p, init).then(function (res) {
        return new Proxy(res, {
          get: function (t, k) {
            if (k === 'url') return url;
            var v = t[k];
            return typeof v === 'function' ? v.bind(t) : v;
          }
        });
      });
    };
  }
  if (root.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try { this.setRequestHeader('ngrok-skip-browser-warning', '1'); } catch (e) {}
      var p = typeof url === 'string' ? proxiedUrl(url) : null;
      if (p) {
        this.__pigrunUrl = url;
        arguments[1] = p;
      }
      return origOpen.apply(this, arguments);
    };
    var urlDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseURL');
    if (urlDesc && urlDesc.get) {
      try {
        Object.defineProperty(XMLHttpRequest.prototype, 'responseURL', {
          configurable: true,
          get: function () { return this.__pigrunUrl || urlDesc.get.call(this); }
        });
      } catch (e) {}
    }
  }

  // Optional WebGL trace: counts every GL call so we can tell "rendering but
  // slow" apart from "pure CPU loop".
  if (/(?:[?&])gltrace=1/.test(location.search) && root.HTMLCanvasElement) {
    var origGetContext = HTMLCanvasElement.prototype.getContext;
    var glStats = Object.create(null), glTotal = 0, glLast = 0, glStart = Date.now();
    var stackLogs = 0, lastStack = 0;
    var abortAt = (function () { var m = /(?:[?&])glabort=(\d+)/.exec(location.search); return m ? +m[1] : 0; })();
    root.__glStats = glStats;
    HTMLCanvasElement.prototype.getContext = function (type) {
      var ctx = origGetContext.apply(this, arguments);
      if (!ctx || !/webgl/i.test(String(type))) return ctx;
      if (ctx.__pigrunGlWrapped) return ctx;
      ctx.__pigrunGlWrapped = true;
      var count = function (name) {
        glStats[name] = (glStats[name] || 0) + 1;
        glTotal++;
        var now = Date.now();
        if (now - glLast > 500) {
          glLast = now;
          var top = Object.keys(glStats).map(function (k) { return [k, glStats[k]]; })
            .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
          console.log('[gl]', 't=' + ((now - glStart) / 1000).toFixed(1) + 's', 'calls=' + glTotal,
            JSON.stringify(top.map(function (x) { return x[0] + ':' + x[1]; })));
        }
      };
      return new Proxy(ctx, {
        get: function (target, key) {
          var v = target[key];
          if (typeof v !== 'function') return v;
          return function () {
            count(String(key));
            if (abortAt && glTotal >= abortAt) {
              console.log('[gl] aborting frame at call', glTotal);
              throw new Error('[glabort] ' + glTotal);
            }
            if (stackLogs < 6 && glTotal > 20) {
              var nowMs = Date.now();
              if (nowMs - lastStack > 4000) {
                lastStack = nowMs;
                stackLogs++;
                console.log('[gl stack #' + stackLogs + ']', new Error().stack);
              }
            }
            var t0 = performance.now();
            var r = v.apply(target, arguments);
            var dt = performance.now() - t0;
            if (dt > 100) console.log('[gl slow]', String(key), dt.toFixed(0) + 'ms');
            return r;
          };
        }
      });
    };
    console.log('[gl] tracing enabled');
  }

  // ---------------- virtual filesystem ----------------
  var files = new Map();
  function baseName(p) {
    return String(p == null ? '' : p).replace(/[?#].*$/, '').split(/[\\/]/).pop();
  }
  function normPath(p) {
    return String(p == null ? '' : p).replace(/^\/+/, '');
  }
  function putFile(path, data) {
    var name = baseName(path);
    if (typeof data === 'string') data = new TextEncoder().encode(data);
    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    files.set(normPath(path), data);
    if (name) files.set(name, data);
  }
  var missCount = 0;
  function getFile(path) {
    if (path == null) return null;
    var p = normPath(path);
    if (files.has(p)) return files.get(p);
    var b = baseName(path);
    if (b && files.has(b)) return files.get(b);
    // tolerate query strings and URI schemes
    var stripped = p.replace(/^[a-z]+:\/+/, '').replace(/^\/+/, '');
    if (files.has(stripped)) return files.get(stripped);
    var sb = baseName(stripped);
    if (sb && files.has(sb)) return files.get(sb);
    if (missCount++ < 40) console.warn('[vfs miss]', String(path));
    return null;
  }
  function toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) return data;
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  function sliceData(data, position, length) {
    var u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    var pos = (position == null || position < 0) ? 0 : position;
    var end = (length == null) ? u8.byteLength : Math.min(u8.byteLength, pos + length);
    var part = u8.subarray(pos, end);
    return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
  }
  function decodeText(data) {
    if (typeof data === 'string') return data;
    return new TextDecoder('utf-8').decode(data);
  }
  function err(msg, code) {
    var e = new Error(msg);
    e.errMsg = msg;
    e.errno = code || 1;
    return e;
  }
  function makeStat(size, isDir) {
    var now = Date.now() / 1000;
    return {
      size: size,
      isFile: function () { return !isDir; },
      isDirectory: function () { return !!isDir; },
      lastAccessedTime: now,
      lastModifiedTime: now,
      mode: 33206
    };
  }

  // ---- real file descriptors over the in-memory VFS ----
  // The loader/engine sometimes opens a file and reads it in a loop until the
  // reported size is consumed; returning 0 bytes forever spins the main thread.
  var fdTable = new Map();
  var nextFd = 100;
  var dirSet = new Set(['wxfile://usr', 'wxfile://usr/__GAME_FILE_CACHE', 'wxfile://usr/__PATCH_DIR', 'wxfile://tmp']);
  function ensureDirsFor(path) {
    var p = String(path).replace(/\\/g, '/');
    var idx = p.lastIndexOf('/');
    while (idx > 0) {
      dirSet.add(p.slice(0, idx));
      p = p.slice(0, idx);
      idx = p.lastIndexOf('/');
    }
  }
  function isDir(path) {
    var p = String(path).replace(/\/+$/, '');
    if (dirSet.has(p)) return true;
    var prefix = p + '/';
    var found = false;
    dirSet.forEach(function (d) { if (!found && d.indexOf(prefix) === 0) found = true; });
    if (found) return true;
    files.forEach(function (_v, k) { if (!found && k.indexOf(prefix) === 0) found = true; });
    return found;
  }
  function readFd(fd, target, targetOffset, length, position) {
    var e = fdTable.get(fd);
    if (!e) throw err('read:fail bad file descriptor ' + fd);
    var size = e.data ? e.data.byteLength : 0;
    var pos = (position == null || position < 0) ? e.pos : position;
    var n = Math.max(0, Math.min(length == null ? size - pos : length, size - pos));
    if (n > 0) {
      var src = e.data.subarray(pos, pos + n);
      if (target && target.set) target.set(src, targetOffset || 0);
      e.pos = pos + n;
    }
    return n;
  }

  var fs = {
    readFileSync: function (filePath, encoding, position, length) {
      var data = getFile(filePath);
      if (data == null) throw err('readFileSync:fail no such file or directory ' + filePath, 1300002);
      if (encoding && String(encoding).toLowerCase().indexOf('utf') === 0) return decodeText(data);
      return sliceData(data, position, length);
    },
    readFile: function (o) {
      try {
        var data = getFile(o.filePath);
        if (data == null) throw err('readFile:fail no such file or directory ' + o.filePath, 1300002);
        var out = (o.encoding && String(o.encoding).toLowerCase().indexOf('utf') === 0)
          ? decodeText(data)
          : sliceData(data, o.position, o.length);
        o.success && o.success({ data: out });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    readCompressedFileSync: function (o) {
      var path = typeof o === 'string' ? o : (o && o.filePath);
      var data = getFile(path);
      if (data == null) throw err('readCompressedFileSync:fail ' + path);
      return toArrayBuffer(data);
    },
    readCompressedFile: function (o) {
      try {
        var data = getFile(o.filePath);
        if (data == null) throw err('readCompressedFile:fail ' + o.filePath);
        o.success && o.success({ data: toArrayBuffer(data) });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    statSync: function (filePath) {
      if (isDir(filePath)) return makeStat(0, true);
      var data = getFile(filePath);
      if (data == null) throw err('statSync:fail no such file or directory ' + filePath);
      return makeStat(data.byteLength != null ? data.byteLength : (data.length || 0));
    },
    stat: function (o) {
      try {
        if (isDir(o.path || o.filePath)) {
          o.success && o.success({ stats: makeStat(0, true) });
          o.complete && o.complete({});
          return;
        }
        var data = getFile(o.path || o.filePath);
        if (data == null) throw err('stat:fail no such file or directory ' + (o.path || o.filePath));
        o.success && o.success({ stats: makeStat(data.byteLength != null ? data.byteLength : (data.length || 0)) });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    accessSync: function (filePath) {
      if (!isDir(filePath) && getFile(filePath) == null) throw err('accessSync:fail no such file or directory ' + filePath);
    },
    access: function (o) {
      var p = o.path || o.filePath;
      if (isDir(p) || getFile(p) != null) { o.success && o.success({}); }
      else { o.fail && o.fail({ errMsg: 'access:fail no such file or directory ' + p }); }
      o.complete && o.complete({});
    },
    getFileInfo: function (o) {
      var data = getFile(o.filePath);
      if (data == null) { o.fail && o.fail({ errMsg: 'getFileInfo:fail ' + o.filePath }); o.complete && o.complete({}); return; }
      var m = baseName(o.filePath).match(/^([0-9a-f]{8,32})/i);
      o.success && o.success({ size: data.byteLength != null ? data.byteLength : (data.length || 0), digest: m ? m[1] : '' });
      o.complete && o.complete({});
    },
    writeFileSync: function (filePath, data) {
      putFile(filePath, data);
      ensureDirsFor(filePath);
    },
    writeFile: function (o) {
      try { fs.writeFileSync(o.filePath, o.data, o.encoding); o.success && o.success({}); }
      catch (e) { o.fail && o.fail({ errMsg: e.errMsg || String(e) }); }
      o.complete && o.complete({});
    },
    appendFileSync: function (filePath, data) {
      var old = getFile(filePath);
      var add = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      var buf = new Uint8Array((old ? old.byteLength : 0) + add.byteLength);
      if (old) buf.set(old, 0);
      buf.set(add, old ? old.byteLength : 0);
      fs.writeFileSync(filePath, buf);
    },
    appendFile: function (o) { try { fs.writeFileSync(o.filePath, o.data); o.success && o.success({}); } catch (e) { o.fail && o.fail({ errMsg: String(e) }); } o.complete && o.complete({}); },
    mkdirSync: function (dirPath, recursive) {
      dirSet.add(String(dirPath).replace(/\/+$/, ''));
      if (recursive) ensureDirsFor(dirPath + '/x');
    },
    mkdir: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    rmdirSync: function (dirPath) { dirSet.delete(String(dirPath).replace(/\/+$/, '')); },
    rmdir: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    unlinkSync: function (filePath) { files.delete(normPath(filePath)); files.delete(baseName(filePath)); },
    unlink: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    renameSync: function (from, to) {
      var d = getFile(from);
      if (d != null) { putFile(to, d); fs.unlinkSync(from); ensureDirsFor(to); }
    },
    rename: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    copyFileSync: function (from, to) { var d = getFile(from); if (d != null) { putFile(to, d); ensureDirsFor(to); } },
    copyFile: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    readdirSync: function (dirPath) {
      var dir = String(dirPath).replace(/\/+$/, '');
      var out = new Set();
      dirSet.forEach(function (d) {
        if (d !== dir && d.indexOf(dir + '/') === 0) out.add(d.slice(dir.length + 1).split('/')[0]);
      });
      files.forEach(function (_v, k) {
        if (k.indexOf(dir + '/') === 0) out.add(k.slice(dir.length + 1).split('/')[0]);
      });
      return Array.from(out);
    },
    readdir: function (o) { o.success && o.success({ files: [] }); o.complete && o.complete({}); },
    saveFileSync: function (p) { return p; },
    saveFile: function (o) { o.success && o.success({ savedFilePath: o.tempFilePath }); o.complete && o.complete({}); },
    getSavedFileList: function (o) { o.success && o.success({ fileList: [] }); o.complete && o.complete({}); },
    removeSavedFile: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    openSync: function (filePath, flag) {
      var data = getFile(filePath);
      if (data == null) {
        if (String(flag || 'r').indexOf('w') === -1) throw err('openSync:fail no such file or directory ' + filePath);
        data = new Uint8Array(0);
        putFile(filePath, data);
        ensureDirsFor(filePath);
      }
      var fd = nextFd++;
      fdTable.set(fd, { path: normPath(filePath), data: data instanceof Uint8Array ? data : new Uint8Array(data), pos: 0 });
      return fd;
    },
    open: function (o) {
      try {
        var fd = fs.openSync(o.filePath, o.flag);
        o.success && o.success({ fd: fd });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    closeSync: function (fd) { fdTable.delete(fd); },
    close: function (o) { fdTable.delete(o.fd); o.success && o.success({}); o.complete && o.complete({}); },
    readSync: function (fd, arrayBuffer, offset, length, position) {
      var view = new Uint8Array(arrayBuffer);
      return readFd(fd, view, offset, length, position);
    },
    read: function (o) {
      try {
        var n = readFd(o.fd, new Uint8Array(o.arrayBuffer), o.offset || 0, o.length, o.position);
        o.success && o.success({ bytesRead: n, arrayBuffer: o.arrayBuffer });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    writeSync: function (fd, data, offset, length, position) {
      var e = fdTable.get(fd);
      var add = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
      if (offset || length != null) add = add.subarray(offset || 0, (offset || 0) + (length == null ? add.byteLength : length));
      var pos = (position == null || position < 0) ? (e ? e.pos : 0) : position;
      var need = pos + add.byteLength;
      var old = e ? e.data : new Uint8Array(0);
      if (need > old.byteLength) {
        var grown = new Uint8Array(need);
        grown.set(old, 0);
        old = grown;
        if (e) e.data = old;
      }
      old.set(add, pos);
      if (e) { e.pos = pos + add.byteLength; putFile(e.path, old); }
      return add.byteLength;
    },
    write: function (o) {
      try {
        var n = fs.writeSync(o.fd, o.data, o.offset, o.length, o.position);
        o.success && o.success({ bytesWritten: n });
      } catch (e) {
        o.fail && o.fail({ errMsg: e.errMsg || String(e) });
      }
      o.complete && o.complete({});
    },
    fstatSync: function (fd) {
      var e = fdTable.get(fd);
      if (!e) throw err('fstatSync:fail bad file descriptor ' + fd);
      return makeStat(e.data.byteLength);
    },
    fstat: function (o) {
      var e = fdTable.get(o.fd);
      if (!e) { o.fail && o.fail({ errMsg: 'fstat:fail bad fd ' + o.fd }); o.complete && o.complete({}); return; }
      o.success && o.success({ stats: makeStat(e.data.byteLength) });
      o.complete && o.complete({});
    },
    fsync: function (o) { o.success && o.success({}); o.complete && o.complete({}); },
    fsyncSync: function () {},
    ftruncate: function (o) {
      var e = fdTable.get(o.fd);
      if (e && o.length != null) { e.data = e.data.slice(0, o.length); putFile(e.path, e.data); }
      o.success && o.success({});
      o.complete && o.complete({});
    },
    ftruncateSync: function (fd, len) {
      var e = fdTable.get(fd);
      if (e) { e.data = e.data.slice(0, len || 0); putFile(e.path, e.data); }
    },
    getFileSystemManager: function () { return fs; }
  };

  // Optional file-system trace: shows what the engine touches right before a
  // main-thread stall (append ?fstrace=1).
  if (/(?:[?&])fstrace=1/.test(location.search)) {
    var fsLog = [];
    root.__fsTrace = fsLog;
    var traceFs = function (name) {
      var orig = fs[name];
      if (typeof orig !== 'function') return;
      fs[name] = function () {
        var args = Array.prototype.slice.call(arguments);
        var desc = args.map(function (a) {
          if (a == null) return String(a);
          if (typeof a === 'string') return a;
          if (typeof a === 'number') return a;
          if (a instanceof ArrayBuffer) return 'AB(' + a.byteLength + ')';
          if (a && (a.filePath || a.path || a.fd !== undefined)) return JSON.stringify({ filePath: a.filePath, path: a.path, fd: a.fd, position: a.position, length: a.length, offset: a.offset, encoding: a.encoding });
          return typeof a;
        }).join(' ');
        var res;
        try {
          res = orig.apply(fs, args);
          var out = '';
          if (res instanceof ArrayBuffer) out = ' -> ' + res.byteLength + 'B';
          else if (res && res.byteLength != null) out = ' -> ' + res.byteLength + 'B';
          else if (typeof res === 'number' || typeof res === 'string') out = ' -> ' + String(res).slice(0, 40);
          fsLog.push(name + '(' + desc + ')' + out);
          if (fsLog.length > 300) fsLog.shift();
          if (fsLog.length <= 120) console.log('[fs]', fsLog[fsLog.length - 1]);
          return res;
        } catch (e) {
          fsLog.push(name + '(' + desc + ') !! ' + (e && e.errMsg || e));
          if (fsLog.length > 300) fsLog.shift();
          if (fsLog.length <= 120) console.log('[fs]', fsLog[fsLog.length - 1]);
          throw e;
        }
      };
    };
    ['readFileSync', 'readFile', 'readCompressedFileSync', 'readCompressedFile', 'statSync', 'stat', 'accessSync',
     'access', 'open', 'openSync', 'read', 'readSync', 'fstat', 'fstatSync', 'getFileInfo', 'readdirSync'].forEach(traceFs);
    console.log('[fs] tracing enabled');
  }

  // ---------------- storage ----------------
  var storagePrefix = 'pigrun:';
  // Capture the real Storage object now: the Unity game glue installs its own
  // `localStorage` polyfill that calls back into wx.getStorageSync, which would
  // recurse forever (and grow the key by one prefix per round trip).
  var nativeStorage = null;
  try { nativeStorage = root.localStorage; } catch (e) {}
  function lsGet(k) { try { return nativeStorage && nativeStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { nativeStorage && nativeStorage.setItem(k, v); } catch (e) {} }
  function lsRemove(k) { try { nativeStorage && nativeStorage.removeItem(k); } catch (e) {} }
  // WeChat storage is an in-memory key/value store; localStorage can be very
  // slow when a game saves multi-megabyte JSON and reads it every frame.
  // Keep a memory cache and flush lazily.
  var storageCache = new Map();
  var storeTrace = /(?:[?&])storetrace=1/.test(location.search);
  var storeGetCount = 0, storeSetCount = 0;
  var storageLoaded = new Set();
  var storageDirty = new Set();
  var storageTimer = null;
  function flushStorage() {
    storageTimer = null;
    storageDirty.forEach(function (key) {
      try { lsSet(storagePrefix + key, JSON.stringify(storageCache.get(key))); } catch (e) {}
    });
    storageDirty.clear();
  }
  function storageGet(key) {
    if (storeTrace) {
      storeGetCount++;
      if (storeGetCount <= 60 || (storeGetCount & (storeGetCount - 1)) === 0) console.log('[store] get#' + storeGetCount, key, storageCache.has(key) ? 'hit' : 'miss');
      if (storeGetCount === 3) console.log('[store] get#3 stack', new Error().stack);
    }
    if (storageCache.has(key)) return storageCache.get(key);
    if (!storageLoaded.has(key)) {
      storageLoaded.add(key);
      try { var v = lsGet(storagePrefix + key); if (v != null) storageCache.set(key, JSON.parse(v)); }
      catch (e) {}
    }
    return storageCache.has(key) ? storageCache.get(key) : '';
  }
  function storageSet(key, value) {
    if (storeTrace) {
      storeSetCount++;
      var sz = 0;
      try { sz = JSON.stringify(value).length; } catch (e) {}
      if (storeSetCount <= 60 || (storeSetCount & (storeSetCount - 1)) === 0) console.log('[store] set#' + storeSetCount, key, sz + 'B');
    }
    storageCache.set(key, value);
    storageLoaded.add(key);
    storageDirty.add(key);
    if (!storageTimer) storageTimer = setTimeout(flushStorage, 300);
  }
  function storageRemove(key) {
    storageCache.delete(key);
    storageLoaded.add(key);
    lsRemove(storagePrefix + key);
  }
  // Some analytics SDKs read their client id from local storage; provide a
  // placeholder so they do not throw before the game starts.
  ['gravity_client_id', 'gravity_clientId', 'GravityClientId', 'GE_CLIENT_ID', 'client_id', 'clientId'].forEach(function (k) {
    if (!storageCache.has(k)) storageCache.set(k, 'pigrun-local');
  });

  // ---------------- system info ----------------
  function windowInfo() {
    var w = Math.max(1, root.innerWidth || document.documentElement.clientWidth || 375);
    var h = Math.max(1, root.innerHeight || document.documentElement.clientHeight || 667);
    return {
      pixelRatio: root.devicePixelRatio || 1,
      screenWidth: w,
      screenHeight: h,
      windowWidth: w,
      windowHeight: h,
      statusBarHeight: 0,
      screenTop: 0,
      safeArea: { left: 0, right: w, top: 0, bottom: h, width: w, height: h }
    };
  }
  function deviceInfo() {
    return { platform: 'devtools', system: 'Windows 10 x64', brand: 'devtools', model: 'PC', abi: 'x64', memorySize: 8192, benchmarkLevel: 50 };
  }
  function appBaseInfo() {
    return { SDKVersion: '3.9.0', version: '8.0.99', language: 'zh_CN', theme: 'light', enableDebug: false, host: { env: 'WeChat' } };
  }
  function systemInfo() {
    var w = windowInfo(), d = deviceInfo(), a = appBaseInfo();
    return Object.assign({}, w, d, a, {
      brand: d.brand, model: d.model, system: d.system, platform: d.platform,
      screenWidth: w.screenWidth, screenHeight: w.screenHeight,
      windowWidth: w.windowWidth, windowHeight: w.windowHeight,
      statusBarHeight: 0, language: 'zh_CN', version: '8.0.99', SDKVersion: '3.9.0',
      benchmarkLevel: 50, enableDebug: false, fontSizeSetting: 16
    });
  }

  // ---------------- event helpers ----------------
  function noop() {}
  function later(fn, arg) { setTimeout(function () { try { fn && fn(arg); } catch (e) { console.error(e); } }, 0); }
  var touchHandlers = { start: [], move: [], end: [], cancel: [] };
  root.__pigrunTouchDebug = /(?:[?&])touchdebug=1/.test(location.search);
  var touchBound = false;
  function bindTouch() {
    if (touchBound) return;
    touchBound = true;
    // The Unity glue may replace the original <canvas> with its own element, so
    // listen on the document and filter by target tag.
    var target = document;
    var isCanvas = function (e) {
      var t = e.target;
      return t && (t.tagName === 'CANVAS' || (t.parentNode && t.parentNode.tagName === 'CANVAS'));
    };
    var map = { touchstart: 'start', touchmove: 'move', touchend: 'end', touchcancel: 'cancel' };
    // UnityPlugin 会调用 `e.touches.map(...)`，原生 TouchList 没有 map，
    // 手机上直接报错导致点击完全没反应。统一转成普通数组再转发。
    function normTouch(t) {
      return {
        identifier: t.identifier,
        clientX: t.clientX, clientY: t.clientY,
        pageX: t.pageX, pageY: t.pageY,
        screenX: t.screenX, screenY: t.screenY,
        force: (t.force === undefined || t.force === 0) ? 1 : t.force,
        radiusX: t.radiusX, radiusY: t.radiusY
      };
    }
    function normEvent(e) {
      var touches = [], changed = [];
      if (e.touches) for (var i = 0; i < e.touches.length; i++) touches.push(normTouch(e.touches[i]));
      if (e.changedTouches) for (var j = 0; j < e.changedTouches.length; j++) changed.push(normTouch(e.changedTouches[j]));
      return { type: e.type, touches: touches, changedTouches: changed, targetTouches: touches, timeStamp: e.timeStamp || performance.now() };
    }
    Object.keys(map).forEach(function (type) {
      target.addEventListener(type, function (e) {
        if (root.__pigrunTouchDebug) console.log('[touch]', type, 'target=', e.target && e.target.tagName, 'canvas=', isCanvas(e), 'handlers=', touchHandlers[map[type]].length);
        if (!isCanvas(e)) return;
        e.preventDefault();
        var ev = normEvent(e);
        var list = touchHandlers[map[type]];
        for (var i = 0; i < list.length; i++) {
          try { list[i](ev); } catch (err) { console.error(err); }
        }
      }, { passive: false });
    });
    target.addEventListener('mousedown', function (e) {
      if (!isCanvas(e)) return;
      e.preventDefault();
      var t = { identifier: 0, clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY, force: 1 };
      var ev = { type: 'touchstart', touches: [t], targetTouches: [t], changedTouches: [t], timeStamp: performance.now() };
      touchHandlers.start.forEach(function (fn) { try { fn(ev); } catch (err) { console.error(err); } });
    });
    target.addEventListener('mousemove', function (e) {
      if (!isCanvas(e)) return;
      if (e.buttons === 0) return;
      var t = { identifier: 0, clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY, force: 1 };
      var ev = { type: 'touchmove', touches: [t], targetTouches: [t], changedTouches: [t], timeStamp: performance.now() };
      touchHandlers.move.forEach(function (fn) { try { fn(ev); } catch (err) { console.error(err); } });
    });
    root.addEventListener('mouseup', function (e) {
      var t = { identifier: 0, clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY, force: 1 };
      var ev = { type: 'touchend', touches: [], targetTouches: [], changedTouches: [t], timeStamp: performance.now() };
      touchHandlers.end.forEach(function (fn) { try { fn(ev); } catch (err) { console.error(err); } });
    });
    // 调试用：手工派发一次触摸（和真实事件走同一条归一化路径）。
    root.__pigrunEmitTouch = function (type, x, y) {
      var t = { identifier: 1, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, force: 1 };
      var ev = {
        type: type,
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [t],
        targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : [t],
        changedTouches: [t],
        timeStamp: performance.now()
      };
      var key = type === 'touchstart' ? 'start' : type === 'touchmove' ? 'move' : type === 'touchend' ? 'end' : 'cancel';
      touchHandlers[key].forEach(function (fn) { try { fn(ev); } catch (err) { console.error('[emitTouch]', err); } });
    };
  }

  // ---------------- ad / social stubs ----------------
  function adStub() {
    var closeCb = [], errCb = [];
    return {
      load: function () { return Promise.resolve(); },
      show: function () { return Promise.resolve(); },
      destroy: function () {},
      onClose: function (cb) { closeCb.push(cb); },
      offClose: function (cb) { closeCb = closeCb.filter(function (x) { return x !== cb; }); },
      onError: function (cb) { errCb.push(cb); },
      offError: function (cb) { errCb = errCb.filter(function (x) { return x !== cb; }); },
      onLoad: function () {}, offLoad: function () {},
      onResize: function () {}, offResize: function () {},
      isEnded: false
    };
  }

  // 微信激励视频广告 → 改成"输入口令领道具"（口令来自用户项目的 phrases.ts）。
  // 游戏侧仍然走 onClose({isEnded:true}) 的逻辑，所以道具奖励完全按原版发放。
  function rewardedAdStub() {
    var closeCb = [], errCb = [], loadCb = [];
    return {
      load: function () {
        setTimeout(function () { loadCb.forEach(function (cb) { try { cb(); } catch (e) {} }); }, 0);
        return Promise.resolve();
      },
      show: function () {
        return new Promise(function (resolve) {
          var finish = function (ok) {
            setTimeout(function () {
              closeCb.forEach(function (cb) { try { cb({ isEnded: !!ok }); } catch (e) { console.error(e); } });
              resolve();
            }, 60);
          };
          if (root.PigVerify && typeof root.PigVerify.ask === 'function') {
            root.PigVerify.ask().then(finish);
          } else {
            console.warn('[ad] PigVerify not ready, granting reward');
            finish(true);
          }
        });
      },
      destroy: function () {},
      onClose: function (cb) { closeCb.push(cb); },
      offClose: function (cb) { closeCb = closeCb.filter(function (x) { return x !== cb; }); },
      onError: function (cb) { errCb.push(cb); },
      offError: function (cb) { errCb = errCb.filter(function (x) { return x !== cb; }); },
      onLoad: function (cb) { loadCb.push(cb); },
      offLoad: function (cb) { loadCb = loadCb.filter(function (x) { return x !== cb; }); },
      onResize: function () {}, offResize: function () {},
      isEnded: false
    };
  }
  // The game asks for a WebAudio context thousands of times (once per sound in
  // some paths). Chrome runs out of hardware contexts, so hand out one shared
  // context instead of constructing a new one every time.
  var sharedAudio = null;
  var sharedAudioCalls = 0;
  function sharedAudioContext() {
    sharedAudioCalls++;
    if (sharedAudioCalls === 2 || sharedAudioCalls === 500) {
      console.log('[audio] call#' + sharedAudioCalls, new Error().stack);
    }
    if (sharedAudio) return sharedAudio;
    // NOTE: the Unity glue replaces window.AudioContext with a wrapper that
    // calls wx.createWebAudioContext(), so using root.AudioContext here would
    // recurse forever. Always use the constructor captured before boot.
    var Ctor = NativeAudioContext;
    if (!Ctor) { sharedAudio = audioStub(); return sharedAudio; }
    try {
      sharedAudio = new Ctor();
    } catch (e) {
      console.warn('[audio] AudioContext ctor failed', e);
      sharedAudio = audioStub();
      return sharedAudio;
    }
    if (typeof sharedAudio.decodeAudioData !== 'function') {
      try {
        sharedAudio.decodeAudioData = function (buf, ok, err) {
          return new NativeAudioContext().decodeAudioData(buf, ok, err);
        };
      } catch (e) {}
    }
    if (sharedAudio.state === 'suspended' && typeof sharedAudio.resume === 'function') {
      try { sharedAudio.resume(); } catch (e) {}
    }
    console.log('[audio] shared AudioContext created', typeof sharedAudio.decodeAudioData);
    return sharedAudio;
  }

  function audioStub() {
    var a = NativeAudio ? new NativeAudio() : null;
    var h = {};
    function on(name) { return function (cb) { (h[name] = h[name] || []).push(cb); }; }
    function off(name) { return function () { h[name] = []; }; }
    if (a) {
      a.addEventListener('ended', function () { (h.ended || []).forEach(function (f) { f(); }); });
      a.addEventListener('error', function (e) { (h.error || []).forEach(function (f) { f(e); }); });
    }
    return {
      get src() { return a ? a.src : ''; }, set src(v) { if (a) a.src = v; },
      get volume() { return a ? a.volume : 1; }, set volume(v) { if (a) a.volume = v; },
      get loop() { return a ? a.loop : false; }, set loop(v) { if (a) a.loop = v; },
      get duration() { return a ? (a.duration || 0) : 0; },
      get currentTime() { return a ? (a.currentTime || 0) : 0; },
      autoplay: false, startTime: 0,
      play: function () { if (a) a.play().catch(function () {}); },
      pause: function () { if (a) a.pause(); },
      stop: function () { if (a) { a.pause(); try { a.currentTime = 0; } catch (e) {} } },
      seek: function (t) { if (a) try { a.currentTime = t; } catch (e) {} },
      destroy: function () { if (a) { try { a.pause(); } catch (e) {} a = null; } },
      onEnded: on('ended'), offEnded: off('ended'),
      onError: on('error'), offError: off('error'),
      onPlay: on('play'), offPlay: off('play'),
      onPause: on('pause'), offPause: off('pause'),
      onStop: on('stop'), offStop: off('stop'),
      onSeeked: on('seeked'), offSeeked: off('seeked'),
      onWaiting: on('waiting'), offWaiting: off('waiting'),
      onTimeUpdate: on('timeupdate'), offTimeUpdate: off('timeupdate'),
      onCanplay: on('canplay'), offCanplay: off('canplay')
    };
  }

  // ---------------- wx API ----------------
  var wx = {
    env: { USER_DATA_PATH: 'wxfile://usr', isSupportEmscriptenGLX: false, isSuppportEmscriptenGLX: false },
    getSystemInfoSync: systemInfo,
    getSystemInfo: function (o) { later(function () { o.success && o.success(systemInfo()); o.complete && o.complete({}); }); },
    getDeviceInfo: deviceInfo,
    getWindowInfo: windowInfo,
    getAppBaseInfo: appBaseInfo,
    getAccountInfoSync: function () {
      return { miniProgram: { appId: root.__PIGRUN_APPID || 'wx2bd39bc6b432744f', envVersion: 'release', version: '1.0.0' }, plugin: {} };
    },
    getLaunchOptionsSync: function () {
      // Some SDKs (GravityEngine) read their client id from launch query params.
      return { scene: 1001, query: { client_id: 'pigrun-local', clientId: 'pigrun-local', clientid: 'pigrun-local' }, referrerInfo: {}, shareTicket: '' };
    },
    getEnterOptionsSync: function () { return wx.getLaunchOptionsSync(); },

    createCanvas: function () {
      if (!canvasCreated) { canvasCreated = true; return mainCanvas; }
      var c = nativeCreateElement('canvas');
      c.width = 1; c.height = 1;
      return c;
    },
    createImage: function () { return NativeImage ? new NativeImage() : document.createElement('img'); },
    createOffscreenCanvas: function (o) {
      var c = nativeCreateElement('canvas');
      if (o && o.width) c.width = o.width;
      if (o && o.height) c.height = o.height;
      return c;
    },
    createInnerAudioContext: audioStub,
    createWebAudioContext: function () { return NativeAudioContext ? new NativeAudioContext() : audioStub(); },
    createMediaAudioPlayer: function () { return { start: noop, stop: noop, destroy: noop }; },
    createVideo: function () { return { src: '', play: noop, pause: noop, stop: noop, destroy: noop, onEnded: noop, onError: noop }; },
    createVideoDecoder: function () { return { start: noop, stop: noop, remove: noop, on: noop, off: noop }; },
    createWorker: function () { return { postMessage: noop, onMessage: noop, terminate: noop }; },
    createBufferURL: function (data) { try { return URL.createObjectURL(new Blob([data])); } catch (e) { return ''; } },
    revokeBufferURL: function (u) { try { URL.revokeObjectURL(u); } catch (e) {} },

    getFileSystemManager: function () { return fs; },
    getStorageSync: storageGet,
    setStorageSync: storageSet,
    removeStorageSync: storageRemove,
    clearStorageSync: function () {
      try {
        var keys = [];
        if (nativeStorage) for (var i = 0; i < nativeStorage.length; i++) keys.push(nativeStorage.key(i));
        keys.forEach(function (k) { if (k && k.indexOf(storagePrefix) === 0) lsRemove(k); });
      } catch (e) {}
      storageCache.clear();
      storageLoaded.clear();
    },
    getStorageInfoSync: function () { return { keys: Array.from(storageCache.keys()), currentSize: 0, limitSize: 10240 }; },
    getStorage: function (o) { later(function () { o.success && o.success({ data: storageGet(o.key) }); o.complete && o.complete({}); }); },
    setStorage: function (o) { storageSet(o.key, o.data); later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    removeStorage: function (o) { storageRemove(o.key); later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    clearStorage: function (o) { wx.clearStorageSync(); later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },

    loadSubpackage: function (o) {
      var progressCb = null;
      setTimeout(function () {
        try { progressCb && progressCb({ progress: 100, totalBytesWritten: 1, totalBytesExpectedToWrite: 1 }); } catch (e) {}
        o && o.success && o.success({});
        o && o.complete && o.complete({});
      }, 0);
      return { onProgressUpdate: function (cb) { progressCb = cb; } };
    },

    downloadFile: function (o) {
      var url = o.url || '';
      var name = baseName(url.split('?')[0]);
      var abName = localAbName(url);
      if (abName) {
        fetchLocalAb(abName).then(function (buf) {
          if (buf) {
            var p = 'wxfile://tmp/' + abName;
            putFile(p, new Uint8Array(buf));
            o.success && o.success({ tempFilePath: p, statusCode: 200 });
          } else {
            o.fail && o.fail({ errMsg: 'local ab missing: ' + abName });
          }
          o.complete && o.complete({});
        }).catch(function (e) { o.fail && o.fail({ errMsg: String(e) }); o.complete && o.complete({}); });
        return { onProgressUpdate: function () {}, abort: noop };
      }
      var existing = getFile(name);
      function done(bytes) {
        if (bytes) {
          var p = 'wxfile://tmp/' + name;
          putFile(p, bytes);
          o.success && o.success({ tempFilePath: p, statusCode: 200 });
        } else {
          o.fail && o.fail({ errMsg: 'downloadFile:fail ' + url });
        }
        o.complete && o.complete({});
      }
      if (existing) { setTimeout(function () { done(existing); }, 0); }
      else if (root.fetch) {
        fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
          .then(function (buf) { done(new Uint8Array(buf)); })
          .catch(function (e) { o.fail && o.fail({ errMsg: String(e) }); o.complete && o.complete({}); });
      } else { setTimeout(function () { done(null); }, 0); }
      return { onProgressUpdate: function () {}, abort: noop };
    },

    request: function (o) {
      var url = o.url || '';
      var abName = localAbName(url);
      if (abName) {
        fetchLocalAb(abName).then(function (buf) {
          if (buf) {
            o.success && o.success({ statusCode: 200, data: buf, header: { 'content-type': 'application/octet-stream' } });
          } else {
            o.fail && o.fail({ errMsg: 'local ab missing: ' + abName });
          }
          o.complete && o.complete({});
        }).catch(function (e) { o.fail && o.fail({ errMsg: String(e) }); o.complete && o.complete({}); });
        return { abort: noop };
      }
      // 静态托管（没有后端）时，直接本地伪造登录结果，保证 sheep 能过加载页。
      if (/\/api\/expro\/getopenid(\?|$)/.test(url)) {
        var loginPayload = JSON.stringify({ code: 200, data: { openid: 'oPigRunLocal0001', unionid: 'uPigRunLocal0001', session_key: 'local' }, message: 'success' });
        later(function () {
          o.success && o.success({ statusCode: 200, data: loginPayload, header: { 'content-type': 'application/json' } });
          o.complete && o.complete({});
        });
        return { abort: noop };
      }
      var method = (o.method || 'GET').toUpperCase();
      var headers = Object.assign({}, o.header || {});
      var body = o.data;
      if (body && typeof body === 'object' && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) {
        try { body = JSON.stringify(body); if (!headers['content-type']) headers['content-type'] = 'application/json'; } catch (e) { body = String(body); }
      }
      fetch(url, { method: method, headers: headers, body: (method === 'GET' || method === 'HEAD') ? undefined : body })
        .then(function (r) {
          var p = (o.responseType === 'arraybuffer') ? r.arrayBuffer() : r.text();
          return p.then(function (data) {
            var header = {}; try { r.headers.forEach(function (v, k) { header[k] = v; }); } catch (e) {}
            o.success && o.success({ statusCode: r.status, data: data, header: header });
            o.complete && o.complete({});
          });
        })
        .catch(function (e) { o.fail && o.fail({ errMsg: String(e) }); o.complete && o.complete({}); });
      return { abort: noop };
    },
    uploadFile: function (o) { later(function () { o.success && o.success({ statusCode: 200, data: '{}' }); o.complete && o.complete({}); }); return { onProgressUpdate: noop, abort: noop }; },

    getLogManager: function () {
      return { log: function () { console.log.apply(console, arguments); }, info: function () { console.info.apply(console, arguments); }, warn: function () { console.warn.apply(console, arguments); }, error: function () { console.error.apply(console, arguments); }, debug: function () { console.debug.apply(console, arguments); }, setFilterMsg: noop, addFilterMsg: noop };
    },
    getRealtimeLogManager: function () {
      return { info: function () { console.info.apply(console, arguments); }, warn: function () { console.warn.apply(console, arguments); }, error: function () { console.error.apply(console, arguments); }, log: function () { console.log.apply(console, arguments); }, setFilterMsg: noop, addFilterMsg: noop, getCurrentState: function () { return {}; } };
    },
    getPerformance: function () { return root.performance; },
    getGameLogManager: function () {
      function make(tag) {
        function out(level) {
          return function () { var a = Array.prototype.slice.call(arguments); var c = console[level] || console.log; c.apply(console, ['[' + (tag || 'game') + ']'].concat(a)); };
        }
        return { tag: function (t) { return make(t || tag); }, info: out('info'), warn: out('warn'), error: out('error'), debug: out('debug'), log: out('log') };
      }
      return make('game');
    },
    getNetworkType: function (o) { later(function () { o.success && o.success({ networkType: 'wifi' }); o.complete && o.complete({}); }); },
    getBatteryInfoSync: function () { return { level: 100, isCharging: true }; },
    getMenuButtonBoundingClientRect: function () { return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 }; },
    setPreferredFramesPerSecond: noop,
    triggerGC: noop,
    onMemoryWarning: noop,
    onError: function (cb) { root.addEventListener('error', function (e) { try { cb({ message: e.message, stack: e.error && e.error.stack }); } catch (x) {} }); },
    onUnhandledRejection: function (cb) { root.addEventListener('unhandledrejection', function (e) { try { cb({ reason: e.reason }); } catch (x) {} }); },
    onShow: function (cb) { root.__wxOnShow = root.__wxOnShow || []; root.__wxOnShow.push(cb); },
    onHide: function (cb) { root.__wxOnHide = root.__wxOnHide || []; root.__wxOnHide.push(cb); },
    offShow: noop, offHide: noop,
    onNetworkStatusChange: function (cb) { root.__wxNet = root.__wxNet || []; root.__wxNet.push(cb); },
    offNetworkStatusChange: noop,
    onWindowResize: function (cb) { root.addEventListener('resize', function () { try { cb({ size: windowInfo() }); } catch (e) {} }); },
    offWindowResize: noop,
    onDeviceOrientationChange: noop, offDeviceOrientationChange: noop,
    onTouchStart: function (cb) { touchHandlers.start.push(cb); bindTouch(); },
    onTouchMove: function (cb) { touchHandlers.move.push(cb); bindTouch(); },
    onTouchEnd: function (cb) { touchHandlers.end.push(cb); bindTouch(); },
    onTouchCancel: function (cb) { touchHandlers.cancel.push(cb); bindTouch(); },
    offTouchStart: noop, offTouchMove: noop, offTouchEnd: noop, offTouchCancel: noop,

    showModal: function (o) { console.warn('[showModal]', o && o.title, o && o.content); later(function () { o.success && o.success({ confirm: true, cancel: false }); o.complete && o.complete({}); }); },
    showToast: function (o) { console.log('[toast]', o && o.title); o && o.success && o.success({}); o && o.complete && o.complete({}); },
    hideToast: noop,
    showLoading: function (o) { console.log('[loading]', o && o.title); o && o.success && o.success({}); },
    hideLoading: noop,
    setClipboardData: function (o) { try { navigator.clipboard && navigator.clipboard.writeText(o.data); } catch (e) {} later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    getClipboardData: function (o) { later(function () { o.success && o.success({ data: '' }); o.complete && o.complete({}); }); },
    vibrateShort: noop, vibrateLong: noop, setKeepScreenOn: noop,

    createRewardedVideoAd: rewardedAdStub, createInterstitialAd: adStub, createBannerAd: adStub, createCustomAd: adStub,
    createGameClubButton: function () { return { show: noop, hide: noop, destroy: noop, onTap: noop, offTap: noop }; },
    createFeedbackButton: function () { return { show: noop, hide: noop, destroy: noop, onTap: noop, offTap: noop }; },
    createUserInfoButton: function () { return { show: noop, hide: noop, destroy: noop, onTap: noop, offTap: noop }; },
    getUserInfo: function (o) { later(function () { o.success && o.success({ userInfo: { nickName: 'Player', avatarUrl: '', gender: 0, country: '', province: '', city: '', language: 'zh_CN' } }); o.complete && o.complete({}); }); },
    getUserCloudStorage: function (o) { later(function () { o.success && o.success({ KVDataList: [] }); o.complete && o.complete({}); }); },
    setUserCloudStorage: function (o) { later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    getFriendCloudStorage: function (o) { later(function () { o.success && o.success({ data: [] }); o.complete && o.complete({}); }); },
    getGroupCloudStorage: function (o) { later(function () { o.success && o.success({ data: [] }); o.complete && o.complete({}); }); },
    getPotentialFriendList: function (o) { later(function () { o.success && o.success({ list: [] }); o.complete && o.complete({}); }); },
    shareAppMessage: function (o) {
      o = o || {};
      // 原版很多道具是“分享获得”：这里直接当作分享成功，回调要真的触发。
      setTimeout(function () {
        try { o.success && o.success({ errMsg: 'shareAppMessage:ok' }); } catch (e) {}
        try { o.complete && o.complete({ errMsg: 'shareAppMessage:ok' }); } catch (e) {}
      }, 80);
      return {};
    },
    showShareMenu: noop, onShareAppMessage: noop, offShareAppMessage: noop,
    onShareTimeline: noop, offShareTimeline: noop, onAddToFavorites: noop, offAddToFavorites: noop,
    navigateToMiniProgram: noop, exitMiniProgram: noop, updateWeChatApp: noop,
    getOpenDataContext: function () { return { canvas: wx.createCanvas(), postMessage: noop }; },
    getSharedCanvas: function () { return wx.createCanvas(); },
    onMessage: noop,
    getGameRecorder: function () { return { start: noop, stop: noop, on: noop, off: noop, getDuration: function () { return 0; } }; },
    operateGameRecorderVideo: noop,
    getRecorderManager: function () { return { start: noop, stop: noop, pause: noop, resume: noop, onStart: noop, onStop: noop, onError: noop, onPause: noop, onResume: noop }; },
    createCamera: function () { return { start: noop, stop: noop, destroy: noop }; },
    connectSocket: function () { return { onOpen: noop, onMessage: noop, onError: noop, onClose: noop, send: noop, close: noop }; },
    createTCPSocket: function () { return { connect: noop, write: noop, close: noop, onConnect: noop, onMessage: noop, onError: noop, onClose: noop }; },
    createUDPSocket: function () { return { bind: noop, send: noop, close: noop, onMessage: noop, onError: noop }; },
    startGyroscope: noop, stopGyroscope: noop, onGyroscopeChange: noop,
    showKeyboard: noop, hideKeyboard: noop, onKeyboardInput: noop, onKeyboardConfirm: noop, onKeyboardComplete: noop,
    onAudioInterruptionBegin: noop, onAudioInterruptionEnd: noop,
    onHandoff: noop, onGameLiveStateChange: noop, onCopyUrl: noop, onBLECharacteristicValueChange: noop,
    onDirectAdStatusChange: noop, getDirectAdStatusSync: function () { return false; },
    reportUserBehaviorBranchAnalytics: noop, reportAnalytics: noop, reportMonitor: noop, reportEvent: noop,
    login: function (o) { later(function () { o.success && o.success({ code: 'browser' }); o.complete && o.complete({}); }); },
    checkSession: function (o) { later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    getSetting: function (o) { later(function () { o.success && o.success({ authSetting: {} }); o.complete && o.complete({}); }); },
    authorize: function (o) { later(function () { o.success && o.success({}); o.complete && o.complete({}); }); },
    getUpdateManager: function () { return { onCheckForUpdate: noop, onUpdateReady: noop, onUpdateFailed: noop, applyUpdate: noop }; },
    restartMiniProgram: function () { console.warn('[pigrun] restartMiniProgram called (ignored)'); },
    cloud: { init: noop, callFunction: function () { return Promise.resolve({ result: {} }); }, database: function () { return { collection: function () { return { where: function () { return { get: function () { return Promise.resolve({ data: [] }); }, count: function () { return Promise.resolve({ total: 0 }); } }; }, get: function () { return Promise.resolve({ data: [] }); } }; } }; } },
    uma: { report: noop, reportEvent: noop, reportLoad: noop, setData: noop },
    // --- WeChat APIs that UnityPlugin/game code calls unconditionally ---
    getSystemInfoAsync: function (o) {
      o = o || {};
      later(function () {
        var info = (root.wx && root.wx.getSystemInfoSync) ? root.wx.getSystemInfoSync() : {};
        o.success && o.success(info);
        o.complete && o.complete(info);
      });
    },
    getExptInfoSync: function () { return {}; },
    getGameAudits: function (o) {
      function Emitter() { this._m = {}; }
      Emitter.prototype.on = function (k, fn) { (this._m[k] = this._m[k] || []).push(fn); return this; };
      Emitter.prototype.off = function (k, fn) { var a = this._m[k] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); return this; };
      Emitter.prototype.emit = function (k) { var a = (this._m[k] || []).slice(); for (var i = 0; i < a.length; i++) { try { a[i].apply(this, Array.prototype.slice.call(arguments, 1)); } catch (e) {} } return this; };
      function BaseTask(opts) { Object.assign(this, opts || {}); }
      BaseTask.prototype.getTaskType = function () { return this.taskType; };
      function CustomCheckType(opts) { Object.assign(this, opts || {}); }
      var emitter = new Emitter();
      var api = {
        messenger: emitter,
        EventType: { Start: 'start', End: 'end', Finish: 'finish' },
        BaseTask: BaseTask,
        CustomCheckType: CustomCheckType,
        register: function () { return 0; },
        unregister: noop,
        onStateChange: emitter.on.bind(emitter),
        offStateChange: emitter.off.bind(emitter),
        isInAudit: function () { return false; },
        getAuditInfo: function () { return {}; },
        start: noop,
        stop: noop
      };
      if (o && o.success) later(function () { o.success(api); o.complete && o.complete(api); });
      return api;
    },
    onGameAuditStateChange: noop,
    reportScene: function (o) { if (o && o.success) later(function () { o.success({}); o.complete && o.complete({}); }); },
    reportPerformanceScene: noop,
    reportUserBehaviorBranchAnalytics: noop,
    startCPUProfiling: function (o) { if (o && o.success) later(function () { o.success({}); o.complete && o.complete({}); }); },
    stopCPUProfiling: function (o) { if (o && o.success) later(function () { o.success({}); o.complete && o.complete({}); }); },
    starDownloadTexture: noop,
    stopDownloadTexture: noop,
    shareMessageToFriend: function (o) { later(function () { o && o.success && o.success({}); o && o.complete && o.complete({}); }); },
    onNeedPrivacyAuthorization: noop,
    offKeyboardInput: noop,
    offKeyboardConfirm: noop,
    offKeyboardComplete: noop,
    offHandoff: noop,
    offGyroscopeChange: noop,
    offGameLiveStateChange: noop,
    offCopyUrl: noop,
    offBLECharacteristicValueChange: noop,
    onKeyDown: noop,
    onKeyUp: noop,
    offKeyDown: noop,
    offKeyUp: noop,
    getDirectAdStatusSync: function () { return { status: 0 }; },
    onDirectAdStatusChange: noop,
    offDirectAdStatusChange: noop,
    getGameRecorderManager: function () {
      return {
        start: noop, stop: noop, pause: noop, resume: noop,
        onStart: noop, onStop: noop, onPause: noop, onResume: noop,
        onError: noop, onFrameRecorded: noop, onInterruptionBegin: noop, onInterruptionEnd: noop
      };
    },
    createWebAudioContext: sharedAudioContext,
    createMediaAudioPlayer: function () { return { start: noop, stop: noop, destroy: noop, onCanplay: noop, onPlay: noop, onStop: noop, onEnded: noop, onError: noop }; },
    getFileSystemManager: function () { return fs; }
  };
  // Report missing APIs loudly instead of failing with "wx[s] is not a function"
  // deep inside the game glue.
  var missingWx = Object.create(null);
  root.wx = /(?:[?&])plainwx=1/.test(location.search) ? wx : new Proxy(wx, {
    get: function (target, key) {
      var v = target[key];
      if (v === undefined && typeof key === 'string' && key !== 'then' && key !== 'toJSON' && key !== 'inspect') {
        if (!missingWx[key]) {
          missingWx[key] = 1;
          console.warn('[wx missing]', key);
        }
      }
      return v;
    },
    has: function (target, key) { return key in target; }
  });
  root.__pigrunMissingWx = missingWx;

  // Expose VFS helpers to the bootstrap code.
  root.__pigrun = {
    putFile: putFile,
    getFile: getFile,
    files: files,
    baseName: baseName
  };

  // ---------------- WXWebAssembly ----------------
  root.WXWebAssembly = {
    instantiate: function (source, imports) {
      if (typeof source === 'string') {
        var data = getFile(source);
        if (!data) return Promise.reject(new Error('WXWebAssembly: wasm not found: ' + source));
        return NativeWebAssembly.instantiate(toArrayBuffer(data), imports);
      }
      return NativeWebAssembly.instantiate(source, imports);
    },
    compile: function (source) { return NativeWebAssembly.compile(source); },
    validate: function (source) { return NativeWebAssembly.validate(source); },
    Module: NativeWebAssembly.Module,
    Instance: NativeWebAssembly.Instance,
    Memory: NativeWebAssembly.Memory,
    Table: NativeWebAssembly.Table,
    Global: NativeWebAssembly.Global,
    RuntimeError: NativeWebAssembly.RuntimeError,
    CompileError: NativeWebAssembly.CompileError,
    LinkError: NativeWebAssembly.LinkError
  };
  root.GameGlobal.WXWebAssembly = root.WXWebAssembly;

  // ---------------- manager / managerConfig interception ----------------
  // Wrap every wasm import so a main-thread hang can be localised: the wrapper
  // is called from wasm, therefore still runs while the JS event loop is stuck.
  var traceEnabled = /(?:[?&])traceimports=1/.test(location.search);
  if (traceEnabled) {
    var wrapWasmFn = function (name) {
      var orig = NativeWebAssembly[name];
      if (typeof orig !== 'function') return;
      NativeWebAssembly[name] = function (src, imports) {
        maybeTraceImports(imports);
        return orig.apply(this, arguments);
      };
    };
    wrapWasmFn('instantiate');
    wrapWasmFn('instantiateStreaming');
    console.log('[imports] wasm tracing installed');
  }
  function maybeTraceImports(imports) {
    if (!traceEnabled || !imports) return;
    var stats = Object.create(null);
    var total = 0, lastLog = 0, started = Date.now();
    root.__importStats = stats;
    try {
      Object.keys(imports).forEach(function (mod) {
        var ns = imports[mod];
        if (!ns || typeof ns !== 'object') return;
        Object.keys(ns).forEach(function (key) {
          var fn = ns[key];
          if (typeof fn !== 'function') return;
          var name = mod + '.' + key;
          ns[key] = function () {
            stats[name] = (stats[name] || 0) + 1;
            total++;
            var now = Date.now();
            if (now - lastLog > 400) {
              lastLog = now;
              var top = Object.keys(stats).map(function (k) { return [k, stats[k]]; })
                .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
              console.log('[imports]', 't=' + ((now - started) / 1000).toFixed(1) + 's', 'total=' + total,
                JSON.stringify(top.map(function (x) { return x[0] + ':' + x[1]; })));
            }
            return fn.apply(this, arguments);
          };
        });
      });
      console.log('[imports] wrapped', Object.keys(stats).length, 'imports');
    } catch (e) { console.error('[imports] wrap failed', e); }
  }

  Object.defineProperty(root, 'manager', {
    configurable: true,
    get: function () { return root.__pigrunManager; },
    set: function (v) {
      root.__pigrunManager = v;
      try { if (v && v.isVisible === undefined) v.isVisible = true; } catch (e) {}
      console.log('[pigrun] manager ready', { isVisible: v && v.isVisible });
    }
  });

  // Log manager method entry/exit so a synchronous stall can be pinned down to
  // the exact JS function that never returns.
  var mgrDepth = 0, mgrCalls = 0;
  function traceManagerCalls(mgr) {
    if (!mgr || !/(?:[?&])trace=1/.test(location.search)) return;
    var seen = {};
    var wrapped = 0;
    var o = mgr;
    while (o && o !== Object.prototype) {
      Object.getOwnPropertyNames(o).forEach(function (name) {
        if (seen[name] || name === 'constructor') return;
        seen[name] = 1;
        var d;
        try { d = Object.getOwnPropertyDescriptor(o, name); } catch (e) { return; }
        if (!d || typeof d.value !== 'function' || !d.writable) return;
        var fn = d.value;
        if (fn.__pigrunWrapped) return;
        var wrappedFn = function () {
          var id = ++mgrCalls;
          var pad = new Array(Math.min(mgrDepth, 8) + 1).join('  ');
          if (mgrCalls <= 500) console.log('[mgr]' + pad + '-> ' + name + '#' + id);
          mgrDepth++;
          var t0 = performance.now();
          try {
            var r = fn.apply(this, arguments);
            if (r && typeof r.then === 'function') {
              return r.then(function (x) {
                mgrDepth--;
                if (mgrCalls <= 500) console.log('[mgr]' + pad + '<- ' + name + '#' + id + ' ' + (performance.now() - t0).toFixed(0) + 'ms(p)');
                return x;
              }, function (e) {
                mgrDepth--;
                if (mgrCalls <= 500) console.log('[mgr]' + pad + '<! ' + name + '#' + id + ' rejected ' + (e && e.message));
                throw e;
              });
            }
            mgrDepth--;
            if (mgrCalls <= 500) console.log('[mgr]' + pad + '<- ' + name + '#' + id + ' ' + (performance.now() - t0).toFixed(0) + 'ms');
            return r;
          } catch (e) {
            mgrDepth--;
            console.log('[mgr]' + pad + '<! ' + name + '#' + id + ' threw ' + (e && e.message));
            throw e;
          }
        };
        wrappedFn.__pigrunWrapped = true;
        try { Object.defineProperty(o, name, { value: wrappedFn, writable: true, configurable: true }); wrapped++; } catch (e) {}
      });
      o = Object.getPrototypeOf(o);
    }
    console.log('[mgr] wrapped', wrapped, 'methods');
  }

  Object.defineProperty(root, 'managerConfig', {
    configurable: true,
    get: function () { return root.__pigrunManagerConfig; },
    set: function (v) {
      if (!v || typeof v !== 'object') { root.__pigrunManagerConfig = v; return; }
      // Use the local data-package subpackage instead of the CDN, and feed the
      // decompressed wasm to the Unity runtime directly.
      v.loadDataPackageFromSubpackage = true;
      v.compressDataPackage = false;
      // The data package may have been rebuilt/patch (size differs from the
      // MD5-era config); keep the plugin's expectation in sync.
      if (root.__pigrunDataSize) {
        v.DATA_FILE_SIZE = root.__pigrunDataSize;
        try {
          if (root.GameGlobal && root.GameGlobal.unityNamespace) root.GameGlobal.unityNamespace.DATA_FILE_SIZE = root.__pigrunDataSize;
        } catch (e) {}
      }
      if (/(?:[?&])debug=1/.test(location.search)) {
        v.enableDebugLog = true;
        try {
          var un0 = root.GameGlobal && root.GameGlobal.unityNamespace;
          if (un0 && un0.env) { un0.env.isDevtools = true; un0.debug = true; }
        } catch (e) {}
      }
      v.instantiateWasm = function (imports, successCallback) {
        var buf = root.__pigrunWasmBuffer;
        if (!buf) { console.error('wasm buffer not preloaded'); return {}; }
        maybeTraceImports(imports);
        NativeWebAssembly.instantiate(buf, imports).then(function (r) {
          successCallback(r.instance, r.module);
        }).catch(function (e) {
          console.error('WebAssembly.instantiate failed', e);
          throw e;
        });
        return {};
      };
      // The UnityPlugin reads GAME_NAME / *_MD5 from unityNamespace and the
      // loading options from the manager config, so keep both in sync.
      if (root.GameGlobal && root.GameGlobal.unityNamespace) {
        Object.assign(root.GameGlobal.unityNamespace, v);
        root.GameGlobal.unityNamespace.instantiateWasm = v.instantiateWasm;
      }
      root.__pigrunManagerConfig = v;
      console.log('[pigrun] managerConfig patched', {
        dataSubpackage: v.loadDataPackageFromSubpackage,
        compress: v.compressDataPackage,
        dataMd5: v.DATA_FILE_MD5,
        codeMd5: v.CODE_FILE_MD5
      });
    }
  });
})();
