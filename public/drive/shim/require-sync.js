/* 微信小游戏的 define/require：同步取文件 + 模块注册表（Laya 构造用）。
   支持两种文件：
   - define("id", factory) 打包文件（可含多个模块）
   - 普通 CommonJS 脚本（exports.xxx / module.exports），如 weapp-adapter.js、splash2.js */
(function () {
  'use strict';
  if (window.__requireSyncInstalled) return;
  window.__requireSyncInstalled = true;
  var registry = Object.create(null);
  var cache = Object.create(null);
  function norm(p) { return String(p).replace(/^\.\//, '').replace(/^\/+/, ''); }
  function pick(id) {
    if (registry[id]) return id;
    if (registry[id + '.js']) return id + '.js';
    if (registry[id + '/index.js']) return id + '/index.js';
    return id;
  }
  function resolve(from, name) {
    name = norm(name);
    if (name.charAt(0) === '.') {
      var base = (from || '').split('/');
      base.pop();
      name.split('/').forEach(function (part) {
        if (part === '..') base.pop();
        else if (part !== '.' && part !== '') base.push(part);
      });
      return pick(base.join('/'));
    }
    var id = pick(name);
    if (!registry[id] && !cache[id] && from) {
      var dir = from.split('/').slice(0, -1).join('/');
      var alt = pick(dir ? dir + '/' + name : name);
      if (registry[alt] || cache[alt]) id = alt;
    }
    return id;
  }
  function fetchText(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('require: cannot load ' + url + ' (' + xhr.status + ')');
    return xhr.responseText;
  }
  function exec(id, factory) {
    if (window.__REQ_DEBUG) try { console.log('[exec] ' + id); } catch (e) {}
    var module = { exports: {} };
    cache[id] = module;
    try { factory(makeRequire(id), module, module.exports); if (window.__REQ_DEBUG) try { console.log('[exec-ok] ' + id); } catch (e) {} }
    catch (e) { delete cache[id]; throw e; }
    return module.exports;
  }
  // 加载一个物理文件；返回 (id, exports)
  function loadFile(id) {
    if (window.__REQ_DEBUG) try { console.log('[req] ' + id); } catch (e) {}
    var url = id;
    if (!/\.(js|json)$/.test(url)) url += '.js';
    if (cache[url]) {
      if (registry[id]) return { id: id, exports: exec(id, registry[id]) };
      return { id: url, exports: cache[url].exports };
    }
    var text = fetchText(url);
    var module = { exports: {} };
    cache[url] = module;
    var before = registry[id] || registry[url];
    if (/\.json$/.test(url)) {
      try { module.exports = JSON.parse(text); } catch (e) { module.exports = {}; }
    } else {
      if (window.__REQ_DEBUG) try { console.log('[parse] ' + url + ' ' + text.length); } catch (e) {}
      var fn = new Function('define', 'require', 'module', 'exports', text + '\n//# sourceURL=' + url);
      if (window.__REQ_DEBUG) try { console.log('[parsed] ' + url); } catch (e) {}
      try {
        fn(window.define, makeRequire(url), module, module.exports);
      } catch (e) {
        delete cache[url];
        throw e;
      }
    }
    // 文件里注册了 define 模块：优先执行对应的工厂
    if (registry[id]) { if (cache[id] === module) { delete cache[url]; if (url !== id) delete cache[id]; } return { id: id, exports: exec(id, registry[id]) }; }
    var p = pick(id);
    if (registry[p] && cache[p] !== module) {
      delete cache[url]; if (url !== id) delete cache[id];
      return { id: p, exports: exec(p, registry[p]) };
    }
    return { id: url, exports: module.exports };
  }
  function makeRequire(from) {
    return function require(name) {
      var id = resolve(from, name);
      if (cache[id] && !registry[id]) {
        if (registry[id]) return exec(id, registry[id]);
        return cache[id].exports;
      }
      if (registry[id]) {
        return cache[id] ? cache[id].exports : exec(id, registry[id]);
      }
      var res = loadFile(id);
      if (res.id === id && cache[id] && registry[id]) return cache[id].exports;
      return res.exports;
    };
  }
  window.define = function (name, factory) { registry[norm(name)] = factory; };
  window.require = makeRequire('');
  window.requirePlugin = function () { throw new Error('requirePlugin not supported'); };
  window.loadLib = window.require;
  window.__REG = registry;
  window.__CACHE = cache;
})();
