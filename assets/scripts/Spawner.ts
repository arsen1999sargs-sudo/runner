import { _decorator, Component, Node, Prefab, instantiate, CCFloat, CCInteger, Color, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
const { ccclass, property } = _decorator;

/**
 * Спавнит препятствия (красные) и монеты (жёлтые) на 3 полосах,
 * двигает их вниз с помощью Pickup-компонента.
 *
 * Для простоты не использует Prefab — генерирует спрайты программно
 * из default_sprite_splash + цвета.
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
    spawnInterval: number = 0.9;

    @property(CCFloat)
    speed: number = 450;

    @property(CCFloat)
    spawnY: number = 700;

    @property(CCFloat)
    laneWidth: number = 140;

    @property(CCInteger)
    lanes: number = 3;

    @property(CCFloat)
    obstacleChance: number = 0.35;

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
        const lane = Math.floor(Math.random() * this.lanes);
        const centerOffset = (this.lanes - 1) / 2;
        const x = (lane - centerOffset) * this.laneWidth;

        const isObstacle = Math.random() < this.obstacleChance;

        const sprite = new Node(isObstacle ? 'Obstacle' : 'Coin');
        sprite.layer = this.node.layer;

        const ui = sprite.addComponent(UITransform);
        ui.setContentSize(60, 60);

        const sp = sprite.addComponent(Sprite);
        if (isObstacle) {
            sp.spriteFrame = this.obstacleFrame;
            sp.color = new Color(220, 60, 60, 255);
        } else {
            sp.spriteFrame = this.coinFrame;
            sp.color = new Color(255, 210, 60, 255);
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
