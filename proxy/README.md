# PAUSE proxy

A minimal serverless proxy that holds the Postbase service key so the PAUSE PWA
never has to. The PWA stays exactly where it is — a static site on GitHub Pages —
and only its data calls change.

## Why this exists

PAUSE previously talked to a hosted Postgres backend directly from the browser
using a publishable key, and relied on the database's row-level security to keep
one user out of another's rows.

**Self-hosted Postbase does not enforce RLS.** Every request authenticated with
the service key can read and write every row in every table. A key in the browser
is therefore no longer "publishable but harmless" — it would be a full database
compromise by anyone who opened DevTools. And Postbase requires the service key
on *every* endpoint including `/api/auth/v1/{projectId}/token`, so there is no
reduced-privilege credential a browser could hold instead:

```
$ curl -s -XPOST https://db.clinoble.com/api/db/query -d '{"operation":"select","table":"StudyCodes"}'
{"error":"Missing API key"}
```

So the key moves server-side, and this proxy becomes the thing that enforces what
RLS used to.

## Deploying

Its own Vercel project (free/Hobby tier is enough), **not** the one serving the
PWA.

1. New Vercel project → import this repository.
2. Set **Root Directory** to `proxy`.
3. Environment variables (Production **and** Preview):

   | Name | Value |
   | --- | --- |
   | `POSTBASE_SERVICE_KEY` | the service key — never anywhere else |
   | `POSTBASE_PROJECT_ID` | `04a46c89-2217-4449-ae7f-57a4c479b988` |
   | `POSTBASE_URL` | `https://db.clinoble.com` |
   | `ALLOWED_ORIGIN` | `https://pause.jaideeprao.com` |
   | `GOOGLE_CLIENT_ID` | `857927388938-…apps.googleusercontent.com` (audience check) |

4. Deploy, then set `PAUSE_API_BASE` at the top of `api.js` in the PWA to the
   deployment URL and push. That URL is public — it is not a secret.

`vercel.json` pins the region to `bom1` (Mumbai), next to the users.

## Design

**No generic passthrough.** The browser cannot name a table, an operation, a
filter, a column, or a user id. It names a *resource* from a closed set, and the
handler for that resource hard-codes everything else. `api/data/[resource].js` is
a single file only so the project sits comfortably inside the Hobby function
budget — the dispatch table is closed and each entry is as narrow as a separate
file would be. An unknown resource name is a 404, not a fallthrough.

**Ownership is derived, never accepted.** Every data request carries the user's
own token in `X-Pause-Token`. The proxy hands that to Postbase's `/user` endpoint,
gets back the authoritative user record, and uses *that* id to build the
`user_id` filter and to stamp writes. A `user_id` in a request body is stripped
by the column allow-list and would be overwritten anyway.

**Allow-lists, fail closed.** `lib/tables.js` lists every reachable table and,
per table, exactly which columns may be read and written. Anything unlisted is
dropped on write and never requested on read.

**The service key is always the Bearer credential.** The user's token is a
separate header. `lib/postbase.js` is the only place that constructs either, so
the two can't get crossed.

**`/api/db/sql` is never called.** Raw SQL bypasses every check above.

### Endpoints

| Method + path | Table | Scope |
| --- | --- | --- |
| `POST /api/auth/google` | `accounts` (read) | verifies the ID token, exchanges it, asserts the identity link |
| `POST /api/auth/signin` | — | **disabled (501)** — password auth is off |
| `POST /api/auth/signup` | — | **disabled (501)** — password auth is off |
| `GET /api/auth/session` | — | re-validates the caller's token |
| `POST /api/auth/signout` | — | forwards to Postbase `/logout` |
| `GET`/`PUT /api/data/profile` | Profiles | owner |
| `GET`/`POST /api/data/assessments` | Assessments | owner |
| `POST /api/data/assessment-answers` | Assessments | owner + row id |
| `POST /api/data/research-consent` | Assessments | owner |
| `GET`/`PUT /api/data/logbook` | logbook | owner |
| `GET`/`POST /api/data/weekly-checkin` | WeeklyCheckin | owner |
| `GET`/`PUT`/`DELETE /api/data/mood` | MoodLog | owner |
| `GET`/`PUT /api/data/screentime` | ScreenTime | owner |
| `GET`/`PUT /api/data/challenge-state` | ChallengeState | owner |
| `POST /api/data/feedback` | Feedback | owner (insert only) |
| `GET /api/data/study-code?code=` | StudyCodes | public, `active = true` only |

