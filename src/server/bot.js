const { WORD_BANK } = require('./wordBank');

/**
 * Automated Practice Bot simulating a human player for offline/solo mode.
 */
class PracticeBot {
  /**
   * @param {string} id - Bot ID.
   * @param {string} name - Bot Display Name.
   * @param {GameEngine} engine - Target Game Engine reference.
   */
  constructor(id = 'BOT_OPPONENT', name = 'Bot Master 🤖', engine = null) {
    this.id = id;
    this.name = name;
    this.engine = engine;
    this.intervalTimer = null;
    this.targetWord = '';
    this.maskedWord = [];
  }

  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Called when a new round starts.
   */
  onRoundStart(data) {
    this.maskedWord = [...data.maskedWord];
  }

  /**
   * Called when a letter is revealed.
   */
  onLetterRevealed(data) {
    this.maskedWord = [...data.maskedWord];
    this.evaluateGuessAttempt(data.intervalIndex);
  }

  /**
   * Evaluates whether the bot should attempt a guess in the current interval.
   */
  evaluateGuessAttempt(intervalIndex) {
    if (!this.engine || this.engine.status !== 'in_progress') return;

    // Check if bot already guessed this interval
    if (this.engine.intervalGuesses.has(this.id)) return;

    const revealedCount = this.maskedWord.filter(c => c !== '_').length;
    const totalLength = this.maskedWord.length;
    const ratio = revealedCount / totalLength;

    // Increasing probability of guessing correctly as more letters reveal
    let guessProbability = 0;
    if (ratio >= 0.7) {
      guessProbability = 0.85;
    } else if (ratio >= 0.5) {
      guessProbability = 0.5;
    } else if (ratio >= 0.3) {
      guessProbability = 0.2;
    }

    const shouldAttempt = Math.random() < guessProbability;

    if (shouldAttempt) {
      // Simulate human reaction time delay (1 to 2.5 seconds into interval)
      const delayMs = 1000 + Math.floor(Math.random() * 1500);
      
      setTimeout(() => {
        if (this.engine && this.engine.status === 'in_progress' && !this.engine.intervalGuesses.has(this.id)) {
          // 80% chance bot guesses target word, 20% wrong word of matching length
          const isAccurate = Math.random() < 0.8;
          let botGuess = this.engine.targetWord;

          if (!isAccurate) {
            const matchingLengthWords = WORD_BANK.filter(w => w.length === totalLength && w !== botGuess);
            if (matchingLengthWords.length > 0) {
              botGuess = matchingLengthWords[Math.floor(Math.random() * matchingLengthWords.length)];
            } else {
              botGuess = 'X'.repeat(totalLength);
            }
          }

          this.engine.submitGuess(this.id, botGuess);
        }
      }, delayMs);
    }
  }

  reset() {
    if (this.intervalTimer) clearTimeout(this.intervalTimer);
  }
}

module.exports = PracticeBot;
