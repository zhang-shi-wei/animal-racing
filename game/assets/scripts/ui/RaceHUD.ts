import { Node, Vec3, Color, Label } from 'cc';
import { createLabel, createRect, createButton } from './UIHelper';
import type { RaceSimState } from '../core';

export class RaceHUD {
  private speedLabel!: Label;
  private timeLabel!: Label;
  private progressLabel!: Label;
  private staminaBar!: Node;
  private readonly staminaMaxWidth = 200;

  constructor(private root: Node) {}

  build(): void {
    this.speedLabel = createLabel(this.root, '速度: 0', new Vec3(-320, 280, 0), 22, Color.WHITE);
    this.timeLabel = createLabel(this.root, '用时: 0.0s', new Vec3(0, 280, 0), 22, Color.WHITE);
    this.progressLabel = createLabel(this.root, '进度: 0%', new Vec3(320, 280, 0), 22, Color.WHITE);

    createRect(this.root, this.staminaMaxWidth, 20, new Color(60, 60, 60), new Vec3(0, 220, 0));
    this.staminaBar = createRect(this.root, this.staminaMaxWidth, 20, new Color(90, 200, 120), new Vec3(0, 220, 0));
  }

  update(state: RaceSimState, staminaRatio: number, progressRatio: number): void {
    this.speedLabel.string = `速度: ${Math.round(state.speed)}`;
    this.timeLabel.string = `用时: ${state.time.toFixed(1)}s`;
    this.progressLabel.string = `进度: ${Math.round(progressRatio * 100)}%`;
    this.staminaBar.setScale(staminaRatio, 1, 1);
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
