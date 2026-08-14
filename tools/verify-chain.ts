import { decodeLevels } from '../src/core/format.ts';
import { GameState } from '../src/core/logic.ts';
import { readFileSync } from 'node:fs';
const levels = decodeLevels(JSON.parse(readFileSync('public/levels/levels.json', 'utf-8')));
console.log('总关数:', levels.length);
let unsolvable = 0, total = 0;
for (let i = 0; i < levels.length; i += 25) {
  total++;
  if (!GameState.solveSliding(levels[i], 200000).solvable) unsolvable++;
}
console.log(`抽样滑动可解: ${total-unsolvable}/${total}`);
const pigs = levels.map(l=>l.pigs.length).sort((a,b)=>a-b);
console.log('猪数: min', pigs[0], '中位', pigs[Math.floor(pigs.length/2)], 'max', pigs[pigs.length-1]);
console.log('棋盘尺寸范围:', [...new Set(levels.map(l=>`${l.width}x${l.height}`))].slice(0,5).join(' '));
console.log('前5关猪数(应为 4*链长):', levels.slice(0,5).map(l=>l.pigs.length).join(','));
console.log('最后3关猪数:', levels.slice(-3).map(l=>l.pigs.length).join(','));
