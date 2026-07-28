const { POSTBASE_URL, serviceKey, projectId } = require('./config');

// Postbase always authenticates the *caller of the API* with the service key.
// A user's own token is a separate, additional header — it never replaces the
// Bearer credential. Getting this backwards is the single easiest way to break
// (or silently widen) access, so it lives in exactly one place.
function headers(userToken) {
  const key = serviceKey();
  const h = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    // The OAuth routes document their service credential as `apikey` rather
    // than `Authorization`. Sending both costs nothing and means one header
    // convention across the whole surface — the alternative is a per-route
    // rule that is easy to get subtly wrong.
    apikey: key,
  };
  if (userToken) h['X-Postbase-Token'] = userToken;
  return h;
}

class PostbaseError extends Error {
  constructor(status, body) {
    super((body && (body.error || body.message)) || `Postbase request failed (${status})`);
    this.status = status;
    this.body = body;
    // Checked instead of `instanceof`: class identity is not guaranteed if this
    // module is ever loaded through two paths, and misclassifying an upstream
    // error as an internal one turns a clear 4xx into an opaque 500.
    this.isPostbaseError = true;
  }
}

async function request(path, { method = 'POST', body, userToken, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${POSTBASE_URL}${path}`, {
      method,
      headers: headers(userToken),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new PostbaseError(504, { error: `Upstream unreachable: ${e.message}` });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new PostbaseError(502, { error: 'Upstream returned a non-JSON response' });
    }
  }
  if (!res.ok) throw new PostbaseError(res.status, parsed);
  return parsed;
}

// The exact envelope /api/db/query wraps rows in is not pinned down by the
// spec we built against, so normalise the handful of plausible shapes into a
// plain array rather than guessing one and breaking on the others.
function rows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'rows', 'records', 'result', 'results']) {
    if (Array.isArray(payload[key])) return payload[key];
    // A single-row operation may return the object directly under `data`.
    if (payload[key] && typeof payload[key] === 'object') return [payload[key]];
  }
  return [];
}

// The one and only door to the data API. Callers pass a fully-formed,
// server-authored descriptor; nothing here is derived from the browser.
async function query(descriptor, userToken) {
  const payload = await request('/api/db/query', { body: descriptor, userToken });
  return rows(payload);
}

// ---- Auth -----------------------------------------------------------------

const authBase = () => `/api/auth/v1/${projectId()}`;

const auth = {
  // OAuth lives under a nested /oauth/ prefix — NOT at the top level, and NOT
  // on /token. A top-level probe for /authorize or /google returns the same 500
  // as a bogus path, which is why they look absent. See AUTH-API.md.
  //
  // The field is `id_token`, snake_case. There is nothing to negotiate.
  idTokenGrant: (provider, idToken) =>
    request(`${authBase()}/oauth/id-token`, { body: { provider, id_token: idToken } }),

  signIn: (email, password) =>
    request(`${authBase()}/token`, { body: { email, password } }),
  signUp: (email, password) =>
    request(`${authBase()}/signup`, { body: { email, password } }),
  session: (userToken) =>
    request(`${authBase()}/session`, { method: 'GET', userToken }),
  user: (userToken) =>
    request(`${authBase()}/user`, { method: 'GET', userToken }),
  signOut: (userToken) =>
    request(`${authBase()}/logout`, { body: {}, userToken }),
};

module.exports = { request, query, rows, auth, PostbaseError };
