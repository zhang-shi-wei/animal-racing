import { sys } from 'cc';
import { createDefaultProgress, serialize, deserialize, type PlayerProgress } from '../core';

const SAVE_KEY = 'animal-racing-save';

export class SaveAdapter {
  static load(): PlayerProgress {
    const raw = sys.localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultProgress();
    return deserialize(raw);
  }

  static save(progress: PlayerProgress): void {
    sys.localStorage.setItem(SAVE_KEY, serialize(progress));
  }
}
