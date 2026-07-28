const crypto = require('crypto');

// Independent verification of the Google ID token, before it is handed to
// Postbase.
//
// Postbase almost certainly verifies it too, but we cannot see that code, and
// the check that matters most here is `aud`: without it, an ID token minted for
// *any other* Google application could be replayed at this proxy and would look
// like a valid sign-in. That is a real account-takeover path, so it gets
// checked on our side of the wire regardless of what upstream does.
//
// No dependencies — Node's crypto can consume a JWK directly.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CLOCK_SKEW_S = 60;

let jwksCache = { keys: null, expires: 0 };

async function getKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.expires) return jwksCache.keys;

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`Could not fetch Google signing keys (${res.status})`);
  const body = await res.json();

  // Respect Google's cache-control; they rotate keys and a stale cache means
  // valid sign-ins start failing.
  const cc = res.headers.get('cache-control') || '';
  const maxAge = /max-age=(\d+)/.exec(cc);
  const ttlMs = (maxAge ? parseInt(maxAge[1], 10) : 3600) * 1000;

  jwksCache = { keys: body.keys || [], expires: Date.now() + ttlMs };
  return jwksCache.keys;
}

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const b64urlToJson = (s) => JSON.parse(b64urlToBuf(s).toString('utf8'));

class GoogleTokenError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
  }
}

// Returns the verified claims. Throws GoogleTokenError on anything suspect.
async function verifyIdToken(idToken, audience) {
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new GoogleTokenError('Malformed Google credential');
  }
  if (!audience) throw new Error('GOOGLE_CLIENT_ID is not configured');

  const [headerB64, payloadB64, signatureB64] = idToken.split('.');

  let header, claims;
  try {
    header = b64urlToJson(headerB64);
    claims = b64urlToJson(payloadB64);
  } catch (e) {
    throw new GoogleTokenError('Malformed Google credential');
  }

  if (header.alg !== 'RS256') throw new GoogleTokenError(`Unexpected token algorithm: ${header.alg}`);

  const keys = await getKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new GoogleTokenError('Google credential signed by an unknown key');

  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    b64urlToBuf(signatureB64)
  );
  if (!verified) throw new GoogleTokenError('Google credential signature is invalid');

  if (!ISSUERS.has(claims.iss)) throw new GoogleTokenError(`Unexpected issuer: ${claims.iss}`);

  // The check this whole module exists for.
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!auds.includes(audience)) {
    throw new GoogleTokenError('Google credential was issued for a different application');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) {
    throw new GoogleTokenError('Google credential has expired');
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) {
    throw new GoogleTokenError('Google credential is not yet valid');
  }
  if (!claims.sub) throw new GoogleTokenError('Google credential carries no subject');

  return {
    sub: claims.sub,
    email: claims.email || null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  };
}

module.exports = { verifyIdToken, GoogleTokenError };
