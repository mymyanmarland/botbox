# BotBox — Feature.md (MVP)

**Vision:** 5-minute AI Telegram bot builder. Pick a persona, paste a bot token, deploy — your bot is alive. No code.

**Stack:** Tech Stack 2 backend (Node 22 + Express 5, plain JS like zawgyi-claw-bot, node:sqlite for MVP) + Stack 4 frontend (React 19 + Vite + Tailwind v4 + TypeScript). Bilingual my/en (Burmese default), responsive mobile-first, clean Meta/Funapp style (white, red #e11d2e accents).

## MVP scope (in)
1. **Landing page** `/` — hero, 3-step how-it-works, persona preview cards, FAQ, CTA → `/build`.
2. **Builder wizard** `/build` — 3 steps:
   - Step 1: Bot token (from @BotFather) → validate via Telegram `getMe`, show bot name/@username.
   - Step 2: Persona — 4 presets (cards, bilingual) + custom system-prompt textarea.
   - Step 3: AI model — base URL (default `https://sapi.zly168.cn/v1`; free text — RelayModels or any OpenAI-compatible endpoint also works), API key (BYO), model name (text input + suggestions). **Probe** the key before deploy (like zawgyi `/setapi` probe).
   - Deploy → success screen: bot username + `t.me` link + **secret management link** (copy button).
3. **Bot dashboard** `/manage/:secret` — status pill (running/stopped), stats (total messages, today), start/stop, edit persona/prompt/model/key, rotate secret, delete bot.
4. **Engine** — multi-bot Telegraf pollers; per-bot chat with per-user last-20 message memory; **no free-tier cap** (BYO relay API key model — keys sold by Funapp); AES-256-GCM for bot tokens + API keys (zawgyi `gcm$iv$tag$enc` format, key from `BOTBOX_MASTER_KEY` env, 64 hex chars); SSRF guard on base_url (http/https only, block private IPs).
5. **API** (Express, zod validation, rate-limit 60/min/IP):
   - `POST /api/bots/validate-token {token}` → `{ok, name, username}` / `{ok:false, error}`
   - `POST /api/bots/probe {base_url, api_key, model}` → `{ok}` / `{ok:false, error}`
   - `POST /api/bots {token, persona_id?, custom_prompt?, base_url, api_key, model}` → `{bot_id, username, manage_secret}` (manage URL built client-side)
   - `GET /api/bots/:secret` → `{id, name, username, status, persona_id, custom_prompt, base_url, model, key_masked, created_at}`
   - `PATCH /api/bots/:secret` → update persona/prompt/base_url/api_key/model (re-probe if key/model changed)
   - `POST /api/bots/:secret/start|stop|rotate|delete`
   - `GET /api/bots/:secret/stats` → `{total_messages, today_messages, limit}`
   - `GET /api/health` → `{ok:true}`
6. **Personas** (bilingual, Burmese-first system prompts):
   - `friendly` 🌸 ဖော်ရွေ — warm/playful female assistant, Burmese-first
   - `pro` 💼 ပညာရှင် — concise professional assistant
   - `seller` 🛍️ အရောင်းဝန်ထမ်း — Burmese sales tone, answers product questions, closes with call-to-action
   - `teacher` 📚 ဆရာ — explains simply with analogies, patient
   - custom prompt textarea overrides preset.

## Out of MVP
User accounts, payments/subscriptions, image generation, voice transcription, reminders/cron, multi-admin, Postgres migration (SQLite is fine for MVP scale).

## Security rules
- Secrets (bot token, API key) AES-256-GCM encrypted at rest; never logged; API returns masked key only.
- Manage secret: `crypto.randomBytes(32)` hex — unguessable; rotate supported.
- SSRF: base_url must be http/https, no private/loopback/link-local IPs, no credentials in URL.
- Rate-limit builder endpoints; Helmet + CORS.
- Bot replies: split >4000 chars; ignore non-text messages in MVP.

## Engine message flow
1. Telegram text message → find bot by token → record usage stats → fetch per-user last-20 history → relay chat → save reply.
2. Load last 20 messages from `messages` table → decrypt API key → POST `{base_url}/chat/completions` (OpenAI-compatible) with system prompt + history.
3. Save user + assistant messages → reply (split long).
4. `/start` → persona greeting (first line of system prompt or default bilingual greeting).

## DB tables (node:sqlite)
- `bots(id, name, username, token_enc, persona_id, custom_prompt, base_url, key_enc, model, manage_secret, status, created_at, updated_at)`
- `messages(id, bot_id, user_id, role, content, created_at)` + index(bot_id, user_id, id)
- `usage(bot_id, day, count)` PK(bot_id, day)
- `meta(k, v)` — owner admin settings (admin password hash)

## Per-user memory (2026-10-06)
- `messages` is keyed by `(bot_id, user_id)` — each Telegram user's last-20 conversation is separate. `user_id` is the Telegram numeric user id (`anon` fallback).
- Migration is automatic on boot: `ALTER TABLE messages ADD COLUMN user_id` if missing; legacy rows keep `user_id = ''` and are invisible to per-user queries (visible in the admin messages viewer).
- Pruning: last 200 messages kept per (bot, user). Usage stats kept per-bot for the admin panel (no cap enforced).

## Owner admin panel (2026-10-06)
- Route `#/admin` (subtle link in the footer). Password-protected; the owner sets the password on first run (≥10 chars) — the agent never sees or chooses it.
- Password stored as salted scrypt hash in `meta(admin_pw_hash)`. Login returns a 32-byte hex Bearer token (7-day TTL, persisted in SQLite `admin_sessions` — survives backend restarts; only the SHA-256 of the token is stored).
- Login/setup rate-limited: 10 attempts / 15 min / IP.
- Endpoints (all under `/api/admin`, Bearer auth except status/setup/login):
  - `GET /status`, `POST /setup {password}`, `POST /login {password}`, `POST /logout`
  - `GET /stats` → `{botsTotal, running, messagesToday, messagesTotal}`
  - `GET /bots` → public columns only (never `token_enc`/`key_enc`/`manage_secret`) + `totalMessages`, `todayUsage`
  - `POST /bots/:id/start|stop`, `DELETE /bots/:id`, `GET /bots/:id/messages?limit=50` (limit clamped 1..100)
- Frontend `src/pages/Admin.tsx`: setup form → login form → dashboard with glass stat cards, per-bot start/stop/delete (confirm), expandable per-bot recent-messages viewer (shows `user_id` per message), logout. Token persisted in `localStorage` (`botbox_admin_token`).

## Image generation via /imagine (2026-10-06)
- Per-bot `image_model` column (nullable; empty = `/imagine` disabled with a friendly bilingual message).
- Command: `/imagine <description>` — registered BEFORE the text handler (same ordering lesson as `/myid`).
- Respects the `allowed_users` allowlist (unauthorized → bilingual "not authorized", no relay call).
- Flow: bilingual "generating…" notice → `POST {baseUrl}/images/generations {model, prompt}` (120s timeout) → sends photo via `replyWithPhoto` (supports `b64_json` and `url` responses) → caption = prompt.
- Counts toward usage stats; user message stored as `/imagine <prompt>`, assistant reply stored as `[image] <prompt>`.
- UI is a simple ON/OFF toggle (fixed model `grok-imagine-image-2.0` — no typing needed): set at build time (step 3) or later via the management dashboard. OFF (default) = disabled; ON = model saved. Existing bots need the toggle switched on manually.

## Persona presets — 34 total (2026-10-06)
- 4 original: friendly 🌸, pro 💼, seller 🛍️, teacher 📚
- 30 added: lover 💕, buddy 🗣️, empath 🤗, doctor 🩺, programmer 💻, reporter 📰, chef 🍳, fitness 💪, finance 💰, lawyer ⚖️, translator 🌐, english_teacher 🔤, math_tutor 🔢, marketer 📣, designer 🎨, writer ✍️, poet 🪶, comedian 😂, storyteller 📖, motivator 🔥, career 🧭, interviewer 🎤, debater 🗯️, historian 🏛️, scientist 🔬, philosopher 🤔, traveler ✈️, astrologer 🔮, parent 👪, therapist 🧠
- Each has a bilingual Burmese-first system prompt. Sensitive ones (doctor/lawyer/therapist/finance) include "not a substitute for a licensed professional" instructions.
- Backend: `src/personas.js` (`find()` falls back to `friendly`; `ids()` feeds the zod enum in routes.js). Frontend: `PERSONAS` array + `persona.<id>.name/desc` keys in both languages.

## Landing redesign — personas + SVG animation (2026-10-06)
- `src/components/HeroArt.tsx`: `HeroBackdrop` (drifting red glow orbs + 10 twinkling SVG stars) and `BotMascot` (SVG robot head with blinking eyes via CSS `blink` keyframes, floating, pulsing antenna light). Mascot replaces the static emoji avatar in the hero chat mock.
- `src/components/PersonasSection.tsx`: count badge, infinite `marquee` pill strip of all 34 personas (pauses on hover, edge fade mask), 8 featured gradient-glow cards (staggered fade-up, hover lift), expander button revealing the remaining 26 as compact cards.
- New CSS keyframes in `index.css`: `marquee`, `blink`, `twinkle`, `drift-a/b` + `.svg-origin` helper (transform-box: fill-box).
- New i18n keys: `personas.count/featured/all/show_all/show_less` (my+en).

## Cute robot logo (2026-10-06)
- New `src/components/Logo.tsx`: kawaii robot head on a red-gradient squircle — heart antenna tip, big sparkly eyes, pink blush, happy smile.
- Header (Layout.tsx) uses `<Logo/>` instead of the plain "B" square, with red glow (intensifies on hover).
- `public/favicon.svg` replaced (was an unrelated purple lightning bolt) with the same robot artwork.
