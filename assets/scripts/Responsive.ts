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

interface Item { node: Node; kind: Kind; ox: number; oy: number; oh: number; sL: number; os: number; }

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
    private bannerCenterY: number = -580;                // текущий центр панели по Y (для кнопки DOWNLOAD)

    // кнопка DOWNLOAD: в landscape крупнее и по центру панели
    private dlNode: Node | null = null;
    private dlPulse: any = null;  // PulseScale на кнопке (берём по строковому имени, чтобы не плодить циклический импорт)
    private dlOx: number = 243;   // исходный X (портрет)
    private dlOy: number = -597;  // исходный Y (портрет)
    private dlW: number = 150;    // ширина кнопки
    private dlH: number = 60;     // высота кнопки
    private dlOs: number = 1;     // исходный масштаб (портрет)

    onLoad() {
        // имя узла -> к какому краю привязывать
        this.register('HeartsContainer', 'TL', 2.0);   // сердца — верх-лево, в landscape ×2
        this.register('MoneyPanel', 'TR', 2.0);        // баланс PayPal — верх-право, в landscape ×2
        // панель «Playoff», кнопка DOWNLOAD и затемнение (Dim) — отдельная логика (ниже / в DimOverlay.ts)
        this.setupBanner();
        this.setupDownload();
        this.apply();
    }

    /** Запоминаем исходные параметры кнопки DOWNLOAD. */
    private setupDownload() {
        const dl = this.find('DownloadButton');
        if (!dl) return;
        this.dlNode = dl;
        this.dlPulse = dl.getComponent('PulseScale') as any;
        this.dlOx = dl.position.x;
        this.dlOy = dl.position.y;
        this.dlOs = dl.scale.x || 1;
        const t = dl.getComponent(UITransform);
        if (t) { this.dlW = t.contentSize.width; this.dlH = t.contentSize.height; }
    }

    /** Задать масштаб кнопки: через базу пульсации (если есть), иначе напрямую. */
    private setDownloadScale(s: number) {
        if (this.dlPulse && typeof this.dlPulse.setBaseScale === 'function') this.dlPulse.setBaseScale(s);
        else if (this.dlNode) this.dlNode.setScale(s, s, 1);
    }

    /** Раскладка кнопки DOWNLOAD: landscape — крупнее и по центру панели; портрет — как было (низ-право). */
    private applyDownload(vis: { width: number, height: number }) {
        if (!this.dlNode) return;
        const halfW = vis.width / 2;
        const landscape = vis.width > vis.height;
        if (landscape) {
            // высота кнопки ≈ 40% высоты панели, но не мельче исходной
            const bannerH = this.bannerCenterY - (-vis.height / 2); // = h/2 (панель прижата к низу)
            const targetH = Math.max(this.dlH, bannerH * 2 * 0.40);
            const s = targetH / this.dlH;
            this.setDownloadScale(s);
            const halfBtnW = (this.dlW * s) / 2;
            this.dlNode.setPosition(halfW - halfBtnW - 20, this.bannerCenterY, 0); // справа, по вертикальному центру панели
        } else {
            this.setDownloadScale(this.dlOs);
            this.dlNode.setPosition(halfW - (HALF_DW - this.dlOx), this.dlOy, 0); // низ-право, исходный размер
        }
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
            this.bannerCenterY = -vis.height / 2 + h / 2;
            this.bannerNode.setPosition(0, this.bannerCenterY, 0); // прижата к низу
        } else {
            if (this.portraitFrame) this.bannerSprite.spriteFrame = this.portraitFrame;
            this.bannerUI.setContentSize(vis.width, this.portraitH);
            this.bannerCenterY = this.portraitY;
            this.bannerNode.setPosition(0, this.portraitY, 0);
        }
    }

    private register(name: string, kind: Kind, scaleLandscape: number = 1) {
        const node = this.find(name);
        if (!node) return;
        const t = node.getComponent(UITransform);
        this.items.push({
            node, kind,
            ox: node.position.x,
            oy: node.position.y,
            oh: t ? t.contentSize.height : 0,
            sL: scaleLandscape,
            os: node.scale.x || 1,
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
        const landscape = vis.width > vis.height;

        // панель «Playoff» — отдельная раскладка (своя картинка/пропорции в landscape)
        this.applyBanner(vis);
        // кнопка DOWNLOAD — крупнее и по центру панели в landscape (после applyBanner: bannerCenterY готов)
        this.applyDownload(vis);

        for (const it of this.items) {
            const t = it.node.getComponent(UITransform);
            // в landscape угловые элементы можно увеличить; отступы от краёв тоже множим на масштаб,
            // чтобы увеличенный элемент не вылезал за край. По Y отступ от верха = (640 - oy)*s.
            const m = landscape ? it.sL : 1;        // множитель отступов (как растёт элемент)
            const s = it.os * m;                     // итоговый масштаб (исходный × landscape-множитель)
            switch (it.kind) {
                case 'TL': it.node.setScale(s, s, 1); it.node.setPosition(-halfW + (it.ox + HALF_DW) * m, HALF_DH - (HALF_DH - it.oy) * m, 0); break;
                case 'BL': it.node.setScale(s, s, 1); it.node.setPosition(-halfW + (it.ox + HALF_DW) * m, -HALF_DH + (it.oy + HALF_DH) * m, 0); break;
                case 'TR': it.node.setScale(s, s, 1); it.node.setPosition(halfW - (HALF_DW - it.ox) * m, HALF_DH - (HALF_DH - it.oy) * m, 0); break;
                case 'BR': it.node.setScale(s, s, 1); it.node.setPosition(halfW - (HALF_DW - it.ox) * m, -HALF_DH + (it.oy + HALF_DH) * m, 0); break;
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
