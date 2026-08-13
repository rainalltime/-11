// 滑动感知求解器:猪可以"滑动到停"或"滑出棋盘",BFS 判断可解性。
// 用于验证陷阱模块:钥匙先动可解、诱饵先动死锁。
import { DIR_VEC, Dir } from './types';

export interface SPig {
  id: number;
  pos: { x: number; y: number };
  dir: Dir;
}

function stateKey(pigs: SPig[]): string {
  return pigs
    .map((p) => `${p.pos.x},${p.pos.y},${p.dir}`)
    .sort()
    .join('|');
}

function occSet(pigs: SPig[], ignoreId: number): Set<string> {
  const s = new Set<string>();
  for (const q of pigs) {
    if (q.id === ignoreId) continue;
    const d = DIR_VEC[q.dir];
    s.add(`${q.pos.x},${q.pos.y}`);
    s.add(`${q.pos.x - d.x},${q.pos.y - d.y}`);
  }
  return s;
}

export function slide(pig: SPig, pigs: SPig[], w: number, h: number): { exited: boolean; pos?: { x: number; y: number } } {
  const occ = occSet(pigs, pig.id);
  const d = DIR_VEC[pig.dir];
  let x = pig.pos.x;
  let y = pig.pos.y;
  while (true) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return { exited: true };
    if (occ.has(`${nx},${ny}`)) return { exited: false, pos: { x, y } };
    x = nx;
    y = ny;
  }
}

/** BFS 滑动求解(节点上限防状态爆炸)。 */
export function solvableWithSlides(pigs: SPig[], w: number, h: number, nodeLimit = 300000): boolean {
  const start = pigs.map((p) => ({ ...p, pos: { ...p.pos } }));
  if (start.length === 0) return true;
  const q: SPig[][] = [start];
  const seen = new Set<string>([stateKey(start)]);
  let nodes = 0;
  while (q.length) {
    const cur = q.shift()!;
    if (++nodes > nodeLimit) return false;
    for (const pig of cur) {
      const r = slide(pig, cur, w, h);
      if (r.exited) {
        const next = cur.filter((p) => p.id !== pig.id);
        if (next.length === 0) return true;
        const k = stateKey(next);
        if (!seen.has(k)) {
          seen.add(k);
          q.push(next);
        }
      } else if (r.pos) {
        const next = cur.map((p) => (p.id === pig.id ? { ...p, pos: { x: r.pos!.x, y: r.pos!.y } } : p));
        const k = stateKey(next);
        if (!seen.has(k)) {
          seen.add(k);
          q.push(next);
        }
      }
    }
  }
  return false;
}

/** 模拟"移动一只猪"(全滑)后的状态。 */
export function movePigOnce(pigs: SPig[], id: number, w: number, h: number): SPig[] {
  const pig = pigs.find((p) => p.id === id)!;
  const r = slide(pig, pigs, w, h);
  if (r.exited) return pigs.filter((p) => p.id !== id);
  if (r.pos) return pigs.map((p) => (p.id === id ? { ...p, pos: { x: r.pos!.x, y: r.pos!.y } } : p));
  return pigs;
}
