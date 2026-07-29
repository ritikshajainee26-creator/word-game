import React from 'react';

const HistoryModal = ({ 
  isOpen, 
  onClose, 
  playerName, 
  history, 
  isLoading 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="card modal-card history-card">
        <div className="modal-header">
          <h3>📜 My Match History</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="history-subtitle">
            Private match history for: <strong className="gradient-text">{playerName || 'Warrior'}</strong>
          </div>

          <div className="history-list">
            {isLoading ? (
              <div className="history-empty">Fetching your match history...</div>
            ) : !history || history.length === 0 ? (
              <div className="history-empty">
                No match history records found for "{playerName}". Play a match to build your history!
              </div>
            ) : (
              history.map((item, idx) => {
                const badgeClass = item.result === 'WIN' ? 'badge-win' : item.result === 'LOSS' ? 'badge-loss' : 'badge-draw';
                const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent';

                return (
                  <div key={idx} className="history-item">
                    <div className="history-info">
                      <span className="history-opp">vs {item.opponentName}</span>
                      <span className="history-date">{dateStr}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="history-score">{item.playerScore} - {item.opponentScore}</span>
                      <span className={`badge ${badgeClass}`}>{item.result}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
