# ⚖️ Business & Domain Understanding Notes

This document captures the business requirements, domain rules, edge-case policies, and decision logic governing the **Real-Time Multiplayer Word Guessing Game**.

---

## 1. Core Game Rules & Mechanics

### Round Initialization
1. A match consists of multiple rounds (e.g., target win score = 3 points, or customizable).
2. At the start of each round, the server randomly selects a target word from the word bank dictionary.
3. The server generates a hidden mask array matching the word's character length (e.g., `["_", "_", "_", "_", "_"]`).
4. Only the word length and initial masked array are transmitted to the players. The actual word remains secret on the server.

### Interval Letter Reveal Loop
1. An interval duration `T_interval` (default: 4000 milliseconds) is established for the round.
2. At each interval tick, the server randomly selects one unrevealed index from the target word and reveals its character in the masked array.
3. The updated masked array, newly revealed index, character, and current `intervalIndex` are broadcast to all players in the room.

### Guessing Rules & Per-Interval Limit
1. During each interval window, each player is allowed **at most ONE guess** for the complete word.
2. Guesses are normalized (trimmed, uppercase, non-alphabetic characters stripped).
3. If a player attempts a second guess within the same interval, the server rejects it with an `ALREADY_GUESSED_THIS_INTERVAL` error.
4. If a player submits a guess that matches a previously incorrect guess in the same round, the server rejects it with a `DUPLICATE_GUESS` warning (without consuming their interval attempt if rejected early, or marking it spent based on rule setup).

---

## 2. Round End & Victory Conditions

### Condition A: Immediate Correct Guess (Single Winner)
- If Player 1 correctly guesses the complete word during interval `i`, and Player 2 does not submit a correct guess during interval `i`, Player 1 immediately wins the round.
- **Award**: Player 1 score increments by +1 point.

### Condition B: Simultaneous Correct Guesses (Draw)
- If both Player 1 and Player 2 submit a correct guess during the **same interval index `i`**, the round ends in a **Draw**.
- **Award**: Neither player receives a point (or both receive +0.5 points depending on match config; default: round draw, no score increment).

### Condition C: Full Reveal Expiration (No Winner)
- If all letters of the word are revealed by interval ticks without any player submitting a correct guess, the round ends automatically.
- **Award**: No winner, no points awarded.

### Condition D: Match End
- The first player to reach the `targetScore` (default: 3 points) wins the match.
- If maximum rounds are exhausted, the player with the highest cumulative score wins. If scores are tied, match ends in a Draw.

---

## 3. Multiplayer Edge Case Policies

### Edge Case 1: Simultaneous Submissions & Latency Jitter
- **Rule**: Guesses are tagged with the current server `intervalIndex`.
- **Policy**: When a correct guess is received in interval `i`, the server delays round finalization by a grace window (up to 300ms or remaining interval time) to receive any concurrent packet sent by the opponent in the same interval window `i`.

### Edge Case 2: Player Disconnects
- **Rule**: If a player's WebSocket connection drops during an active match:
  - Game timer enters a **Paused State**.
  - Opponent is notified: `"Player disconnected. Reconnect grace window: 15s"`.
  - If player reconnects within 15 seconds using their session `matchId` + `playerId`, match resumes seamlessly.
  - If 15 seconds elapse without reconnect, disconnected player forfeits, and connected player is awarded victory by forfeit (`WIN_BY_FORFEIT`).

### Edge Case 3: Late Submissions
- **Rule**: Submissions received after a round has already ended, or after interval `i` has completed, are rejected with `LATE_SUBMISSION` status code.

### Edge Case 4: Matchmaking Timeout / Practice Fallback
- **Rule**: If a player remains in the Quick Match queue for over 10 seconds, the client UI presents a one-click **"Play vs AI Bot"** button. If selected, an AI practice bot joins the room immediately.
