// ============================================================
// WEEKLY REPORT — Auto-generated Sunday summary
// ============================================================

// Bug 9+10 FIX: new Date("26 Apr 2026") fails on Safari/WebKit.
// History dates are stored in en-IN locale format ("26 Apr 2026").
// Parse them manually to guarantee cross-browser reliability.
function _parseHistoryDate(dateStr){
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const parts = (dateStr || '').trim().split(/\s+/);
  if(parts.length === 3){
    const day   = parseInt(parts[0], 10);
    const month = months[parts[1]];
    const year  = parseInt(parts[2], 10);
    if(!isNaN(day) && month !== undefined && !isNaN(year)){
      return new Date(year, month, day);
    }
  }
  return new Date(dateStr); // fallback for unexpected formats
}

function generateWeeklyReport(){
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  const challenge = JSON.parse(localStorage.getItem('pauseChallenge') || '[]');
  const weekStart = getWeekStart();
  // Bug 9 FIX: use _parseHistoryDate instead of new Date(h.date)
  const weekEntries = history.filter(h => _parseHistoryDate(h.date) >= weekStart);
  const latest = weekEntries[0];
  const previous = history.find(h => _parseHistoryDate(h.date) < weekStart);

  let dwsChange = null;
  if(latest?.dws && previous?.dws){
    dwsChange = latest.dws - previous.dws;
  }

  return {
    assessmentsThisWeek: weekEntries.length,
    challengeDaysCompleted: challenge.length,
    latestDWS: latest?.dws || null,
    dwsChange,
    topConcern: getTopDisorder(),
    weekLabel: weekStart.toLocaleDateString('en-IN',{day:'numeric',month:'short'})
  };
}

function getWeekStart(){
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0,0,0,0);
  return monday;
}

function renderWeeklyReport(){
  const el = document.getElementById('weeklyReportCard');
  if(!el) return;
  const report = generateWeeklyReport();
  const hasData = report.latestDWS !== null || report.assessmentsThisWeek > 0;

  if(!hasData){
    el.innerHTML = `<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">Complete an assessment this week to see your weekly report.</div>`;
    return;
  }

  const changeColor = report.dwsChange > 0 ? '#2ecc71' : report.dwsChange < 0 ? '#ff4757' : '#64748b';
  const changeIcon = report.dwsChange > 0 ? '📈' : report.dwsChange < 0 ? '📉' : '➡️';
  const changeText = report.dwsChange !== null ? `${report.dwsChange > 0 ? '+' : ''}${report.dwsChange} from last assessment` : 'First assessment this week';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:800;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Week of ${report.weekLabel}</div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:var(--text)">Weekly Summary</div>
      </div>
      <div style="text-align:right">
        ${report.latestDWS ? `<div style="font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:var(--accent)">${report.latestDWS}</div><div style="font-size:10px;color:var(--muted)">DWS Score</div>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--bg);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--accent)">${report.assessmentsThisWeek}</div>
        <div style="font-size:10px;color:var(--muted)">Assessments</div>
      </div>
      <div style="background:var(--bg);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--teal)">${report.challengeDaysCompleted}/7</div>
        <div style="font-size:10px;color:var(--muted)">Challenge Days</div>
      </div>
      <div style="background:var(--bg);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:${changeColor}">${changeIcon}</div>
        <div style="font-size:10px;color:${changeColor};font-weight:700">${changeText}</div>
      </div>
    </div>
    ${report.topConcern && report.topConcern !== 'default' ? `
    <div style="background:rgba(61,111,255,0.06);border-radius:12px;padding:12px;border:1px solid rgba(61,111,255,0.15)">
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px">FOCUS AREA THIS WEEK</div>
      <div style="font-size:13px;font-weight:700;color:var(--accent)">${DISORDERS.find(d=>d.id===report.topConcern)?.icon} ${DISORDERS.find(d=>d.id===report.topConcern)?.name}</div>
    </div>` : ''}`;
}

function checkReassessmentReminder(){
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  if(!history.length) return;
  // Bug 10 FIX: use _parseHistoryDate — new Date(locale string) fails on Safari
  const lastDate = _parseHistoryDate(history[0].date);
  const now = new Date();
  const daysSince = Math.floor((now - lastDate) / (1000*60*60*24));
  if(daysSince >= 28){
    const banner = document.getElementById('reassessmentBanner');
    if(banner){
      banner.style.display = 'block';
      banner.innerHTML = `
        <div class="notice yellow" style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="showScreen('screen-assess-menu');document.getElementById('reassessmentBanner').style.display='none'">
          <div style="font-size:24px">📅</div>
          <div>
            <div class="notice-title">Time for Reassessment!</div>
            It's been ${daysSince} days since your last assessment. See how you've improved.
          </div>
        </div>`;
    }
  }
}
// Removed redundant DOMContentLoaded listener — app.js init() already calls checkReassessmentReminder()
