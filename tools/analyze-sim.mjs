// 分析 levels.json 里相邻(难度序)关卡之间的占用格 Jaccard 相似度分布
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] ?? 'public/levels/levels.json');
const levels = JSON.parse(readFileSync(file, 'utf-8'));

function cellsOf(c) {
  const s = new Set();
  for (const [x, y] of c.obs) s.add(x + ',' + y);
  for (const [x, y] of c.pigs) s.add(x + ',' + y);
  for (const [x, y, d] of c.pigs) {
    if (d === 0) s.add(x + ',' + (y - 1)); // Up
    else if (d === 1) s.add((x - 1) + ',' + y); // Right
    else if (d === 2) s.add(x + ',' + (y + 1)); // Down
    else s.add((x + 1) + ',' + y); // Left
  }
  return s;
}

const sigs = levels.map(cellsOf);
function jaccard(a, b) {
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 1;
}

// 1) 相邻关(难度序)的相似度
const adj = [];
for (let i = 1; i < sigs.length; i++) adj.push(jaccard(sigs[i - 1], sigs[i]));
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * p)];
};
console.log(`相邻关 Jaccard: 平均 ${avg(adj).toFixed(3)} | p50 ${pct(adj, 0.5).toFixed(3)} | p90 ${pct(adj, 0.9).toFixed(3)} | 最大 ${Math.max(...adj).toFixed(3)}`);

// 2) 滑动窗口(前40)内最大相似度
let high = 0;
for (let i = 1; i < sigs.length; i++) {
  let best = 0;
  for (let j = Math.max(0, i - 40); j < i; j++) best = Math.max(best, jaccard(sigs[i], sigs[j]));
  if (best > high) high = best;
}
console.log(`滑动窗口40内的最大相似度: ${high.toFixed(3)}`);

// 3) 超过各阈值的相邻关对数
for (const t of [0.5, 0.6, 0.7, 0.8, 0.9]) {
  console.log(`相邻关 Jaccard > ${t}: ${adj.filter((x) => x > t).length} 对`);
}
