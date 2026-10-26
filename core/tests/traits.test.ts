import { describe, it, expect } from 'vitest';
import { HABITAT_BONUS, habitatMultiplier, computeMultiplier } from '../src/logic/traits';

describe('trait system', () => {
  it('habitat bonus is 1.2 when matching', () => {
    expect(HABITAT_BONUS).toBe(1.2);
    expect(habitatMultiplier('water', 'water')).toBe(1.2);
  });

  it('habitat multiplier is 1.0 when not matching', () => {
    expect(habitatMultiplier('land', 'water')).toBe(1.0);
  });

  it('multiplies all trait coefficients together', () => {
    const traits = [() => 1.2, () => 1.1];
    expect(computeMultiplier(traits)).toBeCloseTo(1.32);
  });

  it('no traits gives 1.0', () => {
    expect(computeMultiplier([])).toBe(1.0);
  });
});
