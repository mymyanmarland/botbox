// SSRF guard for user-supplied AI relay base URLs.
// Rules: http/https only, no credentials in URL, no private/loopback/link-local IPs.
const dns = require('dns').promises;
const net = require('net');

function isBlockedIp(addr) {
  const family = net.isIP(addr);
  if (family === 4) {
    const b = addr.split('.').map(Number);
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (private)
    if (b[0] === 10) return true;
    if (b[0] === 172 && b[1] >= 16 && b[1] <= 31) return true;
    if (b[0] === 192 && b[1] === 168) return true;
    // 127.0.0.0/8 (loopback), 169.254.0.0/16 (link-local), 0.0.0.0
    if (b[0] === 127) return true;
    if (b[0] === 169 && b[1] === 254) return true;
    if (addr === '0.0.0.0') return true;
    return false;
  }
  if (family === 6) {
    const low = addr.toLowerCase();
    if (low === '::1' || low === '::') return true;               // loopback / unspecified
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // fc00::/7 unique-local
    if (low.startsWith('fe80')) return true;                      // fe80::/10 link-local
    return false;
  }
  return true; // not an IP at all — treat as unsafe
}

// Throws on unsafe URL; returns normalized base URL (no trailing slash) otherwise.
async function assertSafeUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw new Error('invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('only http/https URLs allowed');
  }
  if (u.username || u.password) {
    throw new Error('credentials in URL not allowed');
  }
  if (!u.hostname) throw new Error('invalid URL');
  let addrs;
  try {
    addrs = await dns.lookup(u.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('DNS resolution failed');
  }
  if (!addrs.length) throw new Error('DNS resolution failed');
  for (const a of addrs) {
    if (isBlockedIp(a.address)) {
      throw new Error('private/loopback IP addresses are blocked');
    }
  }
  return u.toString().replace(/\/+$/, '');
}

module.exports = { assertSafeUrl, isBlockedIp };
