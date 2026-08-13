// 陷阱模块式关卡生成器(猪了个猪)。
// 核心:经典四车环 / 夺位环 —— 4 猪依赖环,钥匙猪先动可解、诱饵猪先动死锁。
// 支持旋转/镜像生成变体;多模块放置;填充猪提高密度;滑动感知 BFS 验证。
import { DIR_VEC, Dir, Level, Pig } from './types';
import { solvableWithSlides, movePigOnce, SPig } from './trap-solver';

export interface TrapPig {
  x: number;
  y: number;
  dir: Dir;
}

export interface TrapModuleDef {
  name: string;
  /** 模块本地坐标系下的猪(头坐标 + 方向)。 */
  pigs: TrapPig[];
  /** 钥匙猪(正确第一步)在 pigs 中的下标。 */
  keyIdx: number;
  /** 诱饵猪(错误第一步)在 pigs 中的下标。 */
  decoyIdx: number;
}

/** 经典四车环(基准方向,基于用户给出的坐标 x=列,y=行)。 */
export const CLASSIC_RING: TrapModuleDef = {
  name: 'classic',
  pigs: [
    { x: 8, y: 0, dir: Dir.Right }, // 1> 互锁
    { x: 7, y: 1, dir: Dir.Up }, // 2^ 互锁
    { x: 9, y: 1, dir: Dir.Down }, // 3v 钥匙
    { x: 10, y: 2, dir: Dir.Left }, // 4< 诱饵
  ],
  keyIdx: 2,
  decoyIdx: 3,
};

/** 夺位环(基准方向,基于用户给出的坐标)。 */
export const STEAL_RING: TrapModuleDef = {
  name: 'steal',
  pigs: [
    { x: 3, y: 1, dir: Dir.Right }, // 1> 互锁
    { x: 4, y: 1, dir: Dir.Down }, // 3v 互锁
    { x: 4, y: 2, dir: Dir.Left }, // 4< 钥匙
    { x: 3, y: 3, dir: Dir.Up }, // 2^ 诱饵
  ],
  keyIdx: 2,
  decoyIdx: 3,
};

const ROT_NEXT: readonly Dir[] = [Dir.Right, Dir.Down, Dir.Left, Dir.Up]; // R→D→L→U(顺时针)
const ROT_IDX: Record<number, number> = { [Dir.Up]: 3, [Dir.Right]: 0, [Dir.Down]: 1, [Dir.Left]: 2 };

function rotateDir(dir: Dir, times: number): Dir {
  let idx = ROT_IDX[dir];
  idx = (idx + times) % 4;
  return ROT_NEXT[idx];
}

function mirrorDir(dir: Dir): Dir {
  return dir === Dir.Right ? Dir.Left : dir === Dir.Left ? Dir.Right : dir;
}

/** 模块包围盒。 */
export function moduleBounds(def: TrapModuleDef): { w: number; h: number } {
  let maxX = 0;
  let maxY = 0;
  for (const p of def.pigs) {
    const d = DIR_VEC[p.dir];
    maxX = Math.max(maxX, p.x, p.x - d.x);
    maxY = Math.max(maxY, p.y, p.y - d.y);
  }
  return { w: maxX + 1, h: maxY + 1 };
}

/**
 * 生成模块变体:rot∈{0,1,2,3}(0/90/180/270°),mirror∈{false,true}。
 * 返回变换后的猪(绝对坐标,以 (ox,oy) 为左上角)、钥匙/诱饵下标、以及"释放格"。
 * 释放格 = 钥匙猪移动后腾出的关键格(经典环:3v 下移一格后腾出的 head 后一格)。
 */
