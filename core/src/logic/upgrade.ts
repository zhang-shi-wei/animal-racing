export const MAX_LEVEL = 10;

const UPGRADE_BASE_COST = 100;
const LEVEL_BONUS = 0.05;

export function upgradeCost(level: number): number {
  return UPGRADE_BASE_COST * level;
}

export function speedMultiplier(level: number): number {
  return 1 + (level - 1) * LEVEL_BONUS;
}

export function incomeMultiplier(level: number): number {
  return 1 + (level - 1) * LEVEL_BONUS;
}

export function canUpgrade(level: number, coins: number): boolean {
  return level < MAX_LEVEL && coins >= upgradeCost(level);
}

export function upgrade(state: { coins: number; level: number }): { coins: number; level: number } {
  if (!canUpgrade(state.level, state.coins)) {
    throw new Error('cannot upgrade');
  }
  return {
    coins: state.coins - upgradeCost(state.level),
    level: state.level + 1,
  };
}
