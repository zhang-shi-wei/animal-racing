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
