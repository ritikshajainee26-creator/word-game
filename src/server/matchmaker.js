const GameEngine = require('./gameEngine');
const PracticeBot = require('./bot');
const db = require('./db');
const sessionManager = require('./sessionManager');

/**
 * Matchmaker managing quick match queue, private room codes, active games, and bot matches.
 */
class Matchmaker {
  /**
   * @param {Object} io - Socket.IO server instance.
   */
  constructor(io) {
    this.io = io;
    this.quickQueue = []; // [{ socketId, playerId, name }]
    this.privateRooms = new Map(); // roomCode -> { roomCode, host, guest, engine }
    this.activeMatches = new Map(); // roomId -> { engine, bot, players }
    this.socketToRoom = new Map(); // socketId -> roomId
  }

  /**
   * Handles quick match queue join request.
   */
  joinQuickQueue(socket, { name, playerId }) {
    // Clean up previous queue entries for socket
    this.leaveQuickQueue(socket);

    const player = {
      socketId: socket.id,
      playerId: playerId || socket.id,
      name: name || 'Player'
    };

    // Check if another player is waiting in queue
    if (this.quickQueue.length > 0) {
      const opponent = this.quickQueue.shift();
      
      // Ensure opponent socket is still connected
      const opponentSocket = this.io.sockets.sockets.get(opponent.socketId);
      if (!opponentSocket) {
        // Opponent disconnected, retry pairing
        return this.joinQuickQueue(socket, { name, playerId });
      }

      // Create 1v1 match room
      const roomId = `room_qm_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      this.createAndStartMatch(roomId, [opponent, player]);
    } else {
      this.quickQueue.push(player);
      socket.emit('matchmaker_status', {
        status: 'queued',
        message: 'Searching for an opponent...',
        queuePosition: this.quickQueue.length
      });
    }
  }

  /**
   * Removes socket from quick queue.
   */
  leaveQuickQueue(socket) {
    this.quickQueue = this.quickQueue.filter(p => p.socketId !== socket.id);
    socket.emit('matchmaker_status', { status: 'idle', message: 'Left queue.' });
  }

  /**
   * Creates a private room with a 6-character room code.
   */
  createPrivateRoom(socket, { name, playerId }) {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const host = {
      socketId: socket.id,
      playerId: playerId || socket.id,
      name: name || 'Host Player'
    };

    this.privateRooms.set(roomCode, {
      roomCode,
      host,
      guest: null,
      engine: null
    });

    socket.join(`private_${roomCode}`);
    socket.emit('private_room_created', {
      roomCode,
      message: `Private room created. Share code: ${roomCode}`
    });
  }

  /**
   * Joins an existing private room using room code.
   */
  joinPrivateRoom(socket, { roomCode, name, playerId }) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const room = this.privateRooms.get(cleanCode);

    if (!room) {
      socket.emit('error_message', { code: 'ROOM_NOT_FOUND', message: 'Invalid room code.' });
      return;
    }

    if (room.guest) {
      socket.emit('error_message', { code: 'ROOM_FULL', message: 'Private room is full.' });
      return;
    }

    const guest = {
      socketId: socket.id,
      playerId: playerId || socket.id,
      name: name || 'Guest Player'
    };

    room.guest = guest;
    socket.join(`private_${cleanCode}`);

    const roomId = `room_prv_${cleanCode}`;
    this.privateRooms.delete(cleanCode);

    this.createAndStartMatch(roomId, [room.host, guest]);
  }

  /**
   * Starts a practice match against an AI Practice Bot.
   */
  startBotMatch(socket, { name, playerId }) {
    this.leaveQuickQueue(socket);

    const player = {
      socketId: socket.id,
      playerId: playerId || socket.id,
      name: name || 'Player'
    };

    const bot = new PracticeBot('BOT_OPPONENT', 'Bot Master 🤖');
    const botPlayer = {
      socketId: 'BOT_SOCKET',
      playerId: bot.id,
      name: bot.name
    };

    const roomId = `room_bot_${Date.now()}`;
    const matchData = this.createAndStartMatch(roomId, [player, botPlayer], bot);
    bot.setEngine(matchData.engine);
  }

  /**
   * Instantiates GameEngine, joins socket room, and binds events.
   */
  createAndStartMatch(roomId, players, botInstance = null) {
    players.forEach(p => {
      const sock = this.io.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.join(roomId);
        this.socketToRoom.set(p.socketId, roomId);
      }
    });

    const engine = new GameEngine({
      roomId,
      players: players.map(p => ({
        id: p.playerId,
        name: p.name,
        socketId: p.socketId
      })),
      targetScore: 3,
      revealIntervalMs: 15000,
      graceWindowMs: 300,
      onEvent: (event, data) => this.handleEngineEvent(roomId, event, data)
    });

    const matchInfo = { engine, bot: botInstance, players, roomId };
    this.activeMatches.set(roomId, matchInfo);

    // Generate persistent session tokens for human players
    players.forEach(p => {
      p.sessionToken = sessionManager.createSession(p.playerId, roomId, p.name);
      const sock = this.io.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.emit('game_started', {
          roomId,
          playerId: p.playerId,
          sessionToken: p.sessionToken,
          players: players.map(pl => ({ id: pl.playerId, name: pl.name }))
        });
      }
    });

    // Start engine match
    engine.startMatch();

    return matchInfo;
  }

  /**
   * Relays GameEngine events to room sockets and AI bot instance.
   */
  handleEngineEvent(roomId, event, data) {
    const match = this.activeMatches.get(roomId);

    // Broadcast event to WebSocket room
    this.io.to(roomId).emit(event, data);

    // If bot is playing, relay round events to bot instance
    if (match && match.bot) {
      if (event === 'round_start') match.bot.onRoundStart(data);
      if (event === 'letter_revealed') match.bot.onLetterRevealed(data);
      if (event === 'match_end') match.bot.reset();
    }

    // Save match results & clean up room on match end
    if (event === 'match_end') {
      if (match && match.engine) {
        db.saveMatchResult({
          matchId: roomId,
          roomId,
          player1Name: match.players[0] ? match.players[0].name : 'Player 1',
          player2Name: match.players[1] ? match.players[1].name : 'Player 2',
          winnerName: data.winnerName,
          player1Score: match.engine.players[0] ? match.engine.players[0].score : 0,
          player2Score: match.engine.players[1] ? match.engine.players[1].score : 0,
          roundsPlayed: match.engine.currentRound,
          endReason: data.reason
        }).catch(err => console.error('Error saving match result:', err));
      }

      setTimeout(() => {
        this.activeMatches.delete(roomId);
      }, 5000);
    }
  }

  /**
   * Reconnects a player socket to an active match room.
   */
  reconnectPlayer(socket, { matchId, playerId, sessionToken }) {
    if (!matchId || !playerId) {
      socket.emit('error_message', { code: 'INVALID_RECONNECT', message: 'Missing reconnect credentials.' });
      return false;
    }

    const isValidSession = sessionManager.validateSession(sessionToken, playerId, matchId);
    const match = this.activeMatches.get(matchId);

    if (!match || !match.engine) {
      socket.emit('error_message', { code: 'MATCH_EXPIRED', message: 'Active match expired or concluded.' });
      return false;
    }

    if (!isValidSession) {
      socket.emit('error_message', { code: 'INVALID_SESSION', message: 'Reconnection session invalid or expired.' });
      return false;
    }

    // Re-bind socket to room and engine
    socket.join(matchId);
    this.socketToRoom.set(socket.id, matchId);

    // Update socket mapping in player record
    const playerRecord = match.players.find(p => p.playerId === playerId);
    if (playerRecord) {
      playerRecord.socketId = socket.id;
    }

    // Resume engine timer & retrieve state snapshot
    match.engine.handleReconnect(playerId, socket.id);
    const stateSnapshot = match.engine.getStateSnapshot();

    // Send reconnect_success event to reconnected socket
    socket.emit('reconnect_success', {
      matchId,
      playerId,
      sessionToken,
      stateSnapshot
    });

    return true;
  }

  /**
   * Helper to fetch active match for a socket.
   */
  getMatchBySocket(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    return this.activeMatches.get(roomId);
  }

  /**
   * Handles player socket disconnection.
   */
  handleDisconnect(socket) {
    this.leaveQuickQueue(socket);

    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      const match = this.activeMatches.get(roomId);
      if (match && match.engine) {
        // Find player ID for this socket
        const player = match.players.find(p => p.socketId === socket.id);
        if (player) {
          match.engine.handleDisconnect(player.playerId);
        }
      }
      this.socketToRoom.delete(socket.id);
    }
  }
}

module.exports = Matchmaker;
