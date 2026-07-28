const { Pool } = require('pg');

/**
 * PostgreSQL Database Module with transparent in-memory fallback.
 * Manages user match histories, game room results, and player win/loss records.
 */

// In-Memory Fallback Storage
const inMemoryMatches = [];
const inMemoryUserHistory = [];
let isPgConnected = false;
let pool = null;

// Initialize PostgreSQL Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/word_game';

try {
  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000
  });
} catch (err) {
  console.warn('⚠️ PostgreSQL Pool init warning:', err.message);
}

/**
 * Initializes Database tables or fallback store.
 */
async function initDatabase() {
  if (!pool) {
    console.log('ℹ️ Operating in-memory match history fallback store (PostgreSQL pool unconfigured).');
    return false;
  }

  try {
    const client = await pool.connect();
    
    // Create matches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(100) PRIMARY KEY,
        room_id VARCHAR(100) NOT NULL,
        player1_name VARCHAR(100) NOT NULL,
        player2_name VARCHAR(100) NOT NULL,
        winner_name VARCHAR(100),
        player1_score INT DEFAULT 0,
        player2_score INT DEFAULT 0,
        rounds_played INT DEFAULT 0,
        end_reason VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_match_history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_match_history (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(100) NOT NULL,
        match_id VARCHAR(100) NOT NULL,
        opponent_name VARCHAR(100) NOT NULL,
        result VARCHAR(20) NOT NULL,
        player_score INT NOT NULL,
        opponent_score INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create index on player_name for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_history_player ON user_match_history(player_name);
    `);

    client.release();
    isPgConnected = true;
    console.log('✅ PostgreSQL Database connected and tables initialized successfully.');
    return true;
  } catch (err) {
    isPgConnected = false;
    console.warn('ℹ️ Operating in-memory match history fallback store (PostgreSQL connection unavailable):', err.message);
    return false;
  }
}

/**
 * Saves a completed match result to PostgreSQL (or fallback store).
 * @param {Object} matchData
 */
async function saveMatchResult(matchData) {
  const {
    matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    roomId = 'room_1',
    player1Name = 'Player 1',
    player2Name = 'Player 2',
    winnerName = null,
    player1Score = 0,
    player2Score = 0,
    roundsPlayed = 1,
    endReason = 'MATCH_COMPLETED'
  } = matchData;

  const createdAt = new Date().toISOString();

  // Helper to determine result string relative to a player
  const getResult = (pName, oppName, pScore, oppScore) => {
    if (!winnerName || winnerName === 'Draw' || pScore === oppScore) return 'DRAW';
    return winnerName === pName ? 'WIN' : 'LOSS';
  };

  const p1Result = getResult(player1Name, player2Name, player1Score, player2Score);
  const p2Result = getResult(player2Name, player1Name, player2Score, player1Score);

  if (isPgConnected && pool) {
    try {
      // 1. Insert into matches table
      await pool.query(
        `INSERT INTO matches (id, room_id, player1_name, player2_name, winner_name, player1_score, player2_score, rounds_played, end_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (id) DO NOTHING;`,
        [matchId, roomId, player1Name, player2Name, winnerName, player1Score, player2Score, roundsPlayed, endReason]
      );

      // 2. Insert into user_match_history for Player 1
      await pool.query(
        `INSERT INTO user_match_history (player_name, match_id, opponent_name, result, player_score, opponent_score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [player1Name, matchId, player2Name, p1Result, player1Score, player2Score]
      );

      // 3. Insert into user_match_history for Player 2
      await pool.query(
        `INSERT INTO user_match_history (player_name, match_id, opponent_name, result, player_score, opponent_score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW());`,
        [player2Name, matchId, player1Name, p2Result, player2Score, player1Score]
      );

      return { success: true, matchId, storage: 'postgresql' };
    } catch (err) {
      console.error('❌ Failed to insert match into PostgreSQL, saving to in-memory store:', err.message);
    }
  }

  // In-Memory Fallback
  const matchRecord = {
    id: matchId,
    roomId,
    player1Name,
    player2Name,
    winnerName,
    player1Score,
    player2Score,
    roundsPlayed,
    endReason,
    createdAt
  };
  inMemoryMatches.push(matchRecord);

  inMemoryUserHistory.push({
    id: inMemoryUserHistory.length + 1,
    playerName: player1Name,
    matchId,
    opponentName: player2Name,
    result: p1Result,
    playerScore: player1Score,
    opponentScore: player2Score,
    createdAt
  });

  inMemoryUserHistory.push({
    id: inMemoryUserHistory.length + 1,
    playerName: player2Name,
    matchId,
    opponentName: player1Name,
    result: p2Result,
    playerScore: player2Score,
    opponentScore: player1Score,
    createdAt
  });

  return { success: true, matchId, storage: 'in_memory' };
}

/**
 * Retrieves match history for a specific user.
 * @param {string} playerName
 * @returns {Promise<Array>} Array of user match history items
 */
async function getUserMatchHistory(playerName) {
  const targetName = (playerName || '').trim();
  if (!targetName) return [];

  if (isPgConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT match_id, opponent_name, result, player_score, opponent_score, created_at
         FROM user_match_history
         WHERE LOWER(player_name) = LOWER($1)
         ORDER BY created_at DESC
         LIMIT 50;`,
        [targetName]
      );
      return res.rows.map(r => ({
        matchId: r.match_id,
        opponentName: r.opponent_name,
        result: r.result,
        playerScore: r.player_score,
        opponentScore: r.opponent_score,
        createdAt: r.created_at
      }));
    } catch (err) {
      console.error('❌ Error fetching user history from PostgreSQL:', err.message);
    }
  }

  // Fallback in-memory lookup
  return inMemoryUserHistory
    .filter(h => h.playerName.toLowerCase() === targetName.toLowerCase())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
}

// Auto-run initDatabase on module import
initDatabase().catch(err => console.error('DB init error:', err));

module.exports = {
  pool,
  initDatabase,
  saveMatchResult,
  getUserMatchHistory,
  isPgConnected: () => isPgConnected
};
