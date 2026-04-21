// ============================================================
// NAVIGATION
// ============================================================
function showScreen(id){
  const navMap={'screen-home':0,'screen-assess-menu':1,'screen-quick':1,'screen-assessment':1,'screen-results':1,'screen-logbook':2,'screen-tools':3,'screen-progress':4,'screen-about':4};
  document.querySelectorAll('.nav-btn').forEach((b,i)=>b.classList.toggle('active',i===navMap[id]));
  const showBack=['screen-assess-menu','screen-quick','screen-assessment','screen-results','screen-logbook','screen-tools'].includes(id);
  document.getElementById('backBtn').style.display=showBack?'block':'none';
  if(currentScreen!==id) screenHistory.push(currentScreen);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById(id).scrollTop=0;
  currentScreen=id;
  // FIX: renderProgress already calls renderMoodTrend internally — removed duplicate call
  if(id==='screen-progress'){ renderProgress(); renderChallenge(); }
  if(id==='screen-logbook'){ renderLogbookScreen(); }
  if(id==='screen-tools'){
    renderMotivationCard();
    renderWeeklyReport();
    renderCBTSection('cbtSection');
    renderScreenTimeSection();
    renderCaregiverSection();
    renderResearchConsent();
    checkReassessmentReminder();
  }
  if(id==='screen-home'){ renderBadges(); }
}

function goBack(){
  if(screenHistory.length>0){ const prev=screenHistory.pop(); showScreen(prev); }
  else showScreen('screen-home');
}

// ============================================================
// MODALS - click outside to close
// ============================================================
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) closeModal(m.id); });
});

// ============================================================
// PWA
// ============================================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.add('show');
});
document.getElementById('installBtn').addEventListener('click', async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const {outcome} = await deferredPrompt.userChoice;
  if(outcome==='accepted') document.getElementById('installBanner').classList.remove('show');
  deferredPrompt = null;
});
window.addEventListener('appinstalled', ()=>document.getElementById('installBanner').classList.remove('show'));
if('serviceWorker' in navigator){ navigator.serviceWorker.register('/Pause-App/sw.js').catch(()=>{}); }
