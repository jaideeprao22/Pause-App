const { handlePreflightAndOrigin } = require('../../lib/cors');
const { auth, query, PostbaseError } = require('../../lib/postbase');
const { bearerToken, invalidate } = require('../../lib/auth');
const { verifyIdToken, GoogleTokenError } = require('../../lib/google');
const { googleClientId } = require('../../lib/config');

// Postbase's session is {accessToken, refreshToken, expiresAt, user}. Only the
// access token is pulled out and handed to the browser — the refresh token
// stays here and is discarded, so a stolen browser token cannot be traded up
// for a long-lived one. Sessions therefore end at expiry and the user signs in
// again; see README "Known gaps". The fallbacks are belt-and-braces.
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

// Postbase's documented failures for the id-token grant, mapped to something a
// person can act on. Anything unrecognised falls through to a generic message
// rather than leaking upstream wording.
function describeGrantFailure(e) {
  const raw = String((e && e.message) || '').toLowerCase();
  if (raw.includes('nonce')) {
    return { status: 401, error: 'Your sign-in could not be verified. Please try again.' };
  }
  if (raw.includes('verification failed') || raw.includes('id_token')) {
    return { status: 401, error: 'Google could not verify your sign-in. Please try again.' };
  }
  if (raw.includes('provider not enabled')) {
    // A configuration fault, not a user fault — make that unmistakable in logs.
    console.error('[auth:google] Google provider is not enabled on the Postbase project.');
    return { status: 503, error: 'Google sign-in is not enabled right now. Please try again later.' };
  }
  if (raw.includes('no_email_from_provider')) {
    return { status: 403, error: 'Your Google account did not share an email address, which PAUSE needs to identify you.' };
  }
  return null;
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
      `but the id-token grant resolved the session to ${resolvedUserId}. Refusing the sign-in.`
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

    // Defence in depth. Postbase verifies the token too — JWKS, issuer, and
    // audience against its dashboard-configured client ID — but we check `aud`
    // on our side as well, so a token minted for a different Google app is
    // rejected here regardless of how upstream is configured.
    const claims = await verifyIdToken(credential, googleClientId());
    if (claims.email && !claims.emailVerified) {
      return res.status(403).json({ error: 'Your Google email address is not verified' });
    }

    let payload;
    try {
      payload = await auth.idTokenGrant('google', credential);
    } catch (e) {
      const mapped = (e && e.isPostbaseError) ? describeGrantFailure(e) : null;
      if (mapped) return res.status(mapped.status).json({ error: mapped.error });
      throw e;
    }

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
    if (e && e.isPostbaseError) {
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
