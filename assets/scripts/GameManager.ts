import { _decorator, Component, Node, Label, director, sys } from 'cc';
const { ccclass, property } = _decorator;

export enum GameState {
    READY,
    RUNNING,
    PAUSED,
    GAMEOVER,
    WIN
}

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager = null!;

    @property(Node) tapToStart: Node = null!;
    @property(Label) moneyLabel: Label = null!;
    @property([Node]) hearts: Node[] = [];
    @property(Node) player: Node = null!;

    private state: GameState = GameState.READY;
    private money: number = 0;
    private lives: number = 3;

    onLoad() {
        GameManager.instance = this;
    }

    start() {
        this.setState(GameState.READY);
    }

    setState(s: GameState) {
        this.state = s;
        if (this.tapToStart) {
            this.tapToStart.active = (s === GameState.READY);
        }
    }

    getState(): GameState {
        return this.state;
    }

    addMoney(amount: number) {
        this.money += amount;
        if (this.moneyLabel) {
            this.moneyLabel.string = `$${this.money}`;
        }
    }

    loseLife() {
        if (this.lives <= 0) return;
        this.lives--;
        if (this.hearts[this.lives]) {
            this.hearts[this.lives].active = false;
        }
        if (this.lives <= 0) {
            this.setState(GameState.GAMEOVER);
        }
    }

    win() {
        this.setState(GameState.WIN);
    }
}
