import { _decorator, Component, Node, Sprite, SpriteFrame, Label, Font, UITransform, UIOpacity, Vec2, Color, CCFloat, CCObject } from 'cc';
import { EDITOR } from 'cc/env';
import { GameManager } from './GameManager';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Карточка проигрыша: лучи (light_gm) + карта PayPal (paypal_gm) с заработком +
 * текст «You didn't make it!». Появляется ПОСЛЕ того как FAIL вырос
 * (через appearDelay), плавно вырастая.
 *
 * Повесь на пустой узел внутри GameOver. Назначь lightFrame=light_gm,
 * cardFrame=paypal_gm. Двигай куски через *Pos / *Size (живой предпросмотр).
 */
@ccclass('GameOverCard')
@executeInEditMode(true)
export class GameOverCard extends Component {

    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Лучи света (light_gm)' })
    lightFrame: SpriteFrame = null!;
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Карта PayPal (paypal_gm)' })
    cardFrame: SpriteFrame = null!;

    @property({ group: { name: 'Тексты' }, tooltip: 'Заголовок' })
    title: string = "You didn't make it!";
    @property({ group: { name: 'Тексты' }, tooltip: 'Подзаголовок' })
    subtitle: string = 'Try again on the app!';

    @property({ group: { name: 'Тексты' }, type: Font, tooltip: 'Шрифт заголовка (как у Jump to avoid enemies). Пусто = Fredoka по имени' })
    titleFont: Font = null!;

    @property({ group: { name: 'Раскладка' }, tooltip: 'Лучи: позиция' })
    lightPos: Vec2 = new Vec2(0, 40);
    @property({ group: { name: 'Раскладка' }, tooltip: 'Лучи: размер (px)' })
    lightSize: Vec2 = new Vec2(440, 440);

    @property({ group: { name: 'Раскладка' }, tooltip: 'Карта: позиция' })
    cardPos: Vec2 = new Vec2(0, 0);
    @property({ group: { name: 'Раскладка' }, tooltip: 'Карта: размер (px)' })
    cardSize: Vec2 = new Vec2(260, 175);

    @property({ group: { name: 'Раскладка' }, tooltip: 'Заработок $: позиция (на карте)' })
    earnPos: Vec2 = new Vec2(40, -35);
    @property({ group: { name: 'Раскладка' }, type: CCFloat })
    earnFontSize: number = 46;

    @property({ group: { name: 'Раскладка' }, tooltip: 'Заголовок: позиция' })
    titlePos: Vec2 = new Vec2(0, 120);
    @property({ group: { name: 'Раскладка' }, type: CCFloat })
    titleFontSize: number = 28;

    @property({ group: { name: 'Раскладка' }, type: CCFloat, tooltip: 'Скорость вращения лучей, градусов/сек (0 = не крутятся)' })
    lightSpin: number = 20;

    @property({ group: { name: 'Появление' }, type: CCFloat, tooltip: 'Задержка перед появлением (после роста FAIL), сек' })
    appearDelay: number = 0.55;
    @property({ group: { name: 'Появление' }, type: CCFloat, tooltip: 'Длительность роста карточки, сек' })
    popDuration: number = 0.35;
    @property({ group: { name: 'Появление' }, type: CCFloat, tooltip: 'Длительность «накрутки» суммы от $0, сек' })
    earnCountDuration: number = 1.2;
    @property({ group: { name: 'Появление' }, type: Node, tooltip: 'Узел FAIL — спрячется, когда появится карточка (необязательно)' })
    failNode: Node = null!;
    @property({ group: { name: 'Появление' }, type: Node, tooltip: 'Узел Dim (затемнение) — спрячется, когда появится карточка' })
    dimNode: Node = null!;
    @property({ group: { name: 'Появление' }, type: Node, tooltip: 'Кнопка INSTALL AND EARN — включится, когда появится карточка' })
    installButton: Node = null!;
    @property({ group: { name: 'Появление' }, type: [Node], tooltip: 'Узлы, которые СПРЯЧУТСЯ при появлении карты (напр. нижний баннер Playoff, DownloadButton)' })
    hideNodes: Node[] = [];

    private opacity: UIOpacity | null = null;
    private earnLabel: Label | null = null;
    private lightNode: Node | null = null;
    private timer: number = 0;
    private state: number = 0; // 0=ждём, 1=растём, 2=готово
    private lastHash: string = '';
    private earnTarget: number = 0;
    private earnTimer: number = 0;
    private earnCounting: boolean = false;

    onLoad() {
        this.opacity = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        this.build();
        if (!EDITOR) {
            this.opacity.opacity = 0;     // скрыта до появления
            this.node.setScale(0.6, 0.6, 1);
        }
    }

    private mkSprite(name: string, frame: SpriteFrame, size: Vec2, pos: Vec2): Node | null {
        if (!frame) return null;
        const n = new Node(name);
        n.layer = this.node.layer;
        if (EDITOR) n.hideFlags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        const ui = n.addComponent(UITransform);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = frame;
        ui.setContentSize(size.x, size.y); // ВАЖНО: размер ПОСЛЕ spriteFrame, иначе картинка перетрёт его своим
        this.node.addChild(n);
        n.setPosition(pos.x, pos.y, 0);
        return n;
    }

