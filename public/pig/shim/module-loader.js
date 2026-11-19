/* Minimal WeChat-style define/require loader for the unpacked game + UnityPlugin bundles. */
(function () {
  'use strict';
  var modules = Object.create(null);
  var cache = Object.create(null);

  function norm(name) { return String(name).replace(/^\/+/, ''); }

  function pick(id) {
    if (modules[id]) return id;
    if (modules['__plugin__/' + id]) return '__plugin__/' + id;
    if (modules[id + '.js']) return id + '.js';
    if (modules['__plugin__/' + id + '.js']) return '__plugin__/' + id + '.js';
    if (modules[id + '/index.js']) return id + '/index.js';
    if (modules['__plugin__/' + id + '/index.js']) return '__plugin__/' + id + '/index.js';
    return id;
  }

  function resolve(from, name) {
    name = String(name);
    if (name.charAt(0) === '.') {
      var base = from ? from.split('/') : [];
      if (base.length) base.pop();
      name.split('/').forEach(function (part) {
        if (part === '..') base.pop();
        else if (part !== '.' && part !== '') base.push(part);
      });
      return pick(base.join('/'));
    }
    var id = pick(norm(name));
    if (!modules[id] && from && from.indexOf('__plugin__/') === 0) {
      var pluginRoot = from.split('/').slice(0, 2).join('/') + '/';
      id = pick(pluginRoot + norm(name));
    }
    return id;
  }

  function makeRequire(from) {
    return function require(name) {
      var id = resolve(from, name);
      if (cache[id]) return cache[id].exports;
      var factory = modules[id];
      if (!factory) throw new Error('module not found: ' + name + ' (from ' + (from || '<root>') + ', tried ' + id + ')');
      var module = { exports: {} };
      cache[id] = module;
      try {
        factory(makeRequire(id), module, module.exports);
      } catch (e) {
        delete cache[id];
        throw e;
      }
      return module.exports;
    };
  }

  window.define = function (name, factory) { modules[norm(name)] = factory; };
  window.require = makeRequire('');
  window.requirePlugin = function (name, options) {
    if (name === 'UnityPlugin') {
      // WeChat exposes a pluginEnv global while a mini-game plugin runs. The
      // UnityPlugin SDK reads it directly, so emulate it from customEnv.
      var env = (options && options.customEnv) || {};
      window.pluginEnv = {
        customEnv: env,
        instanceId: 'browser',
        pluginAppId: 'wxe5a48f1ed5f544b7',
        pluginVersion: '1.3.7',
        reportKeyValue: function () {},
        gameTransfer: function () { return Promise.resolve([]); },
        getPrivateFileSystemManager: function () { return window.wx.getFileSystemManager(); },
        setFileSpaceStatistics: function () {},
        getWxCommonFont: function () { return null; },
        coverview: null
      };
      var mod = window.require('__plugin__/wxe5a48f1ed5f544b7');
      return (mod && mod.default) ? mod : { default: mod };
    }
    if (name === 'MiniGameCommon') {
      var env2 = (options && options.customEnv) || {};
      window.pluginEnv = {
        customEnv: env2,
        instanceId: 'browser',
        pluginAppId: 'wxaed5ace05d92b218',
        pluginVersion: 'latest',
        reportKeyValue: function () {},
        gameTransfer: function () { return Promise.resolve([]); },
        getPrivateFileSystemManager: function () { return window.wx.getFileSystemManager(); },
        setFileSpaceStatistics: function () {},
        getWxCommonFont: function () { return null; },
        coverview: null
      };
      var mod2 = window.require('__plugin__/wxaed5ace05d92b218');
      return (mod2 && mod2.default) ? mod2 : { default: mod2 };
    }
    throw new Error('requirePlugin: unsupported plugin ' + name);
  };
  window.__modules = modules;
  window.__moduleCache = cache;
})();
