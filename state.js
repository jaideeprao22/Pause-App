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
let profileSelections = {
  gender:'', marital:'', occupation:'', residence:'', living_situation:'',
  device:'', morning_habit:'', bedroom_charge:'',
  self_rated_health:'', chronic_illness:'', family_member_ill:'',
  physical_activity:'', prev_detox_attempt:'', followup_consent:''
};
let postAssessDisorderId = null; // set by renderPostAssessmentPrompt, read by savePostAssessmentData
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
}

async function handleGoogleCredential(response){
  // T&C is enforced at termsModal before loginModal is ever shown.
  // Safety net: if consent missing, redirect back to terms.
  if(!localStorage.getItem('pause_terms_accepted')){
    closeModal('loginModal');
    setTimeout(() => openModal('termsModal'), 250);
    return;
  }
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
  // Do NOT clear AppGrades on logout — user may re-login immediately
  // and CBT modules should remain personalised to their last assessment
  closeModal('userModal');
}

function renderLoginBanner(){
  const el = document.getElementById('loginBannerHome');
  if(currentUser){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="login-banner" onclick="openLoginFlow()">
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
          <div style="font-size:11px;color:var(--muted)">Signed in · Your data is safe</div>
        </div>
      </div>
      <button class="btn-secondary" style="margin-top:0;margin-bottom:8px" onclick="openEditProfile()">✏️ Edit My Details</button>
      <button class="btn-secondary" style="margin-top:0" onclick="logoutUser()">Sign Out</button>`;
  } else {
    el.innerHTML = `
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px">Sign in to keep your progress safe and sync across your devices.</p>
      <button class="btn-primary" onclick="openLoginFlow()">🔐 Sign In / Create Account</button>`;
  }
}

// ============================================================
// PROFILE
// ============================================================
function selectOption(type, value, btn){
  const containerMap = {
    gender:             'genderOptions',
    marital:            'maritalOptions',
    occupation:         'occupationOptions',
    residence:          'residenceOptions',
    living_situation:   'livingSituationOptions',
    device:             'deviceOptions',
    morning_habit:      'morningHabitOptions',
    bedroom_charge:     'bedroomChargeOptions',
    self_rated_health:  'selfRatedHealthOptions',
    chronic_illness:    'chronicIllnessOptions',
    family_member_ill:  'familyIllOptions',
    physical_activity:  'physicalActivityOptions',
    prev_detox_attempt: 'prevDetoxOptions',
    followup_consent:   'followupConsentOptions'
  };
  const containerId = containerMap[type];
  if(containerId) document.querySelectorAll(`#${containerId} .form-option`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profileSelections[type] = value;
}

function saveProfile(){
  // Validate number inputs and selects directly from DOM
  const age = parseInt(document.getElementById('profileAge').value);
  if(!age || age < 18 || age > 100){ alert('Please enter a valid age (18 or older).'); return; }
  if(!profileSelections.gender)           { alert('Please select your gender.'); return; }
  if(!document.getElementById('profileEducation').value) { alert('Please select your education level.'); return; }
  if(!profileSelections.marital)          { alert('Please select your marital status.'); return; }
  if(!profileSelections.occupation)       { alert('Please select your occupation.'); return; }
  if(!document.getElementById('profileIncome').value)    { alert('Please select your income range.'); return; }
  if(!profileSelections.residence)        { alert('Please select your area of residence.'); return; }
  if(!profileSelections.living_situation) { alert('Please select your living situation.'); return; }
  if(!profileSelections.device)           { alert('Please select your primary device.'); return; }
  if(!document.getElementById('profileScreentime').value){ alert('Please select your daily screen time.'); return; }
  if(!document.getElementById('profileSmartphoneYears').value){ alert('Please select years using a smartphone.'); return; }
  if(!profileSelections.morning_habit)    { alert('Please answer the morning habit question.'); return; }
  if(!profileSelections.bedroom_charge)   { alert('Please answer the bedroom charging question.'); return; }
  if(!document.getElementById('profileSleep').value)     { alert('Please select your average sleep.'); return; }
  if(!profileSelections.self_rated_health){ alert('Please rate your overall health.'); return; }
  if(!profileSelections.chronic_illness)  { alert('Please answer the chronic illness question.'); return; }
  if(!profileSelections.family_member_ill){ alert('Please answer the family illness question.'); return; }
  if(!profileSelections.physical_activity){ alert('Please select your physical activity level.'); return; }
  if(!profileSelections.prev_detox_attempt){ alert('Please answer the digital detox question.'); return; }
  if(!profileSelections.followup_consent) { alert('Please answer the follow-up consent question.'); return; }

  userProfile = {
    age,
    gender:             profileSelections.gender,
    education:          document.getElementById('profileEducation').value,
    marital_status:     profileSelections.marital,
    occupation:         profileSelections.occupation,
    income_bracket:     document.getElementById('profileIncome').value,
    country:            document.getElementById('profileCountry').value,
    residence_type:     profileSelections.residence,
    living_situation:   profileSelections.living_situation,
    primary_device:     profileSelections.device,
    daily_screentime:   document.getElementById('profileScreentime').value,
    smartphone_years:   document.getElementById('profileSmartphoneYears').value,
    morning_habit:      profileSelections.morning_habit,
    bedroom_charge:     profileSelections.bedroom_charge,
    avg_sleep:          document.getElementById('profileSleep').value,
    self_rated_health:  profileSelections.self_rated_health,
    chronic_illness:    profileSelections.chronic_illness,
    family_member_ill:  profileSelections.family_member_ill,
    physical_activity:  profileSelections.physical_activity,
    prev_detox_attempt: profileSelections.prev_detox_attempt,
    referral_source:    document.getElementById('profileReferral').value || null,
    followup_consent:   profileSelections.followup_consent === 'Yes',
    terms_version:      '1.0',
    createdAt:          new Date().toISOString()
  };

  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
    localStorage.setItem('pauseProfile_' + currentUser.id, JSON.stringify(userProfile));
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
  if(!age || age < 18 || age > 100){ alert('Please enter a valid age between 18 and 100.'); return; }
  // Only update the 5 editable fields — all research fields are preserved from existing userProfile
  userProfile.age            = age;
  userProfile.gender         = document.getElementById('editGender').value || userProfile.gender;
  userProfile.occupation     = document.getElementById('editOccupation').value || userProfile.occupation;
  userProfile.country        = document.getElementById('editCountry').value || userProfile.country;
  userProfile.primary_device = document.getElementById('editDevice').value || userProfile.primary_device;
  userProfile.updatedAt      = new Date().toISOString();
  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
    localStorage.setItem('pauseProfile_' + currentUser.id, JSON.stringify(userProfile));
  }
  closeModal('editProfileModal');
  setTimeout(() => showUserModal(), 200);
}

