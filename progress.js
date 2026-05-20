// ============================================================
// PROGRESS & CHALLENGE
// ============================================================

// ─── PERSONAL SUMMARY CARD ───────────────────────────────────
function renderPersonalSummary(){
  const el = document.getElementById('progressSummaryCard');
  if(!el) return;
  const history = safeJsonParse('pauseV2History', []);

  if(!history.length){
    el.innerHTML = `<div class="card" style="text-align:center;padding:20px;margin-bottom:12px">
      <div style="font-size:32px;margin-bottom:8px">🌱</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Your journey starts here</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.6">Complete your first check-up to see a personalised progress summary.</div>
    </div>`;
    return;
  }

  const latest  = history[0];
  const prev    = history.length > 1 ? history[1] : null;
  const _dwsVals  = history.filter(h => h.dws != null).map(h => h.dws);
  const best    = _dwsVals.length ? Math.max(..._dwsVals) : null; // BUG6 FIX: avoid -Infinity
  const s       = latest.dws ? getDWSStatus(latest.dws) : null;
  const total   = history.length;

  // Trend vs last check-up
  let trendHtml = '';
  if(prev && prev.dws !== null && latest.dws !== null){
    const diff  = latest.dws - prev.dws;
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    const col   = diff > 0 ? '#2ecc71' : diff < 0 ? '#ff6b35' : '#f5a623';
    const label = diff > 0 ? `Improved by ${diff} pts` : diff < 0 ? `Decreased by ${Math.abs(diff)} pts` : 'No change';
    trendHtml   = `<div style="font-size:12px;color:${col};font-weight:700;margin-top:4px">${arrow} ${label} since last check-up</div>`;
  }

  // Biggest improvement across disorders
  let insightHtml = '';
  if(prev && prev.disorder && latest.disorder){
    let biggestGain = null, biggestGainAmt = 0;
    let biggestConcern = null, biggestConcernNorm = -1;
    DISORDERS.forEach(d => {
      const cur = latest.disorder[d.id], pre = prev.disorder[d.id];
      if(cur !== undefined && pre !== undefined){
        const gain = pre - cur; // lower score = less disorder = improvement
        if(gain > biggestGainAmt){ biggestGainAmt = gain; biggestGain = d; }
      }
      if(cur !== undefined){
        const norm = (cur - d.questions.length) / (d.maxScore - d.questions.length);
        if(norm > biggestConcernNorm){ biggestConcernNorm = norm; biggestConcern = d; }
      }
    });
    if(biggestGain && biggestGainAmt > 0){
      insightHtml += `<div style="font-size:12px;color:var(--text);margin-top:6px">🌱 Biggest improvement: <strong>${biggestGain.name}</strong></div>`;
    }
    if(biggestConcern && biggestConcernNorm > 0.35){
      insightHtml += `<div style="font-size:12px;color:var(--text);margin-top:3px">💡 Focus area: <strong>${biggestConcern.name}</strong></div>`;
    }
  } else if(latest.disorder){
    // First assessment — show worst area as focus
    let biggestConcern = null, biggestConcernNorm = -1;
    DISORDERS.forEach(d => {
      const cur = latest.disorder[d.id];
      if(cur !== undefined){
        const norm = (cur - d.questions.length) / (d.maxScore - d.questions.length);
        if(norm > biggestConcernNorm){ biggestConcernNorm = norm; biggestConcern = d; }
      }
    });
    if(biggestConcern && biggestConcernNorm > 0.35){
      insightHtml = `<div style="font-size:12px;color:var(--text);margin-top:6px">💡 Area to focus on: <strong>${biggestConcern.name}</strong></div>`;
    }
  }

  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:4px">Digital Wellness Score</div>
          <div style="font-size:36px;font-weight:800;font-family:'Syne',sans-serif;color:${s?s.color:'var(--muted)'};line-height:1">${latest.dws != null ? latest.dws : '--'}</div>
          <div style="font-size:12px;font-weight:700;color:${s?s.color:'var(--muted)'};margin-top:2px">${s?s.status:''}</div>
          ${trendHtml}
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Check-ups done</div>
          <div style="font-size:28px;font-weight:800;font-family:'Syne',sans-serif;color:var(--accent)">${total}</div>
          ${best ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">Best score</div>
          <div style="font-size:16px;font-weight:700;color:#2ecc71">${best}</div>` : ''}
        </div>
      </div>
      ${insightHtml}
    </div>`;
}

// ─── DISORDER PROGRESS CARDS ─────────────────────────────────
function renderDisorderProgress(){
  const el = document.getElementById('disorderProgressCards');
  if(!el) return;
  const history = safeJsonParse('pauseV2History', []);

  if(!history.length){ el.innerHTML=''; return; }

  const latest  = history[0];
  const prev    = history.length > 1 ? history[1] : null;
  const screened = typeof DISORDERS !== 'undefined'
    ? DISORDERS.filter(d => latest.disorder && latest.disorder[d.id] !== undefined)
    : [];

  if(!screened.length){ el.innerHTML=''; return; }

  const cards = screened.map(d => {
    const score    = latest.disorder[d.id];
    const level    = getLevel(d, score);
    const prevScore = prev && prev.disorder ? prev.disorder[d.id] : undefined;
    const pct      = Math.round(((score - d.questions.length) / (d.maxScore - d.questions.length)) * 100);

    let changeHtml = '';
    if(prevScore !== undefined){
      const diff = score - prevScore;
      if(diff < 0)       changeHtml = `<span style="color:#2ecc71;font-size:11px;font-weight:700">↓ ${Math.abs(diff)} pts — Improved ✓</span>`;
      else if(diff > 0)  changeHtml = `<span style="color:#ff6b35;font-size:11px;font-weight:700">↑ ${diff} pts — Increased</span>`;
      else               changeHtml = `<span style="color:var(--muted);font-size:11px">→ No change since last check-up</span>`;
    } else {
      changeHtml = `<span style="font-size:11px;color:var(--muted);font-style:italic">First result for this area</span>`;
    }

    return `<div class="card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:${d.bg};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${d.icon}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${d.name}</div>
            <div style="font-size:10px;color:var(--muted)">${d.scale}</div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:13px;font-weight:700;color:${level.color}">${level.label}</div>
          <div style="font-size:10px;color:var(--muted)">${score} / ${d.maxScore}</div>
        </div>
      </div>
      <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;border-radius:4px;background:${level.color};width:${pct}%;transition:width 0.6s ease"></div>
      </div>
      ${changeHtml}
    </div>`;
  }).join('');

  const unscreened = typeof DISORDERS !== 'undefined'
    ? DISORDERS.filter(d => !latest.disorder || latest.disorder[d.id] === undefined)
    : [];

  const unscreenedHtml = unscreened.length
    ? `<div style="font-size:12px;color:var(--muted);padding:10px 0 4px;line-height:1.7">
        ${unscreened.map(d => `${d.icon} ${d.name}`).join(' · ')} — not yet checked. Complete a Full Check-up to see all areas.
       </div>`
    : '';

  el.innerHTML = `
    <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px">📋 Area by Area</div>
    ${cards}
    ${unscreenedHtml}
  `;
}

// ─── MOOD TREND ───────────────────────────────────────────────
function renderMoodTrend(){
  const el = document.getElementById('moodTrendSection');
  if(!el) return;
  const moodLog = safeJsonParse('moodLog', []).slice(0,14).reverse();
  if(!moodLog.length){ el.innerHTML='<div style="font-size:12px;color:var(--muted)">Log your mood daily to see trends here.</div>'; return; }
  // BUG16 FIX: use global MOODS from motivation.js instead of redeclaring
  const _moodRef = (typeof MOODS !== 'undefined') ? MOODS : [{value:5,emoji:'😊',color:'#2ecc71'},{value:4,emoji:'🙂',color:'#00c9a7'},{value:3,emoji:'😐',color:'#f5a623'},{value:2,emoji:'😔',color:'#ff6b35'},{value:1,emoji:'😰',color:'#ff4757'}];
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:4px;height:60px">
    ${moodLog.map(m => {
      const mood = _moodRef.find(x => x.value === m.value);
      const pct = (m.value/5)*100;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;background:${mood?.color||'var(--border)'};border-radius:3px 3px 0 0;height:${pct}%"></div>
        <div style="font-size:10px">${mood?.emoji||'😐'}</div>
      </div>`;
    }).join('')}
  </div><div style="font-size:10px;color:var(--muted);text-align:center;margin-top:4px">Mood last 14 days</div>`;
}

function renderProgress(){
  renderPersonalSummary();
  renderDisorderProgress();
  renderMoodTrend();
  if(typeof renderTrajectoryBadges==='function') renderTrajectoryBadges(); // BUG4 FIX
  const history = safeJsonParse('pauseV2History', []);

  // Trend graph
  const trendBars = document.getElementById('trendBars');
  if(trendBars){
    const recent = history.filter(h=>h.dws != null).slice(0,7).reverse();
    if(recent.length===0){
      trendBars.innerHTML='<div style="font-size:12px;color:var(--muted);width:100%;text-align:center">No data yet</div>';
    } else {
      trendBars.innerHTML = recent.map(h => {
        const s=getDWSStatus(h.dws);
        const pct = (h.dws/100)*100;
        return `<div class="trend-bar-wrap">
          <div class="trend-bar" style="height:${pct}%;background:${s.color}"></div>
          <div class="trend-bar-label">${h.dws}</div>
        </div>`;
      }).join('');
    }
  }

  const el = document.getElementById('progressHistory');
  if(!el) return;
  if(!history.length){
    el.innerHTML='<div class="notice blue"><div class="notice-title">No history yet</div>Complete your first assessment to start tracking progress.</div>';
    return;
  }
  el.innerHTML = history.map(h => {
    const s=h.dws != null ?getDWSStatus(h.dws):null;
    return `<div class="history-item">
      <div class="history-dot" style="background:${s?s.color:'var(--muted)'}"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:${s?s.color:'var(--muted)'}">${s?s.status:'Impact Only'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${h.date}</div>
      </div>
      ${h.dws?`<div style="text-align:right"><div class="history-score" style="color:${s.color}">${h.dws}</div><div style="font-size:10px;color:var(--muted)">/ 100</div></div>`:''}
    </div>`;
  }).join('');
}

// ============================================================
// PERSONALIZED 7-DAY CHALLENGE PACK
// ============================================================
// A pack is generated once per 7-day cycle from the user's top assessment
// disorders (4 tips from #1 + 2 from #2 + 1 wildcard from CHALLENGES).
// The pack is frozen for the cycle so completion indices stay stable.
// At cycle reset, a new pack is generated using current top disorders and
// (where pool size allows) excluding tip IDs from the previous pack.
// ============================================================
const CHALLENGE_PACK_KEY = 'currentChallengePack';
const _CONCERN_PCT_THRESHOLD = 0.20; // baseline-subtracted % above which a disorder is "concerning"

// CHALLENGE-DAY-LOCK: ticks were Array<number>; now Array<{idx, day}>.
// Reads localStorage, migrating legacy bare-index entries on first read so
// the new same-day lock check sees a blank `day` (which never matches
// today's date — they pass the lock without contention).
function _readChallengeTicks(){
  const raw = safeJsonParse('pauseChallenge', []);
  if(!Array.isArray(raw) || raw.length === 0) return [];
  if(typeof raw[0] === 'number') return raw.map(idx => ({ idx, day: '' }));
  return raw;
}

function _loadActivePack(){
  return safeJsonParse(CHALLENGE_PACK_KEY, null);
}
function _saveActivePack(pack){
  try { localStorage.setItem(CHALLENGE_PACK_KEY, JSON.stringify(pack)); }
  catch(e){ /* quota/unavailable — fail silently, pack will regenerate next render */ }
  if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
}

function _disorderTipObj(disorderId, idx){
  const d = DISORDERS.find(x => x.id === disorderId);
  const tip = (TIPS_BY_DISORDER[disorderId] || [])[idx];
  if(!d || !tip) return null;
  // Tip is {text, cbtModuleId?} — older string-typed entries fall through
  // to .text===undefined and the pack day renders blank, so this also
  // protects against any future plain-string entries slipping in.
  const text = (typeof tip === 'string') ? tip : tip.text;
  if(!text) return null;
  return { kind:'disorder', disorder:disorderId, disorderName:d.name, color:d.color, icon:d.icon, tipId:disorderId+':'+idx, text };
}
function _wildcardTipObj(idx){
  const c = CHALLENGES[idx];
  if(!c) return null;
  return { kind:'wildcard', icon:c.icon, tipId:'wildcard:'+idx, text:c.text };
}

function _shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// Pick `count` tips from a disorder's pool, preferring indices not in `excludeSet`.
// Falls back to allowing reuse if exclusion would leave fewer fresh than `count`.
function _pickTips(disorderId, count, excludeSet){
  const pool = TIPS_BY_DISORDER[disorderId];
  if(!pool || !pool.length) return [];
  const allIdx = pool.map((_,i) => i);
  const fresh = allIdx.filter(i => !excludeSet.has(disorderId+':'+i));
  let chosen;
  if(fresh.length >= count){
    chosen = _shuffle(fresh).slice(0, count);
  } else {
    const reused = _shuffle(allIdx.filter(i => excludeSet.has(disorderId+':'+i)));
    chosen = fresh.concat(reused).slice(0, count);
  }
  return chosen.map(i => _disorderTipObj(disorderId, i)).filter(Boolean);
}

function _pickWildcards(count, excludeSet){
  const allIdx = CHALLENGES.map((_,i) => i);
  const fresh = allIdx.filter(i => !excludeSet.has('wildcard:'+i));
  let chosen;
  if(fresh.length >= count){
    chosen = _shuffle(fresh).slice(0, count);
  } else {
    const reused = _shuffle(allIdx.filter(i => excludeSet.has('wildcard:'+i)));
    chosen = fresh.concat(reused).slice(0, count);
  }
  return chosen.map(_wildcardTipObj).filter(Boolean);
}

// ============================================================
// PERSONALIZED PACK V2 — DISORDER-SEVERITY RANKING
// ============================================================
// Day N maps to the user's Nth-most-severe disorder. Day 7 maps to the
// user's most-affected health-impact module. Frozen at challenge start
// AND auto-regenerates when the user's assessment scores change AND no
// ticks exist yet (so re-assessment fluidly updates the pack until the
// week is in progress). Mid-challenge re-assessment shows a banner with
// a manual reset CTA instead of forcing a regen.
// ============================================================

// Tie-break order (stable). Used both as the secondary sort for disorder
// ranking and as the fallback ordering for the impact module pick.
const _TIE_BREAK_ORDER = [
  'cyberchondria',  // #1
  'gaming',         // #2
  'socialmedia',    // #3
  'shortform',      // #4
  'workaddiction',  // #5
  'ai'              // #6
];

// Normalized severity (0..1) using baseline-subtracted percentage so
// scales with different ranges (CSS-15 / BSMAS / SVAS-6 / IGDS9-SF /
// PCGUS / BWAS) compare fairly. Returns null for unscored disorders.
function _normDisorderScore(d){
  if(!d || disorderScores[d.id] === undefined) return null;
  const span = d.maxScore - d.questions.length;
  if(span <= 0) return 0;
  return (disorderScores[d.id] - d.questions.length) / span;
}

// Returns ALL 6 disorder IDs ranked highest-norm-first. Ties broken by
// _TIE_BREAK_ORDER. Returns null if any disorder is unscored (caller
// falls back to generic + CTA — strict gate per spec).
function _rankDisorders(){
  const ranked = [];
  for(const d of DISORDERS){
    const n = _normDisorderScore(d);
    if(n === null) return null; // strict: any unscored → bail
    ranked.push({ id: d.id, n, t: _TIE_BREAK_ORDER.indexOf(d.id) });
  }
  ranked.sort((a, b) => (b.n - a.n) || (a.t - b.t));
  return ranked.map(x => x.id);
}

// Pick the user's highest-scoring impact module. Each module is 5
// questions × 4 = 20 max. Ties broken by IMPACT_MODULES order. Returns
// null if no module is scored.
function _rankImpactModule(){
  let bestId = null, bestNorm = -1;
  for(const m of IMPACT_MODULES){
    if(impactScores[m.id] === undefined) continue;
    const norm = impactScores[m.id] / (m.questions.length * 4);
    if(norm > bestNorm){ bestNorm = norm; bestId = m.id; }
  }
  return bestId;
}

// Plain-English band labels for whyMatters lines. Disorders use their
// own configured `levels` (CSS-15 etc. each have their own thresholds).
function _disorderBandLabel(disorderId){
  const d = DISORDERS.find(x => x.id === disorderId);
  if(!d || disorderScores[d.id] === undefined) return '';
  const score = disorderScores[d.id];
  const lvl = (d.levels || []).find(l => score >= l.min && score <= l.max);
  return lvl ? lvl.label.toLowerCase() : '';
}

// Impact bands derived from raw score (3 items × 4 = 12 max).
// Recalibrated May 2026 — previous bands (≤5/≤10/≤15) were left over from
// an earlier 5-question version, making the "very high" band unreachable.
// Bands match getImpactLevel in assessment.js (Minimal/Mild/Moderate/High).
function _impactBandLabel(impactId){
  const s = impactScores[impactId];
  if(s === undefined || s === null) return '';
  if(s <= 3) return 'low';
  if(s <= 6) return 'moderate';
  if(s <= 9) return 'high';
  return 'very high';
}

// Per-disorder one-line micro-task. Concrete, on-brand with TIPS_BY_DISORDER.
const _DISORDER_TASKS = {
  cyberchondria:'Today: pause for 30 seconds before any health-related search. Notice the urge — let it pass.',
  socialmedia:  'Today: open social media only with a specific purpose in mind. Close it when that purpose is met.',
  shortform:    'Today: replace one short-video session with a 10-minute walk, stretch, or breath break.',
  gaming:       'Today: set a hard stop time for gaming. End when it hits — even if you\'re mid-match.',
  ai:           'Today: try solving one small problem yourself before reaching for an AI assistant.',
  workaddiction:'Today: end work at a fixed hour. No email, no Slack, no laptop past that line.'
};
const _IMPACT_TASKS = {
  sleep:       'Tonight: charge your phone outside the bedroom. Notice how falling asleep feels.',
  attention:   'Today: 25 focused minutes on one task with phone face-down or in another room.',
  productivity:'Today: write your top 3 priorities on paper, off-phone, before opening any app.',
  emotional:   'Today: 10 minutes outdoors with no phone. Notice how your mood shifts.'
};

// Build a single disorder day. `excludeSet` is consulted so weeks rotate
// through different tips when the user repeatedly resets.
function _buildDisorderDay(disorderId, dayNum, excludeSet){
  const d = DISORDERS.find(x => x.id === disorderId);
  if(!d) return null;
  const picked = _pickTips(disorderId, 1, excludeSet)[0];
  if(!picked) return null;
  const band = _disorderBandLabel(disorderId);
  return {
    kind:'disorder',
    disorder: disorderId,
    disorderName: d.name,
    color: d.color,
    icon: d.icon,
    tipId: picked.tipId,
    text: picked.text,
    // V2 personalized fields
    dayKind: 'disorder',
    dayLabel: DISORDER_DAY_LABEL[disorderId] || d.name,
    whyMatters: band ? `Your ${d.name.toLowerCase()} score came back in the ${band} range.` : '',
    todoTask: _DISORDER_TASKS[disorderId] || ''
  };
}

// Build the Day 7 impact module card.
function _buildImpactDay(impactId){
  const m = IMPACT_MODULES.find(x => x.id === impactId);
  const pool = (typeof IMPACT_TIPS !== 'undefined') ? IMPACT_TIPS[impactId] : null;
  if(!m || !pool || !pool.length) return null;
  const tip = pool[0]; // index 0 — deterministic; varies across modules, not weeks
  const band = _impactBandLabel(impactId);
  return {
    kind:'impact',
    impactModuleId: impactId,
    impactModuleName: m.name,
    color: m.color,
    icon: m.icon,
    tipId: 'impact:' + impactId + ':0',
    text: tip.text,
    // V2 personalized fields
    dayKind: 'impact',
    dayLabel: IMPACT_DAY_LABEL[impactId] || m.name,
    whyMatters: band ? `Your ${m.name.toLowerCase()} score is in the ${band} range.` : '',
    todoTask: _IMPACT_TASKS[impactId] || ''
  };
}

// Generic fallback pack — used when assessment is missing/incomplete.
// Same shape as legacy: 4 from rotation #1 + 2 from rotation #2 + 1 wildcard.
// No metaVersion — the renderer treats unmarked packs as legacy-style.
function _genericMixedPack(weekNum){
  const ids = DISORDERS.map(d => d.id);
  const safeWeek = Math.max(1, weekNum || 1);
  const startIdx = (safeWeek - 1) % ids.length;
  const rotated = ids.slice(startIdx).concat(ids.slice(0, startIdx));
  const days = [];
  const empty = new Set();
  days.push(..._pickTips(rotated[0], 4, empty));
  days.push(..._pickTips(rotated[1], 2, empty));
  days.push(..._pickWildcards(1, empty));
  return { sourceDisorders: rotated.slice(0, 2), fallback: true, days };
}

// Fingerprint of the user's current scores. Used to detect when the user
// has retaken an assessment so renderChallenge can decide whether to
// silently regen (no ticks yet) or surface a banner (mid-challenge).
function _currentScoresHash(){
  const ds = {};
  DISORDERS.forEach(d => { if(disorderScores[d.id] !== undefined) ds[d.id] = disorderScores[d.id]; });
  const is = {};
  IMPACT_MODULES.forEach(m => { if(impactScores[m.id] !== undefined) is[m.id] = impactScores[m.id]; });
  return JSON.stringify({ds, is});
}

function _generateChallengePack(prevPack){
  const weekNum = parseInt(localStorage.getItem('currentWeekNum') || '1');
  const excludeSet = new Set((prevPack && Array.isArray(prevPack.usedTipIds)) ? prevPack.usedTipIds : []);

  // Strict gate: ALL 6 disorders must be scored to personalize. Anything
  // less → generic fallback. CTA in renderChallenge nudges the user to
  // complete the assessment so the next regen personalizes.
  const ranked = _rankDisorders();
  const impactId = _rankImpactModule();
  const canPersonalize = ranked && impactId;

  let pack;
  if(!canPersonalize){
    pack = _genericMixedPack(weekNum);
  } else {
    const days = [];
    for(let i = 0; i < 6; i++){
      const dd = _buildDisorderDay(ranked[i], i + 1, excludeSet);
      if(dd) days.push(dd);
    }
    const impDay = _buildImpactDay(impactId);
    if(impDay) days.push(impDay);
    pack = {
      days,
      sourceDisorders: ranked.slice(0, 2),
      fallback: false,
      // V2 metadata — frozen at generation time
      metaVersion: 2,
      disorderOrder: ranked,
      impactModule: impactId,
      startedAt: new Date().toISOString(),
      isPersonalized: true
    };
  }

  // Top up to exactly 7 days using wildcards (defensive — only fires if a
  // tip pool was unexpectedly empty). CHALLENGES has 7 entries, so this
  // terminates.
  while(pack.days.length < 7){
    const used = new Set(pack.days.map(d => d.tipId));
    const wIdxAvail = CHALLENGES.map((_,i)=>i).filter(i => !used.has('wildcard:'+i));
    if(!wIdxAvail.length) break;
    const wc = _wildcardTipObj(wIdxAvail[0]);
    if(!wc) break;
    pack.days.push(wc);
  }
  pack.days = pack.days.slice(0, 7);

  pack.generatedAt = Date.now();
  pack.weekNum = weekNum;
  pack.usedTipIds = pack.days.map(d => d.tipId);
  pack.scoresHash = _currentScoresHash();
  return pack;
}

function renderChallenge(){
  const weekStart = localStorage.getItem('challengeWeekStart');
  const now = Date.now();
  const sevenDaysPassed = weekStart && (now - parseInt(weekStart) > 7*24*60*60*1000);
  const isFirstLoad = !weekStart;
  let prevPackForRegen = null;
  let didReset = false; // BUG-003 FIX: track whether a real week-rollover happened

  if(isFirstLoad){
    // First ever load — start Week 1
    localStorage.setItem('pauseChallenge','[]');
    localStorage.setItem('challengeWeekStart', now.toString());
    localStorage.setItem('currentWeekNum', '1');
    localStorage.setItem('challengeWeeksCompleted', '0');
    if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
  } else if(sevenDaysPassed){
    // BUG-003 FIX: lenient policy — only auto-reset when the previous week was
    // actually completed. For incomplete weeks, keep the existing pack and
    // weekStart so the user can pick up where they left off. No "expired" banner.
    // CHALLENGE-DAY-LOCK: read via helper so legacy/new shapes both work.
    const completed = _readChallengeTicks();
    if(completed.length === 7){
      const prevWeekNum = parseInt(localStorage.getItem('currentWeekNum')||'1');
      const weeks = parseInt(localStorage.getItem('challengeWeeksCompleted')||'0');
      localStorage.setItem('challengeWeeksCompleted', (weeks + 1).toString());
      localStorage.setItem('currentWeekNum', (prevWeekNum + 1).toString());
      localStorage.setItem('pauseChallenge','[]');
      localStorage.setItem('challengeWeekStart', now.toString());
      localStorage.setItem('weekJustReset', 'completed');
      prevPackForRegen = _loadActivePack();
      didReset = true;
      if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
    }
  }

  // Ensure an active pack exists for the current cycle. Backfills mid-cycle
  // for users upgrading from the pre-pack version (their pauseChallenge
  // indices stay; content just changes — clean by next reset).
  let pack = _loadActivePack();
  if(!pack || isFirstLoad || didReset){
    pack = _generateChallengePack(prevPackForRegen);
    _saveActivePack(pack);
  }

  // Read ticks early so the score-change branch below can decide whether
  // to silently regen (zero ticks) or surface a banner (mid-challenge).
  const completed = _readChallengeTicks();

  // SCORES-CHANGED HANDLING — fixes the legacy "Day 1 stuck on cyberchondria
  // after re-assessment" bug. If the user has retaken any assessment since
  // the pack was generated AND no day has been ticked yet, regenerate
  // silently so the cards reflect their current ranking. If they have
  // ticks already, leave the pack alone but flag a banner so renderChallenge
  // surfaces a reset CTA — wiping ticks behind a user's back is worse UX.
  let scoresChangedBanner = false;
  const _curHash = _currentScoresHash();
  if(pack && pack.scoresHash && pack.scoresHash !== _curHash){
    if(completed.length === 0){
      pack = _generateChallengePack(pack);
      _saveActivePack(pack);
    } else {
      scoresChangedBanner = true;
    }
  }
  const today = getLocalDateStr();
  // CHALLENGE-DAY-LOCK (sequential): the only tickable card is the next
  // sequential index, AND only if at least one local calendar day has
  // passed since the previous tick. Day 1 (idx 0) is always available
  // when no ticks exist yet. Anything else is future-locked.
  const _nextIdx   = completed.length;
  const _prevDay   = _nextIdx > 0 ? completed[_nextIdx - 1].day : null;
  const _dayPassed = _prevDay !== today;
  const tickableIdx = (_nextIdx < 7 && (_nextIdx === 0 || _dayPassed)) ? _nextIdx : -1;
  const weekNum = localStorage.getItem('currentWeekNum') || '1';
  const weekJustReset = localStorage.getItem('weekJustReset');

  // Update streak display
  const streakEl = document.getElementById('challengeStreakNum');
  const progressBar = document.getElementById('challengeProgressBar');
  const weekLabel = document.getElementById('challengeWeekLabel');
  if(streakEl) streakEl.textContent = completed.length;
  if(progressBar) progressBar.style.width = (completed.length/7*100)+'%';
  if(weekLabel) weekLabel.textContent = `Week ${weekNum}`;

  // Track max streak for badges
  const maxStreak = parseInt(localStorage.getItem('maxChallengeStreak')||'0');
  if(completed.length > maxStreak){
    // BUG-025 FIX: write as string for consistency with all other localStorage
    // sets in this file. localStorage coerces numbers to strings anyway, but
    // mixing styles invites future code that does typeof / strict-equal checks.
    localStorage.setItem('maxChallengeStreak', completed.length.toString());
    if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
  }

  const el = document.getElementById('challengeList');
  if(!el) return;

  // Show reset notification banner if week just changed
  let resetBanner = '';
  if(weekJustReset === 'completed'){
    resetBanner = `<div class="notice green" style="margin-bottom:8px;text-align:center">
      <div class="notice-title">🏆 Last week complete!</div>
      You finished all 7 challenges. Week ${weekNum} has started.
    </div>`;
  }
  // BUG-003 FIX: 'expired' branch removed — we no longer reset on incomplete
  // weeks, so there's nothing to apologise for. Clear any stale value left
  // over from older app versions so it doesn't loiter in localStorage.
  if(weekJustReset) localStorage.removeItem('weekJustReset');

  const days = (pack && Array.isArray(pack.days)) ? pack.days : [];

  // Renders a single day card. Handles three pack shapes via field
  // presence (no version branch): legacy disorder days have only
  // `disorderName`; V2 disorder/impact days have `dayLabel`, `whyMatters`,
  // and `todoTask`; wildcard days have neither and show "✨ Bonus".
  // CHALLENGE-DAY-LOCK: `isLocked` dims un-ticked cards once today's tick
  // is used. Locked cards still receive clicks (no pointer-events:none) so
  // toggleChallenge can fire the "one per day" toast.
  function _dayCardHtml(c, i, isCompleted, clickable, isLocked){
    const onClick = clickable ? `onclick="toggleChallenge(${i})"` : '';
    const lockStyle = isLocked ? 'opacity:0.5;cursor:not-allowed' : '';
    const cardColor = c.color || 'var(--accent)';

    // V2 title strip: "Day N: <plain-English label>"
    const titleStrip = c.dayLabel
      ? `<div style="font-size:13px;font-weight:800;color:${cardColor};margin-bottom:6px">Day ${i+1}: ${c.dayLabel}</div>`
      : '';

    // V2 why-matters line (band reference). Only renders when present —
    // generic packs and wildcard days skip it.
    const whyHtml = c.whyMatters
      ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;font-style:italic">${c.whyMatters}</div>`
      : '';

    // V2 todo task block. Subtle colored panel with the day's micro-task.
    const taskHtml = c.todoTask
      ? `<div style="font-size:12px;color:var(--text);margin-top:8px;padding:8px 10px;background:${cardColor}1A;border-radius:8px;border-left:3px solid ${cardColor};line-height:1.45">📝 ${c.todoTask}</div>`
      : '';

    // Legacy/wildcard tag — only render when V2 titleStrip is absent
    // so we don't double up.
    const labelHtml = (!c.dayLabel)
      ? (c.kind === 'wildcard'
          ? `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);margin-bottom:3px">✨ Bonus</div>`
          : `<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${c.color || 'var(--muted)'};margin-bottom:3px">${c.disorderName || ''}</div>`)
      : '';

    return `<div class="challenge-day ${isCompleted?'completed':''}" style="${lockStyle}" ${onClick}>
      <div class="challenge-check ${isCompleted?'done':''}">${isCompleted?'✓':c.icon}</div>
      <div style="flex:1">
        ${titleStrip}
        ${labelHtml}
        <div class="challenge-text">${c.text}</div>
        ${taskHtml}
        ${whyHtml}
        ${isCompleted?'<div style="font-size:10px;color:var(--teal);margin-top:6px;font-weight:700">Completed ✓</div>':''}
      </div>
      <div class="challenge-day-label">Day ${i+1}</div>
    </div>`;
  }

  // PERSONALIZATION CTA — shown when the active pack is the generic
  // fallback. Appears at the top of the tab and links the user to the
  // Quick Scan / Full Assessment flow so the next regen personalizes.
  let personalizationCta = '';
  const _isGenericPack = !pack || !pack.metaVersion || pack.metaVersion < 2;
  if(_isGenericPack){
    personalizationCta = `<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg, rgba(61,111,255,0.08), rgba(124,92,191,0.08));border:1px solid rgba(61,111,255,0.2)">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="font-size:22px;flex-shrink:0">✨</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:4px">Personalize your 7-day plan</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:8px">Take the Full Assessment so each day targets your most pressing concerns first.</div>
          <button onclick="showScreen('screen-assess-menu')" style="background:var(--accent);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Take Assessment →</button>
        </div>
      </div>
    </div>`;
  }

  // SCORES-CHANGED BANNER — surfaced when the user re-took an assessment
  // mid-challenge. We don't auto-regen because that would wipe their day
  // ticks; the user gets to choose via the reset button below.
  let scoresChangedHtml = '';
  if(scoresChangedBanner){
    scoresChangedHtml = `<div class="notice blue" style="margin-bottom:8px">
      <div class="notice-title">📊 Your assessment has updated</div>
      <div style="font-size:12px;line-height:1.5;margin-top:4px">Your current 7-day plan is based on earlier scores. Tap "Start a new 7-day challenge" below to re-personalize with your latest results.</div>
    </div>`;
  }

  // BOTTOM RESET LINK — small, modest. Lets the user start a fresh week
  // at any time (manual override of the auto-reset that fires at week
  // completion). Confirm modal prevents accidental taps.
  const resetLinkHtml = `<div style="text-align:center;margin-top:14px;padding:8px 0">
    <button onclick="confirmResetChallenge()" style="background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;cursor:pointer;padding:6px 12px">Start a new 7-day challenge</button>
  </div>`;

  // Show completion state
  if(completed.length === 7){
    el.innerHTML = personalizationCta + scoresChangedHtml + resetBanner +
      `<div class="notice green" style="text-align:center;padding:20px">
      <div style="font-size:36px;margin-bottom:8px">🏆</div>
      <div class="notice-title">Week ${weekNum} Complete!</div>
      You've finished all 7 challenges. A new challenge week will start automatically in 7 days.
    </div>` +
    days.map((c,i) => _dayCardHtml(c, i, true, false, false)).join('') +
    resetLinkHtml;
    return;
  }

  // Show active challenge list. Sequential gate: at most ONE tickable
  // card at any moment (`tickableIdx`). Already-ticked cards stay
  // clickable (so toggleChallenge can decide whether to un-tick or fire
  // the "un-tick most recent first" toast). All other cards are locked.
  el.innerHTML = personalizationCta + scoresChangedHtml + resetBanner +
    days.map((c,i) => {
      const isCompleted = completed.some(t => t.idx === i);
      const isLocked = !isCompleted && i !== tickableIdx;
      return _dayCardHtml(c, i, isCompleted, true, isLocked);
    }).join('') +
    resetLinkHtml;
}

function toggleChallenge(idx){
  const completed = _readChallengeTicks();
  const today = getLocalDateStr();
  const pos = completed.findIndex(t => t.idx === idx);

  if(pos === -1){
    // Trying to tick. Sequential gate: only the next-index card is
    // tickable, AND only if at least one local calendar day has passed
    // since the previous tick. Day 1 (idx 0) is always available when
    // no ticks exist yet.
    const nextIdx   = completed.length;
    const prevDay   = nextIdx > 0 ? completed[nextIdx - 1].day : null;
    const dayPassed = prevDay !== today;
    const isTickable = (idx === nextIdx) && (nextIdx === 0 || dayPassed);
    if(!isTickable){
      // Future-locked tap. Per spec: generic "Comes back tomorrow" when
      // N=0 (Day 1 not yet ticked); otherwise name the next sequential
      // day that the user is waiting on.
      const msg = nextIdx === 0
        ? 'Comes back tomorrow'
        : `Day ${nextIdx + 1} unlocks tomorrow after midnight`;
      showToast(msg, 1500);
      return;
    }
    completed.push({ idx, day: today });
  } else {
    // Trying to un-tick. Sequential gate: only the most-recent tick can
    // be removed (un-ticking an earlier day would leave a non-contiguous
    // gap that breaks the sequential model).
    if(pos !== completed.length - 1){
      showToast('Un-tick the most recent day first.', 1500);
      return;
    }
    completed.splice(pos, 1);
  }
  localStorage.setItem('pauseChallenge', JSON.stringify(completed));
  if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
  renderChallenge();
  checkAndAwardBadges();
}

// Manual reset entry point (top-level so inline onclick handlers can
// reach it through the global window scope, matching toggleChallenge).
function confirmResetChallenge(){
  // Inline confirm modal — avoids depending on whatever modal infra
  // happens to exist elsewhere in the app. Renders into <body> as a
  // fixed overlay, removes itself on dismiss.
  const overlay = document.createElement('div');
  overlay.id = '_resetChallengeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--bg, #fff);max-width:340px;width:100%;border-radius:14px;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.2)">
      <div style="font-size:16px;font-weight:800;margin-bottom:8px;color:var(--text)">Start a new 7-day challenge?</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px">This resets your current week's progress and generates a fresh personalized plan based on your latest assessment.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button onclick="document.getElementById('_resetChallengeOverlay').remove()" style="background:transparent;border:1px solid var(--muted);color:var(--text);padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button onclick="_doResetChallenge()" style="background:var(--accent);border:none;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Reset</button>
      </div>
    </div>`;
  // Close on background tap
  overlay.addEventListener('click', e => {
    if(e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function _doResetChallenge(){
  // Clear ticks, reset week-start to now, regenerate pack from current
  // scores. Preserves currentWeekNum and challengeWeeksCompleted —
  // resetting mid-week shouldn't fabricate a "completion" that wasn't
  // earned.
  localStorage.setItem('pauseChallenge','[]');
  localStorage.setItem('challengeWeekStart', Date.now().toString());
  const prev = _loadActivePack();
  const fresh = _generateChallengePack(prev);
  _saveActivePack(fresh);
  if(typeof saveChallengeStateToSupabase === 'function') saveChallengeStateToSupabase();
  const modal = document.getElementById('_resetChallengeOverlay');
  if(modal) modal.remove();
  renderChallenge();
  if(typeof showToast === 'function') showToast('Fresh 7-day challenge started', 1500);
}

// ============================================================
// FEATURE6: Severity trajectory badge rendering
// ============================================================
function renderTrajectoryBadges(){
  // BUG6 FIX: both elements coexist in DOM (results + progress screen)
  // getElementById('trajectoryBadgesRow') always finds results element first, so populate BOTH explicitly
  const els = [
    document.getElementById('trajectoryBadgesRow'),
    document.getElementById('trajectoryBadgesRowProgress')
  ].filter(Boolean);
  if(!els.length) return;
  const badges=safeJsonParse('pause_trajectory_badges', []);
  if(!badges.length){ els.forEach(el=>el.innerHTML=''); return; }
  const _html=`<div class="section-label" style="margin-top:4px">🌟 Improvement Milestones</div>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:8px;padding:14px">
    ${badges.slice(0,5).map((b,i)=>{
      const date=new Date(b.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'});
      return `<div style="display:flex;align-items:center;gap:6px;background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:20px;padding:5px 12px">
        <span style="font-size:14px">📈</span>
        <div><div style="font-size:11px;font-weight:700;color:#2ecc71">Severity Improved</div>
        <div style="font-size:10px;color:var(--muted)">${date}${b.dws?' · DWS '+b.dws:''}</div></div>
      </div>`;
    }).join('')}
    </div>`;
  els.forEach(el => el.innerHTML = _html); // BUG6 FIX: both screens get updated
}

// ============================================================
// FEATURE7: Digital Detox Day Planner
// ============================================================
const DETOX_PLAN = [
  {time:'7:00 AM',icon:'🌅',title:'Morning Grounding',desc:'Before touching your phone, do the 5-4-3-2-1 grounding exercise. Notice 5 things you can see, 4 you can touch, 3 you can hear.',action:'groundingExercise'},
  {time:'9:00 AM',icon:'📵',title:'Phone-Free Work Block',desc:'Put your phone in another room for 2 hours. Work or study on one task without digital interruptions.',action:null},
  {time:'12:00 PM',icon:'🍽️',title:'Screen-Free Meal',desc:'Have lunch without any screen — no phone, TV, or laptop. Notice the food, the flavours, the room around you.',action:null},
  {time:'2:00 PM',icon:'🚶',title:'Outdoor Walk',desc:'A 20-minute walk outside without your phone. Leave it at home or on silent in your bag.',action:null},
  {time:'4:00 PM',icon:'🌊',title:'Urge Surfing Practice',desc:'When you feel the urge to check your phone, practice urge surfing — observe it, rate it, breathe through it.',action:'surfingExercise'},
  {time:'7:00 PM',icon:'👥',title:'Real Connection',desc:'Have a conversation with someone in person — a family member, friend, or neighbour — for at least 20 minutes.',action:null},
  {time:'9:00 PM',icon:'📴',title:'Digital Sunset',desc:'All screens off by 9pm. Charge your phone outside the bedroom. Read a physical book or journal instead.',action:null},
  {time:'10:00 PM',icon:'💨',title:'4-7-8 Breathing',desc:'Before sleep, do 4 cycles of 4-7-8 breathing to calm your nervous system and prepare for deep sleep.',action:'breathingExercise'}
];


// BUG19 FIX: local timezone date helper — avoids UTC midnight reset issue
function getLocalDateStr(){ return new Date().toLocaleDateString('en-CA'); } // en-CA gives YYYY-MM-DD

function renderDetoxPlanner(){
  const el=document.getElementById('detoxPlannerContent');
  if(!el) return;
  // BUG17 FIX: use stored date so midnight crossing doesn't reset progress
  const storedDate=localStorage.getItem('pause_detox_active_date')||getLocalDateStr(); // BUG19 FIX
  const today=new Date(storedDate).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  const completed=safeJsonParse('pause_detox_completed_'+storedDate, []);

  el.innerHTML=`
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:13px;color:var(--muted)">📅 ${today}</div>
      <div style="font-size:12px;color:var(--accent);font-weight:700;margin-top:4px">${completed.length} of ${DETOX_PLAN.length} steps completed</div>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:8px">
        <div style="height:100%;background:#2ecc71;width:${Math.round((completed.length/DETOX_PLAN.length)*100)}%;transition:width 0.4s ease"></div>
      </div>
    </div>
    ${DETOX_PLAN.map((step,i)=>{
      const done=completed.includes(i);
      // BUG13 FIX: render action link for steps that have one
      const actionMap={groundingExercise:'5-4-3-2-1 Grounding',surfingExercise:'Urge Surfing',breathingExercise:'4-7-8 Breathing'};
      const actionLabel=step.action?actionMap[step.action]||null:null;
      return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);opacity:${done?'0.7':'1'}">
        <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="font-size:20px">${done?'✅':step.icon}</div>
          <div style="font-size:9px;color:var(--muted);font-weight:700">${step.time}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${step.title}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">${step.desc}</div>
          ${actionLabel?`<div style="margin-top:6px"><span onclick="closeModal('detoxPlannerModal');showScreen('screen-tools')" style="font-size:11px;font-weight:700;color:var(--accent);cursor:pointer;text-decoration:underline">→ Open ${actionLabel} in Tools</span></div>`:''}
        </div>
        <button onclick="toggleDetoxStep(${i})" style="flex-shrink:0;padding:6px 12px;border-radius:8px;border:1px solid ${done?'#2ecc71':'var(--border)'};background:${done?'rgba(46,204,113,0.1)':'none'};color:${done?'#2ecc71':'var(--muted)'};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;align-self:flex-start;margin-top:4px">${done?'Done ✓':'Mark Done'}</button>
      </div>`;
    }).join('')}`;
}

function toggleDetoxStep(idx){
  // BUG17 FIX: use stored active date
  const key='pause_detox_completed_'+(localStorage.getItem('pause_detox_active_date')||getLocalDateStr()); // BUG19 FIX
  const completed=safeJsonParse(key, []);
  const pos=completed.indexOf(idx);
  if(pos===-1) completed.push(idx); else completed.splice(pos,1);
  localStorage.setItem(key,JSON.stringify(completed));
  renderDetoxPlanner();
  if(completed.length===DETOX_PLAN.length) showToast('🎉 You completed your Digital Detox Day!');
}

function openDetoxPlanner(){
  // BUG17 FIX: stamp active date when user opens planner (not at midnight)
  if(!localStorage.getItem('pause_detox_active_date')){
    localStorage.setItem('pause_detox_active_date', getLocalDateStr()); // BUG19 FIX
  } else {
    // Reset if stored date is from a previous day
    const stored=localStorage.getItem('pause_detox_active_date');
    if(stored!==getLocalDateStr()){ // BUG19 FIX
      localStorage.removeItem('pause_detox_active_date');
      localStorage.setItem('pause_detox_active_date', getLocalDateStr()); // BUG19 FIX
    }
  }
  renderDetoxPlanner();
  openModal('detoxPlannerModal');
}

// ============================================================
// FEATURE2: Weekly check-in — step-based flow
// ============================================================
const PAUSE_WEEKLY_CHECKIN_KEY='pause_weekly_checkin'; // BUG9 FIX: prefixed to avoid weekly.js conflict
const PAUSE_WEEKLY_QUESTIONS=[ // BUG9 FIX
  {id:'q1',text:'Did you manage to reduce your most problematic digital habit this week?',opts:['Yes, significantly','Yes, somewhat','No change','It got worse']},
  {id:'q2',text:'How many times did you use the wellness exercises in PAUSE App?',opts:['5 or more times','2–4 times','Once','Not at all']},
  {id:'q3',text:'How would you rate your overall digital wellbeing this week compared to last week?',opts:['Much better','A little better','About the same','A little worse','Much worse']}
];

let _wcStep = 0;
let _wcAnswers = {};

function checkWeeklyCheckin(){
  const last=localStorage.getItem(PAUSE_WEEKLY_CHECKIN_KEY);
  if(!last){
    localStorage.setItem(PAUSE_WEEKLY_CHECKIN_KEY, JSON.stringify({lastShown:new Date().toISOString(),responses:[]}));
    return;
  }
  try{
    const data=JSON.parse(last);
    const daysSince=Math.floor((Date.now()-new Date(data.lastShown).getTime())/86400000);
    if(daysSince>=7) setTimeout(()=>{
      if(typeof currentScreen!=='undefined'&&currentScreen!=='screen-home') return;
      const rcModal=document.getElementById('reConsentModal');
      if(rcModal&&rcModal.classList.contains('open')) return;
      renderWeeklyCheckinModal();
    },3000);
  }catch(e){}
}

function renderWeeklyCheckinModal(){
  _wcStep = 0;
  _wcAnswers = {};
  openModal('weeklyCheckinModal');
  _wcRenderStep();
}

function _wcRenderStep(){
  const total = PAUSE_WEEKLY_QUESTIONS.length;
  const q = PAUSE_WEEKLY_QUESTIONS[_wcStep];

  // Progress bar width: show how far through we are
  const pct = Math.round(((_wcStep) / total) * 100) + Math.round((1 / total) * 50);
  const bar = document.getElementById('weeklyProgressBar');
  if(bar) bar.style.width = Math.min(pct, 95) + '%';

  // Step label
  const lbl = document.getElementById('weeklyStepLabel');
  if(lbl) lbl.textContent = `Question ${_wcStep + 1} of ${total}`;

  // Back button — hide on first step
  const backBtn = document.getElementById('weeklyBackBtn');
  if(backBtn) backBtn.style.visibility = _wcStep === 0 ? 'hidden' : 'visible';

  // Next/Submit button label
  const nextBtn = document.getElementById('weeklyNextBtn');
  if(nextBtn) nextBtn.textContent = _wcStep === total - 1 ? 'Submit Check-In ✓' : 'Next →';

  // Render question + options
  const area = document.getElementById('weeklyQuestionArea');
  if(!area) return;
  const saved = _wcAnswers[q.id];
  area.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:18px;line-height:1.65">${q.text}</div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${q.opts.map(opt => `
        <button class="wcheckin-opt${saved === opt ? ' selected' : ''}"
          data-value="${opt}"
          onclick="_wcSelect(this,'${q.id}')">${opt}</button>
      `).join('')}
    </div>`;
}

function _wcSelect(btn, qId){
  btn.closest('div').querySelectorAll('.wcheckin-opt').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _wcAnswers[qId] = btn.dataset.value;
}

function weeklyCheckinNext(){
  const q = PAUSE_WEEKLY_QUESTIONS[_wcStep];
  if(!_wcAnswers[q.id]){
    showToast('Please select an answer to continue.');
    return;
  }
  if(_wcStep < PAUSE_WEEKLY_QUESTIONS.length - 1){
    _wcStep++;
    _wcRenderStep();
  } else {
    submitWeeklyCheckin();
  }
}

function weeklyCheckinBack(){
  if(_wcStep > 0){
    _wcStep--;
    _wcRenderStep();
  } else {
    closeModal('weeklyCheckinModal');
  }
}

function submitWeeklyCheckin(){
  // Ensure all questions answered (safety net)
  let allAnswered = true;
  PAUSE_WEEKLY_QUESTIONS.forEach(q => { if(!_wcAnswers[q.id]) allAnswered = false; });
  if(!allAnswered){ showToast('Please answer all questions.'); return; }

  const data = { lastShown: new Date().toISOString(), responses: _wcAnswers };
  localStorage.setItem(PAUSE_WEEKLY_CHECKIN_KEY, JSON.stringify(data));

  // Complete progress bar before closing
  const bar = document.getElementById('weeklyProgressBar');
  if(bar) bar.style.width = '100%';

  if(currentUser){
    sb.from('WeeklyCheckin').insert({
      user_id: currentUser.id,
      ..._wcAnswers,
      checked_at: data.lastShown
    }).then(()=>{}).catch(()=>{});
  }
  setTimeout(() => {
    closeModal('weeklyCheckinModal');
    showToast('✅ Weekly check-in saved — keep it up!');
  }, 300);
}
