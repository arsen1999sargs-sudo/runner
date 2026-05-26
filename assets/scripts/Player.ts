import { _decorator, Component, Node, Vec3, tween, Tween, input, Input, EventTouch, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
const { ccclass, property } = _decorator;

@ccclass('Player')
export class Player extends Component {

    @property
    laneWidth: number = 140;

    @property
    moveDuration: number = 0.15;

    @property
    lanes: number = 3;

    private currentLane: number = 1;
    private moveTween: Tween<Node> | null = null;
    private baseY: number = -150;

    onLoad() {
        this.baseY = this.node.position.y;
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    onTouchStart(e: EventTouch) {
        const gm = GameManager.instance;
        if (!gm) return;

        if (gm.getState() === GameState.IDLE) {
            gm.startGame();
            return;
        }
        if (gm.getState() !== GameState.RUNNING) return;

        const loc = e.getUILocation();
        const winW = this.node.scene.getComponentInChildren(UITransform)?.width || 720;
        if (loc.x < winW / 2) {
            this.moveLane(-1);
        } else {
            this.moveLane(1);
        }
    }

    moveLane(dir: number) {
        const target = Math.max(0, Math.min(this.lanes - 1, this.currentLane + dir));
        if (target === this.currentLane) return;
        this.currentLane = target;
        this.moveToLane();
    }

    private moveToLane() {
        const centerOffset = (this.lanes - 1) / 2;
        const targetX = (this.currentLane - centerOffset) * this.laneWidth;

        if (this.moveTween) this.moveTween.stop();
        this.moveTween = tween(this.node)
            .to(this.moveDuration, { position: new Vec3(targetX, this.baseY, 0) }, { easing: 'quadOut' })
            .start();
    }

    getLane(): number {
        return this.currentLane;
    }
}
