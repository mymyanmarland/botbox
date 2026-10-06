// All /api routes (zod-validated). Mounted at /api by index.js.
const express = require('express');
const { z } = require('zod');
const db = require('./db');
const crypto = require('./crypto');
const ssrf = require('./ssrf');
const relay = require('./relay');
const personas = require('./personas');

const tokenSchema = z.string().min(20).max(200);
const urlSchema = z.string().min(1).max(500);
const keySchema = z.string().min(1).max(500);
const modelSchema = z.string().min(1).max(200);

function zodError(e) {
  return e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
}

module.exports = function createRoutes(engine, masterKey) {
  const router = express.Router();

  const bySecret = (req, res) => {
    const row = db.getBotBySecret(req.params.secret);
    if (!row) { res.status(404).json({ ok: false, error: 'not found' }); return null; }
    return row;
  };

  // ---- health ----
  router.get('/health', (req, res) => res.json({ ok: true }));

  // ---- validate a Telegram bot token via getMe ----
  router.post('/bots/validate-token', async (req, res) => {
    const p = z.object({ token: tokenSchema }).safeParse(req.body);
    if (!p.success) return res.json({ ok: false, error: zodError(p.error) });
    const r = await relay.telegramGetMe(p.data.token.trim());
    res.json(r);
  });

  // ---- probe an AI relay key ----
  router.post('/bots/probe', async (req, res) => {
    const p = z.object({ base_url: urlSchema, api_key: keySchema, model: modelSchema }).safeParse(req.body);
    if (!p.success) return res.json({ ok: false, error: zodError(p.error) });
    let baseUrl;
    try {
      baseUrl = await ssrf.assertSafeUrl(p.data.base_url);
    } catch (e) {
      return res.json({ ok: false, error: e.message });
    }
    const r = await relay.probe(baseUrl, p.data.api_key.trim(), p.data.model.trim());
    res.json(r);
  });

  router.post('/bots/models', async (req, res) => {
    const p = z.object({ base_url: urlSchema, api_key: keySchema }).safeParse(req.body);
    if (!p.success) return res.json({ ok: false, error: zodError(p.error) });
    let baseUrl;
    try {
      baseUrl = await ssrf.assertSafeUrl(p.data.base_url);
    } catch (e) {
      return res.json({ ok: false, error: e.message });
    }
    const r = await relay.listModels(baseUrl, p.data.api_key.trim());
    res.json(r);
  });

  // ---- create a bot ----
  router.post('/bots', async (req, res) => {
    const p = z.object({
      token: tokenSchema,
      persona_id: z.enum(personas.ids()).optional(),
      custom_prompt: z.string().max(4000).optional(),
      base_url: urlSchema,
      api_key: keySchema,
      model: modelSchema,
      image_model: z.string().max(200).optional(),
    }).safeParse(req.body);
    if (!p.success) return res.json({ ok: false, error: zodError(p.error) });
    const d = p.data;

    const me = await relay.telegramGetMe(d.token.trim());
    if (!me.ok) return res.json({ ok: false, error: 'bot token: ' + me.error });

    let baseUrl;
    try {
      baseUrl = await ssrf.assertSafeUrl(d.base_url);
    } catch (e) {
      return res.json({ ok: false, error: e.message });
    }
    const probe = await relay.probe(baseUrl, d.api_key.trim(), d.model.trim());
    if (!probe.ok) return res.json({ ok: false, error: 'AI key probe failed: ' + probe.error });

    const manageSecret = crypto.newManageSecret();
    const id = db.createBot({
      name: me.name,
      username: me.username,
      token_enc: crypto.encrypt(d.token.trim(), masterKey),
      persona_id: d.persona_id || 'friendly',
      custom_prompt: (d.custom_prompt || '').trim() || null,
      base_url: baseUrl,
      key_enc: crypto.encrypt(d.api_key.trim(), masterKey),
      model: d.model.trim(),
      image_model: (d.image_model || '').trim() || null,
      manage_secret: manageSecret,
    });
    const row = db.getBotById(id);
    const started = await engine.startBot(row);
    if (!started.ok) {
      // bot saved but poller failed (e.g. token revoked) — keep row, mark stopped
      db.setBotStatus(id, 'stopped');
      return res.json({ ok: false, error: 'bot saved but failed to start: ' + started.error, bot_id: id, manage_secret: manageSecret });
    }
    res.json({ ok: true, bot_id: id, username: me.username, manage_secret: manageSecret });
  });

  // ---- read bot (masked key) ----
  router.get('/bots/:secret', (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    let masked = '****';
    try { masked = crypto.maskKey(crypto.decrypt(row.key_enc, masterKey)); } catch { /* ignore */ }
    res.json({
      ok: true,
      id: row.id,
      name: row.name,
      username: row.username,
      status: engine.isRunning(row.id) ? 'running' : row.status,
      persona_id: row.persona_id,
      custom_prompt: row.custom_prompt,
      base_url: row.base_url,
      model: row.model,
      key_masked: masked,
      allowed_users: row.allowed_users || '',
      image_model: row.image_model || '',
      created_at: row.created_at,
    });
  });

  // ---- update bot (re-probe if key/model/base_url changed) ----
  router.patch('/bots/:secret', async (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    const p = z.object({
      persona_id: z.enum(personas.ids()).optional(),
      custom_prompt: z.string().max(4000).nullable().optional(),
      base_url: urlSchema.optional(),
      api_key: keySchema.optional(),
      model: modelSchema.optional(),
      allowed_users: z.string().max(2000).optional(),
      image_model: z.string().max(200).nullable().optional(),
    }).safeParse(req.body);
    if (!p.success) return res.json({ ok: false, error: zodError(p.error) });
    const d = p.data;

    const effBase = d.base_url !== undefined ? d.base_url.trim() : row.base_url;
    const effModel = d.model !== undefined ? d.model.trim() : row.model;
    let effKeyEnc = row.key_enc;
    let effKeyPlain = null;
    if (d.api_key !== undefined) {
      effKeyPlain = d.api_key.trim();
      effKeyEnc = crypto.encrypt(effKeyPlain, masterKey);
    }

    if (d.base_url !== undefined || d.api_key !== undefined || d.model !== undefined) {
      let safeBase;
      try {
        safeBase = await ssrf.assertSafeUrl(effBase);
      } catch (e) {
        return res.json({ ok: false, error: e.message });
      }
      if (effKeyPlain === null) {
        try { effKeyPlain = crypto.decrypt(row.key_enc, masterKey); }
        catch { return res.json({ ok: false, error: 'stored key decrypt failed' }); }
      }
      const probe = await relay.probe(safeBase, effKeyPlain, effModel);
      if (!probe.ok) return res.json({ ok: false, error: 'AI key probe failed: ' + probe.error });
      db.updateBot(row.id, { base_url: safeBase, key_enc: effKeyEnc, model: effModel });
    }

    const rest = {};
    if (d.persona_id !== undefined) rest.persona_id = d.persona_id;
    if (d.custom_prompt !== undefined) rest.custom_prompt = (d.custom_prompt || '').trim() || null;
    if (d.allowed_users !== undefined) rest.allowed_users = engine.parseAllowedUsers(d.allowed_users);
    if (d.image_model !== undefined) rest.image_model = (d.image_model || '').trim() || null;
    if (Object.keys(rest).length) db.updateBot(row.id, rest);

    res.json({ ok: true });
  });

  // ---- start / stop ----
  router.post('/bots/:secret/start', async (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    const r = await engine.startBot(db.getBotById(row.id));
    if (!r.ok) return res.json({ ok: false, error: r.error });
    db.setBotStatus(row.id, 'running');
    res.json({ ok: true, status: 'running' });
  });

  router.post('/bots/:secret/stop', (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    engine.stopBot(row.id);
    db.setBotStatus(row.id, 'stopped');
    res.json({ ok: true, status: 'stopped' });
  });

  // ---- rotate manage secret ----
  router.post('/bots/:secret/rotate', (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    const next = crypto.newManageSecret();
    db.rotateSecret(row.id, next);
    res.json({ ok: true, manage_secret: next });
  });

  // ---- delete bot ----
  router.post('/bots/:secret/delete', (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    engine.stopBot(row.id);
    db.deleteBot(row.id);
    res.json({ ok: true });
  });

  // ---- stats ----
  router.get('/bots/:secret/stats', (req, res) => {
    const row = bySecret(req, res);
    if (!row) return;
    res.json({
      ok: true,
      total_messages: db.totalMessages(row.id),
      today_messages: db.getUsage(row.id),
    });
  });

  return router;
};
