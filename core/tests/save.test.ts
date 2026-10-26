import { describe, it, expect } from 'vitest';
import { createDefaultProgress, serialize, deserialize } from '../src/logic/save';

describe('save system', () => {
  it('creates a default progress with a starter car', () => {
    const p = createDefaultProgress();
    expect(p.coins).toBe(0);
    expect(p.ownedCars).toHaveLength(1);
    expect(p.ownedCars[0]).toEqual({ carId: 'pig', level: 1 });
    expect(p.currentCarId).toBe('pig');
    expect(p.unlockedLevel).toBe(0);
    expect(p.eggs).toEqual([]);
  });

  it('round-trips through serialize/deserialize', () => {
    const p = createDefaultProgress();
    p.coins = 500;
    const restored = deserialize(serialize(p));
    expect(restored).toEqual(p);
  });

  it('returns default progress on corrupt input', () => {
    const restored = deserialize('not-json{{{');
    expect(restored).toEqual(createDefaultProgress());
  });
});
