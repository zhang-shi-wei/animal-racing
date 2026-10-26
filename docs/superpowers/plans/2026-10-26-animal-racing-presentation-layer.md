# 动物赛车 · Cocos 表现层(最小可玩切片)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现第二阶段 Cocos 表现层的最小可玩切片——极简 Home(显示车/金币 + 开始比赛)+ Race(点按加速 + 体力 + 计时评星 + 结算弹层),占位图美术,core 纯逻辑拷贝接入。

**Architecture:** 纯逻辑(RaceSimulator 逐帧模拟)放 `core/` 并 vitest 单测;表现层是 `game/` Cocos Creator 3.8.8 项目,采用"代码驱动 UI"(编辑器只建空场景 + 挂启动组件,其余 UI 全由代码构建)。core 源文件拷贝到 `game/assets/scripts/core/`。

**Tech Stack:** TypeScript、vitest(core 单测)、Cocos Creator 3.8.8、微信开发者工具(手动验证)。

---

## 前置条件

- Cocos Creator 3.8.8 已装:`D:\Software\Cocos\download\Creator\3.8.8\CocosCreator.exe`(Dashboard 在 `D:\Software\Cocos\CocosDashboard\`)
- 微信开发者工具已装:`D:\Software\WeChat\devtools\微信web开发者工具\`
- Node.js v24 + npm 已装(core 单测用)

## 设计文档

`docs/superpowers/specs/2026-10-26-racing-collect-game-presentation-layer.md`(本计划的上游 spec)

## 关键约定

- **本计划只做"最小可玩切片"**,障碍、AI 生成车辆、赛道记录均为预留,不实现。
- **TDD 只适用于 core 纯逻辑**(RaceSimulator);Cocos 表现层组件无单测,靠手动验证。
- **所有 commit 只本地提交,不 push**(用户明确要求:默认不推远程,等用户提示再推)。

## 文件结构

```
core/                                   # 已有,本计划新增 raceSimulator
  src/logic/raceSimulator.ts            # 新增:逐帧模拟(纯函数)
  src/index.ts                          # 修改:导出 raceSimulator
  tests/raceSimulator.test.ts           # 新增:单测

game/                                   # 新增:Cocos 项目(由用户用 Dashboard 创建)
  assets/scripts/
    core/                               # 从 core/src 拷贝
    save/SaveAdapter.ts                 # 存档读写
    race/GameState.ts                   # 跨场景单例
    ui/UIHelper.ts                      # 节点工厂(建 label/rect/button)
    ui/HomeUI.ts                        # Home 界面
    ui/RaceHUD.ts                       # 比赛 HUD + 结算弹层
    app/HomeRoot.ts                     # Home 场景启动组件
    app/RaceRoot.ts                     # Race 场景启动组件(驱动模拟)
  assets/scenes/
    Home.scene / Race.scene             # 用户用编辑器创建
```

---

## Task 1: core RaceSimulator(纯逻辑,TDD)

**Files:**
- Create: `core/src/logic/raceSimulator.ts`
- Create: `core/tests/raceSimulator.test.ts`
- Modify: `core/src/index.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/raceSimulator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, DECEL_RATE, COAST_RATIO,
  createRaceSimState, step,
} from '../src/logic/raceSimulator';

