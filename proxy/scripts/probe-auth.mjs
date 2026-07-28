#!/usr/bin/env node
//
// Answers two questions about the Postbase auth backend that cannot be
// answered by reading documentation:
//
//   Q1. What payload does /token accept for a Google sign-in?
//   Q2. Does a Google sign-in LINK to the existing migrated user row (same
//       UUID), or CREATE a new user with a new UUID — which would silently
//       orphan every PAUSE row keyed to the old id?
//
// Phase A is read-only and needs only the service key. It probes the accepted
// grant shapes by reading validation errors (no valid credential required) and
// tries to read the auth user table directly.
//
// Phase B performs one real Google sign-in and is opt-in, because if the answer
// to Q2 is "creates a new user" then the act of testing creates a duplicate
// user row. Phase A snapshots the user table first so that duplicate can be
// identified and removed.
//
// Usage:
//   POSTBASE_SERVICE_KEY=... POSTBASE_PROJECT_ID=... node scripts/probe-auth.mjs
//   ... node scripts/probe-auth.mjs --id-token "<google id_token>" --email someone@gmail.com
//
// Never prints the service key or any password hash.

const KEY = process.env.POSTBASE_SERVICE_KEY;
const PID = process.env.POSTBASE_PROJECT_ID;
const URL_BASE = (process.env.POSTBASE_URL || 'https://db.clinoble.com').replace(/\/+$/, '');

if (!KEY || !PID) {
  console.error('Set POSTBASE_SERVICE_KEY and POSTBASE_PROJECT_ID.');
  process.exit(1);
}

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ID_TOKEN = argOf('--id-token');
const EXPECT_EMAIL = argOf('--email');

const AUTH = `${URL_BASE}/api/auth/v1/${PID}`;

// Redact anything that looks like a secret before printing a row.
const SENSITIVE = /pass|hash|secret|salt|token|key/i;
function safe(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(safe);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE.test(k) ? (v ? '<redacted, present>' : '<empty/null>') : safe(v);
  }
  return out;
}

async function call(url, { method = 'POST', body, userToken } = {}) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };
  if (userToken) headers['X-Postbase-Token'] = userToken;
  let res, text;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    text = await res.text();
  } catch (e) {
    return { status: 0, body: { error: e.message } };
  }
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = text ? { raw: text.slice(0, 200) } : null; }
  return { status: res.status, body: parsed };
}

const query = (descriptor) => call(`${URL_BASE}/api/db/query`, { body: descriptor });

