import { _decorator, Component, director, Color, Vec3 } from 'cc';
import {
  CARS, TRACKS,
  habitatMultiplier, computeFinalMaxSpeed, computeStars, computeRewards,
  createTrackRuntimeState, step,
  type TrackInput, type TrackParams, type TrackRuntimeState,
} from '../core';
import { RaceHUD } from '../ui/RaceHUD';
import { TrackRenderer } from '../ui/TrackRenderer';
import { GameState } from '../race/GameState';
import { SaveAdapter } from '../save/SaveAdapter';
import { createRect, createHoldButton } from '../ui/UIHelper';

const { ccclass } = _decorator;

@ccclass('RaceRoot')
export class RaceRoot extends Component {
  private car = CARS.find((c) => c.id === GameState.instance.currentCarId) ?? CARS[0];
  private track = TRACKS[0];
  private carLevel = 1;
  private params!: TrackParams;
  private rt!: TrackRuntimeState;
  private input: TrackInput = { steer: 0, boosting: false };
  private finished = false;
  private renderer!: TrackRenderer;
  private hud!: RaceHUD;

  onLoad() {
    const progress = SaveAdapter.load();
    this.carLevel = progress.ownedCars.find((o) => o.carId === this.car.id)?.level ?? 1;
    const defaultSpeed = computeFinalMaxSpeed(
      this.car.baseSpeed,
      this.carLevel,
      habitatMultiplier(this.car.habitat, this.track.scene),
    );
    this.params = {
      defaultSpeed,
      boostSpeed: defaultSpeed * 1.4,
      turnRate: 2.5,
      nitroMax: 100,
      nitroDrain: 40,
      nitroRegen: 25,
      bounceSpeedFactor: 0.6,
    };

    createRect(this.node, 800, 600, new Color(40, 80, 40), new Vec3(0, 0, 0));

    this.renderer = new TrackRenderer(this.node, this.track);
    this.renderer.build();

    this.hud = new RaceHUD(this.node);
    this.hud.build(this.track.laps);

    this.rt = createTrackRuntimeState(this.track, this.params);

    // 按住式按钮:左转=逆时针=+1,右转=顺时针=-1
    createHoldButton(this.node, '◀', new Vec3(-340, -240, 0), 90, 90, () => (this.input.steer = 1), () => (this.input.steer = 0));
    createHoldButton(this.node, '▶', new Vec3(340, -240, 0), 90, 90, () => (this.input.steer = -1), () => (this.input.steer = 0));
    createHoldButton(this.node, '氮气', new Vec3(340, -120, 0), 120, 90, () => (this.input.boosting = true), () => (this.input.boosting = false));
  }

  update(dt: number) {
    if (this.finished) return;
    this.rt = step(this.rt, this.input, dt, this.params, this.track);

    this.renderer.update(this.rt.car, this.rt.wallDurability, this.input.boosting);
    this.hud.update(this.rt.car, this.params, this.track.laps);

    if (this.rt.car.lap >= this.track.laps) {
      this.finish();
    }
  }

  private finish() {
    this.finished = true;
    const stars = computeStars(this.rt.car.time, this.track.starTime);
    const coins = computeRewards(this.track, stars, this.carLevel);

    const progress = SaveAdapter.load();
    progress.coins += coins;
    SaveAdapter.save(progress);
    GameState.instance.lastResult = { stars, coins };

    this.hud.showSettlement(stars, coins, () => director.loadScene('Home'));
  }
}
