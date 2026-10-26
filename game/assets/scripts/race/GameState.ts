export interface RaceResult {
  stars: number;
  coins: number;
}

export class GameState {
  private static _instance: GameState | null = null;

  static get instance(): GameState {
    if (!this._instance) this._instance = new GameState();
    return this._instance;
  }

  currentCarId = 'pig';
  lastResult: RaceResult | null = null;
}
