// 陷阱关卡生成:陷阱模块数随难度递增(1→4),填充猪提供密度。
// 每关验证:模块钥匙可解 / 诱饵死锁 / 整盘构造式可解。
// 用法:npx tsx tools/gen-trap.ts --count 200 [--seed 20260813] [--out ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateTrapLevel } from '../src/core/trapgen.js';
import { encodeLevels } from '../src/core/format.js';
import { Level } from '../src/core/types.js';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

const args = parseArgs();
const count = Number(args.count ?? 200);
const baseSeed = Number(args.seed ?? 20260813);
const outPath = resolve(args.out ?? 'public/levels/levels.json');
const boardW = Number(args.board ?? 36);
const boardH = Number(args.board ?? 36);

// 难度曲线:每 50 关陷阱数 +1(1→4),填充猪数也递增
const levels: Level[] = [];
let i = 0;
while (levels.length < count) {
  // 难度按进度递增:陷阱 1→4,填充猪 60→150
  const progress = levels.length / count;
  const numMod = Math.min(4, 1 + Math.floor(progress * 4));
  const fillers = 80 + Math.floor(progress * 370);
  const seed = baseSeed + i * 1009;
  let lv: Level | null = null;
  for (let r = 0; r < 20 && !lv; r++) {
    lv = generateTrapLevel(seed + r * 7919, boardW, boardH, numMod, fillers);
  }
  if (lv) levels.push(lv);
  i++;
  if (i % 100 === 0) console.log(`  已生成 ${levels.length} 关 (陷阱${numMod} 填充${fillers})`);
}

levels.forEach((lv, i) => {
  lv.id = i + 1;
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodeLevels(levels), 'utf-8');
console.log(`陷阱关卡生成完成: ${levels.length} 关 → ${outPath} (${(Buffer.byteLength(encodeLevels(levels)) / 1024 / 1024).toFixed(1)}MB)`);
