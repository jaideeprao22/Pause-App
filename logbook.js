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
let recognition = null;
let isRecording = false;
let _logbookClearOnRender = false; // set true after save so textarea starts fresh

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
  return JSON.parse(localStorage.getItem('pauseLogbook') || '[]');
}

function saveLogEntry(){
  const text = document.getElementById('logbookText')?.value?.trim();
  // Bug 5 FIX: alert() → showToast() (alert blocked in TWA/WebView)
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

  // Bug 8 FIX: button text change was overwritten by renderLogbookScreen() before the
  // browser could paint it — success feedback was invisible. Use showToast() instead.
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
  // Bug 6 FIX: confirm() is blocked in TWA/WebView — delete directly with toast notification
  const entries = getLogbookEntries().filter(e => e.id !== id);
  localStorage.setItem('pauseLogbook', JSON.stringify(entries));
  showToast('Entry deleted.');
  renderLogbookScreen();
}

function toggleSpeechRecognition(){
  if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){
    // Bug 7 FIX: alert() → showToast()
    showToast('Voice input works in Chrome on Android — not supported on this browser.');
    return;
  }
  if(isRecording){ stopRecording(); return; }
  startRecording();
}

function startRecording(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = true;   // Chrome keeps mic open; rarely stops on its own
  recognition.interimResults = true;

  const btn = document.getElementById('speechBtn');
  const status = document.getElementById('speechStatus');
  if(btn) btn.textContent = '⏹️';
  if(status) status.textContent = '🔴 Recording... tap mic to stop';
  isRecording = true;

  // Snapshot text already in textarea before recording starts
  const textarea = document.getElementById('logbookText');
  const preText = (textarea ? textarea.value : '').trimEnd();
  // Accumulate only NEW finalised words spoken this session
  let newFinals = '';

  recognition.onresult = (event) => {
    let latestFinal = '';
    let latestInterim = '';
    for(let i = event.resultIndex; i < event.results.length; i++){
      if(event.results[i].isFinal){
        latestFinal += event.results[i][0].transcript;
      } else {
        latestInterim += event.results[i][0].transcript;
      }
    }
    if(latestFinal) newFinals += (newFinals ? ' ' : '') + latestFinal.trim();
    const spoken = newFinals + (latestInterim ? ' ' + latestInterim : '');
    const ta = document.getElementById('logbookText');
    if(ta) ta.value = preText ? preText + ' ' + spoken : spoken;
  };

  recognition.onerror = (e) => {
    if(e.error === 'no-speech' || e.error === 'aborted') return;
    stopRecording();
  };

  // NO auto-restart here — that was causing Chrome to replay the last
  // final result on every new session, duplicating every word.
  // continuous:true keeps mic open; user taps mic again if session drops.
  recognition.onend = () => { if(isRecording) stopRecording(); };

  recognition.start();
}

function stopRecording(){
  isRecording = false;           // ← MUST be set BEFORE .stop() to prevent onend restart loop
  if(recognition){
    recognition.onend = null;    // detach handler so no restart fires after this
    recognition.onerror = null;
    recognition.stop();
    recognition = null;
  }
  const btn = document.getElementById('speechBtn');
  const status = document.getElementById('speechStatus');
  if(btn) btn.textContent = '🎤';
  if(status) status.textContent = '';
}
