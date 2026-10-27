# 动物赛车 · 环形赛道玩法(俯视竞速)设计文档

- 日期:2026-10-27
- 状态:待审阅
- 类型:Cocos 表现层 · 环形赛道玩法(替代直线竞速)

## 1. 概述与范围

把当前"直线点按加速"的比赛玩法,升级为**俯视环形赛道竞速**:

- 车有朝向,左右按钮**转向**
- 车有**默认速度**自动前进
- 加速键改为**氮气喷射**(氮气条 + 短时爆发)
- 赛道是**圆角矩形环**(直道 + 弯道),绕 **3 圈**按总用时评星
- 撞墙**反弹**、撞障碍**减速**
- 部分墙**可破坏**(高速撞破 / 低速累积耐久),破墙后进入**隐藏近路**抄近道

**地图 = 数据**:赛道、障碍、可破坏墙、近路全部用可序列化的 `TrackDefinition` 描述,为后续"玩家自制地图 + 上传分享"铺好地基。

### 分阶段

- **第一版(本轮)**:核心玩法 + 可组合地图数据 + 3 个内置赛道(纯本地,可跑通)
- **后续**:地图编辑器 UI(玩家自制)、上传/分享地图(微信云开发后端)、排行榜

## 2. 关键决策

| 决策点 | 结论 |
|--------|------|
| 视角 | 俯视 2D,Canvas + Camera,设计分辨率 800×600 不变 |
| 赛道形状 | 圆角矩形环(直道 + 弯道),SDF 判定边界 |
| 左右按钮 | **转向**(旋转车头方向),非变道 |
| 默认速度 | 不按键也自动前进 |
| 氮气 | 氮气条自动回复,按住喷射消耗、松手回复、耗尽自动停 |
| 撞墙 | 速度方向**镜像反弹** × 0.6 + 拉回边界 |
| 障碍 | 圆形碰撞,进入则速度压到 `defaultSpeed × slowdown` |
| 可破坏墙 | 高速(≥breakSpeed)一次破;低速累积耐久归 0 破 |
| 近路 | 斜穿 / 内环 / 支路统一为 `Shortcut` 模型,`path` 折线区分 |
| 圈数 | 起跑线叉积检测,近路不跨起跑线 |
| 旧直线版 | `RaceSimulator` **直接替换** |
| 架构 | core 纯逻辑 + Cocos 表现层,延续不变 |

## 3. 架构

```
core/src/
  data/types.ts        # 改:新增 TrackDefinition 等地图类型
  config/tracks.ts     # 新:内置 3 个赛道(可序列化数据)
  logic/trackSim.ts    # 新:2D 移动/转向/碰撞/耐久/近路模拟(纯函数)
  index.ts             # 改:导出新 API

game/assets/scripts/
  app/RaceRoot.ts      # 改:驱动模拟 + 渲染 + 输入 + 结算(Controller)
  ui/TrackRenderer.ts  # 新:赛道/车/障碍/墙/近路的 Graphics 渲染(View)
  ui/RaceHUD.ts        # 改:圈数/氮气条/用时 + 结算弹层(View)
  ui/UIHelper.ts       # 扩展:新增"按住式按钮"工厂
```

- 旧的 `core/src/logic/raceSimulator.ts` 删除,由 `trackSim.ts` 取代。
- 旧的 `raceSimulator.test.ts` 删除,由 `trackSim.test.ts` 取代。

## 4. 数据模型

### 总类型 TrackDefinition

```ts
interface TrackDefinition {
  id: string;
  name: string;
  scene: SceneType;                // 复用 land/water/sky(栖息地加成)
  shape: TrackShape;               // 赛道几何
  obstacles: PlacedObstacle[];     // 减速障碍
  breakableWalls: PlacedBreakableWall[];  // 可破坏墙(近路入口)
  shortcuts: Shortcut[];           // 近路
  startLine: Segment;              // 起跑线(圈数检测)
  laps: number;                    // 圈数
  starTime: [number, number];      // 评星阈值(总用时秒)
  rewards: { coins: number; eggDropRate: number };
}
```

### 子类型

```ts
interface TrackShape {
  type: 'rounded-rect';
  centerX: number;  centerY: number;  // 中心(逻辑坐标,默认 0,0)
  outerWidth: number;  outerHeight: number;  // 外环尺寸
  trackWidth: number;  // 赛道宽度(内边界 = 外边界内缩)
  cornerRadius: number; // 圆角半径
}

interface PlacedObstacle {
  id: string;
  x: number;  y: number;
  radius: number;              // 碰撞半径
  kind: 'puddle' | 'rock';     // 视觉类型(占位色)
  slowdown: number;            // 撞上后速度乘系数(如 0.3)
}

interface PlacedBreakableWall {
  id: string;
  x1: number; y1: number;  x2: number; y2: number;  // 一段墙(线段)
  durability: number;      // 低速撞 N 次才破
  breakSpeed: number;      // 速度 ≥ 此值,一次撞破
}

interface Shortcut {
  id: string;
  type: 'diagonal' | 'inner-loop' | 'branch';
  entranceWallId: string;  // 入口对应的可破坏墙 id
  path: Point[];           // 近路通道折线
  width: number;           // 通道宽度
}

interface Segment { x1: number; y1: number; x2: number; y2: number; }
interface Point { x: number; y: number; }
```

