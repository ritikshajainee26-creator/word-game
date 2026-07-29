/**
 * Web Audio API Sound Synthesizer instance for Word Clash React SPA.
 * Generates custom audio frequencies for game events without external MP3 files.
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playTone(freq, type = 'sine', durationMs = 150, gainVal = 0.1) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + (durationMs / 1000));
    } catch (e) {
      console.warn('Audio synthesis error:', e.message);
    }
  }

  playLetterReveal() {
    this.playTone(523.25, 'sine', 180, 0.12); // C5
  }

  playTimerTick() {
    this.playTone(800, 'triangle', 50, 0.04);
  }

  playCorrectGuess() {
    this.playTone(587.33, 'sine', 100, 0.15); // D5
    setTimeout(() => this.playTone(880, 'sine', 200, 0.15), 100); // A5
  }

  playWrongGuess() {
    this.playTone(220, 'sawtooth', 250, 0.12); // A3
  }

  playRoundWin() {
    this.playTone(523.25, 'sine', 120, 0.15);
    setTimeout(() => this.playTone(659.25, 'sine', 120, 0.15), 120);
    setTimeout(() => this.playTone(783.99, 'sine', 250, 0.15), 240);
  }

  playMatchVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 200, 0.18), idx * 120);
    });
  }
}

const soundEffects = new SoundEffects();
export default soundEffects;
