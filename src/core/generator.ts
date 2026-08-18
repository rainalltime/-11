import { DIR_VEC, Dir, Level, Pig, Vec } from './types';
import { GameState } from './logic';

/** 可复现的种子随机数(mulberry32)——"每一关固定"就靠它。 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface GenConfig {
  seed: number;
  width: number;
  height: number;
  pigs: number;
  obstacles: number;
  /** 0..1:多大比例优先让猪挡在别的猪射线上(制造"必须等它先走"的链) */
  chainBias: number;
  /** 0..1:多大比例的猪放进"中间区"(其余放外圈)——中间多、四周少 */
  centerRatio?: number;
  /** 猪只放在"圆心 + 半径"范围内(单位:旋转后格距)。缺省 = 不限(全棋盘)。 */
  circleRadius?: number;
  /** 手机竖屏适配:生成区由圆变椭圆,长宽比 = v 半径 / u 半径(≈ 手机屏高/宽,如 2.0)。
   *  与 circleRadius 一起用时,rv = circleRadius × aspect;单独用时按棋盘自动铺满。 */
  phoneAspect?: number;
  /** 朝向模式:让相邻两行/两列方向相反,制造更多阻挡链(难度↑)。缺省 = outward */
  pattern?: DirPattern;
  /** 调试钩子:每放一只猪后回调(用于可视化单步调试生成过程) */
  onPlace?: (level: Level, pig: Pig) => void;
}

const DIRS: readonly Dir[] = [Dir.Up, Dir.Right, Dir.Down, Dir.Left];
const key = (x: number, y: number) => `${x},${y}`;

/** 朝向模式:相邻两行(列)的猪头方向相反,形成交错阻挡 */
export type DirPattern = 'outward' | 'inward' | 'rows' | 'columns' | 'pinwheel';

/**
 * 某个格子"该有的朝向"(1×2 长猪的头部):
 * - outward : 2×2 块向外指(易,用于教学/低难度)
 * - inward  : 2×2 块向内指(强互挡,死局风险高,需求解器兜底)
 * - rows    : 整行同向,相邻两行相反(行内从左/右边缘级联清场)
 * - columns : 整列同向,相邻两列相反(列内从上/下边缘级联清场)
 * - pinwheel: 对角线相反(相邻行/列方向不同,斜向旋转)
 */
export function patternDir(x: number, y: number, pat: DirPattern): Dir {
  switch (pat) {
    case 'inward':
      return (x + y) % 2 === 0 ? (y % 2 === 0 ? Dir.Down : Dir.Up) : (x % 2 === 0 ? Dir.Right : Dir.Left);
    case 'rows':
      return (y % 2 === 0 ? Dir.Right : Dir.Left);
    case 'columns':
      return (x % 2 === 0 ? Dir.Down : Dir.Up);
    case 'pinwheel':
      return ((x + y) % 4) as Dir;
    case 'outward':
    default:
      return (x + y) % 2 === 0 ? (y % 2 === 0 ? Dir.Up : Dir.Down) : (x % 2 === 0 ? Dir.Left : Dir.Right);
  }
}

/** 首选模式方向,其余方向随机重排(放不下时自动退化为其他方向)。 */
function patternFirst(x: number, y: number, pat: DirPattern, rand: () => number): Dir[] {
  const preferred = patternDir(x, y, pat);
  return [preferred, ...shuffle(DIRS.filter((d) => d !== preferred), rand)];
}

/**
 * 生成区(屏幕空间 u=x-y, v=x+y):
 * - 默认不裁剪(全棋盘);
 * - circleRadius → 圆;
 * - phoneAspect → 手机竖屏椭圆(铺满屏,不按圆形裁剪)。
 */
interface GenRegion {
  active: boolean;
  cu: number;
  cv: number;
  ru: number;
  rv: number;
}

function buildRegion(
  width: number,
  height: number,
  cu: number,
  cv: number,
  cfg: { circleRadius?: number; phoneAspect?: number },
): GenRegion {
  const aspect = cfg.phoneAspect ?? 1;
  if (cfg.circleRadius !== undefined && Number.isFinite(cfg.circleRadius)) {
    const r = cfg.circleRadius;
    return { active: true, cu, cv, ru: r, rv: r * aspect };
  }
  if (aspect !== 1) {
    // 手机竖屏自适应:椭圆尽量填满屏幕高度,长宽比 = aspect
    const uHalf = Math.min(cu + (height - 1), (width - 1) - cu);
    const vHalf = Math.min(cv, (width + height - 2) - cv);
    const ru = Math.min(uHalf, vHalf / aspect) * 0.9;
    return { active: true, cu, cv, ru, rv: ru * aspect };
  }
  return { active: false, cu, cv, ru: 0, rv: 0 };
}

