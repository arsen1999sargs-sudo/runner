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
        this.gfx.fillColor = this.hexToColor(this.fillColorHex);
        this.gfx.strokeColor = this.hexToColor(this.strokeColorHex);
        this.gfx.lineWidth = this.strokeWidth;

        // путь rounded rect (от центра, потому что anchor по умолчанию 0.5, 0.5)
        const x = -w / 2;
        const y = -h / 2;

        this.gfx.moveTo(x + r, y);
        this.gfx.lineTo(x + w - r, y);
        this.gfx.arc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
        this.gfx.lineTo(x + w, y + h - r);
        this.gfx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
        this.gfx.lineTo(x + r, y + h);
        this.gfx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
        this.gfx.lineTo(x, y + r);
        this.gfx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
        this.gfx.close();
        this.gfx.fill();
        if (this.strokeWidth > 0) this.gfx.stroke();
    }
}
