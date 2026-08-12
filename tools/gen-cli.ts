// 批量生成固定关卡(24x32 / 圆心14 / 1×2长猪):生成 surplus → 按难度分升序排序(单调递增)
// → 查重(精确 + 近重复)→ 截取 target。输出紧凑格式 JSON。
// 用法:npm run gen -- --count 1000 [--seed 20260806] [--out ...] [--pattern pinwheel] [--jaccard 0.55] [--window 40]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  dedupLevels,
  difficultyScore,
  generateCascadeLevel,
  generateLevel,
  measureLevel,
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

function genWithRetry(index: number, base: GenConfig, useTutorial = false): Level {
  let obstacles = base.obstacles;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const cfg: GenConfig = { ...base, obstacles, seed: base.seed + attempt * 7919 };
      // 教学关用旧构造器(朝外、必简单);其余用行列线生成器
      const level = useTutorial ? generateLevel(cfg) : generateCascadeLevel(cfg);
      if (measureLevel(level).solvable) return level;
    } catch {
      if (obstacles > 0) obstacles--;
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
const baseRadius = Number(args.radius ?? 14);
const pattern = (args.pattern ?? 'pinwheel') as DirPattern;
const maxJaccard = Number(args.jaccard ?? 1); // 只有完全相同才算雷同
const windowSize = Number(args.window ?? 40);
const boardW = 36; // 正方形棋盘
const boardH = 36;
const bands = 10; // 每 100 关圆心半径 +1,共 10 档
const perBand = Math.ceil((count - 1) / bands);

// 教学关(旧构造器,7x7 三猪,最简单)
const tutorial: Level = genWithRetry(0, {
  seed: baseSeed,
  width: 7,
  height: 7,
  pigs: 3,
  obstacles: 0,
  chainBias: 0,
}, true);

// 每档:半径 = baseRadius + 档号;生成 10 倍候选 → 保留猪最多 → 只删完全相同 → 按难度升序
const bandLevels: Level[][] = [];
for (let b = 0; b < bands; b++) {
  const radius = baseRadius + b;
  const need = b === 0 ? perBand - 1 : perBand; // 第 1 档让 1 个位置给教学关
  const candCount = Math.max(60, need * 2);
  const cands: Level[] = [];
  for (let i = 0; i < candCount; i++) {
    const seed = baseSeed + b * 1000000 + i * 1009;
    cands.push(genWithRetry(i, {
      seed,
      width: boardW,
      height: boardH,
      pigs: 0,
      obstacles: 0,
      chainBias: 0.5,
      centerRatio: 0.72,
      circleRadius: radius,
      pattern,
    }));
  }
  cands.sort((a, b2) => b2.pigs.length - a.pigs.length);
  const deduped = dedupLevels(cands, { maxJaccard, window: windowSize });
  const picked = deduped.slice(0, need).map((lv) => ({ level: lv, score: difficultyScore(lv) }));
  picked.sort((a, b2) => a.score - b2.score);
  bandLevels.push(picked.map((p) => p.level));
  console.log(`  档${b} 半径${radius}: 生成${candCount} → 去重${deduped.length} → 取${picked.length} 猪均${Math.round(picked.reduce((s, p) => s + p.level.pigs.length, 0) / Math.max(1, picked.length))}`);
}

// 组装:教学关 + 各档(半径递增 → 难度递增)
const levels: Level[] = [tutorial];
for (const band of bandLevels) levels.push(...band);
const finalLevels = levels.slice(0, count);
finalLevels.forEach((lv, idx) => {
  lv.id = idx + 1;
});
const chosen = finalLevels.slice(1).map((lv) => ({ level: lv, score: difficultyScore(lv) }));

// 5) 写紧凑格式
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodeLevels(finalLevels), 'utf-8');

// 6) 统计
const scores = chosen.map((c) => c.score);
console.log(
  `36x36 棋盘 | 半径 ${baseRadius}~${baseRadius + bands - 1}(每100关+1) | 共 ${finalLevels.length} 关 → ${outPath} ` +
    `(${(Buffer.byteLength(encodeLevels(finalLevels)) / 1024 / 1024).toFixed(1)}MB)`,
);
console.log(`  查重参数: 精确重复跳过 + 滑动窗口${windowSize} Jaccard>${maxJaccard} 视为雷同`);
console.log(`  朝向模式: ${pattern}`);
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
