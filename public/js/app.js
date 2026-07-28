/**
 * Word Clash Client Single Page Application (SPA) Logic.
 * Handles UI screen routing, Socket.IO real-time events, DOM state updates,
 * interval timer ring animation, and interactive game loops.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Socket.IO Client Connection
  const socket = io();

  // Local State
  let myPlayerId = localStorage.getItem('word_game_player_id');
  if (!myPlayerId) {
    myPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('word_game_player_id', myPlayerId);
  }
  
  let myPlayerName = localStorage.getItem('word_game_player_name') || '';
  let currentRoomId = null;
  let opponentName = 'Opponent';
  let revealIntervalMs = 15000;
  let timerInterval = null;
  let timerRemainingMs = 15000;
  let intervalIndex = 0;
  let wordLength = 0;
  let currentMaskedWord = [];
  let isGuessSubmittedThisInterval = false;

  // DOM Elements
  const elements = {
    // Screens
    lobbyScreen: document.getElementById('lobbyScreen'),
    matchmakingScreen: document.getElementById('matchmakingScreen'),
    arenaScreen: document.getElementById('arenaScreen'),
    
    // Inputs & Buttons
    playerNameInput: document.getElementById('playerNameInput'),
    nameErrorMsg: document.getElementById('nameErrorMsg'),
    btnQuickMatch: document.getElementById('btnQuickMatch'),
    btnPrivateRoom: document.getElementById('btnPrivateRoom'),
    btnPracticeBot: document.getElementById('btnPracticeBot'),
    btnCancelMatchmaking: document.getElementById('btnCancelMatchmaking'),
    btnSwitchToBot: document.getElementById('btnSwitchToBot'),
    soundToggle: document.getElementById('soundToggle'),
    soundIcon: document.getElementById('soundIcon'),
    networkStatus: document.getElementById('networkStatus'),
    
    // Match History & Stats
    statMatches: document.getElementById('statMatches'),
    statWins: document.getElementById('statWins'),
    statLosses: document.getElementById('statLosses'),
    statDraws: document.getElementById('statDraws'),
    statWinRate: document.getElementById('statWinRate'),
    historyList: document.getElementById('historyList'),
    btnClearHistory: document.getElementById('btnClearHistory'),
    
    // Private Room Modal
    privateRoomModal: document.getElementById('privateRoomModal'),
    btnClosePrivateModal: document.getElementById('btnClosePrivateModal'),
    tabCreateRoom: document.getElementById('tabCreateRoom'),
    tabJoinRoom: document.getElementById('tabJoinRoom'),
    createRoomContent: document.getElementById('createRoomContent'),
    joinRoomContent: document.getElementById('joinRoomContent'),
    btnConfirmCreateRoom: document.getElementById('btnConfirmCreateRoom'),
    roomCodeDisplay: document.getElementById('roomCodeDisplay'),
    generatedRoomCode: document.getElementById('generatedRoomCode'),
    joinRoomCodeInput: document.getElementById('joinRoomCodeInput'),
    btnConfirmJoinRoom: document.getElementById('btnConfirmJoinRoom'),

    // Matchmaking
    matchmakingStatusText: document.getElementById('matchmakingStatusText'),
    matchmakingTimer: document.getElementById('matchmakingTimer'),

    // Scoreboard
    p1Name: document.getElementById('p1Name'),
    p1Score: document.getElementById('p1Score'),
    p2Name: document.getElementById('p2Name'),
    p2Score: document.getElementById('p2Score'),
    roundIndicator: document.getElementById('roundIndicator'),
    targetIndicator: document.getElementById('targetIndicator'),

    // Arena & Timer
    timerProgress: document.getElementById('timerProgress'),
    timerSeconds: document.getElementById('timerSeconds'),
    wordTilesContainer: document.getElementById('wordTilesContainer'),
    guessInput: document.getElementById('guessInput'),
    btnSubmitGuess: document.getElementById('btnSubmitGuess'),
    intervalStatus: document.getElementById('intervalStatus'),
    intervalStatusText: document.getElementById('intervalStatusText'),
    matchLog: document.getElementById('matchLog'),
    disconnectBanner: document.getElementById('disconnectBanner'),
    disconnectMessage: document.getElementById('disconnectMessage'),

    // Result Modal
    resultModal: document.getElementById('resultModal'),
    resultIcon: document.getElementById('resultIcon'),
    resultTitle: document.getElementById('resultTitle'),
    resultWord: document.getElementById('resultWord'),
    targetWordHighlight: document.getElementById('targetWordHighlight'),
    resultSummary: document.getElementById('resultSummary'),
    finalScoresContainer: document.getElementById('finalScoresContainer'),
    btnNextRound: document.getElementById('btnNextRound'),
    btnReturnLobby: document.getElementById('btnReturnLobby')
  };

  // --- 1. NAVIGATION & SCREEN SWITCHING ---
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (elements[screenId]) {
      elements[screenId].classList.add('active');
    }
  }

  // Populate saved player name if available
  if (myPlayerName && elements.playerNameInput) {
    elements.playerNameInput.value = myPlayerName;
  }

  function validateAndGetPlayerName() {
    const val = (elements.playerNameInput.value || '').trim();
    if (!val) {
      elements.playerNameInput.classList.add('input-error');
      elements.nameErrorMsg.classList.remove('hidden');
      elements.playerNameInput.focus();
      return null;
    }
    elements.playerNameInput.classList.remove('input-error');
    elements.nameErrorMsg.classList.add('hidden');
    myPlayerName = val;
    localStorage.setItem('word_game_player_name', val);
    return myPlayerName;
  }

  // --- 2. SOCKET EVENT LISTENERS ---
  socket.on('connect', () => {
    elements.networkStatus.querySelector('.status-dot').className = 'status-dot online';
    elements.networkStatus.querySelector('.status-text').innerText = 'Connected';
    
    // Request player's match history on connection
    socket.emit('get_match_history', { playerId: myPlayerId });
  });

  socket.on('disconnect', () => {
    elements.networkStatus.querySelector('.status-dot').className = 'status-dot';
    elements.networkStatus.querySelector('.status-text').innerText = 'Reconnecting...';
  });

  socket.on('matchmaker_status', (data) => {
    if (data.status === 'queued') {
      showScreen('matchmakingScreen');
      startMatchmakingTimer();
    }
  });

  socket.on('private_room_created', (data) => {
    elements.generatedRoomCode.innerText = data.roomCode;
    elements.roomCodeDisplay.classList.remove('hidden');
  });

  socket.on('game_started', (data) => {
    stopMatchmakingTimer();
    currentRoomId = data.roomId;
    
    // Determine player names
    const me = data.players.find(p => p.id === myPlayerId);
    const opponent = data.players.find(p => p.id !== myPlayerId);

    elements.p1Name.innerText = me ? me.name : myPlayerName;
    elements.p2Name.innerText = opponent ? opponent.name : 'Opponent';
    opponentName = opponent ? opponent.name : 'Opponent';

    elements.p1Score.innerText = '0';
    elements.p2Score.innerText = '0';

    elements.privateRoomModal.classList.add('hidden');
    elements.resultModal.classList.add('hidden');
    elements.disconnectBanner.classList.add('hidden');

    showScreen('arenaScreen');
    addLog(`Match started against ${opponentName}! First to 3 wins.`, 'system');
  });

  socket.on('round_start', (data) => {
    elements.resultModal.classList.add('hidden');
    elements.roundIndicator.innerText = `ROUND ${data.roundNumber}`;
    revealIntervalMs = data.revealIntervalMs || 15000;
    wordLength = data.wordLength;
    currentMaskedWord = [...data.maskedWord];
    intervalIndex = 0;
    isGuessSubmittedThisInterval = false;

    // Reset Scores
    if (data.scores) {
      elements.p1Score.innerText = data.scores[myPlayerId] ?? '0';
      const oppId = Object.keys(data.scores).find(id => id !== myPlayerId);
      elements.p2Score.innerText = oppId ? data.scores[oppId] : '0';
    }

    renderTiles(currentMaskedWord);
    resetIntervalGuessStatus();
    startIntervalCountdown(revealIntervalMs);
    addLog(`Round ${data.roundNumber} started! Target length: ${wordLength} letters.`, 'system');
  });

  socket.on('letter_revealed', (data) => {
    intervalIndex = data.intervalIndex;
    currentMaskedWord = [...data.maskedWord];
    
    // Update tile at index with 3D flip animation
    updateTile(data.index, data.letter);
    if (window.soundFx) window.soundFx.playLetterReveal();

    // Reset single guess allowance for the new interval
    resetIntervalGuessStatus();
    startIntervalCountdown(revealIntervalMs);

    addLog(`Letter revealed at position ${data.index + 1}: "${data.letter}"`, 'system');
  });

  socket.on('guess_result', (data) => {
    if (!data.success) {
      if (data.reason === 'ALREADY_GUESSED_THIS_INTERVAL') {
        elements.intervalStatus.classList.add('spent');
        elements.intervalStatusText.innerText = '⚠️ You already submitted a guess for this letter tick!';
      } else if (data.reason === 'INVALID_LENGTH') {
        elements.intervalStatusText.innerText = `⚠️ Word must be exactly ${data.expectedLength} letters!`;
      }
      if (window.soundFx) window.soundFx.playWrongGuess();
    }
  });

  socket.on('guess_attempt', (data) => {
    const isMe = data.playerId === myPlayerId;
    const author = isMe ? 'You' : data.playerName;

    if (data.isCorrect) {
      if (window.soundFx) window.soundFx.playCorrectGuess();
      addLog(`🎯 ${author} guessed "${data.guess}" correctly!`, 'correct');
    } else {
      if (isMe && window.soundFx) window.soundFx.playWrongGuess();
      addLog(`❌ ${author} guessed "${data.guess}" (Incorrect)`, 'wrong');
    }
  });

  socket.on('round_end', (data) => {
    stopIntervalCountdown();
    const isDraw = data.isDraw;
    const isWinner = data.winnerId === myPlayerId;

    if (data.scores) {
      elements.p1Score.innerText = data.scores[myPlayerId] ?? '0';
      const oppId = Object.keys(data.scores).find(id => id !== myPlayerId);
      elements.p2Score.innerText = oppId ? data.scores[oppId] : '0';
    }

    elements.targetWordHighlight.innerText = data.word;
    elements.resultSummary.innerText = data.summary;

    if (isDraw) {
      elements.resultIcon.innerText = '⚖️';
      elements.resultTitle.innerText = 'ROUND DRAW!';
    } else if (isWinner) {
      elements.resultIcon.innerText = '🏆';
      elements.resultTitle.innerText = 'YOU WON THE ROUND!';
      if (window.soundFx) window.soundFx.playRoundWin();
    } else if (data.winnerId) {
      elements.resultIcon.innerText = '💔';
      elements.resultTitle.innerText = 'OPPONENT WON ROUND';
    } else {
      elements.resultIcon.innerText = '⌛';
      elements.resultTitle.innerText = 'TIME EXPIRED (NO WINNER)';
    }

    elements.btnNextRound.classList.remove('hidden');
    elements.btnReturnLobby.classList.add('hidden');
    elements.resultModal.classList.remove('hidden');
  });

  socket.on('match_end', (data) => {
    stopIntervalCountdown();
    const isWinner = data.winnerId === myPlayerId;

    elements.resultTitle.innerText = isWinner ? '🎉 MATCH VICTORY!' : 'GAME OVER';
    elements.resultIcon.innerText = isWinner ? '👑' : '🏁';
    elements.resultSummary.innerText = `Final Result: ${data.reason === 'WIN_BY_FORFEIT' ? 'Victory by Opponent Forfeit!' : 'Match Target Score Reached.'}`;

    elements.btnNextRound.classList.add('hidden');
    elements.btnReturnLobby.classList.remove('hidden');
    elements.resultModal.classList.remove('hidden');

    // Fetch updated match history after match ends
    setTimeout(() => {
      socket.emit('get_match_history', { playerId: myPlayerId });
    }, 1000);
  });

  socket.on('match_history_updated', (data) => {
    renderHistoryUI(data);
  });

  function renderHistoryUI(data = {}) {
    const stats = data.stats || { totalMatches: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
    const history = data.history || [];

    if (elements.statMatches) elements.statMatches.innerText = stats.totalMatches;
    if (elements.statWins) elements.statWins.innerText = stats.wins;
    if (elements.statLosses) elements.statLosses.innerText = stats.losses;
    if (elements.statDraws) elements.statDraws.innerText = stats.draws;
    if (elements.statWinRate) elements.statWinRate.innerText = `${stats.winRate}%`;

    if (!elements.historyList) return;

    if (history.length === 0) {
      elements.historyList.innerHTML = '<div class="history-empty">No matches played yet. Start a match to track your history!</div>';
      return;
    }

    elements.historyList.innerHTML = '';
    history.forEach(item => {
      const row = document.createElement('div');
      row.className = 'history-item';
      
      const badgeClass = item.result === 'WIN' ? 'win' : item.result === 'LOSS' ? 'loss' : 'draw';
      const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      row.innerHTML = `
        <div class="history-info">
          <span class="result-badge ${badgeClass}">${item.result}</span>
          <span class="history-opponent">vs ${item.opponentName || 'Opponent'}</span>
          <span class="history-score">${item.myScore} - ${item.opponentScore}</span>
        </div>
        <div class="history-meta">
          <span>${item.gameMode || 'Match'}</span>
          <span>${timeStr}</span>
        </div>
      `;
      elements.historyList.appendChild(row);
    });
  }

  socket.on('player_disconnected', (data) => {
    if (data.playerId !== myPlayerId) {
      elements.disconnectMessage.innerText = `⚠️ ${data.playerName} disconnected. Grace period: ${data.gracePeriodSeconds}s`;
      elements.disconnectBanner.classList.remove('hidden');
    }
  });

  socket.on('player_reconnected', (data) => {
    if (data.playerId !== myPlayerId) {
      elements.disconnectBanner.classList.add('hidden');
      addLog(`⚡ ${data.playerName} reconnected! Resuming game.`, 'system');
    }
  });

  socket.on('player_reaction', (data) => {
    const isMe = data.socketId === socket.id;
    addLog(`${data.emoji} ${isMe ? 'You' : data.playerName} reacted!`, 'reaction');
  });

  socket.on('error_message', (data) => {
    alert(data.message || 'Error occurred.');
  });

  // --- 3. GAMEPLAY ACTIONS & EVENT HANDLERS ---
  function submitGuess() {
    if (isGuessSubmittedThisInterval) return;
    const guessVal = (elements.guessInput.value || '').trim();
    if (!guessVal) return;

    isGuessSubmittedThisInterval = true;
    elements.guessInput.disabled = true;
    elements.btnSubmitGuess.disabled = true;
    elements.intervalStatus.classList.add('spent');
    elements.intervalStatusText.innerText = '🔒 Guess submitted for this letter tick. Waiting for next tick...';

    socket.emit('submit_guess', {
      playerId: myPlayerId,
      guess: guessVal
    });

    elements.guessInput.value = '';
  }

  function resetIntervalGuessStatus() {
    isGuessSubmittedThisInterval = false;
    elements.guessInput.disabled = false;
    elements.btnSubmitGuess.disabled = false;
    elements.intervalStatus.classList.remove('spent');
    elements.intervalStatusText.innerText = '💡 1 guess available for this letter tick!';
    elements.guessInput.focus();
  }

  // --- 4. TILE RENDERING & ANIMATION ---
  function renderTiles(maskedArray) {
    elements.wordTilesContainer.innerHTML = '';
    maskedArray.forEach((char, idx) => {
      const tile = document.createElement('div');
      tile.className = `tile ${char !== '_' ? 'revealed' : ''}`;
      tile.id = `tile_${idx}`;
      tile.innerText = char !== '_' ? char : '?';
      elements.wordTilesContainer.appendChild(tile);
    });
  }

  function updateTile(index, char) {
    const tile = document.getElementById(`tile_${index}`);
    if (tile) {
      tile.className = 'tile revealed';
      tile.innerText = char;
    }
  }

  // --- 5. TIMER PROGRESS RING ---
  function startIntervalCountdown(durationMs) {
    stopIntervalCountdown();
    timerRemainingMs = durationMs;
    const startTime = Date.now();
    const circumference = 276.46; // 2 * PI * 44

    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, durationMs - elapsed);
      const progressRatio = remaining / durationMs;
      
      const offset = circumference * (1 - progressRatio);
      elements.timerProgress.style.strokeDashoffset = offset;
      elements.timerSeconds.innerText = (remaining / 1000).toFixed(1);

      if (remaining <= 0) {
        stopIntervalCountdown();
      }
    }, 50);
  }

  function stopIntervalCountdown() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // --- 6. MATCHMAKING TIMER ---
  let matchmakingTimerInterval = null;
  let matchmakingSeconds = 0;

  function startMatchmakingTimer() {
    matchmakingSeconds = 0;
    if (matchmakingTimerInterval) clearInterval(matchmakingTimerInterval);
    matchmakingTimerInterval = setInterval(() => {
      matchmakingSeconds++;
      const mins = String(Math.floor(matchmakingSeconds / 60)).padStart(2, '0');
      const secs = String(matchmakingSeconds % 60).padStart(2, '0');
      elements.matchmakingTimer.innerText = `${mins}:${secs}`;
    }, 1000);
  }

  function stopMatchmakingTimer() {
    if (matchmakingTimerInterval) {
      clearInterval(matchmakingTimerInterval);
      matchmakingTimerInterval = null;
    }
  }

  // --- 7. MATCH LOG UTILITY ---
  function addLog(message, type = 'system') {
    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.innerText = message;
    elements.matchLog.appendChild(item);
    elements.matchLog.scrollTop = elements.matchLog.scrollHeight;
  }

  // --- 8. DOM EVENT BINDINGS ---
  elements.playerNameInput.addEventListener('input', () => {
    if (elements.playerNameInput.value.trim().length > 0) {
      elements.playerNameInput.classList.remove('input-error');
      elements.nameErrorMsg.classList.add('hidden');
    }
  });

  elements.btnQuickMatch.addEventListener('click', () => {
    const name = validateAndGetPlayerName();
    if (!name) return;
    socket.emit('join_queue', { name, playerId: myPlayerId });
  });

  elements.btnPracticeBot.addEventListener('click', () => {
    const name = validateAndGetPlayerName();
    if (!name) return;
    socket.emit('start_bot_match', { name, playerId: myPlayerId });
  });

  elements.btnSwitchToBot.addEventListener('click', () => {
    stopMatchmakingTimer();
    const name = validateAndGetPlayerName() || 'Player';
    socket.emit('start_bot_match', { name, playerId: myPlayerId });
  });

  elements.btnCancelMatchmaking.addEventListener('click', () => {
    stopMatchmakingTimer();
    socket.emit('leave_queue');
    showScreen('lobbyScreen');
  });

  elements.btnSubmitGuess.addEventListener('click', submitGuess);
  elements.guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitGuess();
  });

  // Clear History
  if (elements.btnClearHistory) {
    elements.btnClearHistory.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your match history?')) {
        socket.emit('clear_match_history', { playerId: myPlayerId });
      }
    });
  }

  // Sound Toggle
  elements.soundToggle.addEventListener('click', () => {
    if (window.soundFx) {
      const isEnabled = window.soundFx.toggle();
      elements.soundIcon.innerText = isEnabled ? '🔊' : '🔇';
    }
  });

  // Private Room Setup Modal
  elements.btnPrivateRoom.addEventListener('click', () => {
    const name = validateAndGetPlayerName();
    if (!name) return;
    elements.privateRoomModal.classList.remove('hidden');
  });
  elements.btnClosePrivateModal.addEventListener('click', () => {
    elements.privateRoomModal.classList.add('hidden');
  });

  elements.tabCreateRoom.addEventListener('click', () => {
    elements.tabCreateRoom.classList.add('active');
    elements.tabJoinRoom.classList.remove('active');
    elements.createRoomContent.classList.remove('hidden');
    elements.joinRoomContent.classList.add('hidden');
  });

  elements.tabJoinRoom.addEventListener('click', () => {
    elements.tabJoinRoom.classList.add('active');
    elements.tabCreateRoom.classList.remove('active');
    elements.joinRoomContent.classList.remove('hidden');
    elements.createRoomContent.classList.add('hidden');
  });

  elements.btnConfirmCreateRoom.addEventListener('click', () => {
    const name = validateAndGetPlayerName();
    if (!name) return;
    socket.emit('create_private_room', { name, playerId: myPlayerId });
  });

  elements.btnConfirmJoinRoom.addEventListener('click', () => {
    const name = validateAndGetPlayerName();
    if (!name) return;
    const code = (elements.joinRoomCodeInput.value || '').trim();
    if (code) {
      socket.emit('join_private_room', { roomCode: code, name, playerId: myPlayerId });
    }
  });

  // Reactions
  document.querySelectorAll('.btn-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      socket.emit('send_reaction', { emoji });
    });
  });

  // Result Actions
  elements.btnNextRound.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
  });

  elements.btnReturnLobby.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    showScreen('lobbyScreen');
  });
});
