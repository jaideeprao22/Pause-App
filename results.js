// ============================================================
// RESULTS
// ============================================================
function renderResults(){
  if(dwsScore !== null){
    const s = getDWSStatus(dwsScore);
    document.getElementById('resultDWSNum').textContent = dwsScore;
    document.getElementById('resultDWSStatus').textContent = s.status;
  }
  const tags = document.getElementById('shareTags');
  const topDisorder = Object.entries(disorderScores).sort((a,b) => {
    const da=DISORDERS.find(d=>d.id===a[0]), db=DISORDERS.find(d=>d.id===b[0]);
    return ((b[1]-(db?.questions.length||0))/(db?.maxScore-(db?.questions.length||0)||1)) -
           ((a[1]-(da?.questions.length||0))/(da?.maxScore-(da?.questions.length||0)||1));
  }).slice(0,3);
  tags.innerHTML = topDisorder.map(([id]) => {
    const d = DISORDERS.find(x=>x.id===id);
    return d ? `<div class="share-tag">${d.icon} ${d.name}</div>` : '';
  }).join('');

  const dList = document.getElementById('resultDisorderList');
  if(Object.keys(disorderScores).length > 0){
    dList.innerHTML = DISORDERS.filter(d => disorderScores[d.id] !== undefined).map(d => {
      const score = disorderScores[d.id], level = getLevel(d, score);
      const pct = ((score - d.questions.length) / (d.maxScore - d.questions.length)) * 100;
      return `<div class="result-disorder-row">
        <div class="result-disorder-header">
          <div class="result-disorder-name">${d.icon} ${d.name}</div>
          <div class="result-level" style="background:${level.bg};color:${level.color}">${level.label}</div>
        </div>
        <div class="result-bar-bg"><div class="result-bar-fill" style="width:${pct}%;background:${level.color}"></div></div>
        <div class="result-score-text">${score} / ${d.maxScore} — ${d.scale}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px" id="pct-${d.id}"></div>
        <button class="explain-btn" onclick="showExplain('${d.id}')">💡 What does this mean?</button>
      </div>`;
    }).join('');
  } else {
    dList.innerHTML = '<div class="notice yellow"><div class="notice-title">No disorder screens completed</div>Complete a Full Assessment or individual disorder screen.</div>';
  }

  const iCard = document.getElementById('resultImpactCard');
  if(Object.keys(impactScores).length > 0){
    iCard.innerHTML = IMPACT_MODULES.map(m => {
      const score = impactScores[m.id] || 0, level = getImpactLevel(score);
      const pct = (score / (m.questions.length * 4)) * 100;
      return `<div class="impact-row">
        <div class="impact-label">${m.icon} ${m.name}</div>
        <div class="impact-bar-bg"><div class="impact-bar-fill" style="width:${pct}%;background:${level.color}"></div></div>
        <div class="impact-value" style="color:${level.color}">${level.label}</div>
      </div>`;
    }).join('');
  } else {
    iCard.innerHTML = '<div style="font-size:13px;color:var(--muted)">Complete a Quick Scan or Full Assessment to see health impact.</div>';
  }

  renderActionPlan();
  renderHomeDisorders();
  renderProgress();

  // FIX 3 + FIX 7: After rendering results, persist grades & refresh CBT modules
  if(window.AppGrades && Object.keys(disorderScores).length > 0){
    const grades = {};
    DISORDERS.forEach(d => {
      if(disorderScores[d.id] !== undefined){
        const level = getLevel(d, disorderScores[d.id]);
        grades[d.id] = level.label.toLowerCase(); // 'minimal','mild','moderate','severe'
      }
    });
    window.AppGrades.save(grades);
    // Refresh CBT modules with new severity data
    if(typeof renderCBTSection === 'function') renderCBTSection();
  }

  if(!localStorage.getItem('notifPromptShown')){
    localStorage.setItem('notifPromptShown', 'true');
    setTimeout(() => showNotifPrompt(), 1500);
  } else {
    // Show post-assessment research modal if notif prompt already done
    renderPostAssessmentPrompt();
  }

  setTimeout(() => {
    DISORDERS.filter(d => disorderScores[d.id] !== undefined).forEach(d => {
      const el = document.getElementById('pct-' + d.id);
      if(el){
        const p = getPercentile(d.id, disorderScores[d.id]);
        if(p !== null) el.innerHTML = '📊 Higher than <strong style="color:var(--accent)">' + p + '%</strong> of PAUSE App users';
      }
    });
    if(dwsScore !== null && Object.keys(disorderScores).length === 6){
      const dp = getDWSPercentile(dwsScore);
      const shareCard = document.getElementById('shareCard');
      if(shareCard && !document.getElementById('dwsPercentileTag')){
        const tag = document.createElement('div');
        tag.id = 'dwsPercentileTag';
        tag.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.7);margin-top:8px';
        tag.innerHTML = '📊 Better than ' + dp + '% of all PAUSE App users';
        shareCard.appendChild(tag);
      }
    }
  }, 100);
}

