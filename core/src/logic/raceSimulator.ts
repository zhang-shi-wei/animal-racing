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
  maxSpeed: number;
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
