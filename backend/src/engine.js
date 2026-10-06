// BotManager: multi-bot Telegraf pollers, per-bot chat with per-user memory.
// No free-tier cap — bot owners supply their own relay API key.
const { Telegraf } = require('telegraf');
const db = require('./db');
const crypto = require('./crypto');
const relay = require('./relay');
const personas = require('./personas');

const REPLY_CHUNK = 4000;

let masterKey = null;
const running = new Map(); // botId -> Telegraf instance

// Race a promise against a timeout so a hanging Telegram launch can't
// stall an HTTP request forever (nginx would 504 and the user would never
// receive their manage link).
function withTimeout(promise, ms, message) {
  let timer;
  const gate = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  const settled = promise.then(
    (v) => { clearTimeout(timer); return v; },
    (e) => { clearTimeout(timer); throw e; }
  );
  return Promise.race([settled, gate]);
}

function init(key) {
  masterKey = key;
}

function systemPromptFor(row) {
  if (row.custom_prompt && row.custom_prompt.trim()) return row.custom_prompt.trim();
  return personas.find(row.persona_id).prompt;
}

function greetingFor(row) {
  const sys = systemPromptFor(row);
  const first = (sys.split('\n').map(l => l.trim()).find(l => l) || '');
  if (first.length > 0 && first.length < 200 &&
      /^(မင်္ဂလာ|မဂ်လာ|hello|hi\b|ဟယ်လို|hey)\b/i.test(first)) {
    return first;
  }
  const name = row.name || 'BotBox';
  return `မင်္ဂလာပါ! 👋 ကျွန်တော် ${name} ပါ။\nHello! I'm ${name}. How can I help you today?`;
}

// ---- access control ----
// allowed_users: comma-separated Telegram user IDs; empty/null = public.
function parseAllowedUsers(raw) {
  const ids = String(raw || '').split(/[,\s]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
  return [...new Set(ids)].join(',');
}
function isAllowed(allowedUsers, userId) {
  if (!allowedUsers || !String(allowedUsers).trim()) return true; // public
  return String(allowedUsers).split(',').includes(String(userId));
}
const NOT_ALLOWED_MSG =
  '🔒 ဒီ bot ကို သုံးခွင့်မရှိသေးပါ။ Bot ပိုင်ရှင်ကို ဆက်သွယ်ပါ။\n🔒 You are not authorized to use this bot. Please contact the bot owner.';
const MYID_MSG = id =>
  `🆔 မင်း Telegram ID: ${id}\nဒီ ID ကို bot ပိုင်ရှင်ကို ပေးလိုက်ပါ။\n🆔 Your Telegram ID: ${id}\nSend this ID to the bot owner.`;
const IMAGINE_USAGE =
  '🎨 ပုံထုတ်ချင်ရင်: /imagine <ဖော်ပြချက်>\n🎨 To generate an image: /imagine <description>\nဥပမာ: /imagine sunset over Bagan temples';
const IMAGINE_DISABLED =
  '🖼️ ဒီ bot မှာ ပုံထုတ်ခြင်း မဖွင့်ထားသေးပါ။\n🖼️ Image generation is not enabled for this bot.';
const IMAGINE_WORKING =
  '🎨 ပုံထုတ်နေပါတယ်, ခဏစောင့်...\n🎨 Generating your image, one moment...';

function splitReply(text, n = REPLY_CHUNK) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out.length ? out : [''];
}

async function handleText(botId, ctx) {
  const row = db.getBotById(botId);
  if (!row || row.status !== 'running') return;
  const text = (ctx.message && ctx.message.text ? ctx.message.text : '').trim();
  if (!text) return;
  const userId = String(ctx.from && ctx.from.id != null ? ctx.from.id : 'anon');

  if (!isAllowed(row.allowed_users, userId)) {
    await ctx.reply(NOT_ALLOWED_MSG).catch(() => {});
    return;
  }

  db.bumpUsage(botId); // usage stats only — no free-tier cap (BYO API key model)
  db.addMessage(botId, userId, 'user', text);

  let apiKey;
  try {
    apiKey = crypto.decrypt(row.key_enc, masterKey);
  } catch (e) {
    await ctx.reply('⚙️ API key error — please re-enter it in the bot dashboard.').catch(() => {});
    return;
  }

  const history = db.getRecentMessages(botId, userId, 20).map(m => ({ role: m.role, content: m.content }));
  const messages = [{ role: 'system', content: systemPromptFor(row) }, ...history];

  await ctx.sendChatAction('typing').catch(() => {});
  const r = await relay.chat(row.base_url, apiKey, row.model, messages);
  if (!r.ok) {
    await ctx.reply('⚠️ AI error: ' + r.error).catch(() => {});
    return;
  }
  db.addMessage(botId, userId, 'assistant', r.text);
  for (const chunk of splitReply(r.text)) {
    await ctx.reply(chunk).catch(() => {});
  }
}

