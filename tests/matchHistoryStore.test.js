const test = require('node:test');
const assert = require('node:assert');
const matchHistoryStore = require('../src/server/matchHistoryStore');

test('MatchHistoryStore records and retrieves player stats', () => {
  const playerId = 'test_player_history_1';
  
  matchHistoryStore.clearUserHistory(playerId);

  // Add 1 Win
  matchHistoryStore.addRecord(playerId, {
    opponentName: 'Bot Master 🤖',
    myScore: 3,
    opponentScore: 1,
    result: 'WIN',
    gameMode: 'Practice vs AI'
  });

  // Add 1 Loss
  matchHistoryStore.addRecord(playerId, {
    opponentName: 'Alice',
    myScore: 1,
    opponentScore: 3,
    result: 'LOSS',
    gameMode: 'Quick Match'
  });

  // Add 1 Draw
  matchHistoryStore.addRecord(playerId, {
    opponentName: 'Bob',
    myScore: 2,
    opponentScore: 2,
    result: 'DRAW',
    gameMode: 'Private Room'
  });

  const { history, stats } = matchHistoryStore.getUserHistory(playerId);

  assert.strictEqual(history.length, 3);
  assert.strictEqual(stats.totalMatches, 3);
  assert.strictEqual(stats.wins, 1);
  assert.strictEqual(stats.losses, 1);
  assert.strictEqual(stats.draws, 1);
  assert.strictEqual(stats.winRate, 33);

  // Clear history
  matchHistoryStore.clearUserHistory(playerId);
  const cleared = matchHistoryStore.getUserHistory(playerId);
  assert.strictEqual(cleared.history.length, 0);
  assert.strictEqual(cleared.stats.totalMatches, 0);
});
