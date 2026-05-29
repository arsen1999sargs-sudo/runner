import { _decorator, Component, Sprite, SpriteFrame, SpriteAtlas, CCInteger, CCFloat, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Покадровая анимация персонажа из ПЛИСТ-АТЛАСА (TexturePacker).
 * Кадры берутся по именам framePrefix+"1".."N" — это даёт правильный
 * порядок, даже если в атласе спрайты перемешаны по упаковке.
 *
 * Размер нормализуется по высоте первого кадра (единый масштаб), чтобы
 * разнокалиберные кадры атласа не «прыгали» в размере.
 *
 * moveSpeed>0 — персонаж едет ВЛЕВО (навстречу девочке).
 */
@ccclass('AtlasRunner')
export class AtlasRunner extends Component {

    @property({ type: SpriteAtlas, tooltip: 'Плист-атлас персонажа (напр. man_atlas)' })
    atlas: SpriteAtlas = null!;

    @property({ tooltip: 'Префикс имени кадра в атласе' })
    framePrefix: string = 'sprite_';

    @property({ type: CCInteger, tooltip: 'Сколько кадров играть (0 = авто: sprite_1..N)' })
    frameCount: number = 0;

    @property({ type: CCFloat, tooltip: 'Кадров в секунду' })
    fps: number = 12;

    @property({ type: CCFloat, tooltip: 'Скорость движения ВЛЕВО, px/сек (0 = стоит на месте)' })
    moveSpeed: number = 0;

    @property({ tooltip: 'Отразить по горизонтали (если бежит не в ту сторону)' })
    flipX: boolean = false;

    private sprite: Sprite | null = null;
    private ui: UITransform | null = null;
    private frames: SpriteFrame[] = [];
    private cur: number = 0;
    private t: number = 0;
    private unit: number = 1; // единый масштаб «пиксель кадра → юнит»

    // onLoad (а не start) — чтобы кадр/отражение/размер выставились ДО первой
    // отрисовки и в самом начале не мелькал «неправильный» кадр.
    onLoad() {
        this.sprite = this.getComponent(Sprite);
        this.ui = this.getComponent(UITransform);
        this.buildFrames();

        if (this.flipX) {
            const s = this.node.scale;
            this.node.setScale(-Math.abs(s.x), s.y, s.z);
        }

        if (this.ui && this.frames.length > 0) {
            const ref = this.frames[0].originalSize;
            // целевую высоту берём из заданного в редакторе contentSize
            this.unit = ref.height > 0 ? this.ui.contentSize.height / ref.height : 1;
            this.show(0);
        }
    }

    private buildFrames() {
        if (!this.atlas) { console.warn('[AtlasRunner] не задан atlas'); return; }
        const max = this.frameCount > 0 ? this.frameCount : 999;
        for (let i = 1; i <= max; i++) {
            const sf = this.atlas.getSpriteFrame(this.framePrefix + i);
            if (!sf) {
                if (this.frameCount > 0) continue; // авто-режим прерывается, фикс-режим пропускает дыры
                break;
            }
            this.frames.push(sf);
        }
        console.log(`[AtlasRunner] кадров: ${this.frames.length}`);
    }

    private show(idx: number) {
        const sf = this.frames[idx];
        if (!this.sprite || !sf) return;
        this.sprite.spriteFrame = sf;
        if (this.ui) {
            // единый масштаб по высоте → размер стабилен, аспект сохраняется
            this.ui.setContentSize(sf.originalSize.width * this.unit, sf.originalSize.height * this.unit);
        }
    }

    update(dt: number) {
        if (this.frames.length === 0) return;

        this.t += dt * this.fps;
        if (this.t >= 1) {
            this.t -= Math.floor(this.t);
            this.cur = (this.cur + 1) % this.frames.length;
            this.show(this.cur);
        }

        if (this.moveSpeed !== 0) {
            const p = this.node.position;
            this.node.setPosition(p.x - this.moveSpeed * dt, p.y, p.z);
        }
    }
}
