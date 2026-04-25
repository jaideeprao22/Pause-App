// ============================================================
// cbt.js — PAUSE App
// FIX 7: Severity-based animated CBT modules
// FIX 4: Disorder info modal + Assess page clickable cards
// ============================================================

// ─── DISORDER DATA (for info modal — Fix 4) ─────────────────
const DISORDER_INFO = {
  cyberchondria: {
    name: 'Cyberchondria',
    icon: '🔍',
    color: '#0f2d5e',
    bg: '#e8eef7',
    tool: 'CSS-15 (Cyberchondria Severity Scale)',
    toolRef: 'Norr, Olatunji & Wolitzky-Taylor (2015)',
    items: 15,
    sensitivity: '89%',
    description: 'Repeated, compulsive searching of health information online that amplifies rather than relieves health anxiety. Each search temporarily relieves anxiety but lowers the threshold for the next search trigger — creating a self-reinforcing cycle.',
    prevalence: 'Affects 20–30% of internet users worldwide.',
    domains: ['Compulsion to search', 'Distress from searching', 'Excessiveness', 'Reassurance-seeking', 'Mistrust of doctors'],
    clinicalNote: 'Scores ≥36 indicate clinically significant cyberchondria warranting professional assessment.',
    scaleKey: 'cyberchondria'
  },
  social: {
    name: 'Social Media Addiction',
    icon: '📱',
    color: '#7c3aed',
    bg: '#ede9fe',
    tool: 'Bergen Social Media Addiction Scale (BSMAS)',
    toolRef: 'Andreassen et al. (2012)',
    items: 6,
    sensitivity: '87%',
    description: 'Problematic social media use characterised by salience, mood modification, tolerance, withdrawal, conflict, and relapse — mirroring classical addiction criteria.',
    prevalence: 'Clinically significant use affects 5–10% of adolescents and young adults.',
    domains: ['Salience', 'Mood modification', 'Tolerance', 'Withdrawal', 'Conflict', 'Relapse'],
    clinicalNote: 'Scores ≥19 (rating ≥3 on ≥4 items) suggest problematic use.',
    scaleKey: 'social'
  },
  internet: {
    name: 'Internet Addiction',
    icon: '🌐',
    color: '#0284c7',
    bg: '#e0f2fe',
    tool: 'Internet Addiction Test (IAT)',
    toolRef: 'Young (1998) — validated in 60+ countries',
    items: 20,
    sensitivity: '90%',
    description: 'Problematic internet use characterised by uncontrollable urges to go online, loss of time awareness, neglect of real-life relationships, and withdrawal when offline.',
    prevalence: 'Affects 6–10% of internet users globally; higher in younger age groups.',
    domains: ['Salience', 'Tolerance', 'Mood modification', 'Relapse', 'Withdrawal', 'Conflict'],
    clinicalNote: 'IAT ≥50 indicates moderate addiction; ≥80 indicates severe addiction.',
    scaleKey: 'internet'
  },
  gaming: {
    name: 'Gaming Disorder',
    icon: '🎮',
    color: '#059669',
    bg: '#d1fae5',
    tool: 'Internet Gaming Disorder Scale (IGDS-SF9)',
    toolRef: 'Pontes & Griffiths (2015) — WHO ICD-11 aligned',
    items: 9,
    sensitivity: '88%',
    description: 'Persistent or recurrent gaming behaviour (online or offline) characterised by impaired control over gaming, increasing priority given to gaming over other activities, and continuation despite negative consequences.',
    prevalence: 'WHO recognised gaming disorder in ICD-11 (2019). Affects 3–4% of gamers.',
    domains: ['Preoccupation', 'Tolerance', 'Withdrawal', 'Persistence', 'Escape', 'Deception', 'Displacement', 'Escape coping', 'Impairment'],
    clinicalNote: 'Designed to align with DSM-5 and ICD-11 Gaming Disorder criteria.',
    scaleKey: 'gaming'
  },
  nomophobia: {
    name: 'Nomophobia',
    icon: '📵',
    color: '#d97706',
    bg: '#fef3c7',
    tool: 'Nomophobia Questionnaire (NMP-Q)',
    toolRef: 'Yildirim & Correia (2015)',
    items: 20,
    sensitivity: '85%',
    description: 'Fear of being without a mobile phone or being unable to use it — characterised by anxiety when the phone is inaccessible, loss of battery, or poor signal.',
    prevalence: 'Studies suggest 66–77% of people experience some level of nomophobia.',
    domains: ['Not being able to communicate', 'Losing connectedness', 'Not being able to access information', 'Giving up convenience'],
    clinicalNote: 'Nomophobia frequently co-occurs with social anxiety and FOMO (Fear of Missing Out).',
    scaleKey: 'nomophobia'
  },
  screentime: {
    name: 'Screen Time Impact',
    icon: '🕐',
    color: '#e11d48',
    bg: '#ffe4e6',
    tool: 'Digital Health Impact Module (DHIM)',
    toolRef: 'Developed for PAUSE App — GMC Maheshwaram',
    items: 20,
    sensitivity: 'N/A',
    description: 'Assessment of how digital device use is impacting four key health domains: sleep quality, physical health, mental wellbeing, and social functioning.',
    prevalence: 'Average Indian adult spends 6.5 hours per day on screens (2024 data).',
    domains: ['Sleep quality', 'Physical health', 'Mental wellbeing', 'Social functioning'],
    clinicalNote: 'This is an impact module — not a diagnostic tool. Results guide lifestyle modification advice.',
    scaleKey: 'screentime'
  }
};

