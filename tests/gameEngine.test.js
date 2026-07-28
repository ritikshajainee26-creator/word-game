const test = require('node:test');
const assert = require('node:assert');
const GameEngine = require('../src/server/gameEngine');
const { getRandomWord, WORD_BANK } = require('../src/server/wordBank');

test('WordBank exports valid word list', () => {
  assert.ok(Array.isArray(WORD_BANK));
  assert.ok(WORD_BANK.length > 10);
  const word = getRandomWord();
  assert.strictEqual(typeof word, 'string');
  assert.strictEqual(word, word.toUpperCase());
});

test('GameEngine initializes players and start match', () => {
  const events = [];
  const engine = new GameEngine({
    roomId: 'TEST_ROOM_1',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    targetScore: 2,
    revealIntervalMs: 1000,
    onEvent: (event, data) => events.push({ event, data })
  });

  engine.startMatch();

  assert.strictEqual(engine.status, 'in_progress');
  assert.strictEqual(engine.currentRound, 1);
  assert.strictEqual(engine.targetWord.length > 0, true);
  assert.strictEqual(engine.maskedWord.length, engine.targetWord.length);
  assert.strictEqual(engine.maskedWord.every(c => c === '_'), true);

  const matchStartEvent = events.find(e => e.event === 'match_started');
  assert.ok(matchStartEvent);
  assert.strictEqual(matchStartEvent.data.roomId, 'TEST_ROOM_1');

  engine.clearTimers();
});

test('GameEngine enforces single guess per interval', () => {
  const engine = new GameEngine({
    roomId: 'TEST_ROOM_2',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    revealIntervalMs: 1000
  });

  engine.startMatch();

  const wrongGuess = 'X'.repeat(engine.targetWord.length);
  const res1 = engine.submitGuess('p1', wrongGuess);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.isCorrect, false);

  // Second guess in same interval should be rejected
  const res2 = engine.submitGuess('p1', wrongGuess);
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.reason, 'ALREADY_GUESSED_THIS_INTERVAL');

  engine.clearTimers();
});

test('GameEngine handles correct guess and awards score', async () => {
  const events = [];
  const engine = new GameEngine({
    roomId: 'TEST_ROOM_3',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    targetScore: 2,
    revealIntervalMs: 1000,
    graceWindowMs: 0,
    onEvent: (event, data) => events.push({ event, data })
  });

  engine.startMatch();
  const word = engine.targetWord;

  // Player 1 submits correct word
  const res = engine.submitGuess('p1', word);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.isCorrect, true);

  // Wait for grace timer callback to execute on event loop
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.strictEqual(engine.players[0].score, 1);
  assert.strictEqual(engine.status, 'round_ended');

  const roundEndEvent = events.find(e => e.event === 'round_end');
  assert.ok(roundEndEvent);
  assert.strictEqual(roundEndEvent.data.winnerId, 'p1');

  engine.clearTimers();
});

test('GameEngine handles simultaneous correct guess (Draw)', () => {
  const events = [];
  const engine = new GameEngine({
    roomId: 'TEST_ROOM_4',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    targetScore: 2,
    revealIntervalMs: 1000,
    graceWindowMs: 500,
    onEvent: (event, data) => events.push({ event, data })
  });

  engine.startMatch();
  const word = engine.targetWord;

  // Alice submits correct guess
  engine.submitGuess('p1', word);
  // Bob also submits correct guess in same interval
  engine.submitGuess('p2', word);

  assert.strictEqual(engine.status, 'round_ended');
  const roundEndEvent = events.find(e => e.event === 'round_end');
  assert.ok(roundEndEvent);
  assert.strictEqual(roundEndEvent.data.isDraw, true);
  assert.strictEqual(engine.players[0].score, 0);
  assert.strictEqual(engine.players[1].score, 0);

  engine.clearTimers();
});

test('GameEngine handles disconnect and reconnect grace period', () => {
  const events = [];
  const engine = new GameEngine({
    roomId: 'TEST_ROOM_5',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    onEvent: (event, data) => events.push({ event, data })
  });

  engine.startMatch();

  // Disconnect Alice
  engine.handleDisconnect('p1');
  assert.strictEqual(engine.players[0].connected, false);

  const dcEvent = events.find(e => e.event === 'player_disconnected');
  assert.ok(dcEvent);
  assert.strictEqual(dcEvent.data.playerId, 'p1');
  assert.strictEqual(dcEvent.data.gracePeriodSeconds, 30);

  // Reconnect Alice
  const reconnected = engine.handleReconnect('p1', 'new_socket_id');
  assert.strictEqual(reconnected, true);
  assert.strictEqual(engine.players[0].connected, true);

  // Verify state snapshot
  const state = engine.getCurrentState('p1');
  assert.strictEqual(state.roomId, 'TEST_ROOM_5');
  assert.strictEqual(state.currentRound, 1);
  assert.strictEqual(state.players.length, 2);

  engine.clearTimers();
});
