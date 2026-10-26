# Animal Racing · 纯逻辑核心(core)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现游戏的全部纯逻辑规则(数据模型、配置、存档、升级、孵化、特性、比赛结算),作为一个不依赖 Cocos 的 TypeScript 模块,用 vitest 全量测试。

**Architecture:** `core/` 是独立的纯 TypeScript 模块,与渲染完全解耦。所有数值规则(升级消耗、抽卡概率、星级判定、特性系数)集中在此,后续 Cocos 项目通过 npm 依赖或直接引用这些源文件接入。随机数通过参数注入以便测试。

**Tech Stack:** TypeScript(ESM)、vitest、Node.js ≥ 18(已装 v24)。

---

## 前置条件

- Node.js v24 已装 ✓
- 本计划只做 `core/`,无需 Cocos Creator(那是第二阶段)
- 第二阶段(Cocos 表现层)需另装:Cocos Creator 3.8.x、微信开发者工具

## 文件结构

```
core/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    data/types.ts          # Rarity / Habitat / SceneType / CarDefinition / OwnedCar / Egg / Level / PlayerProgress
    config/cars.ts         # CARS: CarDefinition[] (5 种动物车)
    config/levels.ts       # LEVELS: Level[] (3 关,覆盖三种场景)
    logic/save.ts          # 存档序列化 / 反序列化 / 默认档 / 校验
    logic/upgrade.ts       # 升级消耗 / 速度收益系数 / 升级动作
    logic/hatch.ts         # 孵化时长 / 蛋状态 / 开蛋抽卡
    logic/traits.ts        # Trait 接口 / HabitatTrait / 系数合成
    logic/race.ts          # 最终速度 / 星级判定 / 结算奖励
    index.ts               # 统一导出
  tests/
    config.test.ts
    save.test.ts
    upgrade.test.ts
    hatch.test.ts
    traits.test.ts
    race.test.ts
```

**设计约定(贯穿所有任务,保持一致):**

| 常量 | 值 |
|------|-----|
| MAX_LEVEL | 10 |
| 升级消耗(level → level+1) | `100 * level` |
| 每级速度加成 | `1 + (level - 1) * 0.05` |
| 每级收益加成 | `1 + (level - 1) * 0.05` |
| 隐藏特性加成 | 适配场景 `×1.2`,否则 `×1.0` |
| 孵化时长 | common 蛋 7200s,rare 蛋 28800s |
| 星级金币系数 | 3星 `1.5` / 2星 `1.2` / 1星 `1.0` |

---

## Task 1: 项目脚手架

**Files:**
- Create: `core/package.json`
- Create: `core/tsconfig.json`
- Create: `core/vitest.config.ts`
- Create: `core/src/index.ts`
- Test: `core/tests/smoke.test.ts`

- [ ] **Step 1: 写冒烟测试**

创建 `core/tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('core smoke test', () => {
  it('loads the module', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 写配置文件**

创建 `core/package.json`:

```json
{
  "name": "animal-racing-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

创建 `core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

创建 `core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

创建 `core/src/index.ts`(空导出,后续任务补):

```ts
export {};
```

- [ ] **Step 3: 安装依赖**

Run: `cd core && npm install`
Expected: 安装成功,生成 `node_modules/` 和 `package-lock.json`

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: `1 passed`,冒烟测试通过

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/package.json core/package-lock.json core/tsconfig.json core/vitest.config.ts core/src/index.ts core/tests/smoke.test.ts
git commit -m "chore: 搭建 core 纯逻辑模块脚手架(vitest + ts)"
```

---

## Task 2: 数据模型与配置

**Files:**
- Create: `core/src/data/types.ts`
- Create: `core/src/config/cars.ts`
- Create: `core/src/config/levels.ts`
- Test: `core/tests/config.test.ts`

- [ ] **Step 1: 写失败测试(验证配置数据完整性)**

创建 `core/tests/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CARS } from '../src/config/cars';
import { LEVELS } from '../src/config/levels';

