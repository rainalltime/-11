// 逻辑层冒烟测试:按贪心解顺序模拟游玩(应无浪费步数=3星);
// 再故意先点一只被挡的猪(浪费1步),验证星级降为2星。
// 运行:npm run test:play
import { SAMPLE_LEVELS, cloneLevel } from '../src/core/levels.js';
import { GameState, starsFor } from '../src/core/logic.js';

let allOk = true;
// --- 道具逻辑:掉头反转朝向 / 提示返回可出猪 ---
{
  const s = new GameState(cloneLevel(SAMPLE_LEVELS[1]));
  const first = s.pigs[0];
  const before = first.dir;
  const beforeBody = s.pigBody(first);
  s.reverse(first.id);
  if (s.pigs[0].dir !== ((before + 2) % 4)) {
    allOk = false;
    console.log('掉头(reverse)逻辑异常');
  } else {
    console.log(`掉头:${before} → ${s.pigs[0].dir} ✅`);
  }
  // 掉头后身体必须仍在原来的两个格子上
  const afterBody = s.pigBody(s.pigs[0]);
  const sameCells =
    beforeBody.every((c) => afterBody.some((a) => a.x === c.x && a.y === c.y));
  if (!sameCells) {
    allOk = false;
    console.log(`掉头后身体挪动了: ${JSON.stringify(beforeBody)} → ${JSON.stringify(afterBody)}`);
  } else {
    console.log(`掉头后身体保持原两格 ✅`);
  }
  const h = s.hint();
  if (!h || !s.canExit(h)) {
    allOk = false;
    console.log('提示(hint)逻辑异常');
  } else {
    console.log(`提示:返回可出猪 id=${h.id} ✅`);
  }
}
for (const level of SAMPLE_LEVELS) {
  // --- 完美打法:按贪心顺序点,每点必消除 ---
  const state = new GameState(cloneLevel(level));
  const { order } = GameState.solve(level);
  for (const id of order) {
    const r = state.tap(id);
    if (!r.exited) {
      allOk = false;
      console.log(`第${level.id}关 完美打法出错:点 ${id} 未消除`);
    }
  }
  const cleared = state.cleared();
  const stars = starsFor(level, state.taps);
  const perfectOk = cleared && stars === 3;
  if (!perfectOk) allOk = false;
  console.log(
    `第 ${level.id} 关 完美打法: 清空=${cleared} 步数=${state.taps}/${level.pigs.length} 星级=${stars} ${perfectOk ? '✅' : '❌'}`,
  );

  // --- 失误打法:先点一只"路径被挡"的猪(浪费1步),再完美清场 → 应得 2 星 ---
  const s2 = new GameState(cloneLevel(level));
  const blockedPig = s2.pigs.find((p) => !s2.canExit(p));
  if (blockedPig) {
    const r = s2.tap(blockedPig.id);
    if (r.exited) {
      allOk = false;
      console.log(`第${level.id}关 失误打法异常:被挡猪 ${blockedPig.id} 居然消除了`);
    }
    // 之后用贪心完美清场(每点必消除)
    let guard = 0;
    while (!s2.cleared() && guard++ < 100) {
      const h = s2.hint();
      if (!h) break;
      s2.tap(h.id);
    }
    const cleared2 = s2.cleared();
    const stars2 = starsFor(level, s2.taps);
    if (!cleared2 || stars2 !== 2) {
      allOk = false;
      console.log(`第${level.id}关 失误打法异常:清空=${cleared2} 期望2星 实际${stars2} 步数=${s2.taps}`);
    } else {
      console.log(`第 ${level.id} 关 失误打法: 点被挡猪(浪费1步) → ${stars2}星 ✅`);
    }
  } else {
    console.log(`第 ${level.id} 关 无被挡猪(全可出),跳过失误打法`);
  }
}

console.log(allOk ? '\n逻辑冒烟测试全部通过 ✅' : '\n存在失败 ❌');
process.exit(allOk ? 0 : 1);
