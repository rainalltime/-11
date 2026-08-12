// 测试 generateCascadeLevel:可解率 + 难度指标
import { circleCellCount, difficultyScore, generateCascadeLevel, longestDependencyChain, measureLevel } from '../src/core/generator.ts';

const n = Number(process.argv[2] ?? 50);
const boardW = 24;
const boardH = 32;
const circleRadius = 14;
const circleCells = circleCellCount(boardW, boardH, circleRadius);

let ok = 0;
let unsolvable = 0;
let fail = 0;
let short = 0; // 猪数远少于目标
const avgs: number[] = [];
const mins: number[] = [];
const chains: number[] = [];
const pigCounts: number[] = [];
const targets: number[] = [];

for (let i = 1; i <= n; i++) {
  const tier = (i - 1) / n;
  const targetPigs = Math.round((0.45 + tier * 0.25) * (circleCells / 2));
  const base = {
    seed: 20280000 + i * 1009,
    width: boardW,
    height: boardH,
    pigs: targetPigs,
    obstacles: Number(process.argv[3] ?? 0),
    chainBias: 0.5,
    centerRatio: 0.8,
    circleRadius,
  };
  let lv;
  try {
    lv = generateCascadeLevel(base);
  } catch {
    fail++;
    continue;
  }
  const m = measureLevel(lv);
  ok++;
  avgs.push(m.avgClear);
  mins.push(m.minClear);
  chains.push(longestDependencyChain(lv));
  pigCounts.push(lv.pigs.length);
  targets.push(targetPigs);
  if (!m.solvable) unsolvable++;
  if (lv.pigs.length < targetPigs * 0.8) short++;
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
console.log(
  `可解 ${ok} 不可解 ${unsolvable} 异常 ${fail} 猪数不足 ${short} | ` +
    `目标猪均 ${avg(targets).toFixed(0)} 实得 ${avg(pigCounts).toFixed(0)} | ` +
    `均可点均 ${avg(avgs).toFixed(1)} 最小可点均 ${avg(mins).toFixed(1)} 链长均 ${avg(chains).toFixed(1)}`,
);
