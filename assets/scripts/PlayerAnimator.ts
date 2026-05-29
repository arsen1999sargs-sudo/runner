import { _decorator, Component, Sprite, SpriteFrame, Texture2D, Rect, CCInteger, CCFloat, CCBoolean, Size, Node, UITransform, UIOpacity } from 'cc';
import { GameManager, GameState } from './GameManager';
import { Player } from './Player';
const { ccclass, property } = _decorator;

/**
 * Анимация персонажа из спрайт-листа с КРОССФЕЙДОМ.
 *   - IDLE  → idleFrameIndex
 *   - JUMP  → jumpFrameIndex (держим)
 *   - RUN   → цикл runFrameIndexes с плавным перетеканием между кадрами
 *
 * Кроссфейд: верхний слой (overlay) плавно проявляет СЛЕДУЮЩИЙ кадр поверх
 * текущего — переходы плавные, без "прыжков", даже если позы из разных рядов.
 */
@ccclass('PlayerAnimator')
export class PlayerAnimator extends Component {

    @property(SpriteFrame)
    sourceFrame: SpriteFrame = null!;

    @property(CCInteger)
    cols: number = 5;

    @property(CCInteger)
    rows: number = 1;

    @property(CCFloat)
    fps: number = 10;

    @property({ type: [CCInteger], tooltip: 'Кадры цикла бега (1,2,3,4); 0 — idle' })
    runFrameIndexes: number[] = [1, 2, 3, 4];

    @property(CCInteger)
    idleFrameIndex: number = 0;

    @property(CCInteger)
    jumpFrameIndex: number = 2;

    @property({ type: CCFloat, tooltip: 'Обрезка краёв кадра' })
    inset: number = 0;

    @property({ type: CCBoolean, tooltip: 'Плавное перетекание между кадрами (убирает дёрганье)' })
    crossfade: boolean = true;

    private sprite: Sprite | null = null;
    private overlaySprite: Sprite | null = null;
    private overlayOpacity: UIOpacity | null = null;
    private player: Player | null = null;
    private frames: SpriteFrame[] = [];
    private cur: number = 0;
    private blend: number = 0;

    start() {
        this.sprite = this.getComponent(Sprite);
        this.player = this.getComponent(Player);
        if (!this.sourceFrame && this.sprite && this.sprite.spriteFrame) {
            this.sourceFrame = this.sprite.spriteFrame;
        }
        this.buildFrames();
        this.createOverlay();
        this.applyIdle();
    }

    private buildFrames() {
        if (!this.sprite) { console.warn('[PlayerAnimator] нет cc.Sprite'); return; }
        if (!this.sourceFrame) { console.warn('[PlayerAnimator] нет sourceFrame'); return; }

        const tex = this.sourceFrame.texture as Texture2D;
        const baseRect = this.sourceFrame.rect;
        const frameW = baseRect.width / this.cols;
        const frameH = baseRect.height / this.rows;
        const ins = this.inset;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const sf = new SpriteFrame();
                sf.texture = tex;
                sf.rect = new Rect(
                    baseRect.x + col * frameW + ins,
                    baseRect.y + row * frameH + ins,
                    frameW - ins * 2,
                    frameH - ins * 2
                );
                sf.originalSize = new Size(frameW - ins * 2, frameH - ins * 2);
                this.frames.push(sf);
            }
        }
        console.log(`[PlayerAnimator] кадров: ${this.frames.length}`);
    }

    private createOverlay() {
        const node = new Node('Xfade');
        node.layer = this.node.layer;

        const pui = this.getComponent(UITransform);
        const ui = node.addComponent(UITransform);
        if (pui) {
            ui.setContentSize(pui.contentSize);
            ui.setAnchorPoint(pui.anchorPoint);
        }

        this.overlaySprite = node.addComponent(Sprite);
        this.overlaySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.overlaySprite.type = Sprite.Type.SIMPLE;

        this.overlayOpacity = node.addComponent(UIOpacity);
        this.overlayOpacity.opacity = 0;

        this.node.addChild(node);
        node.setPosition(0, 0, 0);
    }

    private setMain(idx: number) {
        if (this.sprite && this.frames[idx]) this.sprite.spriteFrame = this.frames[idx];
    }

    private applyIdle() {
        this.setMain(this.idleFrameIndex);
        if (this.overlayOpacity) this.overlayOpacity.opacity = 0;
    }

    update(dt: number) {
        const gm = GameManager.instance;
        const running = gm && gm.getState() === GameState.RUNNING;

        if (!running) {
            this.applyIdle();
            this.blend = 0; this.cur = 0;
            return;
        }

        if (this.player && this.player.isJumping()) {
            this.setMain(this.jumpFrameIndex);
            if (this.overlayOpacity) this.overlayOpacity.opacity = 0;
            this.blend = 0;
            return;
        }

        const seq = this.runFrameIndexes;
        if (seq.length === 0) return;

        const curIdx = seq[this.cur % seq.length];
        const nextIdx = seq[(this.cur + 1) % seq.length];
        this.setMain(curIdx);

        this.blend += dt * this.fps;

        if (this.crossfade && this.overlaySprite && this.overlayOpacity) {
            if (this.frames[nextIdx]) this.overlaySprite.spriteFrame = this.frames[nextIdx];
            this.overlayOpacity.opacity = Math.floor(Math.min(1, this.blend) * 255);
        } else if (this.overlayOpacity) {
            this.overlayOpacity.opacity = 0;
        }

        if (this.blend >= 1) {
            this.blend -= 1;
            this.cur = (this.cur + 1) % seq.length;
        }
    }
}
