// ============================================================
// STATE
// ============================================================
let currentScreen = 'screen-home';
let screenHistory = [];
let assessMode = 'full';
let singleDisorderIdx = -1;
let allQuestions = [], allAnswers = [], currentQIdx = 0, questionMeta = [];
let disorderScores = {}, impactScores = {}, dwsScore = null;
let currentUser = null;
let userProfile = {};
let profileSelections = {gender:'',occupation:'',device:''};
let notifPermission = false;

// ============================================================
// FIX 3: GRADE PERSISTENCE — single authoritative store
// ============================================================
const GRADES_KEY = 'pause_grades';
window.AppGrades = {
  save: function(gradesObj){
    try { localStorage.setItem(GRADES_KEY, JSON.stringify(gradesObj)); } catch(e){}
  },
  load: function(){
    try {
      const raw = localStorage.getItem(GRADES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e){ return {}; }
  },
  update: function(disorderKey, severity){
    const g = this.load();
    g[disorderKey] = severity;
    this.save(g);
  },
  clear: function(){
    localStorage.removeItem(GRADES_KEY);
  }
};

// ============================================================
// SUPABASE AUTH
// ============================================================
const GOOGLE_CLIENT_ID = '857927388938-3rn4ejm805kukp10cerh4f7oakseejgn.apps.googleusercontent.com';
let googleSignInInitialized = false;

function initAuth(){
  if(window.google){
    initGoogleSignIn();
  } else {
    window.addEventListener('load', () => {
      if(window.google) initGoogleSignIn();
    });
    setTimeout(() => { if(window.google && !googleSignInInitialized) initGoogleSignIn(); }, 2000);
  }
  sb.auth.getSession().then(({data:{session}}) => {
    if(session) handleUser(session.user);
  });
  sb.auth.onAuthStateChange((event, session) => {
    if(session) handleUser(session.user);
    else handleLogout();
  });
}

function initGoogleSignIn(){
  if(googleSignInInitialized) return;
  googleSignInInitialized = true;

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  const btnEl = document.getElementById('googleSignInBtn');
  if(btnEl && !btnEl.hasChildNodes()){
    google.accounts.id.renderButton(btnEl, {
      theme:'outline', size:'large', width:320,
      text:'continue_with', shape:'rectangular'
    });
  }
  const btnAbout = document.getElementById('googleSignInBtnAbout');
  if(btnAbout && !btnAbout.hasChildNodes()){
    google.accounts.id.renderButton(btnAbout, {
      theme:'outline', size:'large', width:320,
      text:'continue_with', shape:'rectangular'
    });
  }
}

async function handleGoogleCredential(response){
  // FIX 1: T&C must be accepted before processing sign-in
  const cb  = document.getElementById('termsCheckbox');
  const err = document.getElementById('termsError');
  if(cb && !cb.checked){
    if(err) err.style.display = 'block';
    if(cb){ cb.style.outline='2px solid #c0392b'; setTimeout(()=>{ cb.style.outline=''; }, 1500); }
    return; // Block sign-in until T&C accepted
  }
  if(err) err.style.display = 'none';
  // Store consent timestamp
  localStorage.setItem('pause_terms_accepted', JSON.stringify({
    accepted: true,
    timestamp: new Date().toISOString(),
    version: '1.0'
  }));

  const {data, error} = await sb.auth.signInWithIdToken({
    provider:'google',
    token: response.credential
  });
  if(error){ console.error('Auth error:', error); alert('Login failed. Please try again.'); return; }
  closeModal('loginModal');
}

async function handleUser(user){
  currentUser = user;
  const avatar = document.getElementById('userAvatar');
  avatar.style.display = 'flex';
  avatar.textContent = user.email.charAt(0).toUpperCase();
  renderLoginBanner();
  renderAccountSection();

  // FIX 1: Profile is mandatory — no skip path
  const profile = localStorage.getItem('pause_profile_' + user.id)
               || localStorage.getItem('pauseProfile_' + user.id); // migrate old key
  if(!profile){
    setTimeout(() => openModal('profileModal'), 800);
  } else {
    userProfile = JSON.parse(profile);
    // Migrate old key to new if needed
    localStorage.setItem('pause_profile_' + user.id, JSON.stringify(userProfile));
  }
}

function handleLogout(){
  currentUser = null;
  document.getElementById('userAvatar').style.display = 'none';
  renderLoginBanner();
  renderAccountSection();
}

async function logoutUser(){
  await sb.auth.signOut();
  if(window.google) google.accounts.id.disableAutoSelect();
  // FIX 3: Only clear grades on explicit sign-out, never on app open
  window.AppGrades.clear();
  closeModal('userModal');
}

function renderLoginBanner(){
  const el = document.getElementById('loginBannerHome');
  if(currentUser){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="login-banner" onclick="openModal('loginModal')">
      <div>🔒</div>
      <div class="login-banner-text">
        <div class="login-banner-title">Login to save your progress</div>
        <div class="login-banner-sub">Data may be lost if you clear the app</div>
      </div>
      <div class="login-banner-arrow">›</div>
    </div>`;
}

function renderAccountSection(){
  const el = document.getElementById('accountSection');
  if(currentUser){
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff">${currentUser.email.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${currentUser.email}</div>
          <div style="font-size:11px;color:var(--muted)">Logged in · Data synced</div>
        </div>
      </div>
      <button class="btn-secondary" style="margin-top:0;margin-bottom:8px" onclick="openEditProfile()">✏️ Edit My Details</button>
      <button class="btn-secondary" style="margin-top:0" onclick="logoutUser()">Sign Out</button>`;
  } else {
    el.innerHTML = `
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Login to save your data and sync across devices.</p>
      <div id="googleSignInBtnAbout" style="display:flex;justify-content:center"></div>`;
    if(googleSignInInitialized && window.google){
      const btnAbout = document.getElementById('googleSignInBtnAbout');
      if(btnAbout && !btnAbout.hasChildNodes()){
        google.accounts.id.renderButton(btnAbout, {
          theme:'outline', size:'large', width:320,
          text:'continue_with', shape:'rectangular'
        });
      }
    }
  }
}

// ============================================================
// PROFILE
// ============================================================
function selectOption(type, value, btn){
  const containers = {gender:'genderOptions',occupation:'occupationOptions',device:'deviceOptions'};
  document.querySelectorAll(`#${containers[type]} .form-option`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profileSelections[type] = value;
}

function saveProfile(){
  const age = parseInt(document.getElementById('profileAge').value);
  if(!age || age < 13 || age > 100){ alert('Please enter a valid age.'); return; }
  if(!profileSelections.gender){ alert('Please select your gender.'); return; }
  if(!profileSelections.occupation){ alert('Please select your occupation.'); return; }
  if(!profileSelections.device){ alert('Please select your primary device.'); return; }

  userProfile = {
    age,
    gender: profileSelections.gender,
    occupation: profileSelections.occupation,
    country: document.getElementById('profileCountry').value,
    primary_device: profileSelections.device
  };

  // FIX 6: Save under consistent key for edit profile compatibility
  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
    localStorage.setItem('pauseProfile_' + currentUser.id, JSON.stringify(userProfile)); // keep old key too
  }
  closeModal('profileModal');
}

// FIX 6: Edit profile — opened from userModal "Edit My Details" button
function openEditProfile(){
  closeModal('userModal');
  if(!userProfile || !userProfile.age){ openModal('profileModal'); return; }
  // Pre-fill edit fields
  const sv = function(id, val){ const el=document.getElementById(id); if(el && val!==undefined) el.value=val; };
  sv('editAge', userProfile.age);
  sv('editGender', userProfile.gender);
  sv('editOccupation', userProfile.occupation);
  sv('editCountry', userProfile.country);
  sv('editDevice', userProfile.primary_device);
  openModal('editProfileModal');
}

function saveEditProfile(){
  const age = parseInt(document.getElementById('editAge').value);
  if(!age || age < 13 || age > 100){ alert('Please enter a valid age between 13 and 100.'); return; }
  userProfile.age            = age;
  userProfile.gender         = document.getElementById('editGender').value;
  userProfile.occupation     = document.getElementById('editOccupation').value;
  userProfile.country        = document.getElementById('editCountry').value;
  userProfile.primary_device = document.getElementById('editDevice').value;
  userProfile.updatedAt      = new Date().toISOString();
  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
    localStorage.setItem('pauseProfile_' + currentUser.id, JSON.stringify(userProfile));
  }
  closeModal('editProfileModal');
  // Refresh user modal
  setTimeout(() => showUserModal(), 200);
}

