import { _decorator, Component, Graphics, Color, CCFloat, UITransform } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Рисует прямоугольник со скруглёнными углами с помощью Graphics.
 * Можно использовать как фон для кнопок.
 *
 * Использование:
 *   1. Создать пустой Node
 *   2. Добавить cc.UITransform — задать Content Size (например 180x65)
 *   3. Добавить этот компонент RoundedRect
 *   4. Настроить fillColor, radius, опционально strokeWidth + strokeColor
 *   5. Внутрь добавить Label "DOWNLOAD"
 */
@ccclass('RoundedRect')
@executeInEditMode(true)
export class RoundedRect extends Component {

    @property
    radius: number = 16;

    @property({ tooltip: 'Цвет заливки в hex без #, например F58A1F' })
    fillColorHex: string = 'F58A1F';

    @property
    strokeWidth: number = 0;

    @property
    strokeColorHex: string = '000000';

    @property({ tooltip: 'Включить вертикальный градиент (светлее сверху)' })
    useGradient: boolean = false;

    @property({ tooltip: 'Цвет ВЕРХА при градиенте (hex без #)' })
    topColorHex: string = 'FFC94D';

    @property({ tooltip: 'Цвет НИЗА при градиенте (hex без #)' })
    bottomColorHex: string = 'E08A12';

    private gfx: Graphics | null = null;

    onLoad() {
        this.ensureGraphics();
        this.redraw();
    }

    onEnable() {
        this.ensureGraphics();
        this.redraw();
    }

    update() {
        // перерисовываем когда меняется размер контейнера
        this.redraw();
    }

    private ensureGraphics() {
        this.gfx = this.getComponent(Graphics);
        if (!this.gfx) {
            this.gfx = this.addComponent(Graphics);
        }
    }

    private hexToColor(hex: string, alpha: number = 255): Color {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return new Color(r, g, b, alpha);
    }

    private redraw() {
        if (!this.gfx) return;
        const ui = this.getComponent(UITransform);
        if (!ui) return;
        const w = ui.contentSize.width;
        const h = ui.contentSize.height;
        const r = Math.min(this.radius, w / 2, h / 2);

        this.gfx.clear();
        this.gfx.strokeColor = this.hexToColor(this.strokeColorHex);
        this.gfx.lineWidth = this.strokeWidth;

        const x0 = -w * ui.anchorX;
        const y0 = -h * ui.anchorY;

        if (this.useGradient) {
            this.drawGradient(x0, y0, w, h, r);
        } else {
            this.gfx.fillColor = this.hexToColor(this.fillColorHex);
            this.gfx.roundRect(x0, y0, w, h, r);
            this.gfx.fill();
        }

        if (this.strokeWidth > 0) {
            this.gfx.roundRect(x0, y0, w, h, r);
            this.gfx.stroke();
        }
    }

    /**
     * Рисует вертикальный градиент горизонтальными полосками.
     * Каждая полоска инсетится по краям по формуле окружности,
     * чтобы повторять скруглённые углы.
     */
    private drawGradient(x0: number, y0: number, w: number, h: number, r: number) {
        if (!this.gfx) return;
        const top = this.hexToColor(this.topColorHex);
        const bot = this.hexToColor(this.bottomColorHex);
        const strips = 48;
        const dy = h / strips;

        for (let i = 0; i < strips; i++) {
            const yLocal = i * dy;           // от 0 (низ) до h (верх)
            const yCenter = yLocal + dy / 2;
            const t = yCenter / h;           // 0 внизу, 1 вверху

            // интерполяция цвета (t=1 верх → top color)
            const cr = Math.round(bot.r + (top.r - bot.r) * t);
            const cg = Math.round(bot.g + (top.g - bot.g) * t);
            const cb = Math.round(bot.b + (top.b - bot.b) * t);

            // инсет по краям возле скруглённых углов
            let inset = 0;
            const distBottom = yCenter;
            const distTop = h - yCenter;
            if (distBottom < r) {
                inset = r - Math.sqrt(Math.max(0, r * r - (r - distBottom) * (r - distBottom)));
            } else if (distTop < r) {
                inset = r - Math.sqrt(Math.max(0, r * r - (r - distTop) * (r - distTop)));
            }

            this.gfx.fillColor = new Color(cr, cg, cb, 255);
            this.gfx.rect(x0 + inset, y0 + yLocal, w - inset * 2, dy + 1);
            this.gfx.fill();
        }
    }
}
