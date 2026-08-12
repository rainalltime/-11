// 碰撞回归测试:1×2 长猪远距离被挡时,应在"阻挡猪前一格"停下,不许穿过去或直接出界。
import { GameState } from '../src/core/logic.js';
import { Dir, Level } from '../src/core/types.js';

let allOk = true;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    allOk = false;
    console.log('❌ ' + msg);
  }
};

// 四个方向:A 的头部前方被 B 挡,点 A 应停在 B 前一格
const CASES: Record<number, { front: [number, number]; bFront: [number, number]; expect: [number, number] }> = {
  [Dir.Up]: { front: [8, 10], bFront: [8, 5], expect: [8, 7] },
  [Dir.Right]: { front: [4, 10], bFront: [10, 10], expect: [8, 10] },
  [Dir.Down]: { front: [8, 4], bFront: [8, 10], expect: [8, 8] },
  [Dir.Left]: { front: [10, 14], bFront: [4, 14], expect: [6, 14] },
};

for (const dir of [Dir.Up, Dir.Right, Dir.Down, Dir.Left]) {
  const c = CASES[dir];
  const lv: Level = {
    id: 1,
    width: 16,
    height: 24,
    pigs: [
      { id: 0, pos: { x: c.front[0], y: c.front[1] }, dir },
      { id: 1, pos: { x: c.bFront[0], y: c.bFront[1] }, dir },
    ],
    obstacles: [],
  };
  const s = new GameState(lv);
  const r = s.tap(0);
  const p = s.pigs[0];
  const okPos = p.pos.x === c.expect[0] && p.pos.y === c.expect[1];
  check(!r.exited && okPos, `方向${dir}: 应停在 (${c.expect[0]},${c.expect[1]}),实际 ${JSON.stringify(r)} / 头=${JSON.stringify(p.pos)}`);
}

// 三只同列长猪:近→远逐级阻挡
{
  const lv: Level = {
    id: 2,
    width: 16,
    height: 24,
    pigs: [
      { id: 0, pos: { x: 5, y: 2 }, dir: Dir.Down },
      { id: 1, pos: { x: 5, y: 6 }, dir: Dir.Down },
      { id: 2, pos: { x: 5, y: 10 }, dir: Dir.Down },
    ],
    obstacles: [],
  };
  const s = new GameState(lv);
  s.tap(0); // 0 被 1 挡,1×2 长猪停在对方最近身体格前一格 → (5,4)
  check(s.pigs[0].pos.x === 5 && s.pigs[0].pos.y === 4, `猪0 应停在 (5,4),实际 ${JSON.stringify(s.pigs[0].pos)}`);
  s.tap(1); // 1 被 2 挡 → (5,8)
  check(s.pigs[1].pos.x === 5 && s.pigs[1].pos.y === 8, `猪1 应停在 (5,8),实际 ${JSON.stringify(s.pigs[1].pos)}`);
  s.tap(2); // 2 出界
  check(s.pigs.length === 2, '猪2 应出界移除');
  s.tap(1);
  check(s.pigs.length === 1, '猪1 应出界移除');
  s.tap(0);
  check(s.pigs.length === 0, '猪0 应出界移除,全部清空');
}

console.log(allOk ? '碰撞回归测试全部通过 ✅' : '存在碰撞 bug ❌');
process.exit(allOk ? 0 : 1);