describe('race simulator', () => {
  const params = { maxSpeed: 100, baseAccel: 30 };

  it('starts at zero speed and full stamina', () => {
    const s = createRaceSimState();
    expect(s.speed).toBe(0);
    expect(s.stamina).toBe(STAMINA_MAX);
    expect(s.distance).toBe(0);
    expect(s.time).toBe(0);
  });

  it('accelerates while holding', () => {
    const s0 = createRaceSimState();
    const s1 = step(s0, { accelerating: true }, 1, params);
    expect(s1.speed).toBeCloseTo(30);                     // 30 * 1
    expect(s1.stamina).toBeCloseTo(STAMINA_MAX - STAMINA_DRAIN); // 100 - 20
  });

  it('never exceeds max speed', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 4; i++) s = step(s, { accelerating: true }, 1, params); // 4s 刚好到 maxSpeed,体力未耗尽
    expect(s.speed).toBeLessThanOrEqual(params.maxSpeed);
    expect(s.speed).toBeCloseTo(params.maxSpeed);
  });

  it('decelerates and regens stamina when released', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 1, params);   // speed 30, stamina 80
    const s2 = step(s, { accelerating: false }, 1, params);
    expect(s2.speed).toBe(0);                          // 30 - 45 → 截断到 0
    expect(s2.stamina).toBeCloseTo(95);                // 80 + 15
  });

  it('caps speed to coast ratio when stamina empty, and does not regen while holding', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 5; i++) s = step(s, { accelerating: true }, 1, params); // 5s 耗尽体力
    expect(s.stamina).toBeCloseTo(0);
    expect(s.speed).toBeCloseTo(100);
    const s2 = step(s, { accelerating: true }, 1, params); // 仍按住但体力见底
    expect(s2.speed).toBeCloseTo(params.maxSpeed * COAST_RATIO);
    expect(s2.stamina).toBe(0);
  });

  it('accumulates distance as speed * dt', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 1, params);   // 末速 30, 前进 30
    expect(s.distance).toBeCloseTo(30);
  });

  it('accumulates time', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 0.5, params);
    expect(s.time).toBeCloseTo(0.5);
  });

  it('stamina stays within [0, max] and speed within [0, max]', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 100; i++) {
      s = step(s, { accelerating: i % 2 === 0 }, 0.1, params);
      expect(s.stamina).toBeGreaterThanOrEqual(0);
      expect(s.stamina).toBeLessThanOrEqual(STAMINA_MAX);
      expect(s.speed).toBeGreaterThanOrEqual(0);
      expect(s.speed).toBeLessThanOrEqual(params.maxSpeed);
    }
  });

  it('regenerates stamina only when released', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 5; i++) s = step(s, { accelerating: true }, 1, params); // 体力归 0
    expect(s.stamina).toBe(0);
    const held = step(s, { accelerating: true }, 1, params);   // 仍按住 → 不回体力
    expect(held.stamina).toBe(0);
    const released = step(s, { accelerating: false }, 1, params); // 松手 → 回体力
    expect(released.stamina).toBeCloseTo(STAMINA_REGEN);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/raceSimulator'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/raceSimulator.ts`:

