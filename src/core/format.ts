import { Dir, Level } from './types';

/** 紧凑关卡格式:猪用 [fx, fy, dir] 数组,id 按数组下标隐式。 */
export interface CompactLevel {
  w: number;
  h: number;
  pigs: [number, number, Dir][];
  obs: [number, number][];
}

export function encodeLevels(levels: Level[]): string {
  const out: CompactLevel[] = levels.map((lv) => ({
    w: lv.width,
    h: lv.height,
    pigs: lv.pigs.map((p) => [p.pos.x, p.pos.y, p.dir] as [number, number, Dir]),
    obs: lv.obstacles.map((o) => [o.pos.x, o.pos.y] as [number, number]),
  }));
  return JSON.stringify(out);
}

export function decodeLevels(data: unknown): Level[] {
  const arr = data as CompactLevel[];
  return arr.map((c, i) => ({
    id: i + 1,
    width: c.w,
    height: c.h,
    pigs: c.pigs.map(([fx, fy, dir], j) => ({ id: j, pos: { x: fx, y: fy }, dir })),
    obstacles: c.obs.map(([x, y]) => ({ pos: { x, y } })),
  }));
}
