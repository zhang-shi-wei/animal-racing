# 动物赛车 · 环形赛道玩法(俯视竞速)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把直线点按加速升级为俯视环形赛道竞速——左右转向 + 默认速度自动前进 + 氮气喷射 + 圆角矩形环赛道 + 可破坏墙/近路,3 圈评星结算,纯本地可跑通。

**Architecture:** 纯逻辑(`trackSim.ts` 逐帧模拟:转向/速度/氮气/SDF 边界/障碍/可破坏墙/圈数)放 `core/` 并 vitest 单测;地图用可序列化 `TrackDefinition` 数据(`tracks.ts` 内置 3 赛道);表现层是 `game/` Cocos 项目,新增 `TrackRenderer`(Graphics 渲染)+ 重写 `RaceRoot`/`RaceHUD` + 按住式按钮。core 源文件拷贝到 `game/assets/scripts/core/`。

**Tech Stack:** TypeScript、vitest(core 单测)、Cocos Creator 3.8.8(手动验证)。

---

## 前置条件

- core 单测环境已就绪:`cd core && npm test`(vitest)、`cd core && npx tsc --noEmit`(类型检查)。
- Cocos 项目 `game/` 已存在,Home/Race 两场景已建好并挂 `HomeRoot`/`RaceRoot` 组件,设计分辨率 800×600。
- core 源已拷贝到 `game/assets/scripts/core/`(含各 `.ts` 与 `.meta`)。

## 设计文档

`docs/superpowers/specs/2026-10-27-racing-circular-track-gameplay.md`(本计划的上游 spec)

## 关键约定(务必遵守)

- **TDD 只适用于 core 纯逻辑**(trackSim);Cocos 表现层组件无单测,靠 Task 13 手动验证。
- **所有 commit 只本地提交,不 push**(用户明确要求:默认不推远程,等用户提示再推)。
- **坐标系与转向符号约定**(核心,极易出错):
  - `angle` 单位**弧度**,标准数学取向:**0 = +x(右)、π/2 = +y(上)**,逆时针为正(CCW 增大)。
  - 速度向量 = `(cos(angle), sin(angle)) * speed`。
  - `car.angle += input.steer * turnRate * dt`:**steer=+1 → 逆时针(左转)、steer=-1 → 顺时针(右转)**。
  - 按钮映射:`◀ 左转 → steer=+1`、`▶ 右转 → steer=-1`、`氮气 → boosting=true`。
  - 渲染时 `setRotationFromEuler(0, 0, angle * 180 / Math.PI)`(Cocos 2D 旋转 CCW 为正,与约定一致)。
  - **本计划纠正了 spec 第 8 节"左转/右转 → -1/1"的符号笔误**,以"左转=CCW=+1"为准,否则按钮方向与直觉相反。
- **起跑线方向约定**:起跑线为**竖直线段**(在底部直道 x=0 处,`{x1:0,y1:-60,x2:0,y2:-100}`,即 A=上、B=下)。车从起跑线中点 `(0,-80)` 起步,`angle=0`(+x 方向)。正向穿过判定 `side(prev)<0 && side(cur)>=0`(从左往右),只有正向穿线才记圈,顶部直道反向穿线(从右往左)不记。
- **近路第一版为"数据 + 渲染"**:spec 第 6 节碰撞只定义了障碍/SDF 边界/可破坏墙/起跑线,**没有近路自身的碰撞物理**。第一版把可破坏墙当作"闸门"放在直道上,撞破后移除挡路的墙段;`Shortcut.path` 作为破墙后显示的虚线路径 + 数据层"路径更短"断言。真正的"穿越内场抄近路"物理留到后续(地图编辑器阶段)。

## 文件结构

```
core/                                    # 已有,本计划新增/修改
  src/data/types.ts                      # 修改:新增 TrackDefinition 等地图类型
  src/config/tracks.ts                   # 新增:内置 3 赛道
  src/logic/trackSim.ts                  # 新增:2D 移动/转向/碰撞/耐久/圈数(纯函数)
  src/logic/race.ts                      # 修改:computeRewards 参数放宽为结构类型
  src/logic/raceSimulator.ts             # 删除
  src/index.ts                           # 修改:删 raceSimulator 导出,加 tracks/trackSim
  tests/trackSim.test.ts                 # 新增:单测
  tests/raceSimulator.test.ts            # 删除

game/                                    # 已有,本计划修改
  assets/scripts/core/                   # 重新从 core/src 拷贝(增 tracks/trackSim,删 raceSimulator)
  assets/scripts/ui/UIHelper.ts          # 修改:新增 createHoldButton(按住式)
  assets/scripts/ui/TrackRenderer.ts     # 新增:赛道/车/障碍/墙/近路 Graphics 渲染
  assets/scripts/ui/RaceHUD.ts           # 修改:圈数/氮气条/用时 + 结算
  assets/scripts/app/RaceRoot.ts         # 修改:驱动 trackSim + 渲染 + 输入 + 结算
```

---

## Task 1: core 地图数据模型(types.ts)

**Files:**
- Modify: `core/src/data/types.ts`

- [ ] **Step 1: 追加地图类型**

在 `core/src/data/types.ts` **末尾**追加(不删原有类型):

```ts
export interface Segment { x1: number; y1: number; x2: number; y2: number; }
export interface Point { x: number; y: number; }

export interface TrackShape {
  type: 'rounded-rect';
  centerX: number;
  centerY: number;
  outerWidth: number;
  outerHeight: number;
  trackWidth: number;
  cornerRadius: number;
}

export type ObstacleKind = 'puddle' | 'rock';

export interface PlacedObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  kind: ObstacleKind;
  slowdown: number;
}

export interface PlacedBreakableWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  durability: number;
  breakSpeed: number;
}

export type ShortcutType = 'diagonal' | 'inner-loop' | 'branch';

export interface Shortcut {
  id: string;
  type: ShortcutType;
  entranceWallId: string;
  path: Point[];
  width: number;
}

export interface TrackDefinition {
  id: string;
  name: string;
  scene: SceneType;
  shape: TrackShape;
  obstacles: PlacedObstacle[];
  breakableWalls: PlacedBreakableWall[];
  shortcuts: Shortcut[];
  startLine: Segment;
  laps: number;
  starTime: [number, number];
  rewards: { coins: number; eggDropRate: number };
}
```

