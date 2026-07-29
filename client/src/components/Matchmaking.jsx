import React, { useState, useEffect } from 'react';

const Matchmaking = ({ onCancel, onSwitchToBot }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <section className="screen active">
      <div className="card matchmaking-card">
        <div className="radar-container">
          <div className="radar-circle radar-1"></div>
          <div className="radar-circle radar-2"></div>
          <div className="radar-circle radar-3"></div>
          <span className="radar-icon">🔍</span>
        </div>

        <h2 className="matchmaking-title">Searching for Worthy Opponent...</h2>
        <div className="matchmaking-timer">{formatTime(elapsedSeconds)}</div>

        <div className="matchmaking-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel Search
          </button>
          <button className="btn btn-primary" onClick={onSwitchToBot}>
            Play vs AI Bot Instead
          </button>
        </div>
      </div>
    </section>
  );
};

export default Matchmaking;
