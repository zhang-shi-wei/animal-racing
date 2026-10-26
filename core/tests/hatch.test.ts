import { describe, it, expect } from 'vitest';
import { HATCH_DURATION, eggState, rollCar } from '../src/logic/hatch';

describe('hatch system', () => {
  it('defines hatch durations for each egg rarity', () => {
    expect(HATCH_DURATION.common).toBe(7200);
    expect(HATCH_DURATION.rare).toBe(28800);
  });

  it('egg is hatching before duration elapses', () => {
    const start = 1_000_000;
    const state = eggState('common', start, start + 1000);
    expect(state).toBe('hatching');
  });

  it('egg is ready after duration elapses', () => {
    const start = 1_000_000;
    const state = eggState('common', start, start + 7200 * 1000);
    expect(state).toBe('ready');
  });

  it('common egg mostly rolls common cars', () => {
    // rng = 0.5 落在 common 区间
    expect(rollCar('common', () => 0.5)).toBe('common');
  });

  it('common egg rolls rare at high rng', () => {
    expect(rollCar('common', () => 0.95)).toBe('rare');
  });

  it('rare egg rolls common at low rng', () => {
    expect(rollCar('rare', () => 0.1)).toBe('common');
  });

  it('rare egg rolls rare at high rng', () => {
    expect(rollCar('rare', () => 0.99)).toBe('rare');
  });
});
