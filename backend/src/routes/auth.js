const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { authRequired, signToken } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'COP', 'MXN']);

router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'email and password (min 6 chars) are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(
      "INSERT INTO users (email, password_hash, currency) VALUES (?, ?, 'USD')"
    ).run(normalizedEmail, passwordHash);
    const userId = result.lastInsertRowid;
    db.seedDefaultsForUser(userId);
    const token = signToken(userId);
    const user = db.prepare('SELECT id, email, currency, created_at FROM users WHERE id = ?').get(userId);
    return res.status(201).json({ token, user });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    throw error;
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const row = db.prepare('SELECT id, email, password_hash, currency, created_at FROM users WHERE email = ?').get(normalizedEmail);
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(row.id);
  return res.json({
    token,
    user: { id: row.id, email: row.email, currency: row.currency, created_at: row.created_at },
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, email, currency, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

router.patch('/preferences', authRequired, (req, res) => {
  const { currency } = req.body;
  if (!currency || !ALLOWED_CURRENCIES.has(String(currency).toUpperCase())) {
    return res.status(400).json({ error: 'Invalid currency' });
  }

  const normalized = String(currency).toUpperCase();
  db.prepare('UPDATE users SET currency = ? WHERE id = ?').run(normalized, req.user.id);
  const user = db.prepare('SELECT id, email, currency, created_at FROM users WHERE id = ?').get(req.user.id);
  return res.json({ user });
});

router.post('/change-password', authRequired, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || String(new_password).length < 6) {
    return res.status(400).json({ error: 'current_password and new_password (min 6 chars) are required' });
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const ok = bcrypt.compareSync(current_password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user.id);
  return res.json({ ok: true });
});

router.post('/reset-password/request', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.json({ ok: true, message: 'If the email exists, a reset token has been generated.' });

  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, token, expiresAt);

  return res.json({
    ok: true,
    message: 'Reset token generated.',
    reset_token: token,
  });
});

router.post('/reset-password/confirm', (req, res) => {
  const { email, token, new_password } = req.body;
  if (!email || !token || !new_password || String(new_password).length < 6) {
    return res.status(400).json({ error: 'email, token and new_password (min 6 chars) are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(400).json({ error: 'Invalid reset token' });

  const resetRow = db.prepare(`
    SELECT id, expires_at, used_at
    FROM password_reset_tokens
    WHERE user_id = ? AND token = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(user.id, token);
  if (!resetRow || resetRow.used_at) return res.status(400).json({ error: 'Invalid reset token' });
  if (new Date(resetRow.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Reset token expired' });
  }

  const passwordHash = bcrypt.hashSync(new_password, 10);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(resetRow.id);
  });
  tx();

  return res.json({ ok: true });
});

module.exports = router;
