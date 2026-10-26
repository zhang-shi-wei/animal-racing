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
