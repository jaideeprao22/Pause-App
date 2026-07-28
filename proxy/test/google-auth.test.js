const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.POSTBASE_SERVICE_KEY = 'test-service-key';
process.env.POSTBASE_PROJECT_ID = 'test-project';
process.env.GOOGLE_CLIENT_ID = 'pause-client.apps.googleusercontent.com';
process.env.ALLOWED_ORIGIN = 'https://pause.jaideeprao.com';

const { verifyIdToken, GoogleTokenError } = require('../lib/google');

// --- A local Google, so token verification can be tested for real -----------

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-kid';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function mintToken(claims = {}, { kid = KID, alg = 'RS256', signWith = privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg, kid, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-sub-1',
    email: 'user@example.com',
    email_verified: true,
    iat: now,
    exp: now + 3600,
    ...claims,
  }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), signWith);
  return `${header}.${payload}.${b64url(sig)}`;
}

// Stub Google's JWKS endpoint.
const realFetch = globalThis.fetch;
test.before(() => {
  globalThis.fetch = async (url) => {
    if (String(url).includes('oauth2/v3/certs')) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
test.after(() => { globalThis.fetch = realFetch; });

const AUD = process.env.GOOGLE_CLIENT_ID;

test('a well-formed Google token verifies and yields the subject', async () => {
  const claims = await verifyIdToken(mintToken(), AUD);
  assert.strictEqual(claims.sub, 'google-sub-1');
  assert.strictEqual(claims.email, 'user@example.com');
  assert.strictEqual(claims.emailVerified, true);
});

test('a token minted for a DIFFERENT Google app is rejected', async () => {
  // The attack this check exists for: any other app's ID token replayed here.
  await assert.rejects(
    () => verifyIdToken(mintToken({ aud: 'someone-elses-app.apps.googleusercontent.com' }), AUD),
    (e) => e instanceof GoogleTokenError && /different application/.test(e.message)
  );
});

test('a token signed by the wrong key is rejected', async () => {
  const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(
    () => verifyIdToken(mintToken({}, { signWith: attacker }), AUD),
    (e) => e instanceof GoogleTokenError && /signature is invalid/.test(e.message)
  );
});

test('an expired token is rejected', async () => {
  const past = Math.floor(Date.now() / 1000) - 7200;
  await assert.rejects(
    () => verifyIdToken(mintToken({ iat: past, exp: past + 3600 }), AUD),
    (e) => e instanceof GoogleTokenError && /expired/.test(e.message)
  );
});

test('a token from the wrong issuer is rejected', async () => {
  await assert.rejects(
    () => verifyIdToken(mintToken({ iss: 'https://evil.example' }), AUD),
    (e) => e instanceof GoogleTokenError && /issuer/.test(e.message)
  );
});

test('an unsigned ("alg: none") token is rejected', async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'none', kid: KID, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: 'https://accounts.google.com', aud: AUD, sub: 'x', exp: now + 3600 }));
  await assert.rejects(
    () => verifyIdToken(`${header}.${payload}.`, AUD),
    (e) => e instanceof GoogleTokenError && /algorithm/.test(e.message)
  );
});

test('a token signed by an unknown key id is rejected', async () => {
  await assert.rejects(
    () => verifyIdToken(mintToken({}, { kid: 'rotated-away' }), AUD),
    (e) => e instanceof GoogleTokenError && /unknown key/.test(e.message)
  );
});

test('garbage is rejected without throwing something unhelpful', async () => {
  for (const bad of ['', 'not-a-jwt', 'a.b', 'a.b.c.d', null, 42]) {
    await assert.rejects(() => verifyIdToken(bad, AUD), (e) => e instanceof GoogleTokenError);
  }
});

// --- The identity-link assertion -------------------------------------------
//
// The regression test for the whole orphaning class of bug. Exercised through
// the handler with a stubbed upstream, so it covers the real code path.

function loadHandler(queryImpl, requestImpl) {
  for (const m of ['../lib/postbase', '../lib/auth', '../lib/db', '../api/auth/[action]']) {
    delete require.cache[require.resolve(m)];
  }
  const postbase = require('../lib/postbase');
  postbase.query = queryImpl;
  postbase.request = requestImpl;
  return require('../api/auth/[action]');
}

