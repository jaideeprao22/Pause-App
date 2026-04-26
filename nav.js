// ============================================================
// NAVIGATION
// ============================================================

// BUG11 FIX: Track which screens are "main tabs" — back button shouldn't
// accumulate history when user taps between nav tabs repeatedly
const MAIN_TABS = new Set(['screen-home','screen-tools','screen-progress','screen-logbook','screen-about']);

function showScreen(id){
  const navMap={
    'screen-home':0,
    'screen-assess-menu':0,'screen-quick':0,'screen-assessment':0,'screen-results':0,
    'screen-tools':1,
    'screen-progress':2,
    'screen-logbook':3,
    'screen-about':4
  };
  document.querySelectorAll('.nav-btn').forEach((b,i) => b.classList.toggle('active', i===navMap[id]));
  const showBack = ['screen-assess-menu','screen-quick','screen-assessment','screen-results'].includes(id);
  document.getElementById('backBtn').style.display = showBack ? 'block' : 'none';

  // BUG11 FIX: clear history when navigating to a main tab so goBack() stays logical
  if(MAIN_TABS.has(id)){
    screenHistory = [];
  } else if(currentScreen !== id){
    screenHistory.push(currentScreen);
  }

  // BUG5 FIX: reset breathing timer when leaving tools screen
  if(currentScreen === 'screen-tools' && id !== 'screen-tools'){
    if(typeof resetBreathingTimerState === 'function') resetBreathingTimerState();
  }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById(id).scrollTop = 0;
  currentScreen = id;

  if(id === 'screen-progress'){
    renderProgress();
    renderChallenge();
    // FIX 5: Render share button based on how many assessments exist
    const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
    if(typeof renderTrendShareButton === 'function') renderTrendShareButton(history.length);
  }

  if(id === 'screen-logbook'){
    renderLogbookScreen();
  }

  if(id === 'screen-tools'){
    renderMotivationCard();
    renderWeeklyReport();
    if(typeof renderCBTSection === 'function') renderCBTSection();
    renderScreenTimeSection();
    renderCaregiverSection();
    checkReassessmentReminder();
    // BUG4 FIX: render breathing timer card when tools screen is shown
    if(typeof renderBreathingTimerCard === 'function') renderBreathingTimerCard();
    // BUG9 FIX: call onToolsScreenShown hook so index.html init logic fires correctly
    if(typeof window.onToolsScreenShown === 'function') window.onToolsScreenShown();
  }

  if(id === 'screen-about'){
    renderAccountSection();
  }

  if(id === 'screen-home'){
    // BUG1 FIX: render disorder grade cards on every home screen navigation
    if(typeof renderHomeDisorders === 'function') renderHomeDisorders();
    // BUG2 FIX: refresh mood check widget
    if(typeof renderMoodCheck === 'function') renderMoodCheck();
    // BUG3 FIX: refresh DWS display (scores may have been loaded from localStorage)
    if(typeof updateDWSDisplay === 'function') updateDWSDisplay();
    // BUG7 FIX: refresh login banner state
    if(typeof renderLoginBanner === 'function') renderLoginBanner();
    renderBadges();
  }
}

function goBack(){
  if(screenHistory.length > 0){ const prev = screenHistory.pop(); showScreen(prev); }
  else showScreen('screen-home');
}

// ============================================================
// MODALS — click outside to close
// ============================================================
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if(e.target === m) closeModal(m.id); });
});

// ============================================================
// PWA
// ============================================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner').classList.add('show');
});

// BUG12 FIX: guard installBtn.addEventListener — crashes if element missing
const _installBtn = document.getElementById('installBtn');
if(_installBtn){
  _installBtn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    const {outcome} = await deferredPrompt.userChoice;
    if(outcome === 'accepted') document.getElementById('installBanner').classList.remove('show');
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  const b = document.getElementById('installBanner');
  if(b) b.classList.remove('show');
});

// BUG13 FIX: dynamic service worker path — works on any subdirectory or root domain
if('serviceWorker' in navigator){
  const swPath = location.pathname.replace(/\/[^/]*$/, '/') + 'sw.js';
  navigator.serviceWorker.register(swPath).catch(() => {});
}
