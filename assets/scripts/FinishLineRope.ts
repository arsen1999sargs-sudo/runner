import { _decorator, Component, Node, Graphics, Color, Vec2, CCFloat, CCInteger, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Финишная лента с эффектом провисающей верёвки (Verlet physics).
 *
 * Использование:
 *  - Поместите на узел с компонентом Graphics
 *  - Установите длину, число сегментов, цвет
 *  - Setup автоматически создаёт точки и связи
 *  - Update интегрирует Verlet и рисует ленту через Graphics
 *  - При вызове breakAt(x) лента "рвётся" в указанной точке
 */
@ccclass('FinishLineRope')
export class FinishLineRope extends Component {

    @property(CCFloat)
    length: number = 600;

    @property(CCInteger)
    segments: number = 24;

    @property(CCFloat)
    gravity: number = 800;

    @property(CCFloat)
    sag: number = 30;

    @property(CCFloat)
    thickness: number = 8;

    @property(CCFloat)
    triggerY: number = -100;

    @property(Node)
    player: Node = null!;

    private gfx: Graphics | null = null;
    private points: { x: number, y: number, px: number, py: number, pinned: boolean }[] = [];
    private constraints: { a: number, b: number, rest: number }[] = [];
    private broken: boolean = false;
    private brokenAt: number = -1;
    private elapsed: number = 0;
    private fired: boolean = false;

    onLoad() {
        this.gfx = this.getComponent(Graphics);
        if (!this.gfx) {
            this.gfx = this.addComponent(Graphics);
        }
        this.buildRope();
    }

    private buildRope() {
        this.points.length = 0;
        this.constraints.length = 0;

        const step = this.length / (this.segments - 1);
        const startX = -this.length / 2;

        for (let i = 0; i < this.segments; i++) {
            const x = startX + i * step;
            // лёгкое провисание (парабола) для начального вида
            const t = i / (this.segments - 1);
            const y = -this.sag * 4 * t * (1 - t);
            this.points.push({ x, y, px: x, py: y, pinned: i === 0 || i === this.segments - 1 });
        }

        for (let i = 0; i < this.segments - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            this.constraints.push({ a: i, b: i + 1, rest: Math.sqrt(dx * dx + dy * dy) });
        }
    }

    /** Разрывает связь между двумя сегментами в указанной точке X */
    public breakAt(worldX: number) {
        if (this.broken) return;
        // Найти ближайшую точку и разорвать связь
        let nearest = 0;
        let minDx = Infinity;
        for (let i = 0; i < this.points.length; i++) {
            const dx = Math.abs(this.points[i].x - worldX);
            if (dx < minDx) {
                minDx = dx;
                nearest = i;
            }
        }
        // удалить ближайшую связь после nearest
        const idx = Math.min(nearest, this.constraints.length - 1);
        if (idx >= 0) {
            this.constraints.splice(idx, 1);
            this.broken = true;
            this.brokenAt = nearest;
        }
    }

    update(dt: number) {
        const gm = GameManager.instance;

        // Триггер разрыва: когда игрок добежал и финиш достигнут
        if (!this.fired && gm && this.player && gm.getState() === GameState.RUNNING) {
            // расстояние/прогресс ~ позиция Y от triggerY
            if (gm.distanceTraveled >= gm.FINISH_DISTANCE * 0.95) {
                // лента "рвётся" в центре
                this.breakAt(0);
                this.fired = true;
            }
        }

        // ограничим dt для стабильности
        const fixedDt = Math.min(dt, 1 / 30);
        this.integrate(fixedDt);
        for (let i = 0; i < 5; i++) {
            this.solveConstraints();
        }
        this.draw();
    }

    private integrate(dt: number) {
        for (const p of this.points) {
            if (p.pinned) continue;
            const vx = (p.x - p.px) * 0.99;
            const vy = (p.y - p.py) * 0.99;
            p.px = p.x;
            p.py = p.y;
            p.x += vx;
            p.y += vy - this.gravity * dt * dt;
        }
    }

    private solveConstraints() {
        for (const c of this.constraints) {
            const a = this.points[c.a];
            const b = this.points[c.b];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
            const diff = (d - c.rest) / d * 0.5;
            const ox = dx * diff;
            const oy = dy * diff;
            if (!a.pinned) { a.x += ox; a.y += oy; }
            if (!b.pinned) { b.x -= ox; b.y -= oy; }
        }
    }

    private draw() {
        if (!this.gfx) return;
        this.gfx.clear();
        this.gfx.lineWidth = this.thickness;
        this.gfx.strokeColor = new Color(220, 50, 50, 255);
        this.gfx.lineCap = 1; // round
        this.gfx.lineJoin = 1; // round

        // Рисуем ленту двумя сегментами (левая часть и правая, если разорвана)
        let firstHalfEnd = this.broken ? this.brokenAt : this.points.length - 1;
        // первая половина
        this.gfx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i <= firstHalfEnd; i++) {
            this.gfx.lineTo(this.points[i].x, this.points[i].y);
        }
        this.gfx.stroke();

        // вторая половина (если разорвана)
        if (this.broken && firstHalfEnd + 1 < this.points.length) {
            this.gfx.moveTo(this.points[firstHalfEnd + 1].x, this.points[firstHalfEnd + 1].y);
            for (let i = firstHalfEnd + 2; i < this.points.length; i++) {
                this.gfx.lineTo(this.points[i].x, this.points[i].y);
            }
            this.gfx.stroke();
        }

        // полосатый узор: чёрные риски через каждые 3 сегмента
        this.gfx.lineWidth = this.thickness * 0.8;
        this.gfx.strokeColor = new Color(20, 20, 20, 255);
        for (let i = 0; i < this.segments - 1; i++) {
            if (i % 2 !== 0) continue;
            const a = this.points[i];
            const b = this.points[i + 1];
            const t1 = 0.3, t2 = 0.7;
            this.gfx.moveTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
            this.gfx.lineTo(a.x + (b.x - a.x) * t2, a.y + (b.y - a.y) * t2);
            this.gfx.stroke();
        }
    }
}