```ts
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN = 20;   // 每秒
export const STAMINA_REGEN = 15;   // 每秒
export const DECEL_RATE = 45;      // 每秒
export const COAST_RATIO = 0.3;    // 体力见底滑行速度比例

export interface RaceSimState {
  speed: number;
  stamina: number;
  distance: number;
  time: number;
}

export interface RaceSimInput {
  accelerating: boolean;
}

export interface RaceSimParams {
  maxSpeed: number;   // 已算好的最终最大速度(含 level + habitat 系数)
  baseAccel: number;
}

export function createRaceSimState(): RaceSimState {
  return { speed: 0, stamina: STAMINA_MAX, distance: 0, time: 0 };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function step(
  state: RaceSimState,
  input: RaceSimInput,
  dt: number,
  params: RaceSimParams,
): RaceSimState {
  const { maxSpeed, baseAccel } = params;
  let speed = state.speed;
  let stamina = state.stamina;

  const accelerating = input.accelerating && stamina > 0;

  if (accelerating) {
    speed = clamp(speed + baseAccel * dt, 0, maxSpeed);
    stamina = clamp(stamina - STAMINA_DRAIN * dt, 0, STAMINA_MAX);
  } else {
    speed = clamp(speed - DECEL_RATE * dt, 0, maxSpeed);
    if (!input.accelerating) {
      stamina = clamp(stamina + STAMINA_REGEN * dt, 0, STAMINA_MAX);
    }
    if (stamina <= 0) {
      speed = Math.min(speed, maxSpeed * COAST_RATIO);
    }
  }

  return {
    speed,
    stamina,
    distance: state.distance + speed * dt,
    time: state.time + dt,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: 全部通过(原 36 用例 + 新增 9 用例)

- [ ] **Step 5: 导出 API**

修改 `core/src/index.ts`,在末尾追加:

```ts
export { STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, DECEL_RATE, COAST_RATIO, createRaceSimState, step } from './logic/raceSimulator';
export type { RaceSimState, RaceSimInput, RaceSimParams } from './logic/raceSimulator';
```

- [ ] **Step 6: 类型检查**

Run: `cd core && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add core/src/logic/raceSimulator.ts core/tests/raceSimulator.test.ts core/src/index.ts
git commit -m "feat: 实现比赛逐帧模拟(加速/体力/滑行,纯函数)"
```

---

## Task 2: 创建 Cocos 空项目(用户操作)

> 本步需要用户在 Cocos Dashboard 里点几下,无法由 agent 完成。

- [ ] **Step 1: 打开 Dashboard 新建项目**

1. 运行 `D:\Software\Cocos\CocosDashboard\CocosDashboard.exe`
2. 点 **项目 → 新建** 或 **New Project**
3. 项目名填 `game`
4. 项目路径选 `D:\Workspace\game`(这样会生成 `D:\Workspace\game\game` 目录)
5. 模板选 **Empty(空项目)**,版本选 **3.8.8**
6. 点 **创建并打开**

Expected: 编辑器打开 `game/` 项目,目录里出现 `assets/`、`package.json`、`tsconfig.json`、`settings/`、`library/` 等。

- [ ] **Step 2: 确认目录结构**

Run: `ls D:/Workspace/game/game`
Expected: 看到 `assets/`、`package.json`、`tsconfig.json`、`settings/` 等(以及 `library/`、`temp/` 等缓存目录,这些不提交)。

---

## Task 3: 拷贝 core 到 game + 确认 .gitignore

**Files:**
- Create: `game/assets/scripts/core/`(拷贝)
- Verify: `game/.gitignore`

- [ ] **Step 1: 拷贝 core 源文件**

Run:
```bash
mkdir -p game/assets/scripts/core
cp -r core/src/* game/assets/scripts/core/
ls game/assets/scripts/core/
```
Expected: 看到 `data/`、`config/`、`logic/`、`index.ts`。

- [ ] **Step 2: 确认 .gitignore 覆盖 Cocos 缓存目录**

查看 `game/.gitignore`(Dashboard 通常已生成)。若没有或缺少,确保包含以下内容(否则 `library/`、`temp/` 会污染 git):

```
library/
temp/
local/
build/
profiles/
native/
node_modules/
```

若需补充,直接在 `game/.gitignore` 追加缺失项。

- [ ] **Step 3: Commit**

```bash
git add game/assets/scripts/core game/.gitignore
git commit -m "chore: 拷贝 core 源文件进 Cocos 项目并确认忽略规则"
```

> **同步说明**:此后若 `core/src` 有改动,重新执行 `cp -r core/src/* game/assets/scripts/core/` 即可。当前 core 已稳定,手动拷贝可接受。

---

## Task 4: SaveAdapter + GameState

**Files:**
- Create: `game/assets/scripts/save/SaveAdapter.ts`
- Create: `game/assets/scripts/race/GameState.ts`

- [ ] **Step 1: 写 SaveAdapter**

创建 `game/assets/scripts/save/SaveAdapter.ts`:

```ts
import { sys } from 'cc';
import { createDefaultProgress, serialize, deserialize, type PlayerProgress } from '../core';

const SAVE_KEY = 'animal-racing-save';

export class SaveAdapter {
  static load(): PlayerProgress {
    const raw = sys.localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultProgress();
    return deserialize(raw);
  }

  static save(progress: PlayerProgress): void {
    sys.localStorage.setItem(SAVE_KEY, serialize(progress));
  }
}
```

> `sys.localStorage` 是 Cocos 的跨平台存储抽象:网页预览映射 `window.localStorage`,微信小游戏映射 `wx.getStorageSync/setStorageSync`,无需手动分环境。

- [ ] **Step 2: 写 GameState**

创建 `game/assets/scripts/race/GameState.ts`:

```ts
export interface RaceResult {
  stars: number;
  coins: number;
}

export class GameState {
  private static _instance: GameState | null = null;

  static get instance(): GameState {
    if (!this._instance) this._instance = new GameState();
    return this._instance;
  }

  currentCarId = 'pig';
  lastResult: RaceResult | null = null;
}
```

- [ ] **Step 3: Commit**

```bash
git add game/assets/scripts/save/SaveAdapter.ts game/assets/scripts/race/GameState.ts
git commit -m "feat: 存档读写适配器与跨场景单例"
```

---

## Task 5: UIHelper(节点工厂)

**Files:**
- Create: `game/assets/scripts/ui/UIHelper.ts`

- [ ] **Step 1: 写 UIHelper**

创建 `game/assets/scripts/ui/UIHelper.ts`:

```ts
import { Node, Label, Color, UITransform, Vec3, Graphics, Button, Layers } from 'cc';

export function createNode(name: string, parent: Node): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  parent.addChild(n);
  return n;
}

export function createLabel(
  parent: Node,
  text: string,
  position: Vec3,
  fontSize = 24,
  color: Color = Color.WHITE,
): Label {
  const node = createNode('label', parent);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.2);
  label.color = color;
  node.setPosition(position);
  return label;
}

export function createRect(
  parent: Node,
  width: number,
  height: number,
  color: Color,
  position: Vec3,
): Node {
  const node = createNode('rect', parent);
  const g = node.addComponent(Graphics);
  g.fillColor = color;
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();
  node.setPosition(position);
  return node;
}

export function createButton(
  parent: Node,
  text: string,
  position: Vec3,
  width: number,
  height: number,
  onClick: () => void,
): Node {
  const node = createNode('button', parent);
  const uiTransform = node.addComponent(UITransform);
  uiTransform.setContentSize(width, height);

  const g = node.addComponent(Graphics);
  g.fillColor = new Color(80, 160, 90);
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();

  const button = node.addComponent(Button);
  button.target = node;
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.95;

  const label = createLabel(node, text, Vec3.ZERO, 28, Color.WHITE);
  label.node.setPosition(0, 0, 0);

  node.on(Button.EventType.CLICK, onClick);
  node.setPosition(position);
  return node;
}
```

- [ ] **Step 2: Commit**

```bash
git add game/assets/scripts/ui/UIHelper.ts
git commit -m "feat: UI 节点工厂(label/rect/button)"
```

---

## Task 6: HomeUI + HomeRoot

**Files:**
- Create: `game/assets/scripts/ui/HomeUI.ts`
- Create: `game/assets/scripts/app/HomeRoot.ts`

- [ ] **Step 1: 写 HomeUI**

创建 `game/assets/scripts/ui/HomeUI.ts`:

```ts
import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createButton } from './UIHelper';
import { CARS, type PlayerProgress } from '../core';

export class HomeUI {
  constructor(private root: Node) {}

  build(progress: PlayerProgress, onStart: () => void): void {
    const car = CARS.find((c) => c.id === progress.currentCarId);
    createLabel(this.root, '动物赛车', new Vec3(0, 260, 0), 48, Color.WHITE);
    createLabel(this.root, `金币: ${progress.coins}`, new Vec3(0, 180, 0), 28, new Color(255, 220, 80));
    createLabel(this.root, `当前车: ${car?.name ?? '未知'}`, new Vec3(0, 120, 0), 24, Color.WHITE);
    createButton(this.root, '开始比赛', new Vec3(0, 0, 0), 240, 80, onStart);
  }
}
```

- [ ] **Step 2: 写 HomeRoot**

创建 `game/assets/scripts/app/HomeRoot.ts`:

```ts
import { _decorator, Component, director } from 'cc';
import { HomeUI } from '../ui/HomeUI';
import { SaveAdapter } from '../save/SaveAdapter';
import { GameState } from '../race/GameState';

const { ccclass } = _decorator;

@ccclass('HomeRoot')
export class HomeRoot extends Component {
  onLoad() {
    const progress = SaveAdapter.load();
    GameState.instance.currentCarId = progress.currentCarId;
    const ui = new HomeUI(this.node);
    ui.build(progress, () => director.loadScene('Race'));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add game/assets/scripts/ui/HomeUI.ts game/assets/scripts/app/HomeRoot.ts
git commit -m "feat: Home 场景启动组件与界面(显示车/金币 + 开始比赛)"
```

---

## Task 7: RaceHUD + RaceRoot

**Files:**
- Create: `game/assets/scripts/ui/RaceHUD.ts`
- Create: `game/assets/scripts/app/RaceRoot.ts`

- [ ] **Step 1: 写 RaceHUD**

创建 `game/assets/scripts/ui/RaceHUD.ts`:

```ts
import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createRect, createButton } from './UIHelper';
import type { RaceSimState } from '../core';

export class RaceHUD {
  private speedLabel!: Label;
  private timeLabel!: Label;
  private progressLabel!: Label;
  private staminaBar!: Node;
  private readonly staminaMaxWidth = 200;

  constructor(private root: Node) {}

  build(): void {
    this.speedLabel = createLabel(this.root, '速度: 0', new Vec3(-320, 280, 0), 22, Color.WHITE);
    this.timeLabel = createLabel(this.root, '用时: 0.0s', new Vec3(0, 280, 0), 22, Color.WHITE);
    this.progressLabel = createLabel(this.root, '进度: 0%', new Vec3(320, 280, 0), 22, Color.WHITE);

    createRect(this.root, this.staminaMaxWidth, 20, new Color(60, 60, 60), new Vec3(0, 220, 0));
    this.staminaBar = createRect(this.root, this.staminaMaxWidth, 20, new Color(90, 200, 120), new Vec3(0, 220, 0));
  }

  update(state: RaceSimState, staminaRatio: number, progressRatio: number): void {
    this.speedLabel.string = `速度: ${Math.round(state.speed)}`;
    this.timeLabel.string = `用时: ${state.time.toFixed(1)}s`;
    this.progressLabel.string = `进度: ${Math.round(progressRatio * 100)}%`;
    this.staminaBar.setScale(staminaRatio, 1, 1);
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

- [ ] **Step 2: 写 RaceRoot**

创建 `game/assets/scripts/app/RaceRoot.ts`:

```ts
import { _decorator, Component, Node, director, input, Input, Color, Vec3 } from 'cc';
import {
  CARS, LEVELS,
  computeFinalMaxSpeed, habitatMultiplier, computeStars, computeRewards,
  createRaceSimState, step, STAMINA_MAX,
  type RaceSimState,
} from '../core';
import { RaceHUD } from '../ui/RaceHUD';
import { GameState } from '../race/GameState';
import { SaveAdapter } from '../save/SaveAdapter';
import { createRect } from '../ui/UIHelper';

const { ccclass } = _decorator;

@ccclass('RaceRoot')
export class RaceRoot extends Component {
  private car = CARS.find((c) => c.id === GameState.instance.currentCarId) ?? CARS[0];
  private level = LEVELS[0];
  private carLevel = 1;
  private maxSpeed = 100;
  private state!: RaceSimState;
  private accelerating = false;
  private finished = false;
  private carNode!: Node;
  private hud!: RaceHUD;

  onLoad() {
    const progress = SaveAdapter.load();
    this.carLevel = progress.ownedCars.find((o) => o.carId === this.car.id)?.level ?? 1;
    this.maxSpeed = computeFinalMaxSpeed(
      this.car.baseSpeed,
      this.carLevel,
      habitatMultiplier(this.car.habitat, this.level.scene),
    );

    // 背景(占位)
    createRect(this.node, 800, 600, new Color(100, 160, 220), new Vec3(0, 0, 0));
    // 车(占位矩形)
    this.carNode = createRect(this.node, 60, 40, new Color(230, 120, 120), new Vec3(-350, -120, 0));

    this.hud = new RaceHUD(this.node);
    this.hud.build();
    this.state = createRaceSimState();

    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private onTouchStart() { this.accelerating = true; }
  private onTouchEnd() { this.accelerating = false; }

  update(dt: number) {
    if (this.finished) return;
    this.state = step(this.state, { accelerating: this.accelerating }, dt, {
      maxSpeed: this.maxSpeed,
      baseAccel: this.car.baseAccel,
    });

    const staminaRatio = this.state.stamina / STAMINA_MAX;
    const progressRatio = Math.min(1, this.state.distance / this.level.distance);
    this.hud.update(this.state, staminaRatio, progressRatio);

    const x = -350 + progressRatio * 700;
    this.carNode.setPosition(x, -120, 0);

    if (this.state.distance >= this.level.distance) {
      this.finish();
    }
  }

  private finish() {
    this.finished = true;
    const stars = computeStars(this.state.time, this.level.starTime);
    const coins = computeRewards(this.level, stars, this.carLevel);

    const progress = SaveAdapter.load();
    progress.coins += coins;
    SaveAdapter.save(progress);
    GameState.instance.lastResult = { stars, coins };

    this.hud.showSettlement(stars, coins, () => director.loadScene('Home'));
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add game/assets/scripts/ui/RaceHUD.ts game/assets/scripts/app/RaceRoot.ts
git commit -m "feat: Race 场景启动组件(逐帧模拟 + HUD + 结算)"
```

---

## Task 8: 创建场景 + 挂组件 + 加入构建列表(用户操作)

> 本步需要用户在 Cocos 编辑器里操作。

- [ ] **Step 1: 创建 Home 场景**

1. 在编辑器 **资源管理器(Assets)** 面板,右键 `assets/scenes`(没有就右键 `assets` 新建文件夹 `scenes`)→ **新建 → Scene**,命名 `Home`
2. 双击 `Home.scene` 打开
3. 在 **层级管理器(Hierarchy)** 右键 → **创建 → UI 组件 → Canvas**(会自动生成 Canvas 节点 + 一个 Camera 子节点)
4. 右键 Canvas → **创建 → 空节点**,命名 `HomeRoot`,确保其位置为 (0,0,0)
5. 选中 `HomeRoot`,在 **属性检查器(Inspector)** 点 **添加组件 → 搜索 `HomeRoot` → 点击添加**
6. Ctrl+S 保存场景

- [ ] **Step 2: 创建 Race 场景**

重复 Step 1 的流程,但:
- 场景命名 `Race`
- 空节点命名 `RaceRoot`
- 添加组件搜 `RaceRoot`

- [ ] **Step 3: 加入构建列表(场景切换必需)**

`director.loadScene('Race')` 按名字加载,要求两个场景都在构建列表中:

1. 菜单 **项目 → 项目设置 → 功能裁剪/构建** 或 **项目 → 构建发布**,找到 **"场景列表 / Scenes In Build"**
2. 确认 `Home` 和 `Race` 都在列表里(勾选或拖入),确保 `Home` 是**第一个**(作为启动场景)

Expected: 两个场景均已保存,构建列表含 Home、Race,Home 排第一。

---

## Task 9: 手动验证清单

> 表现层无法单测,靠跑起来验证。用 Cocos 编辑器顶部的**预览(▶)** 按钮即可在浏览器里跑,无需先构建微信。

- [ ] **Step 1: 预览跑通闭环**

1. 点编辑器顶部 **预览(播放按钮)**,浏览器打开
2. 预期看到 Home:标题"动物赛车"、金币 0、当前车"小猪车"、"开始比赛"绿色按钮

- [ ] **Step 2: 进入比赛**

1. 点"开始比赛"
2. 预期:切到 Race 场景,蓝色背景、红色方块(车)在左侧,顶部有速度/用时/进度,绿色体力条

- [ ] **Step 3: 加速与体力**

1. 按住屏幕:预期速度数字上升、车向右移动、绿色体力条变短
2. 松手:预期速度下降、体力条回升

- [ ] **Step 4: 体力见底滑行**

1. 一直按住不放直到体力条清空:预期速度被压到很低(约 30% 上限),车缓慢滑行,体力不再回升(仍按住)
2. 松手:预期体力开始回升

- [ ] **Step 5: 到达终点结算**

1. 继续跑完(约 1000 距离,进度到 100%):预期弹出结算面板,显示星级、金币
2. 点"返回":预期回到 Home,且金币数字已更新(累加了本次奖励)

- [ ] **Step 6: 存档持久化**

1. 关掉预览再重新预览,点进 Home:预期金币保留(说明 `sys.localStorage` 落盘生效)

- [ ] **Step 7: 微信开发者工具预览(可选)**

1. 菜单 **项目 → 构建发布 → 平台选"微信小游戏" → 构建**
2. 构建产物用微信开发者工具打开,真机/模拟器预览,确认触摸与存档在微信环境正常

**常见问题排查**:
- UI 不显示 → 检查 Canvas 是否创建、组件是否挂到 `HomeRoot`/`RaceRoot` 节点
- 按钮点了没反应 → 确认 Button 组件 target 指向自身节点;或用浏览器控制台看报错
- `loadScene('Race')` 报找不到场景 → 确认 Task 8 Step 3 两个场景已加入构建列表
- 浏览器控制台报 TS 编译错误 → 按报错修正组件代码(最常见是 import 路径或 API 名)

---

## 完成标准

- [ ] `cd core && npm test` 全绿(原 36 用例 + 新增 9 用例)
- [ ] `cd core && npx tsc --noEmit` 无错误
- [ ] `game/assets/scripts/` 下 7 个组件文件 + core 拷贝齐全
- [ ] Home、Race 两场景已建好并挂组件、加入构建列表
- [ ] 手动验证清单 Step 1~6 全部通过(闭环跑通 + 存档持久化)
- [ ] 所有 commit 仅本地,未 push