- [ ] **Step 2: 类型检查**

Run: `cd core && npx tsc --noEmit`
Expected: 无类型错误(`SceneType` 已存在于同文件,复用即可)。

- [ ] **Step 3: Commit**

```bash
git add core/src/data/types.ts
git commit -m "feat: 新增环形赛道地图数据模型(TrackDefinition 等)"
```

---

## Task 2: trackSim 核心(工厂 + 转向 + 速度/氮气 + 位移)

**Files:**
- Create: `core/src/logic/trackSim.ts`
- Create: `core/tests/trackSim.test.ts`

- [ ] **Step 1: 写失败测试(核心行为)**

创建 `core/tests/trackSim.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createTrackRuntimeState, step, type TrackParams, type TrackRuntimeState } from '../src/logic/trackSim';
import type { TrackDefinition } from '../src/data/types';

function makeTrack(overrides: Partial<TrackDefinition> = {}): TrackDefinition {
  return {
    id: 'test',
    name: 'test',
    scene: 'land',
    shape: { type: 'rounded-rect', centerX: 0, centerY: 0, outerWidth: 320, outerHeight: 200, trackWidth: 40, cornerRadius: 30 },
    obstacles: [],
    breakableWalls: [],
    shortcuts: [],
    startLine: { x1: 0, y1: -60, x2: 0, y2: -100 },
    laps: 3,
    starTime: [45, 70],
    rewards: { coins: 100, eggDropRate: 0.1 },
    ...overrides,
  };
}

const baseParams: TrackParams = {
  defaultSpeed: 80,
  boostSpeed: 140,
  turnRate: 2,
  nitroMax: 100,
  nitroDrain: 40,
  nitroRegen: 25,
  bounceSpeedFactor: 0.6,
};

describe('track simulator 核心', () => {
  it('默认速度沿 angle 前进', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams); // (0,-80) angle 0
    rt = step(rt, { steer: 0, boosting: false }, 0.1, baseParams, track);
    expect(rt.car.x).toBeCloseTo(8);      // 80 * 0.1
    expect(rt.car.y).toBeCloseTo(-80);
    expect(rt.car.speed).toBeCloseTo(80);
  });

  it('左转(+1)增大 angle,右转(-1)减小 angle', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    const a0 = rt.car.angle;
    const left = step(rt, { steer: 1, boosting: false }, 0.01, baseParams, track);
    expect(left.car.angle).toBeCloseTo(a0 + 2 * 0.01);
    const right = step(rt, { steer: -1, boosting: false }, 0.01, baseParams, track);
    expect(right.car.angle).toBeCloseTo(a0 - 2 * 0.01);
  });

  it('boosting 速度=boostSpeed 且氮气减少', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt = step(rt, { steer: 0, boosting: true }, 1, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(140);
    expect(rt.car.nitro).toBeCloseTo(100 - 40);
  });

  it('氮气耗尽后仍按住,速度回默认', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.nitro = 0.1;
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(0);
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(80);
  });

  it('松手氮气回复并封顶', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.nitro = 10;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(10 + 25 * 0.01);
    rt.car.nitro = 99.9;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/trackSim'`

- [ ] **Step 3: 写实现(核心部分)**

创建 `core/src/logic/trackSim.ts`(先写核心,碰撞/圈数在后续 Task 追加):

```ts
import type { TrackDefinition } from '../data/types';

export interface CarState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  nitro: number;
  lap: number;
  time: number;
}

export interface TrackInput {
  steer: -1 | 0 | 1;
  boosting: boolean;
}

export interface TrackParams {
  defaultSpeed: number;
  boostSpeed: number;
  turnRate: number;
  nitroMax: number;
  nitroDrain: number;
  nitroRegen: number;
  bounceSpeedFactor: number;
}

export interface TrackRuntimeState {
  car: CarState;
  wallDurability: Record<string, number>;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function createTrackRuntimeState(track: TrackDefinition, params: TrackParams): TrackRuntimeState {
  const sx = (track.startLine.x1 + track.startLine.x2) / 2;
  const sy = (track.startLine.y1 + track.startLine.y2) / 2;
  return {
    car: { x: sx, y: sy, angle: 0, speed: 0, nitro: params.nitroMax, lap: 0, time: 0 },
    wallDurability: {},
  };
}

export function step(
  rt: TrackRuntimeState,
  input: TrackInput,
  dt: number,
  params: TrackParams,
  track: TrackDefinition,
): TrackRuntimeState {
  let car: CarState = { ...rt.car };
  const wallDurability: Record<string, number> = { ...rt.wallDurability };

  // 1. 转向
  car.angle += input.steer * params.turnRate * dt;

  // 2. 速度(氮气)
  if (input.boosting && car.nitro > 0) {
    car.speed = params.boostSpeed;
    car.nitro = clamp(car.nitro - params.nitroDrain * dt, 0, params.nitroMax);
  } else {
    car.speed = params.defaultSpeed;
    car.nitro = clamp(car.nitro + params.nitroRegen * dt, 0, params.nitroMax);
  }

  // 3. 位移
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // 4~6. 碰撞 / 圈数 / 时间:后续 Task 追加

  car.time += dt;

  return { car, wallDurability };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd core && npm test`
Expected: 新增 5 用例全绿(旧用例不受影响)。

- [ ] **Step 5: Commit**

```bash
git add core/src/logic/trackSim.ts core/tests/trackSim.test.ts
git commit -m "feat: 环形赛道模拟核心(转向/默认速度/氮气/位移)"
```

---

## Task 3: trackSim 碰撞(障碍 + SDF 边界 + 可破坏墙)

**Files:**
- Modify: `core/src/logic/trackSim.ts`
- Modify: `core/tests/trackSim.test.ts`

- [ ] **Step 1: 追加失败测试(碰撞)**

