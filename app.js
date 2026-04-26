// ============================================================
// INIT
// ============================================================
function init(){
  // NM1 FIX: load saved scores FIRST so disorder cards render with correct data immediately
  loadSavedScores();
  renderHomeDisorders();
  renderAssessMenu();
  renderQuickScan();
  renderAboutScales();
  renderProgress();
  renderChallenge();
  renderBadges();
  renderLoginBanner();
  renderAccountSection();
  renderMoodCheck();
  checkFirstTimeUser();
  initAuth();
  initNotifications();
  scheduleMotivationNotification();
  renderMotivationCard();
  renderWeeklyReport();
  checkReassessmentReminder();
}

function loadSavedScores(){
  const saved = JSON.parse(localStorage.getItem('pauseV2Scores') || 'null');
  if(saved){
    disorderScores = saved.disorder || {};
    impactScores   = saved.impact  || {};
    dwsScore       = saved.dws     || null;
    updateDWSDisplay();
    // FIX 3: Also refresh home disorder badges from saved scores on every app open
    renderHomeDisorders();
  }
}

// BUG3 FIX: Split into two functions.
// saveScoresLocal() — localStorage + AppGrades only. Safe to call on every answer (partial progress).
// saveScores()      — also adds a history entry + syncs to Supabase. Called ONLY when assessment is fully complete.
function saveScoresLocal(){
  localStorage.setItem('pauseV2Scores', JSON.stringify({disorder:disorderScores, impact:impactScores, dws:dwsScore}));
  if(window.AppGrades){
    const grades = {};
    DISORDERS.forEach(d => {
      if(disorderScores[d.id] !== undefined){
        const level = getLevel(d, disorderScores[d.id]);
        grades[d.id] = level.label.toLowerCase();
      }
    });
    window.AppGrades.save(grades);
  }
}

function saveScores(){
  saveScoresLocal();
  // History entry + Supabase sync — only runs when a full assessment is finished
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  history.unshift({dws:dwsScore, disorder:{...disorderScores}, impact:{...impactScores}, date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})});
  if(history.length > 20) history.splice(20);
  localStorage.setItem('pauseV2History', JSON.stringify(history));
  saveToSupabase();
}

// ============================================================
// RENDER HOME
// NC1 FIX: renderHomeDisorders() is defined ONLY in assessment.js.
// The version that was here used startSingleAssessment (no partial-check guard),
// old .disorder-card CSS, and no staleness labels. Since app.js loads after
// assessment.js, the old version here was silently overwriting the correct one.
// Removed — all calls below now use the assessment.js implementation.
// ============================================================

// ============================================================
// FIX 4: ASSESS MENU — clickable cards with disorder info
// ============================================================
function renderAssessMenu(){
  // Disorders: clickable → opens scale info modal
  document.getElementById('assess-menu-list').innerHTML = DISORDERS.map((d,i) => {
    const score = disorderScores[d.id];
    const level = score !== undefined ? getLevel(d, score) : null;
    return `<div class="assess-disorder-card" onclick="showScaleInfo('${d.id}', ${i})">
      <div class="assess-card-icon" style="background:${d.bg}">${d.icon}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700;color:var(--text)">${d.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${d.scale} · ${d.items} questions</div>
        ${level ? `<div style="margin-top:5px"><span style="background:${level.bg};color:${level.color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">${level.label}</span></div>` : ''}
      </div>
      <div class="assess-card-chevron">›</div>
    </div>`;
  }).join('');

  // Impact modules: clickable → opens impact info
  document.getElementById('assess-impact-list').innerHTML = IMPACT_MODULES.map((m,i) => `
    <div class="assess-impact-card" onclick="showImpactInfo('${m.id}', ${i})">
      <div style="font-size:22px;flex-shrink:0">${m.icon}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${m.name} Impact</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">5 questions · Likert scale</div>
      </div>
      <div class="assess-card-chevron">›</div>
    </div>`).join('');
}

