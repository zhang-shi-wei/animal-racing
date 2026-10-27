import type { TrackDefinition, PlacedObstacle, PlacedBreakableWall, TrackShape, Segment } from '../data/types';

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
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // 4. 碰撞:障碍 → 边界墙 → 可破坏墙
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

  return { car, wallDurability: wallResult.wallDurability };
}

function sideOfLine(px: number, py: number, line: Segment): number {
  const cross = (line.x2 - line.x1) * (py - line.y1) - (line.y2 - line.y1) * (px - line.x1);
  return Math.sign(cross);
}

function crossedStartLine(prevX: number, prevY: number, x: number, y: number, line: Segment): boolean {
  return sideOfLine(prevX, prevY, line) < 0 && sideOfLine(x, y, line) >= 0;
}

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
