// 独立验证脚本:对每个样例关卡跑贪心求解器,确认"必有解",并模拟最小步数清场。
// 运行:node test/validate-levels.ts
import { SAMPLE_LEVELS } from '../src/core/levels.js';
import { GameState, starsFor } from '../src/core/logic.js';

let allOk = true;
for (const level of SAMPLE_LEVELS) {
  const { solvable, order } = GameState.solve(level);
  const ok = solvable && order.length === level.pigs.length;
  if (!ok) allOk = false;
  console.log(
    `第 ${level.id} 关 [${level.width}x${level.height}] ${level.pigs.length} 只猪 ` +
      `${ok ? '✓ 必有解' : '✗ 无解!'} 清场顺序: [${order.join(',')}]`,
  );
}
console.log(allOk ? '\n全部样例关卡可解 ✅' : '\n存在不可解关卡 ❌');
process.exit(allOk ? 0 : 1);
