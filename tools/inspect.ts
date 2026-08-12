// 把关卡渲染成 ASCII 供人工检查布局质量。
// 用法:npm run inspect -- --from 1 --to 5
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIR_VEC } from '../src/core/types.js';
import { measureLevel } from '../src/core/generator.js';
import { decodeLevels } from '../src/core/format.js';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

const args = parseArgs();
const from = Number(args.from ?? 1);
const to = Number(args.to ?? 5);
const file = resolve(args.file ?? 'public/levels/levels.json');
const levels = decodeLevels(JSON.parse(readFileSync(file, 'utf-8')));

const arrows = DIR_VEC.map((v) => (v.x === 1 ? (v.y === -1 ? '↗' : '↘') : v.y === -1 ? '↖' : '↙'));

for (const id of [from, ...(to > from ? [to] : [])].map((x) => Math.min(x, levels.length))) {
  const lv = levels[id - 1];
  if (!lv) continue;
  const grid: string[][] = Array.from({ length: lv.height }, () => Array(lv.width).fill('·'));
  for (const ob of lv.obstacles) grid[ob.pos.y][ob.pos.x] = '█';
  for (const p of lv.pigs) grid[p.pos.y][p.pos.x] = arrows[p.dir];
  const m = measureLevel(lv);
  console.log(`── 第 ${lv.id} 关 [${lv.width}x${lv.height}] 猪${lv.pigs.length} 障${lv.obstacles.length} ` +
    `| 最小可点${m.minClear} 均可点${m.avgClear.toFixed(2)} 链长${m.chainLength} | 顺序[${m.order.join(',')}]`);
  console.log('   ' + grid.map((row) => row.join(' ')).join('\n   '));
  console.log();
}
