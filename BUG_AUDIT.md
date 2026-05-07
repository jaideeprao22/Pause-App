# PAUSE App — Bug Audit (Phase 1)

Generated: 2026-05-07
Branch: claude/compassionate-mestorf-3a694c
Scope: every JS file + index.html. No fixes applied.
Sort order: severity (CRITICAL → HIGH → MEDIUM → LOW), then ID.

Severity legend
- **CRITICAL** — crashes, data loss, or wrong stored data
- **HIGH** — broken feature or wrong-output for a primary user flow
- **MEDIUM** — wrong output / misleading UI for an edge case
- **LOW** — polish, console noise, redundant code

---

## CRITICAL

### BUG-001 — Quick Scan saves an impact-only DWS, then a full assessment's history dws becomes inaccurate
**File:** [assessment.js:298-305](assessment.js#L298), [app.js:73-81](app.js#L73)
**Severity:** CRITICAL (data corruption — wrong DWS recorded in `pauseV2History`)
**Description:** In `finishAssessment` for `quick` mode, `dwsScore = calculateDWS(true)` (impact-only). `saveScores()` then writes a history entry where `disorder:{...disorderScores}` may still hold a previous full assessment's disorder scores, but `dws` is impact-only. Trend graphs and "Improved by X pts" comparisons silently mix two different score formulas, so `pauseV2History` is internally inconsistent — and is the single source of truth for the Progress screen + caregiver share.
**Proposed fix:** In `finishAssessment`, when assessMode==='quick', call `dwsScore = calculateDWS()` (no impactOnly) so the saved DWS reflects all data the history snapshot contains. This also fixes Known Bug #1 ("Quick Scan not calculating DWS composite score") — the M1 FIX comment is wrong; staleness is already surfaced via the home-screen recheck label.
**Files touched:** assessment.js

### BUG-002 — `loadAllUserDataFromSupabase` blindly overwrites local data with remote on every login
**File:** [state.js:790-877](state.js#L790)
**Severity:** CRITICAL (offline data loss for users who journal/log/assess BEFORE signing in)
**Description:** The function replaces `pauseV2History`, `pauseLogbook`, `moodLog`, `screenTimeLog`, `pause_urge_log`, `pause_weekly_checkin`, and challenge state with whatever supabase returns — without merging by timestamp. The TODO comment at line 718-723 acknowledges this. Any data created during a guest/offline session is destroyed on login.
**Proposed fix:** Per-table merge by `created_at`/`recorded_at` — keep the union, prefer newer rows. Minimum viable: skip overwrite when remote array is empty AND local is non-empty.
**Files touched:** state.js

### BUG-003 — 7-day Challenge silently nukes user's progress when the week ticks over incomplete
**File:** [progress.js:383-404](progress.js#L383)
**Severity:** CRITICAL (data loss — user's tick-marks discarded)
**Description:** After 7 days pass, `pauseChallenge` is reset to `'[]'` and `currentChallengePack` is regenerated regardless of whether the user finished. A user at 5/7 loses those 5 ticks the moment day 8 starts. Confirms Known Bug #3 — and it's worse than "resetting": the previous days are unrecoverable.
**Proposed fix:** Don't auto-reset on incomplete weeks. If `completed.length < 7`, keep the current pack and `weekStart`, do not increment `currentWeekNum`, and show a banner inviting the user to either complete the remaining days or tap "Start fresh week". Auto-reset only when 7/7 done.
**Files touched:** progress.js

### BUG-004 ✅ FIXED — `Notification.permission` accessed without guarding `'Notification' in window`
**File:** [notifications.js:53](notifications.js#L53), [motivation.js:137](motivation.js#L137)
**Severity:** CRITICAL (uncaught ReferenceError on platforms missing the Notification API — affects older Android WebView, some embedded browsers, and TWA edge cases)
**Description:** Both `scheduleNotification()` callbacks read `Notification.permission` directly inside a `setTimeout`. If the platform doesn't expose `Notification`, this throws and the unhandled rejection breaks subsequent timers. The toggle path correctly uses `'Notification' in window`, but the scheduler path does not.
**Proposed fix:** Wrap with `if('Notification' in window && Notification.permission === 'granted' && ...)`.
**Files touched:** notifications.js, motivation.js

### BUG-005 — `disorderScores` mutation in `loadSavedScores` reassigns the binding, severing live references in other modules at boot
**File:** [app.js:47-49](app.js#L47), [state.js:802-804](state.js#L802)
**Severity:** CRITICAL (subtle — manifests when supabase load completes after the first home render)
**Description:** `loadSavedScores()` does `disorderScores = saved.disorder || {}`. So does `loadAllUserDataFromSupabase`. Because these globals are `let`-declared in state.js, reassignment is module-scoped and *does* propagate — but only if every reader resolves the identifier at call time. The risk is that any closure that captured `disorderScores` directly at a previous tick (e.g. in the `Object.keys(disorderScores).length` checks in render functions) sees stale data. In practice the renders re-read each call so this stays latent — but the `delete` semantics differ: a fresh `{}` won't preserve any in-memory keys set between localStorage write and login fetch.
**Proposed fix:** Mutate-in-place: `Object.keys(disorderScores).forEach(k => delete disorderScores[k]); Object.assign(disorderScores, saved.disorder || {});` (and same for `impactScores`). Avoids any closure pitfalls.
**Files touched:** app.js, state.js

---

## HIGH

### BUG-006 — Google Sign-In button re-rendered every time `loginModal` opens, double-init warning
**File:** [state.js:1135-1144](state.js#L1135), [state.js:142-160](state.js#L142)
**Severity:** HIGH (Known Bug #4 — visible console warning, and the button can flash/double-render on a slow network)
**Description:** `openModal('loginModal')` clears `googleSignInBtn.innerHTML` and calls `google.accounts.id.renderButton` every time. The GSI library logs `[GSI_LOGGER]: ...` when the same element is re-rendered without being detached from a previous initialise context. `initGoogleSignIn` already renders the button on first run.
**Proposed fix:** In `openModal('loginModal')`, only re-render if the button's child iframe has been removed (e.g., `if(!btnEl.children.length) renderButton(...)`). Don't blindly clear.
**Files touched:** state.js

### BUG-007 ✅ FIXED — `bestDWS` reduce in `getBadgeStats` returns 0 when all history entries are impact-only
**File:** [badges.js:10](badges.js#L10)
**Severity:** HIGH (badge "Digital Clean" can never be earned for users who only ever ran Quick Scans, even if every Quick Scan returned a healthy 80+)
**Description:** `history.reduce((max, h) => h.dws > max ? h.dws : max, 0)`. If `h.dws` is `null`, `null > 0` is false, so 0 stays. If every entry has a real DWS but one is null, that's fine. But the bigger issue: with the BUG-001 quick-scan history corruption fixed, this is still broken — Quick Scans before fix saved `dws:null` in some paths.
**Proposed fix:** `history.filter(h => h.dws != null).reduce((max, h) => Math.max(max, h.dws), 0)`.
**Files touched:** badges.js

### BUG-008 — `improvedScore` badge condition compares `history[0].dws > history[1].dws` without null guards
**File:** [badges.js:12](badges.js#L12)
**Severity:** HIGH (`null > null` is false, but `undefined > 50` is false too — silently denies the badge)
**Description:** If either is null, the comparison is always false and the badge never awards. Same root cause as BUG-007 but on a different field.
**Proposed fix:** `history.length >= 2 && history[0].dws != null && history[1].dws != null && history[0].dws > history[1].dws`.
**Files touched:** badges.js

### BUG-009 — Speech recognition session never stops on screen change, page hide, or save fail mid-session
**File:** [logbook.js:184-277](logbook.js#L184)
**Severity:** HIGH (battery + privacy — mic stays hot if user navigates away)
**Description:** `_startSession()` chains itself via `recognition.onend` → `setTimeout(_startSession, 120)` while `isRecording` is true. Nothing in `nav.js showScreen` or a `visibilitychange` handler stops it. If the user taps Home tab mid-recording, the mic keeps re-opening forever (until a hard nav).
**Proposed fix:** Add `document.addEventListener('visibilitychange', () => { if(document.hidden && isRecording) stopRecording(); })` in logbook.js, and call `stopRecording()` from `nav.js showScreen` when leaving `screen-logbook`.
**Files touched:** logbook.js, nav.js

### BUG-010 — Supabase `Profiles` upsert sends 23 always-null fields when called pre-profile
**File:** [state.js:605-643](state.js#L605)
**Severity:** HIGH (creates a Profiles row full of NULLs on first login if user dismisses the profile modal — pollutes research data)
**Description:** `syncProfileToSupabase()` is called from `saveProfile` (real data) AND from `saveEditProfile`. But it's also called via `handleUser → loadAllUserDataFromSupabase → finally` paths in some edge cases. If `userProfile` is `{}`, every field sent is null, but `terms_version: '1.0'` and `updated_at` are always set, so the upsert succeeds and creates a useless row.
**Proposed fix:** Guard `if(!userProfile.age) return;` at the top of `syncProfileToSupabase`. (Age is the cheapest required field.)
**Files touched:** state.js

### BUG-011 — `progressHistory` element accessed without null guard
**File:** [progress.js:209-213](progress.js#L209)
**Severity:** HIGH (TypeError if DOM hasn't rendered the screen yet — happens during the supabase post-login re-render burst)
**Description:** `const el = document.getElementById('progressHistory'); if(!history.length){ el.innerHTML=...}` — `el` may be null. The `if(!history.length)` block accesses `el.innerHTML` unguarded.
**Proposed fix:** `if(!el) return;` immediately after the getElementById. Same defensive pattern used elsewhere in the file.
**Files touched:** progress.js

### BUG-012 — `handleLogout` accesses `userAvatar.style` without null guard
**File:** [state.js:216](state.js#L216)
**Severity:** HIGH (TypeError on logout if avatar element was removed/never rendered — would silently break the auth state-change listener for the rest of the session)
**Proposed fix:** `const a = document.getElementById('userAvatar'); if(a) a.style.display = 'none';`
**Files touched:** state.js

### BUG-013 — `handleUser` accesses `userAvatar` without null guard
**File:** [state.js:181-183](state.js#L181)
**Severity:** HIGH (mirror of BUG-012 — TypeError on session restore if avatar element absent)
**Proposed fix:** Same null-guard pattern.
**Files touched:** state.js

### BUG-014 — `feedbackSuccess` element accessed without null guard
**File:** [state.js:1063](state.js#L1063)
**Severity:** HIGH (TypeError after Feedback submit on About screen if element removed)
**Proposed fix:** Null-guard before `.style.display`.
**Files touched:** state.js

### BUG-015 — `disorderInfoBody` ID exists in modal but is never populated; `explainBody` is used instead
**File:** [index.html:1393](index.html#L1393), [app.js:148](app.js#L148)
**Severity:** HIGH (dead modal — the disorder info modal the HTML defines is never opened. `showScaleInfo` uses `explainModal` instead. Confusing dead code that masks a real wiring issue if anything else ever calls `disorderInfoModal`.)
**Description:** `disorderInfoModal` is defined in HTML with `disorderInfoTitle`/`disorderInfoBody`/`disorderInfoStartBtn`, but no JS code ever opens or fills it. The actual disorder info uses the shared `explainModal`. Either modal should be removed or used.
**Proposed fix:** Out of scope for fix cycle (would touch HTML and require careful cleanup). Flag for future cleanup. Leave in BUG_AUDIT but do not fix in Phase 2/3.
**Files touched:** index.html

### BUG-016 — `showOccupationBranch` doesn't reset all dependent text inputs (workplace fields leak between branches)
**File:** [state.js:290-311](state.js#L290)
**Severity:** HIGH (saves wrong-occupation text fields if user switches occupation mid-form — already partly mitigated in saveEditProfile but NOT in saveProfile)
**Description:** `showOccupationBranch` resets `profileCollegeName` and `profileWorkplace` but not `profileItCompany`, `profileItDepartment`, `profileGovtOrg`, `profileDepartment`, `profileHcDepartment`, `profileOtherOrg`. So if a user fills "Healthcare → workplace=Apollo Hospital", then switches to "IT Professional", the Apollo string never gets to Profiles, but if they fill IT and submit, `profileWorkplace` is empty (correct). However if they switch back to Healthcare, the original Apollo value is still in the input (it was reset). So actually... let me re-check: line 305-306 resets `profileCollegeName` and `profileWorkplace`. The other text inputs (`profileItCompany`, etc.) are NOT reset. So switching Govt → IT then back to Govt leaves stale `profileItCompany`. saveProfile only reads the visible branch's inputs, so this is mostly harmless — except that `profileHcDepartment`, `profileItDepartment`, etc. all get persisted in `userProfile` if their branch is the final one. The leak is small.
**Proposed fix:** Add the missing input IDs to the reset block in `showOccupationBranch`.
**Files touched:** state.js

---

## MEDIUM

### BUG-017 — `0` DWS displayed as `--` in personal summary
**File:** [progress.js:79](progress.js#L79)
**Severity:** MEDIUM (cosmetic — extreme score case)
**Description:** `${latest.dws || '--'}` — falsy 0 renders as `--`. A user with a true DWS of 0 (theoretically possible) sees no number.
**Proposed fix:** `${latest.dws != null ? latest.dws : '--'}`
**Files touched:** progress.js

### BUG-018 — `_parseHistoryDate` fallback `new Date(dateStr)` can produce Invalid Date silently
**File:** [weekly.js:19](weekly.js#L19)
**Severity:** MEDIUM (filter `weekEntries` includes an Invalid Date row, which makes the comparison return false silently — entry effectively excluded but not for a clear reason)
**Description:** If a history entry's date string is unrecognised, the fallback returns Invalid Date. `Invalid Date >= weekStart` returns false. The weekly summary silently drops the entry.
**Proposed fix:** Return null on parse failure and skip those entries explicitly with `.filter(Boolean)`.
**Files touched:** weekly.js

### BUG-019 — `getBadgeStats.disordersScreened` reads in-memory `disorderScores`, not historical breadth
**File:** [badges.js:15](badges.js#L15)
**Severity:** MEDIUM ("Complete Screener" badge counts only the most recent assessment's disorders, not the lifetime union — a user who screened all 6 across 6 single-disorder sessions never earns it because the in-memory state is reloaded from `pauseV2Scores` which gets overwritten)
**Proposed fix:** `disordersScreened: new Set(history.flatMap(h => Object.keys(h.disorder || {}))).size`
**Files touched:** badges.js

### BUG-020 — `selectAnswer` auto-advance can fire `finishAssessment` twice if user taps Finish manually then auto-advance fires
**File:** [assessment.js:261-271](assessment.js#L261)
**Severity:** MEDIUM (rare but reproducible: user selects last-question answer → 300ms timer → user taps Finish → both fire `finishAssessment` → score may save twice → duplicate Supabase Assessments row)
**Description:** `_autoAdvanceTimer` is cleared in `nextQuestion()` (line 275) but `nextQuestion` calls `finishAssessment()` immediately when on last question (line 278). Then when the timer fires (already cleared), the callback is gone, so it shouldn't fire. Wait — clearTimeout DOES cancel. Re-reading: `nextQuestion` clears the timer FIRST (line 275), then runs. So if user clicks Next after selectAnswer, the timer is cleared. OK, not a bug. **Downgrade to LOW** — but I'll mark it as "verify" because the same path with a delayed render could double-fire.
**Update after re-check:** the H3 FIX is correct. NOT A BUG. Removing.

### BUG-021 — `share.js` percentile arrays use raw count, but score `<=` ref[i] returns wrong rank
**File:** [share.js:17-30](share.js#L17)
**Severity:** MEDIUM (off-by-one in shared canvas card percentile)
**Description:** `_shareGetPercentile`: `for(...){ if(score > ref[i]) rank = i+1; }`. For `cyberchondria` ref `[15,18,21,...,75]` (21 entries), a score of 30 would give rank=5 (because 30 > 27=ref[4], 30 > 30=false at ref[5]). But cyberchondria items=15 so min-floor=15. A min-floor score of 15 gives rank=0 → `Math.round(0/21*100) = 0` percentile. Higher than 0% of users — implies you scored worse than everyone, but you actually scored best (lowest disorder).
**Proposed fix:** The percentile semantics here are confused — the canvas card says "Better than X% of users" with scores normalised in the wrong direction for disorder scales (lower = healthier for disorder, higher = healthier for DWS). The simplest correct fix is to compute `rank = ref.filter(v => v < score).length` for the disorder-direction (where higher score = worse). Or — given assessment.js already gates real percentiles behind `PERCENTILE_DATA_READY=false` — this share.js path is also non-pilot data and should be hidden similarly until n≥50.
**Files touched:** share.js

### BUG-022 — `dwsModal modalDWSStatus.style.color` not reset when score becomes null after a previous render
**File:** [results.js:317-322](results.js#L317)
**Severity:** MEDIUM (cosmetic — colour from previous session leaks)
**Description:** When `dwsScore === null`, the else-branch sets text but does NOT reset `modalDWSStatus.style.color`. If a prior render set red/orange, it persists.
**Proposed fix:** Add `document.getElementById('modalDWSStatus').style.color = '';` to the else branch.
**Files touched:** results.js

### BUG-023 — `getCorrelationInsights` impact-pair conditions use `> 5` instead of `>= 5` (off-by-one with band boundary)
**File:** [assessment.js:389-392](assessment.js#L389)
**Severity:** MEDIUM (impact module score of exactly 5 is the "Mild" boundary in `getImpactLevel` — users on the boundary miss the insight)
**Proposed fix:** Use `>= 5` to match `getImpactLevel` boundary semantics.
**Files touched:** assessment.js

### BUG-024 — `renderTrendShareButton` not called from `nav.js` for screen-progress when fewer than 2 assessments exist initially
**File:** [nav.js:43-44](nav.js#L43)
**Severity:** MEDIUM (the gate text shows correctly the first time, but if user does a 2nd assessment then navigates Home → Progress, `renderTrendShareButton` IS called via `if(typeof renderTrendShareButton === 'function')` so this is OK. **Re-checked: not a bug.**)
**Status:** Removing — works as designed.

### BUG-025 — `localStorage.setItem('maxChallengeStreak', completed.length)` writes a number not string
**File:** [progress.js:430](progress.js#L430)
**Severity:** MEDIUM (works due to coercion, but inconsistent with other writes that use `.toString()` — risks future code reading `typeof` checks)
**Proposed fix:** `.toString()` for consistency.
**Files touched:** progress.js

### BUG-026 — `nav.js` modal-overlay click-outside handler is bound at script load, missing dynamically-added modals
**File:** [nav.js:89-91](nav.js#L89)
**Severity:** MEDIUM (the resume / single-over-partial / guest-warn modals built in `assessment.js` have their own non-`.modal-overlay` markup, so clicking their backdrop doesn't dismiss them)
**Description:** The dynamic modals use `position:fixed;inset:0;background:rgba(0,0,0,0.6)` directly without the `.modal-overlay` class, so the document-level handler doesn't apply. CBT walkthrough and action plan modals already attach their own listener; the assessment modals don't.
**Proposed fix:** Add a click handler in each of `showResumeModal`, `startSingleAssessmentWithCheck`, `startFullAssessment` so clicking the backdrop closes the modal.
**Files touched:** assessment.js

### BUG-027 — `screenHistory.push(currentScreen)` runs even when `currentScreen===id` not strictly checked elsewhere
**File:** [nav.js:24-27](nav.js#L24)
**Severity:** MEDIUM (back button can stack the same screen multiple times if showScreen is called with the same id from different places)
**Description:** The check `currentScreen !== id` exists. OK — not a real bug. Removing.

### BUG-028 — `weekly.js getWeekStart` mutates `now` via `setDate`
**File:** [weekly.js:46-53](weekly.js#L46)
**Severity:** MEDIUM (subtle — `now.setDate(diff)` mutates and returns. The function only uses `now` once after the mutation, so not a real bug. Marking as readability concern only.)
**Status:** Not a bug. Removing.

---

## LOW

### BUG-029 — `init()` runs unconditionally at script load with no DOMContentLoaded guard
**File:** [app.js:202](app.js#L202)
**Severity:** LOW (works because all script tags use `defer`, but fragile if anyone removes `defer` or the script tag order changes)
**Proposed fix:** Wrap with `if(document.readyState !== 'loading'){ init(); } else { document.addEventListener('DOMContentLoaded', init); }`. Optional polish.
**Files touched:** app.js

### BUG-030 — `premium-motions.js` is on disk but absent from `index.html` script list and `sw.js` precache
**File:** [index.html:1504-1518](index.html#L1504), [sw.js:11-40](sw.js#L11), CLAUDE.md note
**Severity:** LOW (dead file or missing wiring — visual FX never load)
**Description:** Confirmed via reading both files. Either the FX should be wired in or the file removed.
**Proposed fix:** Decision required — wire it (`<script src="premium-motions.js" defer></script>` + add to PRECACHE_ASSETS) OR delete the file. Defer to user; flag only.
**Files touched:** index.html, sw.js (or delete premium-motions.js)

### BUG-031 — `_logbookClearOnRender` flag toggled true→false synchronously around `renderLogbookScreen` 
**File:** [logbook.js:133-135](logbook.js#L133)
**Severity:** LOW (works because `renderLogbookScreen` reads the flag synchronously before any async, but the comment doesn't explain why the toggle dance is needed — confusing to future maintainers)
**Proposed fix:** None. Documentation polish only — out of scope.

### BUG-032 — `_apmEsc` escape doesn't include `/` (irrelevant for HTML context, but `</script>` injection is theoretical)
**File:** [cbt.js:234-241](cbt.js#L234)
**Severity:** LOW (not exploitable since the strings come from CBT_MODULES_V2 hardcoded data)
**Proposed fix:** Defensive only — add `/` to escape map.
**Files touched:** cbt.js

### BUG-033 — `bumpAppOpenStreak` "yesterday" calculation via `Date.now() - 86400000` is technically off during DST transitions
**File:** [state.js:55](state.js#L55)
**Severity:** LOW (edge case — user opens app exactly during DST forward day at hour 0–1, may see streak reset incorrectly)
**Proposed fix:** Use `new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)` instead of subtracting milliseconds.
**Files touched:** state.js

### BUG-034 — `localStorage.setItem('pauseChallenge','[]')` writes a string-literal `'[]'` rather than `JSON.stringify([])`
**File:** [progress.js:378, 397](progress.js#L378)
**Severity:** LOW (functionally identical, but inconsistent with other writes that use `JSON.stringify`)
**Proposed fix:** None — works. Polish only.

### BUG-035 — `share.js shareResults` writes `localStorage.setItem('hasShared','true')` even if user cancels share dialog
**File:** [share.js:36](share.js#L36)
**Severity:** LOW (the "Advocate" badge awards if user opened the share dialog, even if they didn't share)
**Proposed fix:** Move `localStorage.setItem('hasShared','true')` into the `navigator.share` resolution path (and similarly into the clipboard fallback).
**Files touched:** share.js

### BUG-036 — `init` calls `renderProgress()` at startup even when home is the active screen — wasted work
**File:** [app.js:12](app.js#L12)
**Severity:** LOW (nav.js re-renders on screen change anyway — these eager renders are harmless but wasteful)
**Proposed fix:** None — unrelated to current bug fixes.

### BUG-037 — Inline onclick `weekly.js:113` writes `document.getElementById('reassessmentBanner').style.display='none'` without null guard
**File:** [weekly.js:113](weekly.js#L113)
**Severity:** LOW (unreachable because the onclick is on an element inside the same banner — the banner is guaranteed to exist when the click fires)
**Proposed fix:** None.

### BUG-038 — `data.js` SUPABASE_KEY exposes a publishable key in the client bundle (intentional for Supabase, but worth noting)
**File:** [data.js:5](data.js#L5)
**Severity:** LOW (publishable keys are designed to be public; not a vulnerability per Supabase docs — note only)
**Proposed fix:** None.

### BUG-039 — `acceptReConsent`/`declineReConsent` toast called BEFORE element exists in some paths
**File:** [state.js:1173-1183](state.js#L1173)
**Severity:** LOW (works — `closeModal` runs first as documented in BUG16 FIX comment)
**Status:** No bug.

### BUG-040 — Numerous `console.warn`/`console.log` calls in production code path
**File:** state.js, sw.js, cbt.js
**Severity:** LOW (noise, not a bug)
**Proposed fix:** None for this cycle.

---

## SUMMARY COUNTS
- CRITICAL: 5 (BUG-001 through BUG-005)
- HIGH: 11 (BUG-006 through BUG-016)
- MEDIUM: 7 active (BUG-017, 018, 019, 021, 022, 023, 025, 026); BUG-020, 024, 027, 028 reverted to non-bugs after re-check
- LOW: 12 (BUG-029 through BUG-040)

## FIX-ORDER NOTES (for Phase 2/3)
- Don't touch BUG-015 (dead modal) in Phase 2/3 — flagged only.
- BUG-002 (offline merge) needs a careful design pass — propose a minimal "skip when remote empty" patch first, defer the timestamp-merge to a later cycle.
- BUG-003 challenge fix is the user's biggest pain point but the simplest fix.
- BUG-001 fix is a one-line change but ALSO requires updating the M1 FIX comment.
- BUG-030 (premium-motions) needs user decision — flag only, no fix.

## OUT OF SCOPE (per user instructions)
- Scroll/overscroll/backdrop-filter CSS — never touched.
- Supabase schema changes — none of the proposed fixes require them.
- New bugs found during fix work get added here, not fixed in the current cycle.
