// BotBox backend boot.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

function start({ port, dataDir } = {}) {
  const masterKey = process.env.BOTBOX_MASTER_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(masterKey || '')) {
    console.error('[botbox] BOTBOX_MASTER_KEY must be 64 hex chars (32 bytes)');
    process.exit(1);
  }

  const db = require('./db');
  db.init(dataDir || process.env.BOTBOX_DATA_DIR || path.join(__dirname, '..', 'data'));

  const engine = require('./engine');
  engine.init(masterKey);
  engine.startAll().catch((e) => console.error('[botbox] engine startAll:', e.message));

  const createRoutes = require('./routes');
  const createAdminRoutes = require('./admin');
  const app = express();
  app.set('trust proxy', 1); // behind nginx — lets rate-limit see the real client IP
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    message: { ok: false, error: 'rate limited, try again soon' },
  }));
  app.use('/api', createRoutes(engine, masterKey));
  app.use('/api/admin', createAdminRoutes(engine));

  const listenPort = port || Number(process.env.PORT) || 3100;
  const server = app.listen(listenPort, () => {
    const addr = server.address();
    console.log(`[botbox] listening on :${addr.port}`);
  });

  const shutdown = () => {
    console.log('[botbox] shutting down');
    engine.stopAll();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return { app, server, engine, db };
}

if (require.main === module) {
  start();
}

module.exports = { start };
