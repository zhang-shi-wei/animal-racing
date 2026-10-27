import type { TrackDefinition } from '../data/types';

const baseShape = { type: 'rounded-rect' as const, centerX: 0, centerY: 0, outerWidth: 320, outerHeight: 200, trackWidth: 40, cornerRadius: 30 };
const baseStartLine = { x1: 0, y1: -60, x2: 0, y2: -100 };

export const TRACKS: TrackDefinition[] = [
  {
    id: 'track-1',
    name: '斜穿捷径',
    scene: 'land',
    shape: baseShape,
    obstacles: [
      { id: 't1-o1', x: -80, y: -80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o2', x: 60, y: -80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o3', x: -60, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't1-o4', x: 80, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
    ],
    breakableWalls: [
      { id: 't1-wall', x1: -140, y1: -50, x2: -140, y2: -110, durability: 3, breakSpeed: 120 },
    ],
    shortcuts: [
      { id: 't1-shortcut', type: 'diagonal', entranceWallId: 't1-wall', path: [{ x: -140, y: -80 }, { x: -80, y: -40 }, { x: -20, y: 0 }, { x: 60, y: 60 }], width: 20 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [45, 70],
    rewards: { coins: 100, eggDropRate: 0.1 },
  },
  {
    id: 'track-2',
    name: '隐藏内环',
    scene: 'water',
    shape: baseShape,
    obstacles: [
      { id: 't2-o1', x: 140, y: 80, radius: 14, kind: 'rock', slowdown: 0.2 },
      { id: 't2-o2', x: -140, y: -80, radius: 14, kind: 'rock', slowdown: 0.2 },
    ],
    breakableWalls: [
      { id: 't2-wall', x1: -60, y1: -80, x2: -20, y2: -80, durability: 2, breakSpeed: 110 },
    ],
    shortcuts: [
      { id: 't2-shortcut', type: 'inner-loop', entranceWallId: 't2-wall', path: [{ x: -40, y: -80 }, { x: 0, y: -40 }, { x: 40, y: -80 }, { x: 0, y: -120 }], width: 16 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [50, 75],
    rewards: { coins: 150, eggDropRate: 0.15 },
  },
  {
    id: 'track-3',
    name: '短支路',
    scene: 'sky',
    shape: baseShape,
    obstacles: [
      { id: 't3-o1', x: 120, y: 80, radius: 12, kind: 'puddle', slowdown: 0.3 },
      { id: 't3-o2', x: 120, y: 70, radius: 12, kind: 'puddle', slowdown: 0.3 },
    ],
    breakableWalls: [
      { id: 't3-wall', x1: 120, y1: 70, x2: 120, y2: 90, durability: 4, breakSpeed: 130 },
    ],
    shortcuts: [
      { id: 't3-shortcut', type: 'branch', entranceWallId: 't3-wall', path: [{ x: 120, y: 80 }, { x: 180, y: 80 }, { x: 180, y: 140 }, { x: 120, y: 140 }], width: 16 },
    ],
    startLine: baseStartLine,
    laps: 3,
    starTime: [55, 80],
    rewards: { coins: 200, eggDropRate: 0.2 },
  },
];
