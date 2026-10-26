import { _decorator, Component, Node, director, input, Input, Color, Vec3 } from 'cc';
import {
  CARS, LEVELS,
  computeFinalMaxSpeed, habitatMultiplier, computeStars, computeRewards,
  createRaceSimState, step, STAMINA_MAX,
  type RaceSimState,
} from '../core';
import { RaceHUD } from '../ui/RaceHUD';
import { GameState } from '../race/GameState';
import { SaveAdapter } from '../save/SaveAdapter';
import { createRect } from '../ui/UIHelper';

const { ccclass } = _decorator;

@ccclass('RaceRoot')
export class RaceRoot extends Component {
  private car = CARS.find((c) => c.id === GameState.instance.currentCarId) ?? CARS[0];
  private level = LEVELS[0];
  private carLevel = 1;
  private maxSpeed = 100;
  private state!: RaceSimState;
  private accelerating = false;
  private finished = false;
  private carNode!: Node;
  private hud!: RaceHUD;

  onLoad() {
    const progress = SaveAdapter.load();
    this.carLevel = progress.ownedCars.find((o) => o.carId === this.car.id)?.level ?? 1;
    this.maxSpeed = computeFinalMaxSpeed(
      this.car.baseSpeed,
      this.carLevel,
      habitatMultiplier(this.car.habitat, this.level.scene),
    );

    // 背景(占位)
    createRect(this.node, 800, 600, new Color(100, 160, 220), new Vec3(0, 0, 0));
    // 车(占位矩形)
    this.carNode = createRect(this.node, 60, 40, new Color(230, 120, 120), new Vec3(-350, -120, 0));

    this.hud = new RaceHUD(this.node);
    this.hud.build();
    this.state = createRaceSimState();

    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  private onTouchStart() { this.accelerating = true; }
  private onTouchEnd() { this.accelerating = false; }

  update(dt: number) {
    if (this.finished) return;
    this.state = step(this.state, { accelerating: this.accelerating }, dt, {
      maxSpeed: this.maxSpeed,
      baseAccel: this.car.baseAccel,
    });

    const staminaRatio = this.state.stamina / STAMINA_MAX;
    const progressRatio = Math.min(1, this.state.distance / this.level.distance);
    this.hud.update(this.state, staminaRatio, progressRatio);

    const x = -350 + progressRatio * 700;
    this.carNode.setPosition(x, -120, 0);

    if (this.state.distance >= this.level.distance) {
      this.finish();
    }
  }

  private finish() {
    this.finished = true;
    const stars = computeStars(this.state.time, this.level.starTime);
    const coins = computeRewards(this.level, stars, this.carLevel);

    const progress = SaveAdapter.load();
    progress.coins += coins;
    SaveAdapter.save(progress);
    GameState.instance.lastResult = { stars, coins };

    this.hud.showSettlement(stars, coins, () => director.loadScene('Home'));
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }
}