function renderActionPlan(){
  const el = document.getElementById('resultActionPlan');
  const actions = [];
  DISORDERS.forEach(d => {
    if(disorderScores[d.id] === undefined) return;
    const level = getLevel(d, disorderScores[d.id]);
    if(level.label==='Severe'||level.label==='Moderate'||level.label==='Mild'){
      const tips = {
        cyberchondria:["Set a strict 20-minute daily limit for health-related searches using screen time controls.","When you feel the urge to search symptoms, write them down and wait 30 minutes before searching.","Replace health search habits with a trusted medical helpline or your doctor's contact.","Unsubscribe from health newsletters and symptom-checker websites that trigger anxiety.","Schedule a monthly check-in with your doctor instead of daily online symptom searches.","Practice the 5-4-3-2-1 grounding technique when health anxiety urges arise.","Tell a trusted person about your health search habits — accountability reduces compulsion.","Use the PAUSE App to track how often you feel the urge to search health information."],
        socialmedia:["Enable built-in screen time limits on all social media apps — start with 45 minutes per day.","Turn off all social media push notifications. Check manually at fixed times only.","Install a grayscale filter on your phone to reduce the visual reward of scrolling.","Delete the social media apps from your phone and access them only via browser.","Designate two fixed 20-minute windows per day for checking social media — stick to them.","Audit who you follow — unfollow anyone whose content makes you feel worse about yourself.","Replace your morning social media check with a 5-minute journaling or stretching routine.","Try a 48-hour social media fast this weekend and note how you feel."],
        shortform:["Delete TikTok, Reels, and Shorts apps for 7 days and notice the difference in your attention span.","Replace your first 15 minutes of short video watching with a 10-minute walk.","Set your phone to auto-lock after 5 minutes of inactivity to interrupt passive scrolling.","Move short video apps to a folder on the last page of your home screen — friction reduces use.","Set a maximum of 3 short video sessions per day with a 10-minute limit each.","Replace one short video session daily with a podcast or audiobook on a topic you care about.","Notice your emotional state before opening a short video app — boredom, stress, or loneliness?","Track your daily short video screen time for one week and review the total honestly."],
        gaming:["Set a hard 2-hour daily gaming limit using parental controls or an app timer.","Establish gaming-free zones: no gaming after 9pm and not before completing daily priorities.","Replace one gaming session per week with a physical outdoor activity.","Tell someone you trust about your gaming limits and ask them to check in with you.","Remove gaming apps from your phone — play only on dedicated devices with time limits.","Identify your gaming triggers (stress, boredom, loneliness) and address the root cause.","Join a sports team, gym class, or hobby group to replace gaming time with social activity.","Take a full gaming detox for 7 days and journal how you spend the reclaimed time."],
        ai:["Challenge yourself to solve at least one problem per day entirely without AI assistance.","Before asking an AI, spend 5 minutes attempting to find the answer independently.","Use AI as a reviewer, not a creator — write your own drafts first, then ask for feedback.","Set a daily AI usage limit of 30 minutes for non-essential tasks.","Practice writing emails, reports, and messages entirely on your own at least 3 times per week.","When learning something new, read a book or article first before consulting AI.","Reflect weekly: which decisions did you make independently vs. outsourced to AI?","Have one meaningful conversation per day with a real person instead of an AI chatbot."],
        workaddiction:["Set a firm daily work cut-off time and enforce it with a phone alarm labeled 'Stop Working'.","Disable work email notifications after 7pm on all devices.","Schedule at least one full screen-free hour per day for non-work activities.","Take your full lunch break away from your desk and without checking work messages.","Plan one full work-free day per week — protect it as non-negotiable.","List 3 non-work activities that bring you joy and schedule them this week.","Communicate your work hours clearly to colleagues to reduce after-hours expectations.","Reflect on whether your work volume is self-imposed or externally driven — the answer matters."]
      };
      if(tips[d.id]){
        const count = level.label==='Severe'?5:level.label==='Moderate'?4:2;
        tips[d.id].slice(0,count).forEach(tip => actions.push({icon:d.icon,text:tip,color:d.color}));
      }
    }
  });
  if(impactScores.sleep && impactScores.sleep > 5){
    actions.push({icon:'😴',text:'Keep your phone charging outside the bedroom. Use a standalone alarm clock.',color:'#7c5cbf'});
    actions.push({icon:'😴',text:'Set a digital curfew 1 hour before bedtime — no screens after that time.',color:'#7c5cbf'});
    actions.push({icon:'😴',text:'Enable Night Shift or blue light filter from 8pm onwards on all devices.',color:'#7c5cbf'});
    actions.push({icon:'😴',text:'Create a 15-minute wind-down routine: dim lights, no phone, light reading only.',color:'#7c5cbf'});
  }
  if(impactScores.attention && impactScores.attention > 5){
    actions.push({icon:'🧠',text:'Try the Pomodoro technique: 25 minutes of focused work, then a 5-minute break.',color:'#3d6fff'});
    actions.push({icon:'🧠',text:'Put your phone face-down and on silent during any task requiring concentration.',color:'#3d6fff'});
    actions.push({icon:'🧠',text:'Practice reading a physical book for 20 minutes daily to rebuild sustained attention.',color:'#3d6fff'});
    actions.push({icon:'🧠',text:'Disable all non-essential notifications — keep only calls and messages from close contacts.',color:'#3d6fff'});
  }
  if(impactScores.productivity && impactScores.productivity > 5){
    actions.push({icon:'⚡',text:'Use app blockers like Forest or Cold Turkey during your peak work hours.',color:'#f5a623'});
    actions.push({icon:'⚡',text:'Write a 3-item priority list each morning and complete it before opening social media.',color:'#f5a623'});
    actions.push({icon:'⚡',text:'Batch all digital admin tasks (email, messages) into two fixed 30-minute windows daily.',color:'#f5a623'});
    actions.push({icon:'⚡',text:'Keep your phone in another room during your most important 2 hours of the workday.',color:'#f5a623'});
  }
  if(impactScores.emotional && impactScores.emotional > 5){
    actions.push({icon:'❤️',text:'Take a 10-minute mindfulness or breathing break before any screen session.',color:'#ff4757'});
    actions.push({icon:'❤️',text:'Unfollow or mute any accounts that consistently make you feel anxious or inadequate.',color:'#ff4757'});
    actions.push({icon:'❤️',text:'Schedule one screen-free social activity per week with friends or family.',color:'#ff4757'});
    actions.push({icon:'❤️',text:'Journal for 5 minutes before bed about how digital use affected your mood today.',color:'#ff4757'});
  }
  actions.push({icon:'📊',text:'Reassess with PAUSE App in 4 weeks to track your digital wellness progress.',color:'#00c9a7'});
  actions.push({icon:'💧',text:'Drink a glass of water every time you feel the urge to check your phone unnecessarily.',color:'#00c9a7'});
  actions.push({icon:'🌿',text:'Spend at least 20 minutes outdoors daily without your phone — even a short walk counts.',color:'#2ecc71'});
  actions.push({icon:'🛌',text:'Aim for 7-8 hours of sleep — poor sleep dramatically worsens digital addiction patterns.',color:'#7c5cbf'});
  actions.push({icon:'👥',text:'Share your PAUSE score with someone you trust and discuss one change you will make together.',color:'#3d6fff'});

  if(actions.length === 0){
    actions.push({icon:'✅',text:'Your digital habits look healthy. Keep it up!',color:'#2ecc71'});
    actions.push({icon:'📅',text:'Reassess in 4 weeks to track your progress.',color:'#3d6fff'});
  }

  el.innerHTML = actions.slice(0,12).map((a,i) => `
    <div class="card" style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
      <div style="width:36px;height:36px;border-radius:10px;background:${a.color}20;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${a.icon}</div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:4px">ACTION ${i+1}</div>
        <div style="font-size:13px;font-weight:500;color:var(--text);line-height:1.5">${a.text}</div>
      </div>
    </div>`).join('');
}