    private mkLabel(name: string, text: string, size: number, pos: Vec2): Label {
        const n = new Node(name);
        n.layer = this.node.layer;
        if (EDITOR) n.hideFlags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        n.addComponent(UITransform);
        const lb = n.addComponent(Label);
        lb.string = text;
        lb.fontSize = size;
        lb.lineHeight = size * 1.1;
        lb.color = new Color(255, 255, 255, 255);
        lb.isBold = true;
        this.node.addChild(n);
        n.setPosition(pos.x, pos.y, 0);
        return lb;
    }

    // шрифт и цвета как у текста «Jump to avoid enemies» (TutorialHint)
    private styleTitle(lb: Label) {
        if (this.titleFont) lb.font = this.titleFont;
        else lb.fontFamily = 'Fredoka-VariableFont_wdth,wght';
        lb.color = new Color(255, 255, 255, 255);
        lb.isBold = true;
        lb.enableOutline = true;
        lb.outlineColor = new Color(58, 42, 31, 255); // тёмно-коричневая обводка
        lb.outlineWidth = 4;
    }

    private build() {
        this.node.removeAllChildren();
        // порядок: лучи → карта → заработок → тексты
        this.lightNode = this.mkSprite('Light', this.lightFrame, this.lightSize, this.lightPos);
        this.mkSprite('Card', this.cardFrame, this.cardSize, this.cardPos);
        this.earnLabel = this.mkLabel('Earn', this.earnText(), this.earnFontSize, this.earnPos);
        this.earnLabel.color = new Color(255, 255, 255, 255); // много белого
        this.earnLabel.fontFamily = 'Fredoka-VariableFont_wdth,wght'; // округлый жирный шрифт как в реф
        this.earnLabel.enableOutline = true;                    // чёрная обводка (чуть жирнее)
        this.earnLabel.outlineColor = new Color(0, 0, 0, 255);
        this.earnLabel.outlineWidth = 3;
        this.styleTitle(this.mkLabel('Title', this.title, this.titleFontSize, this.titlePos));
        this.styleTitle(this.mkLabel('Sub', this.subtitle, this.titleFontSize * 0.5, new Vec2(this.titlePos.x, this.titlePos.y - this.titleFontSize)));
    }

    private earnText(): string {
        const gm = GameManager.instance;
        const v = gm ? gm.earnings : 0;
        return `$${v.toFixed(2)}`;
    }

    update(dt: number) {
        if (EDITOR) {
            const h = `${this.lightPos.x},${this.lightPos.y},${this.lightSize.x},${this.lightSize.y},`
                + `${this.cardPos.x},${this.cardPos.y},${this.cardSize.x},${this.cardSize.y},`
                + `${this.earnPos.x},${this.earnPos.y},${this.earnFontSize},${this.titlePos.x},${this.titlePos.y},${this.titleFontSize},`
                + `${this.title},${this.subtitle}`;
            if (h !== this.lastHash) { this.build(); this.lastHash = h; }
            return;
        }

        // ждём, потом плавно вырастаем
        if (this.state === 0) {
            this.timer += dt;
            if (this.timer >= this.appearDelay) {
                this.state = 1; this.timer = 0;
                // запускаем «накрутку» суммы от $0 до собранного
                const gm = GameManager.instance;
                this.earnTarget = gm ? gm.earnings : 0;
                this.earnTimer = 0;
                this.earnCounting = true;
                if (this.earnLabel) this.earnLabel.string = '$0.00';
                if (this.failNode) this.failNode.active = false;            // прячем FAIL
                if (this.dimNode) this.dimNode.active = false;              // убираем затемнение фона
                if (this.installButton) this.installButton.active = true;   // показываем кнопку INSTALL
                for (const n of this.hideNodes) if (n) n.active = false;     // прячем нижний баннер и др.
            }
        } else if (this.state === 1) {
            this.timer += dt;
            const p = Math.min(1, this.timer / this.popDuration);
            const eased = 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2); // ease-out-back
            const s = 0.6 + 0.4 * eased;
            this.node.setScale(s, s, 1);
            if (this.opacity) this.opacity.opacity = Math.floor(Math.min(1, p * 1.6) * 255);
            if (p >= 1) { this.node.setScale(1, 1, 1); if (this.opacity) this.opacity.opacity = 255; this.state = 2; }
        }

        // «накрутка» суммы $0 → собранное
        if (this.earnCounting && this.earnLabel) {
            this.earnTimer += dt;
            const t = Math.min(1, this.earnTimer / Math.max(0.01, this.earnCountDuration));
            const eased = 1 - (1 - t) * (1 - t); // ease-out (быстрее в начале, плавно в конце)
            this.earnLabel.string = `$${(this.earnTarget * eased).toFixed(2)}`;
            if (t >= 1) { this.earnLabel.string = `$${this.earnTarget.toFixed(2)}`; this.earnCounting = false; }
        }

        // лучи света медленно крутятся
        if (this.lightNode && this.lightSpin !== 0) {
            this.lightNode.angle += this.lightSpin * dt;
        }
    }
}
