// ============================================================
// DAILY LOGBOOK — Guided journaling with speech-to-text
// ============================================================

// BUG6 FIX: escape user-entered text before inserting via innerHTML to prevent XSS
function _escHtml(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

const LOGBOOK_PROMPTS = [
  {icon:'🌅', text:'How are you feeling about your digital habits today?'},
  {icon:'📱', text:'Which app did you use the most today, and how did it make you feel?'},
  {icon:'💭', text:'Did you feel the urge to check your phone unnecessarily today? Describe it.'},
  {icon:'✅', text:'What is one positive digital choice you made today?'},
  {icon:'🎯', text:'What is one thing you want to do differently with your screen time tomorrow?'},
  {icon:'😌', text:'How did your mood change after periods of heavy screen use today?'},
  {icon:'🔋', text:'Do you feel energized or drained by your digital activity today? Why?'}
];

let currentPromptIdx = 0;
let _logbookClearOnRender = false; // set true after save so textarea starts fresh

// ──────────────────────────────────────────────────────────────
// SPEECH RECOGNITION STATE
// All speech state lives at module scope so we can reason about it cleanly
// across session restarts. NEVER read the textarea to recover state — keep
// our own source of truth.
// ──────────────────────────────────────────────────────────────
let recognition = null;
let isRecording = false;
let _preText = '';      // user's textarea content captured the moment mic was turned on
let _committed = '';    // all finalised speech across the recording (survives session restarts)
let _interim = '';      // currently-displayed interim (replaced on every event)

function renderLogbookScreen(){
  const el = document.getElementById('screen-logbook');
  if(!el) return;

  const today = new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
  const entries = getLogbookEntries();
  const todayKey = getTodayKey();
  const todayEntry = entries.find(e => e.date === todayKey);

  const prompt = LOGBOOK_PROMPTS[currentPromptIdx % LOGBOOK_PROMPTS.length];

  el.querySelector('.screen-content').innerHTML = `
    <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:var(--text);margin-bottom:4px">Daily Logbook</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${today}</div>

    <!-- Today's prompt -->
    <div class="card" style="border-left:4px solid var(--accent);padding-left:14px">
      <div style="font-size:22px;margin-bottom:8px">${prompt.icon}</div>
      <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.5;margin-bottom:12px">${prompt.text}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${LOGBOOK_PROMPTS.map((_,i) => `<div onclick="selectPrompt(${i})" style="width:8px;height:8px;border-radius:50%;background:${i===currentPromptIdx%LOGBOOK_PROMPTS.length?'var(--accent)':'var(--border)'};cursor:pointer;flex-shrink:0"></div>`).join('')}
      </div>
      <textarea id="logbookText" placeholder="Write your thoughts here..." style="width:100%;min-height:120px;border:2px solid var(--border);border-radius:12px;padding:12px;font-size:14px;font-family:inherit;color:var(--text);resize:vertical;line-height:1.6">${_logbookClearOnRender ? '' : (todayEntry?.text||'')}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button onclick="toggleSpeechRecognition()" id="speechBtn" style="flex:0 0 48px;height:48px;border-radius:12px;border:2px solid var(--border);background:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="Voice input">🎤</button>
        <button class="btn-primary" style="flex:1;padding:12px" onclick="saveLogEntry()">Save Entry →</button>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center" id="speechStatus"></div>
    </div>

    <!-- Past entries -->
    <div class="section-label" style="margin-top:16px">Past Entries</div>
    ${entries.length === 0 ?
      '<div class="notice blue"><div class="notice-title">No entries yet</div>Write your first logbook entry above.</div>' :
      entries.slice(0,10).map(e => `
        <div class="card" style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:12px;font-weight:700;color:var(--accent)">${formatLogDate(e.date)}</div>
            <div style="font-size:10px;color:var(--muted)">${e.prompt}</div>
          </div>
          <div style="font-size:13px;color:var(--text);line-height:1.6">${_escHtml(e.text)}</div>
          <button onclick="deleteLogEntry('${e.id}')" style="font-size:11px;color:var(--red);background:none;border:none;cursor:pointer;margin-top:8px;font-family:inherit">Delete</button>
        </div>`).join('')
    }`;
}

function selectPrompt(idx){
  // If recording, stop first — switching prompts mid-recording is confusing
  if(isRecording) stopRecording();
  currentPromptIdx = idx;
  renderLogbookScreen();
}

function getTodayKey(){
  return new Date().toISOString().split('T')[0];
}

function formatLogDate(dateKey){
  const d = new Date(dateKey);
  return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

function getLogbookEntries(){
  return safeJsonParse('pauseLogbook', []);
}

function saveLogEntry(){
  // If user hits Save while mic is on, stop it cleanly first so any interim
  // text in flight gets discarded rather than half-committed.
  if(isRecording) stopRecording();

  const text = document.getElementById('logbookText')?.value?.trim();
  if(!text){ showToast('Please write something before saving.'); return; }

  const entries = getLogbookEntries();
  const todayKey = getTodayKey();
  const prompt = LOGBOOK_PROMPTS[currentPromptIdx % LOGBOOK_PROMPTS.length];
  const existingIdx = entries.findIndex(e => e.date === todayKey && e.promptIdx === currentPromptIdx);
  const entry = {
    id: existingIdx >= 0 ? entries[existingIdx].id : Date.now().toString(),
    date: todayKey,
    promptIdx: currentPromptIdx,
    prompt: prompt.text.substring(0, 30) + '...',
    text,
    createdAt: new Date().toISOString()
  };
  if(existingIdx >= 0) entries[existingIdx] = entry;
  else entries.unshift(entry);
  localStorage.setItem('pauseLogbook', JSON.stringify(entries));

  saveLogToSupabase(entry);

  showToast('✅ Entry saved!');
  _logbookClearOnRender = true;
  renderLogbookScreen();
  _logbookClearOnRender = false;
}

async function saveLogToSupabase(entry){
  if(!currentUser || typeof sb === 'undefined') return;
  try {
    await sb.from('logbook').upsert({
      id: entry.id,
      user_id: currentUser.id,
      date: entry.date,
      prompt: entry.prompt,
      text: entry.text,
      created_at: entry.createdAt
    });
  } catch(e){ console.log('Logbook save error:', e); }
}

function deleteLogEntry(id){
  const entries = getLogbookEntries().filter(e => e.id !== id);
  localStorage.setItem('pauseLogbook', JSON.stringify(entries));
  showToast('Entry deleted.');
  renderLogbookScreen();
}

// ──────────────────────────────────────────────────────────────
// SPEECH RECOGNITION
// ──────────────────────────────────────────────────────────────

function toggleSpeechRecognition(){
  if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){
    showToast('Voice input works in Chrome on Android — not supported on this browser.');
    return;
  }
  if(isRecording){ stopRecording(); return; }
  startRecording();
}

// Render textarea = preText + committed + interim. Single source of truth —
// we never READ the textarea while recording (avoids interleaving with user typing).
function _updateTextarea(){
  const ta = document.getElementById('logbookText');
  if(!ta) return;
  const parts = [];
  if(_preText)   parts.push(_preText);
  if(_committed) parts.push(_committed);
  if(_interim)   parts.push(_interim);
  ta.value = parts.join(' ');
}

function startRecording(){
  // Capture current textarea content as immutable baseline. Anything spoken
  // gets appended to this — user-typed content can't be overwritten.
  const ta = document.getElementById('logbookText');
  _preText   = ta ? ta.value.trim() : '';
  _committed = '';
  _interim   = '';
  isRecording = true;

  const btn = document.getElementById('speechBtn');
  const status = document.getElementById('speechStatus');
  if(btn) btn.textContent = '⏹️';
  if(status) status.textContent = '🔴 Recording... tap mic to stop';

  _startSession();
}

// ──────────────────────────────────────────────────────────────
// _startSession() creates a NEW SpeechRecognition instance every time.
// This is critical on Android Chrome: reusing an instance after onend
// often throws InvalidStateError, and continuous mode is unreliable.
//
// We use continuous=false (single utterance), and onend chains another
// session via setTimeout so the user perceives a continuous recording.
// ──────────────────────────────────────────────────────────────
function _startSession(){
  if(!isRecording) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.continuous = false;        // ← critical: single-utterance, predictable result array
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    // event.results contains exactly the current utterance (continuous=false guarantees this).
    // Walk through and split into interim vs final. Each event REPLACES interim, not appends.
    let interim = '';
    let finalChunk = '';
    for(let i = 0; i < event.results.length; i++){
      const r = event.results[i];
      if(r.isFinal){
        finalChunk += r[0].transcript;
      } else {
        interim += r[0].transcript;
      }
    }

    _interim = interim.trim();

    if(finalChunk.trim()){
      _committed += (_committed ? ' ' : '') + finalChunk.trim();
      _interim = ''; // utterance finalised — interim no longer relevant
    }

    _updateTextarea();
  };

  recognition.onerror = (e) => {
    // 'no-speech' and 'aborted' are normal — just let onend handle the restart.
    // Other errors: log, but still let onend decide whether to restart or stop.
    if(e.error !== 'no-speech' && e.error !== 'aborted'){
      console.warn('[logbook] speech error:', e.error);
    }
  };

  recognition.onend = () => {
    // Whatever was interim was cut mid-word — drop it.
    _interim = '';
    _updateTextarea();
    if(!isRecording) return;
    // Restart in a fresh session after a short delay. The delay is critical:
    // calling start() synchronously in onend throws InvalidStateError on
    // Android Chrome because the engine hasn't fully released audio focus yet.
    setTimeout(_startSession, 120);
  };

  try {
    recognition.start();
  } catch(e){
    // Rare: start() can throw if a previous session is still in cleanup.
    // Try once more after a longer delay before giving up.
    console.warn('[logbook] start() failed, retrying:', e);
    setTimeout(() => {
      if(!isRecording) return;
      try { recognition.start(); }
      catch(e2){
        console.warn('[logbook] start() retry failed:', e2);
        stopRecording();
      }
    }, 250);
  }
}

function stopRecording(){
  // Set flag FIRST so the in-flight onend doesn't re-trigger a session start.
  isRecording = false;

  if(recognition){
    // Detach handlers BEFORE stop()/abort() so any final events that fire
    // during teardown don't mutate state we're about to discard.
    recognition.onresult = null;
    recognition.onerror  = null;
    recognition.onend    = null;
    try { recognition.stop();  } catch(e){}
    try { recognition.abort(); } catch(e){}
    recognition = null;
  }

  // Drop any uncommitted interim — it was never finalised.
  _interim = '';
  _updateTextarea();

  const btn = document.getElementById('speechBtn');
  const status = document.getElementById('speechStatus');
  if(btn) btn.textContent = '🎤';
  if(status) status.textContent = '';
}
