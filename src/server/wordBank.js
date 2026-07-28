/**
 * Curated dictionary of words categorized for the Word Guessing Game.
 */
const WORD_BANK = [
  "PLANET", "GALAXY", "ROCKET", "CRYSTAL", "DYNAMIC", "NETWORK",
  "LIGHTNING", "COMPUTER", "PHANTOM", "TRIANGLE", "JOURNEY", "SILENCE",
  "VICTORY", "HARMONY", "SHADOW", "ORBITAL", "THUNDER", "FREEDOM",
  "WHISPER", "PYRAMID", "ECLIPSE", "HORIZON", "VOLCANO", "GLACIER",
  "SPECTRUM", "GRAVITY", "BEACON", "COMPASS", "MONSTER", "SOLARIS",
  "CHAMPION", "MAGICAL", "COMPLEX", "ELEMENT", "TREASURE", "PIONEER",
  "PARADOX", "SPELLBOUND", "DISCOVERY", "SATELLITE", "NEBULA", "AVALANCHE"
];

/**
 * Returns a random word from the dictionary.
 * @param {string[]} [usedWords=[]] List of words already used in the current match to avoid repetition.
 * @returns {string} Target word in uppercase.
 */
function getRandomWord(usedWords = []) {
  const available = WORD_BANK.filter(w => !usedWords.includes(w));
  const pool = available.length > 0 ? available : WORD_BANK;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex].toUpperCase();
}

module.exports = {
  WORD_BANK,
  getRandomWord
};
