const crypto = require('crypto');

/**
 * Modular Session Manager for persistent player authentication and match reconnection.
 * Generates cryptographic session tokens tied to player and match IDs.
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionToken -> { playerId, matchId, playerName, createdAt }
    this.playerToToken = new Map(); // playerId -> sessionToken
  }

  /**
   * Creates a new session for a player entering a match.
   * @param {string} playerId
   * @param {string} matchId
   * @param {string} playerName
   * @returns {string} Crypto session token
   */
  createSession(playerId, matchId, playerName) {
    const tokenBytes = crypto.randomBytes(16).toString('hex');
    const sessionToken = `st_${playerId}_${tokenBytes}`;

    const sessionData = {
      sessionToken,
      playerId,
      matchId,
      playerName: playerName || 'Player',
      createdAt: Date.now()
    };

    this.sessions.set(sessionToken, sessionData);
    this.playerToToken.set(playerId, sessionToken);

    return sessionToken;
  }

  /**
   * Validates a reconnection request against stored session records.
   * @param {string} sessionToken
   * @param {string} playerId
   * @param {string} matchId
   * @returns {boolean} True if valid session match
   */
  validateSession(sessionToken, playerId, matchId) {
    if (!sessionToken || !playerId || !matchId) return false;

    const session = this.sessions.get(sessionToken);
    if (!session) {
      // Fallback check if session token matches player's stored token
      const storedToken = this.playerToToken.get(playerId);
      if (storedToken && storedToken === sessionToken) return true;
      return false;
    }

    return session.playerId === playerId && session.matchId === matchId;
  }

  /**
   * Retrieves session info by token.
   * @param {string} sessionToken
   */
  getSession(sessionToken) {
    return this.sessions.get(sessionToken);
  }

  /**
   * Clears session records when a match terminates.
   * @param {string} matchId
   */
  removeMatchSessions(matchId) {
    this.sessions.forEach((session, token) => {
      if (session.matchId === matchId) {
        this.playerToToken.delete(session.playerId);
        this.sessions.delete(token);
      }
    });
  }
}

module.exports = new SessionManager();
