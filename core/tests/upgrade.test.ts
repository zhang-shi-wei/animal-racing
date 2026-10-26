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

  it('upgrade throws on invalid upgrade', () => {
    expect(() => upgrade({ coins: 50, level: 1 })).toThrow();
    expect(() => upgrade({ coins: 99999, level: MAX_LEVEL })).toThrow();
  });
});
