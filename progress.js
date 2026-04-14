// ============================================================
// PROGRESS & CHALLENGE
// ============================================================
function renderMoodTrend(){
  const el = document.getElementById('moodTrendSection');
  if(!el) return;
  const moodLog = JSON.parse(localStorage.getItem('moodLog') || '[]').slice(0,14).reverse();
  if(!moodLog.length){ el.innerHTML='<div style="font-size:12px;color:var(--muted)">Log your mood daily to see trends here.</div>'; return; }
  const MOODS = [{value:5,emoji:'😊',color:'#2ecc71'},{value:4,emoji:'🙂',color:'#00c9a7'},{value:3,emoji:'😐',color:'#f5a623'},{value:2,emoji:'😔',color:'#ff6b35'},{value:1,emoji:'😰',color:'#ff4757'}];
  el.innerHTML = `<div style="display:flex;align-items:flex-end;gap:4px;height:60px">
    ${moodLog.map(m => {
      const mood = MOODS.find(x => x.value === m.value);
      const pct = (m.value/5)*100;
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;background:${mood?.color||'var(--border)'};border-radius:3px 3px 0 0;height:${pct}%"></div>
        <div style="font-size:10px">${mood?.emoji||'😐'}</div>
      </div>`;
    }).join('')}
  </div><div style="font-size:10px;color:var(--muted);text-align:center;margin-top:4px">Mood last 14 days</div>`;
}

function renderProgress(){
  renderMoodTrend();
  const history = JSON.parse(localStorage.getItem('pauseV2History')||'[]');

  // Trend graph
  const trendBars = document.getElementById('trendBars');
  if(trendBars){
    const recent = history.filter(h=>h.dws).slice(0,7).reverse();
    if(recent.length===0){
      trendBars.innerHTML='<div style="font-size:12px;color:var(--muted);width:100%;text-align:center">No data yet</div>';
    } else {
      const maxDWS = Math.max(...recent.map(h=>h.dws));
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
  if(!history.length){
    el.innerHTML='<div class="notice blue"><div class="notice-title">No history yet</div>Complete your first assessment to start tracking progress.</div>';
    return;
  }
  el.innerHTML = history.map(h => {
    const s=h.dws?getDWSStatus(h.dws):null;
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

function renderChallenge(){
  // Check if we need to reset for new week
  const weekStart = localStorage.getItem('challengeWeekStart');
  const now = Date.now();
  if(!weekStart || now - parseInt(weekStart) > 7*24*60*60*1000){
    const completed = JSON.parse(localStorage.getItem('pauseChallenge')||'[]');
    if(completed.length === 7){
      const weeks = parseInt(localStorage.getItem('challengeWeeksCompleted')||'0');
      localStorage.setItem('challengeWeeksCompleted', weeks+1);
    }
    localStorage.setItem('pauseChallenge','[]');
    localStorage.setItem('challengeWeekStart', now.toString());
    const weekNum = parseInt(localStorage.getItem('challengeWeeksCompleted')||'0') + 1;
    localStorage.setItem('currentWeekNum', weekNum);
  }

  const completed = JSON.parse(localStorage.getItem('pauseChallenge')||'[]');
  const weekNum = localStorage.getItem('currentWeekNum')||'1';

  // Update streak display
  const streakEl = document.getElementById('challengeStreakNum');
  const progressBar = document.getElementById('challengeProgressBar');
  const weekLabel = document.getElementById('challengeWeekLabel');
  if(streakEl) streakEl.textContent = completed.length;
  if(progressBar) progressBar.style.width = (completed.length/7*100)+'%';
  if(weekLabel) weekLabel.textContent = `Week ${weekNum}`;

  // Track max streak
  const maxStreak = parseInt(localStorage.getItem('maxChallengeStreak')||'0');
  if(completed.length > maxStreak) localStorage.setItem('maxChallengeStreak', completed.length);

  const el = document.getElementById('challengeList');
  if(completed.length===7){
    el.innerHTML = `<div class="notice green" style="text-align:center;padding:20px"><div style="font-size:36px;margin-bottom:8px">🏆</div><div class="notice-title">Week ${weekNum} Complete!</div>You've finished all 7 challenges this week. A new challenge week will start automatically.</div>`;
    el.innerHTML += CHALLENGES.map((c,i) => `
      <div class="challenge-day completed">
        <div class="challenge-check done">✓</div>
        <div><div style="font-size:16px">${c.icon}</div><div class="challenge-text">${c.text}</div></div>
        <div class="challenge-day-label">Day ${i+1}</div>
      </div>`).join('');
    return;
  }

  el.innerHTML = CHALLENGES.map((c,i) => `
    <div class="challenge-day ${completed.includes(i)?'completed':''}" onclick="toggleChallenge(${i})">
      <div class="challenge-check ${completed.includes(i)?'done':''}">${completed.includes(i)?'✓':c.icon}</div>
      <div style="flex:1">
        <div class="challenge-text">${c.text}</div>
        ${completed.includes(i)?'<div style="font-size:10px;color:var(--teal);margin-top:2px;font-weight:700">Completed ✓</div>':''}
      </div>
      <div class="challenge-day-label">Day ${i+1}</div>
    </div>`).join('');
}

function toggleChallenge(idx){
  const completed = JSON.parse(localStorage.getItem('pauseChallenge')||'[]');
  const pos = completed.indexOf(idx);
  if(pos===-1) completed.push(idx); else completed.splice(pos,1);
  localStorage.setItem('pauseChallenge', JSON.stringify(completed));
  renderChallenge();
  checkAndAwardBadges();
}