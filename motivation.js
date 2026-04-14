// ============================================================
// MOTIVATION REMINDERS — Disorder-specific daily messages
// ============================================================

const MOTIVATION_MESSAGES = {
  cyberchondria: [
    "Today's focus: Allow yourself one health search limit. Trust your body more than Google.",
    "Reminder: Anxiety shrinks when you resist the urge to search. You are stronger than the loop.",
    "Today: Write your symptom down instead of searching it. See how it feels in 30 minutes.",
    "Your body is more resilient than your search history suggests. Trust it today.",
    "Challenge: Every time you want to search a symptom, drink a glass of water first. Then decide.",
    "Doctors exist for a reason. Reserve online searches for information, not reassurance.",
    "Today's mantra: One health question, one trusted source, then move on."
  ],
  socialmedia: [
    "Today: Check social media only after you've done your most important task of the day.",
    "Reminder: Every notification is a request for your attention. You decide if it's worth it.",
    "Try this today: Put your phone face-down for your first hour awake.",
    "The people you scroll past don't know you're watching. The life you're missing does.",
    "Today's goal: 45 minutes of social media maximum. Set the timer.",
    "Unfollow one account today that makes you feel worse about yourself.",
    "Real connections > digital ones. Call someone instead of scrolling today."
  ],
  shortform: [
    "Today: Before opening Reels or TikTok, ask yourself — what am I avoiding right now?",
    "Short videos are designed to feel effortless. Resisting them takes real strength.",
    "Try this: Replace your first short video session with a 10-minute walk outside.",
    "Your attention span is worth protecting. Guard it like a valuable resource.",
    "Today's challenge: No short videos before noon. You can do this.",
    "The boredom you're escaping is where creativity lives. Sit with it today.",
    "Every Reel you skip is a minute of your life returned to you."
  ],
  gaming: [
    "Today: Set your 2-hour timer before you start. Honor it when it goes off.",
    "Gaming is most fun when it's a reward, not a refuge. Earn it today.",
    "Reminder: The game will still be there tomorrow. Your relationships might not wait.",
    "Today: Play with purpose — pick one goal in the game, achieve it, then stop.",
    "The life outside the screen needs your attention today. Give it one hour.",
    "Gaming became a problem when it replaced other things. Reclaim one of those things today.",
    "Today's mantra: I play to enjoy, not to escape. There is a difference."
  ],
  ai: [
    "Today: Solve one problem entirely on your own before asking AI. Trust your brain.",
    "Your thinking is your most powerful tool. AI is just a calculator for language.",
    "Try this today: Write your first draft without AI. Then ask for feedback, not creation.",
    "Reminder: Every time you outsource thinking, you lose a little practice. Think today.",
    "AI can tell you what others know. Only you can think what hasn't been thought yet.",
    "Today's challenge: Have one important conversation without consulting AI first.",
    "Your independent judgment is irreplaceable. Exercise it today like a muscle."
  ],
  workaddiction: [
    "Today's rule: Work ends at [your cutoff time]. Set the alarm now.",
    "Reminder: No email after 7pm. The world will not end. Your evening might begin.",
    "Today: Take your full lunch break. Away from your desk. Without checking messages.",
    "Productivity is not the same as being busy. Rest is productive. Rest today.",
    "Your family and friends remember what you missed. Be present today.",
    "Today: One hour completely off. Phone down, laptop closed. Non-negotiable.",
    "Work will always expand to fill the time you give it. Give it less today."
  ],
  default: [
    "Small steps every day create lasting change. You are doing well.",
    "Today is a fresh start. Your digital habits can shift — one choice at a time.",
    "Awareness is the first step to change. By using PAUSE App, you're already ahead.",
    "Progress is not always visible. Trust the process and keep going.",
    "Your wellbeing matters more than any notification. Protect it today.",
    "Take one mindful pause today. Breathe. Look up from the screen.",
    "Every moment you spend present is a moment well lived."
  ]
};

function getTodayMotivation(){
  const dayOfWeek = new Date().getDay();
  const topDisorder = getTopDisorder();
  const messages = MOTIVATION_MESSAGES[topDisorder] || MOTIVATION_MESSAGES.default;
  return {
    disorder: topDisorder,
    message: messages[dayOfWeek % messages.length]
  };
}

function getTopDisorder(){
  if(Object.keys(disorderScores).length === 0) return 'default';
  let worst = null, worstPct = -1;
  DISORDERS.forEach(d => {
    if(disorderScores[d.id] !== undefined){
      const pct = (disorderScores[d.id] - d.questions.length) / (d.maxScore - d.questions.length);
      if(pct > worstPct){ worstPct = pct; worst = d.id; }
    }
  });
  return worst || 'default';
}

