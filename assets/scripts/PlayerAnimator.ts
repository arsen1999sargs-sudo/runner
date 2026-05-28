import { _decorator, Component, Sprite, SpriteFrame, Texture2D, Rect, CCInteger, CCFloat, Size } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerAnimator')
export class PlayerAnimator extends Component {

    @property(SpriteFrame)
    sourceFrame: SpriteFrame = null!;

    @property(CCInteger)
    cols: number = 5;

    @property(CCInteger)
    rows: number = 6;

    @property(CCFloat)
    fps: number = 12;

    @property({ type: [CCInteger] })
    runFrameIndexes: number[] = [0, 1, 2, 3, 4];

    @property(CCInteger)
    idleFrameIndex: number = 5;

    private sprite: Sprite | null = null;
    private frames: SpriteFrame[] = [];
    private elapsed: number = 0;
    private current: number = 0;
    private playing: boolean = false;
    private activeSeq: number[] = [];

    start() {
        this.sprite = this.getComponent(Sprite);
        // Если Source Frame не задан в инспекторе — берём картинку из самого Sprite
        if (!this.sourceFrame && this.sprite && this.sprite.spriteFrame) {
            this.sourceFrame = this.sprite.spriteFrame;
        }
        this.buildFrames();
        this.showIdle();
    }

    private buildFrames() {
        if (!this.sprite) {
            console.warn('[PlayerAnimator] cc.Sprite НЕ найден на узле Player');
            return;
        }
        if (!this.sourceFrame) {
            console.warn('[PlayerAnimator] sourceFrame пустой И в Sprite нет spriteFrame');
            return;
        }

        const tex = this.sourceFrame.texture as Texture2D;
        // используем РЕАЛЬНЫЙ размер исходного rect (с учётом trim)
        const baseRect = this.sourceFrame.rect;
        const sheetW = baseRect.width;
        const sheetH = baseRect.height;
        const originX = baseRect.x;
        const originY = baseRect.y;
        const frameW = sheetW / this.cols;
        const frameH = sheetH / this.rows;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const sf = new SpriteFrame();
                sf.texture = tex;
                sf.rect = new Rect(
                    originX + col * frameW,
                    originY + row * frameH,
                    frameW,
                    frameH
                );
                sf.originalSize = new Size(frameW, frameH);
                this.frames.push(sf);
            }
        }
        console.log(`[PlayerAnimator] разрезано кадров: ${this.frames.length}`);
    }

    showIdle() {
        this.playing = false;
        this.activeSeq = [];
        if (this.sprite && this.frames[this.idleFrameIndex]) {
            this.sprite.spriteFrame = this.frames[this.idleFrameIndex];
        }
    }

    playRun() {
        if (this.playing) return;
        this.activeSeq = this.runFrameIndexes.slice();
        this.current = 0;
        this.elapsed = 0;
        this.playing = true;
    }

    stop() {
        this.showIdle();
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm) {
            if (gm.getState() === GameState.RUNNING && !this.playing) {
                this.playRun();
            } else if (gm.getState() !== GameState.RUNNING && this.playing) {
                this.stop();
            }
        }

        if (!this.playing || this.activeSeq.length === 0 || !this.sprite) return;

        this.elapsed += dt;
        const frameDuration = 1 / this.fps;
        while (this.elapsed >= frameDuration) {
            this.elapsed -= frameDuration;
            this.current = (this.current + 1) % this.activeSeq.length;
            const idx = this.activeSeq[this.current];
            if (this.frames[idx]) {
                this.sprite.spriteFrame = this.frames[idx];
            }
        }
    }
}