// ─── CBT MODULE DATA ─────────────────────────────────────────
const CBT_MODULES = {
  cyberchondria: {
    mild: [
      { icon:'🛑', title:'Worry Postponement', color:'#0d9488', bg:'#e0f7f5', anim:'bar',
        steps:['Notice the urge to search a symptom online','Tell yourself: "I'll think about this at 7pm — not now"','Set a timer for your "worry window"','When the timer goes off, reassess — is it still urgent?','Log each successful delay — the urge usually fades naturally'] },
      { icon:'🧠', title:'Probability Reframing', color:'#0284c7', bg:'#e0f2fe', anim:'thought',
        steps:['Write down your feared diagnosis in one line','List 3 other likely explanations for the same symptom','Ask: "What % of people with this symptom actually have the scary diagnosis?"','Replace catastrophic thoughts with realistic alternatives','Notice the anxiety drop when you engage your rational mind'] }
    ],
    moderate: [
      { icon:'📊', title:'Search Budget', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Agree on a maximum number of health searches per day (start with 3)','Use a tally in your notes app to track each search','When budget is reached — close the browser completely','Each week, reduce your budget by 1 search','Celebrate hitting your target; the discipline is the therapy'] },
      { icon:'🌊', title:'Urge Surfing', color:'#7c3aed', bg:'#ede9fe', anim:'urge',
        steps:['Notice the search urge arising — but do not act on it yet','Rate its intensity on a scale of 1 to 10','Breathe slowly and observe the urge like a wave in the ocean','Watch what happens — urges always peak, then naturally fall','Rate the urge again after 5 minutes — it is almost always lower'] }
    ],
    severe: [
      { icon:'🗺️', title:'Safety Behaviour Mapping', color:'#e11d48', bg:'#ffe4e6', anim:'bar',
        steps:['List every "safety behaviour" you use: searching, asking others, body checking','Safety behaviours maintain anxiety — they need to be reduced gradually','Pick the smallest safety behaviour to challenge first this week','Resist it once today. Notice: anxiety rises, then falls — this is habituation','Each week, drop one more behaviour. Track your progress.'] },
      { icon:'👨‍⚕️', title:'Seek Professional Support', color:'#0f2d5e', bg:'#e8eef7', anim:'thought',
        steps:['Severe health anxiety causing daily distress warrants professional help','Speak to your GP — they can refer you to a CBT therapist','Explain you have health anxiety triggered by internet health searching','CBT specifically targeting health anxiety is highly effective (80% respond)','You do not need to manage this alone — reaching out is the bravest step'] }
    ]
  },
  social: {
    mild: [
      { icon:'⏰', title:'Scheduled Scrolling', color:'#7c3aed', bg:'#ede9fe', anim:'bar',
        steps:['Choose 2–3 fixed daily windows for social media (e.g. 8am, 1pm, 8pm)','Set a 15-minute timer at the start of each window','When timer ends — close the app immediately without exception','Use Grayscale mode to make your phone screen less stimulating','Track your daily total; aim to reduce by 10 minutes each week'] },
      { icon:'💭', title:'FOMO Reframing', color:'#0d9488', bg:'#e0f7f5', anim:'thought',
        steps:['Notice the comparison thought: "Their life looks better than mine"','Remind yourself: social media shows highlight reels, not real life','Write down one genuine thing you are grateful for right now','Ask yourself before opening any app: "Am I scrolling to connect or compare?"','Only proceed if your honest answer is "to connect with someone specific"'] }
    ],
    moderate: [
      { icon:'📴', title:'Digital Detox — Week by Week', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Week 1: Use Screen Time (iOS) or Digital Wellbeing (Android) to measure your baseline','Week 2: Remove your most-used social app from your home screen','Week 3: No social media before 10am — every single day','Week 4: Introduce one full offline day per week','Week 5 onwards: Protect these gains — your brain has begun to rewire'] }
    ],
    severe: [
      { icon:'🔴', title:'Account Reset', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Delete — not just pause — the most problematic app for 2 full weeks','Tell 2 trusted friends: social accountability doubles success rates','Pre-plan exactly what you will do with the reclaimed time','After 14 days: do you feel less anxious? More present? Honestly assess.','Reinstall only with app time limits set before you open it again'] }
    ]
  },
  internet: {
    mild: [
      { icon:'🎯', title:'Intentional Browsing', color:'#0284c7', bg:'#e0f2fe', anim:'thought',
        steps:['Before opening any tab, write down WHY in 5 words or fewer','Only proceed if your written reason matches your actual intent','Use bookmarks to go directly to destinations — avoid the "I\'ll just check" trap','Track rabbit-hole moments: how long did you actually spend vs plan?','Celebrate sessions that stayed on purpose — they build the skill'] }
    ],
    moderate: [
      { icon:'🏗️', title:'Behavioural Activation', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['List activities you have reduced since heavy internet use began','Pick one to reconnect with this week','Schedule it as a real calendar appointment — treat it as non-negotiable','Rate your enjoyment before vs after — offline activities are nearly always better','Gradually shift time from browsing to this activity over 4 weeks'] }
    ],
    severe: [
      { icon:'🔒', title:'Environmental Control', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Move all devices out of your bedroom tonight','Install Freedom or Cold Turkey to block time-wasting sites','Create at least one fully internet-free zone in your home','Share your goals with someone in your household for accountability','Change your router password to something only a trusted person knows'] }
    ]
  },
  gaming: {
    mild: [
      { icon:'🎮', title:'Gaming Budget', color:'#059669', bg:'#d1fae5', anim:'bar',
        steps:['Set a firm daily gaming limit (e.g. 90 minutes) — before you start','Use a physical kitchen timer — in-game timers can be manipulated','Agree on a "save and quit" protocol before each session begins','After gaming — move your body for 5 minutes immediately','Log actual time versus planned time: awareness is the foundation of change'] }
    ],
    moderate: [
      { icon:'⚖️', title:'Life Balance Audit', color:'#d97706', bg:'#fef3c7', anim:'thought',
        steps:['Rate these 5 life areas from 1–10: sleep, relationships, work/study, health, hobbies','Identify which areas have dropped since your gaming increased','Set one small, measurable goal per under-rated area this week','Gaming is a hobby — it belongs in your life when it does not displace your life','Repeat this audit in 2 weeks — track whether your scores improve'] }
    ],
    severe: [
      { icon:'🚨', title:'30-Day Reset', color:'#e11d48', bg:'#ffe4e6', anim:'urge',
        steps:['Honestly ask yourself: is gaming replacing real-world relationships?','Commit to a 30-day gaming break — all platforms, all games','Tell one trusted person and agree to daily brief check-ins','Replace gaming time with social activities or outdoor exercise','After 30 days, reassess with someone you trust before reintroducing gaming'] }
    ]
  },
  nomophobia: {
    mild: [
      { icon:'📵', title:'Phone-Free Zones', color:'#d97706', bg:'#fef3c7', anim:'bar',
        steps:['Designate one room as phone-free — start with the bedroom','Leave your phone charging in a different room overnight','Observe the first 5 minutes of discomfort — it always passes','Replace phone-checking with a physical anchor ritual (tea, stretch, journal)','Add one new phone-free zone each week as comfort grows'] }
    ],
    moderate: [
      { icon:'📳', title:'Graduated Exposure', color:'#7c3aed', bg:'#ede9fe', anim:'urge',
        steps:['Day 1: Leave phone in your bag for one full hour','Day 3: Two hours without checking — plan what you will do instead','Week 2: Full half-day offline every weekend morning','Week 3: One full offline day per week','Notice with each session: the world did not end. Your anxiety can be tolerated.'] }
    ],
    severe: [
      { icon:'🆘', title:'Break the Anxiety Link', color:'#e11d48', bg:'#ffe4e6', anim:'thought',
        steps:['Recognise the core belief: "I need my phone to feel safe." This is the problem.','Write down 3 alternative anxiety-relief strategies: breathing, walking, calling a friend','Next time anxiety rises — use one alternative BEFORE reaching for your phone','Track: how many times did you choose the alternative this week?','Each successful alternative weakens the phone-anxiety chain permanently'] }
    ]
  }
};

// General modules shown when all disorders are absent/mild
const GENERAL_MODULES = [
  { icon:'✅', title:'All Clear — Stay the Course', color:'#059669', bg:'#d1fae5', anim:'bar',
    steps:['Your digital wellness scores are in a healthy range — well done','Keep this as a monthly maintenance check-in','Share the app with a colleague, student, or family member','Use the exercises below any time to maintain your gains','Returning users show better long-term outcomes — keep coming back'] },
  { icon:'🧘', title:'5-4-3-2-1 Grounding', color:'#0d9488', bg:'#e0f7f5', anim:'breath',
    steps:['See 5 things around you — name each one silently','Touch 4 surfaces — notice their texture and temperature','Listen for 3 sounds — one near, one far, one in between','Smell 2 things — or vividly recall 2 favourite smells','Taste 1 thing — or simply notice what is in your mouth right now'] },
  { icon:'💨', title:'4-7-8 Breathing', color:'#7c3aed', bg:'#ede9fe', anim:'breath',
    steps:['Breathe in slowly through your nose for 4 counts','Hold your breath completely for 7 counts','Exhale fully and slowly through your mouth for 8 counts','Complete 4 full cycles without rushing — do not skip counts','Use before sleep, before a search urge hits, or when overwhelmed'] },
  { icon:'🌊', title:'Urge Surfing — Universal', color:'#0284c7', bg:'#e0f2fe', anim:'urge',
    steps:['Notice any urge to do something digital — don\'t act yet','Rate the urge intensity: 1 (barely there) to 10 (overwhelming)','Breathe steadily and watch the urge like a passing ocean wave','Urges ALWAYS peak and fall — they cannot stay at maximum','Rate the urge again at 5 minutes — nearly always lower. You surfed it.'] }
];

// ─── ANIMATION TEMPLATES ─────────────────────────────────────
function getAnimHTML(anim, color, idx) {
  const d = idx * 0.3;
  if (anim === 'bar') {
    return `<div style="height:5px;border-radius:3px;background:${color}20;overflow:hidden;margin:10px 0 8px">
      <div style="height:100%;border-radius:3px;background:${color};animation:cbtFill 2.8s ease-in-out ${d}s infinite alternate"></div>
    </div>`;
  }
  if (anim === 'breath') {
    return `<div style="width:52px;height:52px;border-radius:50%;background:${color};margin:10px auto;animation:cbtBreathe 4s ease-in-out ${d}s infinite;opacity:0.85"></div>`;
  }
  if (anim === 'urge') {
    return `<div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px">
      <span style="font-size:11px;color:${color};font-weight:600;white-space:nowrap">Urge</span>
      <div style="flex:1;height:7px;border-radius:4px;background:${color}20;overflow:hidden">
        <div style="height:100%;border-radius:4px;background:${color};animation:cbtUrge 3.5s ease-in-out ${d}s infinite"></div>
      </div>
      <span style="font-size:11px;color:${color};font-weight:600;white-space:nowrap">↓ fading</span>
    </div>`;
  }
  if (anim === 'thought') {
    return `<div style="background:${color}12;border-left:3px solid ${color};border-radius:0 8px 8px 0;padding:8px 12px;margin:10px 0 8px;font-size:12px;color:${color};font-weight:600;animation:cbtThought 0.5s ease both ${d}s">
      💭 Automatic thought → Reframed thought
    </div>`;
  }
  return '';
}

// ─── RENDER A SINGLE MODULE CARD ─────────────────────────────
function renderModuleCard(mod, idx) {
  const anim = getAnimHTML(mod.anim, mod.color, idx);
  const steps = mod.steps.map((s, i) => `
    <li style="display:flex;gap:10px;padding:8px 0;border-bottom:0.5px solid ${mod.color}15;font-size:13px;line-height:1.5;align-items:flex-start">
      <span style="min-width:22px;height:22px;border-radius:50%;background:${mod.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px">${i+1}</span>
      <span style="color:var(--text)">${s}</span>
    </li>`).join('');

  return `
    <div class="cbt-card" style="background:${mod.bg};border:1.5px solid ${mod.color}30;border-radius:16px;overflow:hidden;margin-bottom:14px;opacity:0;transform:translateY(12px);transition:opacity 0.35s ${idx*0.1}s,transform 0.35s ${idx*0.1}s" id="cbtCard${idx}">
      <div style="padding:16px 18px 12px;display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:${mod.color}20;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${mod.icon}</div>
        <div>
          <div style="font-weight:700;font-size:15px;color:${mod.color};font-family:'Syne',sans-serif">${mod.title}</div>
          <div style="font-size:11px;color:${mod.color};opacity:0.75;margin-top:2px">${mod.sub || ''}</div>
        </div>
      </div>
      <div style="padding:0 18px 16px">
        ${anim}
        <ul style="list-style:none;padding:0;margin:0">
          ${steps}
        </ul>
      </div>
    </div>`;
}

// ─── MAIN: RENDER CBT SECTION ─────────────────────────────────
// FIX 7: Called by app.js after results are available
function renderCBTSection() {
  const container = document.getElementById('cbtSection');
  if (!container) return;

  // Read latest grades from localStorage (FIX 3 compatible)
  let grades = {};
  try {
    const stored = localStorage.getItem('pause_grades');
    grades = stored ? JSON.parse(stored) : {};
    // Also check older key format used by state.js
    if (!Object.keys(grades).length) {
      const alt = localStorage.getItem('pauseGrades') || localStorage.getItem('disorder_grades');
      if (alt) grades = JSON.parse(alt);
    }
  } catch(e) { grades = {}; }

  // Find worst-severity disorders to prioritise module display
  const sevOrder = { severe: 3, moderate: 2, mild: 1, normal: 0, '': 0 };
  const disordersWithSeverity = Object.entries(grades)
    .filter(([,sev]) => sev && sev !== 'normal' && sev !== 'none')
    .sort(([,a],[,b]) => (sevOrder[b]||0) - (sevOrder[a]||0));

  // Inject animation keyframes once
  if (!document.getElementById('cbtKeyframes')) {
    const style = document.createElement('style');
    style.id = 'cbtKeyframes';
    style.textContent = `
      @keyframes cbtFill{from{width:12%}to{width:100%}}
      @keyframes cbtBreathe{0%,100%{transform:scale(0.82);opacity:0.6}50%{transform:scale(1.18);opacity:1}}
      @keyframes cbtUrge{0%,100%{width:72%}50%{width:28%}}
      @keyframes cbtThought{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
    `;
    document.head.appendChild(style);
  }

  let html = '';
  let modulesToRender = [];

  if (disordersWithSeverity.length === 0) {
    // All clear — show general modules
    html += `<div style="background:#d1fae5;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#059669;font-weight:600;display:flex;align-items:center;gap:8px">
      ✅ All your disorder scores are in the healthy range — great work!
    </div>`;
    modulesToRender = GENERAL_MODULES;
  } else {
    // Show severity badge
    const topDisorder = disordersWithSeverity[0];
    const topKey = topDisorder[0];
    const topSev = topDisorder[1];
    const sevColors = { severe:'#c0392b', moderate:'#d97706', mild:'#059669' };
    const sevBgs   = { severe:'#ffe4e6', moderate:'#fef3c7', mild:'#d1fae5' };
    const disInfo  = DISORDER_INFO[topKey];
    const disName  = disInfo ? disInfo.name : topKey;

    html += `<div style="background:${sevBgs[topSev]||'#f3f4f6'};border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:${sevColors[topSev]||'#333'};font-weight:600">
      🎯 Modules personalised for <strong>${disName}</strong> — ${topSev} level
    </div>`;

    // Get modules for top disorder+severity
    const topMods = (CBT_MODULES[topKey] && CBT_MODULES[topKey][topSev]) || [];
    modulesToRender = [...topMods];

    // Always append 4-7-8 breathing and grounding as bonus
    modulesToRender.push(GENERAL_MODULES[1]); // grounding
    modulesToRender.push(GENERAL_MODULES[2]); // breathing
  }

  html += modulesToRender.map((m, i) => renderModuleCard(m, i)).join('');
  container.innerHTML = html;

  // Trigger entrance animations after paint
  requestAnimationFrame(() => {
    modulesToRender.forEach((_, i) => {
      setTimeout(() => {
        const el = document.getElementById('cbtCard' + i);
        if (el) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }
      }, i * 100);
    });
  });
}

// ─── FIX 4: DISORDER INFO MODAL ──────────────────────────────
function showDisorderInfo(disorderKey, fromAssess) {
  const d = DISORDER_INFO[disorderKey];
  if (!d) return;

  document.getElementById('disorderInfoIcon').textContent = d.icon;
  document.getElementById('disorderInfoTitle').textContent = d.name;

  const domains = d.domains.map(dom =>
    `<span class="disorder-info-badge">${dom}</span>`).join('');

  document.getElementById('disorderInfoBody').innerHTML = `
    <p style="margin-bottom:12px">${d.description}</p>
    <p style="margin-bottom:12px;font-style:italic;color:var(--muted)">${d.prevalence}</p>

    <div style="background:var(--bg);border-radius:12px;padding:12px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:6px">Screening Tool</div>
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:2px">${d.tool}</div>
      <div style="font-size:12px;color:var(--muted)">${d.toolRef}</div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div class="tool-stat"><div class="tool-stat-num">${d.items}</div><div class="tool-stat-label">Questions</div></div>
      <div class="tool-stat"><div class="tool-stat-num">${d.sensitivity}</div><div class="tool-stat-label">Sensitivity</div></div>
    </div>

    <div style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:6px">Domains Assessed</div>
      <div>${domains}</div>
    </div>

    <div style="background:#fff8e1;border-radius:10px;padding:10px 12px;border-left:3px solid #d97706;margin-top:4px">
      <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:3px">CLINICAL NOTE</div>
      <div style="font-size:12px;color:var(--muted)">${d.clinicalNote}</div>
    </div>
  `;

  const startBtn = document.getElementById('disorderInfoStartBtn');
  startBtn.textContent = 'Start ' + d.name + ' Assessment →';
  startBtn.onclick = function() {
    closeModal('disorderInfoModal');
    // Start the specific assessment — works with your existing assessment.js
    if (typeof startSingleAssessment === 'function') {
      startSingleAssessment(d.scaleKey);
    } else if (typeof startAssessment === 'function') {
      startAssessment(d.scaleKey);
    }
  };

  document.getElementById('disorderInfoModal').classList.add('active');
}

// ─── FIX 4: RENDER ASSESS MENU CARDS (clickable with info) ───
// Call this from app.js or assessment.js where assess-menu-list is rendered
function renderAssessMenuWithInfo(disorders, impacts) {
  const disorderList = document.getElementById('assess-menu-list');
  const impactList   = document.getElementById('assess-impact-list');
  if (!disorderList || !impactList) return;

  if (disorders && disorders.length) {
    disorderList.innerHTML = disorders.map(d => {
      const info = DISORDER_INFO[d.key] || {};
      return `
        <div class="assess-disorder-card" onclick="showDisorderInfo('${d.key}', true)">
          <div class="assess-card-icon" style="background:${info.bg||'#e8eef7'}">${info.icon || '🔬'}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${d.name || info.name || d.key}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${info.tool || ''}</div>
          </div>
          <div class="assess-card-chevron">›</div>
        </div>`;
    }).join('');
  }

  if (impacts && impacts.length) {
    impactList.innerHTML = impacts.map(imp => `
      <div class="assess-impact-card" onclick="showImpactInfo && showImpactInfo('${imp.key}')">
        <div style="font-size:22px;flex-shrink:0">${imp.icon || '📊'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--text)">${imp.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">${imp.items || ''} questions</div>
        </div>
        <div class="assess-card-chevron">›</div>
      </div>`).join('');
  }
}

// ─── FIX 5: TREND SHARING ─────────────────────────────────────
// Call this from progress.js after rendering trendBars
function renderTrendShareButton(assessmentCount) {
  const area = document.getElementById('trendShareArea');
  if (!area) return;

  if (assessmentCount >= 2) {
    area.innerHTML = `
      <button class="trend-share-btn" onclick="shareTrendImage()">
        📤 Share My Progress Trend
      </button>`;
  } else {
    const remaining = 2 - assessmentCount;
    area.innerHTML = `
      <div class="trend-need-more">
        Complete ${remaining} more assessment${remaining>1?'s':''} to unlock trend sharing
      </div>`;
  }
}

async function shareTrendImage() {
  const trendEl = document.querySelector('.trend-graph');
  if (!trendEl) { alert('No trend to share yet.'); return; }

  // Build a plain-text share fallback (canvas capture requires html2canvas lib)
  const grades = {};
  try {
    const stored = localStorage.getItem('pause_grades');
    Object.assign(grades, stored ? JSON.parse(stored) : {});
  } catch(e) {}

  const summary = Object.entries(grades)
    .map(([k,v]) => `${k}: ${v}`)
    .join(', ') || 'No results yet';

  const shareData = {
    title: 'My PAUSE App Digital Wellness Progress',
    text: `📊 PAUSE App — Digital Wellness Trend\n${summary}\n\nTrack yours at: https://jaideeprao22.github.io/Pause-App/`,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      // Clipboard fallback
      await navigator.clipboard.writeText(shareData.text);
      alert('Progress copied to clipboard — paste it anywhere to share!');
    }
  } catch(err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
    }
  }
}

// ─── INIT ─────────────────────────────────────────────────────
// Expose globally so app.js / nav.js can call after data loads
window.renderCBTSection    = renderCBTSection;
window.showDisorderInfo    = showDisorderInfo;
window.renderAssessMenuWithInfo = renderAssessMenuWithInfo;
window.renderTrendShareButton   = renderTrendShareButton;
window.shareTrendImage     = shareTrendImage;

// Auto-render when tools screen becomes visible (caught by nav.js showScreen)
document.addEventListener('cbtReady', renderCBTSection);
