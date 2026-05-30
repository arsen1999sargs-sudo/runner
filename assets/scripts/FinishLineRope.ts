import { _decorator, Component, Node, Graphics, Color, Vec2, Vec3, CCFloat, CCInteger, UITransform } from 'cc';
import { EDITOR } from 'cc/env';
import { GameManager, GameState } from './GameManager';
const { ccclass, property, executeInEditMode } = _decorator;

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
@executeInEditMode
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

    @property({ type: Color, tooltip: 'Цвет ленты' })
    ribbonColor: Color = new Color(247, 197, 37, 255); // жёлтый

    @property({ type: Node, tooltip: 'Левый столб (baryer1). Если задан — лента крепится к нему' })
    leftPole: Node = null!;

    @property({ type: Node, tooltip: 'Правый столб (baryer2). Если задан — лента крепится к нему' })
    rightPole: Node = null!;

    @property({ type: CCFloat, tooltip: 'Сдвиг точек крепления вверх, к верхушкам столбов' })
    topOffset: number = 60;

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

        // Концы ленты в ЛОКАЛЬНЫХ координатах этого узла
        let ax: number, ay: number, bx: number, by: number;

        if (this.leftPole && this.rightPole) {
            // крепимся прямо к столбам: берём их мировые позиции (+ сдвиг к верхушке)
            // и переводим в локальное пространство ленты
            const lw = new Vec3(); this.leftPole.getWorldPosition(lw); lw.y += this.topOffset;
            const rw = new Vec3(); this.rightPole.getWorldPosition(rw); rw.y += this.topOffset;
            const lL = new Vec3(); this.node.inverseTransformPoint(lL, lw);
            const rL = new Vec3(); this.node.inverseTransformPoint(rL, rw);
            ax = lL.x; ay = lL.y; bx = rL.x; by = rL.y;
        } else {
            // запасной режим: симметрично по длине length
            ax = -this.length / 2; ay = 0;
            bx = this.length / 2; by = 0;
        }

        for (let i = 0; i < this.segments; i++) {
            const t = i / (this.segments - 1);
            const x = ax + (bx - ax) * t;
            // линейная интерполяция между концами + провисание вниз (парабола)
            const y = ay + (by - ay) * t - this.sag * 4 * t * (1 - t);
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
        // В РЕДАКТОРЕ: показываем статичную провисшую ленту (без физики),
        // чтобы её было видно и можно было точно поставить между столбами.
        if (EDITOR) {
            this.buildRope();
            this.draw();
            return;
        }

        const gm = GameManager.instance;

        // Триггер разрыва: ровно когда девочка добежала до финиша
        // (FinishMover по приезду вызывает finishGame() → состояние FINISHED)
        if (!this.fired && gm && gm.getState() === GameState.FINISHED) {
            this.breakAt(0); // лента рвётся в центре
            this.fired = true;
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
        this.gfx.strokeColor = this.ribbonColor; // сплошная жёлтая лента
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
    }
}
