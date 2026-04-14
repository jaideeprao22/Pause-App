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
    impactScores = saved.impact || {};
    dwsScore = saved.dws || null;
    updateDWSDisplay();
  }
}

function saveScores(){
  localStorage.setItem('pauseV2Scores', JSON.stringify({disorder:disorderScores, impact:impactScores, dws:dwsScore}));
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  history.unshift({dws:dwsScore, disorder:{...disorderScores}, impact:{...impactScores}, date:new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})});
  if(history.length > 20) history.splice(20);
  localStorage.setItem('pauseV2History', JSON.stringify(history));
  saveToSupabase();
}

// ============================================================
// RENDER HOME
// ============================================================
function renderHomeDisorders(){
  const el = document.getElementById('home-disorder-list');
  el.innerHTML = DISORDERS.map((d,i) => {
    const score = disorderScores[d.id];
    const level = score ? getLevel(d, score) : null;
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

function renderAssessMenu(){
  document.getElementById('assess-menu-list').innerHTML = DISORDERS.map(d => `
    <div class="disorder-card" style="cursor:default">
      <div class="disorder-icon" style="background:${d.bg}">${d.icon}</div>
      <div class="disorder-info"><div class="disorder-name">${d.name}</div><div class="disorder-meta">${d.scale} · ${d.items} questions</div></div>
    </div>`).join('');
  document.getElementById('assess-impact-list').innerHTML = IMPACT_MODULES.map(m => `
    <div class="disorder-card" style="cursor:default">
      <div class="disorder-icon" style="background:rgba(0,0,0,0.05)">${m.icon}</div>
      <div class="disorder-info"><div class="disorder-name">${m.name} Impact</div><div class="disorder-meta">5 questions</div></div>
    </div>`).join('');
}

function renderQuickScan(){
  document.getElementById('quick-impact-list').innerHTML = IMPACT_MODULES.map(m => `
    <div class="disorder-card" style="cursor:default">
      <div class="disorder-icon" style="background:rgba(0,0,0,0.05)">${m.icon}</div>
      <div class="disorder-info"><div class="disorder-name">${m.name} Impact</div><div class="disorder-meta">5 questions</div></div>
    </div>`).join('');
}

function renderAboutScales(){
  document.getElementById('aboutScaleList').innerHTML =
    DISORDERS.map(d => `<div style="margin-bottom:8px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:var(--text)">${d.icon} ${d.name}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">${d.scaleRef}</div></div>`).join('') +
    IMPACT_MODULES.map(m => `<div style="margin-bottom:8px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="font-size:12px;font-weight:700;color:var(--text)">${m.icon} ${m.name} Impact Module</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Custom validated-style module · 5 items · Likert scale</div></div>`).join('');
}