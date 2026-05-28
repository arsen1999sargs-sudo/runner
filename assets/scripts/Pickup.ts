import { _decorator, Component, Node, CCFloat, CCInteger } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Player } from './Player';
const { ccclass, property } = _decorator;

export enum PickupKind {
    COIN = 0,
    OBSTACLE = 1,
}

/**
 * Монета или препятствие, летящее вниз к игроку.
 * - Препятствие: бьёт, если игрок на земле; если перепрыгнул (jumpHeight > порога) — пролетает.
 * - Монета: собирается при касании (можно и в прыжке).
 */
@ccclass('Pickup')
export class Pickup extends Component {

    @property(CCInteger)
    kind: number = PickupKind.COIN;

    @property(CCFloat)
    value: number = 0.5;

    @property(CCFloat)
    speed: number = 450;

    @property(CCFloat)
    radius: number = 60;

    @property({ type: CCFloat, tooltip: 'Какую высоту прыжка надо набрать чтобы перепрыгнуть препятствие' })
    jumpClearHeight: number = 70;

    @property(Node)
    player: Node = null!;

    private hitOnce: boolean = false;
    private despawnY: number = -800;
    private playerComp: Player | null = null;

    start() {
        if (this.player) {
            this.playerComp = this.player.getComponent(Player);
        }
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        const p = this.node.position;
        this.node.setPosition(p.x, p.y - this.speed * dt, p.z);

        if (this.node.position.y < this.despawnY) {
            this.node.destroy();
            return;
        }

        if (this.hitOnce || !this.player || !this.player.activeInHierarchy) return;

        const pp = this.player.worldPosition;
        const wp = this.node.worldPosition;
        const dx = wp.x - pp.x;
        const dy = wp.y - pp.y;

        if (this.kind === PickupKind.OBSTACLE) {
            // зона удара по вертикали (когда препятствие проходит уровень игрока)
            if (Math.abs(dx) < this.radius && Math.abs(dy) < this.radius) {
                const jumpH = this.playerComp ? this.playerComp.getJumpHeight() : 0;
                if (jumpH >= this.jumpClearHeight) {
                    // перепрыгнул — безопасно, помечаем чтобы не било повторно
                    this.hitOnce = true;
                } else {
                    this.onHitObstacle(gm);
                }
            }
        } else {
            // монета — собираем при касании
            const d2 = dx * dx + dy * dy;
            if (d2 < this.radius * this.radius) {
                this.onPickCoin(gm);
            }
        }
    }

    private onHitObstacle(gm: GameManager) {
        this.hitOnce = true;
        gm.loseLife();
        this.node.destroy();
    }

    private onPickCoin(gm: GameManager) {
        this.hitOnce = true;
        gm.addEarnings(this.value);
        this.node.destroy();
    }
}