function switchResultTab(tab){
  ['disorders','impact','actions'].forEach(t =>
    document.getElementById(`result-tab-${t}`).style.display = t===tab ? 'block' : 'none'
  );
  document.querySelectorAll('.tab').forEach((el,i) =>
    el.classList.toggle('active', ['disorders','impact','actions'][i]===tab)
  );
}

// ============================================================
// EXPLAIN MODAL
// ============================================================
function showExplain(disorderId){
  const d = DISORDERS.find(x => x.id === disorderId);
  if(!d) return;
  const score = disorderScores[d.id];
  const level = getLevel(d, score);
  document.getElementById('explainTitle').textContent = `${d.icon} ${d.name}: ${level.label}`;
  document.getElementById('explainBody').innerHTML = `
    <p><strong>Your score:</strong> ${score} out of ${d.maxScore}</p>
    <p style="margin-top:8px">${level.desc}</p>
    <p style="margin-top:12px"><strong>Scale used:</strong> ${d.scaleRef}</p>
    ${d.id==='ai'?'<p style="margin-top:8px;font-size:12px;color:var(--muted)">⚠️ Note: This scale is validated in a Turkish sample only. Interpret with caution.</p>':''}`;
  openModal('explainModal');
}

// ============================================================
// DWS MODAL
// ============================================================
function showDWSModal(){
  if(dwsScore !== null){
    const s = getDWSStatus(dwsScore);
    document.getElementById('modalDWSNum').textContent = dwsScore;
    document.getElementById('modalDWSStatus').textContent = s.status;
    document.getElementById('modalDWSStatus').style.color = s.color;
    document.getElementById('modalDWSSub').textContent = s.sub;
    let breakdown = '';
    if(Object.keys(disorderScores).length > 0){
      breakdown = '<div style="margin-top:8px"><div class="section-label">Score Breakdown</div>';
      DISORDERS.filter(d => disorderScores[d.id] !== undefined).forEach(d => {
        const level = getLevel(d, disorderScores[d.id]);
        breakdown += `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span>${d.icon} ${d.name}</span>
          <span style="font-weight:700;color:${level.color}">${level.label}</span>
        </div>`;
      });
      breakdown += '</div>';
    }
    document.getElementById('modalDWSBreakdown').innerHTML = breakdown;
  } else {
    document.getElementById('modalDWSNum').textContent = '--';
    document.getElementById('modalDWSStatus').textContent = 'Not assessed yet';
    document.getElementById('modalDWSSub').textContent = 'Complete a Full Assessment to get your Digital Wellness Score.';
    document.getElementById('modalDWSBreakdown').innerHTML = '';
  }
  openModal('dwsModal');
}