// FIX 4: Show disorder scale info in the existing explainModal (reused)
function showScaleInfo(disorderId, idx){
  const d = DISORDERS.find(x => x.id === disorderId);
  if(!d){ if(idx !== undefined) startSingleAssessment(idx); return; }

  // Plain-language definitions for each disorder
  const definitions = {
    cyberchondria:  'Cyberchondria is the compulsive habit of repeatedly searching for health information online in a way that escalates — rather than relieves — health anxiety. Instead of reassurance, each search triggers more worry and more searching, creating a distressing cycle.',
    socialmedia:    'Social Media Addiction is a pattern of compulsive social media use characterised by loss of control, preoccupation with platforms, and continued use despite negative effects on mood, relationships, or daily responsibilities.',
    shortform:      'Short-Form Video Addiction refers to the inability to control consumption of brief video content (Reels, Shorts, TikTok) leading to significant time loss, disrupted sleep, reduced attention span, and interference with everyday tasks.',
    gaming:         'Gaming Disorder is characterised by impaired control over gaming, increasing priority given to gaming over other activities, and continuation of gaming despite negative consequences — persisting over a significant period.',
    ai:             'AI Dependency is excessive reliance on artificial intelligence tools (chatbots, writing assistants) that weakens independent thinking, problem-solving, and decision-making, to the point where functioning without AI causes anxiety or impairment.',
    workaddiction:  'Digital Work Addiction is compulsive overworking driven by constant digital connectivity — checking emails after hours, being unable to mentally disconnect from work — that erodes personal relationships, leisure, and physical health.'
  };

  const score = disorderScores[d.id];
  const level = score !== undefined ? getLevel(d, score) : null;
  const scoreHtml = level
    ? `<div style="background:${level.bg};border-radius:10px;padding:10px 14px;margin:12px 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:var(--text)">Your last result</span>
        <span style="font-weight:700;color:${level.color}">${level.label} (${score}/${d.maxScore})</span>
       </div>`
    : `<div style="font-size:12px;color:var(--muted);margin:10px 0;font-style:italic">You haven't screened for this yet.</div>`;

  document.getElementById('explainTitle').innerHTML = `${d.icon} ${d.name}`;
  document.getElementById('explainBody').innerHTML = `
    ${definitions[d.id] ? `<div style="background:var(--bg);border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:13px;line-height:1.7;color:var(--text);border-left:3px solid ${d.color || 'var(--accent)'}">${definitions[d.id]}</div>` : ''}
    <p style="margin-bottom:10px">${d.scaleRef}</p>
    ${scoreHtml}
    <div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:4px">About this scale</div>
      <div style="font-size:12px;color:var(--text);line-height:1.6">${d.scale} · ${d.items} questions · Validated psychometric instrument</div>
    </div>
    <button class="btn-primary" style="margin-top:8px" onclick="closeModal('explainModal');startSingleAssessment(${idx});">
      ${score !== undefined ? '🔄 Re-screen for ' + d.name : '▶ Start ' + d.name + ' Assessment'}
    </button>`;
  openModal('explainModal');
}

// FIX 4: Impact module info
function showImpactInfo(moduleId, idx){
  const m = IMPACT_MODULES.find(x => x.id === moduleId);
  if(!m){ return; }
  const score = impactScores[m.id];
  const level = score !== undefined ? getImpactLevel(score) : null;
  const scoreHtml = level
    ? `<div style="background:${level.color}15;border-radius:10px;padding:10px 14px;margin:12px 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;color:var(--text)">Your last result</span>
        <span style="font-weight:700;color:${level.color}">${level.label}</span>
       </div>`
    : `<div style="font-size:12px;color:var(--muted);margin:10px 0;font-style:italic">You haven't completed this module yet.</div>`;

  document.getElementById('explainTitle').innerHTML = `${m.icon} ${m.name} Impact`;
  document.getElementById('explainBody').innerHTML = `
    <p style="margin-bottom:10px;font-size:13px;line-height:1.6">Assesses how digital device use is affecting your ${m.name.toLowerCase()} health. 5 questions on a 5-point Likert scale.</p>
    ${scoreHtml}
    <div style="font-size:12px;color:var(--muted);background:var(--bg);border-radius:10px;padding:10px 12px;line-height:1.6">Custom validated-style module developed for PAUSE App · GMC Maheshwaram</div>`;
  openModal('explainModal');
}

function renderQuickScan(){
  document.getElementById('quick-impact-list').innerHTML = IMPACT_MODULES.map((m,i) => `
    <div class="assess-impact-card" onclick="showImpactInfo('${m.id}', ${i})">
      <div style="font-size:22px;flex-shrink:0">${m.icon}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${m.name} Impact</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">5 questions</div>
      </div>
      <div class="assess-card-chevron">›</div>
    </div>`).join('');
}

function renderAboutScales(){
  document.getElementById('aboutScaleList').innerHTML =
    DISORDERS.map(d => `<div style="margin-bottom:8px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:var(--text)">${d.icon} ${d.name}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${d.scaleRef}</div></div>`).join('') +
    IMPACT_MODULES.map(m => `<div style="margin-bottom:8px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:var(--text)">${m.icon} ${m.name} Impact Module</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Custom validated-style module · 5 items · Likert scale</div></div>`).join('');
}

// Start app
init();
