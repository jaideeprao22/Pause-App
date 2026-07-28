const test = require('node:test');
const assert = require('node:assert');

process.env.POSTBASE_SERVICE_KEY = 'test-service-key';
process.env.POSTBASE_PROJECT_ID = 'test-project';
process.env.ALLOWED_ORIGIN = 'https://pause.jaideeprao.com';

const { sanitizeWrite, readColumns, tableDef } = require('../lib/tables');
const { rows } = require('../lib/postbase');
const { applyCors, handlePreflightAndOrigin } = require('../lib/cors');
const { sortRows } = require('../lib/db');

// --- Allow-lists -----------------------------------------------------------

test('sanitizeWrite drops columns that are not on the write allow-list', () => {
  const out = sanitizeWrite('MoodLog', { date: '2026-07-28', value: 4, is_admin: true, note: 'x' });
  assert.deepStrictEqual(out, { date: '2026-07-28', value: 4 });
});

test('sanitizeWrite strips a caller-supplied user_id on every owner-scoped table', () => {
  for (const table of ['Profiles', 'Assessments', 'logbook', 'WeeklyCheckin',
                       'MoodLog', 'ScreenTime', 'ChallengeState', 'Feedback']) {
    const out = sanitizeWrite(table, { user_id: 'someone-elses-uuid' });
    assert.strictEqual(out.user_id, undefined, `${table} let user_id through`);
  }
});

test('sanitizeWrite ignores non-object input rather than throwing', () => {
  assert.deepStrictEqual(sanitizeWrite('MoodLog', null), {});
  assert.deepStrictEqual(sanitizeWrite('MoodLog', ['date']), {});
});

test('StudyCodes has no writable columns at all', () => {
  assert.deepStrictEqual(tableDef('StudyCodes').write, []);
  assert.deepStrictEqual(sanitizeWrite('StudyCodes', { code: 'X', active: true }), {});
});

test('an unlisted table is rejected, not silently allowed', () => {
  assert.throws(() => readColumns('UrgeLog'), /not in allow-list/);
  assert.throws(() => readColumns('pg_catalog.pg_user'), /not in allow-list/);
});

test('post-assessment columns are readable but not part of the insert allow-list', () => {
  assert.ok(readColumns('Assessments').includes('post_q1'));
  assert.strictEqual(sanitizeWrite('Assessments', { post_q1: 'a' }).post_q1, undefined);
});

// --- Ownership filters -----------------------------------------------------
//
// Exercised against a stub so the assertions are about the descriptor the proxy
// builds, which is the part that enforces isolation.

function withStubbedQuery(fn) {
  const postbase = require('../lib/postbase');
  const captured = [];
  const original = postbase.query;
  postbase.query = async (descriptor) => { captured.push(descriptor); return []; };
  // db.js captured `query` at import time, so reload it against the stub.
  delete require.cache[require.resolve('../lib/db')];
  const db = require('../lib/db');
  return Promise.resolve(fn(db, captured)).finally(() => {
    postbase.query = original;
    delete require.cache[require.resolve('../lib/db')];
  });
}

test('ownedSelect always filters on the derived user id', () => withStubbedQuery(async (db, captured) => {
  await db.ownedSelect('MoodLog', 'user-a');
  assert.deepStrictEqual(captured[0].filters[0], { column: 'user_id', operator: 'eq', value: 'user-a' });
  assert.strictEqual(captured[0].operation, 'select');
  assert.strictEqual(captured[0].table, 'MoodLog');
}));

test('filters use "operator", never "op"', () => withStubbedQuery(async (db, captured) => {
  await db.ownedSelect('Profiles', 'user-a', { extraFilters: [db.eq('date', '2026-07-28')] });
  for (const f of captured[0].filters) {
    assert.ok('operator' in f, 'filter is missing the operator field');
    assert.ok(!('op' in f), 'filter used the wrong field name "op"');
  }
}));

test('ownedInsert stamps the derived user id and ignores one from the body', () =>
  withStubbedQuery(async (db, captured) => {
    await db.ownedInsert('MoodLog', 'user-a', { date: '2026-07-28', value: 3, user_id: 'user-b' });
    assert.strictEqual(captured[0].data.user_id, 'user-a');
  }));

test('ownedUpdate keeps the ownership filter alongside a row-id filter', () =>
  withStubbedQuery(async (db, captured) => {
    await db.ownedUpdate('logbook', 'user-a', [db.eq('id', 'row-1')], { text: 'hello' });
    assert.deepStrictEqual(captured[0].filters, [
      { column: 'user_id', operator: 'eq', value: 'user-a' },
      { column: 'id', operator: 'eq', value: 'row-1' },
    ]);
  }));

