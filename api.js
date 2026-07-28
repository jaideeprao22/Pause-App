// ============================================================
// PAUSE API CLIENT
//
// Replaces the former third-party database client. This file contains NO
// credentials of any kind. Every call goes to the PAUSE proxy, which holds the
// Postbase service key server-side, validates this user's token, and derives
// the row ownership itself. The only secret the browser ever holds is the
// user's own session token.
//
// ⚠️ EMPTY UNTIL THE PROXY IS DEPLOYED. Set this to the proxy's Vercel URL —
// public, not a secret. Step-by-step: proxy/VERCEL-SETUP.md, Part 7.
// While it is empty every cloud call short-circuits to a clean local error
// rather than firing requests at the Pages origin, so this branch must not be
// merged to main before it is filled in.
// ============================================================
const PAUSE_API_BASE = '';

const PAUSE_TOKEN_KEY = 'pause_session_token';

const PauseAPI = (() => {
  function getToken(){
    try { return localStorage.getItem(PAUSE_TOKEN_KEY) || null; } catch(e){ return null; }
  }
  function setToken(token){
    try {
      if(token) localStorage.setItem(PAUSE_TOKEN_KEY, token);
      else localStorage.removeItem(PAUSE_TOKEN_KEY);
    } catch(e){}
  }

  // Every response is normalised to { data, error } so callers keep the same
  // shape the previous database client used to hand back, and no call site has to
  // reason about HTTP status codes.
  async function call(path, { method = 'GET', body, auth = true, timeoutMs = 15000 } = {}){
    // Not configured yet — fail fast and locally rather than firing requests at
    // a relative path on the GitHub Pages origin, which would 404 as HTML.
    if(!PAUSE_API_BASE){
      return { data: null, error: { message: 'Cloud sync is not configured yet.', status: 0 } };
    }
    const headers = {};
    if(body !== undefined) headers['Content-Type'] = 'application/json';
    if(auth){
      const token = getToken();
      if(!token) return { data: null, error: { message: 'Not signed in' } };
      headers['X-Pause-Token'] = token;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(PAUSE_API_BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const text = await res.text();
      let payload = null;
      if(text){ try { payload = JSON.parse(text); } catch(e){ payload = null; } }

      if(res.status === 401){
        // The token is dead — drop it so the app renders signed-out rather than
        // retrying a credential that will never work again.
        setToken(null);
        return { data: null, error: { message: (payload && payload.error) || 'Session expired', status: 401 } };
      }
      if(!res.ok){
        return { data: null, error: { message: (payload && payload.error) || `Request failed (${res.status})`, status: res.status } };
      }
      return { data: payload, error: null };
    } catch(e){
      return { data: null, error: { message: e.name === 'AbortError' ? 'Request timed out' : 'Network error' } };
    } finally {
      clearTimeout(timer);
    }
  }

  const data = (path, opts) => call('/api/data/' + path, opts);

  return {
    getToken,
    setToken,

    auth: {
      // The Google credential is the ID token from Google Identity Services.
      // The proxy verifies it (including audience), exchanges it for a Postbase
      // session, and asserts the resolved user is the migrated one before
      // handing anything back.
      async signInWithGoogle(credential){
        const { data: d, error } = await call('/api/auth/google', {
          method: 'POST', auth: false, body: { credential }
        });
        if(error) return { user: null, error };
        setToken(d.token);
        return { user: d.user, error: null };
      },

      async signIn(email, password){
        const { data: d, error } = await call('/api/auth/signin', {
          method: 'POST', auth: false, body: { email, password }
        });
        if(error) return { user: null, error };
        setToken(d.token);
        return { user: d.user, error: null };
      },
      async signUp(email, password){
        const { data: d, error } = await call('/api/auth/signup', {
          method: 'POST', auth: false, body: { email, password }
        });
        if(error) return { user: null, error };
        setToken(d.token);
        return { user: d.user, error: null };
      },
      // Restores a session on page load. Returns null when there is no valid
      // token, which is the normal signed-out path — not an error.
      async restore(){
        if(!getToken()) return { user: null, error: null };
        const { data: d, error } = await call('/api/auth/session');
        if(error || !d || !d.user){ setToken(null); return { user: null, error: null }; }
        return { user: d.user, error: null };
      },
      async signOut(){
        await call('/api/auth/signout', { method: 'POST' });
        setToken(null);
      }
    },

    profile: {
      get:  ()     => data('profile'),
      save: (row)  => data('profile', { method: 'PUT', body: row })
    },

    assessments: {
      list:   ()          => data('assessments'),
      create: (row)       => data('assessments', { method: 'POST', body: row }),
      saveAnswers: (id, answers) =>
                             data('assessment-answers', { method: 'POST', body: { id, ...answers } }),
      grantResearchConsent: () =>
                             data('research-consent', { method: 'POST', body: {} })
    },

    logbook: {
      list: ()      => data('logbook'),
      save: (entry) => data('logbook', { method: 'PUT', body: entry })
    },

    weekly: {
      latest: ()     => data('weekly-checkin'),
      create: (row)  => data('weekly-checkin', { method: 'POST', body: row })
    },

    mood: {
      list:   ()             => data('mood'),
      save:   (date, value)  => data('mood', { method: 'PUT', body: { date, value } }),
      remove: (date)         => data('mood?date=' + encodeURIComponent(date), { method: 'DELETE' })
    },

    screentime: {
      list: ()             => data('screentime'),
      save: (date, hours)  => data('screentime', { method: 'PUT', body: { date, hours } })
    },

    challenge: {
      get:  ()     => data('challenge-state'),
      save: (row)  => data('challenge-state', { method: 'PUT', body: row })
    },

    feedback: {
      send: (row) => data('feedback', { method: 'POST', body: row })
    },

    studyCode: {
      check: (code) => data('study-code?code=' + encodeURIComponent(code), { auth: false })
    }
  };
})();
