// Rush Hour / 挪车 风格骨架生成器。
// 借鉴滑动拼图(Unblock Me / Rush Hour)的关卡设计:
//  - rings : 同心菱形环,猪沿环切向排布,外环先清 → 内环(剥洋葱)
//  - spiral: 环绕螺旋,长依赖链
//  - lanes : 横竖车道穿插(停车场),交叉点形成强制清除顺序
// 共性:逆向构造 —— 先定清场顺序,倒序放置,保证必解(与 generator.ts 相同的不变式)。
import { DIR_VEC, Dir, Level } from './types';
import { GenConfig, mulberry32, shuffle } from './generator';

export type Skeleton = 'rings' | 'spiral' | 'lanes';

export interface SkeletonCell {
  x: number;
  y: number;
  dir: Dir;
}

const key = (x: number, y: number) => `${x},${y}`;
const DIRS: readonly Dir[] = [Dir.Up, Dir.Right, Dir.Down, Dir.Left];

/** 菱形环上顺时针一圈的单元格(从外到内逐环调用)。 */
function ringCells(cx: number, cy: number, w: number, h: number, maxR: number): SkeletonCell[] {
  const cells: SkeletonCell[] = [];
  for (let r = maxR; r >= 1; r--) {
    const ring: SkeletonCell[] = [];
    for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && x < w && cy - r >= 0) ring.push({ x, y: cy - r, dir: Dir.Right });
    for (let y = cy - r + 1; y <= cy + r; y++) if (y >= 0 && y < h && cx + r < w) ring.push({ x: cx + r, y, dir: Dir.Down });
    for (let x = cx + r - 1; x >= cx - r; x--) if (x >= 0 && x < w && cy + r < h) ring.push({ x, y: cy + r, dir: Dir.Left });
    for (let y = cy + r - 1; y >= cy - r + 1; y--) if (y >= 0 && y < h && cx - r >= 0) ring.push({ x: cx - r, y, dir: Dir.Up });
    const seen = new Set<string>();
    for (const c of ring) {
      const k = key(c.x, c.y);
      if (!seen.has(k)) {
        seen.add(k);
        cells.push(c);
      }
    }
  }
  return cells;
}

/** 螺旋:从外到内的环绕路径(逐圈顺时针,奇偶圈方向错开形成螺旋感)。 */
function spiralCells(cx: number, cy: number, w: number, h: number, maxR: number): SkeletonCell[] {
  const cells: SkeletonCell[] = [];
  for (let r = maxR; r >= 1; r--) {
    const ring = ringCells(cx, cy, w, h, r);
    const seen = new Set<string>();
    for (const c of ring) {
      const k = key(c.x, c.y);
      if (!seen.has(k)) {
        seen.add(k);
        cells.push(c);
      }
    }
  }
  return cells;
}

/** 车道:横竖车道交叉(停车场)。spacing=车道间距。 */
function laneCells(cx: number, cy: number, w: number, h: number, spacing: number, rand: () => number): SkeletonCell[] {
  const cells: SkeletonCell[] = [];
  const lanesY: number[] = [];
  for (let y = cy; y < h; y += spacing) lanesY.push(y);
  for (let y = cy - spacing; y >= 0; y -= spacing) lanesY.push(y);
  const lanesX: number[] = [];
  for (let x = cx; x < w; x += spacing) lanesX.push(x);
  for (let x = cx - spacing; x >= 0; x -= spacing) lanesX.push(x);
  for (const y of lanesY) {
    for (let x = 0; x < w; x++) {
      if (x === cx) continue;
      cells.push({ x, y, dir: x < cx ? Dir.Right : Dir.Left });
    }
  }
  for (const x of lanesX) {
    for (let y = 0; y < h; y++) {
      if (y === cy) continue;
      cells.push({ x, y, dir: y < cy ? Dir.Down : Dir.Up });
    }
  }
  return shuffle(cells, rand);
}

/** 逆向构造生成一关(Rush 风格骨架)。 */
export function generateRushLevel(cfg: GenConfig & { skeleton: Skeleton }): Level {
  const rand = mulberry32(cfg.seed);
  const w = cfg.width;
  const h = cfg.height;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const R = cfg.circleRadius ?? Math.min(w, h) / 2 - 2;
  const styleRand = mulberry32((cfg.seed ^ 0x9e3779b9) >>> 0);
  const offU = (styleRand() * 2 - 1) * R * 0.15;
  const offV = (styleRand() * 2 - 1) * R * 0.15;
  const CCX = cx + offU;
  const CCY = cy + offV;

  let anchors: SkeletonCell[] = [];
  if (cfg.skeleton === 'rings') anchors = ringCells(Math.round(CCX), Math.round(CCY), w, h, Math.round(R));
  else if (cfg.skeleton === 'spiral') anchors = spiralCells(Math.round(CCX), Math.round(CCY), w, h, Math.round(R));
  else anchors = laneCells(Math.round(CCX), Math.round(CCY), w, h, 3, rand);

  const level: Level = { id: 0, width: w, height: h, pigs: [], obstacles: [] };
  const occupied = new Set<string>();
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const inCircle = (x: number, y: number) => Math.hypot(x - CCX, y - CCY) <= R;
  const free = (x: number, y: number) => inB(x, y) && !occupied.has(key(x, y));

  const canPlace = (x: number, y: number, dir: Dir): boolean => {
    const d = DIR_VEC[dir];
    if (!free(x, y) || !free(x - d.x, y - d.y)) return false;
    if (!inCircle(x, y) || !inCircle(x - d.x, y - d.y)) return false;
    let nx = x + d.x;
    let ny = y + d.y;
    while (inB(nx, ny)) {
      if (occupied.has(key(nx, ny))) return false;
      nx += d.x;
      ny += d.y;
    }
    return true;
  };

  let id = 0;
  for (let i = anchors.length - 1; i >= 0; i--) {
    const a = anchors[i];
    const tryDirs = [a.dir, ...shuffle(DIRS.filter((d) => d !== a.dir), rand)];
    let placed = false;
    for (const d of tryDirs) {
      if (canPlace(a.x, a.y, d)) {
        const dv = DIR_VEC[d];
        occupied.add(key(a.x, a.y));
        occupied.add(key(a.x - dv.x, a.y - dv.y));
        level.pigs.push({ id, pos: { x: a.x, y: a.y }, dir: d });
        id++;
        placed = true;
        break;
      }
    }
    if (!placed && i % 3 === 0) {
      // 兜底:在锚点附近的限定范围(±6 格)内找空格放(保证密度),失败跳过
      const RAD = 6;
      outer: for (let dy = -RAD; dy <= RAD && !placed; dy++) {
        for (let dx = -RAD; dx <= RAD && !placed; dx++) {
          const xx = a.x + dx;
          const yy = a.y + dy;
          if (!inCircle(xx, yy) || !free(xx, yy)) continue;
          for (const d of shuffle(DIRS, rand)) {
            if (canPlace(xx, yy, d)) {
              const dv = DIR_VEC[d];
              occupied.add(key(xx, yy));
              occupied.add(key(xx - dv.x, yy - dv.y));
              level.pigs.push({ id, pos: { x: xx, y: yy }, dir: d });
              id++;
              placed = true;
              break;
            }
          }
        }
      }
    }
  }
  // 骨架本身已足够密、链足够长;fillHoles 对 500 猪大棋盘 O(n^3) 太慢,此处不再做。
  return level;
}
