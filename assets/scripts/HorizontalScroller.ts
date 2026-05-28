import { _decorator, Component, CCFloat, CCInteger } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Горизонтальная прокрутка фона справа→налево с бесконечным зацикливанием.
 *
 * Как использовать:
 *  1. Создать узел-контейнер (например "World").
 *  2. Положить внутрь 2 одинаковые копии сцены (или фона), расположенные
 *     встык по горизонтали: копия A на x=0, копия B на x=tileWidth.
 *  3. Повесить этот компонент на контейнер, задать tileWidth = ширина одной копии (720).
 *  4. Когда игра RUNNING — копии едут влево; ушедшая за левый край перескакивает вправо.
 */
@ccclass('HorizontalScroller')
export class HorizontalScroller extends Component {

    @property({ type: CCFloat, tooltip: 'Скорость прокрутки (px/сек)' })
    speed: number = 320;

    @property({ type: CCFloat, tooltip: 'Ширина одной копии сцены (обычно ширина канваса 720)' })
    tileWidth: number = 720;

    @property({ tooltip: 'Двигать только когда игра запущена (RUNNING)' })
    onlyWhenRunning: boolean = true;

    update(dt: number) {
        const gm = GameManager.instance;
        if (this.onlyWhenRunning && (!gm || gm.getState() !== GameState.RUNNING)) return;

        const children = this.node.children;
        const n = children.length;
        if (n === 0) return;

        const wrapDistance = n * this.tileWidth;
        const delta = this.speed * dt;

        for (const child of children) {
            const p = child.position;
            let x = p.x - delta;
            // ушёл за левый край полностью → перескок вправо
            if (x <= -this.tileWidth) {
                x += wrapDistance;
            }
            child.setPosition(x, p.y, p.z);
        }
    }
}