/** 是否在生成区内(屏幕空间椭圆/圆;未启用时恒真)。 */
function inRegion(reg: GenRegion, x: number, y: number): boolean {
  if (!reg.active) return true;
  const u = (x - y) - reg.cu;
  const v = (x + y) - reg.cv;
  const nu = u / reg.ru;
  const nv = v / reg.rv;
  return nu * nu + nv * nv <= 1;
}

/** 归一化半径(0=中心,1=边界;未启用时返回 0)。 */
function regionRadius(reg: GenRegion, x: number, y: number): number {
  if (!reg.active) return 0;
  const u = (x - y) - reg.cu;
  const v = (x + y) - reg.cv;
  return Math.sqrt((u / reg.ru) ** 2 + (v / reg.rv) ** 2);
}

/** 从 (x,y) 出发沿 dir 的射线上的格子(不含起点)。 */
export function rayCells(x: number, y: number, dir: Dir, w: number, h: number): Vec[] {
  const v = DIR_VEC[dir];
  const cells: Vec[] = [];
  let nx = x + v.x;
  let ny = y + v.y;
  while (nx >= 0 && ny >= 0 && nx < w && ny < h) {
    cells.push({ x: nx, y: ny });
    nx += v.x;
    ny += v.y;
  }
  return cells;
}

/** 统计"圆心 + 半径"圆内(旋转后)有多少个格子。 */
export function circleCellCount(w: number, h: number, radius: number): number {
  const cu = (w - h) / 2;
  const cv = (w + h - 2) / 2;
  let n = 0;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (Math.hypot(x - y - cu, x + y - cv) <= radius) n++;
    }
  }
  return n;
}

/** 中心权重采样:中间密、四周稀(权重 ∝ (1 - 归一化距离)^bias)。 */
function pickCell(rand: () => number, w: number, h: number, cx: number, cy: number, bias: number): Vec {
  const maxR = Math.hypot(w / 2, h / 2);
  for (let t = 0; t < 120; t++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const r = Math.hypot(x - cx, y - cy) / maxR; // 0..1
    const wgt = Math.pow(1 - r, bias);
    if (rand() < 0.04 + wgt * 0.96) return { x, y };
  }
  return { x: Math.floor(rand() * w), y: Math.floor(rand() * h) };
}

/**
 * 逆向构造生成一关(1×2 长猪,天生必解):
 * 1) 先随机放障碍物(永久阻挡,绝不能落在任何猪的射线上);
 * 2) 随机清场顺序 order[0] 先出,order[N-1] 最后出;
 * 3) 倒序放置:后出场的先放。每只猪要求"头部前方射线避开障碍与已放(后出场)猪的身体",
 *    且自身两个格子空闲;以 chainBias 概率把身体挡在某只"后出场猪"的射线上。
 * 4) 两阶段:后出场的猪放中间区、朝外;先出场的猪放外圈、朝外(点击即出)。
 */
