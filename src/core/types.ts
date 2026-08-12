/** 四个朝向:上、右、下、左(棋盘整体旋转 45° 后,视觉上呈斜向)。 */
export const enum Dir {
  Up = 0,
  Right = 1,
  Down = 2,
  Left = 3,
}

export interface Vec {
  x: number;
  y: number;
}

export interface Pig {
  id: number;
  pos: Vec;
  dir: Dir;
}

export interface Obstacle {
  pos: Vec;
}

/** 一关的静态定义(固定数据,由生成器或手摆产生)。 */
export interface Level {
  id: number;
  width: number;
  height: number;
  pigs: Pig[];
  obstacles: Obstacle[];
}

export const DIR_VEC: readonly Vec[] = [
  { x: 0, y: -1 }, // Up 上(视觉 ↗)
  { x: 1, y: 0 }, // Right 右(视觉 ↘)
  { x: 0, y: 1 }, // Down 下(视觉 ↙)
  { x: -1, y: 0 }, // Left 左(视觉 ↖)
];

export const DIR_NAME: readonly string[] = ['上', '右', '下', '左'];

/**
 * 棋盘整体旋转 45° 后,某个"上下左右"方向对应的屏幕像素方向。
 * 虚拟格 (x,y) → 屏幕 ((x-y)h, (x+y)h);dir=(dx,dy) → 屏幕 (dx-dy, dx+dy)。
 */
export function screenDir(dir: Dir): Vec {
  const d = DIR_VEC[dir];
  return { x: d.x - d.y, y: d.x + d.y };
}
