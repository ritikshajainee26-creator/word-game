import { io } from 'socket.io-client';

// Shared Socket.IO client instance connecting to root or proxied backend server
const socket = io();

export default socket;
