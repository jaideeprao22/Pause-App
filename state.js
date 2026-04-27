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
  gender:'', occupation:'', residence:'', living_situation:'',
  device:'', self_rated_health:'', chronic_illness:'',
  physical_activity:'', prev_detox_attempt:'', followup_consent:'',
  study_field:''
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
// TOAST — defined here (state.js loads first) so all files can call it
// ============================================================
function showToast(msg, duration=3000){
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f2d5e;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:90vw;text-align:center';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

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
  if(error){ console.error('Auth error:', error); showToast('Login failed — please try again.'); return; }
  closeModal('loginModal');
}

async function handleUser(user){
  localStorage.removeItem('guestAssessWarningShown'); // BUG8 FIX: reset so warning shows for new users on shared devices
  currentUser = user;
  const avatar = document.getElementById('userAvatar');
  avatar.style.display = 'flex';
  avatar.textContent = user.email.charAt(0).toUpperCase();
  renderLoginBanner();
  renderAccountSection();

  // FIX 1: Profile is mandatory — no skip path
  const profile = localStorage.getItem('pause_profile_' + user.id)
               || localStorage.getItem('pauseProfile_' + user.id) // migrate old key
               || localStorage.getItem('pause_profile_guest'); // migrate from guest session
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
  userProfile = {}; // BUG19 FIX: clear profile so next user doesn't see stale data
  // BUG7 FIX: reset profileSelections so previous user's radio buttons don't bleed through
  profileSelections = {
    gender:'', occupation:'', residence:'', living_situation:'',
    device:'', self_rated_health:'', chronic_illness:'',
    physical_activity:'', prev_detox_attempt:'', followup_consent:'',
    study_field:''
  };
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
    occupation:         'occupationOptions',
    residence:          'residenceOptions',
    living_situation:   'livingSituationOptions',
    device:             'deviceOptions',
    self_rated_health:  'selfRatedHealthOptions',
    chronic_illness:    'chronicIllnessOptions',
    physical_activity:  'physicalActivityOptions',
    prev_detox_attempt: 'prevDetoxOptions',
    followup_consent:   'followupConsentOptions',
    study_field:        'studyFieldOptions'
  };
  const containerId = containerMap[type];
  if(containerId) document.querySelectorAll(`#${containerId} .form-option`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profileSelections[type] = value;
}

// Student branch — show/hide field of study and college name
function showStudentFields(){
  const el = document.getElementById('studentFields');
  if(el) el.style.display = 'block';
}
function hideStudentFields(){
  const el = document.getElementById('studentFields');
  if(el) el.style.display = 'none';
  profileSelections.study_field = '';
  document.querySelectorAll('#studyFieldOptions .form-option').forEach(b => b.classList.remove('selected'));
  const cg = document.getElementById('collegeNameGroup');
  if(cg) cg.style.display = 'none';
  const cn = document.getElementById('profileCollegeName');
  if(cn) cn.value = '';
}
function selectStudyField(value, btn){
  profileSelections.study_field = value;
  document.querySelectorAll('#studyFieldOptions .form-option').forEach(b => b.classList.remove('selected'));
  if(btn) btn.classList.add('selected');
  // Show college name input after a field is chosen
  const cg = document.getElementById('collegeNameGroup');
  if(cg) cg.style.display = 'block';
}

