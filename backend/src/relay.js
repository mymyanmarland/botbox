// OpenAI-compatible relay client: probe (key check) + chat.
const PROBE_TIMEOUT_MS = 10_000;
const CHAT_TIMEOUT_MS = 60_000;

async function postJson(url, apiKey, body, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// Probe the key: GET {baseUrl}/models with the Bearer key. This is the
// standard OpenAI-compatible key check — POST /models 404s on strict
// gateways ("Invalid URL (POST /v1/models)"). Also verifies the requested
// model is in the relay's list when the relay returns a non-empty list.
// Returns {ok} / {ok:false, error}.
async function probe(baseUrl, apiKey, model) {
  const list = await listModels(baseUrl, apiKey);
  if (!list.ok) return { ok: false, error: list.error };
  if (model && list.models.length > 0 && !list.models.includes(model)) {
    return { ok: false, error: `model "${model}" is not in this relay's model list — load the list and pick one from it` };
  }
  return { ok: true };
}

// Chat: POST {baseUrl}/chat/completions (OpenAI-compatible).
async function chat(baseUrl, apiKey, model, messages) {
  try {
    const res = await postJson(`${baseUrl}/chat/completions`, apiKey,
      { model, messages }, CHAT_TIMEOUT_MS);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      return { ok: false, error: `relay returned HTTP ${res.status}${detail ? ': ' + detail : ''}` };
    }
    const j = await res.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message
      ? String(j.choices[0].message.content || '').trim() : '';
    if (!text) return { ok: false, error: 'empty reply from model' };
    return { ok: true, text };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'request timed out (60s)' : `network error: ${e.message}`;
    return { ok: false, error: msg };
  }
}

// Image generation: POST {baseUrl}/images/generations (OpenAI-compatible).
// Returns {ok, b64?|url?} / {ok:false, error}.
async function generateImage(baseUrl, apiKey, model, prompt) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120_000); // image gen can take a while
  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      return { ok: false, error: `relay returned HTTP ${res.status}${detail ? ': ' + detail : ''}` };
    }
    const j = await res.json();
    const d = j && Array.isArray(j.data) ? j.data[0] : null;
    if (d && typeof d.b64_json === 'string' && d.b64_json) return { ok: true, b64: d.b64_json };
    if (d && typeof d.url === 'string' && d.url) return { ok: true, url: d.url };
    return { ok: false, error: 'no image in relay response' };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'image request timed out (120s)' : `network error: ${e.message}` };
  } finally {
    clearTimeout(t);
  }
}

// Validate a Telegram bot token via getMe. Returns {ok, name, username} / {ok:false, error}.
async function telegramGetMe(token) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    let res;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
    const j = await res.json();
    if (!j.ok) return { ok: false, error: j.description || 'invalid bot token' };
    return { ok: true, name: j.result.first_name, username: j.result.username };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Telegram timed out' : `network error: ${e.message}` };
  }
}

// List models: GET {baseUrl}/models with the Bearer <redacted> Returns {ok, models:[ids]}.
async function listModels(baseUrl, apiKey) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      return { ok: false, error: `relay returned HTTP ${res.status}${detail ? ': ' + detail : ''}` };
    }
    const j = await res.json();
    const arr = j && Array.isArray(j.data) ? j.data : [];
    const models = arr.map(m => m && m.id).filter(id => typeof id === 'string' && id);
    return { ok: true, models };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'request timed out (10s)' : `network error: ${e.message}`;
    return { ok: false, error: msg };
  }
}

module.exports = { probe, chat, telegramGetMe, listModels, generateImage };