function generateLevelOnce(cfg: GenConfig): Level {
  const rand = mulberry32(cfg.seed);
  // 每关一个"布局样式"(由种子确定,可复现):偏移中心 + 集中度 + 朝向模式
  const styleRand = mulberry32((cfg.seed ^ 0x9e3779b9) >>> 0);
  const maxOff = Math.min(4, (cfg.circleRadius ?? 14) * 0.28);
  const style = {
    offU: (styleRand() * 2 - 1) * maxOff,
    offV: (styleRand() * 2 - 1) * maxOff,
    bias: 0.6 + styleRand() * 1.2, // 0.6 较散 ~ 1.8 较聚
    pattern: cfg.pattern ?? 'outward',
  };
  const level: Level = {
    id: 0,
    width: cfg.width,
    height: cfg.height,
    pigs: [],
    obstacles: [],
  };
  const occupied = new Set<string>();
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < cfg.width && y < cfg.height;

  // 生成区:整体旋转 45° 后,在屏幕空间(u=x-y, v=x+y)裁剪。
  // 默认不裁剪(全棋盘);circleRadius = 圆;phoneAspect = 手机竖屏椭圆(铺满屏)。
  const cu = (cfg.width - cfg.height) / 2 + style.offU; // 中心点的 u = x - y
  const cv = (cfg.width + cfg.height - 2) / 2 + style.offV; // 中心点的 v = x + y
  const region = buildRegion(cfg.width, cfg.height, cu, cv, cfg);
  const inCircle = (x: number, y: number) => inRegion(region, x, y);
  const distEdge = (x: number, y: number) =>
    Math.min(x, y, cfg.width - 1 - x, cfg.height - 1 - y);
  // 中间区:有生成区 → 归一化半径≤0.55;无 → 距边≥2
  const isInner = (x: number, y: number) =>
    region.active ? inCircle(x, y) && regionRadius(region, x, y) <= 0.55 : distEdge(x, y) >= 2;
  // 外圈:有生成区 → 归一化半径>0.55;无 → 距边≤1
  const isOuter = (x: number, y: number) =>
    region.active ? inCircle(x, y) && regionRadius(region, x, y) > 0.55 : distEdge(x, y) <= 1;

  // 1) 不再生成障碍物

  const cellFree = (x: number, y: number) => inB(x, y) && !occupied.has(key(x, y));

  // 头部前方射线是否畅通
  const rayClear = (x: number, y: number, dir: Dir): boolean => {
    for (const c of rayCells(x, y, dir, cfg.width, cfg.height)) {
      if (occupied.has(key(c.x, c.y))) return false;
    }
    return true;
  };

  // 1×2 长猪能否以 (fx,fy) 为头、朝 dir 放置(两个身体格空闲 + 前向射线畅通)
  const pigPlaceable = (fx: number, fy: number, dir: Dir): boolean => {
    const d = DIR_VEC[dir];
    if (!cellFree(fx, fy) || !cellFree(fx - d.x, fy - d.y)) return false;
    // 只生成在"生成区"内:两个身体格都必须落在区里(不裁剪时恒真)
    if (region.active && (!inCircle(fx, fy) || !inCircle(fx - d.x, fy - d.y))) return false;
    return rayClear(fx, fy, dir);
  };

  // 距离最近边缘的格数(0 = 最外圈)
  // 把身体挡在某只已放(后出场)猪的射线上,使其"必须先走"
  const tryChain = (id: number, placed: Pig[]): Pig | null => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const j = placed[Math.floor(rand() * placed.length)];
      const cells = shuffle(rayCells(j.pos.x, j.pos.y, j.dir, cfg.width, cfg.height), rand);
      for (const c of cells) {
        if (!inCircle(c.x, c.y)) continue;
        if (occupied.has(key(c.x, c.y))) continue;
        for (const d of shuffle(DIRS, rand)) {
          const dv = DIR_VEC[d];
          if (pigPlaceable(c.x, c.y, d)) {
            return { id, pos: { x: c.x, y: c.y }, dir: d };
          }
          if (pigPlaceable(c.x + dv.x, c.y + dv.y, d)) {
            return { id, pos: { x: c.x + dv.x, y: c.y + dv.y }, dir: d };
          }
        }
      }
    }
    return null;
  };

  // 中间区放置:后出场的猪放中间、朝外
  const placeCenter = (id: number): Pig | null => {
    for (let t = 0; t < 300; t++) {
      const c = pickCell(rand, cfg.width, cfg.height, cu, cv, style.bias);
      if (!isInner(c.x, c.y)) continue;
      for (const dir of patternFirst(c.x, c.y, style.pattern, rand)) {
        if (pigPlaceable(c.x, c.y, dir)) return { id, pos: c, dir };
      }
    }
    for (let y = 0; y < cfg.height; y++) {
      for (let x = 0; x < cfg.width; x++) {
        if (!isInner(x, y)) continue;
        if (occupied.has(key(x, y))) continue;
        for (const dir of patternFirst(x, y, style.pattern, rand)) {
          if (pigPlaceable(x, y, dir)) return { id, pos: { x, y }, dir };
        }
      }
    }
    return null;
  };

  // 外圈放置:先出场的猪放外圈、朝外(路径直达边界,点击即出)
  const placeEdge = (id: number): Pig | null => {
    for (let t = 0; t < 150; t++) {
      const x = Math.floor(rand() * cfg.width);
      const y = Math.floor(rand() * cfg.height);
      if (!isOuter(x, y)) continue;
      for (const dir of patternFirst(x, y, style.pattern, rand)) {
        if (pigPlaceable(x, y, dir)) return { id, pos: { x, y }, dir };
      }
    }
    for (let y = 0; y < cfg.height; y++) {
      for (let x = 0; x < cfg.width; x++) {
        if (!isOuter(x, y)) continue;
        if (occupied.has(key(x, y))) continue;
        for (const dir of patternFirst(x, y, style.pattern, rand)) {
          if (pigPlaceable(x, y, dir)) return { id, pos: { x, y }, dir };
        }
      }
    }
    return null;
  };

  // 兜底:任意可放处
  const placeAnywhere = (id: number): Pig | null => {
    for (let y = 0; y < cfg.height; y++) {
      for (let x = 0; x < cfg.width; x++) {
        if (!inCircle(x, y)) continue;
        if (occupied.has(key(x, y))) continue;
        for (const d of DIRS) {
          if (pigPlaceable(x, y, d)) return { id, pos: { x, y }, dir: d };
        }
      }
    }
    return null;
  };

  // 2) 清场顺序
  const order = shuffle(Array.from({ length: cfg.pigs }, (_, i) => i), rand);

  // 3) 倒序放置
  const placed: Pig[] = [];
  const centerRatio = cfg.centerRatio ?? 0.72;
  const centerCount = Math.round(cfg.pigs * centerRatio);
  for (let i = cfg.pigs - 1; i >= 0; i--) {
    const id = order[i];
    const isCenter = i >= cfg.pigs - centerCount;
    let pig: Pig | null = null;
    if (isCenter) {
      pig = placeCenter(id);
      if (!pig) pig = placeAnywhere(id);
    } else {
      pig = rand() < cfg.chainBias && placed.length > 0 ? tryChain(id, placed) : null;
      if (!pig) pig = placeEdge(id);
      if (!pig) pig = placeAnywhere(id);
    }
    if (!pig) {
      throw new Error(`generateLevel 失败(seed=${cfg.seed}, pigs=${cfg.pigs}, obstacles=${cfg.obstacles})`);
    }
    const d = DIR_VEC[pig.dir];
    occupied.add(key(pig.pos.x, pig.pos.y));
    occupied.add(key(pig.pos.x - d.x, pig.pos.y - d.y));
    placed.push(pig);
    level.pigs.push(pig);
  }

  return level;
}

