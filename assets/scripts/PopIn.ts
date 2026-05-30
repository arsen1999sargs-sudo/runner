import { _decorator, Component, Vec3, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * «Выпрыгивание»: при включении узла масштаб плавно растёт от fromScale до
 * полного, с лёгким отскоком (ease-out-back). Срабатывает каждый раз, когда
 * узел становится активным — например, FAIL при game over.
 *
 * Повесь на узел FAIL.
 */
@ccclass('PopIn')
export class PopIn extends Component {

    @property({ type: CCFloat, tooltip: 'Длительность появления, сек' })
    duration: number = 0.4;

    @property({ type: CCFloat, tooltip: 'С какого масштаба начинать (0 = из ничего)' })
    fromScale: number = 0;

    @property({ type: CCFloat, tooltip: 'Сила «отскока» (0 = без отскока, 2-3 = заметный)' })
    bounce: number = 2;

    private base: Vec3 = new Vec3(1, 1, 1);
    private t: number = 0;
    private playing: boolean = false;

    onLoad() {
        this.base = this.node.scale.clone();
    }

    onEnable() {
        this.t = 0;
        this.playing = true;
        this.apply(this.fromScale);
    }

    private apply(s: number) {
        this.node.setScale(this.base.x * s, this.base.y * s, this.base.z);
    }

    update(dt: number) {
        if (!this.playing) return;
        this.t += dt;
        const p = Math.min(1, this.t / this.duration);
        // ease-out-back: плавный рост 0→1 с отскоком за единицу и возвратом
        const c = this.bounce;
        const eased = 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
        this.apply(this.fromScale + (1 - this.fromScale) * eased);
        if (p >= 1) { this.apply(1); this.playing = false; }
    }
}