function renderMotivationCard(){
  const el = document.getElementById('motivationCard');
  if(!el) return;
  const {disorder, message} = getTodayMotivation();
  const d = DISORDERS.find(x => x.id === disorder);
  const icon = d ? d.icon : '✨';
  const color = d ? d.color : '#00c9a7';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:36px;height:36px;border-radius:10px;background:${color}20;display:flex;align-items:center;justify-content:center;font-size:18px">${icon}</div>
      <div>
        <div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:1px;text-transform:uppercase">Today's Motivation</div>
        <div style="font-size:11px;color:${color};font-weight:700">${d ? d.name : 'General Wellness'}</div>
      </div>
    </div>
    <div style="font-size:14px;line-height:1.7;color:var(--text);font-style:italic">"${message}"</div>`;
}

function scheduleMotivationNotification(){
  const enabled = localStorage.getItem('motivNotifEnabled') === 'true';
  if(!enabled) return;
  const time = localStorage.getItem('motivNotifTime') || '08:00';
  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if(next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    if(Notification.permission === 'granted' && localStorage.getItem('motivNotifEnabled') === 'true'){
      const {message} = getTodayMotivation();
      new Notification('PAUSE App — Daily Motivation 🌟', {
        body: message,
        icon: '/Pause-App/icons/icon-192.png'
      });
      scheduleMotivationNotification();
    }
  }, delay);
}


// ============================================================
// MOOD CHECK — Quick daily mood on home screen
// ============================================================

const MOODS = [
  {emoji:'😊', label:'Great', value:5, color:'#2ecc71'},
  {emoji:'🙂', label:'Good', value:4, color:'#00c9a7'},
  {emoji:'😐', label:'Okay', value:3, color:'#f5a623'},
  {emoji:'😔', label:'Low', value:2, color:'#ff6b35'},
  {emoji:'😰', label:'Stressed', value:1, color:'#ff4757'}
];

function renderMoodCheck(){
  const el = document.getElementById('moodCheckCard');
  if(!el) return;
  const today = new Date().toISOString().split('T')[0];
  const moodLog = JSON.parse(localStorage.getItem('moodLog') || '[]');
  const todayMood = moodLog.find(m => m.date === today);

  if(todayMood){
    const mood = MOODS.find(m => m.value === todayMood.value);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:28px">${mood?.emoji}</div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--muted)">TODAY'S MOOD</div>
          <div style="font-size:14px;font-weight:700;color:${mood?.color}">${mood?.label}</div>
        </div>
        <button onclick="resetTodayMood()" style="margin-left:auto;font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;font-family:inherit">Change</button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px">HOW ARE YOU FEELING TODAY?</div>
    <div style="display:flex;justify-content:space-between;gap:6px">
      ${MOODS.map(m => `
        <button onclick="logMood(${m.value})" style="flex:1;background:none;border:2px solid var(--border);border-radius:12px;padding:8px 4px;cursor:pointer;transition:all 0.2s;font-family:inherit">
          <div style="font-size:22px">${m.emoji}</div>
          <div style="font-size:9px;color:var(--muted);font-weight:700;margin-top:3px">${m.label}</div>
        </button>`).join('')}
    </div>`;
}

function logMood(value){
  const today = new Date().toISOString().split('T')[0];
  const moodLog = JSON.parse(localStorage.getItem('moodLog') || '[]');
  moodLog.unshift({date: today, value});
  if(moodLog.length > 60) moodLog.splice(60);
  localStorage.setItem('moodLog', JSON.stringify(moodLog));
  renderMoodCheck();
}

function resetTodayMood(){
  const today = new Date().toISOString().split('T')[0];
  const moodLog = JSON.parse(localStorage.getItem('moodLog') || '[]').filter(m => m.date !== today);
  localStorage.setItem('moodLog', JSON.stringify(moodLog));
  renderMoodCheck();
}

// ============================================================
// ONBOARDING — First time user welcome
// ============================================================

function checkFirstTimeUser(){
  if(localStorage.getItem('hasOnboarded')) return;
  openModal('onboardingModal');
}

function completeOnboarding(){
  localStorage.setItem('hasOnboarded','true');
  closeModal('onboardingModal');
}

// ============================================================
// NOTIFICATION PROMPT — After first assessment
// ============================================================

function showNotifPrompt(){
  openModal('notifPromptModal');
}

async function acceptNotifPrompt(){
  closeModal('notifPromptModal');
  if('Notification' in window){
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){
      localStorage.setItem('notifEnabled','true');
      localStorage.setItem('motivNotifEnabled','true');
      scheduleMotivationNotification();
      const toggle = document.getElementById('notifToggle');
      if(toggle) toggle.classList.add('on');
    }
  }
}
