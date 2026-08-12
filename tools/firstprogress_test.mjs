const PORT = 9348;
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const edgeExe = '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const edge = spawn(edgeExe, ['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-port='+PORT,'--user-data-dir=/tmp/cdp-first','about:blank'], { stdio: 'ignore' });
await sleep(2500);
let targets;
for (let i=0;i<20;i++){ try{ const r=await fetch(`http://127.0.0.1:${PORT}/json`); targets=await r.json(); if(targets.length) break;}catch{} await sleep(300);}
const page = targets?.find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const pending=new Map();
function send(m,p={}){ return new Promise((res,rej)=>{ const mid=++id; pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(m.error.message)):res(m.result);} };
await new Promise(r=>ws.onopen=r);
await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
for(let i=0;i<80;i++){ const r=await send('Runtime.evaluate',{expression:"document.getElementById('status')?.textContent.includes('/1000')",returnByValue:true}); if(r.result.value)break; await sleep(300);}
const evl = async (expr) => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.value;
console.log('状态栏(应第7关):', await evl(`document.getElementById('status').textContent`));
console.log('progress:', await evl(`(()=>{const p=JSON.parse(localStorage.getItem('pigrun_progress_v1')); return JSON.stringify({lastLevel:p.lastLevel, stars:{s1:p.stars['1'],s6:p.stars['6'],s7:p.stars['7']}, total3:p.total3Stars, eggs:p.eggs});})()`));
// 开彩蛋收集页
await evl(`document.getElementById('btn-eggs').click()`);
await sleep(400);
console.log('彩蛋1已解锁:', await evl(`document.querySelectorAll('#egg-list .egg-item')[0]?.classList.contains('locked') === false`));
ws.close(); edge.kill(); process.exit(0);
