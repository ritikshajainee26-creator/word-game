const test = require('node:test');
const assert = require('node:assert');
const { io: Client } = require('socket.io-client');
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

test('Socket.IO Quick Match pairing between two players', async () => {
  return new Promise((resolve) => {
    const client1 = Client(serverUrl, { forceNew: true });
    const client2 = Client(serverUrl, { forceNew: true });

    let client1Started = false;
    let client2Started = false;

    const checkDone = () => {
      if (client1Started && client2Started) {
        client1.disconnect();
        client2.disconnect();
        resolve();
      }
    };

    client1.on('connect', () => {
      client1.emit('join_queue', { name: 'Player One', playerId: 'p1' });
    });

    client2.on('connect', () => {
      client2.emit('join_queue', { name: 'Player Two', playerId: 'p2' });
    });

    client1.on('game_started', (data) => {
      assert.strictEqual(data.players.length, 2);
      client1Started = true;
      checkDone();
    });

    client2.on('game_started', (data) => {
      assert.strictEqual(data.players.length, 2);
      client2Started = true;
      checkDone();
    });
  });
});

test('Socket.IO Practice Bot Match start and event loop', async () => {
  return new Promise((resolve) => {
    const client = Client(serverUrl, { forceNew: true });

    client.on('connect', () => {
      client.emit('start_bot_match', { name: 'Solo Player', playerId: 'solo_1' });
    });

    client.on('game_started', (data) => {
      assert.strictEqual(data.players.length, 2);
      const botPlayer = data.players.find(p => p.id === 'BOT_OPPONENT');
      assert.ok(botPlayer);
    });

    client.on('round_start', (data) => {
      assert.strictEqual(data.roundNumber, 1);
      assert.ok(data.wordLength > 0);
      client.disconnect();
      resolve();
    });
  });
});
