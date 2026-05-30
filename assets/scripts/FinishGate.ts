import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec2, CCFloat, CCObject } from 'cc';
import { EDITOR } from 'cc/env';
import { GameManager } from './GameManager';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Финишная «арка»: САМ строит финиш из 5 кадров, выезжает справа к концу
 * дистанции (= к finishTime секундам) и рвёт ленту у девочки.
 *
 * Использование:
 *  - Создай пустой узел FinishGate под GameLayer, повесь этот компонент.
 *  - Назначь 5 кадров (finish / baryer1 / baryer2 / lenta1 / lenta2).
 *  - Подвинь куски через *Pos / *Scale в инспекторе (визуал появится сразу в игре).
 */
@ccclass('FinishGate')
@executeInEditMode(true)
export class FinishGate extends Component {

    // ---- картинки ----
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Шашечки на дорогу (finish)' })
    finishFrame: SpriteFrame = null!;
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Левый столб (baryer1)' })
    postLeftFrame: SpriteFrame = null!;
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Правый столб (baryer2)' })
    postRightFrame: SpriteFrame = null!;
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Левая половина ленты (lenta1)' })
    ribbonLeftFrame: SpriteFrame = null!;
    @property({ group: { name: 'Кадры' }, type: SpriteFrame, tooltip: 'Правая половина ленты (lenta2)' })
    ribbonRightFrame: SpriteFrame = null!;

    // ---- раскладка (локальные координаты, центр = где будет финиш) ----
    @property({ group: { name: 'Раскладка' }, tooltip: 'Позиция шашечек (на дороге)' })
    finishPos: Vec2 = new Vec2(0, -300);
    @property({ group: { name: 'Раскладка' }, type: CCFloat, tooltip: 'ШИРИНА шашечек, px' })
    finishWidth: number = 700;
    @property({ group: { name: 'Раскладка' }, type: CCFloat, tooltip: 'ВЫСОТА шашечек, px' })
    finishHeight: number = 200;

    @property({ group: { name: 'Раскладка' }, tooltip: 'Левый столб (baryer1) — у левого угла' })
    postLeftPos: Vec2 = new Vec2(-250, -230);
    @property({ group: { name: 'Раскладка' }, tooltip: 'Правый столб (baryer2) — у правого угла' })
    postRightPos: Vec2 = new Vec2(250, -230);
    @property({ group: { name: 'Раскладка' }, type: CCFloat })
    postScale: number = 1.6;
    @property({ group: { name: 'Раскладка' }, type: CCFloat, tooltip: 'Поворот столбов, градусы (90 = вертикально)' })
    postRotation: number = 90;

    @property({ group: { name: 'Раскладка' }, tooltip: 'Левая половина ленты (у левого столба)' })
    ribbonLeftPos: Vec2 = new Vec2(-120, -130);
    @property({ group: { name: 'Раскладка' }, tooltip: 'Правая половина ленты (у правого столба)' })
    ribbonRightPos: Vec2 = new Vec2(120, -130);
    @property({ group: { name: 'Раскладка' }, type: CCFloat })
    ribbonScale: number = 3.5;

    // ---- движение / разрыв ----
    @property({ group: { name: 'Движение' }, type: CCFloat, tooltip: 'X за правым краем (откуда выезжает)' })
    startX: number = 900;
    @property({ group: { name: 'Движение' }, type: CCFloat, tooltip: 'X, где лента у девочки (точка финиша)' })
    targetX: number = -210;
    @property({ group: { name: 'Движение' }, type: CCFloat, tooltip: 'На какой секунде девочка ДОБЕГАЕТ до ленты и игра заканчивается' })
    finishAtSec: number = 23;
    @property({ group: { name: 'Движение' }, type: CCFloat, tooltip: 'Скорость движения с дорогой, px/сек (≈ скорость препятствий, чтобы ехал ровно)' })
    moveSpeed: number = 450;
    @property({ group: { name: 'Движение' }, type: CCFloat, tooltip: 'На сколько разлетаются половины ленты, px' })
    breakDist: number = 220;

    private ribbonL: Node | null = null;
    private ribbonR: Node | null = null;
    private rlBaseX: number = 0;
    private rrBaseX: number = 0;
    private broke: boolean = false;
    private lastHash: string = '';

