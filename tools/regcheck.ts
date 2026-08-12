import { readFileSync } from 'node:fs';
import { decodeLevels } from '../src/core/format.ts';
import { difficultyScore } from '../src/core/generator.ts';
const levels = decodeLevels(JSON.parse(readFileSync('public/levels/levels.json', 'utf-8')));
let last = -Infinity;
for (let i = 0; i < levels.length; i++) {
  const s = difficultyScore(levels[i]);
  if (s < last) console.log(`回退: 第${i + 1}关(关卡${levels[i].id}) score=${s.toFixed(2)} < 上一关 ${last.toFixed(2)}`);
  last = s;
}
console.log('检查完毕');
