const Matchmaker = require('./matchmaker');

/**
 * Socket.IO event handler wiring client messages to Matchmaker & GameEngine.
 */
function setupSocketHandler(io) {
  const matchmaker = new Matchmaker(io);

  io.on('connection', (socket) => {
    // 1. Queue & Room Management
    socket.on('join_queue', (data = {}) => {
      if (data.name) socket.playerName = data.name.trim();
      matchmaker.joinQuickQueue(socket, data);
    });

    socket.on('leave_queue', () => {
      matchmaker.leaveQuickQueue(socket);
    });

    socket.on('create_private_room', (data = {}) => {
      if (data.name) socket.playerName = data.name.trim();
      matchmaker.createPrivateRoom(socket, data);
    });

    socket.on('join_private_room', (data = {}) => {
      if (data.name) socket.playerName = data.name.trim();
      matchmaker.joinPrivateRoom(socket, data);
    });

    socket.on('start_bot_match', (data = {}) => {
      if (data.name) socket.playerName = data.name.trim();
      matchmaker.startBotMatch(socket, data);
    });

    socket.on('request_reconnect', (data = {}) => {
      matchmaker.reconnectPlayer(socket, data);
    });

    // Private User Match History Authorization
    socket.on('get_match_history', async (data = {}) => {
      const requestedName = (data.playerName || '').trim();
      const sessionName = socket.playerName || requestedName;

      // Privacy Check: Block retrieving another user's match history
      if (requestedName && sessionName && requestedName.toLowerCase() !== sessionName.toLowerCase()) {
        socket.emit('error_message', {
          code: 'UNAUTHORIZED_HISTORY_ACCESS',
          message: 'Privacy Violation: You are not authorized to view another player’s match history.'
        });
        return;
      }

      const db = require('./db');
      const targetName = sessionName || requestedName;
      const history = targetName ? await db.getUserMatchHistory(targetName) : [];
      
      socket.emit('match_history_data', {
        playerName: targetName,
        history
      });
    });

    // 2. Gameplay Events
    socket.on('submit_guess', (data = {}) => {
      const match = matchmaker.getMatchBySocket(socket.id);
      if (!match || !match.engine) {
        socket.emit('guess_result', { success: false, reason: 'NO_ACTIVE_MATCH' });
        return;
      }

      const player = match.players.find(p => p.socketId === socket.id);
      const playerId = player ? player.playerId : (data.playerId || socket.id);

      const result = match.engine.submitGuess(playerId, data.guess);
      socket.emit('guess_result', result);
    });

    socket.on('send_reaction', (data = {}) => {
      const match = matchmaker.getMatchBySocket(socket.id);
      if (match) {
        const player = match.players.find(p => p.socketId === socket.id);
        io.to(match.roomId).emit('player_reaction', {
          socketId: socket.id,
          playerName: player ? player.name : 'Player',
          emoji: data.emoji || '👍'
        });
      }
    });

    // 3. Disconnect Handling
    socket.on('disconnect', () => {
      matchmaker.handleDisconnect(socket);
    });
  });

  return matchmaker;
}

module.exports = setupSocketHandler;
