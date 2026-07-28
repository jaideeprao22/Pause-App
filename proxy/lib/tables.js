// Column allow-lists.
//
// Every table the proxy can touch is listed here, along with exactly which
// columns may be read and which may be written. Anything absent is rejected —
// there is no "pass the rest through" branch. When the app grows a field, it
// gets added here deliberately.
//
// `owner` marks tables whose rows belong to a single user. For those, the
// proxy always injects the ownership filter from the server-derived user id
// and always overwrites user_id on write. The browser cannot influence either.

const PROFILE_FIELDS = [
  'age', 'gender', 'education', 'occupation',
  'study_field', 'college_name', 'profession_role', 'work_mode', 'workplace',
  'hc_department', 'it_company', 'it_department', 'govt_org', 'govt_department',
  'other_org', 'country', 'residence_type', 'living_situation',
  'primary_device', 'daily_screentime', 'avg_sleep', 'self_rated_health',
  'chronic_illness', 'physical_activity', 'prev_detox_attempt',
  'referral_source', 'followup_consent', 'study_code', 'terms_version',
];

// Demographic snapshot copied onto each Assessments row at submit time.
const ASSESSMENT_DEMOGRAPHICS = [
  'age', 'gender', 'education', 'occupation', 'country', 'residence_type',
  'living_situation', 'primary_device', 'daily_screentime', 'avg_sleep',
  'self_rated_health', 'chronic_illness', 'physical_activity',
  'prev_detox_attempt', 'referral_source', 'followup_consent', 'study_code',
];

const ASSESSMENT_CORE = [
  'disorder_scores', 'impact_scores', 'dws_score', 'hws_score',
  'research_consent', 'consent_version', 'consent_timestamp', 'terms_version',
  'app_version', 'scale_version', 'created_at',
];

// Stage-2 follow-up questions, written by a separate narrow handler.
const ASSESSMENT_POST = ['post_q1', 'post_q2', 'post_q3', 'post_assess_disorder'];

const TABLES = {
  Profiles: {
    owner: true,
    read: ['user_id', 'updated_at', ...PROFILE_FIELDS],
    write: ['updated_at', ...PROFILE_FIELDS],
  },

  Assessments: {
    owner: true,
    read: ['id', 'user_id', ...ASSESSMENT_CORE, ...ASSESSMENT_DEMOGRAPHICS, ...ASSESSMENT_POST],
    write: [...ASSESSMENT_CORE, ...ASSESSMENT_DEMOGRAPHICS],
  },

  logbook: {
    owner: true,
    read: ['id', 'user_id', 'date', 'prompt', 'text', 'created_at'],
    write: ['id', 'date', 'prompt', 'text', 'created_at'],
  },

  WeeklyCheckin: {
    owner: true,
    read: ['id', 'user_id', 'q1', 'q2', 'q3', 'checked_at'],
    write: ['q1', 'q2', 'q3', 'checked_at'],
  },

  MoodLog: {
    owner: true,
    read: ['id', 'user_id', 'date', 'value', 'recorded_at'],
    write: ['date', 'value', 'recorded_at'],
  },

  ScreenTime: {
    owner: true,
    read: ['id', 'user_id', 'date', 'hours', 'recorded_at'],
    write: ['date', 'hours', 'recorded_at'],
  },

  ChallengeState: {
    owner: true,
    read: [
      'user_id', 'week_start', 'current_week_num', 'weeks_completed',
      'max_streak', 'current_pack', 'completed_indices', 'updated_at',
    ],
    write: [
      'week_start', 'current_week_num', 'weeks_completed',
      'max_streak', 'current_pack', 'completed_indices', 'updated_at',
    ],
  },

  // Feedback is owner-scoped for reads (the app never reads it back, but the
  // policy is owner-scoped and we honour it) and insert-only for the caller.
  Feedback: {
    owner: true,
    read: ['id', 'user_id', 'rating', 'category', 'message', 'contact_email', 'app_version', 'created_at'],
    write: ['rating', 'category', 'message', 'contact_email', 'app_version', 'created_at'],
  },

  // The one non-owner-scoped table: a public lookup of open study cohorts.
  // Read-only, and only ever rows with active = true. No write path exists.
  StudyCodes: {
    owner: false,
    read: ['code', 'label', 'active'],
    write: [],
  },
};

function tableDef(table) {
  const def = TABLES[table];
  if (!def) throw new Error(`Table not in allow-list: ${table}`);
  return def;
}

function readColumns(table) {
  return tableDef(table).read.slice();
}

// Drop every key that is not an allowed writable column, then drop keys whose
// value is `undefined` (which would otherwise serialise away and confuse the
// upstream). user_id is never accepted from the caller — handlers add it.
function sanitizeWrite(table, input) {
  const allowed = new Set(tableDef(table).write);
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input)) {
    if (!allowed.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

module.exports = { TABLES, tableDef, readColumns, sanitizeWrite };
