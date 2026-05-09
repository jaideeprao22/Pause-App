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
  study_field:'', profession_role:'', work_mode:''
};
let postAssessDisorderId = null; // set by renderPostAssessmentPrompt, read by savePostAssessmentData
let notifPermission = false;

// ============================================================
// SAFE LOCALSTORAGE PARSE
// Wraps JSON.parse(localStorage.getItem(key)) with try/catch so a corrupt
// or missing entry returns `fallback` instead of throwing. Defined here
// (state.js loads right after data.js) so every later file can use it.
// ============================================================
function safeJsonParse(key, fallback){
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch(e){
    return fallback;
  }
}

// ============================================================
// APP-OPEN STREAK
// Counts consecutive days the user has opened the app, using LOCAL device
// time (not UTC). Idempotent within a single calendar day, so it's safe
// to call multiple times per session — only the first call per day writes.
// Wrapped in an outer try/catch so a corrupted entry, storage failure, or
// any Date API quirk falls through to "Day 1" rather than blocking init.
// ============================================================
function bumpAppOpenStreak(){
  try {
    // Local YYYY-MM-DD via getFullYear/getMonth/getDate — DST-safe because
    // we never compare timestamps across midnight, only calendar strings.
    const ymd = d => {
      const y  = d.getFullYear();
      const m  = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + dd;
    };
    // BUG-033 FIX: compute "yesterday" via calendar-day arithmetic instead of
    // subtracting 86_400_000 ms. On DST forward days the millisecond version
    // can land on the day before yesterday at hour 23, occasionally formatting
    // to the wrong YMD and breaking streak continuity.
    const _today       = new Date();
    const todayYMD     = ymd(_today);
    const yesterdayYMD = ymd(new Date(_today.getFullYear(), _today.getMonth(), _today.getDate() - 1));

    // safeJsonParse may return null or a non-object if the entry was tampered
    // with — normalise to the default shape before reading fields.
    const raw = safeJsonParse('appOpenStreak', null);
    const stored = (raw && typeof raw === 'object') ? raw : { count: 0, lastOpenDate: null };

    if(stored.lastOpenDate === todayYMD){
      // Already counted today — no write, return existing count
      return stored.count || 0;
    }

    const isConsecutive = stored.lastOpenDate === yesterdayYMD;
    const next = {
      count:        isConsecutive ? ((stored.count || 0) + 1) : 1,
      lastOpenDate: todayYMD
    };

    try { localStorage.setItem('appOpenStreak', JSON.stringify(next)); }
    catch(e){ /* quota / disabled — keep in-memory streak for this session */ }
    return next.count;
  } catch(e){
    // Catastrophic failure (Date API broken, etc.) — show Day 1, never block load
    return 1;
  }
}

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
  if(avatar){
    avatar.style.display = 'flex';
    avatar.textContent = user.email.charAt(0).toUpperCase();
  }
  renderLoginBanner();
  renderAccountSection();

  // FIX 1: Profile is mandatory — no skip path
  const profile = localStorage.getItem('pause_profile_' + user.id)
               || localStorage.getItem('pauseProfile_' + user.id) // migrate old key
               || localStorage.getItem('pause_profile_guest'); // migrate from guest session
  if(profile){
    try { userProfile = JSON.parse(profile); } catch(e){ userProfile = {}; }
    // Migrate old key to new if needed
    localStorage.setItem('pause_profile_' + user.id, JSON.stringify(userProfile));
  }
  // FIX B: pull every per-user data type from Supabase, then re-render.
  // After this resolves, if there's still no profile (neither local nor remote),
  // open the profile modal so the user fills it in.
  loadAllUserDataFromSupabase(user.id).finally(() => {
    if(!userProfile || !userProfile.age){
      setTimeout(() => openModal('profileModal'), 800);
    }
  });
}

function handleLogout(){
  currentUser = null;
  userProfile = {}; // BUG19 FIX: clear profile so next user doesn't see stale data
  // BUG7 FIX: reset profileSelections so previous user's radio buttons don't bleed through
  profileSelections = {
    gender:'', occupation:'', residence:'', living_situation:'',
    device:'', self_rated_health:'', chronic_illness:'',
    physical_activity:'', prev_detox_attempt:'', followup_consent:'',
    study_field:'', profession_role:'', work_mode:''
  };
  const _avatar = document.getElementById('userAvatar');
  if(_avatar) _avatar.style.display = 'none';
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
    followup_consent:   'followupConsentOptions'
  };
  const containerId = containerMap[type];
  if(containerId) document.querySelectorAll(`#${containerId} .form-option`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profileSelections[type] = value;
}

// ============================================================
// OCCUPATION BRANCHES
// ============================================================
const _allBranches = ['student','healthcare','it','govt','other'];