/**
 * 生成一关(带内部确定性重试):高密度下个别种子可能放不下最后几只猪,
 * 用 cfg.seed 派生的一组子种子逐个尝试;同一 cfg 永远得到同一结果(确定性)。
 */
export function generateLevel(cfg: GenConfig): Level {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return generateLevelOnce({ ...cfg, seed: cfg.seed + attempt * 104729 });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? new Error(`generateLevel 重试 10 次仍失败: ${lastErr.message}`)
    : new Error('generateLevel 重试 10 次仍失败');
}

/**
 * 之字形级联生成(硬关):
 * 从圆边界附近的格子开始,猪头一律朝向圆心;横着的猪,下一只生成竖着的,
 * 竖着的猪放在横猪的射线上"挡"住它,再下一只横的挡竖的…… 交替向圆心逼近。
 * 清场顺序由内向外:最靠近圆心的猪先跑出(射线穿过圆心到达对侧),然后一层层往外退。
 * 多列链尽量错开角度,避免在圆心互相对堵(求解器兜底,失败换相位重试)。
 */
export function generateCascadeLevel(cfg: GenConfig): Level {
  const rand = mulberry32(cfg.seed);
  const styleRand = mulberry32((cfg.seed ^ 0x9e3779b9) >>> 0);
  const style = {
    offU: (styleRand() * 2 - 1) * (cfg.circleRadius ?? 14) * 0.2,
    offV: (styleRand() * 2 - 1) * (cfg.circleRadius ?? 14) * 0.2,
  };
  const level: Level = {
    id: 0,
    width: cfg.width,
    height: cfg.height,
    pigs: [],
    obstacles: [],
  };
  const occupied = new Set<string>();
  const inB = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < cfg.width && y < cfg.height;
  const cu = (cfg.width - cfg.height) / 2 + style.offU;
  const cv = (cfg.width + cfg.height - 2) / 2 + style.offV;
  const region = buildRegion(cfg.width, cfg.height, cu, cv, cfg);
  const inCircle = (x: number, y: number) => inRegion(region, x, y);
  const free = (x: number, y: number) => inB(x, y) && !occupied.has(key(x, y));
  let pigId = 0;
  const centerX = (cv + cu) / 2; // 圆心 x
  const centerY = (cv - cu) / 2; // 圆心 y

  // 相邻行(列)朝向相反:行按 y 奇偶 →/←,列按 x 奇偶 ↓/↑
  const dirRow = (y: number): Dir => (y % 2 === 0 ? Dir.Right : Dir.Left);
  const dirCol = (x: number): Dir => (x % 2 === 0 ? Dir.Down : Dir.Up);

  const canPlace = (x: number, y: number, dir: Dir): boolean => {
    const d = DIR_VEC[dir];
    if (!inCircle(x, y) || !inCircle(x - d.x, y - d.y)) return false;
    if (!free(x, y) || !free(x - d.x, y - d.y)) return false;
    // 逆向生成:射线对"已放猪"畅通才放 → 保证必可解
    let nx = x + d.x;
    let ny = y + d.y;
    while (inB(nx, ny)) {
      if (occupied.has(key(nx, ny))) return false;
      nx += d.x;
      ny += d.y;
    }
    return true;
  };
  const place = (x: number, y: number, dir: Dir): void => {
    const d = DIR_VEC[dir];
    const pig: Pig = { id: pigId++, pos: { x, y }, dir };
    level.pigs.push(pig);
    occupied.add(key(x, y));
    occupied.add(key(x - d.x, y - d.y));
    if (cfg.onPlace) cfg.onPlace(level, pig);
  };

  // 候选行/列(圆内至少一个格)
  const rows: number[] = [];
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) if (inCircle(x, y)) { rows.push(y); break; }
  }
  const cols: number[] = [];
  for (let x = 0; x < cfg.width; x++) {
    for (let y = 0; y < cfg.height; y++) if (inCircle(x, y)) { cols.push(x); break; }
  }
  // 优先选中间的行列:行/列选取按"离圆心越近权重越高"采样
  const maxDY = Math.max(...rows.map((y) => Math.abs(y - centerY)));
  const maxDX = Math.max(...cols.map((x) => Math.abs(x - centerX)));
  const pickRow = (): number => {
    for (let t = 0; t < 40; t++) {
      const y = rows[Math.floor(rand() * rows.length)];
      const w = Math.pow(1 - Math.abs(y - centerY) / maxDY, 2);
      if (rand() < 0.5 + w * 0.5) return y;
    }
    return rows[Math.floor(rand() * rows.length)];
  };
  const pickCol = (): number => {
    for (let t = 0; t < 40; t++) {
      const x = cols[Math.floor(rand() * cols.length)];
      const w = Math.pow(1 - Math.abs(x - centerX) / maxDX, 2);
      if (rand() < 0.5 + w * 0.5) return x;
    }
    return cols[Math.floor(rand() * cols.length)];
  };

  // 同向同线间隔:该猪与同行/同列最近的一只同向猪之间,空位数 0~4(随机)
  // (同向猪各占 1 格身体,身体间空位数 = 头距 - 2)
  // 规则:若最近的两只同向猪彼此紧贴(间隔0),则新放的这只至少隔 1 格(避免三连贴)
  const gapOk = (x: number, y: number, dir: Dir): boolean => {
    let best = Infinity; // 最近同向猪头距
    let second = Infinity; // 与最近同侧的次近同向猪头距
    let bestSide = 0; // 最近那只的方向(+1 前 / -1 后)
    for (const p of level.pigs) {
      if (p.dir !== dir) continue;
      const sameLine =
        dir === Dir.Right || dir === Dir.Left ? p.pos.y === y : p.pos.x === x;
      if (!sameLine) continue;
      const diff =
        dir === Dir.Right ? p.pos.x - x :
        dir === Dir.Left ? x - p.pos.x :
        dir === Dir.Down ? p.pos.y - y : y - p.pos.y;
      const dist = Math.abs(diff);
      if (dist === 0) continue;
      if (dist < best) {
        second = best;
        best = dist;
        bestSide = Math.sign(diff);
      } else if (dist < second && Math.sign(diff) === bestSide) {
        second = dist;
      }
    }
    if (best === Infinity) return true;
    if (best - 2 > 4) return false; // 同向间隔超过 4 不行
    // 规则:最近两只同向猪彼此紧贴(头距2=间隔0),则本只至少隔1格(头距≥3)
    if (second !== Infinity && second - best === 2 && best < 3) return false;
    return true;
  };

  const tryRow = (y: number): boolean => {
    const dir = dirRow(y);
    let xs: number[] = [];
    for (let x = 0; x < cfg.width; x++) if (inCircle(x, y)) xs.push(x);
    if (dir === Dir.Right) {
      xs = xs.filter((x) => x < centerX).sort((a, b) => a - b);
    } else {
      xs = xs.filter((x) => x > centerX).sort((a, b) => b - a);
    }
    // 锚点 + 前一只:该行朝圆心方向最靠内的两只同向猪
    let anchor: number | null = null;
    let prev: number | null = null;
    for (const p of level.pigs) {
      if (p.dir !== dir || p.pos.y !== y) continue;
      if (dir === Dir.Right && p.pos.x < centerX) {
        if (anchor === null || p.pos.x > anchor) {
          prev = anchor;
          anchor = p.pos.x;
        } else if (prev === null || p.pos.x > prev) {
          prev = p.pos.x;
        }
      }
      if (dir === Dir.Left && p.pos.x > centerX) {
        if (anchor === null || p.pos.x < anchor) {
          prev = anchor;
          anchor = p.pos.x;
        } else if (prev === null || p.pos.x < prev) {
          prev = p.pos.x;
        }
      }
    }
    if (anchor === null) {
      // 无同向猪:靠近边界放
      for (const x of xs) if (canPlace(x, y, dir)) { place(x, y, dir); return true; }
      return false;
    }
    // 有锚点:随机 0~4 空格(从锚点往圆心方向)
    // 规则:锚点与它前一只紧贴(头距2=间隔0)→ 本只不能 g=0,至少隔1格
    const twoTouching =
      prev !== null &&
      (dir === Dir.Right ? anchor! - prev === 2 : prev - anchor! === 2);
    const offs = shuffle([0, 1, 2, 3, 4], rand);
    for (const g of offs) {
      if (twoTouching && g === 0) continue;
      const nx = dir === Dir.Right ? anchor + g + 2 : anchor - g - 2;
      if (nx < 0 || nx >= cfg.width || !inCircle(nx, y)) continue;
      if (dir === Dir.Right && nx >= centerX) continue; // 越过圆心不算朝圆心
      if (dir === Dir.Left && nx <= centerX) continue;
      if (canPlace(nx, y, dir)) { place(nx, y, dir); return true; }
    }
    // 0~4 都放不下 → 兜底:朝圆心侧随便放
    for (const x of xs) {
      if (!gapOk(x, y, dir)) continue;
      if (canPlace(x, y, dir)) { place(x, y, dir); return true; }
    }
    return false;
  };
  const tryCol = (x: number): boolean => {
    const dir = dirCol(x);
    let ys: number[] = [];
    for (let y = 0; y < cfg.height; y++) if (inCircle(x, y)) ys.push(y);
    if (dir === Dir.Down) {
      ys = ys.filter((y) => y < centerY).sort((a, b) => a - b);
    } else {
      ys = ys.filter((y) => y > centerY).sort((a, b) => b - a);
    }
    let anchor: number | null = null;
    for (const p of level.pigs) {
      if (p.dir !== dir || p.pos.x !== x) continue;
      if (dir === Dir.Down && p.pos.y < centerY) {
        if (anchor === null || p.pos.y > anchor) anchor = p.pos.y;
      }
      if (dir === Dir.Up && p.pos.y > centerY) {
        if (anchor === null || p.pos.y < anchor) anchor = p.pos.y;
      }
    }
    if (anchor === null) {
      for (const y of ys) if (canPlace(x, y, dir)) { place(x, y, dir); return true; }
      return false;
    }
    const offs = shuffle([0, 1, 2, 3, 4], rand);
    for (const g of offs) {
      const ny = dir === Dir.Down ? anchor + g + 2 : anchor - g - 2;
      if (ny < 0 || ny >= cfg.height || !inCircle(x, ny)) continue;
      if (dir === Dir.Down && ny >= centerY) continue;
      if (dir === Dir.Up && ny <= centerY) continue;
      if (canPlace(x, ny, dir)) { place(x, ny, dir); return true; }
    }
    for (const y of ys) {
      if (!gapOk(x, y, dir)) continue;
      if (canPlace(x, y, dir)) { place(x, y, dir); return true; }
    }
    return false;
  };

  // 轮流往不同的随机行列加猪:
  //  - 换随机行列,要求朝圆心,最多重试 10 次
  //  - 10 次后仍无位置,不要求朝圆心也保留(放上)
  //  - 连续 30 次无可添加位置 → 生成结束
  let step = 0;
  let failStreak = 0;
  while (failStreak < 30) {
    step++;
    const isRow = step % 2 === 1; // 轮流:行列交替
    let done = false;
    for (let r = 0; r < 10 && !done; r++) {
      done = isRow ? tryRow(pickRow()) : tryCol(pickCol());
    }
    for (let r = 0; r < 8 && !done; r++) {
      done = isRow ? tryRow(pickRow()) : tryCol(pickCol());
    }
    if (done) failStreak = 0;
    else failStreak++;
  }

  // 补满 pass:按"离圆心近→远"扫描,优先放"朝圆心"方向;
  // 若有猪头不朝圆心(非朝圆方向才放得下),整体坐标也尽量靠近圆心。
  let filled = true;
  const allCells: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) {
      if (inCircle(x, y)) {
        allCells.push({ x, y, d: Math.hypot(x - centerX, y - centerY) });
      }
    }
  }
  allCells.sort((a, b) => a.d - b.d);
  while (filled) {
    filled = false;
    for (const c of allCells) {
      if (filled) break;
      if (!free(c.x, c.y)) continue;
      // 朝圆心的方向优先
      const hdir: Dir | -1 = c.x < centerX ? Dir.Right : c.x > centerX ? Dir.Left : -1;
      const vdir: Dir | -1 = c.y < centerY ? Dir.Down : c.y > centerY ? Dir.Up : -1;
      const centerDirs: Dir[] = [hdir, vdir].filter((d) => d !== -1) as Dir[];
      const otherDirs = DIRS.filter((d) => !centerDirs.includes(d));
      for (const d of [...centerDirs, ...otherDirs]) {
        if (!gapOk(c.x, c.y, d)) continue; // 补满也遵守间隔(不紧贴、同向 1~3)
        if (canPlace(c.x, c.y, d)) {
          place(c.x, c.y, d);
          filled = true;
          break;
        }
      }
    }
  }

  return level;
}

