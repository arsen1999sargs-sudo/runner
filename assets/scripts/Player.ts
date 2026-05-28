import { _decorator, Component, input, Input, EventTouch, CCFloat } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

/**
 * Игрок-бегун с механикой ПРЫЖКА:
 *  - Тап (IDLE)      → старт игры
 *  - Тап (RUNNING)   → прыжок (если на земле)
 *  - В воздухе персонаж перепрыгивает препятствия
 *  - На земле — покачивание бега; в покое — дыхание
 *
 * getJumpHeight() используется в Pickup.ts чтобы понять, перепрыгнут ли барьер.
 */
@ccclass('Player')
export class Player extends Component {

    @property({ type: CCFloat, tooltip: 'Начальная скорость прыжка (вверх)' })
    jumpVelocity: number = 1100;

    @property({ type: CCFloat, tooltip: 'Гравитация (тянет вниз)' })
    gravity: number = 3200;

    @property({ type: CCFloat, tooltip: 'Высота подскока при беге (px)' })
    bobHeight: number = 12;

    @property({ type: CCFloat, tooltip: 'Скорость покачивания бега' })
    runSpeed: number = 7;

    @property({ type: CCFloat, tooltip: 'Дыхание в покое (px)' })
    idleBreath: number = 3;

    @property({ type: CCFloat })
    idleSpeed: number = 1.5;

    private baseX: number = 0;
    private baseY: number = -150;
    private jumpY: number = 0;       // текущая высота над землёй
    private velocityY: number = 0;
    private grounded: boolean = true;
    private bobTime: number = 0;
    private idleTime: number = 0;

    onLoad() {
        this.baseX = this.node.position.x;
        this.baseY = this.node.position.y;
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(_e: EventTouch) {
        const gm = GameManager.instance;
        if (!gm) return;

        if (gm.getState() === GameState.IDLE) {
            gm.startGame();
            return;
        }
        if (gm.getState() !== GameState.RUNNING) return;

        // прыжок, только если на земле
        if (this.grounded) {
            this.velocityY = this.jumpVelocity;
            this.grounded = false;
        }
    }

    /** Текущая высота прыжка (0 = на земле) */
    public getJumpHeight(): number {
        return this.jumpY;
    }

    public isJumping(): boolean {
        return !this.grounded;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        const running = gm && gm.getState() === GameState.RUNNING;

        let y = this.baseY;

        if (running && !this.grounded) {
            // физика прыжка
            this.velocityY -= this.gravity * dt;
            this.jumpY += this.velocityY * dt;
            if (this.jumpY <= 0) {
                this.jumpY = 0;
                this.velocityY = 0;
                this.grounded = true;
            }
            y = this.baseY + this.jumpY;
        } else if (running) {
            // покачивание бега на земле
            this.bobTime += dt * this.runSpeed * Math.PI * 2;
            y = this.baseY + Math.abs(Math.sin(this.bobTime)) * this.bobHeight;
        } else {
            // в покое — стоит ровно (без движения до старта)
            y = this.baseY;
        }

        this.node.setPosition(this.baseX, y, 0);
    }
}
