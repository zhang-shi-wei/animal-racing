# 动物赛车 · Cocos 表现层(第二阶段)设计文档

- 日期:2026-10-26
- 状态:待审阅
- 类型:Cocos 表现层 · 最小可玩切片

## 1. 概述与范围

第一阶段 `core/` 纯逻辑模块已完成并合并(数据模型、配置、存档、升级、孵化、特性、比赛结算)。本阶段做 **Cocos Creator 表现层**,把纯逻辑接到可见可玩的界面上。

本轮交付**最小可玩切片**(不做完整 MVP):

- **极简 Home**:显示当前车、金币余额、一个"开始比赛"入口
- **Race**:点按加速 + 体力条 + 计时评星 + 结算弹层
- **占位图美术**:纯色块代替车/背景/障碍,美术后续替换
- **障碍**:本轮**只预留设计,不实现**(见第 7 节)

**超出本轮范围**(后续再做):完整 Home 三页(车库/孵化室/图鉴)、升级、孵化、图鉴、障碍与玩家自制地图、真实像素美术。

## 2. 已确认的关键决策

| 决策点 | 结论 |
|--------|------|
| 本轮交付程度 | 最小可玩切片(非完整 MVP) |
| 美术资源 | 占位图(纯色块),不阻塞开发 |
| core 接入方式 | 直接拷贝 `core/src` 源文件到 `game/assets/scripts/core/` |
| 场景/UI 搭建方式 | **方案 A:代码驱动 UI**——编辑器只建空场景+挂启动组件,UI 全部由代码构建 |
| 加速模拟(`RaceSimulator`) | 放 `core/`,纯函数,可 vitest 单测 |
| 比赛玩法 | 加速 + 体力(无障碍) |
| 障碍 | 设计预留(可组合数据模式),暂不实现 |

