import { circleCellCount, difficultyScore, generateCascadeLevel, fillHoles, measureLevel } from '../src/core/generator.ts';
import { encodeLevels } from '../src/core/format.ts';
import { writeFileSync } from 'node:fs';
const n = 120;
const circleCells = circleCellCount(24, 32, 14);
const gen = [];
for (let i = 1; i <= n; i++) {
  const tier = (i - 1) / n;
  const base = { seed: 20290000 + i * 1009, width: 24, height: 32, pigs: Math.round((0.55 + tier * 0.2) * (circleCells / 2)), obstacles: Math.round(3 + tier * 20), chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 };
  try {
    const lv = fillHoles(generateCascadeLevel(base), 10);
    if (measureLevel(lv).solvable) gen.push(lv);
  } catch {}
}
gen.forEach((l, i) => (l.id = i + 1));
writeFileSync('/tmp/checker_levels.json', encodeLevels(gen));
console.log('生成可解:', gen.length);
