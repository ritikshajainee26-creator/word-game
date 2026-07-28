const test = require('node:test');
const assert = require('node:assert');
const { io: Client } = require('socket.io-client');
const sessionManager = require('../src/server/sessionManager');
const GameEngine = require('../src/server/gameEngine');
const { server } = require('../src/server/server');

let serverUrl;
let port;

test.before(async () => {
  return new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

test('SessionManager generates and validates crypto session tokens', () => {
  const playerId = 'p1_test';
  const matchId = 'room_test_100';
  const playerName = 'Viper';

  const token = sessionManager.createSession(playerId, matchId, playerName);
  assert.strictEqual(typeof token, 'string');
  assert.ok(token.startsWith('st_p1_test_'));

  const isValid = sessionManager.validateSession(token, playerId, matchId);
  assert.strictEqual(isValid, true);

  const isInvalidToken = sessionManager.validateSession('fake_token_123', playerId, matchId);
  assert.strictEqual(isInvalidToken, false);

  const isInvalidMatch = sessionManager.validateSession(token, playerId, 'wrong_room');
  assert.strictEqual(isInvalidMatch, false);
});

test('GameEngine generates complete state snapshot and handles reconnect', () => {
  const engine = new GameEngine({
    roomId: 'room_snapshot_test',
    players: [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' }
    ],
    targetScore: 3,
    revealIntervalMs: 2000
  });

  engine.startMatch();

  // Disconnect Alice
  engine.handleDisconnect('p1');
  assert.strictEqual(engine.players[0].connected, false);

  // Reconnect Alice with new socket ID
  const reconnected = engine.handleReconnect('p1', 'new_socket_999');
  assert.strictEqual(reconnected, true);
  assert.strictEqual(engine.players[0].connected, true);
  assert.strictEqual(engine.players[0].socketId, 'new_socket_999');

  // Verify State Snapshot
  const snap = engine.getStateSnapshot();
  assert.strictEqual(snap.roomId, 'room_snapshot_test');
  assert.strictEqual(snap.status, 'in_progress');
  assert.strictEqual(snap.currentRound, 1);
  assert.strictEqual(snap.p1Name, 'Alice');
  assert.strictEqual(snap.p2Name, 'Bob');
  assert.ok(Array.isArray(snap.maskedWord));

  engine.clearTimers();
});

test('Socket.IO end-to-end player reconnection with persistent session token', async () => {
  return new Promise((resolve) => {
    const client1 = Client(serverUrl, { forceNew: true });
    const client2 = Client(serverUrl, { forceNew: true });

    let matchId = null;
    let p1Id = null;
    let p1Token = null;

    client1.on('connect', () => {
      client1.emit('join_queue', { name: 'Player One', playerId: 'p1_recon' });
    });

    client2.on('connect', () => {
      client2.emit('join_queue', { name: 'Player Two', playerId: 'p2_recon' });
    });

    client1.on('game_started', (data) => {
      matchId = data.roomId;
      p1Id = data.playerId;
      p1Token = data.sessionToken;

      assert.ok(matchId);
      assert.ok(p1Token);

      // Simulate Client 1 browser refresh / socket disconnect
      client1.disconnect();

      // Spawn new client socket representing reloaded browser tab
      setTimeout(() => {
        const reconnectedClient = Client(serverUrl, { forceNew: true });

        reconnectedClient.on('connect', () => {
          reconnectedClient.emit('request_reconnect', {
            matchId,
            playerId: p1Id,
            sessionToken: p1Token
          });
        });

        reconnectedClient.on('reconnect_success', (reconData) => {
          assert.strictEqual(reconData.matchId, matchId);
          assert.strictEqual(reconData.playerId, p1Id);
          assert.ok(reconData.stateSnapshot);
          assert.strictEqual(reconData.stateSnapshot.currentRound, 1);

          reconnectedClient.disconnect();
          client2.disconnect();
          resolve();
        });
      }, 100);
    });
  });
});
