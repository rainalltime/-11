// 验证陷阱:正确玩法(只点可出猪)必可解;先点被挡的陷阱猪(错误玩法)→ 死局
import { generateCascadeLevel } from '../src/core/generator.ts';
import { GameState } from '../src/core/logic.ts';
import { DIR_VEC } from '../src/core/types.ts';

function playSmart(state: GameState): boolean {
  // 只点可出的猪
  let guard = 0;
  while (!state.cleared() && guard++ < 500) {
    const next = state.pigs.find((p) => state.canExit(p));
    if (!next) return false; // 死局
    state.tap(next.id);
  }
  return state.cleared();
}

// 找陷阱:一行里 [→][X↓][←] 的 A 或 B(被 X 挡但先点会滑向中间)
function findTrapPig(state: GameState): number | null {
  const lv = state.level;
  const pigAt = new Map<string, number>();
  for (const p of state.pigs) {
    const d = DIR_VEC[p.dir];
    pigAt.set(`${p.pos.x},${p.pos.y}`, p.id);
    pigAt.set(`${p.pos.x - d.x},${p.pos.y - d.y}`, p.id);
  }
  // 找相邻的 → ← 猪对(中间隔 X)
  for (const a of state.pigs) {
    if (a.dir !== 1) continue; // 只查 →
    const d = DIR_VEC[a.dir];
    for (let g = 1; g <= 3; g++) {
      const mid = pigAt.get(`${a.pos.x + d.x + g},${a.pos.y + d.y}`);
      if (mid === undefined) continue;
      const m = state.pigs.find((p) => p.id === mid);
      if (!m || m.dir !== 2) continue; // X 朝 ↓
      const b = pigAt.get(`${a.pos.x + d.x + 2 * g + 1},${a.pos.y + d.y}`);
      if (b === undefined) continue;
      const bp = state.pigs.find((p) => p.id === b);
      if (bp && bp.dir === 3) return a.id; // A 是陷阱猪
    }
  }
  return null;
}

let traps = 0;
let wrongDeadEnd = 0;
for (let seed = 20310001; seed < 20310021; seed++) {
  const lv = generateCascadeLevel({ seed, width: 24, height: 32, pigs: 40, obstacles: 6, chainBias: 0.5, centerRatio: 0.8, circleRadius: 14 });
  // 正确玩法
  const smart = new GameState(lv);
  const smartOk = playSmart(smart);
  // 错误玩法:先点一只陷阱猪
  const wrong = new GameState(lv);
  const trapPig = findTrapPig(wrong);
  if (trapPig !== null) {
    traps++;
    wrong.tap(trapPig); // 点被挡的陷阱猪 → 滑动
    const dead = !playSmart(wrong);
    if (dead) wrongDeadEnd++;
  }
  if (!smartOk) console.log(`seed ${seed}: 正确玩法竟死局!`);
}
console.log(`有陷阱 ${traps}/20 | 错误玩法触发死局 ${wrongDeadEnd}/${traps}`);
