# 「猪了个猪」同类游戏 & 开源算法调研（10 个素材）

日期: 2026-08-17

目标：为「猪了个猪」（1×2 猪、固定单向滑出、撞停/出界、全部滑出）找可借鉴的
同类游戏 + 开源生成器/求解器，共 10 个。按三类分：A. 同类游戏参考、B. 开源求解
算法、C. 关卡生成思路。

## A. 同类游戏参考（建议亲手玩一遍感受手感/关卡结构）

### 1. WodBlox（网页）— Rush Hour 克隆
- 链接: https://4-win.com/wodblox/ 或 https://yaksgames.com/games/wodblox/G06ACCE2FE
- 玩法: 45 关，滑动木块给绿色块让出出口（Rush Hour 思路）。
- 借鉴: 关卡手工设计的手感，小棋盘上"只要一步对就全通"的爽感。可参考它关卡
  的对称/环状布局审美。

### 2. Block Way Out / Move the Block / Unblock Me / Parking Jam（App）
- 链接: 各大商店搜索即可（Unblock Me: https://unblockme.kiragames.com/）
- 玩法: 经典挪车，块可双向滑动，红块到出口。
- 借鉴: 跟 4399 猪Run 同源玩法；看它的"看似挤满其实一条链"的关卡布局。

### 3. IceMaze / Slipslide / 冰面滑行游戏（撞停机制一致）
- 链接: 搜索 "Ice Sliding Puzzle game" / "Frogger Ice Maze"
- 玩法: 角色/冰块在冰面上一直滑到障碍才停——和你的猪"撞停"机制完全一致。
- 借鉴: 冰面谜题的关键设计——**目标格/障碍的位置决定了滑行轨道的长度和方向**，
  可用来生成"滑过整段才停"的长链。

### 4. Permafrost-Slide-Puzzle（Godot 开源，填满格子版）
- 链接: https://github.com/lone-llama-workshop/Permafrost-Slide-Puzzle
- 玩法: 滑冰填满所有格子，不能穿过已填格/障碍，规划路线覆盖全图。
- 借鉴: "轨道不可重复经过"= 方向依赖图是**有向无环**的，和你的"后出场猪不能被
  先出场猪挡"是同一类约束，可对比它如何保证不卡死。

### 5. 华容道 / Klotski（挪 2×2 曹操 + 1×2 兵）
- 链接: https://github.com/SimonHung/Klotski（JS 版华容道 + 求解器）
- 玩法: 方块双向滑动，目标把 2×2 大块移到出口。
- 借鉴: 华容道的"关键块 + 挡路块"结构，多块围绕一个关键位互锁，正是你想要
  "多重陷阱"的直观教材。

## B. 开源求解算法（把"验证可解 + 量化难度"做快做强）

### 6. hellpig/unblock-car-puzzle-solver（C++）
- 链接: https://github.com/hellpig/unblock-car-puzzle-solver
- 玩法: Unblock Me 求解器 + 动画。
- 借鉴: hash 表优化的 BFS；如何定义/统计"步数"来量化难度（最少步 = 难度下限）。
  你的 `measureLevel` 可对比其状态编码方式，看能否更快。

### 7. fogleman/rush（Go，已用在你项目）
- 链接: https://github.com/fogleman/rush
- 玩法: Rush Hour 求解/渲染/生成；官网 https://www.michaelfogleman.com/rush/
  有 2,577,412 谜题全量数据库（你已提取 190 张转 178 关）。
- 借鉴: 生成思路 = 枚举 + cluster 去重 + **Unsolved**（从等价状态簇里挑最难布局）
  + **Minimal**（生成后尝试删块，删掉不改变解的就去掉）。

### 8. 其他 Rush Hour / 15-puzzle 求解器（A*/IDA* 思路）
- 链接: 如 `Ohohcakester/Ice-Sliding-Puzzle`（C 版生成器+求解器+玩家，
  https://github.com/Ohohcakester/Ice-Sliding-Puzzle）
