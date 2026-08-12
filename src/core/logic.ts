import { DIR_VEC, Level, Pig, Vec } from './types';

/** 一只猪在某个静止棋盘状态下的"可达终点"。 */
export interface TapResult {
  /** true = 跑出棋盘(消除) */
  exited: boolean;
  /** 未跑出时的停靠点 */
  target?: Vec;
  /** 被什么挡住:另一只猪 或 障碍物(用于回弹效果) */
  blockedBy?: 'pig' | 'obstacle';
}

/**
 * 游戏运行时状态。
 *
 * 猪是 1×2 长猪:pos = 头部(朝向方向的前格),身体覆盖 pos 与 pos - 朝向。
 * 移动为上下左右(棋盘整体旋转 45° 显示)。
 *
 * 无死局推演不变:
 * - 猪只在点击时沿朝向直线滑动,撞到别的猪/障碍则停下,不推动前方;
 * - 消除一只猪只减少障碍、绝不增加障碍 => 玩家操作不会制造死局;
 * - 关卡可解 <=> 贪心模拟:反复清掉任意一只"路径畅通"的猪,直到清空。
 */
export class GameState {
  readonly level: Level;
  pigs: Pig[];
  /** 已消耗的点击次数(含无效点击,用于星级:浪费步数 = taps - 初始猪数) */
  taps = 0;

  constructor(level: Level) {
    this.level = level;
    this.pigs = level.pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  }

  static clonePigs(pigs: Pig[]): Pig[] {
    return pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.level.width && y < this.level.height;
  }

  obstacleAt(x: number, y: number): boolean {
    return this.level.obstacles.some((o) => o.pos.x === x && o.pos.y === y);
  }

  pigAt(x: number, y: number, ignoreId?: number): Pig | undefined {
    return this.pigs.find((p) => p.id !== ignoreId && this.pigBodyCovers(p, x, y));
  }

  /** 长猪身体覆盖的两个格子:pos(头)与 pos - 朝向(尾)。 */
  pigBody(pig: Pig): Vec[] {
    const d = DIR_VEC[pig.dir];
    return [pig.pos, { x: pig.pos.x - d.x, y: pig.pos.y - d.y }];
  }

  pigBodyCovers(pig: Pig, x: number, y: number): boolean {
    const d = DIR_VEC[pig.dir];
    return (pig.pos.x === x && pig.pos.y === y) || (pig.pos.x - d.x === x && pig.pos.y - d.y === y);
  }

  /** 某格是否被阻挡(障碍 或 其他猪)。 */
  blocked(x: number, y: number, ignoreId?: number): boolean {
    return this.obstacleAt(x, y) || !!this.pigAt(x, y, ignoreId);
  }

  /**
   * 沿朝向(上/下/左/右)直线滑动:
   * - 头部前方畅通直达边界 => 跑出棋盘(exited = true)
   * - 头部前方被挡 => 停在阻挡者前一格
   */
  slideTarget(pig: Pig): TapResult {
    const d = DIR_VEC[pig.dir];
    let x = pig.pos.x; // 头部格
    let y = pig.pos.y;
    while (true) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (!this.inBounds(nx, ny)) {
        return { exited: true }; // 出界 => 跑出
      }
      if (this.blocked(nx, ny, pig.id)) {
        const byObstacle = this.obstacleAt(nx, ny);
        return {
          exited: false,
          target: { x, y },
          blockedBy: byObstacle ? 'obstacle' : 'pig',
        }; // 撞停
      }
      x = nx;
      y = ny;
    }
  }

  /** 路径畅通,可以直接跑出去? */
  canExit(pig: Pig): boolean {
    return this.slideTarget(pig).exited;
  }

  /** 是否还有任何一只猪路径畅通(存在可推进的合法操作)。 */
  hasAvailableMove(): boolean {
    return this.pigs.some((p) => this.canExit(p));
  }

  /** 点击一只猪并更新状态。 */
  tap(pigId: number): TapResult {
    const pig = this.pigs.find((p) => p.id === pigId);
    if (!pig) {
      return { exited: false };
    }
    this.taps++;
    const r = this.slideTarget(pig);
    if (r.exited) {
      this.pigs = this.pigs.filter((p) => p.id !== pigId);
    } else if (r.target) {
      pig.pos = r.target;
    }
    return r;
  }

  /** 掉头道具:把一只猪的朝向反转 180°(上↔下,左↔右)。 */
  reverse(pigId: number): void {
    const pig = this.pigs.find((p) => p.id === pigId);
    if (pig) {
      const d = DIR_VEC[pig.dir];
      // 头部移到原来的尾部格 → 反转后身体仍覆盖原来的两个格子
      pig.pos = { x: pig.pos.x - d.x, y: pig.pos.y - d.y };
      pig.dir = ((pig.dir + 2) % 4) as typeof pig.dir;
    }
  }

  /** 抓走道具:直接移除一只猪(不计步数)。移除只减少障碍,不破坏可解性。 */
  removePig(pigId: number): void {
    this.pigs = this.pigs.filter((p) => p.id !== pigId);
  }

  /** 提示道具:当前局面里任意一只"路径畅通"的猪(贪心下一步)。 */
  hint(): Pig | undefined {
    return this.pigs.find((p) => this.canExit(p));
  }

  cleared(): boolean {
    return this.pigs.length === 0;
  }

  /**
   * 贪心可解性验证:
   * 反复寻找"路径畅通"的猪并移除,若能清空 => 可解;否则在某一步没有畅通猪 => 不可解(死局)。
   * 复杂度 O(n^3) 上限,关卡规模很小,毫秒级完成。
   */
  static solve(level: Level): { solvable: boolean; order: number[] } {
    const pigs = GameState.clonePigs(level.pigs);
    const order: number[] = [];
    while (pigs.length > 0) {
      const state = new GameState(level);
      state.pigs = pigs;
      const next = pigs.find((p) => state.canExit(p));
      if (!next) {
        return { solvable: false, order };
      }
      order.push(next.id);
      pigs.splice(pigs.indexOf(next), 1);
    }
    return { solvable: true, order };
  }
}

/** 星级:恰好 N 次(全清 = 每点必消除)3星;浪费1步 2星;其余 1星。 */
export function starsFor(level: Level, taps: number): number {
  const wasted = taps - level.pigs.length;
  if (wasted <= 0) return 3;
  if (wasted === 1) return 2;
  return 1;
}
