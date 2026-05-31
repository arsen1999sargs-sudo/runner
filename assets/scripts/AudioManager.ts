import { _decorator, Component, AudioClip, AudioSource, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Звук игры: фоновая музыка (зациклена на весь забег) + эффекты
 * (прыжок, столкновение, проигрыш, победа).
 *
 * Использование:
 *  - Повесь на пустой узел (например, AudioManager).
 *  - Назначь клипы в Inspector.
 *  - Триггеры вызываются из кода (GameManager / Player / Pickup) сами.
 */
@ccclass('AudioManager')
export class AudioManager extends Component {

    public static instance: AudioManager | null = null;

    @property({ type: AudioClip, tooltip: 'Фоновая музыка (весь забег, зациклена)' })
    bgMusic: AudioClip = null!;
    @property({ type: AudioClip, tooltip: 'Прыжок' })
    jumpSfx: AudioClip = null!;
    @property({ type: AudioClip, tooltip: 'Столкновение (барьер / мужик)' })
    hitSfx: AudioClip = null!;
    @property({ type: AudioClip, tooltip: 'Проигрыш' })
    loseSfx: AudioClip = null!;
    @property({ type: AudioClip, tooltip: 'Победа (финиш)' })
    winSfx: AudioClip = null!;

    @property({ type: CCFloat, tooltip: 'Громкость музыки (0..1)' })
    bgVolume: number = 0.5;
    @property({ type: CCFloat, tooltip: 'Громкость эффектов (0..1)' })
    sfxVolume: number = 1.0;

    private bgSource: AudioSource | null = null;

    onLoad() {
        AudioManager.instance = this;
        this.bgSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);
        this.bgSource.playOnAwake = false;
        this.bgSource.loop = true;
        this.bgSource.volume = this.bgVolume;
    }

    onDestroy() {
        if (AudioManager.instance === this) AudioManager.instance = null;
    }

    /** Фоновая музыка — старт забега. */
    public playBg() {
        if (!this.bgSource || !this.bgMusic) return;
        this.bgSource.stop();
        this.bgSource.clip = this.bgMusic;
        this.bgSource.loop = true;
        this.bgSource.volume = this.bgVolume;
        this.bgSource.play();
    }

    public stopBg() { if (this.bgSource) this.bgSource.stop(); }

    private sfx(clip: AudioClip) {
        if (!clip || !this.bgSource) return;
        this.bgSource.playOneShot(clip, this.sfxVolume); // одноразовый поверх музыки
    }

    public playJump() { this.sfx(this.jumpSfx); }
    public playHit() { this.sfx(this.hitSfx); }
    public playLose() { this.stopBg(); this.sfx(this.loseSfx); }
    public playWin() { this.stopBg(); this.sfx(this.winSfx); }
}