在 `core/tests/trackSim.test.ts` 末尾追加(注意 import 需补 `Point`、`PlacedObstacle`、`PlacedBreakableWall`、`TrackShape` 等类型时按需添加):

```ts
describe('track simulator 碰撞', () => {
  it('撞外墙镜像反弹 ×0.6', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 0;
    rt.car.y = -90;
    rt.car.angle = -Math.PI / 2; // 朝 -y 撞外墙
    rt = step(rt, { steer: 0, boosting: false }, 0.5, baseParams, track);
    expect(rt.car.angle).toBeCloseTo(Math.PI / 2); // 反弹向上
    expect(rt.car.speed).toBeCloseTo(80 * 0.6);
  });

  it('撞内墙镜像反弹', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 0;
    rt.car.y = -70;
    rt.car.angle = Math.PI / 2; // 朝 +y 撞内墙
    rt = step(rt, { steer: 0, boosting: false }, 0.5, baseParams, track);
    expect(rt.car.angle).toBeCloseTo(-Math.PI / 2); // 反弹向下
    expect(rt.car.speed).toBeCloseTo(80 * 0.6);
  });

  it('进入障碍半径速度压到 defaultSpeed×slowdown', () => {
    const track = makeTrack({
      obstacles: [{ id: 'o', x: 50, y: -80, radius: 15, kind: 'puddle', slowdown: 0.3 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 50;
    rt.car.y = -80;
    rt = step(rt, { steer: 0, boosting: false }, 0.1, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(80 * 0.3);
  });

  it('速度≥breakSpeed 一次撞破', () => {
    const track = makeTrack({
      breakableWalls: [{ id: 'w', x1: 50, y1: -100, x2: 50, y2: -60, durability: 5, breakSpeed: 120 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 45;
    rt.car.y = -80;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track); // 140 ≥ 120
    expect(rt.wallDurability['w']).toBe(0);
  });

  it('低速撞耐久-1并反弹,归0破', () => {
    const track = makeTrack({
      breakableWalls: [{ id: 'w', x1: 50, y1: -100, x2: 50, y2: -60, durability: 2, breakSpeed: 120 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 45;
    rt.car.y = -80;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track); // 80 < 120
    expect(rt.wallDurability['w']).toBe(1);
    expect(rt.car.angle).toBeCloseTo(Math.PI); // 反弹朝 -x
    rt.car.x = 45;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.wallDurability['w']).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd core && npm test`
Expected: 新增 5 用例失败(step 尚未处理碰撞,如"撞外墙"断言 angle 不符)。

- [ ] **Step 3: 写碰撞实现**

修改 `core/src/logic/trackSim.ts`:

**Step 3a** — 顶部 import 补类型:

```ts
import type { TrackDefinition, PlacedObstacle, PlacedBreakableWall, TrackShape, Segment } from '../data/types';
```

**Step 3b** — 在 `step` 的"位移"之后、"时间"之前插入碰撞调用:

```ts
  // 3. 位移
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // 4. 碰撞:障碍 → 边界墙 → 可破坏墙
  car = collideObstacles(car, track.obstacles, params);
  car = collideBoundary(car, track.shape, params);
  const wallResult = collideBreakableWalls(car, wallDurability, track.breakableWalls, params);
  car = wallResult.car;

  car.time += dt;

  return { car, wallDurability: wallResult.wallDurability };
```

**Step 3c** — 文件末尾追加碰撞辅助函数(放在 `step` 之后):

```ts
const WALL_THICKNESS = 6; // 可破坏墙碰撞半厚(点到线段距离阈值)

function roundRectSDF(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.sqrt(dx * dx + dy * dy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdfGradient(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number): { x: number; y: number } {
  const eps = 1e-4;
  const dx = (roundRectSDF(px + eps, py, cx, cy, hw, hh, r) - roundRectSDF(px - eps, py, cx, cy, hw, hh, r)) / (2 * eps);
  const dy = (roundRectSDF(px, py + eps, cx, cy, hw, hh, r) - roundRectSDF(px, py - eps, cx, cy, hw, hh, r)) / (2 * eps);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
}

function bounce(car: CarState, nx: number, ny: number, penetration: number, factor: number): CarState {
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  const dot = vx * nx + vy * ny;
  const rvx = vx - 2 * dot * nx;
  const rvy = vy - 2 * dot * ny;
  return {
    ...car,
    x: car.x + nx * penetration,
    y: car.y + ny * penetration,
    angle: Math.atan2(rvy, rvx),
    speed: Math.sqrt(rvx * rvx + rvy * rvy) * factor,
  };
}

function collideBoundary(car: CarState, shape: TrackShape, params: TrackParams): CarState {
  const { centerX, centerY, outerWidth, outerHeight, trackWidth, cornerRadius } = shape;
  const outerHW = outerWidth / 2;
  const outerHH = outerHeight / 2;
  const innerHW = outerHW - trackWidth;
  const innerHH = outerHH - trackWidth;

  const outerSDF = roundRectSDF(car.x, car.y, centerX, centerY, outerHW, outerHH, cornerRadius);
  if (outerSDF >= 0) {
    const g = sdfGradient(car.x, car.y, centerX, centerY, outerHW, outerHH, cornerRadius);
    return bounce(car, -g.x, -g.y, outerSDF, params.bounceSpeedFactor);
  }

  const innerSDF = roundRectSDF(car.x, car.y, centerX, centerY, innerHW, innerHH, cornerRadius);
  if (innerSDF <= 0) {
    const g = sdfGradient(car.x, car.y, centerX, centerY, innerHW, innerHH, cornerRadius);
    return bounce(car, g.x, g.y, -innerSDF, params.bounceSpeedFactor);
  }

  return car;
}

function collideObstacles(car: CarState, obstacles: PlacedObstacle[], params: TrackParams): CarState {
  let c = car;
  for (const o of obstacles) {
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    if (dx * dx + dy * dy < o.radius * o.radius) {
      c = { ...c, speed: params.defaultSpeed * o.slowdown };
    }
  }
  return c;
}

function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}

function segmentNormal(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  const vx = px - x1;
  const vy = py - y1;
  if (nx * vx + ny * vy < 0) { nx = -nx; ny = -ny; }
  return { x: nx, y: ny };
}

function collideBreakableWalls(car: CarState, wallDurability: Record<string, number>, walls: PlacedBreakableWall[], params: TrackParams): { car: CarState; wallDurability: Record<string, number> } {
  let c = car;
  const wd: Record<string, number> = { ...wallDurability };
  for (const w of walls) {
    if (wd[w.id] === 0) continue; // 已破
    const dist = pointSegmentDistance(c.x, c.y, w.x1, w.y1, w.x2, w.y2);
    if (dist < WALL_THICKNESS) {
      if (c.speed >= w.breakSpeed) {
        wd[w.id] = 0; // 高速一次破
      } else {
        const remaining = (wd[w.id] ?? w.durability) - 1;
        if (remaining <= 0) {
          wd[w.id] = 0;
        } else {
          wd[w.id] = remaining;
          const n = segmentNormal(c.x, c.y, w.x1, w.y1, w.x2, w.y2);
          c = bounce(c, n.x, n.y, WALL_THICKNESS - dist, params.bounceSpeedFactor);
        }
      }
    }
  }
  return { car: c, wallDurability: wd };
}
```

