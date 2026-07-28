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

// Middleware & Static Asset Serving
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
