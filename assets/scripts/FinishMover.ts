import { _decorator, Component, CCFloat } from 'cc';
import { GameManager } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Двигает ГОТОВЫЙ узел финиша (собранный вручную) справа к девочке и
 * заканчивает игру, когда финиш доезжает. Ничего не строит — просто движение.
 *
 * Повесь на узел, внутри которого ты собрал финиш (шашечки + столбы + флажки).
 */
@ccclass('FinishMover')
export class FinishMover extends Component {

    @property({ type: CCFloat, tooltip: 'X за правым краем экрана (откуда выезжает)' })
    startX: number = 900;

    @property({ type: CCFloat, tooltip: 'X у девочки (где финиш останавливается)' })
    targetX: number = -210;

    @property({ type: CCFloat, tooltip: 'На какой секунде девочка добегает до финиша (конец игры)' })
    finishAtSec: number = 23;

    @property({ type: CCFloat, tooltip: 'Скорость движения, px/сек (≈ скорость препятствий, чтобы ехал ровно по дороге)' })
    moveSpeed: number = 450;

    private done: boolean = false;

    onLoad() {
        const p = this.node.position;
        this.node.setPosition(this.startX, p.y, p.z); // спрятать справа
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm) return;

        const elapsed = gm.getRunElapsed();
        const p = this.node.position;

        // запуск рассчитан так, чтобы приехать к targetX ровно на finishAtSec секунде
        const travel = (this.startX - this.targetX) / Math.max(1, this.moveSpeed);
        const launchAt = Math.max(0, this.finishAtSec - travel);

        if (elapsed < launchAt) {
            if (p.x !== this.startX) this.node.setPosition(this.startX, p.y, p.z);
            return;
        }

        // едем влево с дорогой
        if (p.x > this.targetX) {
            const nx = Math.max(this.targetX, p.x - this.moveSpeed * dt);
            this.node.setPosition(nx, p.y, p.z);
        }

        // добежали → конец игры (победа)
        if (!this.done && this.node.position.x <= this.targetX) {
            this.done = true;
            gm.finishGame();
        }
    }
}
