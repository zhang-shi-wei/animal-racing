import { _decorator, Component, director } from 'cc';
import { HomeUI } from '../ui/HomeUI';
import { SaveAdapter } from '../save/SaveAdapter';
import { GameState } from '../race/GameState';

const { ccclass } = _decorator;

@ccclass('HomeRoot')
export class HomeRoot extends Component {
  onLoad() {
    const progress = SaveAdapter.load();
    GameState.instance.currentCarId = progress.currentCarId;
    const ui = new HomeUI(this.node);
    ui.build(progress, () => director.loadScene('Race'));
  }
}