// ============================================================
// POST-ASSESSMENT RESEARCH PROMPT — Stage 2
// 3 disorder-specific questions based on highest-scoring disorder
// ============================================================
function renderPostAssessmentPrompt(){
  // Find the highest-scoring disorder (by normalised score)
  if(Object.keys(disorderScores).length === 0) return;

  const ranked = Object.entries(disorderScores).sort((a,b) => {
    const da = DISORDERS.find(d => d.id === a[0]);
    const db = DISORDERS.find(d => d.id === b[0]);
    if(!da || !db) return 0;
    const normA = (a[1] - da.questions.length) / (da.maxScore - da.questions.length);
    const normB = (b[1] - db.questions.length) / (db.maxScore - db.questions.length);
    return normB - normA;
  });

  const topId = ranked[0][0];
  const topDisorder = DISORDERS.find(d => d.id === topId);
  if(!topDisorder) return;

  // Store for savePostAssessmentData to reference
  postAssessDisorderId = topId;

  // Disorder-specific question banks (3 per disorder)
  const questionBank = {
    cyberchondria: [
      {
        q: 'How long have you been experiencing anxiety-driven online health searches?',
        opts: ['Less than 1 month','1–6 months','6–12 months','More than 1 year']
      },
      {
        q: 'Does your health searching worsen after reading about a specific disease or symptom?',
        opts: ['Almost always','Often','Sometimes','Rarely','Never']
      },
      {
        q: 'Have you ever sought a doctor\'s reassurance after an online health search?',
        opts: ['Yes, frequently','Yes, occasionally','Rarely','No, never']
      }
    ],
    socialmedia: [
      {
        q: 'Which platform consumes most of your social media time?',
        opts: ['Instagram','Facebook','X (Twitter)','WhatsApp','YouTube','Other']
      },
      {
        q: 'How often do you compare yourself negatively to others on social media?',
        opts: ['Very often','Often','Sometimes','Rarely','Never']
      },
      {
        q: 'Have you tried and failed to reduce social media use in the past?',
        opts: ['Yes, multiple times','Yes, once','No, but I\'ve thought about it','No, I haven\'t tried']
      }
    ],
    shortform: [
      {
        q: 'Which short-form video platform do you use most?',
        opts: ['Instagram Reels','YouTube Shorts','TikTok','Moj / Josh / other Indian app','Multiple equally']
      },
      {
        q: 'Do you find it difficult to stop watching short videos once you start?',
        opts: ['Almost always','Often','Sometimes','Rarely','Never']
      },
      {
        q: 'Has short-form video watching interfered with your sleep or work?',
        opts: ['Yes, significantly','Yes, somewhat','Rarely','No, not at all']
      }
    ],
    gaming: [
      {
        q: 'What type of games do you primarily play?',
        opts: ['Mobile casual','Mobile MOBA / Battle Royale','PC / Console','Online multiplayer (MMORPG)','Multiple types']
      },
      {
        q: 'Do you experience irritability or restlessness when unable to play games?',
        opts: ['Yes, frequently','Yes, sometimes','Rarely','No, never']
      },
      {
        q: 'Has gaming negatively affected your relationships, studies, or work?',
        opts: ['Yes, significantly','Yes, to some extent','Rarely','No, not at all']
      }
    ],
    ai: [
      {
        q: 'For which tasks do you primarily use AI assistants?',
        opts: ['Writing / communication','Learning / studying','Work / professional tasks','Creative tasks','Decision-making','Multiple equally']
      },
      {
        q: 'Do you feel anxious or stuck when you cannot access an AI assistant?',
        opts: ['Yes, frequently','Yes, sometimes','Rarely','No, never']
      },
      {
        q: 'Do you feel your independent thinking or problem-solving has weakened due to AI use?',
        opts: ['Yes, definitely','Possibly yes','Not sure','No, not at all']
      }
    ],
    workaddiction: [
      {
        q: 'What best describes your primary work context?',
        opts: ['Student / academic','Healthcare / clinical','Corporate / office','Self-employed','Remote / freelance','Other']
      },
      {
        q: 'Do you check work messages or emails outside of official work hours most days?',
        opts: ['Yes, constantly','Yes, frequently','Occasionally','Rarely / Never']
      },
      {
        q: 'Has overworking negatively affected your personal relationships or physical health?',
        opts: ['Yes, significantly','Yes, to some extent','Possibly','No, not at all']
      }
    ]
  };

  const qs = questionBank[topId];
  if(!qs) return;

  // Build the modal content
  const title = document.getElementById('postAssessTitle');
  if(title) title.textContent = `${topDisorder.icon} ${topDisorder.name}: 3 Research Questions`;

  const container = document.getElementById('postAssessQuestions');
  if(!container) return;

  container.innerHTML = qs.map((item, qi) => `
    <div class="post-assess-q" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;line-height:1.5">${qi+1}. ${item.q}</div>
      <div class="form-options" style="flex-wrap:wrap">
        ${item.opts.map(opt =>
          `<button class="form-option" data-value="${opt}"
            onclick="this.closest('.post-assess-q').querySelectorAll('.form-option').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')"
          >${opt}</button>`
        ).join('')}
      </div>
    </div>`).join('');

  // Show modal after a short delay (results should be visible first)
  setTimeout(() => openModal('postAssessmentModal'), 2000);
}
