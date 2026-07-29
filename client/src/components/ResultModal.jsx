import React from 'react';

const ResultModal = ({ 
  isOpen, 
  resultData, 
  myPlayerId, 
  onNextRound, 
  onReturnLobby 
}) => {
  if (!isOpen || !resultData) return null;

  const { icon, title, word, summary, scores, p1Name, p2Name, isMatchEnd } = resultData;

  return (
    <div className="modal-backdrop">
      <div className="card modal-card result-card">
        <div className="result-icon">{icon || '🏆'}</div>
        <h2 className="result-title">{title || 'ROUND OVER'}</h2>
        
        {word && (
          <p className="result-word">
            The word was: <span className="highlight-word">{word}</span>
          </p>
        )}

        <p className="result-summary">{summary}</p>

        {scores && (
          <div className="final-scores">
            <div className="score-row">
              <span>{p1Name || 'Player 1'}</span>
              <span>{scores.p1Score ?? 0}</span>
            </div>
            <div className="score-row">
              <span>{p2Name || 'Player 2'}</span>
              <span>{scores.p2Score ?? 0}</span>
            </div>
          </div>
        )}

        <div className="result-actions" style={{ width: '100%', marginTop: '10px' }}>
          {!isMatchEnd ? (
            <button className="btn btn-primary btn-full" onClick={onNextRound}>
              Next Round
            </button>
          ) : (
            <button className="btn btn-outline btn-full" onClick={onReturnLobby}>
              Return to Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