function showUserModal(){
  if(!currentUser){ openLoginFlow(); return; }
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
    const { data, error } = await sb.from('Assessments').insert({
      user_id:            currentUser.id,
      email:              currentUser.email,
      disorder_scores:    disorderScores,
      impact_scores:      impactScores,
      dws_score:          dwsScore,
      research_consent:   true,
      terms_version:      '1.0',
      // Demographics
      age:                userProfile.age || null,
      gender:             userProfile.gender || null,
      education:          userProfile.education || null,
      occupation:         userProfile.occupation || null,
      marital_status:     userProfile.marital_status || null,
      country:            userProfile.country || null,
      residence_type:     userProfile.residence_type || null,
      living_situation:   userProfile.living_situation || null,
      income_bracket:     userProfile.income_bracket || null,
      // Digital habits
      primary_device:     userProfile.primary_device || null,
      daily_screentime:   userProfile.daily_screentime || null,
      smartphone_years:   userProfile.smartphone_years || null,
      morning_habit:      userProfile.morning_habit || null,
      bedroom_charge:     userProfile.bedroom_charge || null,
      // Health
      avg_sleep:          userProfile.avg_sleep || null,
      self_rated_health:  userProfile.self_rated_health || null,
      chronic_illness:    userProfile.chronic_illness || null,
      family_member_ill:  userProfile.family_member_ill || null,
      physical_activity:  userProfile.physical_activity || null,
      // Research meta
      prev_detox_attempt: userProfile.prev_detox_attempt || null,
      referral_source:    userProfile.referral_source || null,
      followup_consent:   userProfile.followup_consent || null
    }).select('id').single();

    // Store row ID so Stage 2 post-assessment UPDATE can target the correct row
    if(!error && data && data.id){
      localStorage.setItem('pause_last_assessment_id', data.id);
    }
  } catch(e){ console.log('Supabase save error:', e); }
}

