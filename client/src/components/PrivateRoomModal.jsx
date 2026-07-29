import React, { useState } from 'react';

const PrivateRoomModal = ({ 
  isOpen, 
  onClose, 
  generatedRoomCode, 
  onCreateRoom, 
  onJoinRoom 
}) => {
  const [activeTab, setActiveTab] = useState('create');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  if (!isOpen) return null;

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (joinCodeInput.trim().length === 6) {
      onJoinRoom(joinCodeInput.trim().toUpperCase());
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="card modal-card">
        <div className="modal-header">
          <h3>🔐 Private Room Lobby</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Room
          </button>
          <button 
            className={`tab-btn ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join Room
          </button>
        </div>

        {activeTab === 'create' ? (
          <div>
            <p className="mode-desc" style={{ marginBottom: '12px' }}>
              Generate a unique 6-character room code and share it with your friend to join.
            </p>
            <button className="btn btn-secondary btn-full" onClick={onCreateRoom}>
              Generate Room Code
            </button>
            {generatedRoomCode && (
              <div className="room-code-display">
                <span className="reaction-label">Your Private Room Code:</span>
                <span className="code-value">{generatedRoomCode}</span>
                <span className="reaction-label">Share this code with your opponent!</span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleJoinSubmit}>
            <div className="form-group">
              <label className="form-label">Enter Room Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g. ABC123"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.4rem' }}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-full" 
              disabled={joinCodeInput.trim().length !== 6}
            >
              Join Match Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PrivateRoomModal;