> 说明:`Segment` 类型在 Task 4 用到圈数,故 Step 3a 的 import 先一并引入(避免后续再改 import 行)。

- [ ] **Step 4: 运行确认通过**

Run: `cd core && npm test`
Expected: 全部用例通过(核心 5 + 碰撞 5)。

- [ ] **Step 5: Commit**

```bash
git add core/src/logic/trackSim.ts core/tests/trackSim.test.ts
git commit -m "feat: 环形赛道碰撞(障碍减速/SDF 边界反弹/可破坏墙耐久)"
```

---

## Task 4: trackSim 圈数检测

**Files:**
- Modify: `core/src/logic/trackSim.ts`
- Modify: `core/tests/trackSim.test.ts`

- [ ] **Step 1: 追加失败测试(圈数)**

```ts
describe('track simulator 圈数', () => {
  it('正向穿过起跑线 lap++,反向不记', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams); // (0,-80)
    rt.car.x = -10;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track); // +x 穿过 x=0
    expect(rt.car.lap).toBe(1);
    rt.car.x = 10;
    rt.car.angle = Math.PI;
    rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track); // -x 反向穿过
    expect(rt.car.lap).toBe(1);
  });

  it('反复正向穿过累计到设定圈数', () => {
    const track = makeTrack({ laps: 3 });
    let rt = createTrackRuntimeState(track, baseParams);
    for (let i = 0; i < 3; i++) {
      rt.car.x = -10;
      rt.car.angle = 0;
      rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track);
    }
    expect(rt.car.lap).toBe(3);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd core && npm test`
Expected: 新增 2 用例失败(`lap` 未累加)。

- [ ] **Step 3: 写圈数实现**

修改 `core/src/logic/trackSim.ts` 的 `step`,在碰撞之后、`time` 之前插入圈数检测,并新增辅助函数:

```ts
  // 4. 碰撞
  car = collideObstacles(car, track.obstacles, params);
  car = collideBoundary(car, track.shape, params);
  const wallResult = collideBreakableWalls(car, wallDurability, track.breakableWalls, params);
  car = wallResult.car;

  // 5. 圈数
  if (crossedStartLine(prevX, prevY, car.x, car.y, track.startLine)) {
    car.lap += 1;
  }

  // 6. 时间
  car.time += dt;
```

文件末尾追加:

```ts
function sideOfLine(px: number, py: number, line: Segment): number {
  const cross = (line.x2 - line.x1) * (py - line.y1) - (line.y2 - line.y1) * (px - line.x1);
  return Math.sign(cross);
}

function crossedStartLine(prevX: number, prevY: number, x: number, y: number, line: Segment): boolean {
  return sideOfLine(prevX, prevY, line) < 0 && sideOfLine(x, y, line) >= 0;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd core && npm test`
Expected: 全部用例通过(核心 5 + 碰撞 5 + 圈数 2)。

- [ ] **Step 5: Commit**

```bash
git add core/src/logic/trackSim.ts core/tests/trackSim.test.ts
git commit -m "feat: 起跑线叉积圈数检测(正向累计,反向不记)"
```

---

## Task 5: 内置赛道数据 + 近路里程测试

**Files:**
- Create: `core/src/config/tracks.ts`
- Modify: `core/tests/trackSim.test.ts`

- [ ] **Step 1: 写 3 个内置赛道**

创建 `core/src/config/tracks.ts`:

```ts
import type { TrackDefinition } from '../data/types';

const baseShape = { type: 'rounded-rect' as const, centerX: 0, centerY: 0, outerWidth: 320, outerHeight: 200, trackWidth: 40, cornerRadius: 30 };
const baseStartLine = { x1: 0, y1: -60, x2: 0, y2: -100 };

export const TRACKS: TrackDefinition[] = [
  {
    id: 'track-1',
    name: '斜穿捷径',
    scene: 'land',
    shape: baseShape,
    obstacles: [
      { id: 't1-o1', x: -80, y: -80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o2', x: 60, y: -80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o3', x: -60, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o4', x: 80, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
    ],
    breakableWalls: [
      { id: 't1-wall', x1: -140, y1: -50, x2: -140, y2: -110, durability: 3, breakSpeed: 120 },
    ],
    shortcuts: [
      { id: 't1-shortcut', type: 'diagonal', entranceWallId: 't1-wall', path: [{ x: -140, y: -80 }, { x: -80, y: -40 }, { x: -20, y: 0 }, { x: 60, y: 60 }], width: 20 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [45, 70],
    rewards: { coins: 100, eggDropRate: 0.1 },
  },
  {
    id: 'track-2',
    name: '隐藏内环',
    scene: 'water',
    shape: baseShape,
    obstacles: [
      { id: 't2-o1', x: 140, y: 80, radius: 14, kind: 'rock', slowdown: 0.2 },
      { id: 't2-o2', x: -140, y: -80, radius: 14, kind: 'rock', slowdown: 0.2 },
    ],
    breakableWalls: [
      { id: 't2-wall', x1: -60, y1: -80, x2: -20, y2: -80, durability: 2, breakSpeed: 110 },
    ],
    shortcuts: [
      { id: 't2-shortcut', type: 'inner-loop', entranceWallId: 't2-wall', path: [{ x: -40, y: -80 }, { x: 0, y: -40 }, { x: 40, y: -80 }, { x: 0, y: -120 }], width: 16 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [50, 75],
    rewards: { coins: 150, eggDropRate: 0.15 },
  },
  {
    id: 'track-3',
    name: '短支路',
    scene: 'sky',
    shape: baseShape,
    obstacles: [
      { id: 't3-o1', x: 120, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't3-o2', x: 120, y: 70, radius: 12, kind: 'puddle', slowdown: 0.3 },
    ],
    breakableWalls: [
      { id: 't3-wall', x1: 120, y1: 70, x2: 120, y2: 90, durability: 4, breakSpeed: 130 },
    ],
    shortcuts: [
      { id: 't3-shortcut', type: 'branch', entranceWallId: 't3-wall', path: [{ x: 120, y: 80 }, { x: 180, y: 80 }, { x: 180, y: 140 }, { x: 120, y: 140 }], width: 16 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [55, 80],
    rewards: { coins: 200, eggDropRate: 0.2 },
  },
];
```

