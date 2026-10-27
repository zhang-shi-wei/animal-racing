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

export function computeRewards(track: { rewards: { coins: number } }, stars: number, carLevel: number): number {
  return Math.floor(track.rewards.coins * STAR_COIN_MULTIPLIER[stars] * incomeMultiplier(carLevel));
}
