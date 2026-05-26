import { _decorator, Component, Sprite, SpriteFrame, Texture2D, Rect, Vec2, resources, assetManager, ImageAsset } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('PlayerAnimator')
export class PlayerAnimator extends Component {

    @property(SpriteFrame)
    sourceFrame: SpriteFrame = null!;

    @property
    cols: number = 5;

    @property
    rows: number = 6;

    @property
    fps: number = 12;

    @property([Number])
    runFrameIndexes: number[] = [0, 1, 2, 3, 4];

    @property
    idleFrameIndex: number = 5;

    private sprite: Sprite | null = null;
    private frames: SpriteFrame[] = [];
    private elapsed: number = 0;
    private current: number = 0;
    private playing: boolean = false;
    private activeSeq: number[] = [];

    onLoad() {
        this.sprite = this.getComponent(Sprite);
        this.buildFrames();
        this.showIdle();
    }

    private buildFrames() {
        if (!this.sourceFrame || !this.sprite) return;

        const tex = this.sourceFrame.texture as Texture2D;
        const sheetW = this.sourceFrame.rect.width;
        const sheetH = this.sourceFrame.rect.height;
        const frameW = sheetW / this.cols;
        const frameH = sheetH / this.rows;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const sf = new SpriteFrame();
                sf.texture = tex;
                sf.rect = new Rect(
                    col * frameW,
                    row * frameH,
                    frameW,
                    frameH
                );
                sf.pixelsToUnit = this.sourceFrame.pixelsToUnit;
                this.frames.push(sf);
            }
        }
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
