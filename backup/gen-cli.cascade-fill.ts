// 批量生成固定关卡(cascade 风格 + 密度加密)。
// cascade 让猪的射线"穿过猪群"互相纠缠(用户认可的难点来源);
// densify 往密洞插猪、拉长依赖链(插入方向选"让最长链最长"的)。
// 按半径分档(半径递增 → 猪更多、穿过更多、更难) → 查重 → 档内按难度升序 → 拼接。
// 用法:npm run gen -- --count 1000 [--seed 20260806] [--out ...] [--radiusMin 15] [--radiusMax 26] [--fill 10]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  dedupLevels,
  difficultyScore,
  generateCascadeLevel,
  generateLevel,
  measureLevel,
  fillHoles,
  GenConfig,
  DirPattern,
} from '../src/core/generator.js';
import { encodeLevels } from '../src/core/format.js';
import { Level } from '../src/core/types.js';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

function genCascadeDensified(index: number, base: GenConfig, maxFill: number): Level {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const lv = generateCascadeLevel({ ...base, seed: base.seed + attempt * 7919 });
      if (!measureLevel(lv).solvable) continue;
      return fillHoles(lv, maxFill);
    } catch {
      /* 重试 */
    }
  }
  throw new Error(`第 ${index} 关生成失败(seed=${base.seed})`);
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const args = parseArgs();
const count = Number(args.count ?? 1000);
const baseSeed = Number(args.seed ?? 20260806);
const outPath = resolve(args.out ?? 'public/levels/levels.json');
const radiusMin = Number(args.radiusMin ?? 16);
const radiusMax = Number(args.radiusMax ?? 28);
const maxFill = Number(args.fill ?? 40);
const pattern = (args.pattern ?? 'pinwheel') as DirPattern;
const maxJaccard = Number(args.jaccard ?? 1);
const windowSize = Number(args.window ?? 40);
const boardW = 36;
const boardH = 36;
const bands = radiusMax - radiusMin + 1;
const perBand = Math.ceil((count - 1) / bands);

// 教学关(7x7 三猪,最简单)
const tutorial: Level = (() => {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const lv = generateLevel({ seed: baseSeed + attempt * 7919, width: 7, height: 7, pigs: 3, obstacles: 0, chainBias: 0 });
      if (measureLevel(lv).solvable) return lv;
    } catch {
      /* 重试 */
    }
  }
  throw new Error('教学关生成失败');
})();

const bandLevels: Level[][] = [];
for (let b = 0; b < bands; b++) {
  const radius = radiusMin + b;
  const need = b === 0 ? perBand - 1 : perBand;
  const candCount = Math.max(40, need * 2);
  const cands: Level[] = [];
  for (let i = 0; i < candCount; i++) {
    const seed = baseSeed + b * 1000000 + i * 1009;
    try {
      cands.push(
        genCascadeDensified(i, {
          seed,
          width: boardW,
          height: boardH,
          pigs: 0,
          obstacles: 0,
          chainBias: 0.5,
          centerRatio: 0.72,
          circleRadius: radius,
          pattern,
        }, maxFill),
      );
    } catch {
      /* 跳过失败候选 */
    }
  }
  const deduped = dedupLevels(cands, { maxJaccard, window: windowSize });
  const scored = deduped
    .map((lv) => ({ level: lv, score: difficultyScore(lv) }))
    .filter((p) => Number.isFinite(p.score));
  scored.sort((a, b) => a.score - b.score);
  const chosen = scored.slice(0, need).map((p) => p.level);
  bandLevels.push(chosen);
  console.log(`  档${b} 半径${radius}: 生成${candCount} → 去重${deduped.length} → 取${chosen.length} 猪均${chosen.length ? Math.round(chosen.reduce((s, p) => s + p.pigs.length, 0) / chosen.length) : 0}`);
}

const levels: Level[] = [tutorial];
for (const band of bandLevels) levels.push(...band);
const finalLevels = levels.slice(0, count);
finalLevels.forEach((lv, idx) => {
  lv.id = idx + 1;
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodeLevels(finalLevels), 'utf-8');

const chosen = finalLevels.slice(1).map((lv) => ({ level: lv, score: difficultyScore(lv) }));
const scores = chosen.map((c) => c.score);
console.log(
  `36x36 棋盘 | 半径 ${radiusMin}~${radiusMax}(cascade+填充${maxFill}) | 共 ${finalLevels.length} 关 → ${outPath} ` +
    `(${(Buffer.byteLength(encodeLevels(finalLevels)) / 1024 / 1024).toFixed(1)}MB)`,
);
console.log(`第1关: 教学(7x7,3猪) | 其余难度分 ${Math.min(...scores).toFixed(1)} ~ ${Math.max(...scores).toFixed(1)} (中位 ${median(scores).toFixed(1)})`);
for (let d = 0; d < 10; d++) {
  const idx = Math.floor((chosen.length * (d + 0.5)) / 10);
  const g = chosen[idx];
  const m = measureLevel(g.level);
  console.log(
    `  ~${(d + 1) * 10}%处: 难度${g.score.toFixed(0)} 猪${g.level.pigs.length} ` +
      `均可点${m.avgClear.toFixed(1)} 最小可点${m.minClear} 链${m.chainLength} 障${g.level.obstacles.length}`,
  );
}
