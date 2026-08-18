# Rush Hour 开源关卡集(提取 + 转换到「猪了个猪」)

数据来源:
- 经典 40 关: ThinkFun「Rush Hour」官方谜题(来自 github.com/fogleman/rush 的 cmd/forty)
- 最难 150 关: 全量数据库(2,577,412 个"有趣"6x6 谜题)按最少步数排序的 Top150,
  来自 https://www.michaelfogleman.com/rush/ 的 rush1000.txt

## 文件
| 文件 | 内容 |
|------|------|
| `rush_maps.json` | 190 张地图:来源、RushHour 最少步数、车辆/墙、转换后的猪关卡、依赖链长 |
| `converted_playable.json` | 178 个可玩关卡,直接是 `levels.json` 紧凑格式 `{w,h,pigs,obs}` |
| `rush_hour_gallery.html` | 自包含画廊:上一关/下一关浏览(或键盘 ←→),左侧原始棋盘,右侧猪转换版 |
| `rush40_ascii.json` | 经典 40 关原始 ASCII |
| `../README.md` | 上层(4399版等)调研总览 |

## 玩法差异(重要)
- Rush Hour: 车可前后滑动,目标=红车 A 移到右边界;有 2 格车和 3 格卡车。
- 猪了个猪(你的): 猪固定单向滑出,目标是**全部猪滑出**;引擎只支持 1×2。
- 转换做法: 丢弃 3 格卡车,给每辆 2 格车指派一个固定滑出方向(红车 A 强制向右,
  其余枚举 2 种方向),用你游戏同款贪心可解性验证,取"依赖链最长"的方向组合。
- 因此转换版是"只含 2 格车"的适配版,比原版简单;卡车的互锁结构没保留。

## 如何导入你的游戏
把 `converted_playable.json` 的内容拼进 `public/levels/levels.json` 即可
(注意这些是 6x6 小棋盘,与你 36x36 大关风格不同,建议作为独立"经典模式"关卡集)。
已用你项目自己的 `measureLevel` 验证:178/178 全部可解,minClear=1(有顺序要求),
依赖链最长 11。