export function transformModule(
  def: TrapModuleDef,
  rot: number,
  mirror: boolean,
  ox: number,
  oy: number,
): { pigs: TrapPig[]; keyIdx: number; decoyIdx: number; release: TrapPig; bounds: { w: number; h: number } } {
  const base = moduleBounds(def);
  // 先做旋转维度计算:旋转后包围盒尺寸
  const bw = rot % 2 === 0 ? base.w : base.h;
  const bh = rot % 2 === 0 ? base.h : base.w;
  const transformed = def.pigs.map((p) => {
    let x = p.x;
    let y = p.y;
    let dir = p.dir;
    if (mirror) {
      x = base.w - 1 - x;
      dir = mirrorDir(dir);
    }
    if (rot === 1) {
      // 90° 顺时针:(x,y) → (baseH-1-y, x);方向 R→D
      const nx = base.h - 1 - y;
      const ny = x;
      x = nx;
      y = ny;
      dir = rotateDir(dir, 1);
    } else if (rot === 2) {
      x = base.w - 1 - x;
      y = base.h - 1 - y;
      dir = rotateDir(dir, 2);
    } else if (rot === 3) {
      const nx = y;
      const ny = base.w - 1 - x;
      x = nx;
      y = ny;
      dir = rotateDir(dir, 3);
    }
    return { x: x + ox, y: y + oy, dir };
  });
  return {
    pigs: transformed,
    keyIdx: def.keyIdx,
    decoyIdx: def.decoyIdx,
    bounds: { w: bw, h: bh },
    release: transformed[def.keyIdx],
  };
}

/** 把模块猪列表转成 Pig(id 连续) */
export function toLevelPigs(pigs: TrapPig[], idBase: number): Pig[] {
  return pigs.map((p, i) => ({ id: idBase + i, pos: { x: p.x, y: p.y }, dir: p.dir }));
}

/** 猪占据的格子(头 + 尾)。 */
export function pigCells(p: TrapPig): { x: number; y: number }[] {
  const d = DIR_VEC[p.dir];
  return [{ x: p.x, y: p.y }, { x: p.x - d.x, y: p.y - d.y }];
}

export interface PlacedModule {
  def: TrapModuleDef;
  pigs: TrapPig[];
  keyIdx: number;
  decoyIdx: number;
  box: { x: number; y: number; w: number; h: number };
  /** 钥匙猪在整盘 pigs 数组里的 id 偏移(用于验证)。 */
  idBase: number;
}

function boxOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * 在 board 上放置多个陷阱模块(带 margin 边距,不重叠)。
 * 返回放置成功的模块列表。
 */
export function placeModules(
  defs: TrapModuleDef[],
  boardW: number,
  boardH: number,
  margin = 2,
  maxAttempts = 60,
): PlacedModule[] {
  const placed: PlacedModule[] = [];
  let idBase = 0;
  for (const def of defs) {
    let done = false;
    for (let attempt = 0; attempt < maxAttempts && !done; attempt++) {
      const rot = attempt % 4;
      const mirror = attempt % 8 >= 4;
      const base = moduleBounds(def);
      const bw = rot % 2 === 0 ? base.w : base.h;
      const bh = rot % 2 === 0 ? base.h : base.w;
      const ox = margin + Math.floor(((attempt * 37) % (boardW - bw - margin * 2)));
      const oy = margin + Math.floor(((attempt * 53) % (boardH - bh - margin * 2)));
      const t = transformModule(def, rot, mirror, ox, oy);
      const box = { x: ox - 1, y: oy - 1, w: bw + 2, h: bh + 2 };
      if (box.x < 0 || box.y < 0 || box.x + box.w > boardW || box.y + box.h > boardH) continue;
      if (placed.some((p) => boxOverlap(p.box, box))) continue;
      // 走廊感知:新模块的猪不能落在已有模块的退出射线上;已有模块的猪不能落在新模块的退出射线上
      const newCells = new Set<string>();
      for (const p of t.pigs) for (const c of pigCells(p)) newCells.add(`${c.x},${c.y}`);
      let conflict = false;
      for (const prev of placed) {
        // 已有模块的猪是否在新模块的射线上
        for (const p of t.pigs) {
          const d = DIR_VEC[p.dir];
          let x = p.x + d.x;
          let y = p.y + d.y;
          while (x >= 0 && y >= 0 && x < boardW && y < boardH) {
            const prevCells = prev.pigs.flatMap(pigCells);
            if (prevCells.some((c) => c.x === x && c.y === y)) {
              conflict = true;
              break;
            }
            x += d.x;
            y += d.y;
          }
          if (conflict) break;
        }
        if (conflict) break;
        // 新模块的猪是否在已有模块的射线上
        for (const p of prev.pigs) {
          const d = DIR_VEC[p.dir];
          let x = p.x + d.x;
          let y = p.y + d.y;
          while (x >= 0 && y >= 0 && x < boardW && y < boardH) {
            if (newCells.has(`${x},${y}`)) {
              conflict = true;
              break;
            }
            x += d.x;
            y += d.y;
          }
          if (conflict) break;
        }
        if (conflict) break;
      }
      if (conflict) continue;
      placed.push({
        def,
        pigs: t.pigs,
        keyIdx: t.keyIdx,
        decoyIdx: t.decoyIdx,
        box,
        idBase,
      });
      idBase += def.pigs.length;
      done = true;
    }
  }
  return placed;
}

