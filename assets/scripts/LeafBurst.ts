import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3, Color, CCFloat, CCInteger, Graphics } from 'cc';
import { EDITOR } from 'cc/env';
import { GameManager, GameState } from './GameManager';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Эффект конфетти / листьев: из точки узла вылетают спрайты (list1..list6)
 * фонтаном вверх и в стороны, крутятся, падают по гравитации и затухают.
 *
 * Использование:
 *  - Повесь на пустой узел в месте, откуда должен бить фонтан (например, на каждый столб).
 *  - В поле Frames перетащи спрайты list1..list6.
 *  - По умолчанию запускается сам при финише (FINISHED). Можно вызвать play() вручную.
 */
@ccclass('LeafBurst')
@executeInEditMode
export class LeafBurst extends Component {

    @property({ type: [SpriteFrame], tooltip: 'Спрайты листьев/конфетти (list1..list6) — берутся случайно' })
    frames: SpriteFrame[] = [];

    @property({ tooltip: 'Запускать автоматически, когда девочка добежала до финиша (FINISHED)' })
    emitOnFinish: boolean = true;

    @property({ tooltip: 'Запускать сразу при старте (для проверки в редакторе/превью)' })
    playOnLoad: boolean = false;

    @property({ type: CCInteger, tooltip: 'Сколько частиц в начальном «залпе»' })
    burstCount: number = 60;

    @property({ type: CCFloat, tooltip: 'Сколько частиц в секунду сыпать после залпа' })
    rate: number = 50;

    @property({ type: CCFloat, tooltip: 'Сколько секунд продолжать сыпать (0 = только залп)' })
    duration: number = 2.5;

    @property({ type: CCFloat, tooltip: 'Мин. скорость вылета (px/сек)' })
    speedMin: number = 450;

    @property({ type: CCFloat, tooltip: 'Макс. скорость вылета (px/сек)' })
    speedMax: number = 850;

    @property({ type: CCFloat, tooltip: 'Разброс угла от вертикали (градусы): 0 = строго вверх' })
    spread: number = 35;

    @property({ type: CCFloat, tooltip: 'Наклон струи от вертикали (°): + вправо, − влево (для веера наружу)' })
    tilt: number = 0;

    @property({ type: CCFloat, tooltip: 'Гравитация (как быстро падают вниз)' })
    gravity: number = 900;

    @property({ type: CCFloat, tooltip: 'Время жизни частицы (сек)' })
    life: number = 2.2;

    @property({ type: CCFloat, tooltip: 'Размер частицы по высоте (px), ширина — по пропорции картинки' })
    size: number = 34;

    @property({ type: CCFloat, tooltip: 'Макс. скорость вращения (градусы/сек)' })
    spin: number = 360;

    private particles: { node: Node, vx: number, vy: number, angle: number, vAng: number, age: number, life: number, sp: Sprite | null }[] = [];
    private emitting: boolean = false;
    private emitTimer: number = 0;
    private spawnAcc: number = 0;
    private firedFinish: boolean = false;
    private editorGfx: Graphics | null = null;

    onLoad() {
        if (EDITOR) return;
        // в игре убираем редакторский маркер, если он был нарисован
        const g = this.getComponent(Graphics);
        if (g) g.clear();
        if (this.playOnLoad) this.play();
    }

    /** Запустить эффект: большой залп + сыпать ещё duration секунд. */
    public play() {
        this.emitting = true;
        this.emitTimer = 0;
        this.spawnAcc = 0;
        for (let i = 0; i < this.burstCount; i++) this.spawnOne();
    }

