// 可视化单步调试关卡生成过程。
// 用法:npx tsx tools/gen-visual.ts [--seed 20390001] [--pigs 0] [--auto] [--radius 14] [--width 24] [--height 32]
//  回车 = 下一步 | a = 自动播放 | q = 退出 | h = 帮助
// 显示的是"逻辑棋盘"(未旋转 45°),箭头 = 猪头,∘ = 猪尾。
import { readSync } from 'node:fs';
import { generateCascadeLevel, measureLevel, longestDependencyChain } from '../src/core/generator.ts';
import { DIR_VEC, Dir, Level, Pig } from '../src/core/types.ts';

function parseArgs(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) out[a[i].replace(/^--?/, '')] = a[i + 1] ?? '';
  return out;
}

const args = parseArgs();
const seed = Number(args.seed ?? 20390001);
const pigs = Number(args.pigs ?? 0);
const radius = Number(args.radius ?? 14);
const width = Number(args.width ?? 24);
const height = Number(args.height ?? 32);
let auto = !!args.auto;
const ARROWS = ['↑', '→', '↓', '←'];

function render(level: Level): void {
  const grid: string[][] = Array.from({ length: level.height }, () => Array(level.width).fill('·'));
  for (const o of level.obstacles) grid[o.pos.y][o.pos.x] = '█';
  for (const p of level.pigs) {
    const d = DIR_VEC[p.dir];
    if (grid[p.pos.y - d.y][p.pos.x - d.x] === '·') {
      grid[p.pos.y - d.y][p.pos.x - d.x] = '∘';
    }
  }
  for (const p of level.pigs) grid[p.pos.y][p.pos.x] = ARROWS[p.dir];
  console.log(grid.map((r) => r.join('')).join('\n'));
}

// 阻塞读一个键(需要 TTY);失败则自动播放
function waitKey(): string {
  try {
    const buf = Buffer.alloc(1);
    readSync(0, buf, 0, 1);
    return buf.toString('utf8');
  } catch {
    return 'a';
  }
}

class QuitError extends Error {}
let quit = false;

console.log(`种子 ${seed} | 棋盘 ${width}x${height} | 圆心半径 ${radius} | 回车=下一步 a=自动 q=退出`);
console.log('(显示逻辑棋盘未旋转:箭头=猪头, ∘=猪尾)');

try {
  const lv = generateCascadeLevel({
    seed,
    width,
    height,
    pigs,
    obstacles: 0,
    chainBias: 0.5,
    centerRatio: 0.8,
    circleRadius: radius,
    onPlace: (level: Level, pig: Pig) => {
      if (quit) return;
      process.stdout.write('\x1b[2J\x1b[H');
      console.log(`═══ 第 ${level.pigs.length} 只猪 ═══`);
      console.log(`刚放: id=${pig.id} at(${pig.pos.x},${pig.pos.y}) 头朝${ARROWS[pig.dir]}`);
      console.log('');
      render(level);
      console.log('');
      if (auto) {
        const t0 = Date.now();
        while (Date.now() - t0 < 80) {
          /* 小延时 */
        }
        return;
      }
      const k = waitKey().toLowerCase();
      if (k === 'q') throw new QuitError('quit');
      if (k === 'a') auto = true;
      if (k === 'h') {
        console.log('回车=下一步 | a=自动播放 | q=退出\n');
        waitKey();
      }
    },
  });
  if (!quit) {
    process.stdout.write('\x1b[2J\x1b[H');
    console.log('═══ 生成完成 ═══');
    render(lv);
    const m = measureLevel(lv);
    console.log('');
    console.log(
      `猪 ${lv.pigs.length} | 可解 ${m.solvable} | 最长依赖链 ${longestDependencyChain(lv)} | ` +
        `每步可点均 ${m.avgClear.toFixed(1)} | 最小可点 ${m.minClear}`,
    );
    console.log('(每步可点数越小越难;想更简单就加猪/放松间隔,想更难就减间隔/加阻挡)');
  }
} catch (e) {
  if (!(e instanceof QuitError)) throw e;
  console.log('\n已退出(q)');
}
