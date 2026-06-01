import { _decorator, Component, Node, CCFloat, CCInteger, Color, Sprite, SpriteAtlas, UITransform, Vec3, view } from 'cc';
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

    @property({ type: CCFloat, tooltip: 'X появления (правый край+). Легаси: теперь вычисляется из ширины экрана, см. spawnMargin' })
    spawnX: number = 650;

    @property({ type: CCFloat, tooltip: 'Запас за правым краем экрана, где появляется мужик (px) — спавн за пределами видимой области при любой ширине' })
    spawnMargin: number = 300;

    /** X спавна = правый край видимой области + запас (мужик появляется ЗА экраном). */
    private spawnEdgeX(): number {
        return view.getVisibleSize().width / 2 + this.spawnMargin;
    }

    @property({ type: CCFloat, tooltip: 'Линия земли (ноги мужика), если matchPlayerGround выключен' })
    groundY: number = -270;

    @property({ tooltip: 'Ставить мужика по ЛИНИИ НОГ девочки (одна линия земли)' })
    matchPlayerGround: boolean = true;

    @property({ type: CCFloat, tooltip: 'Доводка линии ног (+вверх / −вниз), если ноги не совпали идеально' })
    groundOffset: number = 0;

    @property({ type: CCFloat, tooltip: 'Рост мужика (px), если matchPlayerSize выключен' })
    sizeH: number = 240;

    @property({ tooltip: 'Брать рост из content size девочки (Player) — одинаковый размер' })
    matchPlayerSize: boolean = true;

    @property({ type: CCFloat, tooltip: 'Поправка размера при matchPlayerSize (кадры девочки с полями, мужик впритык). <1 = меньше' })
    sizeScale: number = 0.82;

    @property({ type: CCFloat, tooltip: 'Скорость бега влево, px/сек (быстрее препятствий = реально догоняет)' })
    runSpeed: number = 600;

    @property({ type: CCFloat, tooltip: 'FPS анимации бега' })
    fps: number = 12;

    @property({ type: CCInteger, tooltip: 'Кадров в атласе (0 = авто sprite_1..N)' })
    frameCount: number = 0;

    @property({ type: CCInteger, tooltip: 'Длина цикла бега (0 = все кадры). В man_atlas все 44 — бег' })
    runFrameCount: number = 0;

    @property({ type: CCInteger, tooltip: 'Поза на паузе (index). В атласе нет стойки; sprite_8 (idx 7) — ноги вместе, наименее «беговой». -1 = замереть' })
    idleFrameIndex: number = 7;

    @property({ tooltip: 'Отразить по горизонтали (если бежит не в ту сторону)' })
    flipX: boolean = true;

    @property({ type: CCFloat, tooltip: 'Радиус столкновения с девочкой' })
    hitRadius: number = 60;

    @property({ type: CCFloat, tooltip: 'Высота прыжка, чтобы перепрыгнуть мужика' })
    jumpClearHeight: number = 70;

    @property({ tooltip: 'Обучающая пауза при ПЕРВОМ мужике (текст "Jump to avoid enemies")' })
    tutorialOnFirst: boolean = true;

    @property({ type: CCFloat, tooltip: 'На каком расстоянии до девочки первый мужик ставит паузу' })
    tutorialTriggerDist: number = 340;

    private timer: number = 0;
    private started: boolean = false;
    private spawnedCount: number = 0;
    private tutorialMan: Node | null = null;
    private nearFinishCleared: boolean = false;

    // доступ из сценария (Spawner вызывает spawnMan по таймлайну)
    public static instance: ManSpawner | null = null;
    onLoad() { ManSpawner.instance = this; }

    private clearMen() {
        const kids = [...this.node.children];
        for (const c of kids) {
            if (c.name === 'Man') c.destroy();
        }
    }

    // кэш «наземного» состояния девочки (чтобы прыжок не искажал размер/линию ног мужика)
    private pCached: boolean = false;
    private pHeight: number = 0;
    private pFeetY: number = 0;

    private cachePlayer() {
        if (!this.player) return;
        const pui = this.player.getComponent(UITransform);
        const anchorY = pui ? pui.anchorPoint.y : 0.5;
        this.pHeight = pui ? pui.contentSize.height : 0;
        this.pFeetY = this.player.worldPosition.y - this.pHeight * anchorY; // линия ног на земле
        this.pCached = true;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        // когда выехал финиш — больше НЕ спавним. Существующие мужики уезжают за край сами.
        if (gm.isNearFinish()) return;

        // обучающая пауза: первый (учебный) мужик подбежал близко → пауза + подсказка
        if (this.tutorialOnFirst && this.tutorialMan && this.tutorialMan.isValid && this.player) {
            const dx = this.tutorialMan.worldPosition.x - this.player.worldPosition.x;
            if (dx <= this.tutorialTriggerDist) {
                gm.pauseForTutorial();
                this.tutorialMan = null;
            }
        }

        // авто-спавн ТОЛЬКО учебного мужика (до прохождения подсказки).
        // После подсказки мужиков спавнит сценарий (Spawner.fireEvent → spawnMan).
        if (!gm.tutorialDone && this.spawnedCount === 0) {
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
    }

    public spawnMan() {
        if (!this.atlas) { console.warn('[ManSpawner] не задан atlas'); return; }

        const node = new Node('Man');
        node.layer = this.node.layer;

        // кэшируем наземное состояние девочки при первом спавне (она ещё не прыгает — прыжок до обучения выключен)
        if (!this.pCached) this.cachePlayer();

        // рост: из кэша (наземный content size девочки) × поправка, либо фикс. sizeH
        let h = this.sizeH;
        if (this.matchPlayerSize && this.pCached) {
            h = this.pHeight * this.sizeScale; // поправка на прозрачные поля кадров девочки
        }

        const ui = node.addComponent(UITransform);
        ui.setAnchorPoint(0.5, 0);              // ноги на земле
        ui.setContentSize(h * 0.6, h);          // высоту фиксируем, ширину подгонит AtlasRunner

        const sp = node.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(255, 255, 255, 255);
        sp.spriteFrame = this.atlas.getSpriteFrame('sprite_1');

        const runner = node.addComponent(AtlasRunner);
        runner.atlas = this.atlas;
        runner.fps = this.fps;
        runner.frameCount = this.frameCount;
        runner.flipX = this.flipX;
        runner.runFrameCount = this.runFrameCount;   // бег только по кадрам 1..40
        runner.idleFrameIndex = this.idleFrameIndex; // поза стойки на паузе (sprite_43)
        runner.moveSpeed = 0;                   // горизонтальное движение делает Pickup

        const pickup = node.addComponent(Pickup);
        pickup.kind = PickupKind.OBSTACLE;
        pickup.value = 0;
        pickup.speed = this.runSpeed;
        pickup.radius = this.hitRadius;
        pickup.jumpClearHeight = this.jumpClearHeight;
        pickup.player = this.player;

        this.node.addChild(node);

        // линия ног: эталон — НОГИ ДЕВОЧКИ НА ЗЕМЛЕ (из кэша), чтобы прыжок не сбивал линию
        let spawnY = this.groundY;
        if (this.matchPlayerGround && this.pCached) {
            spawnY = this.pFeetY - this.node.worldPosition.y + this.groundOffset; // в локальные координаты спавнера
        }
        node.setPosition(new Vec3(this.spawnEdgeX(), spawnY, 0));

        // первый мужик — «учебный»: по приближении поставит обучающую паузу
        this.spawnedCount++;
        if (this.tutorialOnFirst && this.spawnedCount === 1) {
            this.tutorialMan = node;
        }
    }
}
