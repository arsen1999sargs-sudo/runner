import { _decorator, Component, Node, Graphics, Label, UITransform, Vec2, Vec3, Color, CCFloat, CCObject, director } from 'cc';
import { EDITOR } from 'cc/env';
import { GameManager, GameState } from './GameManager';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Кнопка «INSTALL AND EARN»: красный скруглённый фон + белый текст с обводкой,
 * лёгкая пульсация, по тапу перезапускает игру.
 *
 * Повесь на пустой узел (НЕ внутри Card — Card пересобирается). Лучше под GameOver.
 */
@ccclass('InstallButton')
@executeInEditMode(true)
export class InstallButton extends Component {

    @property({ tooltip: 'Текст кнопки' })
    text: string = 'INSTALL AND EARN';

    @property({ tooltip: 'Размер кнопки (px)' })
    size: Vec2 = new Vec2(540, 100);

    @property({ type: CCFloat, tooltip: 'Размер текста' })
    fontSize: number = 34;

    @property({ type: CCFloat, tooltip: 'Скругление углов' })
    radius: number = 20;

    @property({ tooltip: 'Цвет кнопки сверху (hex без #)' })
    topColorHex: string = 'F0564B';
    @property({ tooltip: 'Цвет кнопки снизу (hex без #)' })
    bottomColorHex: string = 'C62828';
    @property({ tooltip: 'Цвет рамки (hex без #)' })
    strokeColorHex: string = '8E1A1A';
    @property({ type: CCFloat, tooltip: 'Толщина рамки' })
    strokeWidth: number = 5;

    @property({ tooltip: 'Цвет обводки текста (hex без #)' })
    textOutlineHex: string = '7A1414';

    // ---- Цвета на ПОБЕДЕ (жёлтая кнопка) ----
    @property({ group: { name: 'Цвета на победе' }, tooltip: 'Верх — светло-оранжевый (hex без #)' })
    winTopColorHex: string = 'FFB23C';
    @property({ group: { name: 'Цвета на победе' }, tooltip: 'Низ — тёмно-оранжевый (hex без #)' })
    winBottomColorHex: string = 'D2730A';
    @property({ group: { name: 'Цвета на победе' }, tooltip: 'Рамка (hex без #)' })
    winStrokeColorHex: string = '9A5400';
    @property({ group: { name: 'Цвета на победе' }, tooltip: 'Обводка текста (hex без #)' })
    winTextOutlineHex: string = '7A4E00';

    @property({ tooltip: 'Пульсация (привлекает внимание)' })
    pulse: boolean = true;

    @property({ type: CCFloat, tooltip: 'Скорость пульсации (циклов/сек, меньше = медленнее)' })
    pulseSpeed: number = 0.9;

    @property({ type: CCFloat, tooltip: 'Длительность появления (рост из нуля вместе с картой), сек' })
    appearDuration: number = 0.35;

    private gfx: Graphics | null = null;
    private base: Vec3 = new Vec3(1, 1, 1);
    private t: number = 0;
    private lastHash: string = '';
    private appearing: boolean = false;
    private appearTimer: number = 0;
    private _win: boolean = false;

    private curTop(): string { return this._win ? this.winTopColorHex : this.topColorHex; }
    private curBot(): string { return this._win ? this.winBottomColorHex : this.bottomColorHex; }
    private curStroke(): string { return this._win ? this.winStrokeColorHex : this.strokeColorHex; }
    private curOutline(): string { return this._win ? this.winTextOutlineHex : this.textOutlineHex; }

    onLoad() {
        this.base = this.node.scale.clone();
        this.build();
        // тап ТОЛЬКО по самой кнопке (а не по всему экрану)
        if (!EDITOR) this.node.on(Node.EventType.TOUCH_END, this.onTap, this);
    }
    onEnable() {
        // плавное появление вместе с картой (растёт из нуля)
        if (EDITOR) return;
        // победа или проигрыш — выбираем цвет кнопки
        const gm = GameManager.instance;
        this._win = !!gm && gm.getState() === GameState.FINISHED;
        this.build(); // перерисовать нужным цветом
        this.appearing = true;
        this.appearTimer = 0;
        this.node.setScale(0, 0, 1);
    }
    onDestroy() {
        if (!EDITOR) this.node.off(Node.EventType.TOUCH_END, this.onTap, this);
    }

