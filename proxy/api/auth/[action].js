const { handlePreflightAndOrigin } = require('../../lib/cors');
const { auth, PostbaseError } = require('../../lib/postbase');
const { bearerToken, invalidate } = require('../../lib/auth');

// Postbase returns camelCase and does not use access_token/refresh_token, but
// the exact key holding the bearer value isn't pinned down by the spec. Pull it
// out here so the browser has exactly one contract to code against.
function extractToken(session) {
  if (!session || typeof session !== 'object') return null;
  for (const k of ['accessToken', 'token', 'sessionToken', 'jwt']) {
    if (typeof session[k] === 'string' && session[k]) return session[k];
  }
  return null;
}

// Only the fields the app actually renders. Anything else Postbase returns
// about a user stays server-side.
function publicUser(user) {
  if (!user || typeof user !== 'object') return null;
  return { id: user.id, email: user.email || null };
}

function shape(payload) {
  const session = payload && payload.session ? payload.session : null;
  return {
    user: publicUser(payload && payload.user),
    token: extractToken(session),
    expiresAt: (session && (session.expiresAt || session.expires_at)) || null,
  };
}

function credentials(body) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'A valid email address is required' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  return { email, password };
}

const ACTIONS = {
  async signin(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const creds = credentials(req.body || {});
    if (creds.error) return res.status(400).json({ error: creds.error });
    const payload = await auth.signIn(creds.email, creds.password);
    const out = shape(payload);
    if (!out.token) return res.status(502).json({ error: 'Sign-in succeeded but no session token was returned' });
    return res.status(200).json(out);
  },

  async signup(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const creds = credentials(req.body || {});
    if (creds.error) return res.status(400).json({ error: creds.error });
    const payload = await auth.signUp(creds.email, creds.password);
    // Some deployments return a session on signup, some require a follow-up
    // sign-in. Fall back to signing in so the client always gets a token.
    let out = shape(payload);
    if (!out.token) {
      out = shape(await auth.signIn(creds.email, creds.password));
    }
    if (!out.token) return res.status(502).json({ error: 'Account created but no session token was returned' });
    return res.status(201).json(out);
  },

  // Session restore on page load: the client hands back the token it stored
  // and we re-validate it upstream. A dead token yields a clean signed-out
  // response rather than an error, so the app can just render logged-out.
  async session(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const token = bearerToken(req);
    if (!token) return res.status(200).json({ user: null, token: null });
    try {
      const payload = await auth.user(token);
      const user = publicUser(payload && payload.user);
      if (!user || !user.id) return res.status(200).json({ user: null, token: null });
      return res.status(200).json({ user, token });
    } catch (e) {
      return res.status(200).json({ user: null, token: null });
    }
  },

  async signout(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const token = bearerToken(req);
    if (token) {
      invalidate(token);
      // Best effort: the client is discarding the token regardless, so an
      // upstream hiccup must not leave the UI stuck signed in.
      try { await auth.signOut(token); } catch (e) { /* ignore */ }
    }
    return res.status(200).json({ ok: true });
  },
};

module.exports = async function handler(req, res) {
  if (handlePreflightAndOrigin(req, res)) return;

  const action = String(req.query.action || '');
  const fn = ACTIONS[action];
  if (!fn) return res.status(404).json({ error: 'Unknown auth action' });

  try {
    return await fn(req, res);
  } catch (e) {
    if (e instanceof PostbaseError) {
      // Upstream 4xx means bad credentials or a duplicate account — safe and
      // useful to surface. Anything else is ours to own, with detail kept out
      // of the response.
      if (e.status >= 400 && e.status < 500) {
        return res.status(e.status === 401 ? 401 : e.status).json({ error: e.message });
      }
      console.error(`[auth:${action}] upstream ${e.status}:`, e.message);
      return res.status(502).json({ error: 'Authentication service unavailable' });
    }
    console.error(`[auth:${action}]`, e);
    return res.status(500).json({ error: 'Internal error' });
  }
};
