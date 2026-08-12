import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
import { DIR_VEC } from '../src/core/types.ts';
let solvable = 0;
const rings = [0, 0, 0]; // 中心<7, 中环7-11, 边缘11-14
for (let i = 1; i <= 20; i++) {
  const lv = generateCascadeLevel({ seed: 20360000 + i * 7919, width: 24, height: 32, pigs: 0, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  if (measureLevel(lv).solvable) solvable++;
  for (const p of lv.pigs) {
    const d = DIR_VEC[p.dir];
    const du = (p.pos.x - p.pos.y) - (-4), dv = (p.pos.x + p.pos.y) - 27;
    const r = Math.hypot(du, dv);
    if (r < 7) rings[0]++;
    else if (r < 11) rings[1]++;
    else rings[2]++;
  }
}
const total = rings[0] + rings[1] + rings[2];
console.log(`可解 ${solvable}/20 | 中心(<7): ${(rings[0]/total*100).toFixed(0)}% 中环(7-11): ${(rings[1]/total*100).toFixed(0)}% 边缘(11-14): ${(rings[2]/total*100).toFixed(0)}%`);
