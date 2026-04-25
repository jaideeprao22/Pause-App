// ============================================================
// cbt.js — PAUSE App
// FIX 7: Severity-based animated CBT modules
// FIX 5: Trend share button
// ============================================================

// ─── CBT MODULE DATA — keyed to actual DISORDERS IDs ────────
// Disorder IDs in this app: cyberchondria, socialmedia, shortform, gaming, ai, workaddiction
const CBT_MODULES = {
  cyberchondria: {
    mild: [
      { icon:'🛑', title:'Worry Postponement', color:'#0d9488', bg:'#e0f7f5', anim:'bar',
        steps:['Notice the urge to search a symptom online','Tell yourself: "I\'ll think about this at 7pm — not now"','Set a timer for your "worry window" — a fixed daily slot','When the timer goes off, reassess — is it still urgent?','Log each successful delay. The urge usually fades naturally.'] },
      { icon:'🧠', title:'Probability Reframing', color:'#0284c7', bg:'#e0f2fe', anim:'thought',
        steps:['Write down your feared diagnosis in one line','List 3 other likely explanations for the same symptom','Ask: "What % of people with this symptom actually have the scary diagnosis?"','Replace catastrophic thoughts with realistic alternatives','Notice the anxiety drop when you engage your rational mind'] }
    ],
    moderate: [
      { icon:'📊', title:'Search Budget', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Set a maximum number of health searches per day — start with 3','Track each search using a tally in your notes app','When budget is reached — close the browser completely','Each week, reduce the budget by 1 search','Celebrate hitting your target. The discipline is the therapy.'] },
      { icon:'🌊', title:'Urge Surfing', color:'#7c3aed', bg:'#ede9fe', anim:'urge',
        steps:['Notice the search urge arising — do not act on it yet','Rate its intensity 1–10','Breathe slowly and observe the urge like a wave in the ocean','Watch: urges always peak then fall naturally','Rate the urge again after 5 minutes — almost always lower'] }
    ],
    severe: [
      { icon:'🗺️', title:'Safety Behaviour Mapping', color:'#e11d48', bg:'#ffe4e6', anim:'bar',
        steps:['List every safety behaviour: searching, asking others, body checking','Safety behaviours maintain anxiety — they must be reduced gradually','Pick the smallest one to challenge first this week','Resist it once today. Anxiety rises, then falls — this is habituation.','Each week, drop one more behaviour and track progress'] },
      { icon:'👨‍⚕️', title:'Seek Professional Support', color:'#0f2d5e', bg:'#e8eef7', anim:'thought',
        steps:['Severe health anxiety causing daily distress warrants professional help','Speak to your GP — they can refer you to a CBT therapist','Explain you have health anxiety triggered by internet searching','CBT targeting health anxiety is highly effective (80% respond well)','You do not need to manage this alone — reaching out is the bravest step'] }
    ]
  },

  socialmedia: {
    mild: [
      { icon:'⏰', title:'Scheduled Scrolling', color:'#7c3aed', bg:'#ede9fe', anim:'bar',
        steps:['Choose 2–3 fixed daily windows for social media (e.g. 8am, 1pm, 8pm)','Set a 15-minute timer at the start of each window','When timer ends — close the app immediately','Use Grayscale mode to make your phone screen less stimulating','Track your daily total; aim to reduce by 10 minutes each week'] },
      { icon:'💭', title:'FOMO Reframing', color:'#0d9488', bg:'#e0f7f5', anim:'thought',
        steps:['Notice the comparison thought: "Their life looks better than mine"','Remind yourself: social media shows highlight reels, not real life','Write down one genuine thing you are grateful for right now','Ask before opening any app: "Am I scrolling to connect or compare?"','Only proceed if your honest answer is "to connect with someone specific"'] }
    ],
    moderate: [
      { icon:'📴', title:'Digital Detox — Week by Week', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Week 1: Measure baseline with Screen Time (iOS) or Digital Wellbeing (Android)','Week 2: Remove your most-used social app from your home screen','Week 3: No social media before 10am — every day without exception','Week 4: One full offline day per week','Week 5+: Protect these gains — your brain has begun to rewire'] }
    ],
    severe: [
      { icon:'🔴', title:'Account Reset', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Delete — not just pause — the most problematic app for 2 full weeks','Tell 2 trusted friends; social accountability doubles success rates','Pre-plan exactly what you will do with the reclaimed time','After 14 days: do you feel less anxious? More present?','Reinstall only with time limits set before you open it again'] }
    ]
  },

  shortform: {
    mild: [
      { icon:'📱', title:'Mindful Viewing', color:'#0284c7', bg:'#e0f2fe', anim:'bar',
        steps:['Before opening any short video app, state your purpose aloud','Set a 10-minute limit per session — one timer, no extensions','Notice how you feel during vs after watching — track the difference','Try replacing one session with a 10-minute walk','How many times did you say "just one more"? Log that number.'] }
    ],
    moderate: [
      { icon:'🚶', title:'Replace & Redirect', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Move all short video apps to the last page of your home screen','Replace your morning video session with 5 minutes of journaling','Set your phone to auto-lock after 3 minutes of inactivity','Subscribe to one long-form podcast on a topic you genuinely love','Each week, measure screen time — aim for 10% reduction'] }
    ],
    severe: [
      { icon:'🔒', title:'App Removal Protocol', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Delete TikTok, Reels, and Shorts apps entirely for 14 days','Tell a friend what you\'re doing — accountability is powerful','Install Freedom or ScreenZen to block at the browser level too','Fill the time slot with a physical activity or social call','After 14 days: is your attention span better? Is sleep improved?'] }
    ]
  },

  gaming: {
    mild: [
      { icon:'🎮', title:'Gaming Budget', color:'#059669', bg:'#d1fae5', anim:'bar',
        steps:['Set a firm daily gaming limit (e.g. 90 minutes) — before you start','Use a physical kitchen timer — in-game timers are unreliable','Agree on a "save and quit" protocol before each session begins','After gaming — move your body for 5 minutes immediately','Log actual time vs planned. Awareness is the foundation of change.'] }
    ],
    moderate: [
      { icon:'⚖️', title:'Life Balance Audit', color:'#d97706', bg:'#fef3c7', anim:'thought',
        steps:['Rate these 5 areas 1–10: sleep, relationships, work/study, health, hobbies','Identify which areas dropped since gaming increased','Set one small, measurable goal per under-rated area this week','Gaming belongs in your life when it does not displace your life','Repeat this audit in 2 weeks — track whether scores improve'] }
    ],
    severe: [
      { icon:'🚨', title:'30-Day Reset', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Honestly ask: is gaming replacing real-world relationships?','Commit to a 30-day gaming break — all platforms, all games','Tell one trusted person and agree to brief daily check-ins','Replace gaming time with social or outdoor activities','After 30 days, reassess with someone you trust before reintroducing gaming'] }
    ]
  },

  ai: {
    mild: [
      { icon:'🧩', title:'Build Back Autonomy', color:'#0d9488', bg:'#e0f7f5', anim:'thought',
        steps:['Identify one task you always delegate to AI — do it yourself this week','Before asking AI, spend 5 minutes attempting the answer independently','Use AI as reviewer, not creator — write drafts yourself first','Notice: independent problem-solving improves your thinking over time','Log tasks completed without AI — celebrate each one'] }
    ],
    moderate: [
      { icon:'⏱️', title:'AI Time Budget', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Set a daily AI usage limit of 30 minutes for non-essential tasks','Track which tasks you use AI for — patterns reveal dependency','Practice writing emails and reports entirely on your own 3× per week','When learning something new, read first before consulting AI','Reflect weekly: are you thinking more or less critically than before?'] }
    ],
    severe: [
      { icon:'🛑', title:'7-Day AI Break', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Take a 7-day break from all AI assistants for personal tasks','Notice what feels difficult — this reveals what you\'ve outsourced','Reconnect with human expertise: call a friend, ask a colleague','Have one meaningful conversation per day with a real person','After 7 days, set strict AI boundaries and maintain them long-term'] }
    ]
  },

  workaddiction: {
    mild: [
      { icon:'🔔', title:'Work Cut-Off Alarm', color:'#0284c7', bg:'#e0f2fe', anim:'bar',
        steps:['Set a firm daily work cut-off time — enforce it with an alarm','Label the alarm "Stop Working" so the intention is clear','When it rings, save your work and step away — no negotiation','Disable work email notifications after cut-off time','Take your full lunch break away from your desk every day'] }
    ],
    moderate: [
      { icon:'🌿', title:'Recovery Scheduling', color:'#059669', bg:'#d1fae5', anim:'thought',
        steps:['List 3 non-work activities that bring you genuine joy','Schedule them this week as calendar appointments — non-negotiable','Plan one full work-free day per week and protect it fiercely','Communicate your work hours clearly to colleagues','Reflect: is your work volume self-imposed or externally driven?'] }
    ],
    severe: [
      { icon:'🆘', title:'Burnout Prevention', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Work addiction causing daily distress is a serious health risk','Speak to your manager or HR about sustainable workload','Consult your GP — burnout has real physical health consequences','Engage a counsellor or occupational therapist if available','Remember: no job is worth your health. Boundaries protect performance too.'] }
    ]
  }
};

// General modules — shown when all disorders are clear, always appended as supplements
const GENERAL_MODULES = [
  { icon:'✅', title:'All Clear — Maintain the Gain', color:'#059669', bg:'#d1fae5', anim:'bar',
    steps:['Your digital wellness scores are in a healthy range — excellent','Keep this as a monthly maintenance habit','Share the app with a colleague, student, or family member','Use the exercises below any time to prevent future problems','Returning users show better long-term wellbeing outcomes'] },
  { icon:'🧘', title:'5-4-3-2-1 Grounding', color:'#0d9488', bg:'#e0f7f5', anim:'breath',
    steps:['See 5 things around you — name each one silently','Touch 4 surfaces — notice texture and temperature','Listen for 3 sounds — one near, one far, one in between','Smell 2 things — or vividly recall 2 favourite smells','Taste 1 thing — or simply notice what is in your mouth now'] },
  { icon:'💨', title:'4-7-8 Breathing', color:'#7c3aed', bg:'#ede9fe', anim:'breath',
    steps:['Breathe in slowly through your nose for 4 counts','Hold your breath completely for 7 counts','Exhale fully and slowly through your mouth for 8 counts','Complete 4 cycles without rushing — do not skip counts','Use before sleep, when an urge hits, or when overwhelmed'] },
  { icon:'🌊', title:'Urge Surfing', color:'#0284c7', bg:'#e0f2fe', anim:'urge',
    steps:['Notice any digital urge — don\'t act on it yet','Rate intensity: 1 (barely there) to 10 (overwhelming)','Breathe steadily and watch the urge like a passing wave','Urges ALWAYS peak and fall — they cannot stay at maximum','Rate again at 5 minutes — nearly always lower. You surfed it.'] }
];

// ─── ANIMATION TEMPLATES ─────────────────────────────────────
function getAnimHTML(anim, color, idx){
  const d = idx * 0.3;
  if(anim === 'bar') return `
    <div style="height:5px;border-radius:3px;background:${color}20;overflow:hidden;margin:10px 0 8px">
      <div style="height:100%;border-radius:3px;background:${color};width:0%;animation:cbtFill 2.8s ease-in-out ${d}s infinite alternate"></div>
    </div>`;
  if(anim === 'breath') return `
    <div style="width:52px;height:52px;border-radius:50%;background:${color};margin:10px auto;opacity:0.85;animation:cbtBreathe 4s ease-in-out ${d}s infinite"></div>`;
  if(anim === 'urge') return `
    <div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px">
      <span style="font-size:11px;color:${color};font-weight:600;white-space:nowrap">Urge</span>
      <div style="flex:1;height:7px;border-radius:4px;background:${color}20;overflow:hidden">
        <div style="height:100%;border-radius:4px;background:${color};width:70%;animation:cbtUrge 3.5s ease-in-out ${d}s infinite"></div>
      </div>
      <span style="font-size:11px;color:${color};font-weight:600;white-space:nowrap">↓ fading</span>
    </div>`;
  if(anim === 'thought') return `
    <div style="background:${color}12;border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:8px 12px;margin:10px 0 8px;font-size:12px;color:${color};font-weight:600">
      💭 Automatic thought → Reframed thought
    </div>`;
  return '';
}

// ─── RENDER A SINGLE MODULE CARD ─────────────────────────────
function renderModuleCard(mod, idx){
  const anim  = getAnimHTML(mod.anim, mod.color, idx);
  const steps = mod.steps.map((s, i) => `
    <li style="display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid ${mod.color}15;font-size:13px;line-height:1.5;align-items:flex-start">
      <span style="min-width:22px;height:22px;border-radius:50%;background:${mod.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px">${i+1}</span>
      <span style="color:var(--text)">${s}</span>
    </li>`).join('');

  return `
    <div id="cbtCard${idx}"
      style="background:${mod.bg};border:1.5px solid ${mod.color}30;border-radius:16px;overflow:hidden;margin-bottom:14px;opacity:0;transform:translateY(12px);transition:opacity 0.35s ${idx*0.1}s,transform 0.35s ${idx*0.1}s">
      <div style="padding:16px 18px 12px;display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:${mod.color}20;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${mod.icon}</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:${mod.color};font-family:'Syne',sans-serif">${mod.title}</div>
        </div>
      </div>
      <div style="padding:0 18px 16px">
        ${anim}
        <ul style="list-style:none;padding:0;margin:0">${steps}</ul>
      </div>
    </div>`;
}

// ─── MAIN: RENDER CBT SECTION ─────────────────────────────────
function renderCBTSection(){
  const container = document.getElementById('cbtSection');
  if(!container) return;

  // Inject keyframes once
  if(!document.getElementById('cbtKeyframes')){
    const style = document.createElement('style');
    style.id = 'cbtKeyframes';
    style.textContent = `
      @keyframes cbtFill{from{width:12%}to{width:100%}}
      @keyframes cbtBreathe{0%,100%{transform:scale(0.82);opacity:0.6}50%{transform:scale(1.18);opacity:1}}
      @keyframes cbtUrge{0%,100%{width:72%}50%{width:22%}}
    `;
    document.head.appendChild(style);
  }

  // Load grades (set by AppGrades.save in results.js after each assessment)
  const grades = window.AppGrades ? window.AppGrades.load() : {};
  const sevOrder = {severe:3, moderate:2, mild:1, minimal:0, normal:0};
  const activeDisorders = Object.entries(grades)
    .filter(([,sev]) => sev && sev !== 'minimal' && sev !== 'normal')
    .sort(([,a],[,b]) => (sevOrder[b]||0) - (sevOrder[a]||0));

  let html = '';
  let modulesToRender = [];

  if(activeDisorders.length === 0){
    html += `<div style="background:#d1fae5;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#059669;font-weight:600;display:flex;align-items:center;gap:8px">
      ✅ All your disorder scores are in the healthy range — great work!
    </div>`;
    modulesToRender = GENERAL_MODULES;
  } else {
    const [topKey, topSev] = activeDisorders[0];
    const sevColors = {severe:'#c0392b', moderate:'#d97706', mild:'#059669'};
    const sevBgs    = {severe:'#ffe4e6', moderate:'#fef3c7', mild:'#d1fae5'};
    let disName = topKey;
    if(typeof DISORDERS !== 'undefined'){
      const found = DISORDERS.find(d => d.id === topKey);
      if(found) disName = found.name;
    }
    html += `<div style="background:${sevBgs[topSev]||'#f3f4f6'};border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:${sevColors[topSev]||'#333'};font-weight:600">
      🎯 Personalised for <strong>${disName}</strong> — ${topSev} level
    </div>`;
    const topMods = (CBT_MODULES[topKey] && CBT_MODULES[topKey][topSev]) || [];
    modulesToRender = [...topMods, GENERAL_MODULES[1], GENERAL_MODULES[2]];
  }

  html += modulesToRender.map((m, i) => renderModuleCard(m, i)).join('');
  container.innerHTML = html;

  requestAnimationFrame(() => {
    modulesToRender.forEach((_, i) => {
      setTimeout(() => {
        const el = document.getElementById('cbtCard' + i);
        if(el){ el.style.opacity='1'; el.style.transform='translateY(0)'; }
      }, i * 100);
    });
  });
}

// ─── FIX 5: TREND SHARE BUTTON ───────────────────────────────
function renderTrendShareButton(assessmentCount){
  const area = document.getElementById('trendShareArea');
  if(!area) return;
  if(assessmentCount >= 2){
    area.innerHTML = `<button class="trend-share-btn" onclick="shareTrendImage()">📤 Share My Progress Trend</button>`;
  } else {
    const rem = 2 - assessmentCount;
    area.innerHTML = `<div class="trend-need-more">Complete ${rem} more assessment${rem>1?'s':''} to unlock trend sharing</div>`;
  }
}

async function shareTrendImage(){
  const history = JSON.parse(localStorage.getItem('pauseV2History') || '[]');
  const latestDWS = history.length     ? history[0].dws : null;
  const prevDWS   = history.length > 1 ? history[1].dws : null;
  const trend = latestDWS && prevDWS
    ? (latestDWS > prevDWS ? `↑ improved from ${prevDWS} to ${latestDWS}/100`
     : latestDWS < prevDWS ? `↓ changed from ${prevDWS} to ${latestDWS}/100`
     : `→ stable at ${latestDWS}/100`)
    : latestDWS ? `Score: ${latestDWS}/100` : 'No score yet';

  const shareData = {
    title: 'My PAUSE App Digital Wellness Progress',
    text: `📊 PAUSE App — Digital Wellness Trend\nDWS ${trend}\nAssessments: ${history.length}\n\nhttps://jaideeprao22.github.io/Pause-App/`
  };
  try {
    if(navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(shareData.text);
      alert('Progress copied to clipboard — paste anywhere to share!');
    }
  } catch(err){
    if(err.name !== 'AbortError') console.error('Share failed:', err);
  }
}

// Expose globally
window.renderCBTSection       = renderCBTSection;
window.renderTrendShareButton = renderTrendShareButton;
window.shareTrendImage        = shareTrendImage;
