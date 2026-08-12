const PORT = 9345;
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const edgeExe = '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const edge = spawn(edgeExe, ['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-port='+PORT,'--user-data-dir=/tmp/cdp-prog','about:blank'], { stdio: 'ignore' });
await sleep(2500);
let targets;
for (let i=0;i<20;i++){ try{ const r=await fetch(`http://127.0.0.1:${PORT}/json`); targets=await r.json(); if(targets.length) break;}catch{} await sleep(300);}
const page = targets?.find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const pending=new Map(); const errors=[];
function send(m,p={}){ return new Promise((res,rej)=>{ const mid=++id; pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(m.error.message)):res(m.result);} else if(m.method==='Runtime.exceptionThrown'){ errors.push(m.params.exceptionDetails?.exception?.description||'ex'); } };
await new Promise(r=>ws.onopen=r);
await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
for(let i=0;i<80;i++){ const r=await send('Runtime.evaluate',{expression:"document.getElementById('status')?.textContent.includes('/1000')",returnByValue:true}); if(r.result.value)break; await sleep(300);}
const evl = async (expr) => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.value;
// 玩到某关(直接改进度存起来)
await evl(`(()=>{const p=JSON.parse(localStorage.getItem('pigrun_progress_v1')); p.lastLevel=42; p.stars['42']=3; p.total3Stars=1; localStorage.setItem('pigrun_progress_v1',JSON.stringify(p)); return true})()`);
// 打开进度弹窗 → 导出
await evl(`document.getElementById('btn-progress').click()`);
await sleep(300);
await evl(`document.getElementById('progress-export').click()`);
await sleep(200);
const code = await evl(`document.getElementById('progress-code').value`);
console.log('导出的进度码长度:', code ? code.length : 0, '| 含 lastLevel:', code ? code.includes('42') : false);
// 清空 localStorage(模拟换域名)后导入
await evl(`localStorage.removeItem('pigrun_progress_v1')`);
await evl(`document.getElementById('progress-code').value = ${JSON.stringify(code)}`);
await evl(`document.getElementById('progress-import').click()`);
await sleep(500);
const restored = await evl(`(()=>{const p=JSON.parse(localStorage.getItem('pigrun_progress_v1')); return {lastLevel:p.lastLevel, star42:p.stars['42'], eggs:p.total3Stars};})()`);
console.log('导入恢复:', JSON.stringify(restored));
console.log('状态栏:', await evl(`document.getElementById('status').textContent`));
console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
ws.close(); edge.kill(); process.exit(0);
