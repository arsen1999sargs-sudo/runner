import { _decorator, Component, Vec3, CCFloat } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Имитация бега для статичного спрайта: лёгкое покачивание вверх-вниз
 * + небольшой наклон, когда игра в состоянии RUNNING.
 * В покое (IDLE) — спокойное дыхание (очень слабое).
 */
@ccclass('PlayerBob')
export class PlayerBob extends Component {

    @property({ type: CCFloat, tooltip: 'Высота подскока при беге (px)' })
    bobHeight: number = 14;

    @property({ type: CCFloat, tooltip: 'Скорость бега-покачивания (циклов/сек)' })
    runSpeed: number = 6;

    @property({ type: CCFloat, tooltip: 'Угол наклона при беге (градусы)' })
    tilt: number = 5;

    @property({ type: CCFloat, tooltip: 'Дыхание в покое (px)' })
    idleBreath: number = 3;

    @property({ type: CCFloat })
    idleSpeed: number = 1.5;

    private baseY: number = 0;
    private time: number = 0;

    onLoad() {
        this.baseY = this.node.position.y;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        const running = gm && gm.getState() === GameState.RUNNING;

        if (running) {
            this.time += dt * this.runSpeed * Math.PI * 2;
            // |sin| даёт подскоки только вверх (как при беге)
            const offset = Math.abs(Math.sin(this.time)) * this.bobHeight;
            const p = this.node.position;
            this.node.setPosition(p.x, this.baseY + offset, p.z);
            // лёгкий наклон туда-сюда
            const angle = Math.sin(this.time * 0.5) * this.tilt;
            this.node.setRotationFromEuler(0, 0, angle);
        } else {
            // спокойное дыхание
            this.time += dt * this.idleSpeed * Math.PI * 2;
            const offset = Math.sin(this.time) * this.idleBreath;
            const p = this.node.position;
            this.node.setPosition(p.x, this.baseY + offset, p.z);
            this.node.setRotationFromEuler(0, 0, 0);
        }
    }
}
