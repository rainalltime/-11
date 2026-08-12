import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
let solvable = 0, pigs = 0;
const gapHist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '>4': 0 };
for (let i = 1; i <= 20; i++) {
  const lv = generateCascadeLevel({ seed: 20420000 + i * 7919, width: 24, height: 32, pigs: 0, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  if (measureLevel(lv).solvable) solvable++;
  pigs += lv.pigs.length;
  for (let a = 0; a < lv.pigs.length; a++) for (let b = a + 1; b < lv.pigs.length; b++) {
    const pa = lv.pigs[a], pb = lv.pigs[b];
    if (pa.dir !== pb.dir) continue;
    const sameLine = (pa.dir === 1 || pa.dir === 3) ? (pa.pos.y === pb.pos.y) : (pa.pos.x === pb.pos.x);
    if (!sameLine) continue;
    const dist = Math.abs(pa.pos.x - pb.pos.x) + Math.abs(pa.pos.y - pb.pos.y);
    const gap = dist - 2;
    const key = gap > 4 ? '>4' : String(gap);
    gapHist[key]++;
  }
}
console.log(`可解 ${solvable}/20 | 平均猪 ${(pigs/20).toFixed(0)} | 同向同线间隔分布: ${JSON.stringify(gapHist)}`);
