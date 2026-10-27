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

describe('track simulator 碰撞', () => {
  it('撞外墙镜像反弹 ×0.6', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 0;
    rt.car.y = -90;
    rt.car.angle = -Math.PI / 2; // 朝 -y 撞外墙
    rt = step(rt, { steer: 0, boosting: false }, 0.5, baseParams, track);
    expect(rt.car.angle).toBeCloseTo(Math.PI / 2); // 反弹向上
    expect(rt.car.speed).toBeCloseTo(80 * 0.6);
  });

  it('撞内墙镜像反弹', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 0;
    rt.car.y = -70;
    rt.car.angle = Math.PI / 2; // 朝 +y 撞内墙
    rt = step(rt, { steer: 0, boosting: false }, 0.5, baseParams, track);
    expect(rt.car.angle).toBeCloseTo(-Math.PI / 2); // 反弹向下
    expect(rt.car.speed).toBeCloseTo(80 * 0.6);
  });

  it('进入障碍半径速度压到 defaultSpeed×slowdown', () => {
    const track = makeTrack({
      obstacles: [{ id: 'o', x: 50, y: -80, radius: 15, kind: 'puddle', slowdown: 0.3 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 50;
    rt.car.y = -80;
    rt = step(rt, { steer: 0, boosting: false }, 0.1, baseParams, track);
    expect(rt.car.speed).toBeCloseTo(80 * 0.3);
  });

  it('速度≥breakSpeed 一次撞破', () => {
    const track = makeTrack({
      breakableWalls: [{ id: 'w', x1: 50, y1: -100, x2: 50, y2: -60, durability: 5, breakSpeed: 120 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 45;
    rt.car.y = -80;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: true }, 0.01, baseParams, track); // 140 ≥ 120
    expect(rt.wallDurability['w']).toBe(0);
  });

  it('低速撞耐久-1并反弹,归0破', () => {
    const track = makeTrack({
      breakableWalls: [{ id: 'w', x1: 50, y1: -100, x2: 50, y2: -60, durability: 2, breakSpeed: 120 }],
    });
    let rt = createTrackRuntimeState(track, baseParams);
    rt.car.x = 45;
    rt.car.y = -80;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track); // 80 < 120
    expect(rt.wallDurability['w']).toBe(1);
    expect(rt.car.angle).toBeCloseTo(Math.PI); // 反弹朝 -x
    rt.car.x = 45;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.01, baseParams, track);
    expect(rt.wallDurability['w']).toBe(0);
  });
});

describe('track simulator 圈数', () => {
  it('正向穿过起跑线 lap++,反向不记', () => {
    const track = makeTrack();
    let rt = createTrackRuntimeState(track, baseParams); // (0,-80)
    rt.car.x = -10;
    rt.car.angle = 0;
    rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track); // +x 穿过 x=0
    expect(rt.car.lap).toBe(1);
    rt.car.x = 10;
    rt.car.angle = Math.PI;
    rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track); // -x 反向穿过
    expect(rt.car.lap).toBe(1);
  });

  it('反复正向穿过累计到设定圈数', () => {
    const track = makeTrack({ laps: 3 });
    let rt = createTrackRuntimeState(track, baseParams);
    for (let i = 0; i < 3; i++) {
      rt.car.x = -10;
      rt.car.angle = 0;
      rt = step(rt, { steer: 0, boosting: false }, 0.2, baseParams, track);
    }
    expect(rt.car.lap).toBe(3);
  });
});
