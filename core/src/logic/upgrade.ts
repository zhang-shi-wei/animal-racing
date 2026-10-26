export const MAX_LEVEL = 10;

export function upgradeCost(level: number): number {
  return 100 * level;
}

export function speedMultiplier(level: number): number {
  return 1 + (level - 1) * 0.05;
}

export function incomeMultiplier(level: number): number {
  return 1 + (level - 1) * 0.05;
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
