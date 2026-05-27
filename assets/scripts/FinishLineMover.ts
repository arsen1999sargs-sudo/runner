import { _decorator, Component, Node, CCFloat } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Опускает узел финишной ленты вниз по мере прогресса в игре.
 * Когда distanceTraveled / FINISH_DISTANCE достигает 100%,
 * лента оказывается на уровне игрока.
 */
@ccclass('FinishLineMover')
export class FinishLineMover extends Component {

    @property(CCFloat)
    startY: number = 800;

    @property(CCFloat)
    endY: number = -100;

    onLoad() {
        const p = this.node.position;
        this.node.setPosition(p.x, this.startY, p.z);
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        const t = Math.min(1, gm.distanceTraveled / gm.FINISH_DISTANCE);
        const y = this.startY + (this.endY - this.startY) * t;
        const p = this.node.position;
        this.node.setPosition(p.x, y, p.z);
    }
}
