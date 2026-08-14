// 多重陷阱串联关卡生成:经典四车环垂直堆叠成链,链长随难度递增。
// 每环钥匙向下退出、被下一环挡住 → 必须从最下环逐环解,任何环先动诱饵即死锁。
// 用法:npx tsx tools/gen-trap.ts --count 1000 [--seed 20260814] [--out ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateChainedLevel } from '../src/core/trapgen.js';
import { encodeLevels } from '../src/core/format.js';
import { Level } from '../src/core/types.js';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

const args = parseArgs();
const count = Number(args.count ?? 1000);
const baseSeed = Number(args.seed ?? 20260814);
const outPath = resolve(args.out ?? 'public/levels/levels.json');
const fillers = Number(args.fill ?? 0);

const levels: Level[] = [];
let i = 0;
while (levels.length < count) {
  const progress = levels.length / count;
  // 链长 6 → 16:前 10% 入门(6-7环),最后 10% 极难(15-16环)
  const chainLen = Math.min(16, 6 + Math.floor(progress * 11) + (Math.random() < 0.5 ? 0 : 1));
  const seed = baseSeed + i * 1009;
  let lv: Level | null = null;
  for (let r = 0; r < 30 && !lv; r++) {
    lv = generateChainedLevel(seed + r * 7919, chainLen, 4, fillers);
  }
  if (lv) {
    levels.push(lv);
  } else {
    // 该链长放不下就退一环
    lv = generateChainedLevel(seed, Math.max(4, chainLen - 2), 4, fillers);
    if (lv) levels.push(lv);
  }
  i++;
  if (i % 100 === 0) console.log(`  已生成 ${levels.length} 关 (链长${chainLen})`);
}

levels.forEach((lv, idx) => {
  lv.id = idx + 1;
});
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodeLevels(levels), 'utf-8');
console.log(`多重陷阱串联关卡生成完成: ${levels.length} 关 → ${outPath} (${(Buffer.byteLength(encodeLevels(levels)) / 1024 / 1024).toFixed(2)}MB)`);
