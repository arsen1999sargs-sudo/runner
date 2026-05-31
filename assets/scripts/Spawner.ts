import { _decorator, Component, Node, CCFloat, CCInteger, Color, Sprite, SpriteFrame, UITransform, Vec3, Label, Font, HorizontalTextAlignment, VerticalTextAlignment } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
import { RoundedRect } from './RoundedRect';
import { PulseScale } from './PulseScale';
import { ManSpawner } from './ManSpawner';
const { ccclass, property } = _decorator;

/**
 * Спавнит препятствия (конусы) и монеты СПРАВА от экрана, летят влево к игроку.
 * Все барьеры — на ФИКСИРОВАННОЙ линии земли (groundY), независимо от прыжка игрока.
 * Над каждым барьером — подпись (например "EVADE").
 */
@ccclass('Spawner')
export class Spawner extends Component {

    @property(Node)
    player: Node = null!;

    @property({ type: [SpriteFrame], tooltip: 'Список собираемых (PayPal, купюра $) — выбирается случайно' })
    coinFrames: SpriteFrame[] = [];

    @property(SpriteFrame)
    obstacleFrame: SpriteFrame = null!;

    @property(CCFloat)
    spawnInterval: number = 1.3;

    @property(CCFloat)
    speed: number = 450;

    @property({ type: CCFloat, tooltip: 'X где появляются объекты (правый край+)' })
    spawnX: number = 450;

    @property({ type: CCFloat, tooltip: 'Линия ЗЕМЛИ (ног девочки) — основание барьеров стоит тут' })
    groundY: number = -270;

    @property({ type: CCFloat, tooltip: 'Высота конуса (px)' })
    obstacleSizeH: number = 90;

    @property({ type: CCFloat, tooltip: 'Ширина конуса (px)' })
    obstacleSizeW: number = 75;

    @property(CCFloat)
    obstacleChance: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Высота монеты над землёй' })
    coinHeight: number = 120;

    @property({ type: CCFloat, tooltip: 'Высота собираемого по умолчанию (ширина по пропорции)' })
    coinDisplayHeight: number = 40;

    @property({ type: [CCFloat], tooltip: 'Высота для КАЖДОГО элемента Coin Frames (по индексу). Пусто = coinDisplayHeight' })
    coinHeights: number[] = [];

    @property({ type: [CCFloat], tooltip: 'Сколько $ даёт КАЖДЫЙ элемент Coin Frames (по индексу). Пусто = 0.5' })
    coinValues: number[] = [];

    @property({ type: CCFloat, tooltip: 'Радиус сбора монеты (больше = легче собрать; не влияет на препятствия)' })
    coinPickRadius: number = 100;

    // ---- Дуга монет (полукруг) ----
    @property({ group: { name: 'Дуга монет' }, tooltip: 'Спавнить монеты дугой (полукругом), а не по одной' })
    coinArc: boolean = true;
    @property({ group: { name: 'Дуга монет' }, type: CCInteger, tooltip: 'Сколько монет в дуге' })
    coinArcCount: number = 6;
    @property({ group: { name: 'Дуга монет' }, type: CCFloat, tooltip: 'Радиус дуги = высота арки над концами (px)' })
    coinArcRadius: number = 110;
    @property({ group: { name: 'Дуга монет' }, type: CCFloat, tooltip: 'Высота концов дуги над землёй (px) — концы должны попадать в зону сбора девочки' })
    coinArcBaseHeight: number = 130;

    @property({ type: CCFloat, tooltip: 'Общий множитель размера монет (1 = как заданы, 1.25 = на 25% крупнее)' })
    coinSizeScale: number = 1.25;

    @property({ group: { name: 'Интро (до первого врага)' }, type: CCInteger, tooltip: 'Сколько money_coin спавнить в начале до встречи с мужиком' })
    introCoinCount: number = 2;

    @property({ group: { name: 'Интро (до первого врага)' }, type: CCInteger, tooltip: 'Индекс money_coin в Coin Frames (что спавнить в интро)' })
    introCoinIndex: number = 1;

    @property({ tooltip: 'Текст над барьером (пусто = без текста)' })
    obstacleLabel: string = 'EVADE';

