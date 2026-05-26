import { _decorator, Component, Node, Label, Sprite, director } from 'cc';
const { ccclass, property } = _decorator;

export enum GameState {
    IDLE = 'IDLE',
    RUNNING = 'RUNNING',
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

    public state: GameState = GameState.IDLE;
    public lives: number = 3;
    public earnings: number = 0;
    public distanceTraveled: number = 0;
    public readonly FINISH_DISTANCE: number = 2000;

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
        if (this.gameOverNode) this.gameOverNode.active = (newState === GameState.DEAD);
        if (this.finishNode) this.finishNode.active = (newState === GameState.FINISHED);
    }

    public getState(): GameState { return this.state; }

    public startGame() {
        if (this.state !== GameState.IDLE) return;
        this.lives = 3;
        this.earnings = 0;
        this.distanceTraveled = 0;
        this.updateHeartsUI();
        this.updateEarningsUI();
        this.setState(GameState.RUNNING);
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
        this.setState(GameState.IDLE);
        director.loadScene('Game');
    }

    private updateHeartsUI() {
        if (!this.heartsContainer) return;
        const hearts = this.heartsContainer.children;
        hearts.forEach((heart, i) => {
            heart.active = i < this.lives;
        });
    }

    private updateEarningsUI() {
        if (this.earningsLabel) {
            this.earningsLabel.string = `$${this.earnings.toFixed(2)}`;
        }
    }

    public registerStateChange(cb: (state: GameState) => void) {
        this.onStateChange.push(cb);
    }

    public unregisterStateChange(cb: (state: GameState) => void) {
        this.onStateChange = this.onStateChange.filter(fn => fn !== cb);
    }
}
