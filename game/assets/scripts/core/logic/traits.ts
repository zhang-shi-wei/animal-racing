import type { Habitat, SceneType } from '../data/types';

export const HABITAT_BONUS = 1.2;

export function habitatMultiplier(habitat: Habitat, scene: SceneType): number {
  return habitat === scene ? HABITAT_BONUS : 1.0;
}

export type Trait = () => number;

export function computeMultiplier(traits: Trait[]): number {
  return traits.reduce((acc, t) => acc * t(), 1.0);
}
