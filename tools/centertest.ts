import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
import { DIR_VEC } from '../src/core/types.ts';
// 统计猪离圆心的平均距离,对比圆心半径14
let distSum = 0, n = 0, solvable = 0;
for (let i = 1; i <= 20; i++) {
  const lv = generateCascadeLevel({ seed: 20350000 + i * 7919, width: 24, height: 32, pigs: 0, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  if (measureLevel(lv).solvable) solvable++;
  // 圆心(cu=-4,cv=27) → (cx,cy)
  for (const p of lv.pigs) {
    const d = DIR_VEC[p.dir];
    for (const [hx, hy] of [[p.pos.x, p.pos.y], [p.pos.x - d.x, p.pos.y - d.y]]) {
      // u=x-y, v=x+y; 圆心 u=-4,v=27
      const du = (hx - hy) - (-4), dv = (hx + hy) - 27;
      distSum += Math.hypot(du, dv);
      n++;
    }
  }
}
console.log(`可解 ${solvable}/20 | 平均猪到圆心距离 ${(distSum / n).toFixed(1)} (圆半径14,均匀=~9.3)`);
