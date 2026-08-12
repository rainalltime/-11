// 全量验证 levels.json:全部可解 + 难度单调递增
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeLevels } from '../src/core/format.ts';
import { difficultyScore, measureLevel } from '../src/core/generator.ts';

const file = resolve(process.argv[2] ?? 'public/levels/levels.json');
const levels = decodeLevels(JSON.parse(readFileSync(file, 'utf-8')));

let bad = 0;
let lastScore = -Infinity;
let nonMonotonic = 0;
for (let i = 0; i < levels.length; i++) {
  const lv = levels[i];
  const m = measureLevel(lv);
  if (!m.solvable) {
    bad++;
    console.log(`第 ${lv.id} 关不可解!`);
  }
  const score = difficultyScore(lv);
  if (score < lastScore) nonMonotonic++;
  lastScore = score;
}
console.log(`共 ${levels.length} 关 | 不可解 ${bad} | 难度回退 ${nonMonotonic} 处`);
