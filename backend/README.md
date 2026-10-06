# BotBox backend (MVP)

Node 22+ · Express 5 · Telegraf · node:sqlite · plain JS (CJS), same style as zawgyi-claw-bot.

## Run

```bash
npm install
BOTBOX_MASTER_KEY=<64 hex chars> PORT=3100 npm start
# smoke test (temp DB, fake key — no Telegram/AI calls that can crash):
npm run smoke
```

Generate a master key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Env

| Var | Required | Notes |
|---|---|---|
| `BOTBOX_MASTER_KEY` | yes | 64 hex chars; encrypts bot tokens + API keys (`gcm$iv$tag$enc`) |
| `PORT` | no | default 3100 |
| `BOTBOX_DATA_DIR` | no | default `./data` |

## Layout

- `src/index.js` — boot: master-key check, db init, engine.startAll(), routes
- `src/db.js` — node:sqlite: `bots`, `messages`, `usage`
- `src/crypto.js` — AES-256-GCM, same format as zawgyi
- `src/ssrf.js` — base_url guard (http/https, no creds, no private/loopback IP via dns.lookup)
- `src/relay.js` — `probe` (POST /models, 10s), `chat` (POST /chat/completions, 60s), `telegramGetMe`
- `src/engine.js` — BotManager: per-bot Telegraf pollers, 100 msgs/day limit, last-20 history, reply split at 4000 chars
- `src/routes.js` — `/api/*` endpoints per Feature.md (zod-validated, 60 req/min/IP)
- `src/personas.js` — 4 Burmese-first persona presets

## API

See `~/workspace/botbox/Feature.md` §5. Manage secret: 32 random bytes hex, in URL path `/api/bots/:secret`.
