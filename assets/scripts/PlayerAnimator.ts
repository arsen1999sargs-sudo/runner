import { _decorator, Component, Sprite, SpriteFrame, Texture2D, Rect, CCInteger, CCFloat, Size, Vec2, Node, UITransform, UIOpacity } from 'cc';
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
    cols: number = 10;

    @property(CCInteger)
    rows: number = 1;

    @property(CCFloat)
    fps: number = 12;

    @property({ type: [CCInteger], tooltip: 'Кадры цикла бега (все 10, по фазе ног)' })
    runFrameIndexes: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    @property(CCInteger)
    idleFrameIndex: number = 0;

    @property({ type: CCInteger, tooltip: 'ПИК/зависание прыжка (полёт)' })
    jumpFrameIndex: number = 3;

    @property({ type: CCInteger, tooltip: 'ВЗЛЁТ прыжка (толчок, колено вверх)' })
    jumpRiseFrameIndex: number = 6;

    @property({ type: CCInteger, tooltip: 'ПАДЕНИЕ прыжка (ноги вниз, к приземлению)' })
    jumpFallFrameIndex: number = 4;

    @property({ type: CCFloat, tooltip: 'Порог скорости для смены фаз прыжка (px/сек)' })
    jumpVelThreshold: number = 250;

    @property({ type: [SpriteFrame], tooltip: 'Кадры прыжка ИЗ АТЛАСА по порядку (толчок → пик → приземление). Если пусто — берутся jump*FrameIndex из run-листа.' })
    jumpFrames: SpriteFrame[] = [];

    @property({ type: CCFloat, tooltip: 'Обрезка краёв кадра' })
    inset: number = 0;

    @property({ tooltip: 'Плавное перетекание между кадрами (убирает дёрганье)' })
    crossfade: boolean = true;

    private sprite: Sprite | null = null;
    private overlaySprite: Sprite | null = null;
    private overlayOpacity: UIOpacity | null = null;
    private player: Player | null = null;
    private uiTransform: UITransform | null = null;
    private frames: SpriteFrame[] = [];
    private cur: number = 0;
    private blend: number = 0;
    // единый масштаб «пиксель кадра → юнит сцены», берётся от run-кадра.
    // Нужен, чтобы кадры АТЛАСА (обрезаны впритык) и кадры бега (с полями)
    // рендерились в ОДНОМ размере, а не «прыгали» крупнее при прыжке.
    private runFrameW: number = 1;
    private runFrameH: number = 1;
    private scaleX: number = 1;
    private scaleY: number = 1;

    start() {
        this.sprite = this.getComponent(Sprite);
        this.player = this.getComponent(Player);
        this.uiTransform = this.getComponent(UITransform);
        if (!this.sourceFrame && this.sprite && this.sprite.spriteFrame) {
            this.sourceFrame = this.sprite.spriteFrame;
        }
        this.buildFrames();
        // базовый бокс (напр. 180×250) задаёт масштаб: scale = бокс / размер run-кадра.
        if (this.uiTransform) {
            this.scaleX = this.uiTransform.contentSize.width / this.runFrameW;
            this.scaleY = this.uiTransform.contentSize.height / this.runFrameH;
        }
        this.createOverlay();
        this.applyIdle();
    }

    private buildFrames() {
        if (!this.sprite) { console.warn('[PlayerAnimator] нет cc.Sprite'); return; }
        if (!this.sourceFrame) { console.warn('[PlayerAnimator] нет sourceFrame'); return; }

        const tex = this.sourceFrame.texture as Texture2D;

        // ВАЖНО: режем по ПОЛНОЙ текстуре (напр. 2400×300), а НЕ по sourceFrame.rect.
        // run_sheet импортирован с обрезкой (trim): его rect = 2291×253 со сдвигом 57px,
        // и деление на cols даёт ячейку ~229px вместо 240 → фигура «съезжает» вперёд-назад
        // от кадра к кадру. Берём реальные размеры текстуры и режем ровную сетку от (0,0).
        const texW = tex.width;
        const texH = tex.height;
        const frameW = texW / this.cols;
        const frameH = texH / this.rows;
        this.runFrameW = frameW;
        this.runFrameH = frameH;
        const ins = this.inset;

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const sf = new SpriteFrame();
                sf.texture = tex;
                sf.rect = new Rect(
                    col * frameW + ins,
                    row * frameH + ins,
                    frameW - ins * 2,
                    frameH - ins * 2
                );
                sf.originalSize = new Size(frameW - ins * 2, frameH - ins * 2);
                // offset=0 → каждый кадр центрируется одинаково, тело стоит на месте,
                // двигаются только ноги/руки (на месте, фон скроллится сам).
                sf.offset = new Vec2(0, 0);
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

    /**
     * Показать кадр + подогнать бокс под его originalSize с ЕДИНЫМ масштабом.
     * Так и кадры бега (240×300 с полями), и кадры атласа (обрезаны впритык)
     * рендерятся в одном визуальном размере — прыжок больше не «раздувается».
     */
    private applyFrame(sf: SpriteFrame) {
        if (!this.sprite || !sf) return;
        this.sprite.spriteFrame = sf;
        const os = sf.originalSize;
        if (this.uiTransform && os && os.width > 0 && os.height > 0) {
            this.uiTransform.setContentSize(os.width * this.scaleX, os.height * this.scaleY);
        }
    }

    private setMain(idx: number) {
        if (this.frames[idx]) this.applyFrame(this.frames[idx]);
    }

    private setMainFrame(sf: SpriteFrame) {
        this.applyFrame(sf);
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
            if (this.overlayOpacity) this.overlayOpacity.opacity = 0;
            this.blend = 0;
            const vy = this.player.getVerticalVelocity();

            if (this.jumpFrames && this.jumpFrames.length > 0) {
                // Кадры прыжка из АТЛАСА, привязанные к дуге:
                //   vy=+jumpVelocity → толчок (кадр 0); vy=0 → пик (середина); vy=-jumpVelocity → приземление (последний)
                const v0 = Math.max(1, this.player.jumpVelocity);
                let p = (1 - vy / v0) * 0.5;          // 0..1 вдоль дуги
                p = Math.max(0, Math.min(0.999, p));
                const fi = Math.floor(p * this.jumpFrames.length);
                this.setMainFrame(this.jumpFrames[fi]);
            } else {
                // запасной путь: фазовые кадры из run-листа
                let idx = this.jumpFrameIndex;
                if (vy > this.jumpVelThreshold) idx = this.jumpRiseFrameIndex;
                else if (vy < -this.jumpVelThreshold) idx = this.jumpFallFrameIndex;
                this.setMain(idx);
            }
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
