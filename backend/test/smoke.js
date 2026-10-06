// BotBox backend smoke test.
// Boots the app with a temp DB + fake master key, exercises key paths.
// Prints PASS/FAIL per check; exits non-zero on any failure.
const fs = require('fs');
const os = require('os');
const path = require('path');

const MASTER = 'ab'.repeat(32); // 64 hex chars, fake
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botbox-smoke-'));

process.env.BOTBOX_MASTER_KEY = MASTER;

const { start } = require('../src/index.js');
const db = require('../src/db.js');
const crypto = require('../src/crypto.js');
const ssrf = require('../src/ssrf.js');
const relay = require('../src/relay.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function post(port, p, body) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(port, p) {
  const res = await fetch(`http://127.0.0.1:${port}${p}`);
  return res.json();
}

(async () => {
  const { server, engine } = start({ port: 0, dataDir: tmpDir });
  await new Promise(r => server.on('listening', r));
  const port = server.address().port;

  // 1. health
  try {
    const h = await get(port, '/api/health');
    check('GET /api/health -> ok:true', h && h.ok === true, JSON.stringify(h));
  } catch (e) { check('GET /api/health -> ok:true', false, e.message); }

  // 2. crypto round-trip (gcm$iv$tag$enc format)
  try {
    const enc = crypto.encrypt('secret-token-123', MASTER);
    const dec = crypto.decrypt(enc, MASTER);
    check('crypto encrypt/decrypt round-trip', dec === 'secret-token-123' && enc.startsWith('gcm$'), enc.slice(0, 20));
    check('crypto maskKey', crypto.maskKey('sk-abcdef123456') === 'sk-****3456', crypto.maskKey('sk-abcdef123456'));
    let threw = false;
    try { crypto.decrypt(enc, 'cd'.repeat(32)); } catch { threw = true; }
    check('crypto decrypt with wrong key fails', threw);
  } catch (e) { check('crypto round-trip', false, e.message); }

  // 3. ssrf guard
  for (const [label, url, shouldThrow] of [
    ['ssrf blocks loopback', 'http://127.0.0.1:8080/x', true],
    ['ssrf blocks ftp', 'ftp://example.com/x', true],
    ['ssrf blocks creds in URL', 'https://user:pass@example.com/', true],
  ]) {
    let threw = false;
    try { await ssrf.assertSafeUrl(url); } catch { threw = true; }
    check(label, threw === shouldThrow);
  }

  // 4. validate-token with bad token -> ok:false, no crash
  try {
    const r = await post(port, '/api/bots/validate-token', { token: '123456:ABC-DEF_fake_token_000' });
    check('validate-token bad token -> ok:false', r && r.ok === false, JSON.stringify(r).slice(0, 120));
  } catch (e) { check('validate-token bad token -> ok:false', false, 'threw: ' + e.message); }

  // 5. probe with unreachable URL -> ok:false (DNS fail is fast)
  try {
    const r = await post(port, '/api/bots/probe', {
      base_url: 'http://nonexistent.invalid:9', api_key: 'sk-fake', model: 'x',
    });
    check('probe unreachable URL -> ok:false', r && r.ok === false, JSON.stringify(r).slice(0, 120));
  } catch (e) { check('probe unreachable URL -> ok:false', false, 'threw: ' + e.message); }

  // 6. probe with blocked loopback -> ok:false via ssrf
  try {
    const r = await post(port, '/api/bots/probe', {
      base_url: 'http://127.0.0.1:9', api_key: 'sk-fake', model: 'x',
    });
    check('probe loopback blocked -> ok:false', r && r.ok === false && /private|loopback/i.test(r.error || ''), JSON.stringify(r).slice(0, 120));
  } catch (e) { check('probe loopback blocked -> ok:false', false, 'threw: ' + e.message); }

  // 7. create bot row via db directly; engine must not crash on fake token
  const secret = crypto.newManageSecret();
  const botId = db.createBot({
    name: 'Smoke Bot', username: 'smoke_bot',
    token_enc: crypto.encrypt('999999:FAKE_TOKEN_FOR_SMOKE', MASTER),
    persona_id: 'friendly', custom_prompt: null,
    base_url: 'https://api.relaymodels.com/v1',
    key_enc: crypto.encrypt('sk-fake-key-12345', MASTER),
    model: 'test-model',
    manage_secret: secret,
  });
  check('db.createBot returns id', typeof botId === 'number' && botId > 0, String(botId));
  // engine.startAll already ran at boot (empty DB); start this one now — must fail gracefully
  const st = await engine.startBot(db.getBotById(botId));
  check('engine.startBot with fake token fails gracefully', st.ok === false && !engine.isRunning(botId), JSON.stringify(st).slice(0, 120));

  // 8. usage limit counting
  db.bumpUsage(botId); db.bumpUsage(botId); db.bumpUsage(botId);
  check('usage counting (3 bumps -> 3)', db.getUsage(botId) === 3, String(db.getUsage(botId)));

  // 8c. access control helpers
  const imgFail = await relay.generateImage('http://127.0.0.1:1', 'nope', 'm', 'a cat');
  check('generateImage returns {ok:false} on network error', imgFail && imgFail.ok === false && typeof imgFail.error === 'string');
  const imgBad = await relay.generateImage('https://api.relaymodels.com/v1', 'bad-key', 'no-such-model', 'x');
  check('generateImage returns {ok:false} on relay error', imgBad && imgBad.ok === false);
  console.log('  ✓ generateImage (image)');
  check('parseAllowedUsers normalizes', engine.parseAllowedUsers('123, 456 ,abc,123,,  ') === '123,456', engine.parseAllowedUsers('123, 456 ,abc,123,,  '));
  check('parseAllowedUsers empty', engine.parseAllowedUsers('') === '' && engine.parseAllowedUsers(null) === '');
  check('isAllowed: empty = public', engine.isAllowed('', '999') === true && engine.isAllowed(null, '999') === true);
  check('isAllowed: listed user', engine.isAllowed('123,456', '456') === true);
  check('isAllowed: stranger blocked', engine.isAllowed('123,456', '789') === false);
  db.updateBot(botId, { allowed_users: engine.parseAllowedUsers('111,222') });
  const rb = db.getBotById(botId);
  check('allowed_users persisted', rb.allowed_users === '111,222', rb.allowed_users);
  check('isAllowed from db row', engine.isAllowed(rb.allowed_users, '111') === true && engine.isAllowed(rb.allowed_users, '333') === false);
  db.updateBot(botId, { allowed_users: '' }); // back to public

  // 9. messages round-trip + stats endpoint (per-user memory)
  db.addMessage(botId, 'u1', 'user', 'hello');
  db.addMessage(botId, 'u1', 'assistant', 'hi there');
  db.addMessage(botId, 'u2', 'user', 'other user msg');
  const u1hist = db.getRecentMessages(botId, 'u1', 20);
  check('per-user memory isolated', u1hist.length === 2 && u1hist.every(m => m.content !== 'other user msg'), JSON.stringify(u1hist.map(m => m.content)));
  const u2hist = db.getRecentMessages(botId, 'u2', 20);
  check('per-user memory for u2', u2hist.length === 1 && u2hist[0].content === 'other user msg', JSON.stringify(u2hist.map(m => m.content)));
  try {
    const s = await get(port, `/api/bots/${secret}/stats`);
    check('GET stats -> totals', s && s.ok === true && s.total_messages === 3 && s.today_messages === 3 && s.limit === undefined, JSON.stringify(s));
  } catch (e) { check('GET stats -> totals', false, e.message); }

  // 10. admin panel: setup -> auth -> stats/bots -> logout
  try {
    const st0 = await get(port, '/api/admin/status');
    check('admin status -> setupRequired', st0 && st0.setupRequired === true, JSON.stringify(st0));

    const short = await post(port, '/api/admin/setup', { password: 'short' });
    check('admin setup rejects short password', short && short.ok === false, JSON.stringify(short).slice(0, 80));

    const setup = await post(port, '/api/admin/setup', { password: 'correct-horse-123' });
    check('admin setup -> token', setup && setup.ok === true && typeof setup.token === 'string' && setup.token.length === 64, JSON.stringify(setup).slice(0, 40));

    const st1 = await get(port, '/api/admin/status');
    check('admin status -> setupRequired false', st1 && st1.setupRequired === false, JSON.stringify(st1));

    const again = await post(port, '/api/admin/setup', { password: 'another-long-pw' });
    check('admin setup twice -> rejected', again && again.ok === false, JSON.stringify(again).slice(0, 80));

    const noAuth = await get(port, '/api/admin/stats');
    check('admin stats without token -> 401', noAuth && noAuth.ok === false && /unauthorized/i.test(noAuth.error || ''), JSON.stringify(noAuth).slice(0, 80));

    const badLogin = await post(port, '/api/admin/login', { password: 'wrong-password!' });
    check('admin login wrong password -> 401', badLogin && badLogin.ok === false, JSON.stringify(badLogin).slice(0, 80));

    const login = await post(port, '/api/admin/login', { password: 'correct-horse-123' });
    check('admin login -> token', login && login.ok === true && typeof login.token === 'string', JSON.stringify(login).slice(0, 40));
    const token = login.token;
    const auth = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };

    const statsRes = await fetch(`http://127.0.0.1:${port}/api/admin/stats`, auth);
    const stats = await statsRes.json();
    check('admin stats -> fields', stats && stats.ok === true && stats.botsTotal === 1 && typeof stats.messagesTotal === 'number' && typeof stats.messagesToday === 'number', JSON.stringify(stats));

    const botsRes = await fetch(`http://127.0.0.1:${port}/api/admin/bots`, auth);
    const bots = await botsRes.json();
    const b0 = bots && bots.bots && bots.bots[0];
    check('admin bots -> no secrets exposed', bots && bots.ok === true && b0 && !('token_enc' in b0) && !('key_enc' in b0) && !('manage_secret' in b0) && b0.username === 'smoke_bot', JSON.stringify(b0).slice(0, 200));

    const msgsRes = await fetch(`http://127.0.0.1:${port}/api/admin/bots/${b0.id}/messages?limit=10`, auth);
    const msgs = await msgsRes.json();
    check('admin messages -> rows with user_id', msgs && msgs.ok === true && Array.isArray(msgs.messages) && msgs.messages.length === 3 && 'user_id' in msgs.messages[0], JSON.stringify(msgs.messages).slice(0, 120));

    const out = await fetch(`http://127.0.0.1:${port}/api/admin/logout`, { method: 'POST', headers: auth.headers });
    const outJ = await out.json();
    const afterRes = await fetch(`http://127.0.0.1:${port}/api/admin/stats`, auth);
    const after = await afterRes.json();
    check('admin logout invalidates token', outJ && outJ.ok === true && after && after.ok === false, JSON.stringify(after).slice(0, 80));
  } catch (e) { check('admin panel flow', false, e.message); }

  // 11. manage endpoints: get (masked key), rotate, delete
  try {
    const g = await get(port, `/api/bots/${secret}`);
    check('GET bot -> masked key', g && g.ok === true && g.key_masked === 'sk-****2345' && !('key_enc' in g), JSON.stringify(g).slice(0, 160));
    const rot = await post(port, `/api/bots/${secret}/rotate`, {});
    check('POST rotate -> new secret', rot && rot.ok === true && typeof rot.manage_secret === 'string' && rot.manage_secret !== secret, JSON.stringify(rot).slice(0, 80));
    const del = await post(port, `/api/bots/${rot.manage_secret}/delete`, {});
    check('POST delete -> ok', del && del.ok === true, JSON.stringify(del));
    const gone = await get(port, `/api/bots/${rot.manage_secret}`);
    check('deleted bot -> 404', gone && gone.ok === false, JSON.stringify(gone));
  } catch (e) { check('manage endpoints', false, e.message); }

  engine.stopAll();
  server.close();
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('smoke crashed:', e);
  process.exit(1);
});
