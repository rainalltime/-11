const PORT = 9346;
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const edgeExe = '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const edge = spawn(edgeExe, ['--headless=new','--disable-gpu','--no-sandbox','--disable-features=HttpsUpgrades,HttpsFirstMode','--ignore-certificate-errors','--remote-debugging-port='+PORT,'--user-data-dir=/tmp/cdp-cookie','about:blank'], { stdio: 'ignore' });
await sleep(2500);
let targets;
for (let i=0;i<20;i++){ try{ const r=await fetch(`http://127.0.0.1:${PORT}/json`); targets=await r.json(); if(targets.length) break;}catch{} await sleep(300);}
const page = targets?.find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const pending=new Map();
function send(m,p={}){ return new Promise((res,rej)=>{ const mid=++id; pending.set(mid,{res,rej}); ws.send(JSON.stringify({id:mid,method:m,params:p})); }); }
ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){ const {res,rej}=pending.get(m.id); pending.delete(m.id); m.error?rej(new Error(m.error.message)):res(m.result);} };
await new Promise(r=>ws.onopen=r);
await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate',{url:'http://j7e6c366.natappfree.cc/'});
for(let i=0;i<100;i++){ const r=await send('Runtime.evaluate',{expression:"document.getElementById('status')?.textContent.includes('/1000')",returnByValue:true}); if(r.result.value)break; await sleep(400);}
const evl = async (expr) => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.value;
console.log('当前域名:', await evl('location.hostname'));
// 改动进度并保存(通过改 localStorage 后触发 saveProgress)
await evl(`(()=>{const p=JSON.parse(localStorage.getItem('pigrun_progress_v1')); p.lastLevel=99; localStorage.setItem('pigrun_progress_v1',JSON.stringify(p)); return true})()`);
// 触发一次 saveProgress(切一关)
await evl(`document.getElementById('btn-restart').click()`);
await sleep(800);
const cookie = await evl(`document.cookie`);
console.log('cookie 存在:', cookie.includes('pigrun_progress_v1'), '| cookie 长度:', cookie.length);
// 模拟换子域名:清掉本域 localStorage(但 cookie 属于 natappfree.cc,应还在)
await evl(`localStorage.removeItem('pigrun_progress_v1')`);
await sleep(300);
console.log('清掉 localStorage 后 cookie 仍在:', (await evl('document.cookie')).includes('pigrun_progress_v1'));
// 重新加载,应能从 cookie 恢复
await send('Page.reload');
for(let i=0;i<100;i++){ const r=await send('Runtime.evaluate',{expression:"document.getElementById('status')?.textContent.includes('/1000')",returnByValue:true}); if(r.result.value)break; await sleep(400);}
console.log('恢复后状态栏:', await evl(`document.getElementById('status').textContent`));
ws.close(); edge.kill(); process.exit(0);