> 赛道坐标为初始占位值,可在 Task 13 手动验证时按手感微调。

- [ ] **Step 2: 追加近路里程测试**

在 `core/tests/trackSim.test.ts` 顶部 import 补 `TRACKS`,并追加:

```ts
import { TRACKS } from '../src/config/tracks';

function polylineLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

describe('track simulator 近路', () => {
  it('近路入口墙引用有效,且路径短于整圈', () => {
    const track = TRACKS[0];
    const shortcut = track.shortcuts[0];
    const wall = track.breakableWalls.find((w) => w.id === shortcut.entranceWallId);
    expect(wall).toBeDefined();
    const loopLength = 2 * (track.shape.outerWidth + track.shape.outerHeight);
    const pathLength = polylineLength(shortcut.path);
    expect(pathLength).toBeGreaterThan(0);
    expect(pathLength).toBeLessThan(loopLength);
  });
});
```

- [ ] **Step 3: 运行确认通过**

Run: `cd core && npm test`
Expected: 全部用例通过(核心 5 + 碰撞 5 + 圈数 2 + 近路 1)。

- [ ] **Step 4: Commit**

```bash
git add core/src/config/tracks.ts core/tests/trackSim.test.ts
git commit -m "feat: 内置 3 条环形赛道数据 + 近路里程测试"
```

---

## Task 6: 导出新 API 并清理旧直线模拟

**Files:**
- Modify: `core/src/logic/race.ts`
- Modify: `core/src/index.ts`
- Delete: `core/src/logic/raceSimulator.ts`
- Delete: `core/tests/raceSimulator.test.ts`

- [ ] **Step 1: computeRewards 参数放宽为结构类型**

修改 `core/src/logic/race.ts`:删除顶部 `import type { Level } from '../data/types';`,并把 `computeRewards` 签名改为结构类型:

```ts
export function computeRewards(track: { rewards: { coins: number } }, stars: number, carLevel: number): number {
  return Math.floor(track.rewards.coins * STAR_COIN_MULTIPLIER[stars] * incomeMultiplier(carLevel));
}
```

(其余 `computeFinalMaxSpeed`/`computeStars` 不变。这样 `Level` 和 `TrackDefinition` 都能传入。)

- [ ] **Step 2: 更新 index.ts**

修改 `core/src/index.ts`,删除第 11~12 行(raceSimulator 导出),新增 tracks/trackSim 导出:

```ts
export * from './data/types';
export { CARS } from './config/cars';
export { LEVELS } from './config/levels';
export { TRACKS } from './config/tracks';
export { createDefaultProgress, serialize, deserialize } from './logic/save';
export { MAX_LEVEL, upgradeCost, speedMultiplier, incomeMultiplier, canUpgrade, upgrade } from './logic/upgrade';
export { HATCH_DURATION, eggState, rollCar } from './logic/hatch';
export type { EggState } from './logic/hatch';
export { HABITAT_BONUS, habitatMultiplier, computeMultiplier } from './logic/traits';
export type { Trait } from './logic/traits';
export { computeFinalMaxSpeed, computeStars, computeRewards } from './logic/race';
export { createTrackRuntimeState, step } from './logic/trackSim';
export type { CarState, TrackInput, TrackParams, TrackRuntimeState } from './logic/trackSim';
```

- [ ] **Step 3: 删除旧直线模拟**

```bash
rm core/src/logic/raceSimulator.ts core/tests/raceSimulator.test.ts
```

- [ ] **Step 4: 全量测试 + 类型检查**

Run: `cd core && npm test && npx tsc --noEmit`
Expected: 全部用例通过(旧 raceSimulator 9 用例已随文件删除),无类型错误。

- [ ] **Step 5: Commit**

```bash
git add core/src/logic/race.ts core/src/index.ts
git rm core/src/logic/raceSimulator.ts core/tests/raceSimulator.test.ts
git commit -m "feat: 导出环形赛道 API,替换并删除直线竞速模拟"
```

---

## Task 7: 重新拷贝 core 到 game 并删除旧文件

**Files:**
- Copy: `game/assets/scripts/core/`(从 `core/src/`)
- Delete: `game/assets/scripts/core/logic/raceSimulator.ts` + `.meta`

- [ ] **Step 1: 拷贝**

```bash
cp -r core/src/* game/assets/scripts/core/
```

- [ ] **Step 2: 删除 game 侧的旧模拟**

```bash
rm game/assets/scripts/core/logic/raceSimulator.ts
rm game/assets/scripts/core/logic/raceSimulator.ts.meta
```

- [ ] **Step 3: 确认结构**

Run: `ls game/assets/scripts/core/ game/assets/scripts/core/config/ game/assets/scripts/core/logic/`
Expected: `config/tracks.ts`、`logic/trackSim.ts` 已存在,`logic/raceSimulator.ts` 已删除,`types.ts`/`race.ts`/`index.ts` 已更新。

