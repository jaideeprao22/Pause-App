// Environment configuration. Every value here is required at runtime; we fail
// closed and loudly rather than silently falling back to a permissive default.

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Trailing slashes on the base URL would produce "//api/..." paths upstream.
const POSTBASE_URL = (process.env.POSTBASE_URL || 'https://db.clinoble.com').replace(/\/+$/, '');

// The only browser origin allowed to call this proxy. No wildcard, ever.
// Comma-separated so a preview/staging origin can be added deliberately.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://pause.jaideeprao.com')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

module.exports = {
  POSTBASE_URL,
  ALLOWED_ORIGINS,
  // Read lazily so a missing key surfaces as a 500 on the first real request
  // rather than crashing the whole bundle at import time.
  serviceKey: () => required('POSTBASE_SERVICE_KEY'),
  projectId: () => required('POSTBASE_PROJECT_ID'),
  googleClientId: () => required('GOOGLE_CLIENT_ID'),
};
