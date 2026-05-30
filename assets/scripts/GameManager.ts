import { _decorator, Component, Node, Label, Sprite, director, Color, CCFloat } from 'cc';
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
    }

    start() {
        this.setState(GameState.IDLE);
        this.updateHeartsUI();
        this.updateEarningsUI();
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
            this.earningsLabel.string = `$${isWhole ? v.toFixed(0) : v.toFixed(2)}`;
        }
    }

    public registerStateChange(cb: (state: GameState) => void) {
        this.onStateChange.push(cb);
    }

    public unregisterStateChange(cb: (state: GameState) => void) {
        this.onStateChange = this.onStateChange.filter(fn => fn !== cb);
    }
}
