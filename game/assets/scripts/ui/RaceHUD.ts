import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createRect, createButton } from './UIHelper';
import type { CarState, TrackParams } from '../core';

export class RaceHUD {
  private lapLabel!: Label;
  private timeLabel!: Label;
  private speedLabel!: Label;
  private nitroBar!: Node;
  private readonly nitroMaxWidth = 200;

  constructor(private root: Node) {}

  build(trackLaps: number): void {
    this.lapLabel = createLabel(this.root, `圈数: 1/${trackLaps}`, new Vec3(-320, 280, 0), 22, Color.WHITE);
    this.timeLabel = createLabel(this.root, '用时: 0.0s', new Vec3(0, 280, 0), 22, Color.WHITE);
    this.speedLabel = createLabel(this.root, '速度: 0', new Vec3(320, 280, 0), 22, Color.WHITE);

    createRect(this.root, this.nitroMaxWidth, 18, new Color(60, 60, 60), new Vec3(0, 240, 0));
    this.nitroBar = createRect(this.root, this.nitroMaxWidth, 18, new Color(80, 160, 240), new Vec3(0, 240, 0));
  }

  update(car: CarState, params: TrackParams, trackLaps: number): void {
    this.lapLabel.string = `圈数: ${Math.min(car.lap + 1, trackLaps)}/${trackLaps}`;
    this.timeLabel.string = `用时: ${car.time.toFixed(1)}s`;
    this.speedLabel.string = `速度: ${Math.round(car.speed)}`;
    this.nitroBar.setScale(car.nitro / params.nitroMax, 1, 1);
  }

  showSettlement(stars: number, coins: number, onBack: () => void): void {
    createRect(this.root, 800, 600, new Color(0, 0, 0, 150), new Vec3(0, 0, 0));
    createRect(this.root, 400, 300, new Color(50, 50, 50), new Vec3(0, 0, 0));
    createLabel(this.root, '比赛结束', new Vec3(0, 100, 0), 40, Color.WHITE);
    createLabel(this.root, '★'.repeat(stars) + '☆'.repeat(3 - stars), new Vec3(0, 40, 0), 48, new Color(255, 220, 80));
    createLabel(this.root, `金币 +${coins}`, new Vec3(0, -20, 0), 28, new Color(255, 220, 80));
    createButton(this.root, '返回', new Vec3(0, -100, 0), 200, 60, onBack);
  }
}
