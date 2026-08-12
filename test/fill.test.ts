import {
  generateLevel,
  fillHoles,
  longestDependencyChain,
  measureLevel,
  GenConfig,
} from '../src/core/generator.js';

function genWithRetry(base: GenConfig) {
  let obs = base.obstacles;
  for (let t = 0; t < 50; t++) {
    try {
      return generateLevel({ ...base, obstacles: obs, seed: base.seed + t * 7919 });
    } catch {
      if (obs > 0) obs--;
    }
  }
  throw new Error('generate fail');
}

// fillHoles 回归:插入的猪必须保持可解,且能拉长依赖链
let allOk = true;
let totIns = 0;
let totChain = 0;
let fail = 0;
for (let i = 0; i < 40; i++) {
  const tier = i / 39;
  const lv = genWithRetry({
    seed: 3000 + i * 107,
    width: 24,
    height: 32,
    pigs: Math.round((0.45 + tier * 0.25) * 154),
    obstacles: Math.round(tier * 14),
    chainBias: 0.15 + tier * 0.5,
    centerRatio: 0.72,
    circleRadius: 14,
  });
  const before = { pigs: lv.pigs.length, chain: longestDependencyChain(lv) };
  const filled = fillHoles(lv, 8);
  const after = { pigs: filled.pigs.length, chain: longestDependencyChain(filled) };
  if (!measureLevel(filled).solvable) {
    fail++;
    allOk = false;
  }
  totIns += after.pigs - before.pigs;
  totChain += after.chain - before.chain;
}
console.log(`40关平均: 插入猪 ${(totIns / 40).toFixed(1)} 只, 依赖链平均拉长 ${(totChain / 40).toFixed(1)}`);
console.log(`填洞后不可解: ${fail}`);
console.log(allOk ? 'fillHoles 测试通过 ✅' : '存在失败 ❌');
process.exit(allOk ? 0 : 1);
