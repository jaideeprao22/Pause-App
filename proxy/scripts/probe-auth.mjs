#!/usr/bin/env node
//
// DIAGNOSTIC ONLY. This script is not the source of truth for anything.
//
// The identity-linking question — does a Google sign-in resolve to the migrated
// Supabase UUID? — is answered by the database schema, not by this script:
// `accounts` has PRIMARY KEY (provider, provider_account_id) and is pre-seeded
// from the Google subject IDs already in Supabase, so the mapping holds by
// construction. The proxy asserts that invariant on every sign-in
// (see api/auth/[action].js). That assertion is the regression test.
//
// The one thing left that genuinely cannot be read off the schema is which
// payload shape /token accepts for a Google credential. This probes that by
// reading validation errors — a shape that gets past field-validation into
// credential verification is a shape the server understands, and no valid
// credential is needed to tell the difference.
//
// It talks to the live backend with the service key, so it is gated behind
// --allow-live and must be run deliberately.
//
//   POSTBASE_SERVICE_KEY=... POSTBASE_PROJECT_ID=... \
//     node scripts/probe-auth.mjs --allow-live
//
// There is no sign-in path here. Nothing is written.

const KEY = process.env.POSTBASE_SERVICE_KEY;
const PID = process.env.POSTBASE_PROJECT_ID;
const URL_BASE = (process.env.POSTBASE_URL || 'https://db.clinoble.com').replace(/\/+$/, '');

if (!process.argv.includes('--allow-live')) {
  console.error('Refusing to run: this contacts the live backend with the service key.');
  console.error('Re-run with --allow-live if that is what you intend.');
  process.exit(1);
}
if (!KEY || !PID) {
  console.error('Set POSTBASE_SERVICE_KEY and POSTBASE_PROJECT_ID.');
  process.exit(1);
}

const TOKEN_URL = `${URL_BASE}/api/auth/v1/${PID}/token`;

// Kept in sync with GRANT_SHAPES in api/auth/[action].js.
const CANDIDATES = [
  ['provider + idToken', { provider: 'google', idToken: 'probe' }],
  ['provider + id_token', { provider: 'google', id_token: 'probe' }],
  ['provider + token', { provider: 'google', token: 'probe' }],
  ['provider + credential', { provider: 'google', credential: 'probe' }],
  ['grantType id_token', { grantType: 'id_token', provider: 'google', idToken: 'probe' }],
  ['— baseline: email + password —', { email: 'probe@example.invalid', password: 'not-a-real-password' }],
  ['— baseline: empty body —', {}],
];

console.log(`\nPOST ${TOKEN_URL}\n`);

for (const [label, body] of CANDIDATES) {
  let status = 0;
  let text = '';
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
    });
    status = res.status;
    text = (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
  } catch (e) {
    text = `request failed: ${e.message}`;
  }
  console.log(`  ${String(status).padEnd(4)} ${label.padEnd(32)} ${text}`);
}

console.log(`
How to read this:

  If every provider shape returns the SAME error as the email+password
  baseline ("email and password required" or similar), /token has no Google
  grant and OAuth is not reachable through it. Find the real entry point
  before wiring anything.

  If one provider shape returns a DIFFERENT error — invalid token, bad
  signature, verification failed — that shape IS understood. Pin it:

    POSTBASE_GOOGLE_GRANT=<idToken|id_token|token|credential|grantType>

  in the proxy's Vercel environment. Unpinned, the proxy negotiates the same
  order at runtime and logs the winner, which works but costs extra round
  trips on each cold start.
`);