- [ ] **Step 4: Commit**

```bash
git add game/assets/scripts/core
git commit -m "chore: 同步 core 源到 Cocos 项目(增 trackSim/tracks,删 raceSimulator)"
```

> **注意**:新文件 `tracks.ts`、`trackSim.ts` 的 `.meta` 由 Cocos 编辑器刷新后自动生成,在 Task 13 手动验证时一并提交(见该 Task Step 6)。

---

## Task 8: UIHelper 新增按住式按钮

**Files:**
- Modify: `game/assets/scripts/ui/UIHelper.ts`

- [ ] **Step 1: 追加 createHoldButton**

在 `game/assets/scripts/ui/UIHelper.ts` 末尾追加:

```ts
export function createHoldButton(
  parent: Node,
  text: string,
  position: Vec3,
  width: number,
  height: number,
  onDown: () => void,
  onUp: () => void,
): Node {
  const node = createNode('holdButton', parent);
  const uiTransform = node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);

  const g = node.addComponent(Graphics);
  g.fillColor = new Color(80, 160, 90);
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();

  createLabel(node, text, Vec3.ZERO, 26, Color.WHITE);

  node.on(Node.EventType.TOUCH_START, (e) => { e.propagationStopped = true; onDown(); });
  node.on(Node.EventType.TOUCH_END, (e) => { e.propagationStopped = true; onUp(); });
  node.on(Node.EventType.TOUCH_CANCEL, (e) => { e.propagationStopped = true; onUp(); });
  node.setPosition(position);
  return node;
}
```

> `node.on(Node.EventType.TOUCH_START)` 依赖 `UITransform` 提供命中区域,本函数已添加。若预览时按钮无反应,给节点补 `Button` 组件兜底(但通常无需)。

- [ ] **Step 2: Commit**

```bash
git add game/assets/scripts/ui/UIHelper.ts
git commit -m "feat: 新增按住式按钮工厂(createHoldButton)"
```

---

## Task 9: TrackRenderer(赛道/车/障碍/墙/近路渲染)

**Files:**
- Create: `game/assets/scripts/ui/TrackRenderer.ts`

- [ ] **Step 1: 写 TrackRenderer**

创建 `game/assets/scripts/ui/TrackRenderer.ts`:

```ts
import { Node, Graphics, Color } from 'cc';
import type { TrackDefinition, CarState } from '../core';

export class TrackRenderer {
  private trackGraphics!: Graphics; // 静态层:赛道 + 障碍
  private dynGraphics!: Graphics;   // 动态层:可破坏墙 + 近路(每帧重画)
  private carNode!: Node;
  private carGraphics!: Graphics;

  constructor(private root: Node, private track: TrackDefinition) {}

  build(): void {
    const trackNode = new Node('track');
    this.root.addChild(trackNode);
    this.trackGraphics = trackNode.addComponent(Graphics);
    this.drawTrackStatic();

    const dynNode = new Node('dynamic');
    this.root.addChild(dynNode);
    this.dynGraphics = dynNode.addComponent(Graphics);

    this.carNode = new Node('car');
    this.root.addChild(this.carNode);
    this.carGraphics = this.carNode.addComponent(Graphics);
  }

  private drawTrackStatic(): void {
    const g = this.trackGraphics;
    const { centerX, centerY, outerWidth, outerHeight, trackWidth, cornerRadius } = this.track.shape;
    const bg = new Color(40, 80, 40);
    const innerW = outerWidth - trackWidth * 2;
    const innerH = outerHeight - trackWidth * 2;

    // 赛道填充:外环填赛道色,内环填背景色挖洞
    g.fillColor = new Color(120, 120, 120);
    g.roundRect(centerX - outerWidth / 2, centerY - outerHeight / 2, outerWidth, outerHeight, cornerRadius);
    g.fill();
    g.fillColor = bg;
    g.roundRect(centerX - innerW / 2, centerY - innerH / 2, innerW, innerH, cornerRadius);
    g.fill();

    // 内外墙描边
    g.lineWidth = 4;
    g.strokeColor = new Color(255, 255, 255);
    g.roundRect(centerX - outerWidth / 2, centerY - outerHeight / 2, outerWidth, outerHeight, cornerRadius);
    g.stroke();
    g.strokeColor = new Color(255, 80, 80);
    g.roundRect(centerX - innerW / 2, centerY - innerH / 2, innerW, innerH, cornerRadius);
    g.stroke();

    // 障碍
    for (const o of this.track.obstacles) {
      g.fillColor = o.kind === 'puddle' ? new Color(60, 140, 220) : new Color(120, 120, 120);
      g.circle(o.x, o.y, o.radius);
      g.fill();
    }
  }

  update(car: CarState, wallDurability: Record<string, number>, boosting: boolean): void {
    this.carNode.setPosition(car.x, car.y, 0);
    this.carNode.setRotationFromEuler(0, 0, car.angle * 180 / Math.PI);

    const g = this.carGraphics;
    g.clear();
    g.fillColor = new Color(230, 120, 120);
    g.rect(-15, -10, 30, 20);
    g.fill();
    if (boosting) {
      g.fillColor = new Color(255, 180, 60);
      g.rect(-30, -6, 15, 12); // 车尾火苗(局部 -x)
      g.fill();
    }

    this.drawDynamic(wallDurability);
  }

  private drawDynamic(wallDurability: Record<string, number>): void {
    const g = this.dynGraphics;
    g.clear();

    for (const w of this.track.breakableWalls) {
      if (wallDurability[w.id] === 0) continue;
      g.lineWidth = 8;
      g.strokeColor = new Color(255, 220, 60);
      g.moveTo(w.x1, w.y1);
      g.lineTo(w.x2, w.y2);
      g.stroke();
    }

    for (const s of this.track.shortcuts) {
      if (wallDurability[s.entranceWallId] !== 0) continue; // 墙未破隐藏
      this.drawDashedPath(g, s.path, 8, 6);
    }
  }

  private drawDashedPath(g: Graphics, points: { x: number; y: number }[], dashLen: number, gapLen: number): void {
    g.lineWidth = 3;
    g.strokeColor = new Color(255, 255, 255, 140);
    for (let i = 1; i < points.length; i++) {
      let x1 = points[i - 1].x, y1 = points[i - 1].y;
      const x2 = points[i].x, y2 = points[i].y;
      const dx = x2 - x1, dy = y2 - y1;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) continue;
      const ux = dx / segLen, uy = dy / segLen;
      let covered = 0;
      while (covered < segLen) {
        const step = Math.min(dashLen, segLen - covered);
        g.moveTo(x1 + ux * covered, y1 + uy * covered);
        g.lineTo(x1 + ux * (covered + step), y1 + uy * (covered + step));
        g.stroke();
        covered += step + gapLen;
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add game/assets/scripts/ui/TrackRenderer.ts
git commit -m "feat: 环形赛道 Graphics 渲染器(赛道/车/障碍/墙/近路)"
```

