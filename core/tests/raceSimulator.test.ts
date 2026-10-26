import { describe, it, expect } from 'vitest';
import {
  STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, DECEL_RATE, COAST_RATIO,
  createRaceSimState, step,
} from '../src/logic/raceSimulator';

describe('race simulator', () => {
  const params = { maxSpeed: 100, baseAccel: 30 };

  it('starts at zero speed and full stamina', () => {
    const s = createRaceSimState();
    expect(s.speed).toBe(0);
    expect(s.stamina).toBe(STAMINA_MAX);
    expect(s.distance).toBe(0);
    expect(s.time).toBe(0);
  });

  it('accelerates while holding', () => {
    const s0 = createRaceSimState();
    const s1 = step(s0, { accelerating: true }, 1, params);
    expect(s1.speed).toBeCloseTo(30);
    expect(s1.stamina).toBeCloseTo(STAMINA_MAX - STAMINA_DRAIN);
  });

  it('never exceeds max speed', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 4; i++) s = step(s, { accelerating: true }, 1, params);
    expect(s.speed).toBeLessThanOrEqual(params.maxSpeed);
    expect(s.speed).toBeCloseTo(params.maxSpeed);
  });

  it('decelerates and regens stamina when released', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 1, params);
    const s2 = step(s, { accelerating: false }, 1, params);
    expect(s2.speed).toBe(0);
    expect(s2.stamina).toBeCloseTo(95);
  });

  it('caps speed to coast ratio when stamina empty, and does not regen while holding', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 5; i++) s = step(s, { accelerating: true }, 1, params);
    expect(s.stamina).toBeCloseTo(0);
    expect(s.speed).toBeCloseTo(100);
    const s2 = step(s, { accelerating: true }, 1, params);
    expect(s2.speed).toBeCloseTo(params.maxSpeed * COAST_RATIO);
    expect(s2.stamina).toBe(0);
  });

  it('accumulates distance as speed * dt', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 1, params);
    expect(s.distance).toBeCloseTo(30);
  });

  it('accumulates time', () => {
    let s = createRaceSimState();
    s = step(s, { accelerating: true }, 0.5, params);
    expect(s.time).toBeCloseTo(0.5);
  });

  it('stamina stays within [0, max] and speed within [0, max]', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 100; i++) {
      s = step(s, { accelerating: i % 2 === 0 }, 0.1, params);
      expect(s.stamina).toBeGreaterThanOrEqual(0);
      expect(s.stamina).toBeLessThanOrEqual(STAMINA_MAX);
      expect(s.speed).toBeGreaterThanOrEqual(0);
      expect(s.speed).toBeLessThanOrEqual(params.maxSpeed);
    }
  });

  it('regenerates stamina only when released', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 5; i++) s = step(s, { accelerating: true }, 1, params);
    expect(s.stamina).toBe(0);
    const held = step(s, { accelerating: true }, 1, params);
    expect(held.stamina).toBe(0);
    const released = step(s, { accelerating: false }, 1, params);
    expect(released.stamina).toBeCloseTo(STAMINA_REGEN);
  });

  it('released at zero stamina caps speed to coast ratio', () => {
    let s = createRaceSimState();
    for (let i = 0; i < 5; i++) s = step(s, { accelerating: true }, 1, params);
    expect(s.stamina).toBe(0);
    expect(s.speed).toBeCloseTo(params.maxSpeed);
    const released = step(s, { accelerating: false }, 1, params);
    expect(released.speed).toBeCloseTo(params.maxSpeed * COAST_RATIO);
    expect(released.stamina).toBeCloseTo(STAMINA_REGEN);
  });
});
