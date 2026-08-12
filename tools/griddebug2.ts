import { generateCascadeLevel } from '../src/core/generator.ts';
// 手动复刻 lineSeq 逻辑看列为何 0 只
import { circleCellCount, difficultyScore } from '../src/core/generator.ts';
const lv = generateCascadeLevel({ seed: 20300001, width: 24, height: 32, pigs: 88, obstacles: 3, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
const dirs = {0:'U',1:'R',2:'D',3:'L'};
const perDir = {0:0,1:0,2:0,3:0};
for (const p of lv.pigs) perDir[p.dir]++;
console.log('方向分布 U/R/D/L:', perDir[0], perDir[1], perDir[2], perDir[3], '总', lv.pigs.length);
// 打印所有猪
for (const p of lv.pigs) console.log(`  猪 id${p.id} at(${p.pos.x},${p.pos.y}) ${dirs[p.dir]}`);
