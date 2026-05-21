// ============================================================
// SUPABASE INIT
// ============================================================
const SUPABASE_URL = 'https://qwcnoosblqdwbgntixnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_URueIVja3Rfu3eSt_iLaDA_SMlLvl9L';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// DATA
// ============================================================
const DISORDERS = [
  {
    id:'cyberchondria',
    name:'Cyberchondria',
    icon:'🔍',
    color:'#3d6fff',
    bg:'rgba(61,111,255,0.1)',
    scale:'CSS-12',
    scaleRef:'McElroy, Kearney, Touhey, Evans, Cooke & Shevlin, 2019 · Cyberchondria Severity Scale – Short Form (CSS-12)',
    items:12,
    maxScore:60,
    questions:[
      // --- EXCESSIVENESS subscale (items 1, 3, 6) ---
      {t:"If I notice an unusual sensation in my body, I search for it on the internet.", hint:"Please answer all questions in this section thinking about conditions you think you might have — not conditions a doctor has already diagnosed."},
      // --- COMPULSION subscale (items 2, 7, 10) ---
      {t:"Searching for symptoms online distracts me from reading news, sports, or entertainment online."},
      // --- EXCESSIVENESS subscale continued ---
      {t:"I read many different websites about the same possible illness."},
      // --- DISTRESS subscale (items 4, 8, 9) ---
      {t:"I start to panic when I read online that my symptom is linked to a rare or serious illness."},
      // --- REASSURANCE subscale (items 5, 11, 12) ---
      {t:"After searching for symptoms online, I go to consult my doctor."},
      // --- EXCESSIVENESS subscale continued ---
      {t:"I search for the same symptoms online more than once."},
      // --- COMPULSION subscale continued ---
      {t:"Searching for symptoms online interrupts my work (like emails or office work)."},
      // --- DISTRESS subscale continued ---
      {t:"I think I am fine — until I read about a serious illness online."},
      // --- DISTRESS subscale continued ---
      {t:"I feel more worried or anxious after searching about my symptoms online."},
      // --- COMPULSION subscale continued ---
      {t:"Searching for symptoms online reduces my time with family or friends."},
      // --- REASSURANCE subscale continued ---
      {t:"I ask my doctor for a specific test that I read about online (like a blood test or a scan)."},
      // --- REASSURANCE subscale continued ---
      {t:"After searching symptoms online, I also go to other specialist doctors."}
    ],
    options:["Never","Rarely","Sometimes","Often","Always"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:12,max:24,label:'Minimal',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your online health searching is within normal limits.'},
      {min:25,max:36,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some signs of excessive online health searching. Monitor your habits.'},
      {min:37,max:48,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Significant cyberchondria. Your online health searching may be causing distress.'},
      {min:49,max:60,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe cyberchondria. Please consider speaking with a mental health professional.'}
    ]
  },
  {
    id:'socialmedia',
    name:'Social Media Addiction',
    icon:'📱',
    color:'#7c5cbf',
    bg:'rgba(124,92,191,0.1)',
    scale:'BSMAS',
    scaleRef:'Andreassen et al., 2016 · Bergen Social Media Addiction Scale',
    items:6,
    maxScore:30,
    questions:[
      {t:"How often in the past year have you spent a lot of time thinking about social media or planning to use it?", hint:"e.g. thinking about what others have posted, planning what you'll post next, or looking forward to checking social media"},
      {t:"How often in the past year have you felt an urge to use social media more and more?"},
      {t:"How often in the past year have you used social media to forget about personal problems?"},
      {t:"How often in the past year have you tried to cut down on social media use without success?"},
      {t:"How often in the past year have you become restless or troubled if you were unable to use social media?"},
      {t:"How often in the past year have you used social media so much that it has had a negative impact on your job or studies?"}
    ],
    options:["Very Rarely","Rarely","Sometimes","Often","Very Often"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:6,max:12,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your social media use appears healthy and balanced.'},
      {min:13,max:18,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some addictive patterns present. Be mindful of usage habits.'},
      {min:19,max:24,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate social media addiction. Consider usage limits.'},
      {min:25,max:30,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe social media addiction affecting your daily life.'}
    ]
  },
  {
    id:'shortform',
    name:'Short-Form Video Addiction',
    icon:'🎬',
    color:'#ff4757',
    bg:'rgba(255,71,87,0.1)',
    scale:'SVAS-6',
    scaleRef:'Zhang et al., 2022 · Short-Form Video Addiction Scale',
    items:6,
    maxScore:30,
    questions:[
      {t:"I spend more time watching short videos (TikTok, Reels, Shorts) than I intend to."},
      {t:"I feel restless or irritable when I cannot watch short videos."},
      {t:"I have tried to reduce my short video watching but failed."},
      {t:"Short video watching has negatively affected my work, study, or relationships."},
      {t:"I use short videos to escape problems or relieve negative feelings."},
      {t:"I continue watching short videos despite knowing it is harming me."}
    ],
    options:["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:6,max:12,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your short video consumption is within healthy limits.'},
      {min:13,max:18,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some signs of problematic short video use.'},
      {min:19,max:24,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate addiction to short-form video content.'},
      {min:25,max:30,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe short-form video addiction significantly impacting your life.'}
    ]
  },
  {
    id:'gaming',
    name:'Gaming Disorder',
    icon:'🎮',
    color:'#2ecc71',
    bg:'rgba(46,204,113,0.1)',
    scale:'GDT',
    scaleRef:'Pontes, Schivinski, Sindermann, Li, Becker, Zhou & Montag, 2021 · Gaming Disorder Test · WHO ICD-11 aligned',
    items:4,
    maxScore:20,
    questions:[
      {t:"I had real trouble controlling how much I played video games.", hint:"Please answer thinking about your gaming activity over the past 12 months."},
      {t:"I gave gaming more priority than other things in life — like work, study, family or hobbies."},
      {t:"I kept playing video games even when it was causing problems in my life."},
      {t:"I lost or damaged something important because of gaming — a relationship, a job, my studies, or an opportunity."}
    ],
    options:["Never","Rarely","Sometimes","Often","Very Often"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:4,max:8,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your gaming habits appear healthy.'},
      {min:9,max:12,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some gaming disorder symptoms present.'},
      {min:13,max:16,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate gaming disorder. Gaming is interfering with daily life.'},
      {min:17,max:20,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe gaming disorder. Professional support recommended.'}
    ]
  },
  {
    id:'ai',
    name:'AI Dependency',
    icon:'🤖',
    color:'#00c9a7',
    bg:'rgba(0,201,167,0.1)',
    scale:'PCUS',
    scaleRef:'Yu, Chen & Yang, 2024 · Current Psychology · Problematic ChatGPT Use Scale (PCUS), adapted to AI chatbots with permission from Sen-Chi Yu, PhD',
    items:11,
    maxScore:44,
    // ============================================================
    // PCUS — Problematic ChatGPT Use Scale (Yu, Chen & Yang, 2024)
    // DOI: 10.1007/s12144-024-06259-z · Current Psychology, 43(31), 26080–26092
    // Validated on 1,040 Taiwanese adults. Single-factor structure.
    // 4-point Likert (1=Never, 2=Sometimes, 3=Often, 4=Always)
    // Recall window: the past 2 weeks. Score range: 11–44.
    //
    // Adapted for the PAUSE App with written permission from the original
    // author (Sen-Chi Yu, PhD) granted May 2026. Adaptations made:
    //   (a) "ChatGPT" replaced with "AI chatbots" (his suggestion, covering
    //        ChatGPT, Gemini, Claude, etc.)
    //   (b) Plain-English refinement for general-public readability in India,
    //        replacing clinical terms (e.g. "alleviate", "deceived",
    //        "sleep deprivation") with everyday language; grammar corrected
    //        in items 6 and 10.
    // The original theoretical construct and addiction-framework basis are
    // preserved. The plain-language adaptation is being sent to the scale
    // author for review.
    // ============================================================
    questions:[
      {t:"I thought about AI chatbots (ChatGPT, Gemini, Claude, etc.) even when I wasn't using them.",
       hint:"The next 11 questions ask about how often you've used AI chatbots over the past 2 weeks."},
      {t:"I opened AI chatbots even when I hadn't planned to use them."},
      {t:"I felt anxious or irritated when I couldn't use AI chatbots."},
      {t:"I spent more and more time on AI chatbots."},
      {t:"I tried to cut down on my AI chatbot use but couldn't."},
      {t:"I lost interest in things I used to enjoy because of AI chatbots."},
      {t:"Using AI chatbots made me put off important tasks."},
      {t:"I spent too much time on AI chatbots even though it caused problems."},
      {t:"I lost sleep because I used AI chatbots too much."},
      {t:"I hid how much I use AI chatbots from family, friends, or my doctor."},
      {t:"I used AI chatbots to deal with feelings of helplessness or anxiety."}
    ],
    options:["Never","Sometimes","Often","Always"],
    optionValues:[1,2,3,4],
    // Severity bands — quartile partition of the 11–44 score range.
    // Yu's 2024 validation paper did not establish published clinical
    // cut-offs; these are pragmatic in-app feedback bands, clearly labelled
    // as such in the methods. To be refined empirically once PAUSE has
    // collected a sufficient Indian sample.
    levels:[
      {min:11,max:19,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your AI chatbot use looks balanced and healthy.'},
      {min:20,max:27,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some early signs of over-reliance on AI chatbots.'},
      {min:28,max:35,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Your AI chatbot use is starting to affect your daily life.'},
      {min:36,max:44,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Significant signs of AI chatbot dependency. Consider talking to someone you trust about cutting down.'}
    ]
  },
  {
    id:'workaddiction',
    name:'Digital Work Addiction',
    icon:'💼',
    color:'#ff6b35',
    bg:'rgba(255,107,53,0.1)',
    scale:'BWAS',
    scaleRef:'Andreassen et al., 2012 · Bergen Work Addiction Scale',
    items:7,
    maxScore:35,
    questions:[
      {t:"I think about how I can free up more time to work online."},
      {t:"I spend much more time working digitally than I originally intended."},
      {t:"I work online to reduce feelings of guilt, anxiety, helplessness, or depression."},
      {t:"I have been told by others to reduce my digital work but ignored their advice."},
      {t:"I become stressed if I am unable to check emails or work online."},
      {t:"I deprioritize hobbies, leisure, and exercise because of digital work."},
      {t:"I work so much digitally that it has negatively influenced my health."}
    ],
    options:["Never","Rarely","Sometimes","Often","Always"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:7,max:14,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your digital work habits appear healthy.'},
      {min:15,max:21,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some signs of excessive digital work engagement.'},
      {min:22,max:28,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate work addiction affecting personal life.'},
      {min:29,max:35,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe digital work addiction. Work is dominating your life.'}
    ]
  }
];

const IMPACT_MODULES = [
  {id:'sleep',name:'Sleep Disruption',icon:'😴',color:'#7c5cbf',questions:[
    "I use my phone or device immediately before sleeping.",
    "My bedtime is delayed because of digital activities.",
    "I feel tired during the day because of late-night device use."
  ]},
  {id:'attention',name:'Attention & Focus',icon:'🧠',color:'#3d6fff',questions:[
    "I find it difficult to concentrate on long tasks without checking my phone.",
    "Notifications interrupt my focus and concentration.",
    "I struggle to read long articles or books without getting distracted."
  ]},
  {id:'productivity',name:'Productivity',icon:'⚡',color:'#f5a623',questions:[
    "Digital distractions interrupt my work or study regularly.",
    "I postpone important tasks because of online activities.",
    "My overall productivity has decreased due to digital distractions."
  ]},
  {id:'emotional',name:'Emotional Health',icon:'❤️',color:'#ff4757',questions:[
    "I feel anxious or unsettled when I cannot access my phone.",
    "My mood is affected by social media activity or online interactions.",
    "I feel mentally exhausted after prolonged screen use."
  ]}
];

const IMPACT_OPTIONS = ["Never","Rarely","Sometimes","Often","Always"];
const IMPACT_OPTION_VALUES = [0,1,2,3,4];

// CHALLENGES — generic lifestyle/behavioral nudges. Used as the dedicated
// "wildcard" pool for the +1 slot in each personalized 7-day challenge pack
// (see progress.js). Also previously the static source for the whole 7-day
// challenge before pack personalization landed.
const CHALLENGES = [
  {text:"No social media before 9am", icon:"🌅"},
  {text:"Phone-free meals — every meal today", icon:"🍽️"},
  {text:"No screens after 10pm tonight", icon:"🌙"},
  {text:"Check WhatsApp only 3 times today", icon:"💬"},
  {text:"Check email only 3 times today", icon:"📧"},
  {text:"Take a 30-minute walk without your phone", icon:"🚶"},
  {text:"Share your PAUSE score and challenge a friend", icon:"🤝"}
];

// TIPS_BY_DISORDER — 8 actionable tips per disorder. Consumed by
// renderActionPlan (results.js) and the personalized challenge pack
// generator (progress.js). Order matters for the action plan, which slices
// from the front based on severity. Tip "IDs" are synthesized on demand as
// "<disorderId>:<index>" — see _pickTips in progress.js.
//
// Each tip is an object: { text, cbtModuleId? }. The optional cbtModuleId
// links the tip to a CBT_MODULES_V2 entry (cbt.js) — clicking the tip in
// the Action Plan opens a modal with the full module. Multiple tips can
// share the same cbtModuleId. Tips without a module fall through to a
// "More guidance coming soon" placeholder modal.
const TIPS_BY_DISORDER = {
  cyberchondria:[
    {text:"Set a strict 20-minute daily limit for health-related searches using screen time controls.", cbtModuleId:'search-budget'},
    {text:"When you feel the urge to search symptoms, write them down and wait 30 minutes before searching."},
    {text:"Replace health search habits with a trusted medical helpline or your doctor's contact."},
    {text:"Unsubscribe from health newsletters and symptom-checker websites that trigger anxiety."},
    {text:"Schedule a monthly check-in with your doctor instead of daily online symptom searches."},
    {text:"Practice the 5-4-3-2-1 grounding technique when health anxiety urges arise."},
    {text:"Tell a trusted person about your health search habits — accountability reduces compulsion."},
    {text:"Use the PAUSE App to track how often you feel the urge to search health information."}
  ],
  socialmedia:[
    {text:"Enable built-in screen time limits on all social media apps — start with 45 minutes per day."},
    {text:"Turn off all social media push notifications. Check manually at fixed times only."},
    {text:"Install a grayscale filter on your phone to reduce the visual reward of scrolling."},
    {text:"Delete the social media apps from your phone and access them only via browser."},
    {text:"Designate two fixed 20-minute windows per day for checking social media — stick to them."},
    {text:"Audit who you follow — unfollow anyone whose content makes you feel worse about yourself."},
    {text:"Replace your morning social media check with a 5-minute journaling or stretching routine."},
    {text:"Try a 48-hour social media fast this weekend and note how you feel."}
  ],
  shortform:[
    {text:"Delete TikTok, Reels, and Shorts apps for 7 days and notice the difference in your attention span."},
    {text:"Replace your first 15 minutes of short video watching with a 10-minute walk."},
    {text:"Set your phone to auto-lock after 5 minutes of inactivity to interrupt passive scrolling."},
    {text:"Move short video apps to a folder on the last page of your home screen — friction reduces use."},
    {text:"Set a maximum of 3 short video sessions per day with a 10-minute limit each."},
    {text:"Replace one short video session daily with a podcast or audiobook on a topic you care about."},
    {text:"Notice your emotional state before opening a short video app — boredom, stress, or loneliness?"},
    {text:"Track your daily short video screen time for one week and review the total honestly."}
  ],
  gaming:[
    {text:"Set a hard 2-hour daily gaming limit using parental controls or an app timer."},
    {text:"Establish gaming-free zones: no gaming after 9pm and not before completing daily priorities."},
    {text:"Replace one gaming session per week with a physical outdoor activity."},
    {text:"Tell someone you trust about your gaming limits and ask them to check in with you."},
    {text:"Remove gaming apps from your phone — play only on dedicated devices with time limits."},
    {text:"Identify your gaming triggers (stress, boredom, loneliness) and address the root cause."},
    {text:"Join a sports team, gym class, or hobby group to replace gaming time with social activity."},
    {text:"Take a full gaming detox for 7 days and journal how you spend the reclaimed time."}
  ],
  ai:[
    {text:"Challenge yourself to solve at least one problem per day entirely without AI assistance."},
    {text:"Before asking an AI, spend 5 minutes attempting to find the answer independently."},
    {text:"Use AI as a reviewer, not a creator — write your own drafts first, then ask for feedback."},
    {text:"Set a daily AI usage limit of 30 minutes for non-essential tasks."},
    {text:"Practice writing emails, reports, and messages entirely on your own at least 3 times per week."},
    {text:"When learning something new, read a book or article first before consulting AI."},
    {text:"Reflect weekly: which decisions did you make independently vs. outsourced to AI?"},
    {text:"Have one meaningful conversation per day with a real person instead of an AI chatbot."}
  ],
  workaddiction:[
    {text:"Set a firm daily work cut-off time and enforce it with a phone alarm labeled 'Stop Working'."},
    {text:"Disable work email notifications after 7pm on all devices."},
    {text:"Schedule at least one full screen-free hour per day for non-work activities."},
    {text:"Take your full lunch break away from your desk and without checking work messages."},
    {text:"Plan one full work-free day per week — protect it as non-negotiable."},
    {text:"List 3 non-work activities that bring you joy and schedule them this week."},
    {text:"Communicate your work hours clearly to colleagues to reduce after-hours expectations."},
    {text:"Reflect on whether your work volume is self-imposed or externally driven — the answer matters."}
  ]
};

// IMPACT_TIPS — per-impact-module tip pools. Lifted from the inline blocks
// previously in results.js renderActionPlan so the personalized challenge
// (progress.js Day 7) and the action plan share the same content. 4 tips
// per module, 16 total. Order matters for the action plan, which appends
// in order; Day 7 of the challenge picks index 0 by default.
const IMPACT_TIPS = {
  sleep: [
    {text:"Keeping your phone charging outside the bedroom can make a surprising difference to your sleep quality.", color:"#7c5cbf", icon:"😴"},
    {text:"A gentle digital wind-down — no screens in the hour before bed — can really help you sleep more deeply.", color:"#7c5cbf", icon:"😴"},
    {text:"Enabling Night Shift or a blue light filter from 8pm onwards is a small change with a big impact.", color:"#7c5cbf", icon:"😴"},
    {text:"Try a 15-minute bedtime routine: dim lights, no phone, something light to read. Your sleep will thank you.", color:"#7c5cbf", icon:"😴"}
  ],
  attention: [
    {text:"The Pomodoro technique — 25 minutes of focused work, then a 5-minute break — is a gentle way to rebuild concentration.", color:"#3d6fff", icon:"🧠"},
    {text:"Putting your phone face-down during tasks that need your full attention is simple but genuinely effective.", color:"#3d6fff", icon:"🧠"},
    {text:"Reading a physical book for even 20 minutes daily is a wonderful way to rebuild your focus gradually.", color:"#3d6fff", icon:"🧠"},
    {text:"Reducing notifications — keeping only calls and messages from people who matter — can give you back remarkable amounts of focus.", color:"#3d6fff", icon:"🧠"}
  ],
  productivity: [
    {text:"App timers like Forest or Focus Mode during your peak work hours can gently nudge your focus back where it belongs.", color:"#f5a623", icon:"⚡"},
    {text:"Writing down your 3 most important tasks each morning — before opening social media — is a small habit with a big payoff.", color:"#f5a623", icon:"⚡"},
    {text:"Batching emails and messages into two fixed daily windows frees up remarkable amounts of mental energy.", color:"#f5a623", icon:"⚡"},
    {text:"Keeping your phone in another room during your most important 2 hours of the day is one of the most effective things you can do.", color:"#f5a623", icon:"⚡"}
  ],
  emotional: [
    {text:"A 10-minute breathing or mindfulness pause before any screen session can transform how you feel during it.", color:"#ff4757", icon:"❤️"},
    {text:"Muting or unfollowing content that consistently leaves you feeling less-than is a genuinely kind act of self-care.", color:"#ff4757", icon:"❤️"},
    {text:"One screen-free social activity per week — a walk, a meal, a phone call — does wonders for your emotional wellbeing.", color:"#ff4757", icon:"❤️"},
    {text:"A few minutes of journaling before bed about how you felt today is a surprisingly powerful way to build self-awareness.", color:"#ff4757", icon:"❤️"}
  ]
};

// Plain-English challenge-day labels for personalized packs.
const DISORDER_DAY_LABEL = {
  cyberchondria:'Health Anxiety Reset',
  socialmedia:  'Social Media Reset',
  shortform:    'Short-Form Video Reset',
  gaming:       'Gaming Reset',
  ai:           'AI Dependency Reset',
  workaddiction:'Work Boundaries Reset'
};
const IMPACT_DAY_LABEL = {
  sleep:       'Sleep Reset',
  attention:   'Focus Reset',
  productivity:'Productivity Reset',
  emotional:   'Emotional Reset'
};

const BADGES = [
  {id:'first_assessment',emoji:'🎯',name:'First Steps',desc:'Completed your first assessment',condition: s => s.totalAssessments >= 1},
  {id:'full_assessment',emoji:'🔬',name:'Scientist',desc:'Completed a Full Assessment',condition: s => s.fullAssessments >= 1},
  {id:'clean_score',emoji:'✨',name:'Digital Clean',desc:'Scored 80+ on Digital Wellness Score',condition: s => s.bestDWS >= 80},
  {id:'week_champion',emoji:'🏆',name:'Week Champion',desc:'Completed all 7 detox challenges',condition: s => s.challengeWeeksCompleted >= 1},
  {id:'improver',emoji:'📈',name:'Improver',desc:'Improved your DWS score',condition: s => s.improvedScore},
  {id:'streak_3',emoji:'🔥',name:'On Fire',desc:'Completed 3 challenge days in a row',condition: s => s.maxStreak >= 3},
  {id:'social_sharer',emoji:'📣',name:'Advocate',desc:'Shared your PAUSE score',condition: s => s.shared},
  {id:'all_disorders',emoji:'🌟',name:'Complete Screener',desc:'Screened all 6 disorders',condition: s => s.disordersScreened >= 6},
  {id:'consistent',emoji:'📅',name:'Consistent',desc:'Completed 3 or more assessments',condition: s => s.totalAssessments >= 3}
];