function showUserModal(){
  if(!currentUser){ openModal('loginModal'); return; }
  document.getElementById('userModalContent').innerHTML = `
    <div class="modal-title">👤 ${currentUser.email}</div>
    ${userProfile.age ? `<div style="font-size:13px;color:var(--muted);margin-bottom:16px">Age: ${userProfile.age} · ${userProfile.gender} · ${userProfile.occupation}<br>${userProfile.country} · ${userProfile.primary_device}</div>` : '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">Profile not yet set up.</div>'}
  `;
  openModal('userModal');
}

// ============================================================
// SAVE TO SUPABASE
// ============================================================
async function saveToSupabase(){
  if(!currentUser) return;
  try {
    await sb.from('Assessments').insert({
      user_id: currentUser.id,
      email: currentUser.email,
      disorder_scores: disorderScores,
      impact_scores: impactScores,
      dws_score: dwsScore,
      research_consent: localStorage.getItem('researchConsent') === 'true',
      age: userProfile.age || null,
      gender: userProfile.gender || null,
      occupation: userProfile.occupation || null,
      country: userProfile.country || null,
      primary_device: userProfile.primary_device || null
    });
  } catch(e){ console.log('Supabase save error:', e); }
}

// ============================================================
// MODALS
// ============================================================
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='loginModal' && window.google && googleSignInInitialized){
    const btnEl = document.getElementById('googleSignInBtn');
    if(btnEl && !btnEl.hasChildNodes()){
      google.accounts.id.renderButton(btnEl, {
        theme:'outline', size:'large', width:320,
        text:'continue_with', shape:'rectangular'
      });
    }
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
