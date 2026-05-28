import { _decorator, Component, Vec3, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Анимация "тапни сюда": рука периодически опускается вниз (нажатие)
 * и пружинит обратно вверх + лёгкое уменьшение масштаба при нажатии.
 * Зацикленная, привлекает внимание к месту тапа.
 */
@ccclass('HandTap')
export class HandTap extends Component {

    @property({ type: CCFloat, tooltip: 'На сколько px опускается рука при нажатии' })
    pressDistance: number = 22;

    @property({ type: CCFloat, tooltip: 'Скорость анимации (циклов/сек)' })
    speed: number = 1.6;

    @property({ type: CCFloat, tooltip: 'Уменьшение масштаба при нажатии (0..1)' })
    pressScale: number = 0.12;

    private baseY: number = 0;
    private baseScale: Vec3 = new Vec3(1, 1, 1);
    private time: number = 0;

    onLoad() {
        this.baseY = this.node.position.y;
        this.baseScale = this.node.scale.clone();
    }

    update(dt: number) {
        this.time += dt * this.speed * Math.PI * 2;
        // 0..1 (резкое нажатие вниз, плавный возврат вверх)
        const raw = (Math.sin(this.time) + 1) / 2; // 0..1
        const press = Math.pow(raw, 2);            // делаем нажатие "резче"

        const p = this.node.position;
        this.node.setPosition(p.x, this.baseY - press * this.pressDistance, p.z);

        const s = 1 - press * this.pressScale;
        this.node.setScale(this.baseScale.x * s, this.baseScale.y * s, this.baseScale.z);
    }
}
