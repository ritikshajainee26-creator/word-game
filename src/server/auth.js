const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'word_clash_super_secret_jwt_key_2026';

/**
 * Middleware to verify JWT tokens.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

/**
 * POST /api/auth/signup - Register new user account.
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const cleanUsername = (username || '').trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existing = await db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Username is already registered. Please Sign In or pick another username.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save to DB
    const newUser = await db.createUser(cleanUsername, passwordHash);

    // Issue JWT Token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: newUser.id, username: newUser.username }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken. Please Sign In or pick another username.'
      });
    }
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error during signup.' });
  }
});

/**
 * POST /api/auth/login - Existing user sign in.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const cleanUsername = (username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both username and password.' });
    }

    const user = await db.getUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Issue JWT Token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

/**
 * GET /api/auth/me - Verify current user session.
 */
router.get('/me', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: { id: req.user.userId, username: req.user.username }
  });
});

module.exports = { router, JWT_SECRET, authenticateToken };
