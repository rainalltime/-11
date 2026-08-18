# 网上「猪了个猪」版本调研 + 地图提取记录

日期: 2026-08-17

## 结论先行

网上能搜到的「猪了个猪」绝大多数是**羊了个羊式三消**(点3个相同消除),
和本项目(挪车/Rush Hour 式滑动)玩法不同。
**唯一玩法一致的是 4399 的 H5 版**,但它的关卡地图是运行时从服务器加载的
(Unity WebGL + Addressables + flysheeep 后端),无法直接导出单关地图。

## 各版本一览

### 1. 4399「猪了个猪」(游戏ID 253053) —— 玩法与本项目一致 ✅
- 地址: https://www.4399.com/flash/253053.htm
- 技术栈: Unity WebGL 游戏 "PigRun"(厂商 tqkj / flysheeep)
- 游戏文件:
  - 入口壳: https://sda.4399.com/4399swf/upload_swf/ftp51/huangcijin/20250821/01/index.html
  - 真正游戏页: https://sda.4399.com/4399swf/upload_swf/ftp51/huangcijin/20250821/01/gameIndex.html
  - Build: 同目录 Build/pigwebgl.{data,wasm,framework.js,loader.js}
- 模式: 单向(oneWay) + NumWay(多向) 两套,对应 yin_oneway / numoneway 场景
- 关卡: 569 关(见 4399_level_list.json),命名家族:
  - LevelNew1~420(主线 336)
  - ChangeLevelNew(挑战 68)
  - Level1-1~101(51)、Levelz(14)、eLevel(25)
  - farmerLv(农民 15)、bombLv(炸弹 17)、zangLv(15) 等特殊主题关
  - LevelNewView(5)、DaiLiang(10)
- 关卡数据: 位于远程 Addressables bundle,本地 .data 仅含场景/UI/皮肤资源。
  后端 API: api.flysheeep.com/api/expro/get_pig_game_info 等(需要真实 openid)。
  → 无法离线提取单关地图,需运行游戏抓包。

### 2. 羊了个羊式「猪了个猪」(骚猪主题) —— 玩法不同 ❌
- 代表: solvable-sheep-game(有解羊了个羊demo),主题含 骚猪/ikun/金轮/钓鱼佬
- 在线: https://solvable-sheep-game.streakingman.com/?theme=骚猪
- 开源: https://github.com/mohoho/solvable-sheep-game (已克隆到 /tmp/sheep)
- 地图: 运行时程序化随机生成(makeScene),非固定数据,玩法为三消。

### 3. 17yoo「小猪了个猪」(ID 9650) —— 玩法不同 ❌
- 地址: https://www.17yoo.cn/detail/9650
- 微信小游戏,物理解谜/三消混合,滑动旋转弹射,非本项目玩法。

### 4. 安卓/iOS「猪了个猪」 —— 玩法不同 ❌
- 大量 羊了个羊式三消克隆(游戏狗/小米/duote等),与玩法无关。

## 已下载的 4399 游戏文件(在 /tmp 供参考)
- /tmp/pigrun_pigwebgl.data (30MB, 场景资源)
- /tmp/pigrun_pigwebgl.wasm (37MB, Il2Cpp 代码)
- /tmp/pigrun_pigwebgl.framework.js / loader.js / symbols.json
- /tmp/gameIndex.html (真正的游戏入口)