**关键设计**:三种近路统一为 `Shortcut`,仅 `path` 折线形状不同(`diagonal` 斜穿一条线、`inner-loop` 闭合小环、`branch` 折出折回)。加新近路 = 换一份 path 数据,不改代码。

`TrackDefinition` 取代原 `Level` 在比赛中的角色(原 `Level.distance` 直线距离在新玩法无意义)。

## 5. 移动 / 物理模拟(core 纯函数)

### 状态 / 输入 / 参数

```ts
interface CarState {
  x: number;  y: number;      // 位置
  angle: number;              // 朝向角(弧度)
  speed: number;              // 当前速度
  nitro: number;              // 氮气量 0 ~ nitroMax
  lap: number;                // 已完成圈数
  time: number;               // 总用时
}

interface TrackInput {
  steer: -1 | 0 | 1;          // 左转/直行/右转
  boosting: boolean;          // 是否按住氮气键
}

interface TrackParams {
  defaultSpeed: number;       // 默认前进速度
  boostSpeed: number;         // 氮气喷射速度
  turnRate: number;           // 转向速率(弧度/秒)
  nitroMax: number;
  nitroDrain: number;         // 喷射每秒消耗
  nitroRegen: number;         // 松手每秒回复
  bounceSpeedFactor: number;  // 撞墙反弹速度保留比例(0.6)
}
```

### 运行时状态 + 签名

```ts
interface TrackRuntimeState {
  car: CarState;
  wallDurability: Record<string, number>;  // 可破坏墙 id → 剩余耐久(缺省=未破)
}

function step(
  rt: TrackRuntimeState,
  input: TrackInput,
  dt: number,
  params: TrackParams,
  track: TrackDefinition,
): TrackRuntimeState
```

### 每帧逻辑顺序

1. **转向**:`angle += steer * turnRate * dt`
2. **速度**:`boosting && nitro>0` → `speed = boostSpeed`、`nitro -= nitroDrain*dt`;否则 `speed = defaultSpeed`、`nitro += nitroRegen*dt`(封顶)
3. **位移**:`x += cos(angle)*speed*dt`;`y += sin(angle)*speed*dt`
4. **碰撞**(顺序):障碍 → 普通边界墙 → 可破坏墙
5. **圈数**:穿过起跑线(上一帧一侧、这一帧另一侧,且正向)→ `lap++`
6. **结束**:`lap >= track.laps` → 完成

## 6. 碰撞检测算法

### 6.1 赛道边界(圆角矩形环)SDF

```
roundRectSDF(px, py, cx, cy, hw, hh, r):
  qx = |px - cx| - (hw - r)
  qy = |py - cy| - (hh - r)
  dx = max(qx, 0);  dy = max(qy, 0)
  return sqrt(dx² + dy²) + min(max(qx, qy), 0) - r
  // 负值在内,正值在外,0 在边界
```

- 外边界:hw = `outerWidth/2`、hh = `outerHeight/2`
- 内边界:hw = `outerWidth/2 - trackWidth`、hh = `outerHeight/2 - trackWidth`

判定:车 `outerSDF < 0 && innerSDF > 0` → 赛道内;`outerSDF >= 0` 撞外墙;`innerSDF <= 0` 撞内墙。

### 6.2 反弹

1. 法线 `n` = SDF 数值梯度 `(SDF(x+ε) - SDF(x-ε)) / 2ε`(指向赛道内)
2. 速度向量 `v = (cos angle, sin angle) * speed`
3. 镜像 `v' = v - 2(v·n)n`
4. `angle = atan2(v'.y, v'.x)`;`speed = |v'| * bounceSpeedFactor`
5. 位置沿 `n` 拉回 `|SDF|` 距离

### 6.3 障碍(圆)

车点到障碍圆心距离 `< radius` → 在障碍内 → `speed = defaultSpeed * slowdown`(持续在障碍内持续慢)。

### 6.4 可破坏墙(线段)+ 耐久

1. 点到线段距离 `< 墙厚度` → 撞上
2. `speed >= breakSpeed` → 一次撞破(从 `wallDurability` 移除)
3. 否则 `durability - 1` 并按 6.2 反弹(法线垂直线段),归 0 则破

### 6.5 起跑线(圈数)

