import { _decorator, Component, Graphics, Color, CCFloat, view } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Полупрозрачное затемнение на весь экран (рисуется через Graphics).
 * Повесь на узел внутри GameOver (ПЕРВЫМ ребёнком, чтобы был ПОЗАДИ FAIL) —
 * фон потемнеет, когда узел станет активным (game over).
 *
 * Адаптивно: перекрытие рисуется по фактическому видимому размеру экрана и
 * перерисовывается при resize/смене ориентации (в landscape ширина видимой
 * области большая — затемнение всё равно покрывает весь экран).
 */
@ccclass('DimOverlay')
export class DimOverlay extends Component {

    @property({ tooltip: 'Цвет затемнения (4-е число = прозрачность 0..255; больше = темнее)' })
    color: Color = new Color(0, 0, 0, 110);

    @property({ type: CCFloat, tooltip: 'Мин. ширина перекрытия (реальная = max с шириной экрана)' })
    width: number = 1400;

    @property({ type: CCFloat, tooltip: 'Мин. высота перекрытия (реальная = max с высотой экрана)' })
    height: number = 2400;

    private lastW: number = -1;

    onLoad() {
        this.redraw();
    }

    onEnable() {
        // перерисовываем при каждом показе (game-over может включиться уже в другой ориентации)
        this.lastW = -1;
        this.redraw();
    }

    update() {
        // перерисовываем только при изменении ширины (resize/поворот)
        if (Math.abs(view.getVisibleSize().width - this.lastW) > 0.5) this.redraw();
    }

    private redraw() {
        let g = this.getComponent(Graphics);
        if (!g) g = this.addComponent(Graphics);
        const vis = view.getVisibleSize();
        this.lastW = vis.width;
        // с запасом покрываем весь видимый прямоугольник при любой ориентации
        const w = Math.max(this.width, vis.width) + 8;
        const h = Math.max(this.height, vis.height) + 8;
        g.clear();
        g.fillColor = this.color;
        g.rect(-w / 2, -h / 2, w, h);
        g.fill();
    }
}
