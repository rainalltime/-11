import { generateCascadeLevel, measureLevel, longestDependencyChain } from '../src/core/generator.ts';
let solvable = 0, total = 0, pigs = 0, chains = 0, avgs = 0;
const t0 = Date.now();
for (let i = 1; i <= 20; i++) {
  const lv = generateCascadeLevel({ seed: 20330000 + i * 7919, width: 24, height: 32, pigs: 88, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  total++;
  const m = measureLevel(lv);
  pigs += lv.pigs.length;
  if (m.solvable) { solvable++; chains += longestDependencyChain(lv); avgs += m.avgClear; }
}
console.log(`可解 ${solvable}/${total} | 平均猪 ${(pigs/total).toFixed(0)} | 可解者 链均 ${(chains/Math.max(1,solvable)).toFixed(1)} 可点均 ${(avgs/Math.max(1,solvable)).toFixed(1)} | 耗时 ${Date.now()-t0}ms`);