export interface LevelMetrics {
  solvable: boolean;
  /** 贪心过程每一步"可点猪数量"的最小值(越小越难) */
  minClear: number;
  /** 平均可点数量(越大越容易) */
  avgClear: number;
  /** 最长依赖链长度 */
  chainLength: number;
  order: number[];
}

/** 求解器实测难度指标(给 P3 难度排序用的客观输入)。 */
export function measureLevel(level: Level): LevelMetrics {
  const pigs = level.pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  const clearCounts: number[] = [];
  const order: number[] = [];

  while (pigs.length > 0) {
    const st = new GameState(level);
    st.pigs = pigs;
    const clear = pigs.filter((p) => st.canExit(p));
    clearCounts.push(clear.length);
    if (clear.length === 0) {
      return { solvable: false, minClear: 0, avgClear: 0, chainLength: 0, order };
    }
    const pick = clear[0];
    order.push(pick.id);
    pigs.splice(pigs.indexOf(pick), 1);
  }

  return {
    solvable: true,
    minClear: Math.min(...clearCounts),
    avgClear: clearCounts.reduce((s, c) => s + c, 0) / clearCounts.length,
    chainLength: longestDependencyChain(level),
    order,
  };
}

/**
 * 多维难度分:求解器实测(可点数/依赖链)+ 猪数/障碍。
 * 越大越难。用于几千关的"难度单调递增"排序。
 */
