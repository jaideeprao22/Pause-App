// ============================================================
// INIT
// ============================================================
function init(){
  renderHomeDisorders();
  renderAssessMenu();
  renderQuickScan();
  renderAboutScales();
  renderProgress();
  renderChallenge();
  renderBadges();
  loadSavedScores();
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

function saveScores(){
  localStorage.setItem('pauseV2Scores', JSON.stringify({disorder:disorderScores, impact:impactScores, dws:dwsScore}));
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  history.unshift({dws:dwsScore, disorder:{...disorderScores}, impact:{...impactScores}, date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})});
  if(history.length > 20) history.splice(20);
  localStorage.setItem('pauseV2History', JSON.stringify(history));

  // FIX 3: Persist disorder grades using AppGrades so they survive app restarts
  if(window.AppGrades){
    const grades = {};
    DISORDERS.forEach(d => {
      if(disorderScores[d.id] !== undefined){
        const level = getLevel(d, disorderScores[d.id]);
        grades[d.id] = level.label.toLowerCase(); // 'minimal','mild','moderate','severe'
      }
    });
    window.AppGrades.save(grades);
  }

  saveToSupabase();
}

// ============================================================
// RENDER HOME
// ============================================================
function renderHomeDisorders(){
  const el = document.getElementById('home-disorder-list');
  el.innerHTML = DISORDERS.map((d,i) => {
    const score = disorderScores[d.id];
    const level = score !== undefined ? getLevel(d, score) : null;
    return `<div class="disorder-card" onclick="startSingleAssessment(${i})">
      <div class="disorder-icon" style="background:${d.bg}">${d.icon}</div>
      <div class="disorder-info">
        <div class="disorder-name">${d.name}</div>
        <div class="disorder-meta">${d.scale} · ${d.items} questions</div>
      </div>
      <div class="disorder-score">
        ${level ? `<div class="disorder-badge" style="background:${level.bg};color:${level.color}">${level.label}</div>` : '<div style="font-size:11px;color:var(--muted)">Tap to screen</div>'}
      </div>
    </div>`;
  }).join('');
}

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
