// ============================================================
// CBT TIPS — Cognitive Behavioral Therapy exercises per disorder
// ============================================================

const CBT_TIPS = {
  cyberchondria: [
    {
      title: 'Thought Record',
      desc: 'When you feel the urge to search a symptom, write down: (1) What triggered it? (2) What am I afraid of? (3) What is a more balanced thought? This interrupts the anxiety loop.',
      time: '5 min'
    },
    {
      title: 'Exposure Delay',
      desc: 'When the urge to search hits, set a 30-minute timer. Commit to not searching until it rings. Track how the anxiety changes over those 30 minutes — it always decreases.',
      time: '30 min'
    },
    {
      title: 'Evidence Testing',
      desc: 'List all the times you were convinced you had a serious illness from online searching. How many were confirmed by a doctor? This builds realistic calibration of your health fears.',
      time: '10 min'
    }
  ],
  socialmedia: [
    {
      title: 'Urge Surfing',
      desc: 'When you want to check social media, pause and observe the urge without acting on it. Rate its intensity 1-10. Watch it rise and fall like a wave. You don\'t have to ride every wave.',
      time: '5 min'
    },
    {
      title: 'Behavioral Experiment',
      desc: 'Predict how you\'ll feel after 30 minutes of social media. Then do it and rate your actual mood. Most people rate lower than predicted — this data changes behavior.',
      time: '35 min'
    },
    {
      title: 'Values Clarification',
      desc: 'Write your top 5 life values. Then calculate what % of your social media use aligns with those values. The gap between values and behavior is where change begins.',
      time: '15 min'
    }
  ],
  shortform: [
    {
      title: 'Stimulus Control',
      desc: 'Remove TikTok/Reels from your home screen. Put them in a folder named "Deliberate Choice". This one friction point reduces mindless opening by up to 40%.',
      time: '2 min'
    },
    {
      title: 'Mindful Viewing',
      desc: 'Next time you open short videos, set a conscious intention: "I will watch for 10 minutes, then stop." Notice the pull to continue. Practicing awareness here builds control.',
      time: '10 min'
    },
    {
      title: 'Replacement Activity',
      desc: 'Identify the emotion you feel just before opening short videos. Design a 5-minute alternative for that specific emotion — boredom, stress, loneliness each need different responses.',
      time: '10 min'
    }
  ],
  gaming: [
    {
      title: 'Functional Analysis',
      desc: 'Map your gaming: What triggers it? What need does it meet (escape, mastery, connection)? What are the consequences? Understanding the function helps you meet the need differently.',
      time: '15 min'
    },
    {
      title: 'Scheduled Play',
      desc: 'Instead of playing when you feel the urge, schedule gaming at fixed times. This shifts gaming from reactive (driven by emotion) to deliberate (driven by choice).',
      time: 'Ongoing'
    },
    {
      title: 'Reality Testing',
      desc: 'List everything gaming has cost you in the last month (time, sleep, relationships, work). Then list what you\'ve gained. The imbalance often surprises people when written down.',
      time: '10 min'
    }
  ],
  ai: [
    {
      title: 'Independent Problem-Solving',
      desc: 'Before using AI, spend 10 minutes solving the problem yourself. Write your attempt. Then ask AI. Compare the results. This trains independent thinking alongside AI use.',
      time: '20 min'
    },
    {
      title: 'Dependency Audit',
      desc: 'For one week, track every time you use AI and why. Categorize: essential, helpful, or avoidable. The avoidable category reveals where dependency is growing.',
      time: '1 week'
    },
    {
      title: 'Confidence Building',
      desc: 'Make one decision today without consulting AI. Any decision. Write your reasoning. This exercises the decision-making muscle that AI use can atrophy.',
      time: '5 min'
    }
  ],
  workaddiction: [
    {
      title: 'Work Boundary Setting',
      desc: 'Write your work hours on paper. Share them with one colleague. The act of stating boundaries publicly increases commitment to honoring them by 65%.',
      time: '5 min'
    },
    {
      title: 'Rest Prescription',
      desc: 'Prescribe yourself rest like a doctor prescribes medicine: "I will rest from 7-9pm daily. This is non-negotiable for my health." Treat rest as medically essential.',
      time: 'Daily'
    },
    {
      title: 'Cost-Benefit Analysis',
      desc: 'List the benefits of overworking (short-term) and the costs (long-term). Most people discover costs they\'ve been avoiding seeing. Acknowledgment is the start of change.',
      time: '15 min'
    }
  ]
};

function renderCBTSection(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const topDisorder = getTopDisorder();
  const tips = CBT_TIPS[topDisorder];
  if(!tips || topDisorder === 'default'){
    el.innerHTML = '<div style="font-size:13px;color:var(--muted)">Complete an assessment to get personalized CBT exercises.</div>';
    return;
  }
  const d = DISORDERS.find(x => x.id === topDisorder);
  el.innerHTML = `
    <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Based on your highest concern: <strong style="color:${d?.color}">${d?.icon} ${d?.name}</strong></div>
    ${tips.map((tip, i) => `
      <div class="card" style="margin-bottom:10px;border-left:3px solid ${d?.color||'var(--accent)'}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">CBT Exercise ${i+1}: ${tip.title}</div>
          <div style="font-size:10px;background:var(--bg);padding:3px 8px;border-radius:20px;color:var(--muted);font-weight:700">⏱ ${tip.time}</div>
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.7">${tip.desc}</div>
      </div>`).join('')}`;
}