export function difficultyScore(level: Level): number {
  const m = measureLevel(level);
  if (!m.solvable) return Number.POSITIVE_INFINITY;
  const pigF = level.pigs.length;
  const clearF = 1 / Math.max(1, m.avgClear); // 平均可点越少 → 越难
  const minF = 1 / Math.max(1, m.minClear); // 最小可点越少 → 越难
  const chainF = m.chainLength;
  const obsF = level.obstacles.length;
  return pigF + clearF * 60 + minF * 20 + chainF * 5 + obsF * 2;
}

/**
 * 填洞后处理:猪簇中间常出现连续空格(密度没填满)。
 * 对每个"中间空洞"(周围猪≥3)尝试按 4 个朝向插入 1×2 长猪;
 * 只保留"插入后可解"的,并且选让"最长依赖链"最长的那个朝向 ——
 * 既增加猪数与密度,又拉长依赖链、提高难度。
 */
export function fillHoles(level: Level, maxInsert = 8): Level {
  const result: Level = {
    id: level.id,
    width: level.width,
    height: level.height,
    pigs: level.pigs.map((p) => ({ ...p, pos: { ...p.pos } })),
    obstacles: level.obstacles.map((o) => ({ pos: { ...o.pos } })),
  };
  const inB = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < level.width && y < level.height;
  const occ = new Set<string>();
  for (const p of result.pigs) {
    const d = DIR_VEC[p.dir];
    occ.add(key(p.pos.x, p.pos.y));
    occ.add(key(p.pos.x - d.x, p.pos.y - d.y));
  }
  for (const o of result.obstacles) occ.add(key(o.pos.x, o.pos.y));

  const occNeighbors = (x: number, y: number): number => {
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inB(nx, ny) && occ.has(key(nx, ny))) n++;
      }
    }
    return n;
  };

  let inserted = 0;
  let nextId = result.pigs.length;
  outer: for (let y = 0; y < level.height && inserted < maxInsert; y++) {
    for (let x = 0; x < level.width && inserted < maxInsert; x++) {
      if (occ.has(key(x, y))) continue;
      if (occNeighbors(x, y) < 3) continue; // 只填"中间被包围"的洞
      let best: { dir: Dir; chain: number } | null = null;
      for (const d of DIRS) {
        const dv = DIR_VEC[d];
        const tx = x - dv.x; // 尾部格
        const ty = y - dv.y;
        if (!inB(tx, ty) || occ.has(key(tx, ty))) continue;
        if (occNeighbors(tx, ty) < 2) continue;
        // 试放:验证可解,并测量最长依赖链,选链最长的方向
        const cand = { ...result, pigs: [...result.pigs, { id: nextId, pos: { x, y }, dir: d }] };
        if (!measureLevel(cand).solvable) continue;
        const chain = longestDependencyChain(cand);
        if (!best || chain > best.chain) best = { dir: d, chain };
      }
      if (best) {
        result.pigs.push({ id: nextId, pos: { x, y }, dir: best.dir });
        occ.add(key(x, y));
        occ.add(key(x - DIR_VEC[best.dir].x, y - DIR_VEC[best.dir].y));
        inserted++;
        nextId++;
        continue outer;
      }
    }
  }
  // 重排 id 连续(0..N-1)
  result.pigs.forEach((p, i) => {
    p.id = i;
  });
  return result;
}

