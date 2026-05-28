import { _decorator, Component, Node, CCFloat, Color, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
const { ccclass, property } = _decorator;

/**
 * Спавнит препятствия (красные) и монеты (жёлтые) СПРАВА от экрана,
 * они летят влево к игроку (side-scroller). Игрок перепрыгивает препятствия.
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
    spawnInterval: number = 1.3;

    @property(CCFloat)
    speed: number = 450;

    @property({ type: CCFloat, tooltip: 'X где появляются объекты (правый край+)' })
    spawnX: number = 450;

    @property(CCFloat)
    obstacleChance: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Высота монеты над землёй' })
    coinHeight: number = 90;

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
        const groundY = this.player ? this.player.position.y : -150;
        const isObstacle = Math.random() < this.obstacleChance;

        const sprite = new Node(isObstacle ? 'Obstacle' : 'Coin');
        sprite.layer = this.node.layer;

        const ui = sprite.addComponent(UITransform);
        // конус вытянутый по вертикали, монета круглая
        if (isObstacle) ui.setContentSize(75, 90);
        else ui.setContentSize(55, 55);

        const sp = sprite.addComponent(Sprite);
        if (isObstacle) {
            sp.spriteFrame = this.obstacleFrame;
            // белый = показываем картинку конуса в своих цветах
            sp.color = new Color(255, 255, 255, 255);
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
        // препятствие на земле, монета — повыше (надо подпрыгнуть или собрать на бегу)
        const y = isObstacle ? groundY : groundY + this.coinHeight;
        sprite.setPosition(new Vec3(this.spawnX, y, 0));
    }
}
