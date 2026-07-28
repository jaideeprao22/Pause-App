const crypto = require('crypto');
const { auth } = require('./postbase');

class AuthError extends Error {
  constructor(message = 'Not authenticated') {
    super(message);
    this.status = 401;
  }
}

// Postbase is the only authority on who a token belongs to. We ask it, and we
// use *its* answer — never a user id supplied by the browser.
//
// A tiny per-instance cache keeps a burst of data calls (the login fan-out
// fires eight at once) from becoming eight extra upstream round-trips. The TTL
// is deliberately short: a signed-out or revoked token keeps working for at
// most TTL_MS, which is an acceptable trade for this app and is the only
// staleness window in the system.
const TTL_MS = 30_000;
const MAX_ENTRIES = 500;
const cache = new Map();

function cacheKey(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.user;
}

function writeCache(key, user) {
  // Crude bound — this is a warm-lambda scratchpad, not a real cache tier.
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { user, expires: Date.now() + TTL_MS });
}

function invalidate(token) {
  if (token) cache.delete(cacheKey(token));
}

function bearerToken(req) {
  // The user's token travels in its own header. We do not read Authorization
  // from the browser at all — that slot belongs to the service key upstream,
  // and accepting it here invites confusion about which credential is which.
  const raw = req.headers['x-pause-token'];
  const token = Array.isArray(raw) ? raw[0] : raw;
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

// Resolves the caller to a Postbase user, or throws 401. The returned id is
// the ONLY thing handlers may use to scope a query.
async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) throw new AuthError('Missing user token');

  const key = cacheKey(token);
  const cached = readCache(key);
  if (cached) return { ...cached, token };

  let payload;
  try {
    payload = await auth.user(token);
  } catch (e) {
    throw new AuthError('Invalid or expired session');
  }

  const user = payload && payload.user;
  if (!user || !user.id) throw new AuthError('Invalid or expired session');

  const resolved = { id: user.id, email: user.email || null };
  writeCache(key, resolved);
  return { ...resolved, token };
}

module.exports = { requireUser, bearerToken, invalidate, AuthError };
