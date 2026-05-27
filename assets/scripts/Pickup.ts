import { _decorator, Component, Node, CCFloat, CCInteger, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

export enum PickupKind {
    COIN = 0,
    OBSTACLE = 1,
}

/**
 * Универсальный компонент для монеты или препятствия.
 * - Двигается вниз с заданной скоростью.
 * - При попадании в коллайдер игрока: добавляет деньги или забирает жизнь.
 * - Уничтожается за пределами экрана.
 */
@ccclass('Pickup')
export class Pickup extends Component {

    @property(CCInteger)
    kind: number = PickupKind.COIN;

    @property(CCFloat)
    value: number = 1.0;

    @property(CCFloat)
    speed: number = 400;

    @property(CCFloat)
    radius: number = 50;

    @property(Node)
    player: Node = null!;

    private hitOnce: boolean = false;
    private despawnY: number = -800;

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        const p = this.node.position;
        this.node.setPosition(p.x, p.y - this.speed * dt, p.z);

        // Despawn под экраном
        if (this.node.position.y < this.despawnY) {
            this.node.destroy();
            return;
        }

        // Простая круговая проверка столкновения с игроком
        if (!this.hitOnce && this.player && this.player.activeInHierarchy) {
            const pp = this.player.worldPosition;
            const wp = this.node.worldPosition;
            const dx = wp.x - pp.x;
            const dy = wp.y - pp.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < this.radius * this.radius) {
                this.onHit(gm);
            }
        }
    }

    private onHit(gm: GameManager) {
        this.hitOnce = true;
        if (this.kind === PickupKind.COIN) {
            gm.addEarnings(this.value);
        } else {
            gm.loseLife();
        }
        this.node.destroy();
    }
}
