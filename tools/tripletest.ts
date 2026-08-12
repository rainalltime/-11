import { generateCascadeLevel, measureLevel } from '../src/core/generator.ts';
let solvable = 0, pigs = 0, triples = 0;
for (let i = 1; i <= 20; i++) {
  const lv = generateCascadeLevel({ seed: 20430000 + i * 7919, width: 24, height: 32, pigs: 0, obstacles: 0, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  if (measureLevel(lv).solvable) solvable++;
  pigs += lv.pigs.length;
  // 检查同向同线是否有"三连贴"(3只猪,相邻两只都间隔0)
  for (const p of lv.pigs) {
    const sameLine = (p.dir === 1 || p.dir === 3)
      ? lv.pigs.filter(q => q.dir === p.dir && q.pos.y === p.pos.y)
      : lv.pigs.filter(q => q.dir === p.dir && q.pos.x === p.pos.x);
    // 按位置排序
    const pos = sameLine.map(q => (p.dir === 1 || p.dir === 3) ? q.pos.x : q.pos.y).sort((a,b)=>a-b);
    for (let j = 0; j + 2 < pos.length; j++) {
      if (pos[j+1] - pos[j] === 2 && pos[j+2] - pos[j+1] === 2) triples++; // 三连贴
    }
  }
}
console.log(`可解 ${solvable}/20 | 平均猪 ${(pigs/20).toFixed(0)} | 同向同线三连贴数: ${triples}`);