function showOccupationBranch(type){
  _allBranches.forEach(b => {
    const el = document.getElementById('branch-' + b);
    if(el) el.style.display = 'none';
  });
  profileSelections.study_field    = '';
  profileSelections.profession_role = '';
  profileSelections.work_mode      = '';
  ['studyFieldOptions','healthcareRoleOptions','itRoleOptions','workModeOptions','govtRoleOptions','otherProfessionOptions']
    .forEach(id => {
      const el = document.getElementById(id);
      if(el) el.querySelectorAll('.form-option').forEach(b => b.classList.remove('selected'));
    });
  // BUG-016 FIX: clear ALL occupation-conditional text inputs (not just two)
  // so switching occupations doesn't leak stale values from a previous branch.
  ['profileCollegeName','profileWorkplace','profileHcDepartment',
   'profileItCompany','profileItDepartment',
   'profileGovtOrg','profileDepartment','profileOtherOrg'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  if(type !== 'none'){
    const el = document.getElementById('branch-' + type);
    if(el) el.style.display = 'block';
  }
}

function selectProfessionDetail(key, value, btn){
  profileSelections[key] = value;
  if(btn && btn.parentElement){
    btn.parentElement.querySelectorAll('.form-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
}

// FIX A: highlight + scroll the first missing field, then toast its name.
// `target` is an element ID (input/select) OR a form-options container ID.
function _highlightProfileField(targetId, friendlyName){
  const el = document.getElementById(targetId);
  if(el){
    try { el.scrollIntoView({behavior:'smooth', block:'center'}); } catch(e){}
    const prevOutline   = el.style.outline;
    const prevBoxShadow = el.style.boxShadow;
    el.style.outline   = '2px solid #c0392b';
    el.style.boxShadow = '0 0 0 4px rgba(192,57,43,0.18)';
    el.style.borderRadius = el.style.borderRadius || '12px';
    setTimeout(() => { el.style.outline = prevOutline; el.style.boxShadow = prevBoxShadow; }, 2800);
  }
  showToast('Please fill: ' + friendlyName);
}

function saveProfile(){
  // ── FIX A: every required field validated; first miss scrolls + highlights + toasts ──
  const ageRaw = document.getElementById('profileAge').value;
  const age    = parseInt(ageRaw, 10);
  if(!ageRaw || isNaN(age) || age < 13 || age > 100){
    _highlightProfileField('profileAge', 'Age (13–100)');
    return;
  }
  if(!profileSelections.gender){            _highlightProfileField('genderOptions', 'Gender'); return; }
  if(!document.getElementById('profileEducation').value){
    _highlightProfileField('profileEducation', 'Education'); return;
  }
  if(!profileSelections.occupation){        _highlightProfileField('occupationOptions', 'Occupation'); return; }

  // Occupation-conditional fields (NEW required text inputs)
  if(profileSelections.occupation === 'Student'){
    if(!profileSelections.study_field){     _highlightProfileField('studyFieldOptions', 'Field of Study'); return; }
    const college = document.getElementById('profileCollegeName')?.value?.trim();
    if(!college){                           _highlightProfileField('profileCollegeName', 'College / Institution name'); return; }
  }
  if(profileSelections.occupation === 'Healthcare'){
    if(!profileSelections.profession_role){ _highlightProfileField('healthcareRoleOptions', 'Healthcare role'); return; }
    const wp = document.getElementById('profileWorkplace')?.value?.trim();
    if(!wp){                                _highlightProfileField('profileWorkplace', 'Hospital / Organisation'); return; }
    const hcDept = document.getElementById('profileHcDepartment')?.value?.trim();
    if(!hcDept){                            _highlightProfileField('profileHcDepartment', 'Department / Specialty'); return; }
  }
  if(profileSelections.occupation === 'IT Professional'){
    if(!profileSelections.profession_role){ _highlightProfileField('itRoleOptions', 'IT role'); return; }
    if(!profileSelections.work_mode){       _highlightProfileField('workModeOptions', 'Work mode'); return; }
    const co = document.getElementById('profileItCompany')?.value?.trim();
    if(!co){                                _highlightProfileField('profileItCompany', 'Company / Organisation'); return; }
    const itDept = document.getElementById('profileItDepartment')?.value?.trim();
    if(!itDept){                            _highlightProfileField('profileItDepartment', 'Department / Team'); return; }
  }
  if(profileSelections.occupation === 'Government / Public Sector'){
    if(!profileSelections.profession_role){ _highlightProfileField('govtRoleOptions', 'Government role'); return; }
    const govtOrg = document.getElementById('profileGovtOrg')?.value?.trim();
    if(!govtOrg){                           _highlightProfileField('profileGovtOrg', 'Organisation / Office'); return; }
    const govtDept = document.getElementById('profileDepartment')?.value?.trim();
    if(!govtDept){                          _highlightProfileField('profileDepartment', 'Department'); return; }
  }
  if(profileSelections.occupation === 'Other Professional'){
    if(!profileSelections.profession_role){ _highlightProfileField('otherProfessionOptions', 'Professional field'); return; }
    const otherOrg = document.getElementById('profileOtherOrg')?.value?.trim();
    if(!otherOrg){                          _highlightProfileField('profileOtherOrg', 'Organisation / Workplace'); return; }
  }

  if(!document.getElementById('profileCountry').value){ _highlightProfileField('profileCountry', 'Country'); return; }
  if(!profileSelections.residence){         _highlightProfileField('residenceOptions', 'Area of residence'); return; }
  if(!profileSelections.living_situation){  _highlightProfileField('livingSituationOptions', 'Living situation'); return; }
  if(!profileSelections.device){            _highlightProfileField('deviceOptions', 'Primary device'); return; }
  if(!document.getElementById('profileScreentime').value){ _highlightProfileField('profileScreentime', 'Daily screen time'); return; }
  if(!document.getElementById('profileSleep').value){      _highlightProfileField('profileSleep',      'Average sleep');     return; }
  if(!profileSelections.self_rated_health){ _highlightProfileField('selfRatedHealthOptions', 'Overall health rating'); return; }
  if(!profileSelections.chronic_illness){   _highlightProfileField('chronicIllnessOptions',  'Chronic illness question'); return; }
  if(!profileSelections.physical_activity){ _highlightProfileField('physicalActivityOptions','Physical activity level');  return; }
  if(!profileSelections.prev_detox_attempt){_highlightProfileField('prevDetoxOptions',       'Digital detox question');   return; }
  if(!profileSelections.followup_consent){  _highlightProfileField('followupConsentOptions', 'Follow-up consent');        return; }
  // profileReferral is intentionally optional — no validation

  userProfile = {
    age,
    gender:             profileSelections.gender,
    education:          document.getElementById('profileEducation').value,
    occupation:         profileSelections.occupation,
    study_field:        profileSelections.study_field    || null,
    college_name:       document.getElementById('profileCollegeName')?.value?.trim() || null,
    profession_role:    profileSelections.profession_role || null,
    work_mode:          profileSelections.work_mode       || null,
    workplace:          document.getElementById('profileWorkplace')?.value?.trim()    || null,
    hc_department:      document.getElementById('profileHcDepartment')?.value?.trim() || null,
    it_company:         document.getElementById('profileItCompany')?.value?.trim()    || null,
    it_department:      document.getElementById('profileItDepartment')?.value?.trim() || null,
    govt_org:           document.getElementById('profileGovtOrg')?.value?.trim()      || null,
    govt_department:    document.getElementById('profileDepartment')?.value?.trim()   || null,
    other_org:          document.getElementById('profileOtherOrg')?.value?.trim()     || null,
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
    syncProfileToSupabase(); // FIX B: was previously only called from saveEditProfile
  } else {
    localStorage.setItem('pause_profile_guest', JSON.stringify(userProfile)); // BUG5 FIX: persist for guests
  }
  closeModal('profileModal');
}

// Edit-modal occupation-branch parity — mirrors showOccupationBranch in the
// signup modal but operates on the edit-* IDs. Hides every branch and shows
// only the one matching the currently selected occupation.
const _editAllBranches = ['student','healthcare','it','govt','other'];
function showEditOccupationBranch(occupationValue){
  // Map the occupation <option value> to its branch suffix
  const map = {
    'Student':                    'student',
    'Healthcare':                 'healthcare',
    'IT Professional':            'it',
    'Government / Public Sector': 'govt',
    'Other Professional':         'other'
  };
  const target = map[occupationValue] || null; // 'Not Working' or unknown → no branch
  _editAllBranches.forEach(b => {
    const el = document.getElementById('edit-branch-' + b);
    if(el) el.style.display = (b === target) ? 'block' : 'none';
  });
}

// FIX 6: Edit profile — opened from userModal "Edit My Details" button
function openEditProfile(){
  closeModal('userModal');
  if(!userProfile || !userProfile.age){ openModal('profileModal'); return; }
  const sv = function(id, val){
    const el = document.getElementById(id);
    if(!el || val === undefined || val === null) return;
    el.value = val;
  };
  sv('editAge',           userProfile.age);
  sv('editGender',        userProfile.gender);
  sv('editOccupation',    userProfile.occupation);
  sv('editCountry',       userProfile.country);
  sv('editDevice',        userProfile.primary_device);
  sv('editScreentime',    userProfile.daily_screentime);
  sv('editSleep',         userProfile.avg_sleep);
  sv('editActivity',      userProfile.physical_activity);
  sv('editHealth',        userProfile.self_rated_health);
  sv('editChronic',       userProfile.chronic_illness);
  // Pre-fill branch fields so users don't have to retype what we already have
  sv('editStudyField',    userProfile.study_field);
  sv('editCollegeName',   userProfile.college_name);
  sv('editHcRole',        userProfile.occupation === 'Healthcare'                 ? userProfile.profession_role : '');
  sv('editItRole',        userProfile.occupation === 'IT Professional'            ? userProfile.profession_role : '');
  sv('editGovtRole',      userProfile.occupation === 'Government / Public Sector' ? userProfile.profession_role : '');
  sv('editOtherRole',     userProfile.occupation === 'Other Professional'         ? userProfile.profession_role : '');
  sv('editWorkMode',      userProfile.work_mode);
  sv('editWorkplace',     userProfile.workplace);
  sv('editHcDepartment',  userProfile.hc_department);
  sv('editItCompany',     userProfile.it_company);
  sv('editItDepartment',  userProfile.it_department);
  sv('editGovtOrg',       userProfile.govt_org);
  sv('editGovtDepartment',userProfile.govt_department);
  sv('editOtherOrg',      userProfile.other_org);
  showEditOccupationBranch(userProfile.occupation);
  openModal('editProfileModal');
}

function saveEditProfile(){
  const _highlightEdit = (id, name) => _highlightProfileField(id, name);
  const _val = id => (document.getElementById(id)?.value || '').trim();

  // --- Common validation ---
  const ageRaw = document.getElementById('editAge').value;
  const age    = parseInt(ageRaw, 10);
  if(!ageRaw || isNaN(age) || age < 13 || age > 100){ _highlightEdit('editAge', 'Age (13–100)'); return; }
  if(!_val('editGender')){     _highlightEdit('editGender',     'Gender');                return; }
  const occupation = _val('editOccupation');
  if(!occupation){             _highlightEdit('editOccupation', 'Occupation');            return; }
  if(!_val('editDevice')){     _highlightEdit('editDevice',     'Primary device');        return; }
  if(!_val('editScreentime')){ _highlightEdit('editScreentime', 'Daily screen time');     return; }
  if(!_val('editSleep')){      _highlightEdit('editSleep',      'Average sleep');         return; }
  if(!_val('editActivity')){   _highlightEdit('editActivity',   'Physical activity level'); return; }
  if(!_val('editHealth')){     _highlightEdit('editHealth',     'Overall health rating'); return; }
  if(!_val('editChronic')){    _highlightEdit('editChronic',    'Chronic illness question'); return; }

  // --- Occupation-conditional validation (only validates the visible branch) ---
  if(occupation === 'Student'){
    if(!_val('editStudyField'))   { _highlightEdit('editStudyField',   'Field of Study');                return; }
    if(!_val('editCollegeName'))  { _highlightEdit('editCollegeName',  'College / Institution name');    return; }
  } else if(occupation === 'Healthcare'){
    if(!_val('editHcRole'))       { _highlightEdit('editHcRole',       'Healthcare role');               return; }
    if(!_val('editWorkplace'))    { _highlightEdit('editWorkplace',    'Hospital / Organisation');       return; }
    if(!_val('editHcDepartment')) { _highlightEdit('editHcDepartment', 'Department / Specialty');        return; }
  } else if(occupation === 'IT Professional'){
    if(!_val('editItRole'))       { _highlightEdit('editItRole',       'IT role');                       return; }
    if(!_val('editWorkMode'))     { _highlightEdit('editWorkMode',     'Work mode');                     return; }
    if(!_val('editItCompany'))    { _highlightEdit('editItCompany',    'Company / Organisation');        return; }
    if(!_val('editItDepartment')) { _highlightEdit('editItDepartment', 'Department / Team');             return; }
  } else if(occupation === 'Government / Public Sector'){
    if(!_val('editGovtRole'))      { _highlightEdit('editGovtRole',       'Government role');             return; }
    if(!_val('editGovtOrg'))       { _highlightEdit('editGovtOrg',        'Organisation / Office');       return; }
    if(!_val('editGovtDepartment')){ _highlightEdit('editGovtDepartment', 'Department');                  return; }
  } else if(occupation === 'Other Professional'){
    if(!_val('editOtherRole'))    { _highlightEdit('editOtherRole', 'Professional field');            return; }
    if(!_val('editOtherOrg'))     { _highlightEdit('editOtherOrg',  'Organisation / Workplace');      return; }
  }
  // 'Not Working' or any unmapped occupation: no extra fields to validate.

  // --- Apply common updates ---
  userProfile.age                = age;
  userProfile.gender             = _val('editGender');
  userProfile.occupation         = occupation;
  userProfile.country            = _val('editCountry') || userProfile.country;
  userProfile.primary_device     = _val('editDevice');
  userProfile.daily_screentime   = _val('editScreentime');
  userProfile.avg_sleep          = _val('editSleep');
  userProfile.physical_activity  = _val('editActivity');
  userProfile.self_rated_health  = _val('editHealth');
  userProfile.chronic_illness    = _val('editChronic');

  // --- Apply occupation-conditional updates and CLEAR the others so stale
  // values from a prior occupation don't leak into the saved profile ---
  userProfile.study_field     = (occupation === 'Student')                    ? (_val('editStudyField')    || null) : null;
  userProfile.college_name    = (occupation === 'Student')                    ? (_val('editCollegeName')   || null) : null;
  userProfile.workplace       = (occupation === 'Healthcare')                 ? (_val('editWorkplace')     || null) : null;
  userProfile.hc_department   = (occupation === 'Healthcare')                 ? (_val('editHcDepartment')  || null) : null;
  userProfile.work_mode       = (occupation === 'IT Professional')            ? (_val('editWorkMode')      || null) : null;
  userProfile.it_company      = (occupation === 'IT Professional')            ? (_val('editItCompany')     || null) : null;
  userProfile.it_department   = (occupation === 'IT Professional')            ? (_val('editItDepartment')  || null) : null;
  userProfile.govt_org        = (occupation === 'Government / Public Sector') ? (_val('editGovtOrg')       || null) : null;
  userProfile.govt_department = (occupation === 'Government / Public Sector') ? (_val('editGovtDepartment')|| null) : null;
  userProfile.other_org       = (occupation === 'Other Professional')         ? (_val('editOtherOrg')      || null) : null;
  userProfile.profession_role = (
    occupation === 'Healthcare'                 ? _val('editHcRole')    :
    occupation === 'IT Professional'            ? _val('editItRole')    :
    occupation === 'Government / Public Sector' ? _val('editGovtRole')  :
    occupation === 'Other Professional'         ? _val('editOtherRole') : null
  ) || null;

  userProfile.updatedAt = new Date().toISOString();

  // --- Persist locally ---
  if(currentUser){
    localStorage.setItem('pause_profile_' + currentUser.id, JSON.stringify(userProfile));
  } else {
    localStorage.setItem('pause_profile_guest', JSON.stringify(userProfile));
  }

  // --- Sync to Supabase (logged-in users only) ---
  syncProfileToSupabase();

  closeModal('editProfileModal');
  showToast('✅ Profile updated!');
  setTimeout(() => showUserModal(), 300);
}

// ============================================================
// PROFILE SYNC TO SUPABASE
// Syncs edited profile fields independently of assessment saves.
// Requires a 'Profiles' table in Supabase — see migration note below.
//
// SQL to run once in Supabase SQL Editor:
//   CREATE TABLE IF NOT EXISTS "Profiles" (
//     user_id uuid PRIMARY KEY REFERENCES auth.users(id),
//     age int, gender text, occupation text, country text,
//     primary_device text, daily_screentime text,
//     avg_sleep text, self_rated_health text,
//     chronic_illness text, physical_activity text,
//     updated_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE "Profiles" ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Users manage own profile" ON "Profiles"
//     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
// ============================================================
async function syncProfileToSupabase(){
  if(!currentUser) return;
  if(localStorage.getItem('pause_research_withdrawn')) return;
  // BUG-010 FIX: don't create an empty Profiles row if the user hasn't filled
  // the profile form yet. Age is the cheapest required field — its absence
  // means userProfile is uninitialised. Sync runs again after saveProfile/saveEditProfile.
  if(!userProfile || !userProfile.age) return;
  try {
    const { error } = await sb.from('Profiles').upsert({
      user_id:            currentUser.id,
      age:                userProfile.age                || null,
      gender:             userProfile.gender             || null,
      education:          userProfile.education          || null,
      occupation:         userProfile.occupation         || null,
      study_field:        userProfile.study_field        || null,
      college_name:       userProfile.college_name       || null,
      profession_role:    userProfile.profession_role    || null,
      work_mode:          userProfile.work_mode          || null,
      workplace:          userProfile.workplace          || null,
      hc_department:      userProfile.hc_department      || null,
      it_company:         userProfile.it_company         || null,
      it_department:      userProfile.it_department      || null,
      govt_org:           userProfile.govt_org           || null,
      govt_department:    userProfile.govt_department    || null,
      other_org:          userProfile.other_org          || null,
      country:            userProfile.country            || null,
      residence_type:     userProfile.residence_type     || null,
      living_situation:   userProfile.living_situation   || null,
      primary_device:     userProfile.primary_device     || null,
      daily_screentime:   userProfile.daily_screentime   || null,
      avg_sleep:          userProfile.avg_sleep          || null,
      self_rated_health:  userProfile.self_rated_health  || null,
      chronic_illness:    userProfile.chronic_illness    || null,
      physical_activity:  userProfile.physical_activity  || null,
      prev_detox_attempt: userProfile.prev_detox_attempt || null,
      referral_source:    userProfile.referral_source    || null,
      followup_consent:   typeof userProfile.followup_consent === 'boolean' ? userProfile.followup_consent : null,
      terms_version:      userProfile.terms_version      || '1.0',
      updated_at:         new Date().toISOString()
    }, { onConflict: 'user_id' });
    if(error){ console.warn('Profile sync error:', error); _showSyncErrorToast(); }
  } catch(e){ console.warn('Profile sync error:', e); _showSyncErrorToast(); }
}

// ============================================================
// FIX B: SYNC HELPERS
// Toast user once per session if any cloud sync fails. Prevents toast-spam
// when offline / RLS misconfigured / network flaky, while still surfacing
// the issue prominently the first time it happens.
// ============================================================
let _syncErrorToastShown = false;
function _showSyncErrorToast(){
  if(_syncErrorToastShown) return;
  _syncErrorToastShown = true;
  showToast("Couldn't sync to cloud — your data is saved locally only.", 4500);
}

async function saveMoodToSupabase(date, value){
  if(!currentUser) return;
  if(localStorage.getItem('pause_research_withdrawn')) return;
  try {
    const { error } = await sb.from('MoodLog').upsert({
      user_id: currentUser.id, date, value, recorded_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' });
    if(error){ console.warn('Mood sync error:', error); _showSyncErrorToast(); }
  } catch(e){ console.warn('Mood sync error:', e); _showSyncErrorToast(); }
}

async function deleteMoodFromSupabase(date){
  if(!currentUser) return;
  try {
    const { error } = await sb.from('MoodLog').delete().eq('user_id', currentUser.id).eq('date', date);
    if(error){ console.warn('Mood delete error:', error); _showSyncErrorToast(); }
  } catch(e){ console.warn('Mood delete error:', e); _showSyncErrorToast(); }
}

async function saveScreenTimeToSupabase(date, hours){
  if(!currentUser) return;
  if(localStorage.getItem('pause_research_withdrawn')) return;
  try {
    const { error } = await sb.from('ScreenTime').upsert({
      user_id: currentUser.id, date, hours, recorded_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' });
    if(error){ console.warn('ScreenTime sync error:', error); _showSyncErrorToast(); }
  } catch(e){ console.warn('ScreenTime sync error:', e); _showSyncErrorToast(); }
}

async function saveChallengeStateToSupabase(){
  if(!currentUser) return;
  if(localStorage.getItem('pause_research_withdrawn')) return;
  try {
    const ws = parseInt(localStorage.getItem('challengeWeekStart')   || '0', 10);
    const wn = parseInt(localStorage.getItem('currentWeekNum')       || '1', 10);
    const wc = parseInt(localStorage.getItem('challengeWeeksCompleted')||'0', 10);
    const ms = parseInt(localStorage.getItem('maxChallengeStreak')   || '0', 10);
    const pack      = safeJsonParse('currentChallengePack', null);
    const completed = safeJsonParse('pauseChallenge', []);
    const { error } = await sb.from('ChallengeState').upsert({
      user_id:           currentUser.id,
      week_start:        ws || null,
      current_week_num:  wn,
      weeks_completed:   wc,
      max_streak:        ms,
      current_pack:      pack,
      completed_indices: completed,
      updated_at:        new Date().toISOString()
    }, { onConflict: 'user_id' });
    if(error){ console.warn('Challenge sync error:', error); _showSyncErrorToast(); }
  } catch(e){ console.warn('Challenge sync error:', e); _showSyncErrorToast(); }
}

// ============================================================
// FIX B: ON-LOGIN FETCH
// Pulls every per-user data type we sync to Supabase, writes it back into
// localStorage + in-memory state, and re-renders dependent views. Idempotent
// — safe to call multiple times. Falls through silently on any per-table
// failure so a single missing table doesn't block the rest.
//
// TODO v1.1: handle offline-then-login merge by timestamp.
// Right now this is server-wins: any local-only data created BEFORE the user
// signs in (e.g. journaled offline) is overwritten by what's on the server.
// The right fix is to merge the two by per-row timestamp / created_at, keeping
// whichever side is newer. Deferred to v1.1 to keep this change focused.
// ============================================================
function _profileFromSupabaseRow(row){
  return {
    age:                row.age,
    gender:             row.gender,
    education:          row.education,
    occupation:         row.occupation,
    study_field:        row.study_field,
    college_name:       row.college_name,
    profession_role:    row.profession_role,
    work_mode:          row.work_mode,
    workplace:          row.workplace,
    hc_department:      row.hc_department,
    it_company:         row.it_company,
    it_department:      row.it_department,
    govt_org:           row.govt_org,
    govt_department:    row.govt_department,
    other_org:          row.other_org,
    country:            row.country,
    residence_type:     row.residence_type,
    living_situation:   row.living_situation,
    primary_device:     row.primary_device,
    daily_screentime:   row.daily_screentime,
    avg_sleep:          row.avg_sleep,
    self_rated_health:  row.self_rated_health,
    chronic_illness:    row.chronic_illness,
    physical_activity:  row.physical_activity,
    prev_detox_attempt: row.prev_detox_attempt,
    referral_source:    row.referral_source,
    followup_consent:   row.followup_consent,
    terms_version:      row.terms_version || '1.0',
    createdAt:          row.created_at  || new Date().toISOString(),
    updatedAt:          row.updated_at  || null
  };
}

// PERSONALIZATION-V2: defensive validator for incoming Supabase packs.
// Any pack that claims metaVersion 2 must have a 6-element disorderOrder
// array, a string startedAt, and (if present) a string impactModule.
// Legacy packs with no metaVersion field are accepted unconditionally
// (the renderer handles them via legacy code path).
function _isValidPack(p){
  if(!p || typeof p !== 'object') return false;
  if(!Array.isArray(p.days)) return false;
  if(p.metaVersion === 2){
    if(!Array.isArray(p.disorderOrder) || p.disorderOrder.length !== 6) return false;
    if(p.impactModule != null && typeof p.impactModule !== 'string') return false;
    if(typeof p.startedAt !== 'string') return false;
  }
  return true;
}

async function loadAllUserDataFromSupabase(userId){
  if(!userId) return;

  const results = await Promise.allSettled([
    sb.from('Profiles').select('*').eq('user_id', userId).maybeSingle(),
    sb.from('Assessments').select('*').eq('user_id', userId).order('created_at', { ascending:false }).limit(20),
    sb.from('UrgeLog').select('*').eq('user_id', userId).order('logged_at', { ascending:false }).limit(200),
    sb.from('logbook').select('*').eq('user_id', userId).order('created_at', { ascending:false }).limit(200),
    sb.from('WeeklyCheckin').select('*').eq('user_id', userId).order('checked_at', { ascending:false }).limit(1),
    sb.from('MoodLog').select('*').eq('user_id', userId).order('date', { ascending:false }).limit(60),
    sb.from('ScreenTime').select('*').eq('user_id', userId).order('date', { ascending:false }).limit(30),
    sb.from('ChallengeState').select('*').eq('user_id', userId).maybeSingle()
  ]);
  const [profileR, assessR, urgeR, logR, weeklyR, moodR, stR, chR] = results;

  // ---- Profile: only adopt remote if local missing/empty (local is most up-to-date if present) ----
  try {
    if(profileR.status === 'fulfilled' && profileR.value && !profileR.value.error && profileR.value.data){
      const localRaw = localStorage.getItem('pause_profile_' + userId);
      const localEmpty = !localRaw || (() => { try { const p = JSON.parse(localRaw); return !p || !p.age; } catch(e){ return true; } })();
      if(localEmpty){
        userProfile = _profileFromSupabaseRow(profileR.value.data);
        localStorage.setItem('pause_profile_' + userId, JSON.stringify(userProfile));
      }
    } else if(profileR.status === 'fulfilled' && profileR.value && profileR.value.error){
      console.warn('Profile fetch error:', profileR.value.error); _showSyncErrorToast();
    }
  } catch(e){ console.warn('Profile fetch error:', e); _showSyncErrorToast(); }

  // ---- Assessments → rebuild pauseV2History + latest snapshot ----
  try {
    if(assessR.status === 'fulfilled' && assessR.value && !assessR.value.error && Array.isArray(assessR.value.data) && assessR.value.data.length){
      const rows = assessR.value.data;
      const history = rows.map(r => ({
        dws:      r.dws_score,
        disorder: r.disorder_scores || {},
        impact:   r.impact_scores   || {},
        date:     new Date(r.created_at || Date.now()).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      }));
      localStorage.setItem('pauseV2History', JSON.stringify(history));
      const latest = history[0];
      if(latest){
        if(typeof disorderScores !== 'undefined') disorderScores = latest.disorder || {};
        if(typeof impactScores   !== 'undefined') impactScores   = latest.impact   || {};
        if(typeof dwsScore       !== 'undefined') dwsScore       = (latest.dws ?? null);
        if(typeof saveScoresLocal === 'function') saveScoresLocal();
      }
    } else if(assessR.status === 'fulfilled' && assessR.value && assessR.value.error){
      console.warn('Assessments fetch error:', assessR.value.error); _showSyncErrorToast();
    }
  } catch(e){ console.warn('Assessments fetch error:', e); _showSyncErrorToast(); }

  // ---- UrgeLog ----
  // BUG-002 FIX: require remote array to be non-empty before overwriting local.
  // Stops a fresh-login wipeout of locally-created entries when the remote
  // table has no data yet for this user. Full timestamp-merge is still TODO v1.1.
  try {
    if(urgeR.status === 'fulfilled' && urgeR.value && !urgeR.value.error && Array.isArray(urgeR.value.data) && urgeR.value.data.length){
      const log = urgeR.value.data.map(r => ({
        date: r.logged_at || new Date().toISOString(),
        disorder: r.disorder, trigger: r.trigger, resisted: !!r.resisted,
        id: r.id || Date.now()
      }));
      localStorage.setItem(URGE_LOG_KEY, JSON.stringify(log));
    }
  } catch(e){ console.warn('UrgeLog fetch error:', e); }

  // ---- Logbook ----
  try {
    // BUG-002 FIX: skip overwrite when remote is empty (preserve local entries).
    if(logR.status === 'fulfilled' && logR.value && !logR.value.error && Array.isArray(logR.value.data) && logR.value.data.length){
      const entries = logR.value.data.map(r => ({
        id:        String(r.id),
        date:      r.date,
        promptIdx: 0,
        prompt:    r.prompt || '',
        text:      r.text   || '',
        createdAt: r.created_at
      }));
      localStorage.setItem('pauseLogbook', JSON.stringify(entries));
    }
  } catch(e){ console.warn('Logbook fetch error:', e); }

  // ---- WeeklyCheckin (latest only) ----
  try {
    if(weeklyR.status === 'fulfilled' && weeklyR.value && !weeklyR.value.error && Array.isArray(weeklyR.value.data) && weeklyR.value.data.length){
      const r = weeklyR.value.data[0];
      localStorage.setItem('pause_weekly_checkin', JSON.stringify({
        lastShown: r.checked_at,
        responses: { q1: r.q1, q2: r.q2, q3: r.q3 }
      }));
    }
  } catch(e){ console.warn('WeeklyCheckin fetch error:', e); }

  // ---- MoodLog ----
  try {
    // BUG-002 FIX: skip overwrite when remote is empty (preserve local entries).
    if(moodR.status === 'fulfilled' && moodR.value && !moodR.value.error && Array.isArray(moodR.value.data) && moodR.value.data.length){
      const moodLog = moodR.value.data.map(r => ({ date: r.date, value: r.value }));
      localStorage.setItem('moodLog', JSON.stringify(moodLog));
    }
  } catch(e){ console.warn('MoodLog fetch error:', e); }

  // ---- ScreenTime ----
  try {
    // BUG-002 FIX: skip overwrite when remote is empty (preserve local entries).
    if(stR.status === 'fulfilled' && stR.value && !stR.value.error && Array.isArray(stR.value.data) && stR.value.data.length){
      const log = stR.value.data.map(r => ({ date: r.date, hours: r.hours }));
      localStorage.setItem('screenTimeLog', JSON.stringify(log));
    }
  } catch(e){ console.warn('ScreenTime fetch error:', e); }

  // ---- ChallengeState (single row) ----
  try {
    if(chR.status === 'fulfilled' && chR.value && !chR.value.error && chR.value.data){
      const r = chR.value.data;
      if(r.week_start)                  localStorage.setItem('challengeWeekStart',     String(r.week_start));
      if(r.current_week_num != null)    localStorage.setItem('currentWeekNum',         String(r.current_week_num));
      if(r.weeks_completed != null)     localStorage.setItem('challengeWeeksCompleted',String(r.weeks_completed));
      if(r.max_streak != null)          localStorage.setItem('maxChallengeStreak',     String(r.max_streak));
      // PERSONALIZATION-V2: validate shape before persisting. V2 packs
      // require disorderOrder to be a 6-element array; malformed packs
      // are rejected so progress.js doesn't have to defend against them
      // mid-render. Legacy packs without metaVersion are accepted as-is
      // (they render via the legacy path in _dayCardHtml).
      if(r.current_pack && _isValidPack(r.current_pack)){
        localStorage.setItem('currentChallengePack', JSON.stringify(r.current_pack));
      }
      // CHALLENGE-DAY-LOCK: accept either legacy Array<number> or current
      // Array<{idx, day}>. Stuff straight into localStorage either way —
      // _readChallengeTicks in progress.js normalises legacy entries on
      // first read. Validate every element is one of the two recognised
      // shapes so a corrupt/foreign value can't slip through.
      if(Array.isArray(r.completed_indices) && r.completed_indices.every(e =>
        typeof e === 'number' || (e && typeof e === 'object' && typeof e.idx === 'number')
      )) localStorage.setItem('pauseChallenge', JSON.stringify(r.completed_indices));
    }
  } catch(e){ console.warn('ChallengeState fetch error:', e); }

  // ---- Re-render everything that depends on the freshly-loaded data ----
  try { if(typeof updateDWSDisplay      === 'function') updateDWSDisplay();      } catch(e){}
  try { if(typeof renderHomeDisorders   === 'function') renderHomeDisorders();   } catch(e){}
  try { if(typeof renderProgress        === 'function') renderProgress();        } catch(e){}
  try { if(typeof renderChallenge       === 'function') renderChallenge();       } catch(e){}
  try { if(typeof checkAndAwardBadges   === 'function') checkAndAwardBadges();   } catch(e){}
  try { if(typeof renderBadges          === 'function') renderBadges();          } catch(e){}
  try { if(typeof renderMoodCheck       === 'function') renderMoodCheck();       } catch(e){}
  try { if(typeof renderMotivationCard  === 'function') renderMotivationCard();  } catch(e){}
  try { if(typeof renderScreenTimeSection === 'function') renderScreenTimeSection(); } catch(e){}
  try { if(typeof renderUrgeJournal     === 'function') renderUrgeJournal();     } catch(e){}
  try { if(typeof renderAssessMenu      === 'function') renderAssessMenu();      } catch(e){}
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
      country:            userProfile.country || null,
      residence_type:     userProfile.residence_type || null,
      living_situation:   userProfile.living_situation || null,
      // Digital habits
      primary_device:     userProfile.primary_device || null,
      daily_screentime:   userProfile.daily_screentime || null,
      // Health
      avg_sleep:          userProfile.avg_sleep || null,
      self_rated_health:  userProfile.self_rated_health || null,
      chronic_illness:    userProfile.chronic_illness || null,
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
  showToast('🔬 Thank you for contributing to research!');
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
  const _fbSuccess = document.getElementById('feedbackSuccess');
  if(_fbSuccess) _fbSuccess.style.display = 'block';
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
  const el = document.getElementById(id);
  if(!el){ console.warn('[PAUSE] openModal: element not found:', id); return; }
  el.classList.add('open');

  // Always reset scroll to top on open (fixes "can't scroll up" bug)
  const sheet = el.querySelector('.modal-sheet, .modal-card');
  if(sheet) sheet.scrollTop = 0;

  // Reset T&C checkbox every time terms modal opens
  if(id === 'termsModal'){
    const cb = document.getElementById('termsCheckbox');
    if(cb) cb.checked = false;
    const err = document.getElementById('termsError');
    if(err) err.style.display = 'none';
  }

  // Re-render Google sign-in button each time loginModal opens.
  // BUG-006 FIX: clear-and-rerender is a documented GIS workaround for stale
  // iframe state when a tab is backgrounded then re-foregrounded. GIS may
  // throw or log a multi-init warning on rerender; we wrap in try/catch so
  // any thrown error doesn't surface to the user. Behaviour is preserved.
  if(id === 'loginModal' && window.google && googleSignInInitialized){
    const btnEl = document.getElementById('googleSignInBtn');
    if(btnEl){
      btnEl.innerHTML = ''; // clear stale iframe first
      try {
        google.accounts.id.renderButton(btnEl, {
          theme:'outline', size:'large', width:320,
          text:'continue_with', shape:'rectangular'
        });
      } catch(e){ /* GIS rerender warning — expected, intentionally swallowed */ }
    }
  }
}
function closeModal(id){
  const el = document.getElementById(id);
  if(el) el.classList.remove('open');
}

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
  const log = safeJsonParse(URGE_LOG_KEY, []);
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
  const log=safeJsonParse(URGE_LOG_KEY, []);
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
