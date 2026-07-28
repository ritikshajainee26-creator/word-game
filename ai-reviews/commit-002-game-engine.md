# 🤖 AI Review & Reflection — Commit #002

**Commit Title**: `feat(engine): implement server-authoritative word guessing logic and timer`  
**Date**: 2026-07-28  
**Author/AI Pair**: Antigravity AI Assistant & Developer

---

## 📌 Scope of Changes
- Created `src/server/wordBank.js`: Curated dictionary provider with non-repeating word selection.
- Created `src/server/gameEngine.js`:
  - Server-authoritative game room state machine.
  - Random index letter reveal timer loop.
  - Per-interval player guess attempt tracking (`intervalGuesses` map).
  - Simultaneous guess grace window for fair draw resolution.
  - Score accumulation and match winner evaluation.
  - Player disconnect grace period (15-second forfeit timer).
- Created `tests/gameEngine.test.js`: Unit tests for word bank, initial state, single guess limit, scoring, draw logic, and disconnect handling.

---

## 🧠 AI Self-Review & Technical Decisions

### 1. Simultaneous Submission Grace Window
- **Issue**: If two players submit correct answers within milliseconds of each other due to network latency, naive "first packet wins" penalizes players with higher latency.
- **Solution**: Implemented an interval-locked grace window (`graceWindowMs`, default 300ms). When a player submits a correct answer, the engine checks if the opponent has already used their guess in that interval. If not, it pauses and waits up to 300ms for an in-flight packet. If both players submit correct answers in the same interval, the round is declared a **Draw**.
- **Accepted Suggestions**: Added automatic early win resolution if the opponent has already submitted an incorrect guess in the same interval (no need to wait 300ms if opponent cannot guess again).

### 2. Single Guess per Interval Rule
- **Decision**: Used `intervalGuesses.set(playerId, { guess, timestamp, intervalIndex })` cleared on every letter reveal tick (`intervalIndex += 1`).
- **Reasoning**: Guarantees server-side enforcement regardless of client-side UI manipulation.

---

## 🎯 Verification & Safety Checks
- [x] Ran unit tests via `node --test tests/gameEngine.test.js`.
- [x] All 6 unit tests passed (0 failures).
- [x] Memory leak prevention: explicit `clearTimers()` for `intervalTimer`, `graceTimer`, and `disconnectTimers`.

---

## 💡 Key Takeaways & Lessons
Handling `setTimeout` callbacks asynchronously in Node.js requires explicit tick flushing in unit tests when using non-zero grace windows.
