import { _decorator, Component, Node, CCFloat, Color, Sprite, SpriteFrame, UITransform, Vec3, Label, Font, LabelOutline, HorizontalTextAlignment, VerticalTextAlignment } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Pickup, PickupKind } from './Pickup';
import { RoundedRect } from './RoundedRect';
import { PulseScale } from './PulseScale';
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
        const isObstacle = Math.random() < this.obstacleChance;

        const sprite = new Node(isObstacle ? 'Obstacle' : 'Coin');
        sprite.layer = this.node.layer;

        // для монеты выбираем случайную картинку из списка (PayPal / купюра)
        let coinFrame: SpriteFrame | null = null;
        let coinIdx = -1;
        if (!isObstacle && this.coinFrames.length > 0) {
            coinIdx = Math.floor(Math.random() * this.coinFrames.length);
            coinFrame = this.coinFrames[coinIdx];
        }

        const ui = sprite.addComponent(UITransform);

        const sp = sprite.addComponent(Sprite);
        sp.spriteFrame = isObstacle ? this.obstacleFrame : coinFrame;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;   // ВАЖНО: иначе размер берётся из картинки
        sp.color = new Color(255, 255, 255, 255);

        // задаём размер ПОСЛЕ CUSTOM, чтобы он применился
        if (isObstacle) {
            ui.setContentSize(this.obstacleSizeW, this.obstacleSizeH);
        } else if (coinFrame) {
            // высота: своя для каждого элемента (coinHeights[idx]) или общая
            let h = this.coinDisplayHeight;
            if (coinIdx >= 0 && coinIdx < this.coinHeights.length && this.coinHeights[coinIdx] > 0) {
                h = this.coinHeights[coinIdx];
            }
            const aspect = coinFrame.rect.width / coinFrame.rect.height;
            ui.setContentSize(h * aspect, h);
        } else {
            ui.setContentSize(60, 60);
        }

        // значение монеты: своё для каждого элемента (coinValues[idx]) или 0.5
        let coinValue = 0.5;
        if (coinIdx >= 0 && coinIdx < this.coinValues.length && this.coinValues[coinIdx] > 0) {
            coinValue = this.coinValues[coinIdx];
        }

        const pickup = sprite.addComponent(Pickup);
        pickup.kind = isObstacle ? PickupKind.OBSTACLE : PickupKind.COIN;
        pickup.value = isObstacle ? 0 : coinValue;
        pickup.speed = this.speed;
        pickup.player = this.player;

        this.node.addChild(sprite);

        // основание конуса стоит на линии земли (groundY): центр = groundY + половина высоты
        // монета — выше земли
        const y = isObstacle
            ? this.groundY + this.obstacleSizeH / 2
            : this.groundY + this.coinHeight;
        sprite.setPosition(new Vec3(this.spawnX, y, 0));

        // подпись над барьером
        if (isObstacle && this.obstacleLabel && this.obstacleLabel.length > 0) {
            this.addLabel(sprite);
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
            const outline = textNode.addComponent(LabelOutline);
            outline.color = this.hexToColor(outlineHex);
            outline.width = outlineWidth;
        }

        badge.addChild(textNode);
        textNode.setPosition(new Vec3(0, 0, 0));
    }
}
