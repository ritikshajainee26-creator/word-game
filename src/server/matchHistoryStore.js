/**
 * In-Memory & Session Store for User Match History and Performance Statistics.
 */
class MatchHistoryStore {
  constructor() {
    // Map of playerId -> Array of match objects
    this.histories = new Map();
  }

  /**
   * Record a completed match for a specific player.
   * @param {string} playerId
   * @param {Object} matchRecord
   */
  addRecord(playerId, matchRecord) {
    if (!playerId) return;

    if (!this.histories.has(playerId)) {
      this.histories.set(playerId, []);
    }

    const userHistory = this.histories.get(playerId);
    userHistory.unshift({
      id: `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...matchRecord
    });

    // Limit history to 50 most recent matches per user
    if (userHistory.length > 50) {
      userHistory.pop();
    }
  }

  /**
   * Returns full match history and computed performance statistics for a player.
   * @param {string} playerId
   * @returns {Object} { history: Array, stats: Object }
   */
  getUserHistory(playerId) {
    const history = this.histories.get(playerId) || [];
    
    let wins = 0;
    let losses = 0;
    let draws = 0;

    history.forEach(m => {
      if (m.result === 'WIN') wins++;
      else if (m.result === 'LOSS') losses++;
      else if (m.result === 'DRAW') draws++;
    });

    const totalMatches = history.length;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    return {
      history,
      stats: {
        totalMatches,
        wins,
        losses,
        draws,
        winRate
      }
    };
  }

  clearUserHistory(playerId) {
    this.histories.delete(playerId);
  }
}

module.exports = new MatchHistoryStore();
