const { handlePreflightAndOrigin } = require('../../lib/cors');
const { auth, query, request, PostbaseError } = require('../../lib/postbase');
const { bearerToken, invalidate } = require('../../lib/auth');
const { verifyIdToken, GoogleTokenError } = require('../../lib/google');
const { googleClientId, projectId } = require('../../lib/config');

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

// Password auth is DISABLED on this Postbase project, and all nine migrated
// users are Google-only with no password hash. These endpoints stay in the tree
// because the code is correct and costs nothing to keep, but they are off
// unless someone deliberately enables password auth upstream and flips this.
// Default off — a sign-in path that cannot possibly succeed must fail loudly,
// not look like a wrong password.
const PASSWORD_AUTH_ENABLED = process.env.POSTBASE_PASSWORD_AUTH_ENABLED === 'true';

function passwordAuthGate(res) {
  if (PASSWORD_AUTH_ENABLED) return false;
  res.status(501).json({
    error: 'Password sign-in is disabled for this project. Sign in with Google.',
    code: 'password_auth_disabled',
  });
  return true;
}

// ---------------------------------------------------------------------------
// Google sign-in
// ---------------------------------------------------------------------------

// Which payload /token accepts for a Google credential is the one part of the
// contract not readable off the schema. Pin it with POSTBASE_GOOGLE_GRANT once
// known; unpinned, we try these in order on the first sign-in per instance and
// log the winner so it can be pinned.
const GRANT_SHAPES = {
  idToken:   (t) => ({ provider: 'google', idToken: t }),
  id_token:  (t) => ({ provider: 'google', id_token: t }),
  token:     (t) => ({ provider: 'google', token: t }),
  credential:(t) => ({ provider: 'google', credential: t }),
  grantType: (t) => ({ grantType: 'id_token', provider: 'google', idToken: t }),
};
const GRANT_ORDER = ['idToken', 'id_token', 'token', 'credential', 'grantType'];

let negotiatedGrant = process.env.POSTBASE_GOOGLE_GRANT || null;

async function exchangeGoogleCredential(idToken) {
  const tokenPath = `/api/auth/v1/${projectId()}/token`;

  if (negotiatedGrant) {
    const build = GRANT_SHAPES[negotiatedGrant];
    if (!build) throw new Error(`POSTBASE_GOOGLE_GRANT is not a known shape: ${negotiatedGrant}`);
    return request(tokenPath, { body: build(idToken) });
  }

  let lastError = null;
  for (const name of GRANT_ORDER) {
    try {
      const payload = await request(tokenPath, { body: GRANT_SHAPES[name](idToken) });
      if (payload && payload.session) {
        negotiatedGrant = name;
        console.warn(`[auth:google] /token accepted grant shape "${name}". Pin it with POSTBASE_GOOGLE_GRANT=${name}.`);
        return payload;
      }
    } catch (e) {
      lastError = e;
      // A 4xx here means "this shape was understood but the credential was
      // rejected" OR "this shape was not understood". We cannot tell them
      // apart from one response, so keep trying the remaining shapes and let
      // the last error stand if none work.
    }
  }
  throw lastError || new PostbaseError(502, { error: 'No supported Google grant shape' });
}

// THE ASSERTION.
//
// `accounts` has PRIMARY KEY (provider, provider_account_id) and is seeded from
// the Google subject IDs carried over from Supabase, so a given Google sub maps
// to exactly one migrated user_id — enforced by the database. This re-checks
// that invariant on every single sign-in rather than trusting it.
//
// It fails loudly in both directions that matter:
//   - no accounts row  => the sub was never seeded, so Postbase either minted a
//                         fresh user or is about to. Every PAUSE row for this
//                         person is keyed to their old UUID and would orphan.
//   - row.user_id !== returned id => the exchange resolved to the wrong user.
//
// Either way we refuse the sign-in. An empty app is not a better outcome than
// an error message; it looks like data loss and the user cannot tell the
// difference. `accounts` is deliberately NOT in lib/tables.js — it must never
// be reachable through /api/data/*.
async function assertLinkedToMigratedUser(sub, resolvedUserId) {
  let rows;
  try {
    rows = await query({
      operation: 'select',
      table: 'accounts',
      columns: ['user_id', 'provider', 'provider_account_id'],
      filters: [
        { column: 'provider', operator: 'eq', value: 'google' },
        { column: 'provider_account_id', operator: 'eq', value: sub },
      ],
      limit: 2,
    });
  } catch (e) {
    console.error('[auth:google] could not read accounts to verify identity link:', e.message);
    throw new IdentityLinkError('Could not verify your account link. Sign-in blocked as a precaution.');
  }

  const match = rows.find((r) => r && r.provider_account_id === sub && r.provider === 'google');

  if (!match) {
    console.error(
      `[auth:google] REGRESSION: no accounts row for google sub ${sub}. ` +
      `Postbase resolved this sign-in to ${resolvedUserId}, which is not linked to any migrated user. ` +
      'Seed the accounts row before letting this account sign in, or its history will orphan.'
    );
    throw new IdentityLinkError('Your account is not linked yet. Please contact support before signing in — your existing data is safe.');
  }

  if (match.user_id !== resolvedUserId) {
    console.error(
      `[auth:google] REGRESSION: google sub ${sub} is linked to user ${match.user_id}, ` +
      `but /token resolved the session to ${resolvedUserId}. Refusing the sign-in.`
    );
    throw new IdentityLinkError('Your sign-in resolved to the wrong account. Sign-in blocked as a precaution.');
  }

  return match.user_id;
}

class IdentityLinkError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

const ACTIONS = {
  // The only sign-in path that works on this project. The browser sends the
  // Google credential (the ID token from Google Identity Services); the service
  // key never leaves this function's environment.
  async google(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const credential = (req.body || {}).credential;
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ error: 'A Google credential is required' });
    }

    // Verified here, before the token goes anywhere — in particular `aud`, so a
    // token minted for a different Google app cannot be replayed at this proxy.
    const claims = await verifyIdToken(credential, googleClientId());
    if (claims.email && !claims.emailVerified) {
      return res.status(403).json({ error: 'Your Google email address is not verified' });
    }

    const payload = await exchangeGoogleCredential(credential);
    const out = shape(payload);
    if (!out.token || !out.user || !out.user.id) {
      return res.status(502).json({ error: 'Sign-in succeeded but no session was returned' });
    }

    await assertLinkedToMigratedUser(claims.sub, out.user.id);

    return res.status(200).json(out);
  },

  async signin(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (passwordAuthGate(res)) return;
    const creds = credentials(req.body || {});
    if (creds.error) return res.status(400).json({ error: creds.error });
    const payload = await auth.signIn(creds.email, creds.password);
    const out = shape(payload);
    if (!out.token) return res.status(502).json({ error: 'Sign-in succeeded but no session token was returned' });
    return res.status(200).json(out);
  },

  async signup(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (passwordAuthGate(res)) return;
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
    // A bad or replayed Google credential, and a broken identity link, are both
    // things the caller should see verbatim — the second especially, because a
    // silent empty app is exactly the failure we are guarding against.
    if (e instanceof GoogleTokenError) return res.status(401).json({ error: e.message });
    if (e instanceof IdentityLinkError) return res.status(409).json({ error: e.message, code: 'identity_not_linked' });
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