---

## Task 10: RaceHUD 重写(圈数/氮气条/用时 + 结算)

**Files:**
- Modify: `game/assets/scripts/ui/RaceHUD.ts`

- [ ] **Step 1: 重写 RaceHUD**

用以下内容**整体替换** `game/assets/scripts/ui/RaceHUD.ts`:

```ts
import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createRect, createButton } from './UIHelper';
import type { CarState, TrackParams } from '../core';

export class RaceHUD {
  private lapLabel!: Label;
  private timeLabel!: Label;
  private speedLabel!: Label;
  private nitroBar!: Node;
  private readonly nitroMaxWidth = 200;

  constructor(private root: Node) {}

  build(trackLaps: number): void {
    this.lapLabel = createLabel(this.root, `圈数: 1/${trackLaps}`, new Vec3(-320, 280, 0), 22, Color.WHITE);
    this.timeLabel = createLabel(this.root, '用时: 0.0s', new Vec3(0, 280, 0), 22, Color.WHITE);
    this.speedLabel = createLabel(this.root, '速度: 0', new Vec3(320, 280, 0), 22, Color.WHITE);

    createRect(this.root, this.nitroMaxWidth, 18, new Color(60, 60, 60), new Vec3(0, 240, 0));
    this.nitroBar = createRect(this.root, this.nitroMaxWidth, 18, new Color(80, 160, 240), new Vec3(0, 240, 0));
  }

  update(car: CarState, params: TrackParams, trackLaps: number): void {
    this.lapLabel.string = `圈数: ${Math.min(car.lap + 1, trackLaps)}/${trackLaps}`;
    this.timeLabel.string = `用时: ${car.time.toFixed(1)}s`;
    this.speedLabel.string = `速度: ${Math.round(car.speed)}`;
    this.nitroBar.setScale(car.nitro / params.nitroMax, 1, 1);
  }

  showSettlement(stars: number, coins: number, onBack: () => void): void {
    createRect(this.root, 800, 600, new Color(0, 0, 0, 150), new Vec3(0, 0, 0));
    createRect(this.root, 400, 300, new Color(50, 50, 50), new Vec3(0, 0, 0));
    createLabel(this.root, '比赛结束', new Vec3(0, 100, 0), 40, Color.WHITE);
    createLabel(this.root, '★'.repeat(stars) + '☆'.repeat(3 - stars), new Vec3(0, 40, 0), 48, new Color(255, 220, 80));
    createLabel(this.root, `金币 +${coins}`, new Vec3(0, -20, 0), 28, new Color(255, 220, 80));
    createButton(this.root, '返回', new Vec3(0, -100, 0), 200, 60, onBack);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add game/assets/scripts/ui/RaceHUD.ts
git commit -m "feat: RaceHUD 改为圈数/氮气条/用时 + 结算"
```

---

## Task 11: RaceRoot 重写(驱动 trackSim + 渲染 + 输入 + 结算)

**Files:**
- Modify: `game/assets/scripts/app/RaceRoot.ts`

- [ ] **Step 1: 重写 RaceRoot**

用以下内容**整体替换** `game/assets/scripts/app/RaceRoot.ts`:

```ts
import { _decorator, Component, director, Color, Vec3 } from 'cc';
import {
  CARS, TRACKS,
  habitatMultiplier, computeFinalMaxSpeed, computeStars, computeRewards,
  createTrackRuntimeState, step,
  type TrackInput, type TrackParams, type TrackRuntimeState,
} from '../core';
import { RaceHUD } from '../ui/RaceHUD';
import { TrackRenderer } from '../ui/TrackRenderer';
import { GameState } from '../race/GameState';
import { SaveAdapter } from '../save/SaveAdapter';
import { createRect, createHoldButton } from '../ui/UIHelper';

const { ccclass } = _decorator;

@ccclass('RaceRoot')
export class RaceRoot extends Component {
  private car = CARS.find((c) => c.id === GameState.instance.currentCarId) ?? CARS[0];
  private track = TRACKS[0];
  private carLevel = 1;
  private params!: TrackParams;
  private rt!: TrackRuntimeState;
  private input: TrackInput = { steer: 0, boosting: false };
  private finished = false;
  private renderer!: TrackRenderer;
  private hud!: RaceHUD;

  onLoad() {
    const progress = SaveAdapter.load();
    this.carLevel = progress.ownedCars.find((o) => o.carId === this.car.id)?.level ?? 1;
    const defaultSpeed = computeFinalMaxSpeed(
      this.car.baseSpeed,
      this.carLevel,
      habitatMultiplier(this.car.habitat, this.track.scene),
    );
    this.params = {
      defaultSpeed,
      boostSpeed: defaultSpeed * 1.4,
      turnRate: 2.5,
      nitroMax: 100,
      nitroDrain: 40,
      nitroRegen: 25,
      bounceSpeedFactor: 0.6,
    };

    createRect(this.node, 800, 600, new Color(40, 80, 40), new Vec3(0, 0, 0));

    this.renderer = new TrackRenderer(this.node, this.track);
    this.renderer.build();

    this.hud = new RaceHUD(this.node);
    this.hud.build(this.track.laps);

    this.rt = createTrackRuntimeState(this.track, this.params);

    // 按住式按钮:左转=逆时针=+1,右转=顺时针=-1
    createHoldButton(this.node, '◀', new Vec3(-340, -240, 0), 90, 90, () => (this.input.steer = 1), () => (this.input.steer = 0));
    createHoldButton(this.node, '▶', new Vec3(340, -240, 0), 90, 90, () => (this.input.steer = -1), () => (this.input.steer = 0));
    createHoldButton(this.node, '氮气', new Vec3(340, -120, 0), 120, 90, () => (this.input.boosting = true), () => (this.input.boosting = false));
  }

  update(dt: number) {
    if (this.finished) return;
    this.rt = step(this.rt, this.input, dt, this.params, this.track);

    this.renderer.update(this.rt.car, this.rt.wallDurability, this.input.boosting);
    this.hud.update(this.rt.car, this.params, this.track.laps);

    if (this.rt.car.lap >= this.track.laps) {
      this.finish();
    }
  }

  private finish() {
    this.finished = true;
    const stars = computeStars(this.rt.car.time, this.track.starTime);
    const coins = computeRewards(this.track, stars, this.carLevel);

    const progress = SaveAdapter.load();
    progress.coins += coins;
    SaveAdapter.save(progress);
    GameState.instance.lastResult = { stars, coins };

    this.hud.showSettlement(stars, coins, () => director.loadScene('Home'));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add game/assets/scripts/app/RaceRoot.ts
git commit -m "feat: RaceRoot 驱动环形赛道模拟(转向/氮气/渲染/结算)"
```

