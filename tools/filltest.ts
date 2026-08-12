import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
// 测不同 lineCount 的填充率
for (const lc of [6, 8, 10, 12]) {
  let total = 0, ok = 0;
  for (let i = 1; i <= 10; i++) {
    const lv = generateCascadeLevel({ seed: 20300000 + i * 1009, width: 24, height: 32, pigs: 88, obstacles: 3, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14, _lineCount: lc });
    total += lv.pigs.length;
    if (measureLevel(lv).solvable) ok++;
  }
  console.log(`lineCount ${lc}: 平均猪 ${(total/10).toFixed(0)}/88, 可解 ${ok}/10`);
}