describe('config data', () => {
  it('has 5 cars covering all three habitats', () => {
    expect(CARS).toHaveLength(5);
    const habitats = new Set(CARS.map((c) => c.habitat));
    expect(habitats).toEqual(new Set(['land', 'water', 'sky']));
  });

  it('car ids are unique', () => {
    const ids = CARS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 3 levels covering all three scenes', () => {
    expect(LEVELS).toHaveLength(3);
    const scenes = new Set(LEVELS.map((l) => l.scene));
    expect(scenes).toEqual(new Set(['land', 'water', 'sky']));
  });

  it('star time thresholds are valid (three-star < two-star)', () => {
    for (const level of LEVELS) {
      expect(level.starTime[0]).toBeLessThan(level.starTime[1]);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/config/cars'`

- [ ] **Step 3: 写类型定义与配置**

创建 `core/src/data/types.ts`:

```ts
export type Rarity = 'common' | 'rare' | 'epic';
export type Habitat = 'land' | 'water' | 'sky';
export type SceneType = 'land' | 'water' | 'sky';

export interface CarDefinition {
  id: string;
  name: string;
  animal: string;
  rarity: Rarity;
  baseSpeed: number;   // 最大速度上限
  baseAccel: number;   // 加速度(按住时速度上升速率)
  habitat: Habitat;    // 场景亲和(隐藏特性)
  circadian?: 'diurnal' | 'nocturnal' | 'crepuscular'; // 预留:作息类型
}

export interface OwnedCar {
  carId: string;
  level: number;
  satiety?: number; // 预留:当前饱腹度 0~100
}

export type EggRarity = 'common' | 'rare';

export interface Egg {
  id: string;
  rarity: EggRarity;
  hatchDuration: number; // 秒
  startTime: number;     // 开始孵化时间戳(ms)
  resultCarId: string;   // 孵化结果车 id
}

export interface Level {
  id: string;
  name: string;
  scene: SceneType;
  distance: number;
  starTime: [number, number]; // [三星阈值, 两星阈值] 秒
  rewards: { coins: number; eggDropRate: number };
}

export interface PlayerProgress {
  coins: number;
  currentCarId: string;
  ownedCars: OwnedCar[];
  eggs: Egg[];
  unlockedLevel: number;
}
```

创建 `core/src/config/cars.ts`:

```ts
import type { CarDefinition } from '../data/types';

export const CARS: CarDefinition[] = [
  { id: 'pig',    name: '小猪车',   animal: '猪', rarity: 'common', baseSpeed: 100, baseAccel: 30, habitat: 'land' },
  { id: 'turtle', name: '小乌龟车', animal: '龟', rarity: 'common', baseSpeed: 90,  baseAccel: 25, habitat: 'water' },
  { id: 'chick',  name: '小鸡车',   animal: '鸡', rarity: 'common', baseSpeed: 95,  baseAccel: 28, habitat: 'land' },
  { id: 'fish',   name: '小鱼车',   animal: '鱼', rarity: 'rare',   baseSpeed: 110, baseAccel: 32, habitat: 'water' },
  { id: 'bird',   name: '小鸟车',   animal: '鸟', rarity: 'rare',   baseSpeed: 115, baseAccel: 35, habitat: 'sky' },
];
```

创建 `core/src/config/levels.ts`:

```ts
import type { Level } from '../data/types';

export const LEVELS: Level[] = [
  { id: 'level-1', name: '草原赛道', scene: 'land',  distance: 1000, starTime: [30, 45], rewards: { coins: 100, eggDropRate: 0.1 } },
  { id: 'level-2', name: '河流赛道', scene: 'water', distance: 1200, starTime: [35, 50], rewards: { coins: 150, eggDropRate: 0.15 } },
  { id: 'level-3', name: '云端赛道', scene: 'sky',   distance: 1400, starTime: [40, 60], rewards: { coins: 200, eggDropRate: 0.2 } },
];
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS,配置测试通过

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/data/types.ts core/src/config/cars.ts core/src/config/levels.ts core/tests/config.test.ts
git commit -m "feat: 添加数据模型与车辆/关卡配置"
```

---

## Task 3: 存档系统(save)

**Files:**
- Create: `core/src/logic/save.ts`
- Test: `core/tests/save.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/save.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDefaultProgress, serialize, deserialize } from '../src/logic/save';

describe('save system', () => {
  it('creates a default progress with a starter car', () => {
    const p = createDefaultProgress();
    expect(p.coins).toBe(0);
    expect(p.ownedCars).toHaveLength(1);
    expect(p.ownedCars[0]).toEqual({ carId: 'pig', level: 1 });
    expect(p.currentCarId).toBe('pig');
    expect(p.unlockedLevel).toBe(0);
    expect(p.eggs).toEqual([]);
  });

  it('round-trips through serialize/deserialize', () => {
    const p = createDefaultProgress();
    p.coins = 500;
    const restored = deserialize(serialize(p));
    expect(restored).toEqual(p);
  });

  it('returns default progress on corrupt input', () => {
    const restored = deserialize('not-json{{{');
    expect(restored).toEqual(createDefaultProgress());
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/save'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/save.ts`:

```ts
import type { PlayerProgress } from '../data/types';

export function createDefaultProgress(): PlayerProgress {
  return {
    coins: 0,
    currentCarId: 'pig',
    ownedCars: [{ carId: 'pig', level: 1 }],
    eggs: [],
    unlockedLevel: 0,
  };
}

export function serialize(progress: PlayerProgress): string {
  return JSON.stringify(progress);
}

export function deserialize(json: string): PlayerProgress {
  try {
    const parsed = JSON.parse(json) as PlayerProgress;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ownedCars)) {
      return parsed;
    }
    return createDefaultProgress();
  } catch {
    return createDefaultProgress();
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/logic/save.ts core/tests/save.test.ts
git commit -m "feat: 实现存档序列化与默认档"
```

---

## Task 4: 升级系统(upgrade)

**Files:**
- Create: `core/src/logic/upgrade.ts`
- Test: `core/tests/upgrade.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/upgrade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MAX_LEVEL, upgradeCost, speedMultiplier, incomeMultiplier, canUpgrade, upgrade } from '../src/logic/upgrade';

describe('upgrade system', () => {
  it('cost grows linearly with level', () => {
    expect(upgradeCost(1)).toBe(100);
    expect(upgradeCost(5)).toBe(500);
  });

  it('speed multiplier grows 5% per level', () => {
    expect(speedMultiplier(1)).toBeCloseTo(1);
    expect(speedMultiplier(3)).toBeCloseTo(1.1);
  });

  it('income multiplier grows 5% per level', () => {
    expect(incomeMultiplier(1)).toBeCloseTo(1);
    expect(incomeMultiplier(3)).toBeCloseTo(1.1);
  });

  it('cannot upgrade beyond max level', () => {
    expect(canUpgrade(MAX_LEVEL, 99999)).toBe(false);
  });

  it('cannot upgrade without enough coins', () => {
    expect(canUpgrade(1, 50)).toBe(false);
    expect(canUpgrade(1, 100)).toBe(true);
  });

  it('upgrade deducts coins and raises level', () => {
    const result = upgrade({ coins: 500, level: 1 });
    expect(result).toEqual({ coins: 400, level: 2 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/upgrade'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/upgrade.ts`:

```ts
export const MAX_LEVEL = 10;

export function upgradeCost(level: number): number {
  return 100 * level;
}

export function speedMultiplier(level: number): number {
  return 1 + (level - 1) * 0.05;
}

export function incomeMultiplier(level: number): number {
  return 1 + (level - 1) * 0.05;
}

export function canUpgrade(level: number, coins: number): boolean {
  return level < MAX_LEVEL && coins >= upgradeCost(level);
}

export function upgrade(state: { coins: number; level: number }): { coins: number; level: number } {
  if (!canUpgrade(state.level, state.coins)) {
    throw new Error('cannot upgrade');
  }
  return {
    coins: state.coins - upgradeCost(state.level),
    level: state.level + 1,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/logic/upgrade.ts core/tests/upgrade.test.ts
git commit -m "feat: 实现升级系统(消耗/速度/收益系数)"
```

---

## Task 5: 孵化系统(hatch)

**Files:**
- Create: `core/src/logic/hatch.ts`
- Test: `core/tests/hatch.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/hatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HATCH_DURATION, eggState, rollCar } from '../src/logic/hatch';

describe('hatch system', () => {
  it('defines hatch durations for each egg rarity', () => {
    expect(HATCH_DURATION.common).toBe(7200);
    expect(HATCH_DURATION.rare).toBe(28800);
  });

  it('egg is hatching before duration elapses', () => {
    const start = 1_000_000;
    const state = eggState('common', start, start + 1000);
    expect(state).toBe('hatching');
  });

  it('egg is ready after duration elapses', () => {
    const start = 1_000_000;
    const state = eggState('common', start, start + 7200 * 1000);
    expect(state).toBe('ready');
  });

  it('common egg mostly rolls common cars', () => {
    // rng = 0.5 落在 common 区间
    expect(rollCar('common', () => 0.5)).toBe('common');
  });

  it('common egg rolls rare at high rng', () => {
    expect(rollCar('common', () => 0.95)).toBe('rare');
  });

  it('rare egg rolls epic at very high rng', () => {
    expect(rollCar('rare', () => 0.99)).toBe('epic');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/hatch'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/hatch.ts`:

```ts
import type { EggRarity, Rarity } from '../data/types';

export const HATCH_DURATION: Record<EggRarity, number> = {
  common: 7200,   // 2 小时
  rare: 28800,    // 8 小时
};

export type EggState = 'hatching' | 'ready';

export function eggState(rarity: EggRarity, startTime: number, now: number): EggState {
  return now - startTime >= HATCH_DURATION[rarity] * 1000 ? 'ready' : 'hatching';
}

// rng: () => number 返回 [0, 1)
export function rollCar(eggRarity: EggRarity, rng: () => number): Rarity {
  const r = rng();
  if (eggRarity === 'common') {
    return r < 0.9 ? 'common' : 'rare';
  }
  // rare egg: common 40% / rare 50% / epic 10%
  if (r < 0.4) return 'common';
  if (r < 0.9) return 'rare';
  return 'epic';
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/logic/hatch.ts core/tests/hatch.test.ts
git commit -m "feat: 实现孵化系统(时长/状态/开蛋抽卡)"
```

---

## Task 6: 特性系统(traits)

**Files:**
- Create: `core/src/logic/traits.ts`
- Test: `core/tests/traits.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/traits.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HABITAT_BONUS, habitatMultiplier, computeMultiplier } from '../src/logic/traits';

describe('trait system', () => {
  it('habitat bonus is 1.2 when matching', () => {
    expect(HABITAT_BONUS).toBe(1.2);
    expect(habitatMultiplier('water', 'water')).toBe(1.2);
  });

  it('habitat multiplier is 1.0 when not matching', () => {
    expect(habitatMultiplier('land', 'water')).toBe(1.0);
  });

  it('multiplies all trait coefficients together', () => {
    const traits = [() => 1.2, () => 1.1];
    expect(computeMultiplier(traits)).toBeCloseTo(1.32);
  });

  it('no traits gives 1.0', () => {
    expect(computeMultiplier([])).toBe(1.0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/traits'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/traits.ts`:

```ts
import type { Habitat, SceneType } from '../data/types';

export const HABITAT_BONUS = 1.2;

export function habitatMultiplier(habitat: Habitat, scene: SceneType): number {
  return habitat === scene ? HABITAT_BONUS : 1.0;
}

export type Trait = () => number;

export function computeMultiplier(traits: Trait[]): number {
  return traits.reduce((acc, t) => acc * t(), 1.0);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/logic/traits.ts core/tests/traits.test.ts
git commit -m "feat: 实现特性系统(栖息地加成与系数合成)"
```

---

## Task 7: 比赛结算(race)

**Files:**
- Create: `core/src/logic/race.ts`
- Test: `core/tests/race.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `core/tests/race.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeFinalMaxSpeed, computeStars, computeRewards } from '../src/logic/race';
import { LEVELS } from '../src/config/levels';
import { CARS } from '../src/config/cars';

describe('race system', () => {
  it('computes final max speed from base, level and trait', () => {
    const car = CARS.find((c) => c.id === 'pig')!;
    // baseSpeed 100, level 3 => ×1.1, trait 1.0
    expect(computeFinalMaxSpeed(car.baseSpeed, 3, 1.0)).toBeCloseTo(110);
  });

  it('three stars when time beats first threshold', () => {
    expect(computeStars(29, [30, 45])).toBe(3);
  });

  it('two stars between thresholds', () => {
    expect(computeStars(40, [30, 45])).toBe(2);
  });

  it('one star after second threshold', () => {
    expect(computeStars(50, [30, 45])).toBe(1);
  });

  it('rewards scale with stars and income multiplier', () => {
    const level = LEVELS[0]; // coins 100
    // 3 星 ×1.5, level 3 收益 ×1.1 => 100 * 1.5 * 1.1 = 165
    expect(computeRewards(level, 3, 3)).toBe(165);
  });

  it('rewards are integer coins', () => {
    const level = LEVELS[0];
    expect(Number.isInteger(computeRewards(level, 2, 1))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd core && npm test`
Expected: FAIL,报 `Cannot find module '../src/logic/race'`

- [ ] **Step 3: 写实现**

创建 `core/src/logic/race.ts`:

```ts
import type { Level } from '../data/types';
import { speedMultiplier, incomeMultiplier } from './upgrade';

export function computeFinalMaxSpeed(baseSpeed: number, level: number, traitMultiplier: number): number {
  return baseSpeed * speedMultiplier(level) * traitMultiplier;
}

export function computeStars(elapsedSeconds: number, starTime: [number, number]): number {
  if (elapsedSeconds <= starTime[0]) return 3;
  if (elapsedSeconds <= starTime[1]) return 2;
  return 1;
}

const STAR_COIN_MULTIPLIER: Record<number, number> = {
  3: 1.5,
  2: 1.2,
  1: 1.0,
};

export function computeRewards(level: Level, stars: number, carLevel: number): number {
  return Math.floor(level.rewards.coins * STAR_COIN_MULTIPLIER[stars] * incomeMultiplier(carLevel));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd core && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/Workspace/game
git add core/src/logic/race.ts core/tests/race.test.ts
git commit -m "feat: 实现比赛结算(最终速度/星级/奖励)"
```

---

## Task 8: 统一导出

**Files:**
- Modify: `core/src/index.ts`

- [ ] **Step 1: 导出所有公共 API**

将 `core/src/index.ts` 改为:

```ts
export * from './data/types';
export { CARS } from './config/cars';
export { LEVELS } from './config/levels';
export { createDefaultProgress, serialize, deserialize } from './logic/save';
export { MAX_LEVEL, upgradeCost, speedMultiplier, incomeMultiplier, canUpgrade, upgrade } from './logic/upgrade';
export { HATCH_DURATION, eggState, rollCar } from './logic/hatch';
export type { EggState } from './logic/hatch';
export { HABITAT_BONUS, habitatMultiplier, computeMultiplier } from './logic/traits';
export type { Trait } from './logic/traits';
export { computeFinalMaxSpeed, computeStars, computeRewards } from './logic/race';
```

- [ ] **Step 2: 运行完整测试套件确认全绿**

Run: `cd core && npm test`
Expected: 所有测试通过(6 个测试文件,约 30 个用例)

- [ ] **Step 3: 运行类型检查**

Run: `cd core && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
cd D:/Workspace/game
git add core/src/index.ts
git commit -m "feat: 统一导出 core 公共 API"
```

---

## 完成标准

- `cd core && npm test` 全绿
- `cd core && npx tsc --noEmit` 无错误
- 所有纯逻辑规则(数据模型、配置、存档、升级、孵化、特性、比赛结算)均被测试覆盖
- 后续 Cocos 表现层只需 `import { ... } from 'animal-racing-core'` 或直接引用 `core/src`,即可接入这些规则