function fakeRes() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}

const MIGRATED_UUID = '11111111-2222-3333-4444-555555555555';

function googleReq(credential) {
  return {
    method: 'POST',
    headers: { origin: 'https://pause.jaideeprao.com' },
    query: { action: 'google' },
    body: { credential },
  };
}

const sessionFor = (id) => ({
  user: { id, email: 'user@example.com' },
  session: { accessToken: 'session-token-abc' },
});

test('sign-in succeeds when the Google sub resolves to its linked migrated user', async () => {
  const handler = loadHandler(
    async () => [{ user_id: MIGRATED_UUID, provider: 'google', provider_account_id: 'google-sub-1' }],
    async () => sessionFor(MIGRATED_UUID)
  );
  const res = fakeRes();
  await handler(googleReq(mintToken()), res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.user.id, MIGRATED_UUID);
  assert.strictEqual(res.body.token, 'session-token-abc');
});

test('REGRESSION: sign-in is refused when /token resolves to a different user id', async () => {
  // accounts says this sub belongs to the migrated user, but the exchange came
  // back with a fresh UUID — exactly the silent-orphaning failure.
  const handler = loadHandler(
    async () => [{ user_id: MIGRATED_UUID, provider: 'google', provider_account_id: 'google-sub-1' }],
    async () => sessionFor('99999999-0000-0000-0000-000000000000')
  );
  const res = fakeRes();
  await handler(googleReq(mintToken()), res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.code, 'identity_not_linked');
});

test('REGRESSION: sign-in is refused when the sub has no accounts row (unseeded)', async () => {
  const handler = loadHandler(
    async () => [],
    async () => sessionFor('99999999-0000-0000-0000-000000000000')
  );
  const res = fakeRes();
  await handler(googleReq(mintToken()), res);
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.code, 'identity_not_linked');
});

test('sign-in is refused if accounts cannot be read at all — never assumed OK', async () => {
  const handler = loadHandler(
    async () => { throw new Error('accounts unreadable'); },
    async () => sessionFor(MIGRATED_UUID)
  );
  const res = fakeRes();
  await handler(googleReq(mintToken()), res);
  assert.strictEqual(res.statusCode, 409);
});

test('the accounts lookup filters on the verified sub, not anything caller-supplied', async () => {
  let captured = null;
  const handler = loadHandler(
    async (d) => { captured = d; return [{ user_id: MIGRATED_UUID, provider: 'google', provider_account_id: 'google-sub-1' }]; },
    async () => sessionFor(MIGRATED_UUID)
  );
  await handler(googleReq(mintToken({ sub: 'google-sub-1' })), fakeRes());
  assert.strictEqual(captured.table, 'accounts');
  assert.deepStrictEqual(captured.filters, [
    { column: 'provider', operator: 'eq', value: 'google' },
    { column: 'provider_account_id', operator: 'eq', value: 'google-sub-1' },
  ]);
});

test('an unverified Google email is refused', async () => {
  const handler = loadHandler(
    async () => [{ user_id: MIGRATED_UUID, provider: 'google', provider_account_id: 'google-sub-1' }],
    async () => sessionFor(MIGRATED_UUID)
  );
  const res = fakeRes();
  await handler(googleReq(mintToken({ email_verified: false })), res);
  assert.strictEqual(res.statusCode, 403);
});

test('a bad credential never reaches the exchange', async () => {
  let exchanged = false;
  const handler = loadHandler(
    async () => [],
    async () => { exchanged = true; return sessionFor(MIGRATED_UUID); }
  );
  const res = fakeRes();
  await handler(googleReq(mintToken({ aud: 'other-app.apps.googleusercontent.com' })), res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(exchanged, false, 'a token for another app was sent upstream');
});

test('password sign-in is disabled by default', async () => {
  const handler = loadHandler(async () => [], async () => sessionFor(MIGRATED_UUID));
  const res = fakeRes();
  await handler({
    method: 'POST',
    headers: { origin: 'https://pause.jaideeprao.com' },
    query: { action: 'signin' },
    body: { email: 'user@example.com', password: 'hunter2hunter2' },
  }, res);
  assert.strictEqual(res.statusCode, 501);
  assert.strictEqual(res.body.code, 'password_auth_disabled');
});
