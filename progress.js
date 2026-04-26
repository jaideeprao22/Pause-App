// ============================================================
// PROGRESS & CHALLENGE
// ============================================================

// ─── PERSONAL SUMMARY CARD ───────────────────────────────────
function renderPersonalSummary(){
  const el = document.getElementById('progressSummaryCard');
  if(!el) return;
  const history = JSON.parse(localStorage.getItem('pauseV2History')||'[]');

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
  const best    = Math.max(...history.filter(h => h.dws).map(h => h.dws));
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
          <div style="font-size:36px;font-weight:800;font-family:'Syne',sans-serif;color:${s?s.color:'var(--muted)'};line-height:1">${latest.dws || '--'}</div>
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
  const history = JSON.parse(localStorage.getItem('pauseV2History')||'[]');

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
  renderPersonalSummary();
  renderDisorderProgress();
  renderMoodTrend();
  const history = JSON.parse(localStorage.getItem('pauseV2History')||'[]');

  // Trend graph
  const trendBars = document.getElementById('trendBars');
  if(trendBars){
    const recent = history.filter(h=>h.dws).slice(0,7).reverse();
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
  const weekStart = localStorage.getItem('challengeWeekStart');
  const now = Date.now();
  const sevenDaysPassed = weekStart && (now - parseInt(weekStart) > 7*24*60*60*1000);
  const isFirstLoad = !weekStart;

  if(isFirstLoad){
    // First ever load — start Week 1
    localStorage.setItem('pauseChallenge','[]');
    localStorage.setItem('challengeWeekStart', now.toString());
    localStorage.setItem('currentWeekNum', '1');
    localStorage.setItem('challengeWeeksCompleted', '0');
  } else if(sevenDaysPassed){
    const completed = JSON.parse(localStorage.getItem('pauseChallenge')||'[]');
    const prevWeekNum = parseInt(localStorage.getItem('currentWeekNum')||'1');

    // BUG FIX 1: Count as completed only if all 7 challenges done
    if(completed.length === 7){
      const weeks = parseInt(localStorage.getItem('challengeWeeksCompleted')||'0');
      localStorage.setItem('challengeWeeksCompleted', (weeks + 1).toString());
    }

    // BUG FIX 2: Always increment week number, whether complete or not
    localStorage.setItem('currentWeekNum', (prevWeekNum + 1).toString());

    // Reset challenge for new week
    localStorage.setItem('pauseChallenge','[]');
    localStorage.setItem('challengeWeekStart', now.toString());
    localStorage.setItem('weekJustReset', completed.length === 7 ? 'completed' : 'expired');
  }

  const completed = JSON.parse(localStorage.getItem('pauseChallenge')||'[]');
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
  if(completed.length > maxStreak) localStorage.setItem('maxChallengeStreak', completed.length);

  const el = document.getElementById('challengeList');
  if(!el) return;

  // Show reset notification banner if week just changed
  let resetBanner = '';
  if(weekJustReset === 'completed'){
    resetBanner = `<div class="notice green" style="margin-bottom:8px;text-align:center">
      <div class="notice-title">🏆 Last week complete!</div>
      You finished all 7 challenges. Week ${weekNum} has started.
    </div>`;
    localStorage.removeItem('weekJustReset');
  } else if(weekJustReset === 'expired'){
    resetBanner = `<div class="notice yellow" style="margin-bottom:8px">
      <div class="notice-title">⏰ A new week has started</div>
      Your previous week's challenges have reset. Keep going — Week ${weekNum} is here!
    </div>`;
    localStorage.removeItem('weekJustReset');
  }

  // Show completion state
  if(completed.length === 7){
    el.innerHTML = resetBanner + `<div class="notice green" style="text-align:center;padding:20px">
      <div style="font-size:36px;margin-bottom:8px">🏆</div>
      <div class="notice-title">Week ${weekNum} Complete!</div>
      You've finished all 7 challenges. A new challenge week will start automatically in 7 days.
    </div>` +
    CHALLENGES.map((c,i) => `
      <div class="challenge-day completed">
        <div class="challenge-check done">✓</div>
        <div><div style="font-size:16px">${c.icon}</div><div class="challenge-text">${c.text}</div></div>
        <div class="challenge-day-label">Day ${i+1}</div>
      </div>`).join('');
    return;
  }

  // Show active challenge list
  el.innerHTML = resetBanner + CHALLENGES.map((c,i) => `
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
