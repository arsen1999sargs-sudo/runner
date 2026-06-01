import { _decorator, Component, CCFloat, view } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Двигает ГОТОВЫЙ узел финиша (собранный вручную) справа к девочке и
 * заканчивает игру, когда финиш доезжает. Ничего не строит — просто движение.
 *
 * Повесь на узел, внутри которого ты собрал финиш (шашечки + столбы + флажки).
 */
@ccclass('FinishMover')
export class FinishMover extends Component {

    @property({ type: CCFloat, tooltip: 'X за правым краем экрана (откуда выезжает). Легаси: теперь вычисляется из ширины экрана, см. startMargin' })
    startX: number = 900;

    @property({ type: CCFloat, tooltip: 'Запас за правым краем, откуда выезжает финиш (px). Должен быть больше запаса спавна объектов (160/300), чтобы финиш ехал ПОЗАДИ всех объектов' })
    startMargin: number = 450;

    /** X старта финиша = правый край видимой области + запас (за экраном, позади всех объектов). */
    private startEdgeX(): number {
        return view.getVisibleSize().width / 2 + this.startMargin;
    }

    @property({ type: CCFloat, tooltip: 'X у девочки (где финиш останавливается)' })
    targetX: number = -210;

    @property({ type: CCFloat, tooltip: 'На какой секунде девочка добегает до финиша (конец игры)' })
    finishAtSec: number = 23;

    @property({ type: CCFloat, tooltip: 'Скорость движения, px/сек (≈ скорость препятствий, чтобы ехал ровно по дороге)' })
    moveSpeed: number = 450;

    private done: boolean = false;

    onLoad() {
        const p = this.node.position;
        this.node.setPosition(this.startEdgeX(), p.y, p.z); // спрятать справа (за краем экрана)
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm) return;

        const startX = this.startEdgeX();

        // пока не пройдена подсказка «jump to avoid enemies» — держим финиш спрятанным справа
        if (!gm.tutorialDone) {
            const p = this.node.position;
            if (p.x !== startX) this.node.setPosition(startX, p.y, p.z);
            return;
        }

        // финиш уже доехал — оставляем на месте (не прячем после победы/смерти)
        if (this.done) return;

        // двигаем только во время забега
        if (gm.getState() !== GameState.RUNNING) return;

        const elapsed = gm.getRunElapsed();
        const p = this.node.position;

        // запуск рассчитан так, чтобы приехать к targetX ровно на finishAtSec секунде
        const travel = (startX - this.targetX) / Math.max(1, this.moveSpeed);
        const launchAt = Math.max(0, this.finishAtSec - travel);

        // ещё не время выезжать — держим за краем
        if (elapsed < launchAt) {
            if (p.x !== startX) this.node.setPosition(startX, p.y, p.z);
            return;
        }

        // финиш ВЫЕХАЛ из-за края: с этого момента перестаём спавнить. Финиш стартует
        // позади всех объектов (startMargin > запаса спавна), поэтому существующие
        // препятствия/монеты уезжают за левый край САМИ (не исчезают на экране).
        if (!gm.nearFinish) gm.nearFinish = true;

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