- 借鉴: IDA* + 启发式（如"阻塞最少步下界"）在滑块谜题上很成熟；如果以后
  想测"最少清场步数"来排难度，A*/IDA* 是比 BFS 更快的方向。

## C. 关卡生成思路（对你生成器最有用，重点看）

### 9. 反向构造（StackOverflow 经典方法）— 和你"逆向圆心生成"异曲同工
- 链接: https://stackoverflow.com/questions/3349318/unblock-me-level-generator/3349384
- 思路: **从终局（红车已在出口、其余随机摆放）开始，随机走 100 万步可行移动，
  走出来的混乱布局 = 新关卡**，天生必解。
- 对比: 你现在是"先定清场顺序 → 倒序放置"；反向随机走是另一条保证必解的路，
  可做混合（走 N 步后退化 + 保证依赖链）。

### 10. 两个高价值生成器

#### 10a. kristomu/zzt-puzzle（ZZT 滑块生成器，⭐ 最值得参考）
- 链接: https://github.com/kristomu/zzt-puzzle
- 思路: **grow-board** —— 从空盘开始逐步加障碍/块，直到再加任何一块就不可解，
  得到"满密度但难解"的盘。用 min-max 搜索 + transposition table 验证。
- 借鉴: 这正是你要的"密度最大化但不破坏唯一解链"；说明里提到 ZZT 滑块是
  NP-hard / PSPACE-complete，解释了为什么验证是生成瓶颈。

#### 10b. martius-lab/puzzlegen（IceSlider RL 环境，NeurIPS 论文附）
- 链接: https://github.com/martius-lab/puzzlegen
- 思路: 把"滑到最近障碍才停"封装成 RL 环境（动作→滑行），可批量生成/训练
  求解器（PPGS 仓库配套 https://github.com/martius-lab/PPGS）。
- 借鉴: 若想用**学习型求解器**替代 BFS 做大规模验证（你接受 2 小时生成），
  这是现成环境。

#### 10c.（补充）MPewsey/Aycblok（C# 冰滑推块生成器，文档全）
- 链接: https://github.com/MPewsey/Aycblok （在线示例 https://mpewsey.github.io/Aycblok/）
- 思路: 程序化生成冰滑推块（推到障碍/停止块/其他块才停），有完整文档，
  目标=把推块全部推上目标格。
- 借鉴: 它处理"推块链"（一个块撞另一个块）的建模，可以类比你的"猪挡猪"依赖链。

## 四个最值得立刻抄进 `src/core/generator.ts` 的思路

1. **反向随机走**（#9）——从清空终局反向打乱，和你现在的逆向圆心生成互补，
   可让布局更"乱而必解"。
2. **grow-board**（#10a）——从空盘加猪/障碍直到不可解，保证高密度 + 高难度，
   解决你"填充猪太多太简单"的问题。
3. **Minimal 后处理**（#7）——生成后逐只删猪，删掉不改变解的就去掉，
   剔除冗余填充猪，把"纯陷阱密度"提上来。
4. **Unsolved / 最少步数**（#7、#6）——用最少清场步数或"必须按序"链长做难度
   排序，挑出最难的布局。

## 已验证链接清单（可直接访问）
- https://github.com/kristomu/zzt-puzzle
- https://github.com/martius-lab/puzzlegen
- https://github.com/Ohohcakester/Ice-Sliding-Puzzle
- https://github.com/MPewsey/Aycblok
- https://github.com/hellpig/unblock-car-puzzle-solver
- https://github.com/Eric0627/Sliding_Puzzle_Generator
- https://github.com/SimonHung/Klotski
- https://github.com/armadillojoe/LevelGenerator
- https://github.com/fogleman/rush
- https://github.com/lone-llama-workshop/Permafrost-Slide-Puzzle
- https://stackoverflow.com/questions/3349318/unblock-me-level-generator/3349384
