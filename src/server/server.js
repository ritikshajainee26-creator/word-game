const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const setupSocketHandler = require('./socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware & Static Asset Serving (React SPA client/dist)
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client/dist')));

const db = require('./db');
const { router: authRouter } = require('./auth');

// Authentication API Endpoints
app.use('/api/auth', authRouter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', isPgConnected: db.isPgConnected(), timestamp: new Date().toISOString() });
});

// REST API: User Match History Endpoint
app.get('/api/history/:playerName', async (req, res) => {
  try {
    const history = await db.getUserMatchHistory(req.params.playerName);
    res.json({
      success: true,
      playerName: req.params.playerName,
      count: history.length,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all SPA Route for React Client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Initialize Socket.IO Handler
setupSocketHandler(io);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🔤 Real-Time Word Guessing Game Server Running`);
    console.log(` 🚀 URL: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = { app, server, io };