/** 依赖图最长链:a 依赖 b <=> b 的身体位于 a 的前向射线上。图是 DAG。 */
export function longestDependencyChain(level: Level): number {
  const n = level.pigs.length;
  if (n === 0) return 0;
  const pigAt = new Map<string, number>();
  for (const p of level.pigs) {
    const d = DIR_VEC[p.dir];
    pigAt.set(key(p.pos.x, p.pos.y), p.id);
    pigAt.set(key(p.pos.x - d.x, p.pos.y - d.y), p.id);
  }

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const a of level.pigs) {
    for (const c of rayCells(a.pos.x, a.pos.y, a.dir, level.width, level.height)) {
      const b = pigAt.get(key(c.x, c.y));
      if (b !== undefined && b !== a.id) adj[a.id].push(b);
    }
  }

  const memo = new Array<number>(n).fill(-1);
  const inStack = new Uint8Array(n);
  const visit = (u: number): number => {
    if (memo[u] >= 0) return memo[u];
    if (inStack[u]) return 1; // 环:依赖图里有相向互堵(陷阱),按链长 1 计,避免无限递归
    inStack[u] = 1;
    let best = 1;
    for (const v of adj[u]) best = Math.max(best, 1 + visit(v));
    inStack[u] = 0;
    memo[u] = best;
    return best;
  };
  let max = 0;
  for (let u = 0; u < n; u++) max = Math.max(max, visit(u));
  return max;
}

