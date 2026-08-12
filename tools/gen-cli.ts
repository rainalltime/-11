// 批量生成固定关卡(1×2长猪,Rush/挪车风格骨架混合):
// 全局生成候选(多半径 × 多骨架) → 查重 → 按难度分升序排序(难度单调递增) → 截取 target。
// 用法:npm run gen -- --count 1000 [--seed 20260806] [--out ...] [--pattern pinwheel] [--jaccard 1] [--window 40]
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
import { generateRushLevel, Skeleton } from '../src/core/rusher.js';
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

/** Rush 骨架生成 + 重试(逆向构造天生必解,无需 measureLevel 校验)。 */
function genRushWithRetry(index: number, base: GenConfig, skeleton: Skeleton): Level {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return generateRushLevel({ ...base, seed: base.seed + attempt * 7919, skeleton });
    } catch {
      /* 重试 */
    }
  }
  throw new Error(`Rush 生成失败(seed=${base.seed}, skeleton=${skeleton})`);
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
const radiusMin = Number(args.radius ?? 14);
const radiusMax = Number(args.radiusMax ?? 23);
const candPer = Number(args.candPer ?? 26); // 每个(半径×骨架)组合的候选数
// 混合生成源:0=cascade(pinwheel) 1..3=Rush 骨架
const GEN_SOURCES: (Skeleton | 'cascade')[] = ['cascade', 'rings', 'spiral', 'lanes'];

// 教学关(旧构造器,7x7 三猪,最简单)
const tutorial: Level = genWithRetry(0, {
  seed: baseSeed,
  width: 7,
  height: 7,
  pigs: 3,
  obstacles: 0,
  chainBias: 0,
}, true);

// 按骨架分别生成候选池:所有半径 × 该骨架
console.log(`生成候选: 半径 ${radiusMin}~${radiusMax} × ${GEN_SOURCES.length} 骨架 × ${candPer} 个/组合 ...`);
const pools: Map<string, Level[]> = new Map();
GEN_SOURCES.forEach((src) => pools.set(src, []));
for (let radius = radiusMin; radius <= radiusMax; radius++) {
  for (let s = 0; s < GEN_SOURCES.length; s++) {
    const src = GEN_SOURCES[s];
    for (let i = 0; i < candPer; i++) {
      const seed = baseSeed + radius * 100000 + s * 10000 + i * 1009;
      try {
        const base: GenConfig = {
          seed,
          width: boardW,
          height: boardH,
          pigs: 0,
          obstacles: 0,
          chainBias: 0.5,
          centerRatio: 0.72,
          circleRadius: radius,
          pattern,
        };
        const lv = src === 'cascade' ? genWithRetry(i, base) : genRushWithRetry(i, base, src);
        pools.get(src)!.push(lv);
      } catch {
        /* 该候选失败则跳过 */
      }
    }
  }
  console.log(`  半径${radius}: 完成 池内 ${GEN_SOURCES.map((g) => `${g}=${pools.get(g)!.length}`).join(' ')}`);
}

// 每个骨架:查重 → 难度分升序排序
const sortedPools = GEN_SOURCES.map((src) => {
  const pool = pools.get(src)!;
  const deduped = dedupLevels(pool, { maxJaccard, window: windowSize });
  const scored = deduped
    .map((lv) => ({ level: lv, score: difficultyScore(lv) }))
    .filter((p) => Number.isFinite(p.score));
  scored.sort((a, b) => a.score - b.score);
  console.log(`${src}: 候选 ${pool.length} → 去重 ${deduped.length} → 可解 ${scored.length} (难度 ${scored.length ? scored[0].score.toFixed(0) : '-'}~${scored.length ? scored[scored.length - 1].score.toFixed(0) : '-'})`);
  return scored.map((p) => p.level);
});

// 组装:按难度分桶(桶宽 bucketW),桶内 4 骨架轮换;按桶拼接 → 难度平滑上升 + 形状多样
const allScored: { level: Level; score: number; skeleton: number }[] = [];
sortedPools.forEach((pool, s) => {
  pool.forEach((level) => allScored.push({ level, score: difficultyScore(level), skeleton: s }));
});
allScored.sort((a, b) => a.score - b.score);
const bucketW = Number(args.bucket ?? 60);
const buckets = new Map<number, { level: Level; skeleton: number }[]>();
for (const item of allScored) {
  const b = Math.floor(item.score / bucketW);
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b)!.push({ level: item.level, skeleton: item.skeleton });
}
const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
const levels: Level[] = [tutorial];
outer: for (const bk of bucketKeys) {
  const items = buckets.get(bk)!;
  const bySkel = new Map<number, { level: Level; skeleton: number }[]>();
  for (const it of items) {
    if (!bySkel.has(it.skeleton)) bySkel.set(it.skeleton, []);
    bySkel.get(it.skeleton)!.push(it);
  }
  const cursors = new Map<number, number>();
  const maxLen = Math.max(...[...bySkel.values()].map((a) => a.length));
  for (let i = 0; i < maxLen; i++) {
    for (const sk of [...bySkel.keys()].sort()) {
      const arr = bySkel.get(sk)!;
      const c = cursors.get(sk) ?? 0;
      if (c < arr.length) {
        levels.push(arr[c].level);
        cursors.set(sk, c + 1);
        if (levels.length >= count) break outer;
      }
    }
  }
}
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
  `36x36 棋盘 | 半径 ${radiusMin}~${radiusMax} | 共 ${finalLevels.length} 关 → ${outPath} ` +
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