## Auth

**Google Sign-In only.** Password auth is disabled for this project — every
migrated account is Google-only, with no password hash — so `signin`/`signup`
return `501 password_auth_disabled` unless `POSTBASE_PASSWORD_AUTH_ENABLED=true`.
They stay in the tree as an additive path if that ever changes.

`POST /api/auth/google` takes the Google credential (the ID token from Google
Identity Services) and does three things:

**1. Verifies the ID token locally**, before it goes anywhere: signature against
Google's JWKS, issuer, expiry, and — the one that matters most — `aud` against
`GOOGLE_CLIENT_ID`. Without the audience check, an ID token minted for *any
other* Google application could be replayed here and would look like a valid
sign-in. Upstream probably checks it too; we cannot see that code, so it gets
checked on our side regardless.

**2. Exchanges it** at `POST /api/auth/v1/{projectId}/oauth/id-token` with
`{provider: "google", id_token: "<credential>"}`. Note `id_token`, snake_case.
**Not** `/token` — that endpoint is password-only. See `AUTH-API.md` for the
full surface and for why a top-level probe makes the OAuth routes look absent.

**3. Asserts the resolved user is the migrated one.** This is the regression
test for the whole orphaning class of bug, and it runs on every sign-in.

### The assertion

`accounts` has `PRIMARY KEY (provider, provider_account_id)` and is seeded from
the Google subject IDs carried over in the migration, so a given Google sub maps
to exactly one migrated `user_id` — enforced by the database. Every PAUSE row is
keyed to that UUID.

The proxy does not take that on trust. After the exchange it looks up
`accounts` by the *verified* sub and refuses the sign-in with `409
identity_not_linked` unless the row exists **and** its `user_id` equals the id
`/token` returned. It fails in both directions that matter:

| Condition | Meaning | Result |
| --- | --- | --- |
| no `accounts` row for the sub | sub was never seeded; Postbase minted or will mint a fresh user | refused |
| `row.user_id` ≠ returned id | the exchange resolved to the wrong user | refused |
| `accounts` unreadable | cannot verify, so cannot proceed | refused |

Refusing is deliberate. Signing someone into an app whose history has silently
orphaned looks exactly like data loss, and the user cannot tell the difference —
an error message they can report is strictly better. `accounts` is deliberately
**not** in `lib/tables.js`, so it can never be reached through `/api/data/*`.

## Authorization

Ported from `pg_policies` on the old backend, with one deliberate departure.

Owner-scoped for read **and** write: `Assessments`, `ChallengeState`, `Feedback`,
`MoodLog`, `Profiles`, `ScreenTime`, `WeeklyCheckin`, `logbook`.
`StudyCodes` is read-only and only ever returns rows with `active = true`.

### The departure: "Allow all reads" is not ported

The old backend carried a policy named **"Allow all reads"** on `Assessments`
and an equivalent on `logbook`, both `USING (true)` for role `public`. Postgres
ORs permissive policies together, so those two policies defeated the ownership
policies sitting beside them and made **every user's assessment scores and every
user's private journal entries readable by anyone with the anon key**.

That is a pre-existing data leak, almost certainly a development leftover. It is
**not** reproduced here: reads on both tables are owner-scoped like every other
table. Nothing in the app relied on the wider access.

If any tooling outside the app depended on those open reads, it will now fail —
which is the correct outcome, and should be handled with a server-side export
using the service key rather than by reopening public read access.

## Known gaps

- **`UrgeLog` has no endpoint.** It is not among the nine migrated tables and has
  no policy to port, so — fail closed — the proxy does not expose it. The urge
  journal in the app is device-local until the table and its policy exist.
- **Ordering happens in the proxy.** The documented `/api/db/query` shape has no
  ordering parameter, so "latest N" is done by fetching the caller's rows (capped
  at 500), sorting, then slicing. Fine at this data size; revisit if a single
  user's row count grows.
- **Upsert is select-then-insert-or-update**, not an atomic `ON CONFLICT`. Two
  concurrent writes to the same key from the same user could race. In practice
  these are single-device, user-initiated saves.
- **Token validation is cached for 30s** per warm instance, so a signed-out token
  can remain usable for up to 30 seconds.

## Tests

```
npm test
```

Covers the allow-lists, ownership-filter construction, CORS behaviour, and the
response-envelope normaliser. No network, no credentials required.
