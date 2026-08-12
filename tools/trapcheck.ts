import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
import { DIR_VEC } from '../src/core/types.ts';
const lv = generateCascadeLevel({ seed: 20310001, width: 24, height: 32, pigs: 40, obstacles: 6, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
const names = ['U', 'R', 'D', 'L'];
const grid: string[][] = Array.from({ length: 32 }, () => Array(24).fill('·'));
for (const o of lv.obstacles) grid[o.pos.y][o.pos.x] = '█';
for (const p of lv.pigs) { const d = DIR_VEC[p.dir]; grid[p.pos.y][p.pos.x] = names[p.dir]; grid[p.pos.y - d.y][p.pos.x - d.x] = '*'; }
console.log(`猪 ${lv.pigs.length} 可解 ${measureLevel(lv).solvable}`);
// 数陷阱模式:[R][空][D][空][L] 在同一行
const dirAt = new Map<string, number>();
for (const p of lv.pigs) dirAt.set(`${p.pos.x},${p.pos.y}`, p.dir);
let trapCount = 0;
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 22; x++) {
    const a = dirAt.get(`${x},${y}`);
    if (a !== 1) continue;
    const m = dirAt.get(`${x + 2},${y}`);
    if (m !== 2) continue;
    const b = dirAt.get(`${x + 4},${y}`);
    if (b === 3) trapCount++;
  }
}
console.log('陷阱模式 [→][X↓][←] 数量:', trapCount);
console.log(grid.map(r => r.join(' ')).join('\n'));
