import React from 'react';
import soundEffects from '../utils/audio';

const Header = ({ isConnected, soundEnabled, setSoundEnabled, authUser, onOpenAuthModal, onLogout, onOpenHistory }) => {
  const toggleSound = () => {
    const newState = soundEffects.toggleSound();
    setSoundEnabled(newState);
  };

  return (
    <header className="main-header">
      <div className="brand">
        <span className="brand-icon">⚔️</span>
        <h1 className="brand-title">WORD <span className="gradient-text">CLASH</span></h1>
      </div>
      
      <div className="header-actions">
        <button 
          className="btn btn-outline btn-sm" 
          onClick={onOpenHistory}
        >
          📜 History
        </button>

        <div className="status-badge">
          <span className={`status-dot ${isConnected ? 'online' : ''}`}></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>

        <button 
          className="icon-button" 
          onClick={toggleSound} 
          title="Toggle Sound"
        >
          <span className="icon">{soundEnabled ? '🔊' : '🔇'}</span>
        </button>

        {authUser ? (
          <div className="status-badge" style={{ borderColor: 'var(--primary-cyan)', color: 'var(--primary-cyan)' }}>
            <span>👤 <strong>{authUser.username}</strong></span>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={onLogout}
              style={{ marginLeft: '6px', padding: '2px 8px', fontSize: '0.75rem' }}
            >
              Logout 🚪
            </button>
          </div>
        ) : (
          <button 
            className="btn btn-primary btn-sm" 
            onClick={onOpenAuthModal}
          >
            🔑 Sign In / Sign Up
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
