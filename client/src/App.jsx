import React, { useState, useEffect, useRef } from 'react';
import socket from './utils/socket';
import soundEffects from './utils/audio';
import Header from './components/Header';
import Lobby from './components/Lobby';
import Matchmaking from './components/Matchmaking';
import PrivateRoomModal from './components/PrivateRoomModal';
import Arena from './components/Arena';
import ResultModal from './components/ResultModal';
import HistoryModal from './components/HistoryModal';
import AuthModal from './components/AuthModal';
import './App.css';

function App() {
  // Persistent Player ID & Auth Session State
  const [myPlayerId] = useState(() => {
    let pid = localStorage.getItem('word_clash_player_id');
    if (!pid) {
      pid = 'p_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('word_clash_player_id', pid);
    }
    return pid;
  });

  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem('word_clash_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem('word_clash_jwt') || null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // App State
  const [currentScreen, setCurrentScreen] = useState('lobby');
  const [playerName, setPlayerName] = useState(() => (authUser ? authUser.username : ''));
  const [nameError, setNameError] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync playerName with authUser
  useEffect(() => {
    if (authUser) {
      setPlayerName(authUser.username);
    }
  }, [authUser]);

  // Auto verify session on mount
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setAuthUser(data.user);
            setPlayerName(data.user.username);
          } else {
            // Token expired or invalid
            handleLogout();
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleAuthSuccess = (user, token) => {
    setAuthUser(user);
    setAuthToken(token);
    setPlayerName(user.username);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('word_clash_jwt');
    localStorage.removeItem('word_clash_user');
    setAuthUser(null);
    setAuthToken(null);
    setPlayerName('');
  };

  const requireAuth = (callback) => {
    if (!authUser || !authToken) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  // Match State
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [maskedWord, setMaskedWord] = useState([]);
  const [isGuessSpent, setIsGuessSpent] = useState(false);
  const [timerRemainingMs, setTimerRemainingMs] = useState(15000);
  const [logs, setLogs] = useState([]);

  // Modals & Banners
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);
  const [generatedRoomCode, setGeneratedRoomCode] = useState('');
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState(null);

  // Interval Ref
  const timerRef = useRef(null);

  const addLog = (text, type = 'system') => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  const startIntervalCountdown = (durationMs = 15000) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRemainingMs(durationMs);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = durationMs - elapsed;
      if (remaining <= 0) {
        setTimerRemainingMs(0);
        clearInterval(timerRef.current);
      } else {
        setTimerRemainingMs(remaining);
      }
    }, 100);
  };

  const stopIntervalCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRemainingMs(0);
  };

  // Socket Event Listeners
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);

      // Auto-reconnect to active match if session tokens exist
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
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onMatchmakerStatus = (data) => {
      if (data.status === 'queued') {
        setCurrentScreen('matchmaking');
      }
    };

    const onPrivateRoomCreated = (data) => {
      setGeneratedRoomCode(data.roomCode);
    };

    const onGameStarted = (data) => {
      setCurrentRoomId(data.roomId);
      
      // Persist active match tokens
      try {
        localStorage.setItem('word_clash_match_id', data.roomId);
        if (data.sessionToken) localStorage.setItem('word_clash_session_token', data.sessionToken);
      } catch (e) {}

      const me = data.players.find(p => p.id === myPlayerId);
      const opponent = data.players.find(p => p.id !== myPlayerId);

      setP1Name(me ? me.name : playerName);
      setP2Name(opponent ? opponent.name : 'Opponent');
      setP1Score(0);
      setP2Score(0);
      setLogs([]);

      setIsPrivateModalOpen(false);
      setIsResultModalOpen(false);
      setDisconnectMessage(null);
      setCurrentScreen('arena');
      addLog(`Match started against ${opponent ? opponent.name : 'Opponent'}! First to 3 wins.`, 'system');
    };

    const onReconnectSuccess = (data) => {
      setCurrentRoomId(data.matchId);
      const snap = data.stateSnapshot;

      try {
        localStorage.setItem('word_clash_match_id', data.matchId);
        if (data.sessionToken) localStorage.setItem('word_clash_session_token', data.sessionToken);
      } catch (e) {}

      if (snap.players) {
        const me = snap.players.find(p => p.id === myPlayerId);
        const opponent = snap.players.find(p => p.id !== myPlayerId);
        setP1Name(me ? me.name : snap.p1Name);
        setP2Name(opponent ? opponent.name : snap.p2Name);
        if (snap.scores) {
          setP1Score(snap.scores[myPlayerId] ?? 0);
          const oppId = Object.keys(snap.scores).find(id => id !== myPlayerId);
          setP2Score(oppId ? snap.scores[oppId] : 0);
        }
      }

      setRoundNumber(snap.currentRound);
      setMaskedWord([...snap.maskedWord]);
      setIsGuessSpent(false);
      if (snap.status === 'in_progress') {
        startIntervalCountdown(snap.revealIntervalMs || 15000);
      }

      setIsPrivateModalOpen(false);
      setIsResultModalOpen(false);
      setDisconnectMessage(null);
      setCurrentScreen('arena');
      addLog('⚡ Reconnected to active match! Game state restored.', 'system');
    };

    const onRoundStart = (data) => {
      setIsResultModalOpen(false);
      setRoundNumber(data.roundNumber);
      setMaskedWord([...data.maskedWord]);
      setIsGuessSpent(false);
      startIntervalCountdown(data.revealIntervalMs || 15000);
      addLog(`Round ${data.roundNumber} started! Target length: ${data.wordLength} letters.`, 'system');
    };

    const onLetterRevealed = (data) => {
      setMaskedWord([...data.maskedWord]);
      soundEffects.playLetterReveal();
      setIsGuessSpent(false);
      startIntervalCountdown(15000);
      addLog(`Letter revealed at position ${data.index + 1}: "${data.letter}"`, 'system');
    };

    const onGuessResult = (data) => {
      if (!data.success) {
        if (data.reason === 'ALREADY_GUESSED_THIS_INTERVAL') {
          setIsGuessSpent(true);
          addLog('⚠️ You already submitted a guess for this letter tick!', 'wrong');
        } else {
          addLog(`⚠️ Incorrect guess: ${data.message || 'Try again!'}`, 'wrong');
        }
        soundEffects.playWrongGuess();
      } else {
        soundEffects.playCorrectGuess();
        addLog('✨ Correct guess submitted! Pending round resolution.', 'correct');
      }
    };

    const onPlayerGuessNotification = (data) => {
      if (data.playerId !== myPlayerId) {
        addLog(`⚡ ${data.playerName} submitted a guess!`, 'system');
      }
    };

    const onReactionReceived = (data) => {
      addLog(`${data.playerName}: ${data.emoji}`, 'reaction');
    };

    const onRoundEnd = (data) => {
      stopIntervalCountdown();
      const isWinner = data.winnerId === myPlayerId;
      const isDraw = data.isDraw;

      if (data.scores) {
        setP1Score(data.scores[myPlayerId] ?? p1Score);
        const oppId = Object.keys(data.scores).find(id => id !== myPlayerId);
        setP2Score(oppId ? data.scores[oppId] : p2Score);
      }

      let icon = '🏆';
      let title = 'ROUND WINNER!';

      if (isDraw) {
        icon = '⚖️';
        title = 'ROUND DRAW!';
      } else if (isWinner) {
        icon = '🏆';
        title = 'YOU WON THE ROUND!';
        soundEffects.playRoundWin();
      } else if (data.winnerId) {
        icon = '💔';
        title = 'OPPONENT WON ROUND';
      } else {
        icon = '⌛';
        title = 'TIME EXPIRED (NO WINNER)';
      }

      setResultData({
        icon,
        title,
        word: data.word,
        summary: data.summary,
        scores: { p1Score: data.scores[myPlayerId] ?? p1Score, p2Score: data.scores[Object.keys(data.scores).find(id => id !== myPlayerId)] ?? p2Score },
        p1Name,
        p2Name,
        isMatchEnd: false
      });
      setIsResultModalOpen(true);
    };

    const onMatchEnd = (data) => {
      stopIntervalCountdown();
      const isWinner = data.winnerId === myPlayerId;

      try {
        localStorage.removeItem('word_clash_match_id');
        localStorage.removeItem('word_clash_session_token');
      } catch (e) {}

      if (isWinner) soundEffects.playMatchVictory();

      setResultData({
        icon: isWinner ? '👑' : '🏁',
        title: isWinner ? '🎉 MATCH VICTORY!' : 'GAME OVER',
        word: null,
        summary: `Final Result: ${data.reason === 'WIN_BY_FORFEIT' ? 'Victory by Opponent Forfeit!' : 'Match Target Score Reached.'}`,
        scores: { p1Score: data.finalScores[myPlayerId] ?? p1Score, p2Score: data.finalScores[Object.keys(data.finalScores).find(id => id !== myPlayerId)] ?? p2Score },
        p1Name,
        p2Name,
        isMatchEnd: true
      });
      setIsResultModalOpen(true);
    };

    const onPlayerDisconnected = (data) => {
      setDisconnectMessage(`${data.playerName} disconnected! Reconnect window: ${data.gracePeriodSeconds}s`);
    };

    const onPlayerReconnected = (data) => {
      setDisconnectMessage(null);
      addLog(`⚡ ${data.playerName} reconnected!`, 'system');
    };

    const onMatchHistoryData = (data) => {
      setHistoryData(data.history || []);
      setIsHistoryLoading(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('matchmaker_status', onMatchmakerStatus);
    socket.on('private_room_created', onPrivateRoomCreated);
    socket.on('game_started', onGameStarted);
    socket.on('reconnect_success', onReconnectSuccess);
    socket.on('round_start', onRoundStart);
    socket.on('letter_revealed', onLetterRevealed);
    socket.on('guess_result', onGuessResult);
    socket.on('player_guess_notification', onPlayerGuessNotification);
    socket.on('reaction_received', onReactionReceived);
    socket.on('round_end', onRoundEnd);
    socket.on('match_end', onMatchEnd);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('match_history_data', onMatchHistoryData);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('matchmaker_status', onMatchmakerStatus);
      socket.off('private_room_created', onPrivateRoomCreated);
      socket.off('game_started', onGameStarted);
      socket.off('reconnect_success', onReconnectSuccess);
      socket.off('round_start', onRoundStart);
      socket.off('letter_revealed', onLetterRevealed);
      socket.off('guess_result', onGuessResult);
      socket.off('player_guess_notification', onPlayerGuessNotification);
      socket.off('reaction_received', onReactionReceived);
      socket.off('round_end', onRoundEnd);
      socket.off('match_end', onMatchEnd);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('player_reconnected', onPlayerReconnected);
      socket.off('match_history_data', onMatchHistoryData);
    };
  }, [myPlayerId, playerName, p1Score, p2Score, p1Name, p2Name]);

  // Handlers with Authentication checks
  const handleStartQuickMatch = (name) => {
    if (!requireAuth()) return;
    socket.emit('join_queue', { name, playerId: myPlayerId });
  };

  const handleOpenPrivateModal = () => {
    if (!requireAuth()) return;
    setGeneratedRoomCode('');
    setIsPrivateModalOpen(true);
  };

  const handleCreateRoom = () => {
    if (!requireAuth()) return;
    socket.emit('create_private_room', { name: playerName, playerId: myPlayerId });
  };

  const handleJoinRoom = (roomCode) => {
    if (!requireAuth()) return;
    socket.emit('join_private_room', { name: playerName, playerId: myPlayerId, roomCode });
  };

  const handleStartBotMatch = (name) => {
    if (!requireAuth()) return;
    socket.emit('start_bot_match', { name, playerId: myPlayerId });
  };

  const handleCancelMatchmaking = () => {
    socket.emit('leave_queue');
    setCurrentScreen('lobby');
  };

  const handleSubmitGuess = (word) => {
    setIsGuessSpent(true);
    socket.emit('submit_guess', { roomId: currentRoomId, word });
  };

  const handleSendReaction = (emoji) => {
    socket.emit('send_reaction', { roomId: currentRoomId, emoji });
  };

  const handleFetchHistory = async () => {
    if (!requireAuth()) return;
    const validName = (playerName || '').trim();
    if (!validName) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setIsHistoryLoading(true);
    setIsHistoryModalOpen(true);

    try {
      const res = await fetch(`/api/history/${encodeURIComponent(validName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setHistoryData(data.history || []);
          setIsHistoryLoading(false);
          return;
        }
      }
    } catch (e) {}

    socket.emit('get_match_history', { playerName: validName });
  };

  return (
    <div className="app-container">
      {/* Background glow animations */}
      <div className="app-background">
        <div className="bg-glow bg-glow-1"></div>
        <div className="bg-glow bg-glow-2"></div>
      </div>

      {/* Header */}
      <Header
        isConnected={isConnected}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        authUser={authUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenHistory={handleFetchHistory}
      />

      {/* Disconnect Banner */}
      {disconnectMessage && (
        <div className="banner disconnect-banner">
          <span className="pulse-icon">⚠️</span>
          <span>{disconnectMessage}</span>
        </div>
      )}

      {/* Main Screens */}
      <main className="main-content">
        {currentScreen === 'lobby' && (
          <Lobby
            playerName={playerName}
            setPlayerName={setPlayerName}
            nameError={nameError}
            setNameError={setNameError}
            onStartQuickMatch={handleStartQuickMatch}
            onOpenPrivateModal={handleOpenPrivateModal}
            onStartBotMatch={handleStartBotMatch}
          />
        )}

        {currentScreen === 'matchmaking' && (
          <Matchmaking
            onCancel={handleCancelMatchmaking}
            onSwitchToBot={() => handleStartBotMatch(playerName || 'Warrior')}
          />
        )}

        {currentScreen === 'arena' && (
          <Arena
            myPlayerId={myPlayerId}
            p1Name={p1Name}
            p2Name={p2Name}
            p1Score={p1Score}
            p2Score={p2Score}
            roundNumber={roundNumber}
            maskedWord={maskedWord}
            timerRemainingMs={timerRemainingMs}
            isGuessSpent={isGuessSpent}
            onSubmitGuess={handleSubmitGuess}
            onSendReaction={handleSendReaction}
            logs={logs}
          />
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <PrivateRoomModal
        isOpen={isPrivateModalOpen}
        onClose={() => setIsPrivateModalOpen(false)}
        generatedRoomCode={generatedRoomCode}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />

      <ResultModal
        isOpen={isResultModalOpen}
        resultData={resultData}
        myPlayerId={myPlayerId}
        onNextRound={() => setIsResultModalOpen(false)}
        onReturnLobby={() => {
          setIsResultModalOpen(false);
          setCurrentScreen('lobby');
        }}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        playerName={playerName}
        history={historyData}
        isLoading={isHistoryLoading}
      />
    </div>
  );
}

export default App;
