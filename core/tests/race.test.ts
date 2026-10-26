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

  it('three stars when time equals first threshold', () => {
    expect(computeStars(30, [30, 45])).toBe(3);
  });

  it('two stars when time equals second threshold', () => {
    expect(computeStars(45, [30, 45])).toBe(2);
  });

  it('rewards are floored to integer', () => {
    const level = LEVELS[1]; // coins 150
    // 3 星 ×1.5, level 2 收益 ×1.05 => 150 * 1.5 * 1.05 = 236.25 -> floor 236
    expect(computeRewards(level, 3, 2)).toBe(236);
  });

  it('applies trait multiplier to final max speed', () => {
    // baseSpeed 100, level 3 => ×1.1, trait 1.2 => 132
    expect(computeFinalMaxSpeed(100, 3, 1.2)).toBeCloseTo(132);
  });
});
