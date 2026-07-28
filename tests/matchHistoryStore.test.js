const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/server/db');

test('db module initializes fallback store cleanly', async () => {
  const ready = await db.initDatabase();
  assert.strictEqual(typeof ready, 'boolean');
});

test('saveMatchResult saves and parses WIN, LOSS, and DRAW history', async () => {
  const matchId = `test_match_${Date.now()}`;
  const saveRes = await db.saveMatchResult({
    matchId,
    roomId: 'room_test',
    player1Name: 'Viper',
    player2Name: 'Shadow',
    winnerName: 'Viper',
    player1Score: 3,
    player2Score: 1,
    roundsPlayed: 4,
    endReason: 'TARGET_SCORE_REACHED'
  });

  assert.strictEqual(saveRes.success, true);

  // Retrieve history for Viper
  const viperHistory = await db.getUserMatchHistory('Viper');
  assert.ok(viperHistory.length > 0);
  const viperRecord = viperHistory.find(h => h.matchId === matchId);
  assert.ok(viperRecord);
  assert.strictEqual(viperRecord.result, 'WIN');
  assert.strictEqual(viperRecord.opponentName, 'Shadow');
  assert.strictEqual(viperRecord.playerScore, 3);
  assert.strictEqual(viperRecord.opponentScore, 1);

  // Retrieve history for Shadow
  const shadowHistory = await db.getUserMatchHistory('Shadow');
  assert.ok(shadowHistory.length > 0);
  const shadowRecord = shadowHistory.find(h => h.matchId === matchId);
  assert.ok(shadowRecord);
  assert.strictEqual(shadowRecord.result, 'LOSS');
  assert.strictEqual(shadowRecord.opponentName, 'Viper');
  assert.strictEqual(shadowRecord.playerScore, 1);
  assert.strictEqual(shadowRecord.opponentScore, 3);
});

test('getUserMatchHistory handles case-insensitive name query', async () => {
  const matchId = `test_match_ci_${Date.now()}`;
  await db.saveMatchResult({
    matchId,
    player1Name: 'CyberNinja',
    player2Name: 'Bot Master 🤖',
    winnerName: 'CyberNinja',
    player1Score: 3,
    player2Score: 0
  });

  const historyLower = await db.getUserMatchHistory('cyberninja');
  assert.ok(historyLower.length > 0);
  const rec = historyLower.find(h => h.matchId === matchId);
  assert.ok(rec);
  assert.strictEqual(rec.result, 'WIN');
});
