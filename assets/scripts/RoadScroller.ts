import { _decorator, Component, Graphics, Color, CCFloat, CCInteger } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Прокручивающаяся дорожная разметка (белые штрихи по центру), создающая
 * иллюзию бега вперёд. Рисуется через Graphics, штрихи "едут" вниз когда
 * игра в состоянии RUNNING. Никаких спрайтов не нужно.
 *
 * Поместить на узел в GameLayer НИЖЕ игрока (рисуется на дороге).
 */
@ccclass('RoadScroller')
export class RoadScroller extends Component {

    @property({ type: CCFloat, tooltip: 'Скорость прокрутки разметки (px/сек)' })
    speed: number = 500;

    @property({ type: CCFloat, tooltip: 'Вертикальный шаг между штрихами' })
    spacing: number = 180;

    @property({ type: CCFloat, tooltip: 'Ширина штриха' })
    markWidth: number = 24;

    @property({ type: CCFloat, tooltip: 'Высота штриха' })
    markHeight: number = 90;

    @property({ type: CCFloat, tooltip: 'Верхняя граница (где штрихи появляются)' })
    topY: number = 60;

    @property({ type: CCFloat, tooltip: 'Нижняя граница (где штрихи исчезают)' })
    bottomY: number = -640;

    @property({ type: CCFloat, tooltip: 'Прозрачность штрихов 0..255' })
    alpha: number = 180;

    private gfx: Graphics | null = null;
    private offset: number = 0;
    private drawnStatic: boolean = false;

    onLoad() {
        this.gfx = this.getComponent(Graphics);
        if (!this.gfx) this.gfx = this.addComponent(Graphics);
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.getState() === GameState.RUNNING) {
            // движется — перерисовываем каждый кадр
            this.offset += this.speed * dt;
            if (this.offset >= this.spacing) this.offset -= this.spacing;
            this.draw();
            this.drawnStatic = false;
        } else if (!this.drawnStatic) {
            // в покое (старт/пауза/конец) разметка статична — рисуем ОДИН раз, не каждый кадр
            this.draw();
            this.drawnStatic = true;
        }
    }

    private draw() {
        if (!this.gfx) return;
        this.gfx.clear();
        this.gfx.fillColor = new Color(255, 255, 255, this.alpha);

        // Накапливаем все штрихи в один путь и заливаем ОДНИМ fill() — раньше fill() звался
        // на каждый штрих (лишние draw-call'ы каждый кадр). Один fill заметно дешевле.
        const count = Math.ceil((this.topY - this.bottomY) / this.spacing) + 2;
        for (let i = -1; i < count; i++) {
            // штрихи едут вниз: вычитаем offset (он зациклен 0..spacing)
            const y = this.topY - i * this.spacing - this.offset;
            if (y < this.bottomY - this.markHeight || y > this.topY + this.markHeight) continue;
            this.gfx.rect(-this.markWidth / 2, y - this.markHeight / 2, this.markWidth, this.markHeight);
        }
        this.gfx.fill();
    }
}
