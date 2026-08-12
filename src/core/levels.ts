import { Dir, Level } from './types';

/** 手摆的样例关卡(1×2 长猪;pos 为头部格,身体 = 头部 + 尾部)。 */
function makeLevel(
  id: number,
  width: number,
  height: number,
  pigs: [fx: number, fy: number, dir: Dir][],
  obstacles: [x: number, y: number][] = [],
): Level {
  return {
    id,
    width,
    height,
    pigs: pigs.map(([fx, fy, dir], i) => ({ id: i, pos: { x: fx, y: fy }, dir })),
    obstacles: obstacles.map(([x, y]) => ({ pos: { x, y } })),
  };
}

export const SAMPLE_LEVELS: Level[] = [
  // 第 1 关:三只长猪各自朝外,点击即出
  makeLevel(1, 7, 7, [
    [3, 0, Dir.Up],
    [0, 3, Dir.Left],
    [6, 6, Dir.Right],
  ]),
  // 第 2 关:A 被 B 挡住,要先点 B
  makeLevel(2, 7, 7, [
    [1, 1, Dir.Right], // A: 射线被 (3,1)B 的尾部挡
    [4, 1, Dir.Right], // B: 可出
    [2, 5, Dir.Up], // C: 独立
  ]),
  // 第 3 关:三连链
  makeLevel(3, 7, 7, [
    [0, 0, Dir.Down], // A: 被 B 挡
    [0, 3, Dir.Down], // B: 被 C 挡
    [0, 6, Dir.Down], // C: 可出
    [3, 0, Dir.Up], // D: 独立
  ]),
  // 第 4 关:两条链交会,关键猪同时挡两条
  makeLevel(4, 8, 8, [
    [1, 0, Dir.Right], // 被 (4,0) 挡
    [5, 0, Dir.Right], // 可出
    [1, 7, Dir.Left], // 被 (3,7) 挡
    [5, 7, Dir.Left], // 关键猪,可出
    [0, 3, Dir.Down], // 独立
  ]),
];

/** 运行时复制一关(避免共享同一份 pig 数组被修改)。 */
export function cloneLevel(l: Level): Level {
  return {
    ...l,
    pigs: l.pigs.map((p) => ({ ...p, pos: { ...p.pos } })),
    obstacles: l.obstacles.map((o) => ({ pos: { ...o.pos } })),
  };
}
