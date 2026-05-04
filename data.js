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
    scale:'CSS-15',
    scaleRef:'McElroy & Shevlin, 2014; Barke et al., 2016 · Cyberchondria Severity Scale – Short Form',
    items:15,
    maxScore:75,
    questions:[
      // --- EXCESSIVENESS subscale (items 1, 2, 13) ---
      {t:"If I notice an unexplained bodily symptom, I search for it on the internet again and again.", hint:"e.g. a rash, lump, or pain somewhere"},
      {t:"I end up spending hours searching for health information online."},
      // --- COMPULSION subscale (items 3, 4, 7) ---
      {t:"I feel a strong urge to search for health information online, even when I don't need to."},
      {t:"I find it very hard to stop searching for health information online, even when I try."},
      // --- MISTRUST subscale (items 5, 12, 15) ---
      {t:"I disagree with my doctor's advice after finding different information online."},
      // --- DISTRESS subscale (items 6, 9, 14) ---
      {t:"I feel worried or anxious after searching for health information online."},
      // --- COMPULSION subscale continued ---
      {t:"Searching for health information online takes up a lot of my time."},
      // --- REASSURANCE subscale (items 8, 10, 11) ---
      {t:"After searching for health information online, I go to see a doctor."},
      // --- DISTRESS subscale continued ---
      {t:"I feel scared after reading health information online."},
      // --- REASSURANCE subscale continued ---
      {t:"After searching for symptoms online, I call or message a doctor or nurse."},
      {t:"After searching for symptoms online, I ask a family member or friend for their opinion."},
      // --- MISTRUST subscale continued ---
      {t:"I start doubting my doctor's diagnosis after reading about it online."},
      // --- EXCESSIVENESS subscale continued ---
      {t:"Even after finding an answer, I keep searching for more health information online."},
      // --- DISTRESS subscale continued ---
      {t:"After searching for health information online, I feel more worried than before I started."},
      // --- MISTRUST subscale continued ---
      {t:"I trust health information I find online more than what my doctor tells me."}
    ],
    options:["Never","Rarely","Sometimes","Often","Always"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:15,max:30,label:'Minimal',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your health searching behaviour is within normal limits.'},
      {min:31,max:45,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some signs of excessive health searching. Monitor your habits.'},
      {min:46,max:60,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Significant cyberchondria. Your online health searching is causing distress.'},
      {min:61,max:75,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe cyberchondria. Please consider speaking with a mental health professional.'}
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
    scale:'IGDS9-SF',
    scaleRef:'Pontes & Griffiths, 2015 · Internet Gaming Disorder Scale – Short Form · WHO ICD-11 aligned',
    items:9,
    maxScore:45,
    questions:[
      {t:"I think about gaming most of the time — even when I am not playing."},
      {t:"I feel sad, anxious, or irritable when I try to reduce or stop gaming."},
      {t:"I feel the need to spend increasing amounts of time playing games."},
      {t:"I have unsuccessfully tried to control, cut back, or stop gaming."},
      {t:"I have lost interest in hobbies or other activities because of gaming."},
      {t:"I continue gaming despite knowing it is causing problems in my life."},
      {t:"I deceive family members or others about how much I game."},
      {t:"I game to escape negative moods or relieve stress."},
      {t:"I have jeopardized or lost a relationship, job, or opportunity because of gaming."}
    ],
    options:["Never","Rarely","Sometimes","Often","Very Often"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:9,max:18,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your gaming habits appear healthy.'},
      {min:19,max:27,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some gaming disorder symptoms present.'},
      {min:28,max:36,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate gaming disorder. Gaming is interfering with daily life.'},
      {min:37,max:45,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe gaming disorder. Professional support recommended.'}
    ]
  },
  {
    id:'ai',
    name:'AI Dependency',
    icon:'🤖',
    color:'#00c9a7',
    bg:'rgba(0,201,167,0.1)',
    scale:'PCGUS',
    scaleRef:'Problematic ChatGPT Use Scale, 2025 · ⚠️ Turkish sample only — interpret with caution',
    items:9,
    maxScore:45,
    questions:[
      {t:"I think about using AI chatbots (ChatGPT, Gemini, etc.) even when I am not using them."},
      {t:"I feel anxious or restless when I cannot access AI chatbots."},
      {t:"I find myself using AI chatbots for longer than I originally planned."},
      {t:"I use AI chatbots to cope with stress, anxiety, or loneliness."},
      {t:"I have tried to reduce my AI chatbot use but found it difficult."},
      {t:"My use of AI chatbots has negatively affected my ability to think independently."},
      {t:"I prefer asking AI chatbots over consulting people or books."},
      {t:"I feel more comfortable sharing problems with AI chatbots than with people."},
      {t:"My reliance on AI chatbots has affected my relationships or work performance."}
    ],
    options:["Never","Rarely","Sometimes","Often","Very Often"],
    optionValues:[1,2,3,4,5],
    levels:[
      {min:9,max:18,label:'Low Risk',color:'#2ecc71',bg:'rgba(46,204,113,0.1)',desc:'Your AI tool use appears balanced and healthy.'},
      {min:19,max:27,label:'Mild',color:'#f5a623',bg:'rgba(245,166,35,0.1)',desc:'Some signs of over-reliance on AI tools.'},
      {min:28,max:36,label:'Moderate',color:'#ff6b35',bg:'rgba(255,107,53,0.1)',desc:'Moderate AI dependency affecting independent thinking.'},
      {min:37,max:45,label:'Severe',color:'#ff4757',bg:'rgba(255,71,87,0.1)',desc:'Severe AI dependency. Consider reducing reliance on AI tools.'}
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
    "I wake up during the night to check my phone or notifications.",
    "I feel tired during the day because of late-night device use.",
    "Notifications or digital activity disturb my sleep quality."
  ]},
  {id:'attention',name:'Attention & Focus',icon:'🧠',color:'#3d6fff',questions:[
    "I find it difficult to concentrate on long tasks without checking my phone.",
    "I frequently switch between apps or digital tasks.",
    "Notifications interrupt my focus and concentration.",
    "I lose concentration easily after checking my phone or social media.",
    "I struggle to read long articles or books without getting distracted."
  ]},
  {id:'productivity',name:'Productivity',icon:'⚡',color:'#f5a623',questions:[
    "Digital distractions interrupt my work or study regularly.",
    "I check my phone while working or studying.",
    "I postpone important tasks because of online activities.",
    "My overall productivity has decreased due to digital distractions.",
    "I struggle to complete tasks without checking my phone or apps."
  ]},
  {id:'emotional',name:'Emotional Health',icon:'❤️',color:'#ff4757',questions:[
    "I feel anxious or unsettled when I cannot access my phone.",
    "I feel stressed by constant notifications and digital demands.",
    "My mood is affected by social media activity or online interactions.",
    "I feel mentally exhausted after prolonged screen use.",
    "Digital activity sometimes makes me feel overwhelmed or hopeless."
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
const TIPS_BY_DISORDER = {
  cyberchondria:["Set a strict 20-minute daily limit for health-related searches using screen time controls.","When you feel the urge to search symptoms, write them down and wait 30 minutes before searching.","Replace health search habits with a trusted medical helpline or your doctor's contact.","Unsubscribe from health newsletters and symptom-checker websites that trigger anxiety.","Schedule a monthly check-in with your doctor instead of daily online symptom searches.","Practice the 5-4-3-2-1 grounding technique when health anxiety urges arise.","Tell a trusted person about your health search habits — accountability reduces compulsion.","Use the PAUSE App to track how often you feel the urge to search health information."],
  socialmedia:["Enable built-in screen time limits on all social media apps — start with 45 minutes per day.","Turn off all social media push notifications. Check manually at fixed times only.","Install a grayscale filter on your phone to reduce the visual reward of scrolling.","Delete the social media apps from your phone and access them only via browser.","Designate two fixed 20-minute windows per day for checking social media — stick to them.","Audit who you follow — unfollow anyone whose content makes you feel worse about yourself.","Replace your morning social media check with a 5-minute journaling or stretching routine.","Try a 48-hour social media fast this weekend and note how you feel."],
  shortform:["Delete TikTok, Reels, and Shorts apps for 7 days and notice the difference in your attention span.","Replace your first 15 minutes of short video watching with a 10-minute walk.","Set your phone to auto-lock after 5 minutes of inactivity to interrupt passive scrolling.","Move short video apps to a folder on the last page of your home screen — friction reduces use.","Set a maximum of 3 short video sessions per day with a 10-minute limit each.","Replace one short video session daily with a podcast or audiobook on a topic you care about.","Notice your emotional state before opening a short video app — boredom, stress, or loneliness?","Track your daily short video screen time for one week and review the total honestly."],
  gaming:["Set a hard 2-hour daily gaming limit using parental controls or an app timer.","Establish gaming-free zones: no gaming after 9pm and not before completing daily priorities.","Replace one gaming session per week with a physical outdoor activity.","Tell someone you trust about your gaming limits and ask them to check in with you.","Remove gaming apps from your phone — play only on dedicated devices with time limits.","Identify your gaming triggers (stress, boredom, loneliness) and address the root cause.","Join a sports team, gym class, or hobby group to replace gaming time with social activity.","Take a full gaming detox for 7 days and journal how you spend the reclaimed time."],
  ai:["Challenge yourself to solve at least one problem per day entirely without AI assistance.","Before asking an AI, spend 5 minutes attempting to find the answer independently.","Use AI as a reviewer, not a creator — write your own drafts first, then ask for feedback.","Set a daily AI usage limit of 30 minutes for non-essential tasks.","Practice writing emails, reports, and messages entirely on your own at least 3 times per week.","When learning something new, read a book or article first before consulting AI.","Reflect weekly: which decisions did you make independently vs. outsourced to AI?","Have one meaningful conversation per day with a real person instead of an AI chatbot."],
  workaddiction:["Set a firm daily work cut-off time and enforce it with a phone alarm labeled 'Stop Working'.","Disable work email notifications after 7pm on all devices.","Schedule at least one full screen-free hour per day for non-work activities.","Take your full lunch break away from your desk and without checking work messages.","Plan one full work-free day per week — protect it as non-negotiable.","List 3 non-work activities that bring you joy and schedule them this week.","Communicate your work hours clearly to colleagues to reduce after-hours expectations.","Reflect on whether your work volume is self-imposed or externally driven — the answer matters."]
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
