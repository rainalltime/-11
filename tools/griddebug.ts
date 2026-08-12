import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
import { DIR_VEC } from '../src/core/types.ts';
const lv = generateCascadeLevel({ seed: 20300001, width: 24, height: 32, pigs: 88, obstacles: 3, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
const names = ['U', 'R', 'D', 'L'];
const grid: string[][] = Array.from({ length: 32 }, () => Array(24).fill('·'));
for (const o of lv.obstacles) grid[o.pos.y][o.pos.x] = '█';
for (const p of lv.pigs) { const d = DIR_VEC[p.dir]; grid[p.pos.y][p.pos.x] = names[p.dir]; grid[p.pos.y - d.y][p.pos.x - d.x] = '*'; }
console.log(`猪 ${lv.pigs.length}/88 可解 ${measureLevel(lv).solvable}`);
console.log(grid.map(r => r.join(' ')).join('\n'));
