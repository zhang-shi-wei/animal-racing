import type { Level } from '../data/types';

export const LEVELS: Level[] = [
  { id: 'level-1', name: '草原赛道', scene: 'land',  distance: 1000, starTime: [30, 45], rewards: { coins: 100, eggDropRate: 0.1 } },
  { id: 'level-2', name: '河流赛道', scene: 'water', distance: 1200, starTime: [35, 50], rewards: { coins: 150, eggDropRate: 0.15 } },
  { id: 'level-3', name: '云端赛道', scene: 'sky',   distance: 1400, starTime: [40, 60], rewards: { coins: 200, eggDropRate: 0.2 } },
];
