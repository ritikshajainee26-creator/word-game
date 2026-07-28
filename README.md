# 🔤 Real-Time Multiplayer Word Guessing Game

A real-time, server-authoritative 2-player multiplayer word guessing game built with Node.js, Express, Socket.IO, and modern Vanilla HTML5/CSS3/JS.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Socket.IO](https://img.shields.io/badge/socket.io-v4.7.5-orange.svg)

---

## 🌟 Game Highlights

- **Server-Authoritative Gameplay**: All game timers, letter reveals, guess validations, scoring, and interval ticks are computed and enforced strictly on the server.
- **Interval-Locked Guessing**: At fixed time intervals (e.g., every 4 seconds), a hidden letter is revealed at a random position. Each player is limited to **one guess per interval window**.
- **Simultaneous Submission Handling**: Employs an interval grace window. If both players submit correct guesses within the same interval window, the round is declared a **Draw**.
- **Automated Matchmaking & Bot Mode**: Instant 1v1 matchmaking queue. If no human opponent is found, players can play against an automated practice AI Bot.
- **Private Room Codes**: Play directly with friends using 6-character room codes.
- **Resilient Edge Case Handling**: Includes disconnect grace period (15s reconnect window), late guess rejection, duplicate guess prevention, and automatic room cleanup.
- **Rich Visual & Audio UX**: Neon glassmorphic interface, dynamic letter flip animations, visual countdown progress rings, interactive match scoreboards, sound synthesis via Web Audio API, and audio toggles.

---

## 🛠️ Project Structure

```
word-game/
├── ai-reviews/               # AI review & reflection documentation per commit
│   └── commit-001-setup.md
├── docs/                     # Comprehensive engineering documentation
│   ├── BUSINESS_RULES.md     # Business logic, scoring rules, and edge-case policies
│   ├── DESIGN_PHILOSOPHY.md # Engineering principles & server-authoritative design
│   ├── DEVELOPMENT.md       # Technical design, socket protocol, and milestones
│   └── FEATURES.md          # Completed, partial, and pending feature matrix
├── public/                   # Frontend SPA static assets
│   ├── css/
│   │   └── style.css         # Custom CSS design system & animations
│   ├── js/
│   │   ├── app.js            # Client UI manager & socket listener
│   │   └── audio.js          # Web Audio API sound generator
│   └── index.html            # Main HTML layout
├── src/                      # Backend Node.js application logic
│   ├── server/
│   │   ├── bot.js            # Automated AI Practice Bot
│   │   ├── gameEngine.js     # Server-authoritative game state & round loop
│   │   ├── matchmaker.js     # Queue & room management logic
│   │   ├── server.js         # Express app & HTTP server entry point
│   │   ├── socketHandler.js  # Socket.IO event handlers
│   │   └── wordBank.js       # Curated word bank dictionary
├── tests/                    # Test suite
│   ├── gameEngine.test.js    # Unit tests for core engine
│   └── integration.test.js   # Socket integration & matchmaking tests
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Execution Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- `npm` v9.0.0 or higher

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd word-game
npm install
```

### 2. Running the Server
Start the production server:
```bash
npm start
```
Or start in development mode with automatic reload:
```bash
npm run dev
```

The server will run at: **`http://localhost:3000`**

### 3. Playing the Game
1. Open **`http://localhost:3000`** in your browser.
2. Enter your Display Name.
3. Choose a mode:
   - **Quick Match**: Auto-matches you with another online player.
   - **Private Room**: Create a custom code room or join via a code provided by a friend.
   - **Practice vs Bot**: Play immediately against an AI bot.
4. Open a **second browser window or incognito tab** to test two-player multiplayer locally!

---

## 🧪 Testing

Run the automated unit and integration test suite:
```bash
npm test
```

---

## 📑 Documentation Links

- 📖 [Development Documentation](docs/DEVELOPMENT.md)
- 📋 [Feature Matrix & Status](docs/FEATURES.md)
- 🧠 [Design Philosophy](docs/DESIGN_PHILOSOPHY.md)
- ⚖️ [Business & Domain Logic](docs/BUSINESS_RULES.md)
- 🤖 [AI Commit Reviews](ai-reviews/)
