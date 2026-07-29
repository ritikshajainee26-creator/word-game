import React from 'react';

const Lobby = ({ 
  playerName, 
  setPlayerName, 
  nameError, 
  setNameError, 
  onStartQuickMatch, 
  onOpenPrivateModal, 
  onStartBotMatch 
}) => {
  const validateName = () => {
    const trimmed = (playerName || '').trim();
    if (!trimmed) {
      setNameError(true);
      return null;
    }
    setNameError(false);
    return trimmed;
  };

  const handleQuickMatch = () => {
    const valid = validateName();
    if (valid) onStartQuickMatch(valid);
  };

  const handlePrivateRoom = () => {
    const valid = validateName();
    if (valid) onOpenPrivateModal(valid);
  };

  const handleBotMatch = () => {
    const valid = validateName();
    if (valid) onStartBotMatch(valid);
  };

  return (
    <section className="screen active">
      <div className="hero-section">
        <h2 className="hero-title">Real-Time Word Duel</h2>
        <p className="hero-subtitle">Outsmart your opponent letter by letter. Guess fast, stay accurate, claim victory!</p>
      </div>

      <div className="card lobby-card">
        <div className="form-group">
          <label htmlFor="playerNameInput" className="form-label">
            Display Name <span className="required-star">*</span>
          </label>
          <input
            type="text"
            id="playerNameInput"
            className={`form-input ${nameError ? 'input-error' : ''}`}
            placeholder="Enter your display name (e.g. Alex)..."
            maxLength={16}
            autoComplete="off"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              if (e.target.value.trim().length > 0) setNameError(false);
            }}
          />
          {nameError && (
            <span className="name-error-msg">
              ⚠️ Please enter your display name to start playing!
            </span>
          )}
        </div>

        <div className="mode-grid">
          <div className="mode-card">
            <div className="mode-icon">⚡</div>
            <h3 className="mode-title">Quick 1v1 Match</h3>
            <p className="mode-desc">Auto-match instantly with an online opponent in real-time word battle.</p>
            <button className="btn btn-primary btn-full" onClick={handleQuickMatch}>
              Find Match
            </button>
          </div>

          <div className="mode-card">
            <div className="mode-icon">🔐</div>
            <h3 className="mode-title">Private Room</h3>
            <p className="mode-desc">Create or join a private room using a 6-character room code to play friends.</p>
            <button className="btn btn-secondary btn-full" onClick={handlePrivateRoom}>
              Private Room
            </button>
          </div>

          <div className="mode-card">
            <div className="mode-icon">🤖</div>
            <h3 className="mode-title">Practice vs AI Bot</h3>
            <p className="mode-desc">Sharpen your skills against an intelligent AI bot with realistic reaction times.</p>
            <button className="btn btn-outline btn-full" onClick={handleBotMatch}>
              Practice Bot
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Lobby;