/** 一关的占用格集合(猪两格 + 障碍),用于查重。 */
export function levelCells(level: Level): Set<string> {
  const s = new Set<string>();
  for (const o of level.obstacles) s.add(key(o.pos.x, o.pos.y));
  for (const p of level.pigs) {
    const d = DIR_VEC[p.dir];
    s.add(key(p.pos.x, p.pos.y));
    s.add(key(p.pos.x - d.x, p.pos.y - d.y));
  }
  return s;
}

export interface DedupOptions {
  /** 与最近若干关占用格 Jaccard 相似度超过该值 → 视为雷同,跳过 */
  maxJaccard: number;
  /** 与最近多少个已保留关比较 */
  window: number;
}

/**
 * 生成后查重(保持传入顺序,通常是"按难度升序"排好的):
 * 1) 精确重复(占用格集合完全一致)直接跳过;
 * 2) 与最近 window 关的占用格 Jaccard 相似度 > maxJaccard → 跳过(雷同)。
 * 返回去重后的关卡。
 */
export function dedupLevels(levels: readonly Level[], opts: DedupOptions): Level[] {
  const exact = new Set<string>();
  const recent: { cells: Set<string>; pigCount: number }[] = [];
  const out: Level[] = [];
  for (const lv of levels) {
    const cells = levelCells(lv);
    const canon = [...cells].sort().join('|');
    if (exact.has(canon)) continue;
    exact.add(canon);
    let near = false;
    for (const r of recent) {
      // 猪数差太多不可能雷同,跳过比较
      if (Math.abs(r.pigCount - lv.pigs.length) > 4) continue;
      let inter = 0;
      for (const k of cells) if (r.cells.has(k)) inter++;
      const union = r.cells.size + cells.size - inter;
      if (union > 0 && inter / union > opts.maxJaccard) {
        near = true;
        break;
      }
    }
    if (near) continue;
    recent.push({ cells, pigCount: lv.pigs.length });
    if (recent.length > opts.window) recent.shift();
    out.push(lv);
  }
  return out;
}
