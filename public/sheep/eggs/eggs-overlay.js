/* 大宝专属彩蛋层：叠加在原版 Unity 游戏之上，不改动游戏逻辑。
 * 数据来自用户项目 src/core/eggs.ts、phrases.ts。 */
(function () {
  'use strict';
  // 用真正的 DOM：Unity 适配层可能把 window.document 换掉
  var doc = window.__pigrunNativeDocument || window.document;
  var realBody = window.__pigrunRealBody || doc.body;
  var realRoot = window.__pigrunRealRoot || doc.documentElement;
  var realCreate = window.__pigrunCreateElement || null;
  var createEl = realCreate ? function (tag) { return realCreate(tag); } : function (tag) { return doc.createElement(tag); };
  function mount(node) { try { (realBody && realBody.appendChild && realBody.appendChild(node)) || (realRoot && realRoot.appendChild && realRoot.appendChild(node)); } catch (e) { try { doc.body && doc.body.appendChild(node); } catch (e2) {} } }
  var EGGS = window.PIG_EGGS || [];
  var PHRASES = window.PIG_PHRASES || [];
  var KEY = 'pigrun_egg_state_v1';
  var state = { unlocked: 0, cleared: 0, seen: [] };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function unlockNext() {
    if (state.unlocked >= EGGS.length) return null;
    var idx = state.unlocked++;
    save();
    return idx;
  }
  // 每 5 关解锁一条（与项目 src/core/eggs.ts 的规则一致）
  function onLevelClear() {
    state.cleared = (state.cleared || 0) + 1;
    save();
    if (state.cleared % 5 === 0) {
      var idx = unlockNext();
      if (idx != null) {
        showEgg(idx);
        hearts(10);
        toast('解锁新彩蛋 💌');
        if (mask.classList.contains('on')) renderList();
      }
    }
  }
  function scanLevel(text) {
    if (!text || text.length > 200) return;
    var m = /关卡ID-(\d+)/.exec(text) || /关卡名称[:：]\s*[^0-9]*(\d+)/.exec(text) || /关卡名字-[^0-9]*(\d+)/.exec(text);
    if (!m) return;
    var num = parseInt(m[1], 10);
    if (!num || num <= 0 || num > 5000) return;
    if (!state.lastLevelNum) {
      // 第一次记录：把“已经到第 N 关”补记成 N-1 次通关，老玩家不会白玩
      state.lastLevelNum = num;
      state.cleared = (state.cleared || 0) + Math.max(0, num - 1);
      settleUnlocks();
      save();
      return;
    }
    if (num > state.lastLevelNum) {
      var inc = Math.min(num - state.lastLevelNum, 20);
      state.cleared = (state.cleared || 0) + inc;
      state.lastLevelNum = num;
      settleUnlocks();
      save();
    } else if (num < state.lastLevelNum) {
      state.lastLevelNum = num;
      save();
    }
  }
  function settleUnlocks() {
    while (state.unlocked * 5 + 5 <= (state.cleared || 0) && state.unlocked < EGGS.length) {
      state.unlocked++;
      showEgg(state.unlocked - 1);
      hearts(8);
      toast('解锁新彩蛋 💌');
    }
  }
  var css = createEl('style');
  css.textContent = [
    '#eggs-fab{position:fixed;left:14px;bottom:120px;z-index:2147483000;width:52px;height:52px;border-radius:50%;border:none;',
    'background:linear-gradient(135deg,#ff8fab,#ff5c8a);color:#fff;font-size:24px;box-shadow:0 6px 18px rgba(255,92,138,.45);',
    'cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation;animation:eggPulse 2.4s infinite;}',
    '@keyframes eggPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}',
    '#eggs-mask{position:fixed;inset:0;z-index:2147483001;background:rgba(20,10,15,.55);display:none;align-items:center;justify-content:center;padding:18px;}',
    '#eggs-mask.on{display:flex}',
    '#eggs-card{width:min(92vw,420px);max-height:80vh;overflow:auto;background:linear-gradient(180deg,#fffaf6,#ffeef3);border-radius:20px;',
    'box-shadow:0 18px 50px rgba(0,0,0,.35);padding:18px 18px 14px;font:15px/1.65 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#5a2b39;}',
    '#eggs-card h3{margin:0 0 4px;font-size:18px;display:flex;align-items:center;gap:8px;}',
    '#eggs-card .sub{font-size:12px;color:#a3667a;margin-bottom:12px}',
    '#eggs-body{min-height:96px;background:#fff;border-radius:14px;padding:14px;box-shadow:inset 0 0 0 1px #ffd9e3;font-size:16px;color:#c2185b;text-align:center}',
    '#eggs-list{margin-top:12px;border-top:1px dashed #ffd0dd;padding-top:10px;max-height:30vh;overflow:auto;font-size:13px}',
    '#eggs-list div{padding:3px 0;color:#7a4a5a}',
    '#eggs-list div.locked{color:#c9aab4}',
    '#eggs-actions{display:flex;gap:10px;margin-top:12px}',
    '#eggs-actions button{flex:1;border:none;border-radius:12px;padding:10px;font-size:14px;cursor:pointer;background:#ffd9e3;color:#8c2f4d}',
    '#eggs-actions button.primary{background:linear-gradient(135deg,#ff8fab,#ff5c8a);color:#fff}',
    '#eggs-heart{position:fixed;z-index:2147483002;pointer-events:none;font-size:26px;animation:eggFly 2.2s ease-out forwards}',
    '@keyframes eggFly{0%{transform:translateY(0) scale(.6);opacity:0}12%{opacity:1}100%{transform:translateY(-70vh) scale(1.4);opacity:0}}',
  ].join('');
  doc.head.appendChild(css);

  var fab = createEl('button');
  fab.id = 'eggs-fab';
  fab.title = '大宝的彩蛋';
  fab.textContent = '💌';
  mount(fab);

  var mask = createEl('div');
  mask.id = 'eggs-mask';
  mask.innerHTML =
    '<div id="eggs-card">' +
    '<h3>💕 大宝的彩蛋</h3><div class="sub">每过 5 关解锁一条 · 共 ' + EGGS.length + ' 条</div>' +
    '<div id="eggs-body">今天也超级喜欢你 ❤️</div>' +
    '<div id="eggs-list"></div>' +
    '<div id="eggs-actions"><button id="eggs-close" class="primary">收好</button></div>' +
    '</div>';
  mount(mask);
  var body = mask.querySelector('#eggs-body');
  var list = mask.querySelector('#eggs-list');

  function renderList() {
    try {
    list.innerHTML = '';
    for (var i = 0; i < EGGS.length; i++) {
      var d = createEl('div');
      var has = i < state.unlocked;
      d.className = has ? '' : 'locked';
      d.textContent = (i + 1) + '. ' + (has ? EGGS[i] : '???');
      list.appendChild(d);
    }
    } catch (e) { console.error('[eggs] renderList failed', e); }
  }
  function showEgg(idx) {
    body.textContent = EGGS[idx] || '爱你哟';
    body.animate ? body.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220 }) : 0;
  }
  function hearts(n) {
    for (var i = 0; i < n; i++) {
      (function (i) {
        var h = createEl('div');
        h.id = 'eggs-heart';
        h.textContent = ['❤️', '💕', '💖', '🌸'][i % 4];
        h.style.left = (15 + Math.random() * 70) + 'vw';
        h.style.top = (60 + Math.random() * 25) + 'vh';
        h.style.animationDelay = (i * 90) + 'ms';
        mount(h);
        setTimeout(function () { h.remove(); }, 2400 + i * 90);
      })(i);
    }
  }
  function open() {
    mask.classList.add('on');
    try { renderList(); } catch (e) { console.error('[eggs] render failed', e); }
    var toNext = 5 - ((state.cleared || 0) % 5);
    if (state.unlocked > 0) {
      showEgg(state.unlocked - 1);
      mask.querySelector('.sub').textContent = '每过 5 关解锁一条 · 已解锁 ' + state.unlocked + '/' + EGGS.length + ' · 再过关 ' + toNext + ' 次解锁下一条';
    } else {
      body.textContent = '先去过 5 关吧～ 还差 ' + toNext + ' 关解锁第一条 💕';
      mask.querySelector('.sub').textContent = '每过 5 关解锁一条 · 共 ' + EGGS.length + ' 条';
    }
  }
  fab.addEventListener('click', open);
  mask.addEventListener('click', function (e) { if (e.target === mask) mask.classList.remove('on'); });
  mask.querySelector('#eggs-close').addEventListener('click', function () { mask.classList.remove('on'); });


  // 口令彩蛋：在页面上输入任意一句“口令”（来自 phrases.ts）会触发满屏爱心
  var typed = '';
  window.addEventListener('keydown', function (e) {
    if (e.key && e.key.length === 1) typed = (typed + e.key).slice(-12);
    if (PHRASES.some(function (p) { return typed.indexOf(p) >= 0; })) {
      typed = '';
      hearts(16);
      body.textContent = '口令正确！奖励你一个抱抱 🫂';
      mask.classList.add('on');
      renderList();
    }
  });


  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = createEl('div');
      toastEl.style.cssText = 'position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:2147483004;background:rgba(255,92,138,.95);color:#fff;padding:10px 18px;border-radius:999px;font:14px/1 system-ui,"PingFang SC",sans-serif;box-shadow:0 8px 24px rgba(255,92,138,.45);opacity:0;transition:opacity .25s';
      mount(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(function () { toastEl.style.opacity = '0'; }, 2200);
  }

  // 暂停按钮热区：游戏里暂停图标的可点区域比图标本身偏下，这里做一个透明热区，
  // 点左上角就把触摸转发到引擎实际认的坐标（羊：40,70）。
  var pauseHot = createEl('div');
  pauseHot.id = 'pigrun-pause-hot';
  pauseHot.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:96px;z-index:2147482999;background:transparent;touch-action:manipulation;';
  pauseHot.addEventListener('pointerup', function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (!window.__pigrunEmitTouch) return;
    window.__pigrunEmitTouch('touchstart', 25, 55);
    setTimeout(function () { window.__pigrunEmitTouch && window.__pigrunEmitTouch('touchend', 25, 55); }, 60);
  }, { passive: false });
  mount(pauseHot);

  // 关卡日志埋点：两个游戏在进入新关卡时都会打印关卡 ID/名字。
  ;['log', 'info'].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      try {
        for (var i = 0; i < arguments.length; i++) if (typeof arguments[i] === 'string') scanLevel(arguments[i]);
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });

  // 调试/演示：?eggs=1 直接打开
  if (/[?&]eggs=1/.test(location.search)) setTimeout(open, 800);
  console.log('[eggs] overlay ready, total=' + EGGS.length);

  /* ---------------- 口令领道具（替代看广告） ---------------- */
  var verifyMask = createEl('div');
  verifyMask.id = 'verify-mask';
  verifyMask.innerHTML =
    '<div id="verify-card">' +
    '<h3>💗 输入口令领道具</h3>' +
    '<div class="vsub">看广告太麻烦啦，把这句话打出来就行～</div>' +
    '<div id="verify-phrase"></div>' +
    '<input id="verify-input" autocomplete="off" placeholder="在这里输入上面的口令" />' +
    '<div id="verify-err">再试一次，差一点点 💕</div>' +
    '<div id="verify-actions"><button id="verify-cancel">先不要</button><button id="verify-ok" class="primary">领取道具</button></div>' +
    '</div>';
  mount(verifyMask);
  var vcss = createEl('style');
  vcss.textContent = [
    '#verify-mask{position:fixed;inset:0;z-index:2147483003;background:rgba(20,10,15,.6);display:none;align-items:center;justify-content:center;padding:18px;}',
    '#verify-mask.on{display:flex}',
    '#verify-card{width:min(92vw,400px);background:linear-gradient(180deg,#fffaf6,#ffeef3);border-radius:20px;padding:18px;',
    'box-shadow:0 18px 50px rgba(0,0,0,.35);font:15px/1.6 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#5a2b39;}',
    '#verify-card h3{margin:0 0 4px;font-size:18px}',
    '#verify-card .vsub{font-size:12px;color:#a3667a;margin-bottom:12px}',
    '#verify-phrase{background:#fff;border-radius:12px;box-shadow:inset 0 0 0 1px #ffd9e3;padding:14px;text-align:center;',
    'font-size:20px;color:#c2185b;letter-spacing:1px;margin-bottom:12px}',
    '#verify-input{width:100%;border:1px solid #ffc2d3;border-radius:12px;padding:11px 12px;font-size:16px;outline:none;background:#fff;color:#5a2b39}',
    '#verify-input:focus{border-color:#ff5c8a;box-shadow:0 0 0 3px rgba(255,92,138,.15)}',
    '#verify-err{display:none;color:#d32f2f;font-size:12px;margin-top:8px}',
    '#verify-err.on{display:block}',
    '#verify-actions{display:flex;gap:10px;margin-top:14px}',
    '#verify-actions button{flex:1;border:none;border-radius:12px;padding:11px;font-size:14px;cursor:pointer;background:#ffd9e3;color:#8c2f4d}',
    '#verify-actions button.primary{background:linear-gradient(135deg,#ff8fab,#ff5c8a);color:#fff}',
  ].join('');
  doc.head.appendChild(vcss);
  var vPhrase = verifyMask.querySelector('#verify-phrase');
  var vInput = verifyMask.querySelector('#verify-input');
  var vErr = verifyMask.querySelector('#verify-err');
  var vResolve = null;
  function vFinish(ok) {
    verifyMask.classList.remove('on');
    vInput.blur();
    var r = vResolve; vResolve = null;
    if (r) r(!!ok);
  }
  function vSubmit() {
    if (!vResolve) return;
    if (vInput.value.trim() === vPhrase.textContent.trim()) {
      vErr.classList.remove('on');
      hearts(8);
      vFinish(true);
    } else {
      vErr.classList.add('on');
      vInput.select();
    }
  }
  verifyMask.querySelector('#verify-ok').addEventListener('click', vSubmit);
  verifyMask.querySelector('#verify-cancel').addEventListener('click', function () { vFinish(false); });
  vInput.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); vSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); vFinish(false); }
  });
  window.PigVerify = {
    ask: function () {
      if (vResolve) return Promise.resolve(false);
      var phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)] || '爱你';
      vPhrase.textContent = phrase;
      vInput.value = '';
      vErr.classList.remove('on');
      verifyMask.classList.add('on');
      setTimeout(function () { try { vInput.focus(); } catch (e) {} }, 60);
      return new Promise(function (resolve) { vResolve = resolve; });
    },
  };

  // 有些 Unity 构建会清空 body，定时确认彩蛋层还挂在 DOM 上。
  setInterval(function () {
    [fab, mask, verifyMask].forEach(function (n) {
      if (n && !n.isConnected) mount(n);
    });
  }, 2000);
  console.log('[verify] passphrase reward ready, phrases=' + PHRASES.length);
})();
