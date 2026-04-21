// ============================================================
// BADGES
// ============================================================
function getBadgeStats(){
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  // FIX: Removed unused 'earned' variable that was being computed and discarded here
  return {
    totalAssessments: history.length,
    fullAssessments: history.filter(h => Object.keys(h.disorder||{}).length === 6).length,
    bestDWS: history.reduce((max, h) => h.dws > max ? h.dws : max, 0),
    challengeWeeksCompleted: parseInt(localStorage.getItem('challengeWeeksCompleted')||'0'),
    improvedScore: history.length >= 2 && history[0].dws > history[1].dws,
    maxStreak: parseInt(localStorage.getItem('maxChallengeStreak')||'0'),
    shared: localStorage.getItem('hasShared') === 'true',
    disordersScreened: Object.keys(disorderScores).length
  };
}

function checkAndAwardBadges(){
  const stats = getBadgeStats();
  const earned = JSON.parse(localStorage.getItem('pauseBadges') || '[]');
  let newBadges = [];
  BADGES.forEach(b => {
    if(!earned.includes(b.id) && b.condition(stats)){
      earned.push(b.id);
      newBadges.push(b);
    }
  });
  localStorage.setItem('pauseBadges', JSON.stringify(earned));
  if(newBadges.length > 0){
    setTimeout(() => showBadgeModal(newBadges[0]), 1000);
  }
  renderBadges();
}

function showBadgeModal(badge){
  document.getElementById('badgeModalEmoji').textContent = badge.emoji;
  document.getElementById('badgeModalTitle').textContent = '🎉 Badge Earned: ' + badge.name;
  document.getElementById('badgeModalDesc').textContent = badge.desc;
  openModal('badgeModal');
}

function renderBadges(){
  const earned = JSON.parse(localStorage.getItem('pauseBadges') || '[]');
  const grid = document.getElementById('homeBadgeGrid');
  if(!grid) return;
  grid.innerHTML = BADGES.map(b => `
    <div class="badge-item ${earned.includes(b.id) ? 'earned' : 'locked'}" onclick="${earned.includes(b.id) ? `showBadgeModal(BADGES.find(x=>x.id==='${b.id}'))` : ''}">
      <div class="badge-emoji">${b.emoji}</div>
      <div class="badge-name">${b.name}</div>
    </div>`).join('');
}