test('ownedUpdate with nothing writable left does not issue a query', () =>
  withStubbedQuery(async (db, captured) => {
    await db.ownedUpdate('MoodLog', 'user-a', [], { user_id: 'user-b', nope: 1 });
    assert.strictEqual(captured.length, 0);
  }));

test('ownedDelete is scoped to the caller', () => withStubbedQuery(async (db, captured) => {
  await db.ownedDelete('MoodLog', 'user-a', [db.eq('date', '2026-07-28')]);
  assert.strictEqual(captured[0].operation, 'delete');
  assert.deepStrictEqual(captured[0].filters[0], { column: 'user_id', operator: 'eq', value: 'user-a' });
}));

test('ownedUpsert falls through to an insert owned by the caller when no row matches', () =>
  withStubbedQuery(async (db, captured) => {
    await db.ownedUpsert('ScreenTime', 'user-a', [db.eq('date', '2026-07-28')], { date: '2026-07-28', hours: 5 });
    assert.strictEqual(captured[0].operation, 'select');
    assert.strictEqual(captured[1].operation, 'insert');
    assert.strictEqual(captured[1].data.user_id, 'user-a');
  }));

// --- Ordering --------------------------------------------------------------

test('sortRows orders ISO timestamps newest-first and puts missing values last', () => {
  const sorted = sortRows(
    [{ t: '2026-01-01T00:00:00Z' }, { t: null }, { t: '2026-07-01T00:00:00Z' }],
    't', 'desc'
  );
  assert.deepStrictEqual(sorted.map((r) => r.t), ['2026-07-01T00:00:00Z', '2026-01-01T00:00:00Z', null]);
});

test('sortRows does not mutate its input', () => {
  const input = [{ t: 'b' }, { t: 'a' }];
  sortRows(input, 't', 'asc');
  assert.strictEqual(input[0].t, 'b');
});

// --- Response envelope -----------------------------------------------------

test('rows() normalises the plausible upstream envelopes', () => {
  assert.deepStrictEqual(rows([{ id: 1 }]), [{ id: 1 }]);
  assert.deepStrictEqual(rows({ data: [{ id: 1 }] }), [{ id: 1 }]);
  assert.deepStrictEqual(rows({ rows: [{ id: 1 }] }), [{ id: 1 }]);
  assert.deepStrictEqual(rows({ data: { id: 1 } }), [{ id: 1 }]);
  assert.deepStrictEqual(rows(null), []);
  assert.deepStrictEqual(rows({ unexpected: true }), []);
});

// --- CORS ------------------------------------------------------------------

function fakeRes() {
  return {
    headers: {}, statusCode: null, body: null, ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { this.ended = true; return this; },
  };
}

test('the allowed origin is echoed, never a wildcard', () => {
  const res = fakeRes();
  applyCors({ method: 'GET', headers: { origin: 'https://pause.jaideeprao.com' } }, res);
  assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://pause.jaideeprao.com');
  assert.notStrictEqual(res.headers['Access-Control-Allow-Origin'], '*');
});

test('an unlisted origin gets no CORS headers and a 403', () => {
  const res = fakeRes();
  const handled = handlePreflightAndOrigin({ method: 'POST', headers: { origin: 'https://evil.example' } }, res);
  assert.strictEqual(handled, true);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.headers['Access-Control-Allow-Origin'], undefined);
});

test('a request with no Origin header is rejected', () => {
  const res = fakeRes();
  const handled = handlePreflightAndOrigin({ method: 'GET', headers: {} }, res);
  assert.strictEqual(handled, true);
  assert.strictEqual(res.statusCode, 403);
});

test('preflight from the allowed origin succeeds and advertises the token header', () => {
  const res = fakeRes();
  const handled = handlePreflightAndOrigin({ method: 'OPTIONS', headers: { origin: 'https://pause.jaideeprao.com' } }, res);
  assert.strictEqual(handled, true);
  assert.strictEqual(res.statusCode, 204);
  assert.match(res.headers['Access-Control-Allow-Headers'], /X-Pause-Token/);
});

test('responses vary on Origin so a cache cannot serve one origin from another', () => {
  const res = fakeRes();
  applyCors({ method: 'GET', headers: { origin: 'https://evil.example' } }, res);
  assert.strictEqual(res.headers.Vary, 'Origin');
});