// ============================================================
// STAGE 2: POST-ASSESSMENT RESEARCH DATA
// ============================================================
async function savePostAssessmentData(){
  const questions = document.querySelectorAll('#postAssessQuestions .post-assess-q');
  const answers = {};
  let allAnswered = true;
  questions.forEach((qEl, i) => {
    const selected = qEl.querySelector('.form-option.selected');
    if(!selected){ allAnswered = false; return; }
    answers['post_q' + (i + 1)] = selected.dataset.value;
  });

  if(!allAnswered){
    alert('Please answer all 3 questions before submitting.');
    return;
  }

  answers['post_assess_disorder'] = postAssessDisorderId;
  localStorage.setItem('pause_post_assess_' + (postAssessDisorderId || 'unknown'), JSON.stringify(answers));

  if(currentUser){
    try {
      const rowId = localStorage.getItem('pause_last_assessment_id');
      if(rowId){
        await sb.from('Assessments').update(answers).eq('id', rowId);
      }
    } catch(e){ console.log('Stage 2 Supabase update error:', e); }
  }

  closeModal('postAssessmentModal');
  // Toast confirmation
  const toast = document.createElement('div');
  toast.textContent = '🔬 Thank you for contributing to research!';
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f2d5e;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// FEEDBACK
// ============================================================
let feedbackRating = 0;
let feedbackCategory = '';

function selectFeedbackRating(val){
  feedbackRating = val;
  const labels = ['','😞 Poor','😐 Fair','🙂 Good','😊 Great','🤩 Excellent'];
  document.querySelectorAll('.feedback-star').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
  const lbl = document.getElementById('feedbackRatingLabel');
  if(lbl) lbl.textContent = labels[val] || 'Tap to rate';
}

function selectFeedbackCategory(value, btn){
  feedbackCategory = value;
  document.querySelectorAll('#feedbackCategoryOptions .form-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

async function submitFeedback(){
  const msg   = (document.getElementById('feedbackMessage')?.value || '').trim();
  const email = (document.getElementById('feedbackEmail')?.value || '').trim();
  const errEl = document.getElementById('feedbackError');

  if(!msg){
    if(errEl){ errEl.textContent = 'Please add a message before submitting.'; errEl.style.display = 'block'; }
    return;
  }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(errEl){ errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; }
    return;
  }
  if(errEl) errEl.style.display = 'none';

  const submitBtn = document.getElementById('feedbackSubmitBtn');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

  const payload = {
    rating:    feedbackRating || null,
    category:  feedbackCategory || 'General feedback',
    message:   msg,
    contact_email: (document.getElementById('feedbackEmail')?.value || '').trim() || null,
    user_id:   currentUser?.id || null,
    app_version: '1.0',
    created_at: new Date().toISOString()
  };

  let saved = false;
  try {
    const { error } = await sb.from('Feedback').insert(payload);
    if(!error) saved = true;
  } catch(e){ console.log('Feedback save error:', e); }

  // Show success regardless (offline-resilient)
  document.getElementById('feedbackSuccess').style.display = 'block';
  if(submitBtn) submitBtn.style.display = 'none';

  // Reset form state for next use
  feedbackRating = 0;
  feedbackCategory = '';
  if(document.getElementById('feedbackMessage')) document.getElementById('feedbackMessage').value = '';
  if(document.getElementById('feedbackEmail')) document.getElementById('feedbackEmail').value = '';
  document.querySelectorAll('.feedback-star').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#feedbackCategoryOptions .form-option').forEach(b => b.classList.remove('selected'));
  const rLabel = document.getElementById('feedbackRatingLabel');
  if(rLabel) rLabel.textContent = 'Tap to rate';

  // Re-show form after 4s so user can submit again if needed
  setTimeout(() => {
    const s = document.getElementById('feedbackSuccess');
    const b = document.getElementById('feedbackSubmitBtn');
    if(s) s.style.display = 'none';
    if(b){ b.style.display = 'block'; b.disabled = false; b.textContent = 'Send Feedback →'; }
  }, 4000);
}

// ============================================================
// LOGIN FLOW
// ============================================================
function openLoginFlow(){
  // Show T&C if never accepted; go straight to sign-in if returning user
  const alreadyAccepted = localStorage.getItem('pause_terms_accepted');
  if(alreadyAccepted){
    openModal('loginModal');
  } else {
    openModal('termsModal');
  }
}

function acceptTermsAndLogin(){
  const cb  = document.getElementById('termsCheckbox');
  const err = document.getElementById('termsError');
  if(!cb || !cb.checked){
    if(err) err.style.display = 'block';
    if(cb){ cb.style.outline = '3px solid #c0392b'; setTimeout(() => { if(cb) cb.style.outline = ''; }, 2000); }
    return;
  }
  if(err) err.style.display = 'none';
  localStorage.setItem('pause_terms_accepted', JSON.stringify({
    accepted: true, timestamp: new Date().toISOString(), version: '1.0'
  }));
  closeModal('termsModal');
  setTimeout(() => openModal('loginModal'), 250);
}

// ============================================================
// MODALS
// ============================================================
function openModal(id){
  document.getElementById(id).classList.add('open');

  // Reset T&C checkbox every time terms modal opens
  if(id === 'termsModal'){
    const cb = document.getElementById('termsCheckbox');
    if(cb) cb.checked = false;
    const err = document.getElementById('termsError');
    if(err) err.style.display = 'none';
  }

  // Re-render Google sign-in button each time loginModal opens
  if(id === 'loginModal' && window.google && googleSignInInitialized){
    const btnEl = document.getElementById('googleSignInBtn');
    if(btnEl){
      btnEl.innerHTML = ''; // clear stale iframe first
      google.accounts.id.renderButton(btnEl, {
        theme:'outline', size:'large', width:320,
        text:'continue_with', shape:'rectangular'
      });
    }
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
