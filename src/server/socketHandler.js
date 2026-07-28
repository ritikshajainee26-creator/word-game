const Matchmaker = require('./matchmaker');

/**
 * Socket.IO event handler wiring client messages to Matchmaker & GameEngine.
 */
function setupSocketHandler(io) {
  const matchmaker = new Matchmaker(io);

  io.on('connection', (socket) => {
    // 1. Queue & Room Management
    socket.on('join_queue', (data = {}) => {
      matchmaker.joinQuickQueue(socket, data);
    });

    socket.on('leave_queue', () => {
      matchmaker.leaveQuickQueue(socket);
    });

    socket.on('create_private_room', (data = {}) => {
      matchmaker.createPrivateRoom(socket, data);
    });

    socket.on('join_private_room', (data = {}) => {
      matchmaker.joinPrivateRoom(socket, data);
    });

    socket.on('start_bot_match', (data = {}) => {
      matchmaker.startBotMatch(socket, data);
    });

    socket.on('get_match_history', async (data = {}) => {
      const db = require('./db');
      const history = await db.getUserMatchHistory(data.playerName);
      socket.emit('match_history_data', {
        playerName: data.playerName,
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
