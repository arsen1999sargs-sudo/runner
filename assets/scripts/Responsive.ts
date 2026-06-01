import { _decorator, Component, Node, UITransform, view, director, Sprite, SpriteFrame, Texture2D, resources } from 'cc';
const { ccclass } = _decorator;

/**
 * Адаптив UI под любую ширину/ориентацию.
 *
 * Дизайн-разрешение 720×1280, политика FIXED_HEIGHT: высота видимой области всегда
 * 1280 (полувысота 640), а ШИРИНА меняется с соотношением сторон (в landscape ~2276).
 * Поэтому элементы, свёрстанные под ширину 720, в landscape «зажаты» в центре,
 * а панель/затемнение не достают до краёв.
 *
 * Этот компонент якорит элементы к краям экрана и растягивает фон/панель по факту
 * видимого размера (обновляется при resize/смене ориентации). Портретный вид не
 * меняется: при ширине 720 формулы дают исходные позиции.
 *
 * Компонент создаётся в рантайме (GameManager), сцену править не нужно.
 */
const HALF_DW = 360;  // дизайн-ширина 720 / 2
const HALF_DH = 640;  // дизайн-высота 1280 / 2 (== полувысоте видимой области при FIXED_HEIGHT)

type Kind = 'TL' | 'TR' | 'BL' | 'BR' | 'stretchFull' | 'stretchWidth';

interface Item { node: Node; kind: Kind; ox: number; oy: number; oh: number; }

@ccclass('Responsive')
export class Responsive extends Component {

    private items: Item[] = [];
    private lastW: number = -1;

    // нижняя панель: своя картинка для landscape (в родных пропорциях, без искажения)
    private bannerNode: Node | null = null;
    private bannerUI: UITransform | null = null;
    private bannerSprite: Sprite | null = null;
    private portraitFrame: SpriteFrame | null = null;   // исходная (портрет)
    private landscapeFrame: SpriteFrame | null = null;   // широкая (landscape), грузится из resources
    private portraitH: number = 120;                     // высота панели в портрете
    private portraitY: number = -580;                    // Y панели в портрете

    onLoad() {
        // имя узла -> к какому краю привязывать
        this.register('HeartsContainer', 'TL');   // сердца — верх-лево
        this.register('MoneyPanel', 'TR');         // баланс PayPal — верх-право
        this.register('DownloadButton', 'BR');     // кнопка DOWNLOAD — низ-право
        // панель «Playoff» и затемнение (Dim) — отдельная логика (banner ниже, Dim в DimOverlay.ts)
        this.setupBanner();
        this.apply();
    }

    /** Готовим панель «Playoff»: исходная (портрет) + широкая landscape-картинка. */
    private setupBanner() {
        const banner = this.find('PlayoffBanner');
        if (!banner) return;
        this.bannerNode = banner;
        this.bannerUI = banner.getComponent(UITransform);
        this.bannerSprite = banner.getComponent(Sprite);
        if (this.bannerSprite) this.portraitFrame = this.bannerSprite.spriteFrame;
        if (this.bannerUI) this.portraitH = this.bannerUI.contentSize.height;
        this.portraitY = banner.position.y;
        // грузим широкую landscape-картинку из resources (assets/resources/playoff_panel_landscape.*)
        resources.load('playoff_panel_landscape/spriteFrame', SpriteFrame, (err, sf) => {
            if (!err && sf) { this.landscapeFrame = sf as SpriteFrame; this.lastW = -1; this.apply(); return; }
            // фолбэк: если ассет импортирован как texture, а не sprite-frame
            resources.load('playoff_panel_landscape/texture', Texture2D, (e2, tex) => {
                if (!e2 && tex) {
                    const f = new SpriteFrame();
                    f.texture = tex as Texture2D;
                    this.landscapeFrame = f;
                    this.lastW = -1; this.apply();
                } else {
                    console.warn('[Responsive] landscape banner image not found in resources');
                }
            });
        });
    }

    /** Раскладка панели «Playoff»: landscape — широкая картинка в родных пропорциях у низа; портрет — как было. */
    private applyBanner(vis: { width: number, height: number }) {
        if (!this.bannerNode || !this.bannerUI || !this.bannerSprite) return;
        const landscape = vis.width > vis.height;
        if (landscape && this.landscapeFrame) {
            this.bannerSprite.spriteFrame = this.landscapeFrame;
            const r = this.landscapeFrame.rect;          // родной размер кадра (напр. 2022×201)
            const aspect = (r && r.width > 0) ? (r.height / r.width) : (this.portraitH / vis.width);
            const h = vis.width * aspect;                // ширина = весь экран, высота по пропорции (без искажения)
            this.bannerUI.setContentSize(vis.width, h);
            this.bannerNode.setPosition(0, -vis.height / 2 + h / 2, 0); // прижата к низу
        } else {
            if (this.portraitFrame) this.bannerSprite.spriteFrame = this.portraitFrame;
            this.bannerUI.setContentSize(vis.width, this.portraitH);
            this.bannerNode.setPosition(0, this.portraitY, 0);
        }
    }

    private register(name: string, kind: Kind) {
        const node = this.find(name);
        if (!node) return;
        const t = node.getComponent(UITransform);
        this.items.push({
            node, kind,
            ox: node.position.x,
            oy: node.position.y,
            oh: t ? t.contentSize.height : 0,
        });
    }

    private find(name: string): Node | null {
        const scene = director.getScene();
        if (!scene) return null;
        const stack: Node[] = [];
        for (const c of scene.children) stack.push(c);
        while (stack.length) {
            const n = stack.pop() as Node;
            if (n.name === name) return n;
            for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]);
        }
        return null;
    }

    update() {
        const w = view.getVisibleSize().width;
        if (Math.abs(w - this.lastW) > 0.5) this.apply(); // только при изменении ширины (resize/поворот)
    }

    private apply() {
        const vis = view.getVisibleSize();
        this.lastW = vis.width;
        const halfW = vis.width / 2;

        // панель «Playoff» — отдельная раскладка (своя картинка/пропорции в landscape)
        this.applyBanner(vis);

        for (const it of this.items) {
            const t = it.node.getComponent(UITransform);
            switch (it.kind) {
                // углы: сохраняем исходный отступ от соответствующего края (по Y отступ не меняется,
                // т.к. полувысота фиксирована = 640).
                case 'TL': it.node.setPosition(-halfW + (it.ox + HALF_DW), it.oy, 0); break;
                case 'BL': it.node.setPosition(-halfW + (it.ox + HALF_DW), it.oy, 0); break;
                case 'TR': it.node.setPosition(halfW - (HALF_DW - it.ox), it.oy, 0); break;
                case 'BR': it.node.setPosition(halfW - (HALF_DW - it.ox), it.oy, 0); break;
                // затемнение — на весь видимый прямоугольник, в центре
                case 'stretchFull':
                    if (t) t.setContentSize(vis.width, vis.height);
                    it.node.setPosition(0, 0, 0);
                    break;
                // нижняя панель — на всю ширину, высота и Y как были
                case 'stretchWidth':
                    if (t) t.setContentSize(vis.width, it.oh);
                    it.node.setPosition(it.ox, it.oy, 0);
                    break;
            }
        }
    }
}
