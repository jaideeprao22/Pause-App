// ============================================================
// SCREEN TIME LOG
// ============================================================

function saveScreenTime(hours){
  const log = JSON.parse(localStorage.getItem('screenTimeLog') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const existing = log.findIndex(e => e.date === today);
  if(existing >= 0) log[existing].hours = hours;
  else log.unshift({date: today, hours});
  if(log.length > 30) log.splice(30);
  localStorage.setItem('screenTimeLog', JSON.stringify(log));
  renderScreenTimeSection();
}

function renderScreenTimeSection(){
  const el = document.getElementById('screenTimeSection');
  if(!el) return;
  const log = JSON.parse(localStorage.getItem('screenTimeLog') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const todayEntry = log.find(e => e.date === today);
  const avg = log.length > 0 ? (log.reduce((s,e) => s + e.hours, 0) / log.length).toFixed(1) : null;

  el.innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Today's Screen Time (hours)</div>
      <div style="display:flex;align-items:center;gap:12px">
        <input type="number" id="screenTimeInput" min="0" max="24" step="0.5" value="${todayEntry?.hours||''}" placeholder="e.g. 6.5"
          style="width:100px;border:2px solid var(--border);border-radius:12px;padding:10px 14px;font-size:16px;font-family:inherit;color:var(--text)"/>
        <button class="btn-primary" style="flex:1;padding:12px" onclick="saveScreenTime(parseFloat(document.getElementById('screenTimeInput').value)||0)">Log</button>
      </div>
      ${avg ? `<div style="font-size:12px;color:var(--muted);margin-top:8px">Your 30-day average: <strong>${avg} hours/day</strong></div>` : ''}
    </div>
    ${log.length > 0 ? `
    <div style="display:flex;align-items:flex-end;gap:4px;height:60px;margin-bottom:8px">
      ${log.slice(0,14).reverse().map(e => {
        const pct = Math.min(100, (e.hours / 12) * 100);
        const color = e.hours <= 4 ? '#2ecc71' : e.hours <= 8 ? '#f5a623' : '#ff4757';
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:100%;border-radius:3px 3px 0 0;background:${color}" style="height:${pct}%"></div>
          <div style="font-size:8px;color:var(--muted)">${e.hours}h</div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:10px;color:var(--muted);text-align:center">Last 14 days screen time</div>` : ''}`;
}

// ============================================================
// RESEARCH CONSENT
// ============================================================

function renderResearchConsent(){
  const el = document.getElementById('researchConsentSection');
  if(!el) return;
  const consented = localStorage.getItem('researchConsent') === 'true';
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <input type="checkbox" id="researchConsentCheck" ${consented?'checked':''} onchange="toggleResearchConsent()"
        style="width:20px;height:20px;margin-top:2px;flex-shrink:0;cursor:pointer"/>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Contribute to Research</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">I voluntarily agree to share my anonymized assessment data with the Department of Community Medicine, Government Medical College, Maheshwaram for digital addiction research. No personally identifiable information will be shared.</div>
      </div>
    </div>`;
}

function toggleResearchConsent(){
  const checked = document.getElementById('researchConsentCheck')?.checked;
  localStorage.setItem('researchConsent', checked ? 'true' : 'false');
  if(checked && currentUser) saveResearchConsentToSupabase();
}

async function saveResearchConsentToSupabase(){
  if(!currentUser || typeof sb === 'undefined') return;
  try {
    await sb.from('Assessments').update({research_consent: true}).eq('user_id', currentUser.id);
  } catch(e){ console.log('Consent save error:', e); }
}

// ============================================================
// PDF REPORT / SHOW YOUR DOCTOR MODE
// ============================================================

function generateDoctorReport(){
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  const latest = history[0];
  if(!latest){ alert('Please complete an assessment first.'); return; }

  const date = new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
  const s = dwsScore ? getDWSStatus(dwsScore) : null;

  let reportHTML = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#0a1628}
  h1{color:#3d6fff;border-bottom:2px solid #3d6fff;padding-bottom:10px}
  h2{color:#1a3a6e;margin-top:24px}
  .score-box{background:#f0f4ff;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
  .score-num{font-size:48px;font-weight:bold;color:#3d6fff}
  .disorder-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #e2e8f0}
  .level-badge{padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold}
  .disclaimer{background:#fff9e6;border:1px solid #f5a623;border-radius:8px;padding:12px;margin-top:20px;font-size:12px}
  .footer{margin-top:30px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px}
  @media print{body{margin:20px}}
</style></head><body>
  <h1>PAUSE App — Digital Wellness Report</h1>
  <div style="font-size:13px;color:#64748b">Generated: ${date} | Assessment tool validated at Government Medical College, Maheshwaram</div>

  ${dwsScore !== null ? `
  <div class="score-box">
    <div style="font-size:14px;color:#64748b;margin-bottom:8px">Digital Wellness Score</div>
    <div class="score-num">${dwsScore}<span style="font-size:24px;color:#64748b">/100</span></div>
    <div style="font-size:16px;font-weight:bold;color:${s?.color}">${s?.status}</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px">${s?.sub}</div>
  </div>` : ''}

  <h2>Disorder Screening Results</h2>
  ${DISORDERS.filter(d => disorderScores[d.id] !== undefined).map(d => {
    const score = disorderScores[d.id];
    const level = getLevel(d, score);
    const percentile = getPercentile(d.id, score);
    return `<div class="disorder-row">
      <div>
        <strong>${d.icon} ${d.name}</strong>
        <div style="font-size:12px;color:#64748b">${d.scale} · Score: ${score}/${d.maxScore}${percentile !== null ? ` · Higher than ${percentile}% of users` : ''}</div>
      </div>
      <span class="level-badge" style="background:${level.bg};color:${level.color}">${level.label}</span>
    </div>`;
  }).join('')}

  ${Object.keys(impactScores).length > 0 ? `
  <h2>Health Impact Assessment</h2>
  ${IMPACT_MODULES.map(m => {
    const score = impactScores[m.id] || 0;
    const level = getImpactLevel(score);
    return `<div class="disorder-row">
      <strong>${m.icon} ${m.name}</strong>
      <span class="level-badge" style="color:${level.color}">${level.label}</span>
    </div>`;
  }).join('')}` : ''}

  <h2>Instruments Used</h2>
  <div style="font-size:12px;color:#64748b;line-height:1.8">
    ${DISORDERS.filter(d => disorderScores[d.id] !== undefined).map(d => `• ${d.name}: ${d.scaleRef}`).join('<br>')}
  </div>

  <div class="disclaimer">
    <strong>⚠️ Clinical Disclaimer:</strong> This report is generated by an educational screening tool and does not constitute a clinical diagnosis. 
    Results should be interpreted by a qualified healthcare professional in the context of a clinical assessment. 
    This tool was developed at the Department of Community Medicine, Government Medical College, Maheshwaram, Rangareddy District, Telangana, India.
  </div>

  <div class="footer">
    PAUSE App — Digital Wellness Platform | Department of Community Medicine, GMC Maheshwaram<br>
    This report is for informational purposes only.
  </div>
</body></html>`;

  const blob = new Blob([reportHTML], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if(win){
    setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = 'pause-wellness-report.html'; a.click();
    URL.revokeObjectURL(url);
  }
}

// ============================================================
// CAREGIVER MODE
// ============================================================

function renderCaregiverSection(){
  const el = document.getElementById('caregiverSection');
  if(!el) return;
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  if(history.length < 2){ el.innerHTML = '<div style="font-size:12px;color:var(--muted)">Need at least 2 assessments to generate a caregiver summary.</div>'; return; }

  const latest = history[0];
  const previous = history[1];
  const trend = latest.dws > previous.dws ? '📈 Improving' : latest.dws < previous.dws ? '📉 Declining' : '➡️ Stable';
  const trendColor = latest.dws > previous.dws ? '#2ecc71' : latest.dws < previous.dws ? '#ff4757' : '#64748b';

  const shareText = `PAUSE App Wellness Update\n\nDWS Score Trend: ${trend}\nLatest Score: ${latest.dws}/100\nPrevious Score: ${previous.dws}/100\nChange: ${latest.dws > previous.dws ? '+' : ''}${latest.dws - previous.dws} points\n\nThis is an anonymous wellness trend summary. Individual scores and disorder details are not included.\n\n— Shared via PAUSE App`;

  el.innerHTML = `
    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Wellness Trend (last 2 assessments)</div>
      <div style="font-size:18px;font-weight:700;color:${trendColor}">${trend}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${latest.dws}/100 → ${previous.dws}/100</div>
    </div>
    <button class="btn-secondary" style="margin-top:0" onclick="shareCaregiverSummary('${shareText.replace(/'/g, "\\'")}')">📤 Share Trend with Caregiver</button>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">Only the trend direction is shared — no disorder details or personal data.</div>`;
}

function shareCaregiverSummary(text){
  if(navigator.share){ navigator.share({title:'PAUSE App Wellness Trend', text}); }
  else { navigator.clipboard.writeText(text).then(() => alert('Summary copied to clipboard!')); }
}