**环境**:Cocos Creator 3.8.8(`D:\Software\Cocos\download\Creator\3.8.8\CocosCreator.exe`)、微信开发者工具(`D:\Software\WeChat\devtools\微信web开发者工具\`)均已安装。

## 3. 项目结构

`game/` 为 Cocos Creator 3.8.8 项目,与 `core/` 平级,同一 git 仓库:

```
game/
  package.json / tsconfig.json   # Cocos 项目配置(由编辑器生成)
  assets/
    scripts/
      core/                      # 从 core/src 拷贝(data/config/logic/index)
      app/
        HomeRoot.ts              # Home 场景启动组件
        RaceRoot.ts              # Race 场景启动组件
      ui/
        HomeUI.ts                # 代码构建 Home 界面
        RaceHUD.ts               # 代码构建比赛 HUD(速度/体力/进度/计时)
      save/
        SaveAdapter.ts           # 存档读写封装
      race/
        GameState.ts             # 跨场景传递的全局单例(当前车 id 等)
    scenes/
      Home.scene                 # 用户建的空场景,根节点挂 HomeRoot
      Race.scene                 # 用户建的空场景,根节点挂 RaceRoot
```

`RaceSimulator` 位于 `core/src/logic/raceSimulator.ts`(纯逻辑,先在 core 写+测,再随拷贝进入 game)。

## 4. 组件与职责

| 组件 | 职责 | Java 类比 |
|------|------|-----------|
| `SaveAdapter` | 存档读写封装,调 core 的 `serialize/deserialize/createDefaultProgress`;预览环境用 localStorage,微信小游戏用 `wx.setStorageSync` | DAO 层 |
| `RaceSimulator` | 纯数值模拟(速度/体力/进度),`step(state, input, dt)` 无副作用 | Service 核心算法 |
| `GameState` | 跨场景单例,传递当前车 id、上一局结果 | 共享状态对象 |
| `HomeRoot` | Home 场景启动:读档→初始化 HomeUI→监听"开始比赛"→ `loadScene('Race')` | Controller |
| `RaceRoot` | Race 场景启动:读当前车→初始化模拟器与 HUD→每帧 `update(dt)` 驱动→到终点结算 | Controller |
| `HomeUI` / `RaceHUD` | 界面节点构建与每帧刷新 | View |

## 5. 数据流

```
启动 Home
  → HomeRoot.onLoad → SaveAdapter 读档(无档则 createDefaultProgress)
  → HomeUI 显示金币 + 当前车
点击"开始比赛"
  → 记录当前车 id 到 GameState → director.loadScene('Race')
Race 场景
  → RaceRoot.onLoad → 从 CARS 查当前车配置 → 初始化 RaceSimulator + RaceHUD
  → 每帧 update(dt): RaceSimulator.step(按住?, dt) → HUD 刷新速度/体力/进度/计时
到达终点(distance ≥ level.distance)
  → computeStars(用时, level.starTime) → computeRewards(level, stars, level)
  → 结算弹层显示星级+金币 → 金币写入存档并落盘
返回 Home(读取更新后的存档)
```

## 6. 比赛模拟数值规则

`RaceSimulator` 为纯函数 `step(state, input, dt, params) → state`:

```
状态 state  = { speed, stamina, distance, time }
输入 input  = { accelerating: boolean }
参数 params = { maxSpeed, baseAccel, ...全局常量 }

1. maxSpeed = computeFinalMaxSpeed(baseSpeed, level, habitatMultiplier)  # 复用 core 已有
2. 若 accelerating 且 stamina > 0:
     speed  += baseAccel × dt (不超过 maxSpeed)
     stamina -= STAMINA_DRAIN × dt
3. 否则(松手 或 体力见底):
     speed  -= DECEL_RATE × dt (不低于 0)
     stamina += STAMINA_REGEN × dt (不超过 STAMINA_MAX)
     体力见底时 speed 被压在 maxSpeed × COAST_RATIO 以下
4. distance += speed × dt
```

初始常量(写进 core,可调):

| 常量 | 值 | 说明 |
|------|-----|------|
| `STAMINA_MAX` | 100 | 体力满值 |
| `STAMINA_DRAIN` | 20/秒 | 按住每秒耗 20,约 5 秒耗尽 |
| `STAMINA_REGEN` | 15/秒 | 松手每秒回 15,约 6.7 秒回满 |
| `DECEL_RATE` | 45/秒 | 松手减速,略快于 baseAccel,保证松手确实减速 |
| `COAST_RATIO` | 0.3 | 体力见底只能以 maxSpeed 的 30% 滑行 |

评星复用 `computeStars`,金币复用 `computeRewards`(均已在 core 实现)。

## 7. 障碍与地图可组合预留(玩家自制地图)

本轮**不实现障碍**,但为未来"玩家自制地图"预留**数据驱动 + 可组合**的扩展点。核心思想:**一张地图 = 一份数据,不是一段代码**。

预留数据形状(仅记录在文档,不写死代码):

```ts
interface Level {
  // 现有字段不变
  id; name; scene; distance; starTime; rewards;
  track?: TrackDefinition;   // 预留:赛道布局
}

interface TrackDefinition {
  obstacles: PlacedObstacle[];   // { obstacleId, position(距起点里程) }
}

interface ObstacleDefinition {
  id: string;                    // "puddle" 水坑
  visual: string;                // 渲染用:占位图 id
  effects: ObstacleEffect[];     // 可组合:可挂多个效果
}
type ObstacleEffect =
  | { type: 'slowdown'; ratio: number }        // 撞上速度 ×0.3
  | { type: 'staminaDrain'; amount: number };  // 撞上扣体力
```

设计意图:

1. **玩家做地图 = 编辑 `TrackDefinition` 数据**(摆障碍位置、选类型),游戏只"读数据 → 渲染 → 跑"。
2. **障碍效果可组合**:同一障碍换 `effects` 即得复合效果,不改渲染。
3. 与 `core/` 已有的 **TraitSystem** 同哲学——加新内容 = 加数据/加可组合单元,不动核心逻辑。

做障碍时再落地成代码 + 测试。

## 8. 测试与验证

| 层 | 方式 |
|----|------|
| `core/` 纯逻辑(`RaceSimulator`、结算) | vitest 单测:加速到上限、体力耗尽滑行、松手回体力、计时评星、金币取整 |
| Cocos 表现层(UI 构建、场景切换、触摸交互) | 手动验证:Cocos Creator 预览跑通「Home → 开始比赛 → 加速跑 → 结算 → 回 Home」闭环;微信开发者工具构建预览真机效果 |

表现层依赖 Cocos 运行时与触摸事件,无法纯单测,靠手动验证清单覆盖(实现计划里给出逐步验证步骤)。

## 9. 后续扩展(超出本轮)

- 完整 Home 三页(车库/孵化室/图鉴)+ 升级 + 孵化
- 障碍落地(按第 7 节可组合模式)+ 玩家自制地图
- 真实像素美术替换占位图
- 喂食/饱腹度、作息/昼夜(已在 core TraitSystem 预留接口)