    onLoad() {
        this.build();
        if (!EDITOR) {
            const p = this.node.position;
            this.node.setPosition(this.startX, p.y, p.z); // спрятать справа (только в игре)
        }
    }

    private mk(name: string, frame: SpriteFrame, scaleX: number, scaleY: number, pos: Vec2, rotation: number = 0): Node | null {
        if (!frame) return null;
        const n = new Node(name);
        n.layer = this.node.layer;
        // в редакторе предпросмотр не сохраняем и не засоряем иерархию
        if (EDITOR) n.hideFlags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
        const ui = n.addComponent(UITransform);
        const sp = n.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = frame;
        ui.setContentSize(frame.rect.width * scaleX, frame.rect.height * scaleY); // размер ПОСЛЕ spriteFrame
        this.node.addChild(n);
        n.setPosition(pos.x, pos.y, 0);
        if (rotation !== 0) n.angle = rotation;
        return n;
    }

    private build() {
        this.node.removeAllChildren(); // пересборка с нуля
        // шашечки — точный размер в пикселях (finishWidth × finishHeight)
        const fw = this.finishFrame ? this.finishFrame.rect.width : 1;
        const fh = this.finishFrame ? this.finishFrame.rect.height : 1;
        // порядок добавления = порядок отрисовки (шашечки снизу, столбы, лента сверху)
        this.mk('Finish', this.finishFrame, this.finishWidth / fw, this.finishHeight / fh, this.finishPos);
        this.mk('PostLeft', this.postLeftFrame, this.postScale, this.postScale, this.postLeftPos, this.postRotation);
        this.mk('PostRight', this.postRightFrame, this.postScale, this.postScale, this.postRightPos, this.postRotation);
        this.ribbonL = this.mk('RibbonLeft', this.ribbonLeftFrame, this.ribbonScale, this.ribbonScale, this.ribbonLeftPos);
        this.ribbonR = this.mk('RibbonRight', this.ribbonRightFrame, this.ribbonScale, this.ribbonScale, this.ribbonRightPos);
        if (this.ribbonL) this.rlBaseX = this.ribbonL.position.x;
        if (this.ribbonR) this.rrBaseX = this.ribbonR.position.x;
    }

    update(dt: number) {
        // В РЕДАКТОРЕ: живой предпросмотр — пересобираем при изменении любого параметра
        if (EDITOR) {
            const h = `${this.finishWidth},${this.finishHeight},${this.finishPos.x},${this.finishPos.y},`
                + `${this.postLeftPos.x},${this.postLeftPos.y},${this.postRightPos.x},${this.postRightPos.y},${this.postScale},${this.postRotation},`
                + `${this.ribbonLeftPos.x},${this.ribbonLeftPos.y},${this.ribbonRightPos.x},${this.ribbonRightPos.y},${this.ribbonScale}`;
            if (h !== this.lastHash) { this.build(); this.lastHash = h; }
            return;
        }

        const gm = GameManager.instance;
        if (!gm) return;

        const elapsed = gm.getRunElapsed();
        const p = this.node.position;

        // запуск рассчитан так, чтобы приехать к targetX ровно на finishAtSec секунде
        const travel = (this.startX - this.targetX) / Math.max(1, this.moveSpeed);
        const launchAt = Math.max(0, this.finishAtSec - travel);

        if (elapsed < launchAt) {
            // ещё рано — держим за правым краем (за экраном)
            if (p.x !== this.startX) this.node.setPosition(this.startX, p.y, p.z);
            return;
        }

        // едем ВЛЕВО с дорогой (как препятствие)
        if (p.x > this.targetX) {
            const nx = Math.max(this.targetX, p.x - this.moveSpeed * dt);
            this.node.setPosition(nx, p.y, p.z);
        }

        // ДОБЕЖАЛИ до ленты → рвём ленту и заканчиваем игру (один раз)
        if (!this.broke && this.node.position.x <= this.targetX) {
            this.broke = true;
            gm.finishGame();
        }
        if (this.broke) {
            if (this.ribbonL) this.ribbonL.setPosition(this.rlBaseX - this.breakDist, this.ribbonL.position.y, 0);
            if (this.ribbonR) this.ribbonR.setPosition(this.rrBaseX + this.breakDist, this.ribbonR.position.y, 0);
        }
    }
}
