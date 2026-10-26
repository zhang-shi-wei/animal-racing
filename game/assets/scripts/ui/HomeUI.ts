import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createButton } from './UIHelper';
import { CARS, type PlayerProgress } from '../core';

export class HomeUI {
  constructor(private root: Node) {}

  build(progress: PlayerProgress, onStart: () => void): void {
    const car = CARS.find((c) => c.id === progress.currentCarId);
    createLabel(this.root, '动物赛车', new Vec3(0, 260, 0), 48, Color.WHITE);
    createLabel(this.root, `金币: ${progress.coins}`, new Vec3(0, 180, 0), 28, new Color(255, 220, 80));
    createLabel(this.root, `当前车: ${car?.name ?? '未知'}`, new Vec3(0, 120, 0), 24, Color.WHITE);
    createButton(this.root, '开始比赛', new Vec3(0, 0, 0), 240, 80, onStart);
  }
}
