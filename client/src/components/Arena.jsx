import React, { useState, useEffect, useRef } from 'react';
import soundEffects from '../utils/audio';

const Arena = ({ 
  myPlayerId, 
  p1Name, 
  p2Name, 
  p1Score, 
  p2Score, 
  roundNumber, 
  maskedWord, 
  timerRemainingMs, 
  durationMs = 15000, 
  isGuessSpent, 
  onSubmitGuess, 
  onSendReaction, 
  logs 
}) => {
  const [guessInput, setGuessInput] = useState('');
  const logContainerRef = useRef(null);

  // Auto scroll match log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Calculate SVG stroke dashoffset
  const circumference = 2 * Math.PI * 44; // 276.46
  const strokeDashoffset = circumference * (1 - Math.max(0, timerRemainingMs) / durationMs);
  const remainingSeconds = Math.ceil(Math.max(0, timerRemainingMs) / 1000);

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    const word = guessInput.trim().toUpperCase();
    if (!word) return;
    if (word.length !== maskedWord.length) {
      alert(`Word must be exactly ${maskedWord.length} letters!`);
      return;
    }
    onSubmitGuess(word);
    setGuessInput('');
  };

  return (
    <section className="screen active">
      {/* 1. Scoreboard */}
      <div className="scoreboard-container">
        <div className="player-score-card p1-card">
          <div className="player-avatar">👤</div>
          <div className="player-info">
            <span className="player-name">{p1Name}</span>
            <span className="player-score">{p1Score}</span>
          </div>
        </div>

        <div className="match-info-badge">
          <span className="round-indicator">ROUND {roundNumber}</span>
          <span className="vs-text">VS</span>
          <span className="target-indicator">First to 3 Points</span>
        </div>

        <div className="player-score-card p2-card">
          <div className="player-avatar">🎯</div>
          <div className="player-info align-right">
            <span className="player-name">{p2Name}</span>
            <span className="player-score">{p2Score}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Arena Card */}
      <div className="arena-main-card">
        {/* SVG Circular Countdown Timer */}
        <div className="circle-timer">
          <svg className="timer-svg" viewBox="0 0 100 100">
            <circle className="timer-bg" cx="50" cy="50" r="44" />
            <circle 
              className="timer-progress" 
              cx="50" 
              cy="50" 
              r="44" 
              style={{ strokeDashoffset }}
            />
          </svg>
          <div className="timer-content">
            <span className="timer-seconds">{remainingSeconds}s</span>
            <span className="timer-label">NEXT REVEAL</span>
          </div>
        </div>

        {/* 3D Word Letter Tiles */}
        <div className="word-tiles-container">
          {maskedWord.map((letter, idx) => (
            <div key={idx} className={`tile ${letter !== '_' ? 'revealed' : ''}`}>
              {letter !== '_' ? letter : ''}
            </div>
          ))}
        </div>

        {/* Single Guess Form */}
        <div className="guess-form-container">
          <form className="input-wrapper" onSubmit={handleGuessSubmit}>
            <input
              type="text"
              className="guess-input"
              placeholder={`Enter ${maskedWord.length}-letter word...`}
              maxLength={maskedWord.length}
              disabled={isGuessSpent}
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value.toUpperCase())}
            />
            <button 
              type="submit" 
              className="btn btn-primary btn-guess"
              disabled={isGuessSpent || !guessInput.trim()}
            >
              GUESS
            </button>
          </form>

          <div className={`interval-status ${isGuessSpent ? 'spent' : ''}`}>
            {isGuessSpent ? (
              <span>⚠️ Single guess submitted for this 15s interval tick!</span>
            ) : (
              <span>💡 You have 1 guess available for this 15s interval tick.</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer Reactions & Log */}
      <div className="arena-footer">
        <div className="reaction-bar">
          <span className="reaction-label">Quick Taunt:</span>
          {['👏', '🔥', '🤔', '😎', '😱'].map((emoji) => (
            <button 
              key={emoji} 
              className="btn-reaction"
              onClick={() => onSendReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="match-log" ref={logContainerRef}>
          {logs.map((log, idx) => (
            <div key={idx} className={`log-item ${log.type}`}>
              {log.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Arena;
