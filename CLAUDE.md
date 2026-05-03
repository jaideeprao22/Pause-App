# PAUSE App — Project Context

Single-page PWA/TWA for digital wellness screening. Vanilla JS, no build step. Runs in browsers and as a TWA on Android.

## Architecture

`index.html` is the shell — every screen and modal is a section in one HTML file. Scripts load with `defer` in dependency order at the bottom of `index.html`. No bundler, no framework.

## File split (17 JS files, load order matters)

1. `data.js` — Supabase client init; the 6 `DISORDERS`, 4 `IMPACT_MODULES`, `CHALLENGES`, `BADGES`.
2. `state.js` — Global mutable state + auth + profile + feedback + modals + urge log (kitchen-sink).
3. `badges.js` — Badge stats from history; awards/checks badges.
4. `notifications.js` — Daily notification toggle + scheduling.
5. `assessment.js` — Engine: build full/quick/single, scoring, DWS, partial-progress resume, percentiles, correlations, home cards.
6. `results.js` — Results screen rendering after `finishAssessment()`.
7. `progress.js` — Progress tab + 7-day Challenge + personal summary.
8. `share.js` — Share card + percentile reference data.
9. `logbook.js` — Daily journaling with speech-to-text (escapes user input before innerHTML).
10. `motivation.js` — Disorder-specific daily reminder messages.
11. `weekly.js` — Sunday weekly report (manual date parser for Safari/WebView).
12. `cbt.js` — Severity-keyed CBT modules per disorder ID.
13. `screentime.js` — Screen-time daily log.
14. `app.js` — `init()` orchestrator + `loadSavedScores`/`saveScores`/`saveScoresLocal`; renders home assess menu.
15. `nav.js` — `showScreen()` router; back-button + tab history.
16. `premium-motions.js` — Visual ambient FX (orbs, sparks). Not in script list — loaded elsewhere or unwired.
17. `sw.js` — Service worker (`pause-app-v10-aurora`); cache-first, derives BASE from own location.

Other: `index.html`, `manifest.json`, `style.css`, `privacy-policy.html`, `terms.html`, `icons/`, `screenshots/`, `.well-known/`.

## state.js — what it manages

Module-global vars at top: `currentScreen`, `screenHistory`, `assessMode`, `singleDisorderIdx`, `allQuestions`/`allAnswers`/`currentQIdx`/`questionMeta` (in-progress run), `disorderScores`/`impactScores`/`dwsScore` (last completed), `currentUser`, `userProfile`, `profileSelections`.

Also defines: `window.AppGrades` (canonical grade store, key `pause_grades`), `showToast()`, full Supabase auth (`initAuth`/`handleUser`/`handleLogout`), profile save + edit + Supabase sync, Stage 2 post-assessment research data, feedback submission, T&C / login flow, `openModal`/`closeModal`, 90-day re-consent, Urge Journal.

## The 6 scales (data-driven from `DISORDERS` in data.js)

| Scale | id | data.js line |
|---|---|---|
| CSS-15 Cyberchondria | `cyberchondria` | 12 |
| BSMAS Social Media | `socialmedia` | 60 |
| SVAS-6 Short-Form Video | `shortform` | 87 |
| IGDS9-SF Gaming | `gaming` | 114 |
| PCGUS AI Dependency | `ai` | 144 (Turkish sample only — interpret with caution) |
| BWAS Digital Work | `workaddiction` | 174 |

Severity bands inline per disorder. `getLevel(disorder, score)` at `assessment.js:344` maps sum → band. Scoring is fully data-driven; no per-scale code.

## Digital Wellness Score (DWS)

`calculateDWS(impactOnly=false)` at `assessment.js:323`.

```
disorder risk = (score - items) / (maxScore - items)   // baseline-subtracted, weight 1.0
impact   risk = score / (items * 4) * 0.5              // weight 0.5
DWS = round((1 - totalRisk / totalMax) * 100)          // higher = healthier
```

`calculateDWS(true)` skips disorders — used by Quick Scan so stale disorder scores from a prior full run don't contaminate the new DWS (M1 FIX). Status bands: `getDWSStatus()` at `assessment.js:348`.

## Three assessment modes

Dispatched by `assessMode`. All share one renderer (`renderQuestion`).

| | Full | Quick | Single |
|---|---|---|---|
| Builder | `buildFullAssessment` | `buildQuickAssessment` | `buildSingleAssessment(dIdx)` |
| Coverage | 6 disorders + 4 impact modules (~71 Qs) | 4 impact modules only (20 Qs) | One disorder's items |
| Entry | `startFullAssessment` → guest warning → resume modal if partial | `startQuickScan` — direct, no warning, no resume | `startSingleAssessment(dIdx)` |
| Save & Exit | shown | hidden | hidden |
| Partial-resume | yes (24h window, key `pause_partial_full_assessment`) | no | no |
| Scoring | `calculateDWS()` (full blend) | `calculateDWS(true)` (impact-only) | `calculateDWS()` (blended w/ existing) |
| Results default tab | overall | forced to `impact` | overall |

## Known issues / gotchas

- **TWA notification limits**: TWA can't natively schedule background notifications — relies on web Notifications API which only fires while the app is open. Service worker push not implemented.
- **PCGUS scale**: validated on Turkish sample only — interpret AI Dependency results with caution.
- **Percentiles hidden**: `PERCENTILE_DATA_READY = false` in `assessment.js`. Flip to `true` once n ≥ 50 pilot data collected.
- **Safari date parsing**: history entries use `en-IN` locale strings; `weekly.js` has a manual parser because `new Date("26 Apr 2026")` fails on WebKit.
- **`alert()` blocked in TWA WebView** — always use `showToast()` instead.
- **`premium-motions.js`** is not in the `index.html` script list — verify wiring before relying on its FX.
- **Supabase tables** referenced: `Assessments`, `Profiles`, `UrgeLog`, `WeeklyCheckin`, `Feedback`. Migration SQL is in comments inside `state.js`.

## Deployment

- **Web**: GitHub Pages auto-deploys on push to `main`. Repo serves at the `/Pause-App/` subpath; `sw.js` derives its BASE from its own location to handle this.
- **TWA signing keystore**: `C:\Users\jaide\android.keystore`.
