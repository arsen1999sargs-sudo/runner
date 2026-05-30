import { _decorator, Component, Graphics, Color, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Полупрозрачное затемнение на весь экран (рисуется через Graphics).
 * Повесь на узел внутри GameOver (ПЕРВЫМ ребёнком, чтобы был ПОЗАДИ FAIL) —
 * фон потемнеет, когда узел станет активным (game over).
 */
@ccclass('DimOverlay')
export class DimOverlay extends Component {

    @property({ tooltip: 'Цвет затемнения (4-е число = прозрачность 0..255; больше = темнее)' })
    color: Color = new Color(0, 0, 0, 110);

    @property({ type: CCFloat, tooltip: 'Ширина перекрытия (с запасом на весь экран)' })
    width: number = 1400;

    @property({ type: CCFloat, tooltip: 'Высота перекрытия (с запасом на весь экран)' })
    height: number = 2400;

    onLoad() {
        let g = this.getComponent(Graphics);
        if (!g) g = this.addComponent(Graphics);
        g.clear();
        g.fillColor = this.color;
        g.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        g.fill();
    }
}
