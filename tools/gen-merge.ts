// 合并并行生成的若干分片关卡 → 全局查重 + 按难度升序 → 写 levels.json。
// 用法: node tools/gen-merge.mjs --in /tmp/part_*.json --out public/levels/levels.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { decodeLevels, encodeLevels } from '../src/core/format.js';
import { dedupLevels, difficultyScore, Level } from '../src/core/generator.js';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

const args = parseArgs();
const inList = (args.in ?? '').split(',').filter(Boolean);
const outPath = resolve(args.out ?? 'public/levels/levels.json');

let all: Level[] = [];
for (const f of inList) {
  all = all.concat(decodeLevels(JSON.parse(readFileSync(resolve(f), 'utf-8'))));
}
console.log(`合并 ${inList.length} 个分片 → ${all.length} 关(含重复)`);

// 全局去重(精确 + Jaccard 窗口)
const deduped = dedupLevels(all, { maxJaccard: 1, window: 40 });
console.log(`去重后 ${deduped.length} 关`);

// 难度分预计算(只算一次,避免排序时反复 measureLevel 拖慢)
const score = new Map<Level, number>();
for (const lv of deduped) score.set(lv, difficultyScore(lv));

// 教学关(7x7 最小那关)永远放第 1 关
const tutorial = deduped
  .filter((lv) => lv.width * lv.height < 100)
  .sort((a, b) => score.get(a)! - score.get(b)!)[0];
const rest = deduped.filter((lv) => lv !== tutorial);
rest.sort((a, b) => score.get(a)! - score.get(b)!);

const finalLevels = [tutorial, ...rest].filter(Boolean);
finalLevels.forEach((lv, idx) => {
  lv.id = idx + 1;
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodeLevels(finalLevels), 'utf-8');
console.log(`写入 ${finalLevels.length} 关 → ${outPath} (${(Buffer.byteLength(encodeLevels(finalLevels)) / 1024 / 1024).toFixed(1)}MB)`);
