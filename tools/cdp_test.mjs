// 用 CDP 驱动 headless Edge 做交互冒烟测试(选关/弹层)
const PORT = 9333;
const URL = process.env.TEST_URL || 'http://127.0.0.1:5173/';

let edge = null;
// 直接启动 Edge(独立 user-data-dir,避免占用)
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const edgeExe = process.env.EDGE_EXE || '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
edge = spawn(edgeExe, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-features=HttpsUpgrades,HttpsFirstMode,AutomaticHttpsDefaultPorts',
  '--ignore-certificate-errors',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=/tmp/cdp-edge-profile',
  '--window-size=900,1400',
  'about:blank',
], { stdio: 'ignore' });

await sleep(2500);

// 获取调试目标
let targets;
for (let i = 0; i < 20; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json`);
    targets = await r.json();
    if (targets.length) break;
  } catch {}
  await sleep(300);
}
const page = targets?.find((t) => t.type === 'page');
if (!page) {
  console.error('no page target');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails?.exception?.description || 'exception');
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args?.map((a) => a.value ?? a.description).join(' '));
  }
};

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: URL });

async function evalJS(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result?.value;
}

// 等页面就绪(静态按钮出现即可;远程隧道可能慢)
let readyState = 'not-ready';
for (let i = 0; i < 60; i++) {
  const ready = await evalJS(`!!document.getElementById('btn-menu')`);
  if (ready) {
    readyState = 'ready';
    break;
  }
  await sleep(500);
}
if (readyState !== 'ready') {
  const diag = await evalJS(`({ url: document.URL, title: document.title, len: (document.body&&document.body.innerHTML||'').length })`);
  console.error('PAGE NOT READY:', JSON.stringify(diag));
  ws.close();
  edge.kill();
  process.exit(1);
}

// 等关卡数据加载完成(状态栏显示 "x/1000 关"),避免菜单只有样例关卡
for (let i = 0; i < 80; i++) {
  const s = await evalJS(`document.getElementById('status')?.textContent || ''`);
  if (s.includes('/1000')) break;
  await sleep(300);
}

// 1. 页面是否渲染了棋盘 + 关卡数
const boot = await evalJS(`({
  status: document.getElementById('status')?.textContent,
  canvas: !!document.getElementById('game')?.width && document.getElementById('game')?.width > 100,
})`);
console.log('BOOT:', JSON.stringify(boot));

// 2. 点选关按钮
await evalJS(`document.getElementById('btn-menu').click()`);
await sleep(600);
const menuOpen = await evalJS(`({
  hidden: document.getElementById('menu-modal').classList.contains('hidden'),
  count: document.querySelectorAll('#menu-grid button').length,
})`);
console.log('MENU:', JSON.stringify(menuOpen));

// 3. 点第 50 关
await evalJS(`[...document.querySelectorAll('#menu-grid button')].find(b=>b.textContent.trim()==='50').click()`);
await sleep(800);
const afterLoad = await evalJS(`({
  status: document.getElementById('status')?.textContent,
  menuHidden: document.getElementById('menu-modal').classList.contains('hidden'),
})`);
console.log('AFTER_SELECT_50:', JSON.stringify(afterLoad));

// 4. 彩蛋列表弹层
await evalJS(`document.getElementById('btn-eggs').click()`);
await sleep(400);
const eggOpen = await evalJS(`({
  hidden: document.getElementById('egg-list-modal').classList.contains('hidden'),
  count: document.querySelectorAll('#egg-list .egg-item').length,
})`);
console.log('EGGS:', JSON.stringify(eggOpen));

console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
ws.close();
edge.kill();
process.exit(0);
