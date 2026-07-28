const { handlePreflightAndOrigin } = require('../../lib/cors');
const { query, PostbaseError } = require('../../lib/postbase');
const { requireUser, AuthError } = require('../../lib/auth');
const { eq, ownedSelect, ownedInsert, ownedUpdate, ownedDelete, ownedUpsert } = require('../../lib/db');
const { readColumns } = require('../../lib/tables');

// ---------------------------------------------------------------------------
// This is NOT a passthrough. The browser names a resource from the closed set
// below and nothing else: it cannot choose a table, an operation, a filter, a
// column, or a user id. Each entry hard-codes all of those. The file is one
// Vercel function purely so the project fits comfortably inside the Hobby plan's
// function budget — the handlers are as narrow as if they were separate files.
// ---------------------------------------------------------------------------

const json = (res, code, body) => res.status(code).json(body);
const ok = (res, body = { ok: true }) => json(res, 200, body);

function isoNow() {
  return new Date().toISOString();
}

// Reject a date that isn't a plain YYYY-MM-DD key, since MoodLog/ScreenTime use
// it as the per-day identity and a junk value would create unreachable rows.
function dayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

const RESOURCES = {
  // ---- Profiles ----------------------------------------------------------
  profile: {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('Profiles', user.id, { limit: 1 });
      return ok(res, { profile: rows[0] || null });
    },
    async PUT(req, res, user) {
      const data = { ...(req.body || {}), updated_at: isoNow() };
      await ownedUpsert('Profiles', user.id, [], data);
      return ok(res);
    },
  },

  // ---- Assessments -------------------------------------------------------
  assessments: {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('Assessments', user.id, {
        limit: 20,
        orderBy: 'created_at',
        direction: 'desc',
      });
      return ok(res, { assessments: rows });
    },
    async POST(req, res, user) {
      const body = req.body || {};
      // The client must have actively consented; the flag is written by the
      // proxy, not trusted from the payload shape.
      if (body.research_consent !== true) {
        return json(res, 400, { error: 'Assessments may only be written with active research consent' });
      }
      const data = { ...body, research_consent: true, created_at: body.created_at || isoNow() };
      const inserted = await ownedInsert('Assessments', user.id, data);

      let id = inserted && inserted[0] && inserted[0].id;
      if (!id) {
        // Insert didn't echo the row — read back the caller's newest row so the
        // client still gets the id it needs for the stage-2 follow-up write.
        const latest = await ownedSelect('Assessments', user.id, {
          limit: 1,
          orderBy: 'created_at',
          direction: 'desc',
        });
        id = latest[0] && latest[0].id;
      }
      return json(res, 201, { id: id || null });
    },
  },

  // Stage-2 post-assessment questions, written onto one of the caller's own
  // assessment rows. The row id is checked against their ownership filter.
  'assessment-answers': {
    auth: true,
    async POST(req, res, user) {
      const body = req.body || {};
      const id = body.id;
      if (id === undefined || id === null || id === '') {
        return json(res, 400, { error: 'Assessment id is required' });
      }
      const answers = {};
      for (const key of ['post_q1', 'post_q2', 'post_q3', 'post_assess_disorder']) {
        if (typeof body[key] === 'string' && body[key]) answers[key] = body[key];
      }
      if (!Object.keys(answers).length) {
        return json(res, 400, { error: 'No post-assessment answers supplied' });
      }
      // sanitizeWrite drops these (they're not in Assessments.write, which
      // covers the initial insert), so update directly with the vetted subset.
      await query({
        operation: 'update',
        table: 'Assessments',
        filters: [eq('user_id', user.id), eq('id', id)],
        data: answers,
      });
      return ok(res);
    },
  },

  // Retroactively flips research_consent on the caller's existing assessments
  // when they tick the consent box later.
  'research-consent': {
    auth: true,
    async POST(req, res, user) {
      await ownedUpdate('Assessments', user.id, [], { research_consent: true });
      return ok(res);
    },
  },

  // ---- Logbook -----------------------------------------------------------
  logbook: {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('logbook', user.id, {
        limit: 200,
        orderBy: 'created_at',
        direction: 'desc',
      });
      return ok(res, { entries: rows });
    },
    async PUT(req, res, user) {
      const body = req.body || {};
      if (!body.id) return json(res, 400, { error: 'Entry id is required' });
      await ownedUpsert('logbook', user.id, [eq('id', body.id)], {
        ...body,
        created_at: body.created_at || isoNow(),
      });
      return ok(res);
    },
  },

  // ---- Weekly check-in ---------------------------------------------------
  'weekly-checkin': {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('WeeklyCheckin', user.id, {
        limit: 1,
        orderBy: 'checked_at',
        direction: 'desc',
      });
      return ok(res, { checkin: rows[0] || null });
    },
    async POST(req, res, user) {
      const body = req.body || {};
      await ownedInsert('WeeklyCheckin', user.id, {
        ...body,
        checked_at: body.checked_at || isoNow(),
      });
      return json(res, 201, { ok: true });
    },
  },

  // ---- Mood --------------------------------------------------------------
  mood: {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('MoodLog', user.id, {
        limit: 60,
        orderBy: 'date',
        direction: 'desc',
      });
      return ok(res, { moods: rows });
    },
    async PUT(req, res, user) {
      const body = req.body || {};
      const date = dayKey(body.date);
      if (!date) return json(res, 400, { error: 'A YYYY-MM-DD date is required' });
      await ownedUpsert('MoodLog', user.id, [eq('date', date)], {
        date,
        value: body.value,
        recorded_at: isoNow(),
      });
      return ok(res);
    },
    async DELETE(req, res, user) {
      const date = dayKey(req.query.date);
      if (!date) return json(res, 400, { error: 'A YYYY-MM-DD date is required' });
      await ownedDelete('MoodLog', user.id, [eq('date', date)]);
      return ok(res);
    },
  },

  // ---- Screen time -------------------------------------------------------
  screentime: {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('ScreenTime', user.id, {
        limit: 30,
        orderBy: 'date',
        direction: 'desc',
      });
      return ok(res, { entries: rows });
    },
    async PUT(req, res, user) {
      const body = req.body || {};
      const date = dayKey(body.date);
      if (!date) return json(res, 400, { error: 'A YYYY-MM-DD date is required' });
      await ownedUpsert('ScreenTime', user.id, [eq('date', date)], {
        date,
        hours: body.hours,
        recorded_at: isoNow(),
      });
      return ok(res);
    },
  },

  // ---- Challenge state ---------------------------------------------------
  'challenge-state': {
    auth: true,
    async GET(req, res, user) {
      const rows = await ownedSelect('ChallengeState', user.id, { limit: 1 });
      return ok(res, { state: rows[0] || null });
    },
    async PUT(req, res, user) {
      const data = { ...(req.body || {}), updated_at: isoNow() };
      await ownedUpsert('ChallengeState', user.id, [], data);
      return ok(res);
    },
  },

  // ---- Feedback ----------------------------------------------------------
  // Insert-only, and the row is stamped with the caller's derived id. Note this
  // now requires sign-in: the ownership policy leaves no room for an anonymous
  // insert. See README "Behaviour changes".
  feedback: {
    auth: true,
    async POST(req, res, user) {
      const body = req.body || {};
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (message.length < 3) return json(res, 400, { error: 'A feedback message is required' });
      await ownedInsert('Feedback', user.id, {
        ...body,
        message: message.slice(0, 5000),
        created_at: body.created_at || isoNow(),
      });
      return json(res, 201, { ok: true });
    },
  },

  // ---- Study codes -------------------------------------------------------
  // The only non-owner-scoped read in the system, mirroring the public
  // read-only policy. Exact-match lookup, active rows only, and the response
  // carries just the label — never the full cohort list.
  'study-code': {
    auth: false,
    async GET(req, res) {
      const raw = req.query.code;
      const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
      if (!code || code.length > 64) return json(res, 400, { error: 'A study code is required' });
      const rows = await query({
        operation: 'select',
        table: 'StudyCodes',
        columns: readColumns('StudyCodes'),
        filters: [eq('code', code), eq('active', true)],
        limit: 1,
      });
      // Defence in depth: even if the upstream ignored the active filter, an
      // inactive row must not validate.
      const row = rows.find((r) => r && r.active === true && r.code === code);
      return ok(res, { valid: !!row, label: row ? row.label || row.code : null });
    },
  },
};

module.exports = async function handler(req, res) {
  if (handlePreflightAndOrigin(req, res)) return;

  const name = String(req.query.resource || '');
  const resource = Object.prototype.hasOwnProperty.call(RESOURCES, name) ? RESOURCES[name] : null;
  if (!resource) return json(res, 404, { error: 'Unknown resource' });

  const fn = resource[req.method];
  if (typeof fn !== 'function') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = resource.auth ? await requireUser(req) : null;
    return await fn(req, res, user);
  } catch (e) {
    if (e instanceof AuthError) return json(res, 401, { error: e.message });
    if (e && e.isPostbaseError) {
      console.error(`[data:${name}] upstream ${e.status}:`, e.message);
      return json(res, 502, { error: 'Data service unavailable' });
    }
    console.error(`[data:${name}]`, e);
    return json(res, 500, { error: 'Internal error' });
  }
};
