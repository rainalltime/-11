// 生成器测试:确定性 / 必可解 / 指标合理。
// 运行:npm run test:gen
import {
  generateLevel,
  measureLevel,
  difficultyScore,
  mulberry32,
  GenConfig,
} from '../src/core/generator.js';
import { SAMPLE_LEVELS } from '../src/core/levels.js';

let allOk = true;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    allOk = false;
    console.log(`❌ ${msg}`);
  }
};

// 1) 确定性:同一配置两次生成应完全一致
{
  const cfg: GenConfig = { seed: 12345, width: 7, height: 7, pigs: 6, obstacles: 3, chainBias: 0.4 };
  const a = generateLevel(cfg);
  const b = generateLevel(cfg);
  check(JSON.stringify(a) === JSON.stringify(b), '确定性:同一 seed 应生成完全相同关卡');
  console.log(`确定性:seed=12345 两次生成一致 ✅`);
}

// 2) mulberry32 可复现
{
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  const s1 = Array.from({ length: 5 }, () => r1());
  const s2 = Array.from({ length: 5 }, () => r2());
  check(JSON.stringify(s1) === JSON.stringify(s2), 'PRNG 可复现');
  console.log(`PRNG 可复现 ✅`);
}

// 3) 难度坡度批量(第1关小棋盘,其余16x24、1×2长猪、猪占~65%格、中间密):全关必可解
{
  let ok = 0;
  let minClearMin = Infinity;
  let chainMax = 0;
  for (let i = 0; i < 200; i++) {
    const cfg: GenConfig =
      i === 0
        ? { seed: 5000, width: 7, height: 7, pigs: 3, obstacles: 0, chainBias: 0 }
        : {
            seed: 5000 + i * 101,
            width: 16,
            height: 24,
            pigs: Math.round((0.6 + (i / 199) * 0.1) * 192),
            obstacles: 2 + Math.round((i / 199) * 12),
            chainBias: 0.25 + (i / 199) * 0.4,
            centerRatio: 0.72,
          };
    const level = generateLevel(cfg);
    const m = measureLevel(level);
    if (m.solvable) {
      ok++;
      minClearMin = Math.min(minClearMin, m.minClear);
      chainMax = Math.max(chainMax, m.chainLength);
      check(m.minClear >= 1, `第${i}关 可解但 minClear<1`);
    }
  }
  check(ok === 200, `200 关应全部可解,实际 ${ok}`);
  console.log(`批量生成:200 关全部可解 ✅  最小可点最小值=${minClearMin}  最长依赖链=${chainMax}`);
}

// 4) 样例关卡指标也应正常
{
  for (const lv of SAMPLE_LEVELS) {
    const m = measureLevel(lv);
    check(m.solvable, `样例第${lv.id}关应可解`);
    check(m.chainLength >= 1, `样例第${lv.id}关依赖链>=1`);
  }
  console.log(`样例关卡指标正常 ✅`);
}

// 5) 高密度:16x24 棋盘、1×2长猪、猪占 ~65% 格(115~135只),必须仍可解
{
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < 40; i++) {
    const tier = i / 39;
    const cfg: GenConfig = {
      seed: 9000 + i * 131,
      width: 16,
      height: 24,
      pigs: Math.round((0.6 + tier * 0.1) * 192),
      obstacles: 2 + Math.round(tier * 12),
      chainBias: 0.25 + tier * 0.4,
      centerRatio: 0.72,
    };
    try {
      const level = generateLevel(cfg);
      if (measureLevel(level).solvable) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }
  check(fail === 0, `高密度(猪~65%)应全部可解,失败 ${fail}`);
  console.log(`高密度:16x24 / 1×2长猪 / 猪占~65%格 → ${ok}/40 可解 ✅`);
}

// 6) 难度分:可解关卡得分有限,且猪越多/链越长得分越高(用于排序)
{
  const easy = generateLevel({ seed: 1, width: 12, height: 12, pigs: 12, obstacles: 1, chainBias: 0.1 });
  const hard = generateLevel({ seed: 2, width: 24, height: 32, pigs: 100, obstacles: 10, chainBias: 0.6, circleRadius: 14 });
  const sEasy = difficultyScore(easy);
  const sHard = difficultyScore(hard);
  check(Number.isFinite(sEasy) && Number.isFinite(sHard), '可解关卡难度分应为有限值');
  check(sHard > sEasy, `难度分应随复杂度上升: 简单${sEasy.toFixed(0)} vs 难${sHard.toFixed(0)}`);
  console.log(`难度分: 简单=${sEasy.toFixed(0)} 难=${sHard.toFixed(0)} ${sHard > sEasy ? '✅' : '❌'}`);
}

console.log(allOk ? '\n生成器测试全部通过 ✅' : '\n存在失败 ❌');
process.exit(allOk ? 0 : 1);