/** 把放置好的模块 + 填充猪组装成 Level(并做验证)。 */
export function assembleLevel(modules: PlacedModule[], boardW: number, boardH: number, targetFillers: number): Level | null {
  const level: Level = { id: 0, width: boardW, height: boardH, pigs: [], obstacles: [] };
  const occ = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  // 模块猪
  for (const m of modules) {
    for (const p of m.pigs) {
      const cells = pigCells(p);
      for (const c of cells) {
        if (occ.has(key(c.x, c.y))) return null; // 重叠 → 失败
        occ.add(key(c.x, c.y));
      }
      level.pigs.push({ id: level.pigs.length, pos: { x: p.x, y: p.y }, dir: p.dir });
    }
  }

  // 模块包围盒(填充猪不能放进去)
  const inModuleBox = (x: number, y: number): boolean =>
    modules.some((m) => x >= m.box.x && x < m.box.x + m.box.w && y >= m.box.y && y < m.box.y + m.box.h);

  // 填充猪:指向最近边缘、射线畅通(贪心可出)
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < boardW && y < boardH;
  let fillerCount = 0;
  for (let pass = 0; pass < 8 && fillerCount < targetFillers; pass++) {
    for (let y = 0; y < boardH && fillerCount < targetFillers; y++) {
      for (let x = 0; x < boardW && fillerCount < targetFillers; x++) {
        if (occ.has(key(x, y))) continue;
        if (inModuleBox(x, y)) continue;
        // 选方向:指向最近边缘,射线畅通
        const distR = boardW - 1 - x;
        const distL = x;
        const distD = boardH - 1 - y;
        const distU = y;
        const candidates: { dir: Dir; d: number }[] = [
          { dir: Dir.Right, d: distR },
          { dir: Dir.Left, d: distL },
          { dir: Dir.Down, d: distD },
          { dir: Dir.Up, d: distU },
        ].sort((a, b) => a.d - b.d);
        for (const c of candidates) {
          const dv = DIR_VEC[c.dir];
          const tx = x - dv.x;
          const ty = y - dv.y;
          if (!inB(tx, ty) || occ.has(key(tx, ty))) continue;
          if (inModuleBox(tx, ty)) continue;
          // 射线畅通(到头不遇猪)
          let nx = x + dv.x;
          let ny = y + dv.y;
          let clear = true;
          while (inB(nx, ny)) {
            if (occ.has(key(nx, ny))) {
              clear = false;
              break;
            }
            nx += dv.x;
            ny += dv.y;
          }
          if (!clear) continue;
          occ.add(key(x, y));
          occ.add(key(tx, ty));
          level.pigs.push({ id: level.pigs.length, pos: { x, y }, dir: c.dir });
          fillerCount++;
          break;
        }
      }
    }
  }
  return level;
}

/**
 * 整盘验证:
 * 1) 贪心:所有填充猪可出(assemble 已保证,此处再整体贪心跑一遍,确认无死局)
 * 2) 每个模块:钥匙先动 → 该模块可解;诱饵先动 → 死锁(在整盘上验证)
 */