`side(P) = sign(cross(B-A, P-A))`,上一帧 `side < 0`、这一帧 `side >= 0` → 正向穿过 → `lap++`。

## 7. 内置赛道 + 结算

### 三个内置赛道(圆角矩形环底座)

- **赛道 1「斜穿捷径」**:外环 320×200、赛道宽 40、圆角 30;斜穿近路连接左下→右上,入口墙在左下角外墙;上下直道各 2 个水坑。
- **赛道 2「隐藏内环」**:外环 320×200;内环近路(更小圆角矩形环)藏于内部,入口墙在某直道;外环弯道放石头。
- **赛道 3「短支路」**:外环 320×200;直道旁一条折出折回的支路近路,入口墙在直道旁;支路入口附近放水坑。

各赛道可破坏墙的 `durability`/`breakSpeed` 不同,形成难度梯度。

### 结算 / 评星 / 奖励

```ts
stars = computeStars(car.time, track.starTime)          // 复用 core
coins = computeRewards(track, stars, carLevel)          // 复用 core(适配 TrackDefinition)
```

`computeStars`/`computeRewards` 只需让参数接受 `TrackDefinition`(结构性类型),逻辑不改。

**栖息地加成保留**:`habitat == scene` → `defaultSpeed`/`boostSpeed` ×1.2(复用 `habitatMultiplier`),保持隐藏不展示。

## 8. 表现层

### 组件职责

| 组件 | 职责 |
|------|------|
| `RaceRoot.ts` | 读赛道 + 当前车 → 初始化模拟/渲染/输入 → 每帧 `step` → 更新渲染 → 结算 |
| `TrackRenderer.ts` | Graphics 渲染赛道/车/障碍/墙/近路 |
| `RaceHUD.ts` | 圈数/氮气条/用时 + 结算弹层 |
| `UIHelper.ts` | 新增 `createHoldButton`(按住式) |

### 渲染(全部 Graphics 占位)

- 赛道:`roundRect` 画外圈 + 内圈,中间填充赛道色,内外圈描边当墙
- 车:小矩形,`setRotation(angle)`;氮气时车尾加火苗色块
- 障碍:圆,水坑蓝 / 石头灰
- 可破坏墙:粗线段,醒目色(黄),撞破后消失
- 近路通道:破墙后显示半透明虚线,未破隐藏

### 输入(按住式)

`createHoldButton` 监听 `TOUCH_START/TOUCH_END/TOUCH_CANCEL`:

- 左转 / 右转按钮(左下 / 右下)→ `input.steer = -1 / 1`
- 氮气按钮(右下上方)→ `input.boosting = true/false`

### HUD

顶部:圈数 `1/3`、用时、速度;氮气条(长度 = `nitro/nitroMax`);结算弹层复用 `showSettlement`(星级 + 金币 + 返回 Home)。

## 9. 测试策略

### core 单测(`trackSim.test.ts`,vitest)

| 用例 | 断言 |
|------|------|
| 默认速度前进 | 不按键,沿 `angle` 移动 `defaultSpeed × dt` |
| 左右转向 | `steer=-1/1` 时 `angle` 按 `turnRate` 增减 |
| 氮气喷射 | `boosting` 速度 = `boostSpeed`、氮气减少 |
| 氮气耗尽自动停 | 氮气归 0 后速度回 `defaultSpeed`(仍按住) |
| 氮气松手回复 | 不 boosting 氮气回升、封顶 |
| 撞外墙反弹 | 越外边界镜像反弹、×0.6 |
| 撞内墙反弹 | 越内边界镜像反弹 |
| 障碍减速 | 进入半径速度压到 `defaultSpeed × slowdown` |
| 可破坏墙·高速破 | `speed ≥ breakSpeed` 一次破 |
| 可破坏墙·低速累积 | 低于阈值耐久 -1、反弹,归 0 破 |
| 圈数检测 | 正向穿过 `lap++`,反向不记 |
| 完成结束 | `lap` 达 3 完成 |
| 近路里程 | 破墙走近路一圈更短 |
| 栖息地加成 | `habitat == scene` 速度 ×1.2 |

### 表现层手动验证(Cocos 预览 ▶)

1. Race 显示环形赛道 + 车,车自动前进
2. 左右按钮转向,车头转、沿新方向走
3. 氮气喷射加速、氮气条变化、耗尽自动停
4. 撞墙反弹、撞障碍减速
5. 高速撞可破坏墙一次破、低速撞多次破
6. 破墙走近路,圈数不误判
7. 绕 3 圈结算,星级/金币正确,回 Home

## 10. 后续扩展(超出本轮)

- 地图编辑器 UI(玩家可视化摆赛道/障碍/墙/近路)
- 上传/分享地图(微信云开发:云函数 + 云数据库,上传/下载/列表)
- 排行榜(最快通关成绩,云数据库)
- 真实像素美术替换占位图
