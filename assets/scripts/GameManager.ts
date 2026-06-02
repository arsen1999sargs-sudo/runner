import { _decorator, Component, Node, Label, Sprite, director, Color, CCFloat, tween, Tween, Vec3, UITransform } from 'cc';
import { AudioManager } from './AudioManager';
import { Responsive } from './Responsive';
const { ccclass, property } = _decorator;

export enum GameState {
    IDLE = 'IDLE',
    RUNNING = 'RUNNING',
    TUTORIAL = 'TUTORIAL',   // пауза-подсказка (первый враг): всё замирает, ждём тап
    DEAD = 'DEAD',
    FINISHED = 'FINISHED',
}

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;
    public static get instance(): GameManager { return GameManager._instance!; }

    @property(Node) heartsContainer: Node = null!;
    @property(Label) earningsLabel: Label = null!;
    @property(Node) tapToStartNode: Node = null!;
    @property(Node) gameOverNode: Node = null!;
    @property(Node) finishNode: Node = null!;
    @property({ type: Node, tooltip: 'Подсказка "Jump to avoid enemies" (показывается в паузе перед первым врагом)' })
    tutorialNode: Node = null!;

    public tutorialDone: boolean = false;

    @property({ type: CCFloat, tooltip: 'Через сколько секунд после старта появляется финиш' })
    finishTime: number = 23;

    @property({ type: CCFloat, tooltip: 'За сколько секунд до финиша прекращать спавн и чистить экран' })
    clearBeforeFinish: number = 3;

    public state: GameState = GameState.IDLE;
    public lives: number = 3;
    public earnings: number = 0;
    public distanceTraveled: number = 0;
    public readonly FINISH_DISTANCE: number = 2000;
    private runElapsed: number = 0;
    // ставится FinishMover'ом за clearBeforeFinish сек до приезда финиша — экран чистится
    public nearFinish: boolean = false;

    public onStateChange: ((state: GameState) => void)[] = [];

    onLoad() {
        GameManager._instance = this;
        // адаптив UI под ширину/ориентацию (создаём в рантайме, сцену не трогаем)
        if (!this.getComponent(Responsive)) this.addComponent(Responsive);
    }

    start() {
        this.setState(GameState.IDLE);
        this.updateHeartsUI();
        this.setupEarningsFit();   // один раз: SHRINK + ширина под рамку + менее жирный шрифт
        this.updateEarningsUI();
        this.syncScrollSpeeds();
    }

    /**
     * Награды/препятствия должны выглядеть «вкопанными» в окружение, а не плыть к игроку.
     * Для этого скорость прокрутки фона/дороги приравниваем к скорости движения монет
     * (Spawner.speed) — тогда мир и объекты двигаются вместе. Делается в рантайме, сцену
     * править не нужно.
     */
    private syncScrollSpeeds() {
        const scene = director.getScene();
        if (!scene) return;
        // скорость монет (берём из Spawner, иначе 450 по умолчанию)
        let coinSpeed = 450;
        const findComp = (name: string): any[] => {
            const out: any[] = [];
            const stack: Node[] = [];
            for (const c of scene.children) stack.push(c);
            while (stack.length) {
                const n = stack.pop() as Node;
                const comp = n.getComponent(name) as any;
                if (comp) out.push(comp);
                for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]);
            }
            return out;
        };
        const spawners = findComp('Spawner');
        if (spawners.length && typeof spawners[0].speed === 'number') coinSpeed = spawners[0].speed;
        // фон и дорога — на ту же скорость
        findComp('HorizontalScroller').forEach((c) => { c.speed = coinSpeed; });
        findComp('RoadScroller').forEach((c) => { c.speed = coinSpeed; });
    }

    // Множитель «пульса» счётчика. Под него зарезервирована ширина текста в setupEarningsFit,
    // чтобы число НЕ вылезало за рамку даже на пике пульса (в момент изменения баланса).
    private readonly EARN_PULSE = 1.15;

    /** Лёгкий «пульс» счётчика $ при прилёте монеты. */
    public pulseEarnings() {
        const n = this.earningsLabel ? this.earningsLabel.node : null;
        if (!n) return;
        const k = this.EARN_PULSE;
        // Останавливаем предыдущий пульс и стартуем строго от базы (1,1,1). Иначе при серии
        // быстрых начислений (сбор последней дуги монет на финише) пульсы накладываются: база
        // захватывается уже увеличенной, пики каскадно складываются (>×k) и число раздувается
        // за рамку. Сброс к базе держит пик ровно ×k — под него зарезервирована ширина текста.
        Tween.stopAllByTarget(n);
        n.setScale(1, 1, 1);
        tween(n).to(0.08, { scale: new Vec3(k, k, 1) })
                .to(0.12, { scale: new Vec3(1, 1, 1) })
                .start();
    }

    public setState(newState: GameState) {
        this.state = newState;
        this.onStateChange.forEach(cb => cb(newState));

        if (this.tapToStartNode) this.tapToStartNode.active = (newState === GameState.IDLE);
        // экран награды (затемнение + карточка) показываем и на проигрыше, и на победе
        if (this.gameOverNode) this.gameOverNode.active = (newState === GameState.DEAD || newState === GameState.FINISHED);
        // текст «You Won!» больше не показываем — концовку показывает карточка награды
        if (this.finishNode) this.finishNode.active = false;
        if (this.tutorialNode) this.tutorialNode.active = (newState === GameState.TUTORIAL);

        // звук исхода
        const am = AudioManager.instance;
        if (am) {
            if (newState === GameState.DEAD) am.playLose();
            else if (newState === GameState.FINISHED) am.playWin();
        }
    }

    public getState(): GameState { return this.state; }

    /** Поставить обучающую паузу перед первым врагом (один раз). */
    public pauseForTutorial() {
        if (this.state !== GameState.RUNNING || this.tutorialDone) return;
        this.setState(GameState.TUTORIAL);
    }

    /** Снять паузу-подсказку, продолжить игру (вызывается по тапу). */
    public resumeFromTutorial() {
        if (this.state !== GameState.TUTORIAL) return;
        this.tutorialDone = true;
        this.setState(GameState.RUNNING);
    }

    public startGame() {
        if (this.state !== GameState.IDLE) return;
        this.lives = 3;
        this.earnings = 0;
        this.distanceTraveled = 0;
        this.runElapsed = 0;
        this.nearFinish = false;
        this.updateHeartsUI();
        this.updateEarningsUI();
        if (AudioManager.instance) AudioManager.instance.playBg(); // фоновая музыка на весь забег
        this.setState(GameState.RUNNING);
    }

    update(dt: number) {
        if (this.state !== GameState.RUNNING) return;
        // отсчёт до финиша стартует только ПОСЛЕ подсказки «jump to avoid enemies» и клика по ней
        if (!this.tutorialDone) return;
        // считаем время игры; сам финиш заканчивает игру, когда девочка добегает до ленты (FinishGate)
        this.runElapsed += dt;
        const t = Math.min(1, this.runElapsed / this.finishTime);
        this.distanceTraveled = t * this.FINISH_DISTANCE;
    }

    /** Время с начала забега (сек). */
    public getRunElapsed(): number { return this.runElapsed; }

    /** Последние секунды перед финишем — пора прекратить спавн и очистить экран.
     *  Флаг ставит FinishMover ровно за clearBeforeFinish сек до приезда финиша. */
    public isNearFinish(): boolean {
        return this.state === GameState.RUNNING && this.nearFinish;
    }

    /** Закончить игру победой (вызывает FinishGate, когда девочка добежала до ленты). */
    public finishGame() {
        if (this.state === GameState.RUNNING) this.setState(GameState.FINISHED);
    }

    public loseLife() {
        if (this.state !== GameState.RUNNING) return;
        this.lives = Math.max(0, this.lives - 1);
        this.updateHeartsUI();
        if (this.lives <= 0) this.setState(GameState.DEAD);
    }

    public addEarnings(amount: number) {
        this.earnings += amount;
        this.updateEarningsUI();
    }

    public addDistance(delta: number) {
        if (this.state !== GameState.RUNNING) return;
        this.distanceTraveled += delta;
        if (this.distanceTraveled >= this.FINISH_DISTANCE) this.setState(GameState.FINISHED);
    }

    public restartGame() {
        const s = director.getScene();
        if (s) director.loadScene(s.name); // перезагрузка текущей сцены
    }

    private updateHeartsUI() {
        if (!this.heartsContainer) return;
        const hearts = this.heartsContainer.children;
        hearts.forEach((heart, i) => {
            heart.active = true; // сердечко всегда видно
            const sprite = heart.getComponent(Sprite);
            if (!sprite) return;
            if (i < this.lives) {
                // живое — нормальный цвет
                sprite.color = new Color(255, 255, 255, 255);
            } else {
                // потерянное — приглушённое/в тени (тёмный оттенок, но сердце видно)
                sprite.color = new Color(110, 100, 95, 235);
            }
        });
    }

    private updateEarningsUI() {
        if (this.earningsLabel) {
            // Целые числа без .00, дроби с точностью 2
            const v = this.earnings;
            const isWhole = Math.floor(v) === v;
            // ширина лейбла зафиксирована + overflow=SHRINK (см. setupEarningsFit),
            // поэтому движок сам вписывает число в рамку — здесь только текст.
            this.earningsLabel.string = `$${isWhole ? v.toFixed(0) : v.toFixed(2)}`;
        }
    }

    private earningsFitDone = false;

    /**
     * Настройка счётчика $ ОДИН раз. Фиксируем ширину лейбла = свободное место внутри
     * рамки PayPal и включаем overflow=SHRINK — движок сам вписывает ЛЮБОЕ число в рамку
     * при любом системном шрифте (не зависит от ширины шрифта/ориентации; раньше длинное
     * число $1000+ вылезало за рамку). Заодно делаем шрифт менее жирным.
     */
    private setupEarningsFit() {
        const lbl = this.earningsLabel;
        if (!lbl || this.earningsFitDone) return;
        this.earningsFitDone = true;
        lbl.isBold = false;                       // менее жирный
        lbl.overflow = Label.Overflow.SHRINK;     // движок вписывает текст в ширину узла
        // свободная ширина под число = от позиции лейбла до правого края рамки (с паддингом)
        const panel = lbl.node.parent;
        const icon = panel ? panel.getChildByName('PayPalIcon') : null;
        const fui = icon ? icon.getComponent(UITransform) : null;
        const halfFrame = fui ? fui.contentSize.width / 2 : 70;
        const pad = 8;
        // ширина у самого края рамки (пик пульса) — и делим на множитель пульса, чтобы в
        // покое текст был уже, а на пике ×EARN_PULSE как раз доходил до края, не вылезая.
        const peakW = (halfFrame - pad - lbl.node.position.x) * 2;
        const availW = Math.max(20, peakW / this.EARN_PULSE);
        const ui = lbl.node.getComponent(UITransform);
        if (ui) ui.setContentSize(availW, ui.contentSize.height || lbl.fontSize);
    }

    public registerStateChange(cb: (state: GameState) => void) {
        this.onStateChange.push(cb);
    }

    public unregisterStateChange(cb: (state: GameState) => void) {
        this.onStateChange = this.onStateChange.filter(fn => fn !== cb);
    }
}
