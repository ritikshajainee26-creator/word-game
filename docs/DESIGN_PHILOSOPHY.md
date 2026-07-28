# 🧠 Design Philosophy

The **Real-Time Multiplayer Word Guessing Game** is engineered with a strict focus on **server authority**, **network resilience**, **fairness**, and **delightful user experience**.

---

## 1. Single Source of Truth (Server Authority)

In multiplayer real-time games, trust must never be delegated to the client.

- **Zero Client-Side State Inflation**: Clients only render the state transmitted by the server. The secret target word is **never** sent to the browser until the round completes.
- **Server-Driven Timers**: Interval ticks, letter reveal positions, and round timeouts are calculated on Node.js using precise server timestamps.
- **Validation at Gate**: Every guess is sanitized, normalized (uppercase, trimmed), and checked against the current round's interval state on the server.

---

## 2. Deterministic Fairness & Edge-Case Safety

Network latency varies across devices and network conditions. A fair game must gracefully handle latency jitter, concurrent actions, and unexpected disconnections.

- **Interval Grace Window**: Rather than instantly awarding a victory to the first packet received by the network interface, the engine registers guesses per interval index. Submissions received within the same interval tick are evaluated together, ensuring that players with a 20ms ping advantage do not unfairly penalize players with a 100ms ping if both answered correctly in the same turn window.
- **Single Guess Enforcement**: Players cannot spam word guesses. The server tracks `hasGuessedInInterval` boolean flags per player, resetting only on interval transition.
- **Graceful Degradation & Reconnection**: When a player loses connection, the server pauses the round timer for up to 15 seconds. If the player reconnects with their match token, state is re-synchronized immediately. If the timer expires, the connected player wins by default forfeit.

---

## 3. Modular & Maintainable Architecture

The codebase follows high cohesion and loose coupling principles:

- **Decoupled Game Engine**: `gameEngine.js` contains pure business logic independent of Socket.IO or HTTP transport. This makes it trivial to unit test without mocking network sockets.
- **Transport Abstraction**: `socketHandler.js` handles WebSocket event mapping and delegates all state mutations to `gameEngine.js` and `matchmaker.js`.
- **Zero-Dependency Frontend**: The client uses pure Vanilla JS and CSS variables, guaranteeing maximum portability, instant loading, and zero build setup friction.

---

## 4. Rich Aesthetic & Sensory Feedback

A great game must feel responsive, responsive, and visually dynamic:

- **Visual Hierarchy & Glassmorphism**: Translucent panels, glowing neon accent borders, dark slate background contrast, clean typography.
- **Micro-Animations**: Animated tile flips for revealed letters, glowing countdown rings, and victory popups.
- **Synthesized Web Audio**: Custom Web Audio API sound generator providing immediate audio feedback without fetching external MP3 assets.