const line = (s) => console.log(s);
const rule = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`);

// ---------------------------------------------------------------------------

async function phaseA() {
  rule('PHASE A1 — which grant shapes does /token accept?');
  line('Reading validation errors. No valid credential is sent; the error text');
  line('is the signal. A shape that gets past field-validation into credential');
  line('verification is a shape the server understands.\n');

  const candidates = [
    ['email + password (the shape currently implemented)', { email: 'probe@example.invalid', password: 'not-a-real-password' }],
    ['empty body', {}],
    ['provider + idToken', { provider: 'google', idToken: 'probe' }],
    ['provider + id_token', { provider: 'google', id_token: 'probe' }],
    ['provider + token', { provider: 'google', token: 'probe' }],
    ['provider + credential', { provider: 'google', credential: 'probe' }],
    ['grantType id_token', { grantType: 'id_token', provider: 'google', idToken: 'probe' }],
    ['grant_type id_token', { grant_type: 'id_token', provider: 'google', id_token: 'probe' }],
    ['provider only', { provider: 'google' }],
  ];

  for (const [label, body] of candidates) {
    const r = await call(`${AUTH}/token`, { body });
    line(`  ${String(r.status).padEnd(4)} ${label.padEnd(46)} ${JSON.stringify(r.body)}`);
  }

  line('\nRead it like this:');
  line('  - "email and password required" (or similar) for the provider shapes');
  line('    => /token has NO Google grant; OAuth is not reachable this way.');
  line('  - a DIFFERENT error for a provider shape (invalid token / bad audience');
  line('    / verification failed) => that shape IS understood. Use it.');

  rule('PHASE A2 — can the auth user table be read directly?');
  const tableNames = ['users', 'Users', 'auth_users', 'auth.users', 'AuthUsers', 'accounts', 'identities', 'user_identities'];
  const readable = [];
  for (const table of tableNames) {
    const r = await query({ operation: 'select', table, limit: 1 });
    const ok = r.status >= 200 && r.status < 300;
    line(`  ${String(r.status).padEnd(4)} ${table.padEnd(16)} ${ok ? 'READABLE' : JSON.stringify(r.body).slice(0, 90)}`);
    if (ok) readable.push(table);
  }

  if (!readable.length) {
    line('\nNo auth table readable via /api/db/query. Q2 can then only be answered');
    line('by Phase B (a real sign-in), comparing the returned user.id against the');
    line('user_ids already present in the PAUSE tables.');
    return { readable: null, snapshot: null };
  }

  const table = readable[0];
  rule(`PHASE A3 — snapshot of ${table} (ids + emails only, secrets redacted)`);
  const r = await query({ operation: 'select', table, limit: 200 });
  const rows = Array.isArray(r.body) ? r.body : (r.body?.data || r.body?.rows || []);
  line(`  ${rows.length} row(s)\n`);
  for (const row of rows) {
    const s = safe(row);
    line(`  ${JSON.stringify(s)}`);
  }
  line('\nLook for: a provider / identities / google_id column, and whether the 9');
  line('migrated users already carry a Google identity. If they do NOT, a Google');
  line('sign-in has nothing to match on except email.');
  return { readable: table, snapshot: rows.map((x) => x.id).filter(Boolean) };
}

// ---------------------------------------------------------------------------

async function pauseTableOwners() {
  // The user_ids that PAUSE data is actually keyed to. If a Google sign-in
  // returns an id that is not in this set, that user's history is orphaned.
  const owners = new Map();
  for (const table of ['Profiles', 'Assessments', 'logbook', 'MoodLog', 'ScreenTime', 'ChallengeState', 'WeeklyCheckin', 'Feedback']) {
    const r = await query({ operation: 'select', table, columns: ['user_id'], limit: 500 });
    const rows = Array.isArray(r.body) ? r.body : (r.body?.data || r.body?.rows || []);
    for (const row of rows) {
      if (!row?.user_id) continue;
      owners.set(row.user_id, (owners.get(row.user_id) || 0) + 1);
    }
  }
  return owners;
}

async function phaseB(preIds) {
  rule('PHASE B — one real Google sign-in');

  if (!ID_TOKEN) {
    line('Skipped: no --id-token supplied.\n');
    line('To run it, get a Google ID token for an account that is ONE OF THE 9');
    line('MIGRATED USERS (a fresh Google account cannot answer the linking');
    line('question — it has no pre-existing row to link to):');
    line('');
    line('  1. Open the PAUSE app on the current production build, sign in with');
    line('     Google, and in DevTools run:');
    line('       google.accounts.id.prompt()  // or grab the credential from the');
    line('     handleGoogleCredential callback — response.credential IS the ID token.');
    line('  2. Re-run:  node scripts/probe-auth.mjs --id-token "<token>" --email <that account>');
    line('');
    line('ID tokens expire in ~1 hour. Do not paste one into a PR or a chat log.');
    return;
  }

  const owners = await pauseTableOwners();
  line(`PAUSE data is keyed to ${owners.size} distinct user_id(s):`);
  for (const [id, n] of owners) line(`  ${id}  (${n} rows)`);

  // Try each candidate shape until one is accepted.
  const shapes = [
    ['provider + idToken', { provider: 'google', idToken: ID_TOKEN }],
    ['provider + id_token', { provider: 'google', id_token: ID_TOKEN }],
    ['provider + token', { provider: 'google', token: ID_TOKEN }],
    ['provider + credential', { provider: 'google', credential: ID_TOKEN }],
    ['grantType id_token', { grantType: 'id_token', provider: 'google', idToken: ID_TOKEN }],
  ];

  let accepted = null;
  for (const [label, body] of shapes) {
    const r = await call(`${AUTH}/token`, { body });
    line(`\n  ${String(r.status).padEnd(4)} ${label} -> ${JSON.stringify(safe(r.body)).slice(0, 300)}`);
    if (r.status >= 200 && r.status < 300 && r.body?.session) { accepted = { label, payload: r.body }; break; }
  }

  if (!accepted) {
    rule('RESULT: /token accepted no Google shape');
    line('Google sign-in is not reachable through /token on this deployment.');
    line('Q2 is unanswerable until the correct entry point is identified.');
    return;
  }

  rule(`RESULT: /token accepted "${accepted.label}"`);

  const session = accepted.payload.session;
  const token = session?.accessToken || session?.token || session?.sessionToken || session?.jwt;
  const who = await call(`${AUTH}/user`, { method: 'GET', userToken: token });
  const user = who.body?.user || accepted.payload.user;

  line(`\n  Signed-in user id:    ${user?.id}`);
  line(`  Signed-in user email: ${user?.email}`);
  if (EXPECT_EMAIL && user?.email && user.email.toLowerCase() !== EXPECT_EMAIL.toLowerCase()) {
    line(`  ⚠ email differs from --email (${EXPECT_EMAIL})`);
  }

  const isExistingOwner = owners.has(user?.id);
  const isPreexistingAuthUser = preIds ? preIds.includes(user?.id) : null;

  rule('ANSWER TO Q2');
  if (isExistingOwner) {
    line('  LINKED. ✅');
    line(`  The Google sign-in returned ${user.id}, which already owns`);
    line(`  ${owners.get(user.id)} PAUSE row(s). Existing data is reachable.`);
  } else {
    line('  NEW UUID. ❌  DATA WOULD ORPHAN.');
    line(`  The Google sign-in returned ${user.id}, which owns NO PAUSE rows.`);
    line('  That user\'s history is still in the database under their old id.');
    line('  Do NOT cut over. Options, in order of preference:');
    line('    a) Configure Postbase to link Google identities to existing users by');
    line('       verified email, then re-run this probe to confirm.');
    line('    b) Backfill: map old id -> new id and UPDATE user_id across all 9');
    line('       tables in one transaction, before any user signs in.');
    line('    c) Have the proxy resolve a stable app-level identity from the');
    line('       verified email rather than trusting the auth UUID.');
  }
  if (isPreexistingAuthUser === false) {
    line('\n  Note: this id was NOT in the pre-sign-in auth snapshot, so this probe');
    line('  created a new auth user. Delete it once you have the answer.');
  }
}

const a = await phaseA();
await phaseB(a.snapshot);
line('');
