// Owner admin panel routes. Password-protected via scrypt-hashed password
// (first-run setup) and Bearer session tokens. NEVER exposes token_enc,
// key_enc, or manage_secret — db helpers only select public columns.
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Sessions are persisted in SQLite (admin_sessions) so a backend restart
// does not log the owner out. Only the SHA-256 of the token is stored.
function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const parts = (stored || '').split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const got = crypto.scryptSync(password, salt, 64);
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  db.createAdminSession(tokenHash(token), Date.now() + SESSION_TTL_MS);
  return token;
}

function sessionValid(token) {
  return db.getAdminSession(tokenHash(token)) !== null;
}

function dropSession(token) {
  db.deleteAdminSession(tokenHash(token));
}

module.exports = function createAdminRoutes(engine) {
  const router = express.Router();

  // Aggressive rate limit on password-guessing routes: 10 attempts / 15 min / IP.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    message: { ok: false, error: 'too many attempts, try again later' },
  });

  const requireAdmin = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m || !sessionValid(m[1])) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    next();
  };

  // ---- setup state ----
  router.get('/status', (req, res) => {
    res.json({ setupRequired: !db.metaGet('admin_pw_hash') });
  });

  // ---- first-run password setup (only while no hash exists) ----
  router.post('/setup', authLimiter, (req, res) => {
    if (db.metaGet('admin_pw_hash')) {
      return res.status(400).json({ ok: false, error: 'admin already set up' });
    }
    const p = z.object({ password: z.string().min(10).max(200) }).safeParse(req.body);
    if (!p.success) {
      return res.status(400).json({ ok: false, error: 'password must be at least 10 characters' });
    }
    db.metaSet('admin_pw_hash', hashPassword(p.data.password));
    res.json({ ok: true, token: newSession() });
  });

  // ---- login ----
  router.post('/login', authLimiter, (req, res) => {
    const p = z.object({ password: z.string().min(1).max(200) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ ok: false, error: 'password required' });
    const stored = db.metaGet('admin_pw_hash');
    if (!stored || !verifyPassword(p.data.password, stored)) {
      return res.status(401).json({ ok: false, error: 'wrong password' });
    }
    res.json({ ok: true, token: newSession() });
  });

  // ---- logout ----
  router.post('/logout', (req, res) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (m) dropSession(m[1]);
    res.json({ ok: true });
  });

  // ---- fleet stats ----
  router.get('/stats', requireAdmin, (req, res) => {
    const bots = db.listBotsPublic();
    res.json({
      ok: true,
      botsTotal: db.countBots(),
      running: bots.filter(b => engine.isRunning(b.id)).length,
      messagesToday: db.messagesTodayTotal(),
      messagesTotal: db.messagesTotal(),
    });
  });

  // ---- bot list (public columns only — no secrets) ----
  router.get('/bots', requireAdmin, (req, res) => {
    const bots = db.listBotsPublic().map(b => ({
      ...b,
      status: engine.isRunning(b.id) ? 'running' : b.status,
      totalMessages: db.totalMessages(b.id),
      todayUsage: db.getUsage(b.id),
    }));
    res.json({ ok: true, bots });
  });

  // ---- start / stop ----
  router.post('/bots/:id/start', requireAdmin, async (req, res) => {
    const row = db.getBotById(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'not found' });
    const r = await engine.startBot(row);
    if (!r.ok) return res.json({ ok: false, error: r.error });
    db.setBotStatus(row.id, 'running');
    res.json({ ok: true, status: 'running' });
  });

  router.post('/bots/:id/stop', requireAdmin, (req, res) => {
    const row = db.getBotById(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'not found' });
    engine.stopBot(row.id);
    db.setBotStatus(row.id, 'stopped');
    res.json({ ok: true, status: 'stopped' });
  });

  // ---- delete ----
  router.delete('/bots/:id', requireAdmin, (req, res) => {
    const row = db.getBotById(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'not found' });
    engine.stopBot(row.id);
    db.deleteBot(row.id);
    res.json({ ok: true });
  });

  // ---- recent messages across users (support view), limit 1..100 ----
  router.get('/bots/:id/messages', requireAdmin, (req, res) => {
    const row = db.getBotById(Number(req.params.id));
    if (!row) return res.status(404).json({ ok: false, error: 'not found' });
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    res.json({ ok: true, messages: db.recentMessages(row.id, limit) });
  });

  return router;
};
