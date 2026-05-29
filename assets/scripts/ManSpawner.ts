import { _decorator, Component, Node, CCFloat, CCInteger, Color, Sprite, SpriteAtlas, UITransform, Vec3 } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
import { AtlasRunner } from './AtlasRunner';
const { ccclass, property } = _decorator;

/**
 * Спавнит бегущего МУЖИКА из атласа СПРАВА от экрана.
 * Он бежит ВЛЕВО навстречу девочке (анимация — AtlasRunner).
 * При касании снимает жизнь (логика Pickup как OBSTACLE) — можно перепрыгнуть.
 * Барьеры-конусы (Spawner) этим компонентом НЕ затрагиваются.
 */
@ccclass('ManSpawner')
export class ManSpawner extends Component {

    @property({ type: Node, tooltip: 'Узел игрока (девочка)' })
    player: Node = null!;

    @property({ type: SpriteAtlas, tooltip: 'Атлас бегущего мужика (man_atlas)' })
    atlas: SpriteAtlas = null!;

    @property({ type: CCFloat, tooltip: 'Интервал появления, сек' })
    spawnInterval: number = 6;

    @property({ type: CCFloat, tooltip: 'Задержка перед первым появлением, сек' })
    firstDelay: number = 3;

    @property({ type: CCFloat, tooltip: 'X появления (правый край+)' })
    spawnX: number = 650;

    @property({ type: CCFloat, tooltip: 'Линия земли (ноги мужика стоят тут)' })
    groundY: number = -270;

    @property({ type: CCFloat, tooltip: 'Рост мужика (px)' })
    sizeH: number = 240;

    @property({ type: CCFloat, tooltip: 'Скорость бега влево, px/сек (быстрее препятствий = реально догоняет)' })
    runSpeed: number = 600;

    @property({ type: CCFloat, tooltip: 'FPS анимации бега' })
    fps: number = 12;

    @property({ type: CCInteger, tooltip: 'Кадров в атласе (0 = авто sprite_1..N)' })
    frameCount: number = 0;

    @property({ tooltip: 'Отразить по горизонтали (если бежит не в ту сторону)' })
    flipX: boolean = true;

    @property({ type: CCFloat, tooltip: 'Радиус столкновения с девочкой' })
    hitRadius: number = 60;

    @property({ type: CCFloat, tooltip: 'Высота прыжка, чтобы перепрыгнуть мужика' })
    jumpClearHeight: number = 70;

    private timer: number = 0;
    private started: boolean = false;

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        if (!this.started) {
            this.started = true;
            this.timer = this.spawnInterval - this.firstDelay; // первая задержка
        }

        this.timer += dt;
        if (this.timer >= this.spawnInterval) {
            this.timer = 0;
            this.spawnMan();
        }
    }

    private spawnMan() {
        if (!this.atlas) { console.warn('[ManSpawner] не задан atlas'); return; }

        const node = new Node('Man');
        node.layer = this.node.layer;

        const ui = node.addComponent(UITransform);
        ui.setAnchorPoint(0.5, 0);              // ноги на земле
        ui.setContentSize(this.sizeH * 0.6, this.sizeH); // высоту фиксируем, ширину подгонит AtlasRunner

        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(255, 255, 255, 255);
        sp.spriteFrame = this.atlas.getSpriteFrame('sprite_1');

        const runner = node.addComponent(AtlasRunner);
        runner.atlas = this.atlas;
        runner.fps = this.fps;
        runner.frameCount = this.frameCount;
        runner.flipX = this.flipX;
        runner.moveSpeed = 0;                   // горизонтальное движение делает Pickup

        const pickup = node.addComponent(Pickup);
        pickup.kind = PickupKind.OBSTACLE;
        pickup.value = 0;
        pickup.speed = this.runSpeed;
        pickup.radius = this.hitRadius;
        pickup.jumpClearHeight = this.jumpClearHeight;
        pickup.player = this.player;

        this.node.addChild(node);
        node.setPosition(new Vec3(this.spawnX, this.groundY, 0));
    }
}
