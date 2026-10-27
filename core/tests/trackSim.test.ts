import { describe, it, expect } from 'vitest';
import { createTrackRuntimeState, step, type TrackParams, type TrackRuntimeState } from '../src/logic/trackSim';
import type { TrackDefinition } from '../src/data/types';

function makeTrack(overrides: Partial<TrackDefinition> = {}): TrackDefinition {
  return {
    id: 'test',
    name: 'test',
    scene: 'land',
    shape: { type: 'rounded-rect', centerX: 0, centerY: 0, outerWidth: 320, outerHeight: 200, trackWidth: 40, cornerRadius: 30 },
    obstacles: [],
    breakableWalls: [],
    shortcuts: [],
    startLine: { x1: 0, y1: -60, x2: 0, y2: -100 },
    laps: 3,
    starTime: [45, 70],
    rewards: { coins: 100, eggDropRate: 0.1 },
    ...overrides,
  };
}

const baseParams: TrackParams = {
  defaultSpeed: 80,
  boostSpeed: 140,
  turnRate: 2,
  nitroMax: 100,
  nitroDrain: 40,
  nitroRegen: 25,
  bounceSpeedFactor: 0.6,
};

describe('track simulator 核心', () => {
  it('默认速度沿 angle 前进', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams); // (0,-80) angle 0
    rt = step(rt, { steer: 0, boosting: false }, 0.1, baseParams, track);
    expect(rt.car.x).toBeCloseTo(8);      // 80 * 0.1
    expect(rt.car.y).toBeCloseTo(-80);
    expect(rt.car.speed).toBeCloseTo(80);
  });

  it('左转(+1)增大 angle,右转(-1)减小 angle', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    const a0 = rt.car.angle;
    const left = step(rt, { steer: 1, boosting: false }, 0.01, baseParams, track);
    expect(left.car.angle).toBeCloseTo(a0 + 2 * 0.01);
    const right = step(rt, { steer: -1, boosting: false }, 0.01, baseParams, track);
    expect(right.car.angle).toBeCloseTo(a0 - 2 * 0.01);
  });

  it('boosting 速度=boostSpeed 且氮气减少', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt = step(rt, { steer: 0, boosting: true }, 1, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(140);
    expect(rt.car.nitro).toBeCloseTo(100 - 40);
  });

  it('氮气耗尽后仍按住,速度回默认', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.nitro = 0.1;
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(0);
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(80);
  });

  it('松手氮气回复并封顶', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.nitro = 10;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(10 + 25 * 0.01);
    rt.car.nitro = 99.9;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.car.nitro).toBeCloseTo(100);
  });
});