async function startBot(row) {
  if (!row || running.has(row.id)) return { ok: true, already: true };
  let token;
  try {
    token = crypto.decrypt(row.token_enc, masterKey);
  } catch (e) {
    console.error(`[engine] bot ${row.id}: token decrypt failed`);
    return { ok: false, error: 'token decrypt failed' };
  }
  const tg = new Telegraf(token);
  tg.start(async (ctx) => {
    const fresh = db.getBotById(row.id);
    if (!fresh || fresh.status !== 'running') return;
    await ctx.reply(greetingFor(fresh)).catch(() => {});
  });
  // /imagine works even for non-allowed users so they can send their ID to the owner.
  // NOTE: registered BEFORE the text handler — the text handler returns early
  // on '/' messages without calling next(), which would swallow commands.
  tg.command('myid', async (ctx) => {
    const uid = ctx.from && ctx.from.id != null ? String(ctx.from.id) : 'unknown';
    await ctx.reply(MYID_MSG(uid)).catch(() => {});
  });
  tg.command('imagine', async (ctx) => {
    const fresh = db.getBotById(row.id);
    if (!fresh || fresh.status !== 'running') return;
    const uid = String(ctx.from && ctx.from.id != null ? ctx.from.id : 'anon');
    if (!isAllowed(fresh.allowed_users, uid)) {
      await ctx.reply(NOT_ALLOWED_MSG).catch(() => {});
      return;
    }
    const prompt = String((ctx.message && ctx.message.text) || '').replace(/^\/imagine(@\w+)?\s*/, '').trim();
    if (!prompt) {
      await ctx.reply(IMAGINE_USAGE).catch(() => {});
      return;
    }
    if (!fresh.image_model || !fresh.image_model.trim()) {
      await ctx.reply(IMAGINE_DISABLED).catch(() => {});
      return;
    }
    let apiKey;
    try {
      apiKey = crypto.decrypt(fresh.key_enc, masterKey);
    } catch (e) {
      await ctx.reply('⚙️ API key error — please re-enter it in the bot dashboard.').catch(() => {});
      return;
    }
    db.bumpUsage(row.id);
    db.addMessage(row.id, uid, 'user', '/imagine ' + prompt);
    await ctx.reply(IMAGINE_WORKING).catch(() => {});
    const r = await relay.generateImage(fresh.base_url, apiKey, fresh.image_model.trim(), prompt);
    if (!r.ok) {
      await ctx.reply('⚠️ ပုံထုတ်မရဘူး: ' + r.error + '\n⚠️ Could not generate the image: ' + r.error).catch(() => {});
      return;
    }
    try {
      if (r.b64) {
        await ctx.replyWithPhoto({ source: Buffer.from(r.b64, 'base64') }, { caption: prompt.slice(0, 200) }).catch(() => {});
      } else if (r.url) {
        await ctx.replyWithPhoto(r.url, { caption: prompt.slice(0, 200) }).catch(() => {});
      }
      db.addMessage(row.id, uid, 'assistant', '[image] ' + prompt.slice(0, 200));
    } catch (e) {
      await ctx.reply('⚠️ ပုံပို့မရဘူး: ' + e.message).catch(() => {});
    }
  });
  tg.on('text', async (ctx) => {
    const t = (ctx.message && ctx.message.text ? ctx.message.text : '').trim();
    if (t.startsWith('/')) return; // commands (e.g. /start) handled above
    try { await handleText(row.id, ctx); }
    catch (e) { console.error(`[engine] bot ${row.id} handler:`, e.message); }
  });
  tg.catch((err) => console.error(`[engine] bot ${row.id}:`, err.message));
  try {
    // Quick connectivity check. Do NOT await tg.launch(): in Telegraf v4
    // launch() awaits the polling loop, which never resolves while
    // long-polling — awaiting it hangs the HTTP request until nginx 504s
    // and the user never receives their manage link.
    await withTimeout(tg.telegram.getMe(), 15_000, 'Telegram getMe timed out (15s)');
  } catch (e) {
    console.error(`[engine] bot ${row.id} telegram check failed:`, e.message);
    return { ok: false, error: e.message };
  }
  // Fire-and-forget: polling runs in the background; launch() never resolves.
  tg.launch().catch((e) => console.error(`[engine] bot ${row.id} polling error:`, e.message));
  running.set(row.id, tg);
  console.log(`[engine] bot ${row.id} (@${row.username || '?'}) started`);
  return { ok: true };
}

function stopBot(botId) {
  const tg = running.get(botId);
  if (tg) {
    try { tg.stop(); } catch { /* ignore */ }
    running.delete(botId);
    console.log(`[engine] bot ${botId} stopped`);
  }
}

function stopAll() {
  for (const id of [...running.keys()]) stopBot(id);
}

function isRunning(botId) {
  return running.has(botId);
}

async function startAll() {
  const rows = db.listRunningBots();
  for (const row of rows) {
    await startBot(row);
  }
  console.log(`[engine] startAll done, ${running.size}/${rows.length} running`);
}

module.exports = { init, startBot, stopBot, stopAll, isRunning, startAll, parseAllowedUsers, isAllowed };