function saveProfile(){
  // Validate number inputs and selects directly from DOM
  const age = parseInt(document.getElementById('profileAge').value);
  if(!age || age < 18 || age > 100){ showToast('Please enter a valid age (18 or older).'); return; }
  if(!profileSelections.gender)           { showToast('Please select your gender.'); return; }
  if(!document.getElementById('profileEducation').value) { showToast('Please select your education level.'); return; }
  if(!profileSelections.occupation)       { showToast('Please select your occupation.'); return; }
  if(profileSelections.occupation === 'Student' && !profileSelections.study_field){ showToast('Please select your field of study.'); return; }
  if(!document.getElementById('profileIncome').value)    { showToast('Please select your income range.'); return; }
  if(!profileSelections.residence)        { showToast('Please select your area of residence.'); return; }
  if(!profileSelections.living_situation) { showToast('Please select your living situation.'); return; }
  if(!profileSelections.device)           { showToast('Please select your primary device.'); return; }
  if(!document.getElementById('profileScreentime').value){ showToast('Please select your daily screen time.'); return; }
  if(!document.getElementById('profileSleep').value)     { showToast('Please select your average sleep.'); return; }
  if(!profileSelections.self_rated_health){ showToast('Please rate your overall health.'); return; }
  if(!profileSelections.chronic_illness)  { showToast('Please answer the chronic illness question.'); return; }
  if(!profileSelections.physical_activity){ showToast('Please select your physical activity level.'); return; }
  if(!profileSelections.prev_detox_attempt){ showToast('Please answer the digital detox question.'); return; }
  if(!profileSelections.followup_consent) { showToast('Please answer the follow-up consent question.'); return; }

  userProfile = {
    age,
    gender:             profileSelections.gender,
    education:          document.getElementById('profileEducation').value,
    occupation:         profileSelections.occupation,
    study_field:        profileSelections.study_field || null,
    college_name:       document.getElementById('profileCollegeName')?.value?.trim() || null,
    income_bracket:     document.getElementById('profileIncome').value,
    country:            document.getElementById('profileCountry').value || null,
    residence_type:     profileSelections.residence,
    living_situation:   profileSelections.living_situation,
    primary_device:     profileSelections.device,
    daily_screentime:   document.getElementById('profileScreentime').value,
    avg_sleep:          document.getElementById('profileSleep').value,
    self_rated_health:  profileSelections.self_rated_health,
    chronic_illness:    profileSelections.chronic_illness,
    physical_activity:  profileSelections.physical_activity,
    prev_detox_attempt: profileSelections.prev_detox_attempt,
    referral_source:    document.getElementById('profileReferral').value || null,
    followup_consent:   profileSelections.followup_consent === 'Yes',
    terms_version:      '1.0',
    createdAt:          new Date().toISOString()
  };

  if(currentUser){
    // L3 FIX: write only the canonical key — handleUser() already migrates old pauseProfile_ key on login
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
  } else {
    localStorage.setItem('pause_profile_guest', JSON.stringify(userProfile)); // BUG5 FIX: persist for guests
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
  if(!age || age < 18 || age > 100){ showToast('Please enter a valid age between 18 and 100.'); return; }
  // Only update the 5 editable fields — all research fields are preserved from existing userProfile
  userProfile.age            = age;
  userProfile.gender         = document.getElementById('editGender').value || userProfile.gender;
  userProfile.occupation     = document.getElementById('editOccupation').value || userProfile.occupation;
  userProfile.country        = document.getElementById('editCountry').value || userProfile.country;
  userProfile.primary_device = document.getElementById('editDevice').value || userProfile.primary_device;
  userProfile.updatedAt      = new Date().toISOString();
  // BUG7 FIX: persist for both logged-in and guest users
  // L3 FIX: write only the canonical key
  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
  } else {
    localStorage.setItem('pause_profile_guest', JSON.stringify(userProfile));
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
// BUG14 FIX: Run these Supabase migrations before deploying new features
// ============================================================
// -- UrgeLog table (Feature 1)
// CREATE TABLE IF NOT EXISTS "UrgeLog" (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id),
//   disorder text, trigger text, resisted boolean,
//   logged_at timestamptz DEFAULT now()
// );
// ALTER TABLE "UrgeLog" ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own urges" ON "UrgeLog"
//   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
//
// -- WeeklyCheckin table (Feature 2)
// CREATE TABLE IF NOT EXISTS "WeeklyCheckin" (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   user_id uuid REFERENCES auth.users(id),
//   q1 text, q2 text, q3 text,
//   checked_at timestamptz DEFAULT now()
// );
// ALTER TABLE "WeeklyCheckin" ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users manage own checkins" ON "WeeklyCheckin"
//   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
// ============================================================

// ============================================================
// SAVE TO SUPABASE
// ============================================================
async function saveToSupabase(){
  if(!currentUser) return;
  if(localStorage.getItem('pause_research_withdrawn')) return; // BUG19 FIX: respect withdrawal
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
    showToast('Please answer all 3 questions before submitting.');
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
  showToast('🔬 Thank you for contributing to research!'); // BUG6 FIX: use showToast()
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

// ============================================================
// FEATURE8: Informed consent re-confirmation (3 months)
// ============================================================
function checkReConsentNeeded(){
  const accepted = localStorage.getItem('pause_terms_accepted');
  if(!accepted) return; // handled by normal flow
  try{
    const data = JSON.parse(accepted);
    const acceptedAt = new Date(data.timestamp).getTime();
    const ninetyDays = 90*24*60*60*1000;
    const lastReconfirm = localStorage.getItem('pause_terms_reconfirmed');
    const lastCheck = lastReconfirm ? new Date(JSON.parse(lastReconfirm).timestamp).getTime() : acceptedAt;
    if(Date.now() - lastCheck > ninetyDays){
      setTimeout(()=>openModal('reConsentModal'), 2000);
    }
  }catch(e){}
}

function acceptReConsent(){
  localStorage.setItem('pause_terms_reconfirmed', JSON.stringify({
    timestamp: new Date().toISOString(), version:'1.0'
  }));
  closeModal('reConsentModal'); // BUG16 FIX: close first so toast appears above, not under overlay
  showToast('Thank you for confirming — your research participation continues. 🙏');
}

function declineReConsent(){
  // User withdraws — clear research data flag, keep app usable
  localStorage.setItem('pause_research_withdrawn', JSON.stringify({timestamp:new Date().toISOString()}));
  // BUG14 FIX: reset re-consent clock so modal doesn't re-fire every session after withdrawal
  localStorage.setItem('pause_terms_reconfirmed', JSON.stringify({timestamp:new Date().toISOString(), version:'1.0'}));
  closeModal('reConsentModal'); // BUG16 FIX: close modal BEFORE showToast so toast isn't hidden under overlay
  showToast('Understood. Your data will no longer be shared for research.');
}

// ============================================================
// FEATURE1: Urge Journal
// ============================================================
const URGE_LOG_KEY = 'pause_urge_log';

function logUrge(disorderId, trigger, resisted){
  const log = JSON.parse(localStorage.getItem(URGE_LOG_KEY)||'[]');
  log.unshift({
    date: new Date().toISOString(),
    disorder: disorderId,
    trigger,
    resisted,
    id: Date.now()
  });
  if(log.length>200) log.splice(200);
  localStorage.setItem(URGE_LOG_KEY, JSON.stringify(log));
  // Save to Supabase if logged in
  if(currentUser){
    sb.from('UrgeLog').insert({
      user_id:currentUser.id, disorder:disorderId,
      trigger, resisted, logged_at:new Date().toISOString()
    }).then(()=>{}).catch(()=>{});
  }
  renderUrgeJournal();
  closeModal('urgeLogModal');
  showToast(resisted?'✅ Well done resisting that urge! 💪':'📝 Urge logged — awareness is the first step.');
}

function renderUrgeJournal(){
  const el=document.getElementById('urgeJournalList');
  if(!el) return;
  const log=JSON.parse(localStorage.getItem(URGE_LOG_KEY)||'[]');
  if(!log.length){
    el.innerHTML='<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px">No urges logged yet. Use the button above when you feel the urge to scroll, search, or game.</div>';
    return;
  }
  const TRIGGER_ICONS={'Boredom':'😴','Stress':'😰','Habit':'🔁','Procrastinating':'📚','Low mood':'😔','Social pressure':'👥','Other':'💭'};
  el.innerHTML=log.slice(0,30).map(entry=>{
    const d=DISORDERS.find(x=>x.id===entry.disorder);
    const tIcon=TRIGGER_ICONS[entry.trigger]||'💭';
    const date=new Date(entry.date);
    const timeStr=date.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' '+date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:10px;background:${d?d.bg:'var(--bg)'};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${d?d.icon:'⚡'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text)">${d?d.name:'Unknown'} — ${tIcon} ${entry.trigger}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${timeStr}</div>
      </div>
      <div style="font-size:18px">${entry.resisted?'✅':'📝'}</div>
    </div>`;
  }).join('');

  // Stats
  const total=log.length, resisted=log.filter(e=>e.resisted).length;
  const statsEl=document.getElementById('urgeJournalStats');
  if(statsEl){
    statsEl.innerHTML=`<div style="display:flex;gap:16px;padding:12px 0;margin-bottom:4px">
      <div style="text-align:center;flex:1"><div style="font-size:22px;font-weight:800;color:var(--accent)">${total}</div><div style="font-size:10px;color:var(--muted)">Total Logged</div></div>
      <div style="text-align:center;flex:1"><div style="font-size:22px;font-weight:800;color:#2ecc71">${resisted}</div><div style="font-size:10px;color:var(--muted)">Resisted</div></div>
      <div style="text-align:center;flex:1"><div style="font-size:22px;font-weight:800;color:var(--accent)">${total?Math.round((resisted/total)*100):0}%</div><div style="font-size:10px;color:var(--muted)">Resistance Rate</div></div>
    </div>`;
  }
}

function openUrgeLogModal(){
  renderUrgeJournal(); // BUG15 FIX: refresh stats before modal opens so data is current
  // Pre-fill disorder select with top disorder — BUG17 FIX: read AppGrades not in-memory disorderScores
  const grades = window.AppGrades ? window.AppGrades.load() : {};
  const topId = Object.keys(grades).length > 0
    ? Object.entries(grades).sort((a,b) => {
        const o = {severe:3,moderate:2,mild:1,'low risk':0,minimal:0};
        return (o[b[1]]||0) - (o[a[1]]||0);
      })[0][0]
    : (typeof getTopDisorder==='function' ? getTopDisorder() : 'cyberchondria');
  const sel=document.getElementById('urgeDisorderSelect');
  if(sel && topId !== 'default') sel.value=topId;
  openModal('urgeLogModal');
}

function submitUrgeLog(){
  const disorder=document.getElementById('urgeDisorderSelect')?.value;
  const trigger=document.querySelector('#urgeTriggerOptions .form-option.selected')?.dataset.value;
  const resisted=document.querySelector('#urgeResistedOptions .form-option.selected')?.dataset.value;
  if(!disorder||!trigger||resisted===undefined){
    showToast('Please fill in all fields before logging.'); return;
  }
  logUrge(disorder, trigger, resisted==='yes');
}

// dark mode removed