    /** Видимый маркер в редакторе: красный кружок (точка вылета) + стрелка направления струи. */
    private drawEditorMarker() {
        if (!this.editorGfx) {
            this.editorGfx = this.getComponent(Graphics) || this.addComponent(Graphics);
        }
        const g = this.editorGfx;
        if (!g) return;
        g.clear();
        // стрелка направления (с учётом наклона tilt) — куда полетят листья
        const ang = this.tilt * Math.PI / 180;
        const len = 110;
        const ex = Math.sin(ang) * len;
        const ey = Math.cos(ang) * len;
        g.lineWidth = 5;
        g.strokeColor = new Color(255, 60, 60, 255);
        g.moveTo(0, 0);
        g.lineTo(ex, ey);
        g.stroke();
        // наконечник стрелки
        const left = ang + Math.PI - 0.4, right = ang + Math.PI + 0.4;
        g.moveTo(ex, ey); g.lineTo(ex + Math.sin(left) * 22, ey + Math.cos(left) * 22);
        g.moveTo(ex, ey); g.lineTo(ex + Math.sin(right) * 22, ey + Math.cos(right) * 22);
        g.stroke();
        // кружок-точка вылета
        g.strokeColor = new Color(255, 60, 60, 255);
        g.fillColor = new Color(255, 60, 60, 140);
        g.circle(0, 0, 14);
        g.fill();
        g.stroke();
    }

    update(dt: number) {
        // В РЕДАКТОРЕ: рисуем видимый маркер (кружок + стрелка наклона), частицы не пускаем
        if (EDITOR) {
            this.drawEditorMarker();
            return;
        }

        // авто-запуск при финише
        if (this.emitOnFinish && !this.firedFinish) {
            const gm = GameManager.instance;
            if (gm && gm.getState() === GameState.FINISHED) {
                this.firedFinish = true;
                this.play();
            }
        }

        // постоянная эмиссия после залпа
        if (this.emitting) {
            this.emitTimer += dt;
            this.spawnAcc += this.rate * dt;
            while (this.spawnAcc >= 1) {
                this.spawnAcc -= 1;
                this.spawnOne();
            }
            if (this.duration > 0 && this.emitTimer >= this.duration) this.emitting = false;
        }

        // физика частиц
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (!p.node.isValid) { this.particles.splice(i, 1); continue; }

            p.age += dt;
            if (p.age >= p.life) {
                p.node.destroy();
                this.particles.splice(i, 1);
                continue;
            }

            // движение + гравитация
            p.vy -= this.gravity * dt;
            const pos = p.node.position;
            p.node.setPosition(pos.x + p.vx * dt, pos.y + p.vy * dt, 0);

            // вращение
            p.angle += p.vAng * dt;
            p.node.angle = p.angle;

            // затухание в последние 0.5 сек жизни
            if (p.sp) {
                const fadeStart = p.life - 0.5;
                let a = 255;
                if (p.age > fadeStart) {
                    a = Math.floor(255 * Math.max(0, 1 - (p.age - fadeStart) / 0.5));
                }
                p.sp.color = new Color(255, 255, 255, a);
            }
        }
    }

    private spawnOne() {
        if (this.frames.length === 0) return;

        const n = new Node('Leaf');
        n.layer = this.node.layer;

        const ui = n.addComponent(UITransform);
        const sp = n.addComponent(Sprite);
        const f = this.frames[Math.floor(Math.random() * this.frames.length)];
        sp.spriteFrame = f;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        const aspect = (f.rect.height > 0) ? f.rect.width / f.rect.height : 1;
        ui.setContentSize(this.size * aspect, this.size);

        this.node.addChild(n);
        n.setPosition(0, 0, 0); // вылет из точки узла

        // скорость: вверх, с базовым наклоном (tilt) и случайным разбросом
        const ang = (this.tilt + (Math.random() * 2 - 1) * this.spread) * Math.PI / 180; // радианы от вертикали
        const speed = this.speedMin + Math.random() * (this.speedMax - this.speedMin);
        const vx = Math.sin(ang) * speed;
        const vy = Math.cos(ang) * speed; // вверх

        this.particles.push({
            node: n,
            vx, vy,
            angle: Math.random() * 360,
            vAng: (Math.random() * 2 - 1) * this.spin,
            age: 0,
            life: this.life * (0.7 + Math.random() * 0.6), // лёгкий разброс времени жизни
            sp,
        });
    }
}
