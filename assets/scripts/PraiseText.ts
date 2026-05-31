import { _decorator, Component, Label, UIOpacity, Color, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Всплывающая похвала при сборе монет: «Great!» / «Awesome!» за монету,
 * «Fantastic!» за всю дугу. Текст выскакивает (pop) и плавно исчезает.
 *
 * Создаётся кодом (Spawner.start), позиционируется в верх-центр.
 * Монеты сообщают о сборе через PraiseText.reportCoin(arcId, arcTotal).
 */
@ccclass('PraiseText')
export class PraiseText extends Component {

    public static instance: PraiseText | null = null;
    private static arcCount: Record<number, number> = {};

    // (узел создаётся кодом — настраивается здесь, не в Inspector)
    public praises: string[] = ['Great!', 'Awesome!', 'Nice!']; // похвалы за монету (случайно)
    public fantasticText: string = 'Fantastic!';                // за полностью собранную дугу
    public fontSize: number = 60;                               // размер текста
    public life: number = 0.95;                                 // сколько держится (с появлением/исчезновением)

    private lb: Label | null = null;
    private op: UIOpacity | null = null;
    private t: number = 0;
    private playing: boolean = false;

    onLoad() {
        PraiseText.instance = this;
        PraiseText.arcCount = {};
        this.lb = this.getComponent(Label) || this.addComponent(Label);
        this.lb.fontFamily = 'Fredoka-VariableFont_wdth,wght';
        this.lb.fontSize = this.fontSize;
        this.lb.lineHeight = this.fontSize * 1.1;
        this.lb.isBold = true;
        this.lb.color = new Color(255, 255, 255, 255);
        this.lb.enableOutline = true;
        this.lb.outlineColor = new Color(58, 42, 31, 255); // как у «Jump to avoid enemies»
        this.lb.outlineWidth = 5;
        this.lb.string = '';
        this.op = this.getComponent(UIOpacity) || this.addComponent(UIOpacity);
        this.op.opacity = 0;
    }

    onDestroy() {
        if (PraiseText.instance === this) PraiseText.instance = null;
    }

    /** Монета собрана. arcId<0 — одиночная (всегда похвала); иначе считаем сбор дуги. */
    public static reportCoin(arcId: number, arcTotal: number) {
        const inst = PraiseText.instance;
        if (!inst) return;
        let text: string;
        if (arcId >= 0 && arcTotal > 0) {
            const c = (PraiseText.arcCount[arcId] || 0) + 1;
            PraiseText.arcCount[arcId] = c;
            text = (c >= arcTotal) ? inst.fantasticText : inst.pick();
        } else {
            text = inst.pick();
        }
        inst.show(text);
    }

    private pick(): string {
        if (this.praises.length === 0) return 'Great!';
        return this.praises[Math.floor(Math.random() * this.praises.length)];
    }

    public show(text: string) {
        if (!this.lb) return;
        this.lb.string = text;
        this.t = 0;
        this.playing = true;
        this.node.setScale(0.5, 0.5, 1);
        if (this.op) this.op.opacity = 0;
    }

    update(dt: number) {
        if (!this.playing) return;
        this.t += dt;
        const L = this.life;

        // масштаб: «выскок» 0.5→1 (с лёгким перелётом) за первые 0.22с, потом 1
        let s = 1;
        if (this.t < 0.22) {
            const p = this.t / 0.22;
            const eased = 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2); // ease-out-back
            s = 0.5 + 0.5 * eased;
        }
        this.node.setScale(s, s, 1);

        // прозрачность: быстро появилась, подержалась, плавно исчезла
        let a = 255;
        if (this.t < 0.12) a = 255 * (this.t / 0.12);
        else if (this.t > L - 0.3) a = 255 * Math.max(0, (L - this.t) / 0.3);
        if (this.op) this.op.opacity = Math.floor(Math.max(0, Math.min(255, a)));

        if (this.t >= L) {
            this.playing = false;
            if (this.op) this.op.opacity = 0;
        }
    }
}
