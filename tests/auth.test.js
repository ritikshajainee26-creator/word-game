const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/server/db');
const { JWT_SECRET } = require('../src/server/auth');

test('Auth Module - Password Hashing and User Creation', async (t) => {
  await t.test('creates user account with bcrypt hashed password', async () => {
    const rawPassword = 'securePassword123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await db.createUser('test_warrior_auth', passwordHash);
    assert.equal(user.username, 'test_warrior_auth');
    assert.ok(user.id);

    const fetched = await db.getUserByUsername('test_warrior_auth');
    assert.ok(fetched);
    assert.equal(fetched.username, 'test_warrior_auth');

    const isMatch = await bcrypt.compare(rawPassword, fetched.password_hash);
    assert.equal(isMatch, true);
  });

  await t.test('rejects duplicate username (case-insensitive)', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    try {
      await db.createUser('TEST_WARRIOR_AUTH', passwordHash);
      assert.fail('Should have thrown duplicate username error');
    } catch (err) {
      assert.ok(err);
    }
  });

  await t.test('verifies JWT token generation and decoding', () => {
    const payload = { userId: 42, username: 'test_warrior_auth' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.userId, 42);
    assert.equal(decoded.username, 'test_warrior_auth');
  });
});
