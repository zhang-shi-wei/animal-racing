import { Node, Graphics, Color } from 'cc';
import type { TrackDefinition, CarState } from '../core';

export class TrackRenderer {
  private trackGraphics!: Graphics; // 静态层:赛道 + 障碍
  private dynGraphics!: Graphics;   // 动态层:可破坏墙 + 近路(每帧重画)
  private carNode!: Node;
  private carGraphics!: Graphics;

  constructor(private root: Node, private track: TrackDefinition) {}

  build(): void {
    const trackNode = new Node('track');
    this.root.addChild(trackNode);
    this.trackGraphics = trackNode.addComponent(Graphics);
    this.drawTrackStatic();

    const dynNode = new Node('dynamic');
    this.root.addChild(dynNode);
    this.dynGraphics = dynNode.addComponent(Graphics);

    this.carNode = new Node('car');
    this.root.addChild(this.carNode);
    this.carGraphics = this.carNode.addComponent(Graphics);
  }

  private drawTrackStatic(): void {
    const g = this.trackGraphics;
    const { centerX, centerY, outerWidth, outerHeight, trackWidth, cornerRadius } = this.track.shape;
    const bg = new Color(40, 80, 40);
    const innerW = outerWidth - trackWidth * 2;
    const innerH = outerHeight - trackWidth * 2;

    // 赛道填充:外环填赛道色,内环填背景色挖洞
    g.fillColor = new Color(120, 120, 120);
    g.roundRect(centerX - outerWidth / 2, centerY - outerHeight / 2, outerWidth, outerHeight, cornerRadius);
    g.fill();
    g.fillColor = bg;
    g.roundRect(centerX - innerW / 2, centerY - innerH / 2, innerW, innerH, cornerRadius);
    g.fill();

    // 内外墙描边
    g.lineWidth = 4;
    g.strokeColor = new Color(255, 255, 255);
    g.roundRect(centerX - outerWidth / 2, centerY - outerHeight / 2, outerWidth, outerHeight, cornerRadius);
    g.stroke();
    g.strokeColor = new Color(255, 80, 80);
    g.roundRect(centerX - innerW / 2, centerY - innerH / 2, innerW, innerH, cornerRadius);
    g.stroke();

    // 障碍
    for (const o of this.track.obstacles) {
      g.fillColor = o.kind === 'puddle' ? new Color(60, 140, 220) : new Color(120, 120, 120);
      g.circle(o.x, o.y, o.radius);
      g.fill();
    }
  }

  update(car: CarState, wallDurability: Record<string, number>, boosting: boolean): void {
    this.carNode.setPosition(car.x, car.y, 0);
    this.carNode.setRotationFromEuler(0, 0, car.angle * 180 / Math.PI);

    const g = this.carGraphics;
    g.clear();
    g.fillColor = new Color(230, 120, 120);
    g.rect(-15, -10, 30, 20);
    g.fill();
    if (boosting) {
      g.fillColor = new Color(255, 180, 60);
      g.rect(-30, -6, 15, 12); // 车尾火苗(局部 -x)
      g.fill();
    }

    this.drawDynamic(wallDurability);
  }

  private drawDynamic(wallDurability: Record<string, number>): void {
    const g = this.dynGraphics;
    g.clear();

    for (const w of this.track.breakableWalls) {
      if (wallDurability[w.id] === 0) continue;
      g.lineWidth = 8;
      g.strokeColor = new Color(255, 220, 60);
      g.moveTo(w.x1, w.y1);
      g.lineTo(w.x2, w.y2);
      g.stroke();
    }

    for (const s of this.track.shortcuts) {
      if (wallDurability[s.entranceWallId] !== 0) continue; // 墙未破隐藏
      this.drawDashedPath(g, s.path, 8, 6);
    }
  }

  private drawDashedPath(g: Graphics, points: { x: number; y: number }[], dashLen: number, gapLen: number): void {
    g.lineWidth = 3;
    g.strokeColor = new Color(255, 255, 255, 140);
    for (let i = 1; i < points.length; i++) {
      let x1 = points[i - 1].x, y1 = points[i - 1].y;
      const x2 = points[i].x, y2 = points[i].y;
      const dx = x2 - x1, dy = y2 - y1;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) continue;
      const ux = dx / segLen, uy = dy / segLen;
      let covered = 0;
      while (covered < segLen) {
        const step = Math.min(dashLen, segLen - covered);
        g.moveTo(x1 + ux * covered, y1 + uy * covered);
        g.lineTo(x1 + ux * (covered + step), y1 + uy * (covered + step));
        g.stroke();
        covered += step + gapLen;
      }
    }
  }
}
