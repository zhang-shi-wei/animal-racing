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