    @property({ type: CCFloat, tooltip: 'Сдвиг текста по X относительно конуса' })
    labelOffsetX: number = 0;

    @property({ type: CCFloat, tooltip: 'Сдвиг текста по Y (над конусом)' })
    labelOffsetY: number = 120;

    @property({ type: Font, tooltip: 'Шрифт подписи (Fredoka)' })
    labelFont: Font = null!;

    // ---- Настройки бейджа (всё редактируется в инспекторе) ----
    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Цвет бейджа (hex без #)' })
    badgeColorHex: string = 'F5C518';

    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Цвет текста (hex без #)' })
    textColorHex: string = 'E01010';

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Размер текста' })
    labelFontSize: number = 50;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Ширина бейджа' })
    badgeWidth: number = 185;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Высота бейджа' })
    badgeHeight: number = 64;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Скругление углов' })
    badgeRadius: number = 18;

    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Жирный текст' })
    labelBold: boolean = true;

    // ---- Обводка бейджа (рамка/углы другого цвета) ----
    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Цвет обводки бейджа (hex без #)' })
    badgeStrokeColorHex: string = 'C97E00';

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Толщина обводки бейджа (0 = без рамки)' })
    badgeStrokeWidth: number = 6;

    // ---- Обводка текста ----
    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Цвет обводки текста (hex без #)' })
    textOutlineColorHex: string = '000000';

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Толщина внешней обводки текста' })
    textOutlineWidth: number = 6;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Жирность текста (красная обводка поверх, утолщает буквы)' })
    textBoldWidth: number = 4;

    // ---- Пульсация бейджа (уменьшается/растёт) ----
    @property({ group: { name: 'Бейдж EVADE' }, tooltip: 'Пульсация бейджа (туда-сюда)' })
    badgePulse: boolean = true;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Мин. масштаб' })
    pulseMin: number = 0.85;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Макс. масштаб' })
    pulseMax: number = 1.15;

    @property({ group: { name: 'Бейдж EVADE' }, type: CCFloat, tooltip: 'Скорость пульсации' })
    pulseSpeed: number = 2;

    private timer: number = 0;
    private introSpawned: number = 0;
    private nearFinishCleared: boolean = false;

    // ---- ФИКСИРОВАННЫЙ СЦЕНАРИЙ забега (время в сек от старта таймера = после подсказки) ----
    // type: 'arc' дуга монет | 'barrier' конус | 'man' мужик | 'coin' одиночная money_coin
    private seqIdx: number = 0;
    private timeline: { t: number, type: string, count?: number }[] = [
        { t: 1.2,  type: 'arc' },                 // 1
        { t: 3.0,  type: 'barrier' },             // 2  (1.8с после дуги)
        { t: 4.3,  type: 'coin' },                // 3a случайная монета
        { t: 4.4,  type: 'man' },                 // 3b мужик (почти вместе)
        { t: 5.9,  type: 'arc' },                 // 4
        { t: 7.7,  type: 'barrier' },             // 5  (1.8с после дуги)
        { t: 9.0,  type: 'man' },                 // 6
        { t: 10.3, type: 'arc', count: 3 },       // 7 дуга из 3
        { t: 12.1, type: 'barrier' },             // 8  (1.8с после дуги)
        { t: 13.4, type: 'man' },                 // 9
        { t: 14.7, type: 'arc' },                 // 10
        { t: 16.5, type: 'barrier' },             // 11 (1.8с после дуги)
        { t: 17.8, type: 'man' },                 // 12
        { t: 19.1, type: 'arc' },                 // 13
        { t: 20.9, type: 'barrier' },             // 14 (1.8с после дуги)
    ];

    start() {
        const gm = GameManager.instance;
        if (gm) {
            // при входе в обучающую паузу убираем оставшиеся монеты — экран чист (только девочка и мужик)
            gm.registerStateChange((s) => {
                if (s === GameState.TUTORIAL) this.clearCoins();
            });
        }
    }

    private clearCoins() {
        const kids = [...this.node.children];
        for (const c of kids) {
            if (c.name === 'Coin') c.destroy();
        }
    }

    private clearAll() {
        const kids = [...this.node.children];
        for (const c of kids) {
            if (c.name === 'Coin' || c.name === 'Obstacle') c.destroy();
        }
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (!gm || gm.getState() !== GameState.RUNNING) return;

        // ДО подсказки: интро — только money_coin, максимум introCoinCount
        if (!gm.tutorialDone) {
            this.timer += dt;
            if (this.timer >= this.spawnInterval) {
                this.timer = 0;
                if (this.introSpawned < this.introCoinCount) {
                    this.makeCoin(this.introCoinIndex, this.spawnX, this.groundY + this.coinHeight);
                    this.introSpawned++;
                }
            }
            return;
        }

        // ПОСЛЕ подсказки: фиксированный сценарий по времени забега (runElapsed)
        const t = gm.getRunElapsed();
        while (this.seqIdx < this.timeline.length && t >= this.timeline[this.seqIdx].t) {
            this.fireEvent(this.timeline[this.seqIdx]);
            this.seqIdx++;
        }
    }

    /** Выполнить одно событие сценария. */
    private fireEvent(e: { t: number, type: string, count?: number }) {
        switch (e.type) {
            case 'arc':     this.spawnCoinArc(e.count); break;
            case 'barrier': this.makeObstacle(); break;
            case 'man':     ManSpawner.instance?.spawnMan(); break;
            case 'coin':    this.makeCoin(-1, this.spawnX, this.groundY + this.coinHeight); break; // случайная монета (money/paypal)
        }
    }

    private spawnOne(introCoinIdx: number = -1) {
        const intro = introCoinIdx >= 0;
        const isObstacle = intro ? false : (Math.random() < this.obstacleChance);

        if (isObstacle) {
            this.makeObstacle();
            return;
        }

        // монеты: дугой (полукругом) — кроме интро (там по одной)
        if (!intro && this.coinArc && this.coinFrames.length > 0) {
            this.spawnCoinArc();
        } else {
            this.makeCoin(intro ? introCoinIdx : -1, this.spawnX, this.groundY + this.coinHeight);
        }
    }

    /** Барьер (конус) на линии земли. */
    private makeObstacle() {
        const sprite = new Node('Obstacle');
        sprite.layer = this.node.layer;
        const ui = sprite.addComponent(UITransform);
        const sp = sprite.addComponent(Sprite);
        sp.spriteFrame = this.obstacleFrame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(255, 255, 255, 255);
        ui.setContentSize(this.obstacleSizeW, this.obstacleSizeH);

        const pickup = sprite.addComponent(Pickup);
        pickup.kind = PickupKind.OBSTACLE;
        pickup.value = 0;
        pickup.speed = this.speed;
        pickup.player = this.player;

        this.node.addChild(sprite);
        sprite.setPosition(new Vec3(this.spawnX, this.groundY + this.obstacleSizeH / 2, 0));

        if (this.obstacleLabel && this.obstacleLabel.length > 0) this.addLabel(sprite);
    }

    /** Одна монета в позиции (x, y). coinIdx = -1 → случайная картинка. */
    private makeCoin(coinIdx: number, x: number, y: number) {
        if (this.coinFrames.length === 0) return;
        const idx = (coinIdx >= 0 && coinIdx < this.coinFrames.length)
            ? coinIdx
            : Math.floor(Math.random() * this.coinFrames.length);
        const coinFrame = this.coinFrames[idx];
        if (!coinFrame) return;

        const sprite = new Node('Coin');
        sprite.layer = this.node.layer;
        const ui = sprite.addComponent(UITransform);
        const sp = sprite.addComponent(Sprite);
        sp.spriteFrame = coinFrame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(255, 255, 255, 255);

        // высота: своя для каждого элемента (coinHeights[idx]) или общая, × общий множитель
        let h = this.coinDisplayHeight;
        if (idx < this.coinHeights.length && this.coinHeights[idx] > 0) h = this.coinHeights[idx];
        h *= this.coinSizeScale;
        const aspect = coinFrame.rect.width / coinFrame.rect.height;
        ui.setContentSize(h * aspect, h);

        // значение: своё для элемента (coinValues[idx]) или 0.5
        let coinValue = 0.5;
        if (idx < this.coinValues.length && this.coinValues[idx] > 0) coinValue = this.coinValues[idx];

        const pickup = sprite.addComponent(Pickup);
        pickup.kind = PickupKind.COIN;
        pickup.value = coinValue;
        pickup.speed = this.speed;
        pickup.player = this.player;
        pickup.radius = this.coinPickRadius;

        this.node.addChild(sprite);
        sprite.setPosition(new Vec3(x, y, 0));
    }

    /** Дуга (полукруг) из монет: концы у земли, верх — над. Едут влево как единая арка. */
    private spawnCoinArc(count?: number) {
        const n = Math.max(1, count ?? this.coinArcCount);
        const R = this.coinArcRadius;
        const baseY = this.groundY + this.coinArcBaseHeight;
        for (let i = 0; i < n; i++) {
            const t = (n > 1) ? i / (n - 1) : 0.5;
            const ang = Math.PI * (1 - t);           // π → 0 (слева-направо по полукругу)
            const x = this.spawnX + R * (1 + Math.cos(ang)); // ширина дуги = 2R
            const y = baseY + R * Math.sin(ang);     // концы = baseY, верх = baseY + R
            this.makeCoin(-1, x, y);                 // случайная картинка (money/paypal вперемешку)
        }
    }

    private hexToColor(hex: string): Color {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16) || 0;
        const g = parseInt(h.slice(2, 4), 16) || 0;
        const b = parseInt(h.slice(4, 6), 16) || 0;
        return new Color(r, g, b, 255);
    }

    private addLabel(parent: Node) {
        // жёлтый скруглённый бейдж — все параметры из инспектора
        const badge = new Node('Hint');
        badge.layer = parent.layer;
        const bui = badge.addComponent(UITransform);
        bui.setContentSize(this.badgeWidth, this.badgeHeight);

        const rr = badge.addComponent(RoundedRect);
        rr.radius = this.badgeRadius;
        rr.fillColorHex = this.badgeColorHex;
        rr.strokeColorHex = this.badgeStrokeColorHex;   // цвет рамки/углов
        rr.strokeWidth = this.badgeStrokeWidth;          // толщина рамки

        // СЛОЙ 1 (сзади): красный текст + белая обводка = белая рамка букв
        if (this.textOutlineWidth > 0) {
            this.addTextLayer(badge, this.textColorHex, this.textOutlineColorHex, this.textOutlineWidth);
        }
        // СЛОЙ 2 (поверх): красный текст + красная обводка = утолщает буквы (жирнее)
        this.addTextLayer(badge, this.textColorHex, this.textColorHex, this.textBoldWidth);

        // пульсация (уменьшается/растёт)
        if (this.badgePulse) {
            const pulse = badge.addComponent(PulseScale);
            pulse.minScale = this.pulseMin;
            pulse.maxScale = this.pulseMax;
            pulse.speed = this.pulseSpeed;
            pulse.stopOnGameOver = true; // на проигрыше EVADE замирает на минимуме
        }

        parent.addChild(badge);
        badge.setPosition(new Vec3(this.labelOffsetX, this.labelOffsetY, 0));
    }

    private addTextLayer(badge: Node, fillHex: string, outlineHex: string, outlineWidth: number) {
        const textNode = new Node('Text');
        textNode.layer = badge.layer;
        const tui = textNode.addComponent(UITransform);
        tui.setContentSize(this.badgeWidth, this.badgeHeight);

        const label = textNode.addComponent(Label);
        label.string = this.obstacleLabel;
        label.fontSize = this.labelFontSize;
        label.lineHeight = this.badgeHeight;
        label.color = this.hexToColor(fillHex);
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.isBold = this.labelBold;
        if (this.labelFont) label.font = this.labelFont;

        if (outlineWidth > 0) {
            label.enableOutline = true;
            label.outlineColor = this.hexToColor(outlineHex);
            label.outlineWidth = outlineWidth;
        }

        badge.addChild(textNode);
        textNode.setPosition(new Vec3(0, 0, 0));
    }
}
