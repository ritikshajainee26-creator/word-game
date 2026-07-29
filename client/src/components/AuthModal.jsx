import React, { useState } from 'react';

const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'signup'
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setErrorMsg('Please enter your username.');
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    const endpoint = activeTab === 'signup' ? '/api/auth/signup' : '/api/auth/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: passwordInput })
      });

      const data = await response.json();
      setIsSubmitting(false);

      if (!response.ok || !data.success) {
        setErrorMsg(data.message || 'Authentication failed. Please try again.');
        return;
      }

      // Save token and user profile
      localStorage.setItem('word_clash_jwt', data.token);
      localStorage.setItem('word_clash_user', JSON.stringify(data.user));

      setUsernameInput('');
      setPasswordInput('');
      setErrorMsg('');

      onAuthSuccess(data.user, data.token);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('Network error. Unable to connect to server.');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="card modal-card" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3>{activeTab === 'signin' ? '🔐 Sign In' : '✨ Create Account (Sign Up)'}</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tab-buttons">
          <button
            className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('signin');
              setErrorMsg('');
            }}
          >
            Sign In
          </button>
          <button
            className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('signup');
              setErrorMsg('');
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter username (min 3 chars)..."
              maxLength={20}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter password (min 6 chars)..."
              maxLength={40}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>

          {errorMsg && (
            <div className="name-error-msg" style={{ marginBottom: '16px', display: 'block' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Processing...'
              : activeTab === 'signin'
              ? 'Sign In to Word Clash'
              : 'Create Account & Play'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
