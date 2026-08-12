import { generateCascadeLevel } from '../src/core/generator.ts';
import { DIR_VEC } from '../src/core/types.ts';

const lv = generateCascadeLevel({ seed: 20280001, width: 24, height: 32, pigs: 88, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
const names = ['U', 'R', 'D', 'L'];
const counts = [0, 0, 0, 0];
const patDir = (x, y) => {
  if ((x + y) % 2 === 0) return y % 2 === 0 ? 1 : 2; // R / D
  return x % 2 === 0 ? 3 : 0; // L / U
};
let adhere = 0;
for (const p of lv.pigs) {
  counts[p.dir]++;
  if (p.dir === patDir(p.pos.x, p.pos.y)) adhere++;
}
console.log('方向 U/R/D/L:', counts.join('/'), '总数', lv.pigs.length, '| 模式贴合率', (adhere / lv.pigs.length * 100).toFixed(0) + '%');

// 打印方向图
const grid: string[][] = Array.from({ length: 32 }, () => Array(24).fill('·'));
for (const p of lv.pigs) {
  grid[p.pos.y][p.pos.x] = names[p.dir];
  const d = DIR_VEC[p.dir];
  grid[p.pos.y - d.y][p.pos.x - d.x] = '*';
}
console.log(grid.map((r) => r.join(' ')).join('\n'));