    private onTap() {
        const s = director.getScene();
        if (s) director.loadScene(s.name); // перезапуск игры
    }

    private hex(h: string): Color {
        h = h.replace('#', '');
        return new Color(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255);
    }

    private build() {
        // фон
        const ui = this.getComponent(UITransform) || this.addComponent(UITransform);
        ui.setContentSize(this.size.x, this.size.y);
        this.gfx = this.getComponent(Graphics) || this.addComponent(Graphics);
        this.drawBg(ui);
        // текст (пересоздаём)
        const old = this.node.getChildByName('BtnLabel');
        if (old) old.destroy();
        const ln = new Node('BtnLabel');
        ln.layer = this.node.layer;
        if (EDITOR) ln.hideFlags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        ln.addComponent(UITransform);
        const lb = ln.addComponent(Label);
        lb.string = this.text;
        lb.fontSize = this.fontSize;
        lb.lineHeight = this.fontSize * 1.1;
        lb.color = new Color(255, 255, 255, 255);   // чистый белый
        lb.isBold = true;
        lb.isItalic = true; // наклонный, как в референсе
        // тонкая тёмная обводка — держит читаемость, но не «грязнит» белый
        lb.enableOutline = true;
        lb.outlineColor = this.hex(this.curOutline());
        lb.outlineWidth = 2;
        // лёгкая тень снизу — объём и ощущение жирности
        lb.enableShadow = true;
        lb.shadowColor = new Color(0, 0, 0, 130);
        lb.shadowOffset = new Vec2(0, -3);
        lb.shadowBlur = 3;
        this.node.addChild(ln);
        ln.setPosition(0, 0, 0);
    }

    private drawBg(ui: UITransform) {
        if (!this.gfx) return;
        const w = ui.contentSize.width, h = ui.contentSize.height;
        const r = Math.min(this.radius, w / 2, h / 2);
        const x0 = -w * ui.anchorX, y0 = -h * ui.anchorY;
        const top = this.hex(this.curTop()), bot = this.hex(this.curBot());
        this.gfx.clear();
        // вертикальный градиент полосками со скруглением по краям
        const strips = 40, dy = h / strips;
        for (let i = 0; i < strips; i++) {
            const yc = i * dy + dy / 2, tt = yc / h;
            const cr = Math.round(bot.r + (top.r - bot.r) * tt);
            const cg = Math.round(bot.g + (top.g - bot.g) * tt);
            const cb = Math.round(bot.b + (top.b - bot.b) * tt);
            let inset = 0;
            const db = yc, dt2 = h - yc;
            if (db < r) inset = r - Math.sqrt(Math.max(0, r * r - (r - db) * (r - db)));
            else if (dt2 < r) inset = r - Math.sqrt(Math.max(0, r * r - (r - dt2) * (r - dt2)));
            this.gfx.fillColor = new Color(cr, cg, cb, 255);
            this.gfx.rect(x0 + inset, y0 + i * dy, w - inset * 2, dy + 1);
            this.gfx.fill();
        }
        if (this.strokeWidth > 0) {
            this.gfx.lineWidth = this.strokeWidth;
            this.gfx.strokeColor = this.hex(this.curStroke());
            this.gfx.roundRect(x0, y0, w, h, r);
            this.gfx.stroke();
        }
    }

    update(dt: number) {
        if (EDITOR) {
            const hsh = `${this.text},${this.size.x},${this.size.y},${this.fontSize},${this.radius},${this.topColorHex},${this.bottomColorHex},${this.strokeColorHex},${this.strokeWidth}`;
            if (hsh !== this.lastHash) { this.build(); this.lastHash = hsh; }
            return;
        }
        // плавное появление (рост из нуля), синхронно с картой
        if (this.appearing) {
            this.appearTimer += dt;
            const p = Math.min(1, this.appearTimer / Math.max(0.01, this.appearDuration));
            const eased = 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2); // ease-out-back
            this.node.setScale(this.base.x * eased, this.base.y * eased, this.base.z);
            if (p >= 1) { this.node.setScale(this.base.x, this.base.y, this.base.z); this.appearing = false; this.t = 0; }
            return;
        }

        if (this.pulse) {
            this.t += dt * this.pulseSpeed * Math.PI * 2;
            const s = 1 + 0.06 * Math.sin(this.t);
            this.node.setScale(this.base.x * s, this.base.y * s, this.base.z);
        }
    }
}
