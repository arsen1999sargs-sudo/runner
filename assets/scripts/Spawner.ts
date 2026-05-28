import { _decorator, Component, Node, CCFloat, CCInteger, Color, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
const { ccclass, property } = _decorator;

/**
 * Спавнит препятствия (красные) и монеты (жёлтые) по дорожке игрока,
 * двигает их вниз с помощью Pickup. Игрок перепрыгивает препятствия.
 *
 * - Препятствия — низкие, на уровне земли (надо перепрыгнуть).
 * - Монеты — чуть выше, собираются на бегу или в прыжке.
 */
@ccclass('Spawner')
export class Spawner extends Component {

    @property(Node)
    player: Node = null!;

    @property(SpriteFrame)
    coinFrame: SpriteFrame = null!;

    @property(SpriteFrame)
    obstacleFrame: SpriteFrame = null!;

    @property(CCFloat)
    spawnInterval: number = 1.1;

    @property(CCFloat)
    speed: number = 450;

    @property(CCFloat)
    spawnY: number = 720;

    @property({ type: CCFloat, tooltip: 'Разброс по X вокруг дорожки игрока' })
    xJitter: number = 0;

    @property(CCFloat)
    obstacleChance: number = 0.45;

    private timer: number = 0;

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        this.timer += dt;
        if (this.timer >= this.spawnInterval) {
            this.timer = 0;
            this.spawnOne();
        }
    }

    private spawnOne() {
        // путь игрока (его X), с опциональным разбросом
        const px = this.player ? this.player.position.x : 0;
        const x = px + (this.xJitter > 0 ? (Math.random() * 2 - 1) * this.xJitter : 0);

        const isObstacle = Math.random() < this.obstacleChance;

        const sprite = new Node(isObstacle ? 'Obstacle' : 'Coin');
        sprite.layer = this.node.layer;

        const ui = sprite.addComponent(UITransform);
        ui.setContentSize(isObstacle ? 70 : 55, isObstacle ? 70 : 55);

        const sp = sprite.addComponent(Sprite);
        if (isObstacle) {
            sp.spriteFrame = this.obstacleFrame;
            sp.color = new Color(220, 60, 60, 255);
        } else {
            sp.spriteFrame = this.coinFrame;
            sp.color = new Color(255, 200, 40, 255);
        }

        const pickup = sprite.addComponent(Pickup);
        pickup.kind = isObstacle ? PickupKind.OBSTACLE : PickupKind.COIN;
        pickup.value = isObstacle ? 0 : 0.5;
        pickup.speed = this.speed;
        pickup.player = this.player;

        this.node.addChild(sprite);
        sprite.setPosition(new Vec3(x, this.spawnY, 0));
    }
}
