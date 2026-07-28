/**
 * Web Audio API Sound Synthesizer for Word Clash.
 * Synthesizes retro/modern UI audio without external MP3 asset requirements.
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (err) {
      // Ignore web audio autoplay restrictions before user gesture
    }
  }

  playLetterReveal() {
    this.playTone(523.25, 'sine', 0.12, 0.12); // C5
  }

  playTick() {
    this.playTone(800, 'triangle', 0.04, 0.05);
  }

  playCorrectGuess() {
    if (!this.enabled) return;
    this.init();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.2, 0.2);
      }, idx * 100);
    });
  }

  playWrongGuess() {
    this.playTone(180, 'sawtooth', 0.3, 0.25);
  }

  playRoundWin() {
    if (!this.enabled) return;
    const fanfare = [523.25, 659.25, 783.99, 1046.50];
    fanfare.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'square', 0.25, 0.2);
      }, idx * 120);
    });
  }
}

window.soundFx = new SoundEffects();
