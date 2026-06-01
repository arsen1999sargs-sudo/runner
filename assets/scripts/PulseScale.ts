import { _decorator, Component, Vec3, CCFloat } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Плавная пульсация масштаба узла (туда-сюда), привлекает внимание.
 * Использует синус, чтобы движение было гладким и бесконечным.
 *
 * Использование: добавить компонент на узел кнопки (или любой другой).
 */
@ccclass('PulseScale')
export class PulseScale extends Component {

    @property({ tooltip: 'Минимальный масштаб' })
    minScale: number = 0.92;

    @property({ tooltip: 'Максимальный масштаб' })
    maxScale: number = 1.08;

    @property({ tooltip: 'Скорость пульсации (циклов в секунду)' })
    speed: number = 1.5;

    @property({ tooltip: 'На проигрыше (game over) замереть на минимальном масштабе' })
    stopOnGameOver: boolean = false;

    private baseScale: Vec3 = new Vec3(1, 1, 1);
    private time: number = 0;
    private baseLocked: boolean = false; // базовый масштаб задан извне (Responsive) — не перекэшировать

    onLoad() {
        // запоминаем исходный масштаб как опорный, если его не задали извне
        if (!this.baseLocked) this.baseScale = this.node.scale.clone();
    }

    /** Задать базовый масштаб извне (вокруг него идёт пульсация). Устойчиво к порядку onLoad. */
    public setBaseScale(scalar: number) {
        this.baseScale.x = scalar;
        this.baseScale.y = scalar;
        this.baseLocked = true;
    }

    update(dt: number) {
        // на проигрыше EVADE замирает на минимуме
        if (this.stopOnGameOver) {
            const gm = GameManager.instance;
            if (gm && gm.getState() === GameState.DEAD) {
                this.node.setScale(
                    this.baseScale.x * this.minScale,
                    this.baseScale.y * this.minScale,
                    this.baseScale.z
                );
                return;
            }
        }

        this.time += dt * this.speed * Math.PI * 2;
        // sin даёт -1..1, переводим в minScale..maxScale
        const t = (Math.sin(this.time) + 1) / 2; // 0..1
        const s = this.minScale + (this.maxScale - this.minScale) * t;
        this.node.setScale(
            this.baseScale.x * s,
            this.baseScale.y * s,
            this.baseScale.z
        );
    }
}
