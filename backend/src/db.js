// SQLite storage (node:sqlite): bots, messages, per-bot daily usage.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

let db;

function init(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(path.join(dataDir, 'botbox.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT,
      token_enc TEXT NOT NULL,
      persona_id TEXT NOT NULL DEFAULT 'friendly',
      custom_prompt TEXT,
      base_url TEXT NOT NULL,
      key_enc TEXT NOT NULL,
      model TEXT NOT NULL,
      manage_secret TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'running',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_bot ON messages(bot_id, id);
    CREATE TABLE IF NOT EXISTS usage (
      bot_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (bot_id, day)
    );
    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_exp ON admin_sessions(expires_at);
  `);
  // Migration: per-user memory — add user_id to messages if missing.
  // Legacy rows keep user_id = '' and become invisible to per-user queries.
  const cols = db.prepare('PRAGMA table_info(messages)').all().map(c => c.name);
  if (!cols.includes('user_id')) {
    db.exec(`ALTER TABLE messages ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_bot_user ON messages(bot_id, user_id, id)`);
  // Migration: access control — allowed_users on bots (comma-separated Telegram
  // user IDs; empty = public, anyone may chat).
  const botCols = db.prepare('PRAGMA table_info(bots)').all().map(c => c.name);
  if (!botCols.includes('allowed_users')) {
    db.exec(`ALTER TABLE bots ADD COLUMN allowed_users TEXT NOT NULL DEFAULT ''`);
  }
  // Image generation model per bot (NULL/empty = /imagine disabled).
  if (!botCols.includes('image_model')) {
    db.exec(`ALTER TABLE bots ADD COLUMN image_model TEXT`);
  }
  return db;
}

const now = () => Date.now();
const todayStr = () => new Date().toISOString().slice(0, 10);

function createBot({ name, username, token_enc, persona_id, custom_prompt, base_url, key_enc, model, image_model, manage_secret }) {
  const r = db.prepare(`INSERT INTO bots
    (name, username, token_enc, persona_id, custom_prompt, base_url, key_enc, model, image_model, manage_secret, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'running',?,?)`)
    .run(name || null, username || null, token_enc, persona_id || 'friendly',
      custom_prompt || null, base_url, key_enc, model, image_model || null, manage_secret, now(), now());
  return r.lastInsertRowid;
}

function getBotById(id) {
  return db.prepare('SELECT * FROM bots WHERE id = ?').get(id) || null;
}

function getBotBySecret(secret) {
  return db.prepare('SELECT * FROM bots WHERE manage_secret = ?').get(secret) || null;
}

function listRunningBots() {
  return db.prepare("SELECT * FROM bots WHERE status = 'running' ORDER BY id").all();
}

function updateBot(id, fields) {
  const allowed = ['persona_id', 'custom_prompt', 'base_url', 'key_enc', 'model', 'name', 'username', 'allowed_users', 'image_model'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (fields[k] !== undefined) { sets.push(`${k} = ?`); vals.push(fields[k]); }
  }
  if (!sets.length) return false;
  sets.push('updated_at = ?');
  vals.push(now(), id);
  const r = db.prepare(`UPDATE bots SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return r.changes > 0;
}

function setBotStatus(id, status) {
  db.prepare('UPDATE bots SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
}

function rotateSecret(id, newSecret) {
  db.prepare('UPDATE bots SET manage_secret = ?, updated_at = ? WHERE id = ?').run(newSecret, now(), id);
}

function deleteBot(id) {
  db.prepare('DELETE FROM messages WHERE bot_id = ?').run(id);
  db.prepare('DELETE FROM usage WHERE bot_id = ?').run(id);
  db.prepare('DELETE FROM bots WHERE id = ?').run(id);
}

function addMessage(botId, userId, role, content) {
  db.prepare('INSERT INTO messages (bot_id, user_id, role, content, created_at) VALUES (?,?,?,?,?)')
    .run(botId, String(userId ?? ''), role, content, now());
  // keep last 200 per (bot, user)
  db.prepare(`DELETE FROM messages WHERE bot_id = ? AND user_id = ? AND id NOT IN
              (SELECT id FROM messages WHERE bot_id = ? AND user_id = ? ORDER BY id DESC LIMIT 200)`)
    .run(botId, String(userId ?? ''), botId, String(userId ?? ''));
}

function getRecentMessages(botId, userId, limit = 20) {
  return db.prepare('SELECT role, content FROM messages WHERE bot_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?')
    .all(botId, String(userId ?? ''), limit).reverse();
}

function totalMessages(botId) {
  return db.prepare('SELECT COUNT(*) c FROM messages WHERE bot_id = ?').get(botId).c;
}

function bumpUsage(botId) {
  const day = todayStr();
  db.prepare(`INSERT INTO usage (bot_id, day, count) VALUES (?,?,1)
              ON CONFLICT(bot_id, day) DO UPDATE SET count = count + 1`).run(botId, day);
}

function getUsage(botId) {
  const row = db.prepare('SELECT count FROM usage WHERE bot_id = ? AND day = ?').get(botId, todayStr());
  return row ? row.count : 0;
}

// ---- meta key/value (owner admin settings) ----
function metaGet(k) {
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(k);
  return row ? row.v : null;
}

function metaSet(k, v) {
  db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);
}

// ---- admin session tokens (persisted so backend restarts don't log the owner out) ----
function createAdminSession(tokenHash, expiresAt) {
  db.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').run(tokenHash, expiresAt);
  db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now());
}

function getAdminSession(tokenHash) {
  const row = db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').get(tokenHash);
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return row.expires_at;
}

function deleteAdminSession(tokenHash) {
  db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
}

// ---- admin panel helpers (never expose encrypted secrets) ----
function listBotsPublic() {
  return db.prepare('SELECT id, name, username, persona_id, model, image_model, base_url, status, created_at, allowed_users FROM bots ORDER BY id').all();
}

function countBots() {
  return db.prepare('SELECT COUNT(*) c FROM bots').get().c;
}

function messagesTotal() {
  return db.prepare('SELECT COUNT(*) c FROM messages').get().c;
}

function messagesTodayTotal() {
  const row = db.prepare('SELECT COALESCE(SUM(count), 0) s FROM usage WHERE day = ?').get(todayStr());
  return row ? row.s : 0;
}

function recentMessages(botId, limit = 50) {
  const n = Math.max(1, Math.min(100, limit | 0 || 50));
  return db.prepare('SELECT user_id, role, content, created_at FROM messages WHERE bot_id = ? ORDER BY id DESC LIMIT ?')
    .all(botId, n);
}

module.exports = {
  init, createBot, getBotById, getBotBySecret, listRunningBots,
  updateBot, setBotStatus, rotateSecret, deleteBot,
  addMessage, getRecentMessages, totalMessages,
  bumpUsage, getUsage, todayStr,
  metaGet, metaSet,
  createAdminSession, getAdminSession, deleteAdminSession,
  listBotsPublic, countBots, messagesTotal, messagesTodayTotal, recentMessages,
};
