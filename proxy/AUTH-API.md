# Postbase auth surface

Base: `https://db.clinoble.com/api/auth/v1/{projectId}`
Service credential: `apikey` header (the proxy also sends `Authorization: Bearer`,
which the rest of the API uses — one convention everywhere beats a per-route rule).

## OAuth routes are nested under `/oauth/`

```
POST /api/auth/v1/{projectId}/oauth/id-token
GET  /api/auth/v1/{projectId}/oauth/authorize
GET  /api/auth/v1/{projectId}/oauth/callback/{provider}
```

**They are not at the top level, and a top-level probe cannot see them.**
`/{projectId}/authorize`, `/{projectId}/google`, `/{projectId}/oauth/google` all
return the same `500` as a deliberately bogus path — an erroring catch-all, not
a 404. So route enumeration reports them as absent when they exist one level
down. This bit us once; it is written down so it does not again.

The reliable signal for *this* API is:

| Response | Meaning |
| --- | --- |
| `401 {"error":"Missing API key"}` | route exists, needs the service key |
| `405` (empty) | route exists, wrong method |
| `500` (empty) | **inconclusive** — unrouted path, says nothing about existence |
| `404` HTML | outside `/api/auth/v1/**` entirely |

## `POST /oauth/id-token` — the route PAUSE uses

```jsonc
// Request
{
  "provider": "google",
  "id_token": "<the credential from Google Identity Services>",
  "nonce": "…",         // optional
  "remember_me": true    // optional
}

// Response
{
  "user":    { "id", "email", "name", "image", "emailVerified", "createdAt" },
  "session": { "accessToken", "refreshToken", "expiresAt", "user" }
}
```

The field is **`id_token`**, snake_case, always. There is nothing to negotiate,
and `/token` must not be used for Google — it is the password grant.

### What Postbase verifies

JWKS signature, issuer `accounts.google.com`, audience against the
dashboard-configured `clientId` (comma-splittable for multiple client IDs), and
`nonce` when one is sent.

The proxy **also** verifies signature, issuer, expiry and audience locally
(`lib/google.js`). That is deliberate duplication: the audience check is what
stops an ID token minted for a different Google application being replayed here,
and we do not want it to depend on how the upstream dashboard happens to be
configured.

### Errors

| Status | Condition |
| --- | --- |
| 401 | `id_token` verification failed |
| 401 | nonce mismatch |
| 400 | Provider not enabled |
| 400 | `no_email_from_provider` |

Mapped to user-facing wording in `describeGrantFailure()`. "Provider not
enabled" is surfaced as a 503 and logged as a configuration fault, because it is
ours to fix, not the user's.

### Identity linking

```sql
INSERT INTO accounts (user_id, type, provider, provider_account_id)
VALUES ($1, 'oauth', $2, $3)
ON CONFLICT (provider, provider_account_id) DO NOTHING
```

`ON CONFLICT … DO NOTHING` on exactly the key we seeded means the nine
pre-seeded rows win and can be neither duplicated nor overwritten. A Google sub
resolves to its migrated UUID by construction.

The proxy asserts it anyway on every sign-in — see README, "The assertion".
Guaranteed-by-construction and verified-at-runtime are different things, and the
cost of the second is one indexed lookup.

## Other routes

| Route | Method | Notes |
| --- | --- | --- |
| `/token` | POST | email + password. **Disabled** for this project — every migrated account is Google-only with no password hash. |
| `/signup` | POST | email + password. Disabled, as above. |
| `/session` | GET | returns `{"session": null}` unauthenticated |
| `/user` | GET | authoritative user for a token; the proxy's ownership derivation |
| `/logout` | POST | |
