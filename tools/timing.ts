import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
for (const r of [14, 18, 23]) {
  const t0 = Date.now();
  let pigs = 0, n = 3;
  for (let i = 1; i <= n; i++) {
    const lv = generateCascadeLevel({ seed: 20440000 + r * 100 + i, width: 36, height: 36, pigs: 0, obstacles: 0, chainBias: 0.5, centerRatio: 0.72, circleRadius: r });
    pigs += lv.pigs.length;
    measureLevel(lv);
  }
  console.log(`半径${r}: 生成+求解均 ${((Date.now()-t0)/n/1000).toFixed(2)}s, 猪均 ${(pigs/n).toFixed(0)}`);
}