---

## Task 12: 类型检查 + 全量测试复核

- [ ] **Step 1: core 全量校验**

Run: `cd core && npm test && npx tsc --noEmit`
Expected: 全绿(核心/碰撞/圈数/近路共 13 用例 + 原 race/hatch/save/traits/upgrade/config 用例),无类型错误。

- [ ] **Step 2: game 侧确认无残留旧引用**

Run: `grep -rn "raceSimulator\|createRaceSimState\|RaceSimState" game/assets/scripts/ --include="*.ts"`
Expected: 无任何输出(旧直线模拟引用已全部清理)。

---

## Task 13: 手动验证清单(用户操作,Cocos 预览)

> 表现层无法单测,靠跑起来验证。用 Cocos 编辑器顶部**预览(▶)** 按钮在浏览器里跑。

- [ ] **Step 1: 预览跑通**

1. 点编辑器顶部预览按钮,浏览器打开 Race 场景(或从 Home 点"开始比赛"进入)。
2. 预期:绿色背景中央出现灰色圆角矩形环赛道(白外墙 + 红内墙描边),红色小车在底部直道,顶部有圈数/用时/速度,蓝色氮气条满。

- [ ] **Step 2: 默认速度自动前进**

预期:不按任何键,车自动沿底部直道向右(+x)前进,顶部"速度"显示非零。

- [ ] **Step 3: 转向**

1. 按住 `◀`(左转):预期车头逆时针转,沿新方向走(绕环时基本一直按住 `◀` 走逆时针圈)。
2. 按住 `▶`(右转):预期车头顺时针转。

- [ ] **Step 4: 氮气喷射**

1. 按住"氮气"按钮:预期车明显加速,蓝色氮气条变短,车尾出现橙色火苗色块。
2. 一直按住直到氮气条清空:预期速度回落到默认值(氮气耗尽自动停)。
3. 松手:预期氮气条回升。

- [ ] **Step 5: 撞墙反弹**

预期:撞外墙(白色)/内墙(红色)时车被弹回、方向镜像,且速度短暂下降(×0.6)。

- [ ] **Step 6: 撞障碍减速**

预期:碾过蓝色水坑/灰色石头时速度骤降(压到默认速度 × slowdown)。

- [ ] **Step 7: 可破坏墙与近路**

1. 以默认速度撞黄色墙:预期被弹回,墙未破(耐久减 1)。
2. 开氮气(速度 ≥ breakSpeed)撞黄墙:预期墙一次撞破、黄色墙消失。
3. 破墙后:预期该近路位置出现白色半透明虚线(未破时隐藏)。

- [ ] **Step 8: 圈数与结算**

1. 绕 3 圈:预期顶部圈数 1/3 → 3/3,结束后弹出结算面板(星级 + 金币 + 返回)。
2. 点"返回":预期回 Home,金币已累加。

- [ ] **Step 9: 提交新 .meta 文件**

Cocos 编辑器刷新后,新文件(`core/config/tracks.ts`、`core/logic/trackSim.ts`、`ui/TrackRenderer.ts`)会生成 `.meta`。确认后提交:

```bash
git status
git add game/assets/scripts/core/config/tracks.ts.meta game/assets/scripts/core/logic/trackSim.ts.meta game/assets/scripts/ui/TrackRenderer.ts.meta
git commit -m "chore: 提交新增脚本的 .meta 元数据"
```

(若 `.meta` 未出现在 `git status`,说明编辑器尚未刷新,先打开/刷新 Cocos 编辑器再执行。)

---

## 完成标准

- [ ] `cd core && npm test` 全绿(含 trackSim 13 用例)
- [ ] `cd core && npx tsc --noEmit` 无错误
- [ ] `game/assets/scripts/` 下无任何 `raceSimulator`/`createRaceSimState`/`RaceSimState` 残留引用
- [ ] 手动验证清单 Step 1~8 全部通过(环形赛道闭环跑通 + 结算 + 存档)
- [ ] 新增 `.meta` 已提交
- [ ] 所有 commit 仅本地,未 push

---

## 后续扩展(超出本轮,不实现)

- 近路"穿越内场/外侧"真实碰撞物理(当前近路为数据 + 渲染 + 数据层更短断言)
- 地图编辑器 UI(玩家摆赛道/障碍/墙/近路)
- 上传/分享地图(微信云开发)与排行榜
- 真实像素美术替换占位图
- 车辆升级等级对速度的影响(当前等级仅影响金币奖励,速度只含栖息地加成)
