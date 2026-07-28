/**
 * Word Clash Client Single Page Application (SPA) Logic.
 * Handles UI screen routing, Socket.IO real-time events, DOM state updates,
 * interval timer ring animation, and interactive game loops.
 */
document.addEventListener('DOMContentLoaded', () => {
  // Socket.IO Client Connection
  const socket = io();

  // Local State & Persistent Session IDs
  let storedPlayerId = null;
  try {
    storedPlayerId = localStorage.getItem('word_clash_player_id');
    if (!storedPlayerId) {
      storedPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('word_clash_player_id', storedPlayerId);
    }
  } catch (e) {
    storedPlayerId = 'p_' + Math.random().toString(36).substring(2, 9);
  }

  let myPlayerId = storedPlayerId;
  let myPlayerName = '';
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
    btnReturnLobby: document.getElementById('btnReturnLobby'),

    // History Modal
    btnOpenHistory: document.getElementById('btnOpenHistory'),
    historyModal: document.getElementById('historyModal'),
    btnCloseHistoryModal: document.getElementById('btnCloseHistoryModal'),
    historyPlayerName: document.getElementById('historyPlayerName'),
    historyListContainer: document.getElementById('historyListContainer')
  };

  // --- 1. NAVIGATION & SCREEN SWITCHING ---
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (elements[screenId]) {
      elements[screenId].classList.add('active');
    }
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
    try {
      localStorage.setItem('word_clash_player_name', val);
    } catch (e) {}
    return myPlayerName;
  }

  // Restore saved player name from localStorage on page load
  try {
    const savedName = localStorage.getItem('word_clash_player_name');
    if (savedName) {
      elements.playerNameInput.value = savedName;
      myPlayerName = savedName;
    }
  } catch (e) {}

  // --- 2. SOCKET EVENT LISTENERS ---
  socket.on('connect', () => {
    elements.networkStatus.querySelector('.status-dot').className = 'status-dot online';
    elements.networkStatus.querySelector('.status-text').innerText = 'Connected';

    // Auto-reconnect to active match on browser refresh or socket reconnect
    try {
      const activeMatchId = localStorage.getItem('word_clash_match_id');
      const savedPlayerId = localStorage.getItem('word_clash_player_id') || myPlayerId;
      const savedToken = localStorage.getItem('word_clash_session_token');

      if (activeMatchId && savedPlayerId && savedToken) {
        socket.emit('request_reconnect', {
          matchId: activeMatchId,
          playerId: savedPlayerId,
          sessionToken: savedToken
        });
      }
    } catch (e) {}
  });

  socket.on('disconnect', () => {
    elements.networkStatus.querySelector('.status-dot').className = 'status-dot';
    elements.networkStatus.querySelector('.status-text').innerText = 'Reconnecting...';
  });

  socket.on('reconnect_success', (data) => {
    stopMatchmakingTimer();
    currentRoomId = data.matchId;
    const snap = data.stateSnapshot;

    // Persist active match tokens
    try {
      localStorage.setItem('word_clash_match_id', data.matchId);
      if (data.sessionToken) localStorage.setItem('word_clash_session_token', data.sessionToken);
    } catch (e) {}

    // Restore player UI
    if (snap.players) {
      const me = snap.players.find(p => p.id === myPlayerId);
      const opponent = snap.players.find(p => p.id !== myPlayerId);
      elements.p1Name.innerText = me ? me.name : snap.p1Name;
      elements.p2Name.innerText = opponent ? opponent.name : snap.p2Name;
      if (snap.scores) {
        elements.p1Score.innerText = snap.scores[myPlayerId] ?? '0';
        const oppId = Object.keys(snap.scores).find(id => id !== myPlayerId);
        elements.p2Score.innerText = oppId ? snap.scores[oppId] : '0';
      }
    }

    elements.roundIndicator.innerText = `ROUND ${snap.currentRound}`;
    revealIntervalMs = snap.revealIntervalMs || 15000;
    currentMaskedWord = [...snap.maskedWord];
    intervalIndex = snap.intervalIndex;

    renderTiles(currentMaskedWord);
    resetIntervalGuessStatus();
    if (snap.status === 'in_progress') {
      startIntervalCountdown(revealIntervalMs);
    }

    elements.privateRoomModal.classList.add('hidden');
    elements.resultModal.classList.add('hidden');
    elements.disconnectBanner.classList.add('hidden');
    showScreen('arenaScreen');

    addLog('⚡ Reconnected to active match! Game state restored.', 'system');
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
    if (data.playerId) myPlayerId = data.playerId;
    
    // Persist active match session tokens
    try {
      localStorage.setItem('word_clash_match_id', data.roomId);
      localStorage.setItem('word_clash_player_id', myPlayerId);
      if (data.sessionToken) localStorage.setItem('word_clash_session_token', data.sessionToken);
    } catch (e) {}

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

    // Clear active match session tokens
    try {
      localStorage.removeItem('word_clash_match_id');
      localStorage.removeItem('word_clash_session_token');
    } catch (e) {}

    elements.resultTitle.innerText = isWinner ? '🎉 MATCH VICTORY!' : 'GAME OVER';
    elements.resultIcon.innerText = isWinner ? '👑' : '🏁';
    elements.resultSummary.innerText = `Final Result: ${data.reason === 'WIN_BY_FORFEIT' ? 'Victory by Opponent Forfeit!' : 'Match Target Score Reached.'}`;

    elements.btnNextRound.classList.add('hidden');
    elements.btnReturnLobby.classList.remove('hidden');
    elements.resultModal.classList.remove('hidden');
  });

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

  socket.on('match_history_data', (data) => {
    renderMatchHistory(data.playerName, data.history || []);
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

  // --- 9. MATCH HISTORY RENDERER & FETCH ---
  async function fetchAndDisplayHistory() {
    const name = validateAndGetPlayerName();
    if (!name) return;
    
    elements.historyPlayerName.innerText = name;
    elements.historyListContainer.innerHTML = '<div class="history-empty">Fetching your match history...</div>';
    elements.historyModal.classList.remove('hidden');

    // 1. Try REST API endpoint
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          renderMatchHistory(name, data.history);
          return;
        }
      }
    } catch (err) {
      console.warn('REST API history fetch fallback to socket:', err.message);
    }

    // 2. Socket event fallback
    socket.emit('get_match_history', { playerName: name });
  }

  function renderMatchHistory(playerName, history) {
    elements.historyPlayerName.innerText = playerName;
    elements.historyListContainer.innerHTML = '';

    if (!history || history.length === 0) {
      elements.historyListContainer.innerHTML = `<div class="history-empty">No match history records found for "${playerName}". Play a match to build your history!</div>`;
      return;
    }

    history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      
      const badgeClass = item.result === 'WIN' ? 'badge-win' : item.result === 'LOSS' ? 'badge-loss' : 'badge-draw';
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent';

      el.innerHTML = `
        <div class="history-info">
          <span class="history-opp">vs ${item.opponentName}</span>
          <span class="history-date">${dateStr}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="history-score">${item.playerScore} - ${item.opponentScore}</span>
          <span class="badge ${badgeClass}">${item.result}</span>
        </div>
      `;
      elements.historyListContainer.appendChild(el);
    });
  }

  // --- 10. DOM EVENT BINDINGS ---
  elements.btnOpenHistory.addEventListener('click', () => {
    fetchAndDisplayHistory();
  });

  elements.btnCloseHistoryModal.addEventListener('click', () => {
    elements.historyModal.classList.add('hidden');
  });
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
