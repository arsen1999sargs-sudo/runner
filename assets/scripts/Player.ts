import { _decorator, Component, input, Input, EventTouch, CCFloat, Vec3, Node, UITransform, director } from 'cc';
import { GameManager, GameState } from './GameManager';
import { AudioManager } from './AudioManager';
const { ccclass, property } = _decorator;

/**
 * Игрок-бегун: ОДИН статичный кадр + ПРОЦЕДУРНОЕ движение (без дёрганья).
 *  - Тап (IDLE)    → старт игры
 *  - Тап (RUNNING) → прыжок (физика)
 *  - Бег на земле  → покачивание (bounce) + squash-stretch + лёгкий наклон
 *  - Покой         → спокойное дыхание
 *
 * Анимация целиком процедурная — кадр не меняется, поэтому всегда плавно.
 */
@ccclass('Player')
export class Player extends Component {

    @property({ type: CCFloat, tooltip: 'Сила прыжка' })
    jumpVelocity: number = 1100;

    @property({ type: CCFloat, tooltip: 'Гравитация' })
    gravity: number = 3200;

    @property({ type: CCFloat, tooltip: 'Высота подскока при беге (px)' })
    runBobHeight: number = 18;

    @property({ type: CCFloat, tooltip: 'Скорость бега (циклов/сек)' })
    runBobSpeed: number = 4.5;

    @property({ type: CCFloat, tooltip: 'Сжатие/растяжение при беге (0..0.3)' })
    runSquash: number = 0.12;

    @property({ type: CCFloat, tooltip: 'Наклон корпуса при беге (градусы)' })
    runLean: number = 6;

    @property({ type: CCFloat, tooltip: 'Дыхание в покое (px)' })
    idleBreath: number = 3;

    @property({ type: CCFloat })
    idleSpeed: number = 1.5;

    private baseX: number = 0;
    private baseY: number = -150;
    private baseScale: Vec3 = new Vec3(1, 1, 1);
    private jumpY: number = 0;
    private velocityY: number = 0;
    private grounded: boolean = true;
    private bobTime: number = 0;
    private idleTime: number = 0;

    onLoad() {
        this.baseX = this.node.position.x;
        this.baseY = this.node.position.y;
        this.baseScale = this.node.scale.clone();
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    /** Кешированная ссылка на узел кнопки DOWNLOAD (ищем по имени один раз). */
    private linkNode: Node | null = null;
    private findLinkNode(): Node | null {
        if (this.linkNode && this.linkNode.isValid) return this.linkNode;
        const scene = director.getScene();
        if (!scene) return null;
        const stack: Node[] = [];
        for (const c of scene.children) stack.push(c);
        while (stack.length) {
            const n = stack.pop() as Node;
            if (n.name === 'DownloadButton') { this.linkNode = n; return n; }
            for (const c of n.children) stack.push(c);
        }
        return null;
    }

    /** true, если тап попал в активную кнопку DOWNLOAD (тогда это переход по ссылке). */
    private tapHitsLink(e: EventTouch): boolean {
        const node = this.findLinkNode();
        if (!node || !node.activeInHierarchy) return false;
        const ui = node.getComponent(UITransform);
        if (!ui) return false;
        return ui.getBoundingBoxToWorld().contains(e.getUILocation());
    }

    onTouchStart(_e: EventTouch) {
        const gm = GameManager.instance;
        if (!gm) return;
        // Тап по кнопке DOWNLOAD — это открытие ссылки, а НЕ игровой тап:
        // не стартуем игру и не прыгаем.
        if (this.tapHitsLink(_e)) return;
        if (gm.getState() === GameState.IDLE) { gm.startGame(); return; }
        // пауза-подсказка перед первым врагом: тап продолжает игру И сразу прыгает над врагом
        if (gm.getState() === GameState.TUTORIAL) {
            gm.resumeFromTutorial();
            this.velocityY = this.jumpVelocity;
            this.grounded = false;
            if (AudioManager.instance) AudioManager.instance.playJump();
            return;
        }
        if (gm.getState() !== GameState.RUNNING) return;
        // до первой встречи с мужиком (обучения) прыжок выключен
        if (!gm.tutorialDone) return;
        if (this.grounded) {
            this.velocityY = this.jumpVelocity;
            this.grounded = false;
            if (AudioManager.instance) AudioManager.instance.playJump();
        }
    }

    public getJumpHeight(): number { return this.jumpY; }
    public isJumping(): boolean { return !this.grounded; }
    /** Вертикальная скорость: >0 — взлёт, ~0 — пик, <0 — падение. */
    public getVerticalVelocity(): number { return this.velocityY; }

    update(dt: number) {
        const gm = GameManager.instance;
        const running = gm && gm.getState() === GameState.RUNNING;

        let y = this.baseY;

        if (running && !this.grounded) {
            // ПРЫЖОК — только физика (голова двигается вверх — это нормально для прыжка)
            this.velocityY -= this.gravity * dt;
            this.jumpY += this.velocityY * dt;
            if (this.jumpY <= 0) { this.jumpY = 0; this.velocityY = 0; this.grounded = true; }
            y = this.baseY + this.jumpY;
        } else if (running) {
            // БЕГ на земле — позиция ФИКСИРОВАНА (голова не двигается).
            // Движение ног/рук делает покадровая анимация (PlayerAnimator с фикс. головой).
            y = this.baseY;
        } else {
            // ПОКОЙ — стоит ровно
            y = this.baseY;
        }

        this.node.setPosition(this.baseX, y, 0);
    }
}
