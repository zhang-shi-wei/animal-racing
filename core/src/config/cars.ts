import type { CarDefinition } from '../data/types';

export const CARS: CarDefinition[] = [
  { id: 'pig',    name: '小猪车',   animal: '猪', rarity: 'common', baseSpeed: 100, baseAccel: 30, habitat: 'land' },
  { id: 'turtle', name: '小乌龟车', animal: '龟', rarity: 'common', baseSpeed: 90,  baseAccel: 25, habitat: 'water' },
  { id: 'chick',  name: '小鸡车',   animal: '鸡', rarity: 'common', baseSpeed: 95,  baseAccel: 28, habitat: 'land' },
  { id: 'fish',   name: '小鱼车',   animal: '鱼', rarity: 'rare',   baseSpeed: 110, baseAccel: 32, habitat: 'water' },
  { id: 'bird',   name: '小鸟车',   animal: '鸟', rarity: 'rare',   baseSpeed: 115, baseAccel: 35, habitat: 'sky' },
];
