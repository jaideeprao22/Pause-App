const { ALLOWED_ORIGINS } = require('./config');

// Strict origin echo. An unlisted (or absent) Origin gets no CORS headers at
// all, so the browser refuses to hand the response to the page. We do not fall
// back to "*" — the proxy speaks for a service key and must never be callable
// from an arbitrary page.
function applyCors(req, res) {
  const origin = (req.headers.origin || '').replace(/\/+$/, '');
  const allowed = ALLOWED_ORIGINS.includes(origin);

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pause-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  // Responses differ by Origin, so caches must key on it.
  res.setHeader('Vary', 'Origin');
  return allowed;
}

// Returns true when the request has been fully handled (preflight or reject).
function handlePreflightAndOrigin(req, res) {
  const allowed = applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.status(allowed ? 204 : 403).end();
    return true;
  }

  // Same-origin/no-Origin requests (curl, server-to-server) carry no Origin
  // header. We still require a recognised one: this proxy exists solely to
  // serve the PAUSE web app, and rejecting the rest keeps the surface honest.
  if (!allowed) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }

  return false;
}

module.exports = { applyCors, handlePreflightAndOrigin };
