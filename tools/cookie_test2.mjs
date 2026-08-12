const PORT = 9347;
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const edgeExe = '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const edge = spawn(edgeExe, ['--headless=new','--disable-gpu','--no-sandbox','--disable-features=HttpsUpgrades,HttpsFirstMode','--ignore-certificate-errors','--remote-debugging-port='+PORT,'--user-data-dir=/tmp/cdp-cookie2','about:blank'], { stdio: 'ignore' });
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
// 选第 30 关(设置 levelIndex 并保存 lastLevel=30)
await evl(`document.getElementById('btn-menu').click()`);
await sleep(500);
await evl(`[...document.querySelectorAll('#menu-grid button')].find(b=>b.textContent.trim()==='30').click()`);
await sleep(800);
console.log('选中后状态:', await evl(`document.getElementById('status').textContent`));
const cookie = await evl(`document.cookie`);
console.log('cookie 含 lastLevel 30:', cookie.includes('lastLevel%22%3A30') || cookie.includes('"lastLevel":30'));
// 清 localStorage → cookie 应保留
await evl(`localStorage.removeItem('pigrun_progress_v1')`);
await sleep(300);
console.log('清 localStorage 后 cookie 还在:', (await evl('document.cookie')).includes('pigrun_progress_v1'));
// 刷新 → 应从 cookie 恢复第 30 关
await send('Page.reload');
for(let i=0;i<100;i++){ const r=await send('Runtime.evaluate',{expression:"document.getElementById('status')?.textContent.includes('/1000')",returnByValue:true}); if(r.result.value)break; await sleep(400);}
console.log('刷新恢复后:', await evl(`document.getElementById('status').textContent`));
ws.close(); edge.kill(); process.exit(0);
