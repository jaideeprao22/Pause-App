const { query } = require('./postbase');
const { readColumns, sanitizeWrite } = require('./tables');

// Note the field name: Postbase expects `operator`, not `op`.
const eq = (column, value) => ({ column, operator: 'eq', value });

// Upper bound on rows pulled before the proxy sorts and slices. The documented
// /api/db/query shape has no ordering parameter, so "latest N" has to be done
// here: fetch the owner's rows, sort, then cut. Per-user row counts in this app
// are in the tens, so this stays cheap — but the cap keeps a pathological
// account from ballooning a response.
const FETCH_CAP = 500;

function sortRows(rows, orderBy, direction = 'desc') {
  if (!orderBy) return rows;
  const dir = direction === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = a ? a[orderBy] : undefined;
    const bv = b ? b[orderBy] : undefined;
    // Missing values sort last regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const at = typeof av === 'string' ? Date.parse(av) : NaN;
    const bt = typeof bv === 'string' ? Date.parse(bv) : NaN;
    if (!Number.isNaN(at) && !Number.isNaN(bt)) return (at - bt) * dir;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

// ---- Owner-scoped operations ----------------------------------------------
//
// Every function below takes the server-derived userId and builds the
// ownership filter itself. There is no code path that scopes a query by an
// id that came from the request body.

async function ownedSelect(table, userId, { extraFilters = [], limit, orderBy, direction } = {}) {
  const rows = await query({
    operation: 'select',
    table,
    columns: readColumns(table),
    filters: [eq('user_id', userId), ...extraFilters],
    limit: FETCH_CAP,
  });
  const sorted = sortRows(rows, orderBy, direction);
  return limit ? sorted.slice(0, limit) : sorted;
}

async function ownedInsert(table, userId, data) {
  const clean = sanitizeWrite(table, data);
  return query({
    operation: 'insert',
    table,
    // user_id is stamped last so a caller-supplied one — already stripped by
    // sanitizeWrite — could never win even if the allow-list changed.
    data: { ...clean, user_id: userId },
  });
}

async function ownedUpdate(table, userId, extraFilters, data) {
  const clean = sanitizeWrite(table, data);
  if (!Object.keys(clean).length) return [];
  return query({
    operation: 'update',
    table,
    filters: [eq('user_id', userId), ...extraFilters],
    data: clean,
  });
}

async function ownedDelete(table, userId, extraFilters = []) {
  return query({
    operation: 'delete',
    table,
    filters: [eq('user_id', userId), ...extraFilters],
  });
}

// Upsert, spelled out as select-then-branch.
//
// We do not assume Postbase exposes an `upsert` operation or honours an
// ON CONFLICT target, so this composes the three primitives we know exist.
// `matchFilters` identifies the row *within* the user's own rows; the
// ownership filter is added on top by the callees, so a miss can only ever
// fall through to inserting a row owned by the same caller.
async function ownedUpsert(table, userId, matchFilters, data) {
  const existing = await ownedSelect(table, userId, { extraFilters: matchFilters, limit: 1 });
  if (existing.length) {
    return ownedUpdate(table, userId, matchFilters, data);
  }
  return ownedInsert(table, userId, data);
}

module.exports = { eq, ownedSelect, ownedInsert, ownedUpdate, ownedDelete, ownedUpsert, sortRows, FETCH_CAP };