export function verifyLevel(level: Level, modules: PlacedModule[]): boolean {
  // 1) 每模块:钥匙可解 / 诱饵死锁(隔离 BFS,快)
  const spig = (p: typeof level.pigs[number]): SPig => ({ id: p.id, pos: { ...p.pos }, dir: p.dir });
  for (const m of modules) {
    const modPigs = level.pigs.slice(m.idBase, m.idBase + m.def.pigs.length).map(spig);
    const keyState = movePigOnce(modPigs, m.idBase + m.keyIdx, level.width, level.height);
    if (!solvableWithSlides(keyState, level.width, level.height)) return false;
    const decoyState = movePigOnce(modPigs, m.idBase + m.decoyIdx, level.width, level.height);
    if (solvableWithSlides(decoyState, level.width, level.height)) return false;
  }

  // 2) 整盘构造式模拟:贪心清空(填充猪先出)→ 每模块执行钥匙滑动 → 继续贪心 → 全部清空即可解
  return simulateSolve(level, modules);
}

/** 构造式整盘求解模拟:回溯 DFS 尝试不同的模块钥匙顺序,任一顺序能清空即可解。 */
export function simulateSolve(level: Level, modules: PlacedModule[]): boolean {
  const pigs = level.pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  const keyIds = modules.map((m) => m.idBase + m.keyIdx);
  const occ = () => {
    const s = new Set<string>();
    for (const p of pigs) {
      const d = DIR_VEC[p.dir];
      s.add(`${p.pos.x},${p.pos.y}`);
      s.add(`${p.pos.x - d.x},${p.pos.y - d.y}`);
    }
    return s;
  };
  const canExit = (p: (typeof pigs)[number]): boolean => {
    const o = occ();
    const d = DIR_VEC[p.dir];
    let x = p.pos.x + d.x;
    let y = p.pos.y + d.y;
    while (x >= 0 && y >= 0 && x < level.width && y < level.height) {
      if (o.has(`${x},${y}`)) return false;
      x += d.x;
      y += d.y;
    }
    return true;
  };
  const moveKey = (id: number): boolean => {
    const pig = pigs.find((p) => p.id === id);
    if (!pig) return false;
    const o = occ();
    const d = DIR_VEC[pig.dir];
    let x = pig.pos.x;
    let y = pig.pos.y;
    while (true) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) {
        pigs.splice(pigs.indexOf(pig), 1);
        return true;
      }
      if (o.has(`${nx},${ny}`)) break;
      x = nx;
      y = ny;
    }
    pig.pos = { x, y };
    return true;
  };

  // 回溯:状态 = (pigs 快照, 已移动钥匙集合)。深搜尝试钥匙移动顺序。
  const snapshot = () => pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  const restore = (s: (typeof pigs)) => {
    pigs.length = 0;
    pigs.push(...s);
  };
  const seen = new Set<string>();

  const dfs = (moved: number): boolean => {
    // 贪心清空
    let cleared = true;
    while (cleared) {
      cleared = false;
      for (let i = pigs.length - 1; i >= 0; i--) {
        if (canExit(pigs[i])) {
          pigs.splice(i, 1);
          cleared = true;
        }
      }
    }
    if (pigs.length === 0) return true;
    // 尝试移动任一未移动的钥匙
    for (const ki of keyIds.map((_, i) => i)) {
      if (moved & (1 << ki)) continue;
      if (!pigs.some((p) => p.id === keyIds[ki])) continue;
      const snap = snapshot();
      moveKey(keyIds[ki]);
      const stKey = `${moved | (1 << ki)}|${pigs.map((p) => `${p.pos.x},${p.pos.y}`).sort().join(',')}`;
      if (!seen.has(stKey)) {
        seen.add(stKey);
        if (dfs(moved | (1 << ki))) return true;
      }
      restore(snap);
    }
    return false;
  };
  return dfs(0);
}

/** 生成一关:放置 numModules 个陷阱 + 填充到 targetFillers 只填充猪。 */
export function generateTrapLevel(
  seed: number,
  boardW: number,
  boardH: number,
  numModules: number,
  targetFillers: number,
): Level | null {
  const defs: TrapModuleDef[] = [];
  for (let i = 0; i < numModules; i++) {
    const useSteal = ((seed + i * 131) >>> 0) % 2 === 0;
    defs.push(useSteal ? STEAL_RING : CLASSIC_RING);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const modules = placeModules(defs, boardW, boardH, 2, 40);
    if (modules.length < numModules) continue;
    const level = assembleLevel(modules, boardW, boardH, targetFillers);
    if (!level) continue;
    if (verifyLevel(level, modules)) return level;
  }
  return null;
}
