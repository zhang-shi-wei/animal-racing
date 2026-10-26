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
  // rare egg: common 40% / rare 60%(暂不产出 epic,待加入 epic 车后恢复)
  if (r < 0.4) return 'common';
  return 'rare';
}
