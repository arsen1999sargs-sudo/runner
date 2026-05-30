import { _decorator, Component, Node, CCFloat, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Скроллит дочерние спрайты вниз, создавая иллюзию движения вперёд.
 * Когда дочерний спрайт уходит за нижнюю границу, он переносится наверх,
 * образуя бесконечную ленту.
 */
@ccclass('Scroller')
export class Scroller extends Component {

    @property(CCFloat)
    speed: number = 400;

    @property(CCFloat)
    bottomY: number = -700;

    @property(CCFloat)
    topY: number = 700;

    @property(CCFloat)
    distancePerSecond: number = 200;

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        const delta = this.speed * dt;
        for (const child of this.node.children) {
            const p = child.position;
            child.setPosition(p.x, p.y - delta, p.z);
            if (child.position.y < this.bottomY) {
                child.setPosition(p.x, this.topY, p.z);
            }
        }
        // дистанцию/прогресс к финишу теперь ведёт GameManager по времени (finishTime)
    }
}
