# 🛠️ Development Documentation

## Implementation Approach & Architecture

The Real-Time Multiplayer Word Guessing Game is built as a server-authoritative web application designed for low-latency, real-time multiplayer synchronization.

```
+-------------------------------------------------------+
|                    CLIENT (SPA)                       |
|   HTML5 / CSS3 (Glassmorphic UI) / Vanilla JavaScript |
|     Web Audio API | Socket.io-client Event Loop       |
+---------------------------+---------------------------+
                            | WebSockets (Socket.IO)
                            v
+-------------------------------------------------------+
|                    SERVER (Node.js)                   |
|  +-------------------+        +--------------------+  |
|  | Socket Handler    |<------>| Matchmaker         |  |
|  +---------+---------+        +---------+----------+  |
|            |                            |             |
|            v                            v             |
|  +-------------------------------------------------+  |
|  | GameEngine (State Machine, Timer, Word Bank)    |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

### Server Architecture
1. **`server.js`**: Express server initialization, static asset serving, and HTTP/WebSocket binding.
2. **`gameEngine.js`**: Core state engine managing game rooms, round cycles, timer intervals, masked word generation, random unrevealed index selection, guess validation, scoring, and simultaneous guess window processing.
3. **`matchmaker.js`**: Queue manager matching 1v1 players into active rooms, room code generator, and bot matchmaking dispatcher.
4. **`socketHandler.js`**: Socket event listeners, heartbeat/disconnect grace tracking, state broadcast dispatcher.
5. **`wordBank.js`**: Dictionary provider categorized by word length and difficulty.
6. **`bot.js`**: Simulated player bot for offline/practice mode with realistic guess timing.

---

## Socket Event Protocol Specification

### Client to Server Events
- `join_queue` `{ name: string }`
- `leave_queue` `{}`
- `create_private_room` `{ name: string }`
- `join_private_room` `{ name: string, roomCode: string }`
- `start_bot_match` `{ name: string }`
- `submit_guess` `{ guess: string }`
- `send_reaction` `{ emoji: string }`
- `request_reconnect` `{ matchId: string, playerId: string }`

### Server to Client Events
- `matchmaker_status` `{ status: 'queued' | 'matched', queuePosition?: number }`
- `game_started` `{ matchId: string, opponentName: string, maxRounds: number, wordLength: number }`
- `round_start` `{ roundNumber: number, wordLength: number, maskedWord: string[], revealIntervalMs: number }`
- `letter_revealed` `{ index: number, letter: string, maskedWord: string[], intervalIndex: number }`
- `guess_result` `{ success: boolean, message: string, intervalIndex: number }`
- `round_end` `{ winnerId: string | null, isDraw: boolean, word: string, scores: Object, roundSummary: string }`
- `match_end` `{ winnerId: string | null, finalScores: Object, reason: string }`
- `player_disconnected` `{ playerId: string, gracePeriodSeconds: number }`
- `player_reconnected` `{ playerId: string }`
- `error_message` `{ code: string, message: string }`

---

## Technical Decisions & Trade-Offs

### 1. Server Authority vs. Client Prediction
- **Decision**: All timer ticks, letter reveals, and guess evaluations are strictly computed on the server.
- **Trade-off**: Requires low latency socket transport. Mitigated by using Socket.IO automatic transport upgrades (WebSocket/Polling) and instant socket state pushes.

### 2. Simultaneous Guess Window (Draw Logic)
- **Decision**: When player 1 submits a correct guess at interval `i`, the server opens a brief interval grace window (until interval `i` expires or 300ms pass) before finalizing the round. If player 2 also submits a correct guess for interval `i`, the round results in a Draw.
- **Trade-off**: Slightly delays instant round-end broadcast by up to the grace window duration, but guarantees 100% fairness against network jitter between players.

### 3. Lightweight Client Stack
- **Decision**: Vanilla HTML5/CSS3/JavaScript without heavy frontend frameworks (React/Vue).
- **Trade-off**: Extremely fast page loads (<100ms), zero bundler dependencies, easy debugging, and responsive CSS grid/flexbox layouts.

---

## Development Milestones

1. **Milestone 1**: Setup, architecture, package stubs, documentation baseline.
2. **Milestone 2**: Server-authoritative GameEngine core with interval ticks and word bank.
3. **Milestone 3**: Socket.IO transport, room manager, and matchmaking queue.
4. **Milestone 4**: Resilience, edge case handling (disconnect grace, draw logic, bot fallback).
5. **Milestone 5**: Frontend SPA with neon UI, animations, and Web Audio API synthesis.
6. **Milestone 6**: Integration testing, edge-case validation, and documentation completion.
