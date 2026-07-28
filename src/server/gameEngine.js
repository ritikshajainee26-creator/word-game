const { getRandomWord } = require('./wordBank');

/**
 * Server-Authoritative Game Engine managing 1v1 match state, interval reveal loops,
 * guess limits, simultaneous submission grace windows, and disconnect handling.
 */
class GameEngine {
  /**
   * @param {Object} options
   * @param {string} options.roomId - Unique room identifier.
   * @param {Array<{id: string, name: string}>} options.players - Array of 2 player objects.
   * @param {number} [options.targetScore=3] - Target score required to win match.
   * @param {number} [options.revealIntervalMs=15000] - Interval between letter reveals.
   * @param {number} [options.graceWindowMs=300] - Grace window for simultaneous guesses in ms.
   * @param {Function} options.onEvent - Callback dispatcher for state changes.
   */
  constructor({
    roomId,
    players,
    targetScore = 3,
    revealIntervalMs = 15000,
    graceWindowMs = 300,
    onEvent
  }) {
    this.roomId = roomId;
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      score: 0,
      connected: true,
      socketId: p.socketId || p.id
    }));
    this.targetScore = targetScore;
    this.revealIntervalMs = revealIntervalMs;
    this.graceWindowMs = graceWindowMs;
    this.onEvent = onEvent || (() => {});

    this.status = 'created'; // 'created' | 'in_progress' | 'round_ended' | 'match_ended'
    this.currentRound = 0;
    this.targetWord = '';
    this.maskedWord = [];
    this.unrevealedIndices = [];
    this.usedWords = [];
    this.intervalIndex = 0;

    // Timer references
    this.intervalTimer = null;
    this.graceTimer = null;
    this.disconnectTimers = new Map(); // playerId -> timer

    // Per-round & per-interval tracking
    this.intervalGuesses = new Map(); // playerId -> { guess, timestamp, intervalIndex }
    this.roundGuessHistory = []; // list of all guesses in round
    this.correctSubmissionsInInterval = []; // [{ playerId, intervalIndex, timestamp }]
    this.isGracePeriodActive = false;
  }

  /**
   * Starts the match and initializes Round 1.
   */
  startMatch() {
    this.status = 'in_progress';
    this.currentRound = 0;
    this.players.forEach(p => (p.score = 0));
    
    this.emit('match_started', {
      roomId: this.roomId,
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      targetScore: this.targetScore
    });

    this.startNextRound();
  }

  /**
   * Prepares and starts the next round.
   */
  startNextRound() {
    if (this.status === 'match_ended') return;

    this.currentRound += 1;
    this.status = 'in_progress';
    this.targetWord = getRandomWord(this.usedWords);
    this.usedWords.push(this.targetWord);

    this.maskedWord = Array(this.targetWord.length).fill('_');
    this.unrevealedIndices = Array.from({ length: this.targetWord.length }, (_, i) => i);
    this.intervalIndex = 0;
    this.intervalGuesses.clear();
    this.roundGuessHistory = [];
    this.correctSubmissionsInInterval = [];
    this.isGracePeriodActive = false;

    this.clearTimers();

    this.emit('round_start', {
      roundNumber: this.currentRound,
      wordLength: this.targetWord.length,
      maskedWord: [...this.maskedWord],
      revealIntervalMs: this.revealIntervalMs,
      scores: this.getScores()
    });

    // Start timer loop for letter reveals
    this.scheduleNextReveal();
  }

  /**
   * Schedules the next interval reveal.
   */
  scheduleNextReveal() {
    this.clearTimer('intervalTimer');
    this.intervalTimer = setTimeout(() => {
      this.revealNextLetter();
    }, this.revealIntervalMs);
  }

  /**
   * Reveals a random unrevealed letter at interval tick.
   */
  revealNextLetter() {
    if (this.status !== 'in_progress' || this.isGracePeriodActive) return;

    if (this.unrevealedIndices.length === 0) {
      this.endRoundNoWinner();
      return;
    }

    // Pick random unrevealed index
    const randomIndexPosition = Math.floor(Math.random() * this.unrevealedIndices.length);
    const chosenIndex = this.unrevealedIndices.splice(randomIndexPosition, 1)[0];

    this.maskedWord[chosenIndex] = this.targetWord[chosenIndex];
    this.intervalIndex += 1;
    
    // Clear per-interval guess limits for the new tick
    this.intervalGuesses.clear();

    this.emit('letter_revealed', {
      index: chosenIndex,
      letter: this.targetWord[chosenIndex],
      maskedWord: [...this.maskedWord],
      intervalIndex: this.intervalIndex,
      remainingUnrevealed: this.unrevealedIndices.length
    });

    // If all letters revealed, wait 1 final interval for player guesses before declaring no winner
    if (this.unrevealedIndices.length === 0) {
      this.intervalTimer = setTimeout(() => {
        if (this.status === 'in_progress' && !this.isGracePeriodActive) {
          this.endRoundNoWinner();
        }
      }, this.revealIntervalMs);
    } else {
      this.scheduleNextReveal();
    }
  }

  /**
   * Process a player's word guess submission.
   * @param {string} playerId
   * @param {string} rawGuess
   * @returns {Object} Result object
   */
  submitGuess(playerId, rawGuess) {
    if (this.status !== 'in_progress') {
      return { success: false, reason: 'ROUND_NOT_ACTIVE' };
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, reason: 'PLAYER_NOT_FOUND' };
    }

    const normalizedGuess = (rawGuess || '').trim().toUpperCase();
    if (!normalizedGuess) {
      return { success: false, reason: 'EMPTY_GUESS' };
    }

    if (normalizedGuess.length !== this.targetWord.length) {
      return {
        success: false,
        reason: 'INVALID_LENGTH',
        expectedLength: this.targetWord.length
      };
    }

    // Enforce 1 guess per interval constraint
    if (this.intervalGuesses.has(playerId)) {
      return {
        success: false,
        reason: 'ALREADY_GUESSED_THIS_INTERVAL',
        intervalIndex: this.intervalIndex
      };
    }

    // Register interval guess attempt
    const timestamp = Date.now();
    this.intervalGuesses.set(playerId, {
      guess: normalizedGuess,
      timestamp,
      intervalIndex: this.intervalIndex
    });

    this.roundGuessHistory.push({
      playerId,
      playerName: player.name,
      guess: normalizedGuess,
      intervalIndex: this.intervalIndex,
      timestamp
    });

    const isCorrect = normalizedGuess === this.targetWord;

    if (isCorrect) {
      return this.handleCorrectGuess(playerId, timestamp);
    } else {
      this.emit('guess_attempt', {
        playerId,
        playerName: player.name,
        guess: normalizedGuess,
        isCorrect: false,
        intervalIndex: this.intervalIndex
      });

      return {
        success: true,
        isCorrect: false,
        message: 'Incorrect guess.'
      };
    }
  }

  /**
   * Handles a correct guess, managing the simultaneous submission grace window.
   */
  handleCorrectGuess(playerId, timestamp) {
    const player = this.players.find(p => p.id === playerId);

    this.correctSubmissionsInInterval.push({
      playerId,
      playerName: player.name,
      intervalIndex: this.intervalIndex,
      timestamp
    });

    this.emit('guess_attempt', {
      playerId,
      playerName: player.name,
      guess: this.targetWord,
      isCorrect: true,
      intervalIndex: this.intervalIndex
    });

    // Check if both players guessed correctly in the same interval
    if (this.correctSubmissionsInInterval.length === 2) {
      this.clearTimers();
      this.endRoundDraw();
      return {
        success: true,
        isCorrect: true,
        message: 'Correct guess! Round ended in a Draw (Simultaneous Submission).'
      };
    }

    // First correct guess in interval -> start grace window to check for simultaneous guess
    if (!this.isGracePeriodActive) {
      this.isGracePeriodActive = true;
      this.clearTimer('intervalTimer');

      // Check if opponent has ALREADY spent their guess this interval incorrectly
      const opponent = this.players.find(p => p.id !== playerId);
      const opponentSpentGuessInInterval = opponent && this.intervalGuesses.has(opponent.id);

      if (opponentSpentGuessInInterval || !opponent || !opponent.connected) {
        // Opponent cannot guess in this interval -> resolve win immediately
        this.endRoundWinner(playerId);
      } else {
        // Opponent still has an unused guess attempt in this interval -> start grace timer
        this.graceTimer = setTimeout(() => {
          if (this.status === 'in_progress') {
            if (this.correctSubmissionsInInterval.length === 2) {
              this.endRoundDraw();
            } else {
              this.endRoundWinner(playerId);
            }
          }
        }, this.graceWindowMs);
      }
    }

    return {
      success: true,
      isCorrect: true,
      message: 'Correct guess! Pending round resolution.'
    };
  }

  /**
   * Finalizes round with a single winner.
   */
  endRoundWinner(winnerId) {
    this.clearTimers();
    this.status = 'round_ended';

    const winner = this.players.find(p => p.id === winnerId);
    if (winner) {
      winner.score += 1;
    }

    const scores = this.getScores();
    const hasMatchWinner = winner && winner.score >= this.targetScore;

    this.emit('round_end', {
      roundNumber: this.currentRound,
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Unknown',
      isDraw: false,
      word: this.targetWord,
      scores,
      summary: `${winner ? winner.name : 'Player'} guessed "${this.targetWord}" correctly!`
    });

    if (hasMatchWinner) {
      this.endMatch(winnerId, 'TARGET_SCORE_REACHED');
    } else {
      setTimeout(() => this.startNextRound(), 3000);
    }
  }

  /**
   * Finalizes round as a Draw.
   */
  endRoundDraw() {
    this.clearTimers();
    this.status = 'round_ended';

    this.emit('round_end', {
      roundNumber: this.currentRound,
      winnerId: null,
      winnerName: null,
      isDraw: true,
      word: this.targetWord,
      scores: this.getScores(),
      summary: `Both players guessed "${this.targetWord}" in the same interval! Round is a Draw.`
    });

    setTimeout(() => this.startNextRound(), 3000);
  }

  /**
   * Finalizes round with no winner when all letters are revealed.
   */
  endRoundNoWinner() {
    this.clearTimers();
    this.status = 'round_ended';

    this.emit('round_end', {
      roundNumber: this.currentRound,
      winnerId: null,
      winnerName: null,
      isDraw: false,
      isExpired: true,
      word: this.targetWord,
      scores: this.getScores(),
      summary: `Word "${this.targetWord}" fully revealed without a correct guess. Round ends with no winner.`
    });

    setTimeout(() => this.startNextRound(), 3000);
  }

  /**
   * Ends the entire match and declares a winner.
   */
  endMatch(winnerId, reason) {
    this.clearTimers();
    this.status = 'match_ended';

    const winner = this.players.find(p => p.id === winnerId);
    
    this.emit('match_end', {
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Draw',
      finalScores: this.getScores(),
      reason
    });
  }

  /**
   * Handles player disconnection with a 15s grace window.
   */
  handleDisconnect(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    player.connected = false;
    this.clearTimer('intervalTimer');

    this.emit('player_disconnected', {
      playerId,
      playerName: player.name,
      gracePeriodSeconds: 15
    });

    // 15-second forfeit timer
    const forfeitTimer = setTimeout(() => {
      if (!player.connected && this.status !== 'match_ended') {
        const remainingPlayer = this.players.find(p => p.id !== playerId);
        this.endMatch(remainingPlayer ? remainingPlayer.id : null, 'WIN_BY_FORFEIT');
      }
    }, 15000);

    this.disconnectTimers.set(playerId, forfeitTimer);
  }

  /**
   * Handles player reconnection.
   */
  handleReconnect(playerId, newSocketId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;

    player.connected = true;
    if (newSocketId) player.socketId = newSocketId;

    if (this.disconnectTimers.has(playerId)) {
      clearTimeout(this.disconnectTimers.get(playerId));
      this.disconnectTimers.delete(playerId);
    }

    this.emit('player_reconnected', {
      playerId,
      playerName: player.name
    });

    // Resume timer if game was paused
    if (this.status === 'in_progress' && !this.intervalTimer && !this.isGracePeriodActive) {
      this.scheduleNextReveal();
    }

    return true;
  }

  /**
   * Returns a complete state snapshot of the active match for reconnection restoration.
   */
  getStateSnapshot() {
    const p1 = this.players[0];
    const p2 = this.players[1];
    return {
      roomId: this.roomId,
      status: this.status,
      currentRound: this.currentRound,
      targetScore: this.targetScore,
      wordLength: this.targetWord ? this.targetWord.length : 0,
      maskedWord: [...this.maskedWord],
      scores: this.getScores(),
      intervalIndex: this.intervalIndex,
      revealIntervalMs: this.revealIntervalMs,
      remainingUnrevealed: this.unrevealedIndices.length,
      players: this.players.map(p => ({ id: p.id, name: p.name, connected: p.connected, score: p.score })),
      p1Name: p1 ? p1.name : 'Player 1',
      p2Name: p2 ? p2.name : 'Player 2'
    };
  }

  /**
   * Helper to return current score map.
   */
  getScores() {
    const scores = {};
    this.players.forEach(p => {
      scores[p.id] = p.score;
    });
    return scores;
  }

  /**
   * Safely clears a single named timer.
   */
  clearTimer(timerName) {
    if (this[timerName]) {
      clearTimeout(this[timerName]);
      this[timerName] = null;
    }
  }

  /**
   * Clears all active timers in the engine.
   */
  clearTimers() {
    this.clearTimer('intervalTimer');
    this.clearTimer('graceTimer');
    this.disconnectTimers.forEach(timer => clearTimeout(timer));
    this.disconnectTimers.clear();
  }

  /**
   * Dispatches events to listener.
   */
  emit(event, data) {
    if (typeof this.onEvent === 'function') {
      this.onEvent(event, data);
    }
  }
}

module.exports = GameEngine;
