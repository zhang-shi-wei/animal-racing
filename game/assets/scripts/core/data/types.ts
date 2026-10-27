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
