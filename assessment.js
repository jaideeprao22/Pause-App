// ============================================================
// ASSESSMENT ENGINE
// ============================================================
function buildFullAssessment(){
  allQuestions=[]; questionMeta=[];
  DISORDERS.forEach((d,di) => d.questions.forEach((q,qi) => {
    allQuestions.push({text:q.t, hint:q.hint||null, options:d.options, values:d.optionValues, scaleInfo:`${d.name} · ${d.scale}`, disorderIdx:di});
    questionMeta.push({type:'disorder', dIdx:di, qIdx:qi});
  }));
  IMPACT_MODULES.forEach((m,mi) => m.questions.forEach((q,qi) => {
    allQuestions.push({text:q, options:IMPACT_OPTIONS, values:IMPACT_OPTION_VALUES, scaleInfo:`Health Impact · ${m.name}`, impactIdx:mi});
    questionMeta.push({type:'impact', mIdx:mi, qIdx:qi});
  }));
}

function buildQuickAssessment(){
  allQuestions=[]; questionMeta=[];
  IMPACT_MODULES.forEach((m,mi) => m.questions.forEach((q,qi) => {
    allQuestions.push({text:q, options:IMPACT_OPTIONS, values:IMPACT_OPTION_VALUES, scaleInfo:`Health Impact · ${m.name}`, impactIdx:mi});
    questionMeta.push({type:'impact', mIdx:mi, qIdx:qi});
  }));
}

function buildSingleAssessment(dIdx){
  allQuestions=[]; questionMeta=[];
  const d = DISORDERS[dIdx];
  d.questions.forEach((q,qi) => {
    allQuestions.push({text:q.t, hint:q.hint||null, options:d.options, values:d.optionValues, scaleInfo:`${d.name} · ${d.scale}`, disorderIdx:dIdx});
    questionMeta.push({type:'disorder', dIdx:dIdx, qIdx:qi});
  });
}

// ============================================================
// DISORDER TIMESTAMPS
// ============================================================
const TIMESTAMPS_KEY = 'pause_disorder_timestamps';

function stampDisorderTime(id){
  const ts = JSON.parse(localStorage.getItem(TIMESTAMPS_KEY)||'{}');
  ts[id] = Date.now();
  localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(ts));
}

function getDisorderTimestamps(){
  try{ return JSON.parse(localStorage.getItem(TIMESTAMPS_KEY)||'{}'); }
  catch(e){ return {}; }
}

// ============================================================
// PARTIAL PROGRESS
// ============================================================
const PARTIAL_KEY = 'pause_partial_full_assessment';

function savePartialProgress(){
  if(assessMode !== 'full') return;

  DISORDERS.forEach((d,di) => {
    const metas = questionMeta.map((m,i)=>({...m,aIdx:i})).filter(m=>m.type==='disorder'&&m.dIdx===di);
    if(metas.length>0 && metas.every(m=>allAnswers[m.aIdx]!==null)){
      const wasUnscored = disorderScores[d.id]===undefined;
      disorderScores[d.id] = metas.reduce((sum,m)=>sum+(allAnswers[m.aIdx]||0),0);
      // BUG1 FIX: save lowercase so CBT module keys match
      AppGrades.update(d.id, getLevel(d,disorderScores[d.id]).label.toLowerCase());
      if(wasUnscored) stampDisorderTime(d.id);
    }
  });

  // BUG8 FIX: stamp impact modules too
  IMPACT_MODULES.forEach((m,mi) => {
    const metas = questionMeta.map((meta,i)=>({...meta,aIdx:i})).filter(meta=>meta.type==='impact'&&meta.mIdx===mi);
    if(metas.length>0 && metas.every(meta=>allAnswers[meta.aIdx]!==null)){
      const wasUnscored = impactScores[m.id]===undefined;
      impactScores[m.id] = metas.reduce((sum,meta)=>sum+(allAnswers[meta.aIdx]||0),0);
      if(wasUnscored) stampDisorderTime(m.id);
    }
  });

  const partialDWS = calculateDWS();
  if(partialDWS!==null){ dwsScore=partialDWS; updateDWSDisplay(); }

  if(Object.keys(disorderScores).length>0 || Object.keys(impactScores).length>0){
    saveScores();
    if(typeof renderHomeDisorders==='function') renderHomeDisorders();
  }

  localStorage.setItem(PARTIAL_KEY, JSON.stringify({
    answers:allAnswers, currentQ:currentQIdx,
    disorderScores, impactScores, dwsScore, timestamp:Date.now()
  }));
}

function clearPartialProgress(){ localStorage.removeItem(PARTIAL_KEY); }

function checkResumeAssessment(){
  const raw = localStorage.getItem(PARTIAL_KEY);
  if(!raw) return null;
  try{
    const partial = JSON.parse(raw);
    if(Date.now()-partial.timestamp>86400000){ clearPartialProgress(); return null; }
    return partial;
  }catch(e){ clearPartialProgress(); return null; }
}

function showResumeModal(partial){
  if(!partial){ _doStartFullAssessment(); return; } // BUG3 FIX: partial expired between modal open and click
  const completedDisorders = DISORDERS.filter(d=>partial.disorderScores&&partial.disorderScores[d.id]!==undefined);
  const qDone = partial.currentQ+1;
  const qTotal = partial.answers.length;
  const pct = Math.round((qDone/qTotal)*100);
  const chips = completedDisorders.map(d=>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:${d.bg};color:${d.color};border:1px solid ${d.color}40;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700">${d.icon} ${d.name}</span>`
  ).join('');
  const existing = document.getElementById('resumeAssessModal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id='resumeAssessModal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML=`
    <div style="background:var(--card);border-radius:20px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
      <div style="font-size:28px;text-align:center;margin-bottom:8px">📋</div>
      <div style="font-size:18px;font-weight:800;color:var(--text);text-align:center;margin-bottom:6px">Unfinished Check-Up Found</div>
      <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px">You completed <strong style="color:var(--text)">${qDone} of ${qTotal} questions</strong> (${pct}%)</div>
      ${completedDisorders.length>0?`
        <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Already scored & saved</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">${chips}</div>
      `:''}
      <div style="font-size:12px;color:var(--muted);background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:20px">
        💡 Your completed sections are already saved — resume to pick up exactly where you left off.
      </div>
      <button onclick="resumePartialAssessment()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;font-family:inherit">▶ Resume Check-Up</button>
      <button onclick="discardAndStartFresh()" style="width:100%;padding:12px;background:none;color:var(--muted);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Start Fresh Instead</button>
    </div>`;
  document.body.appendChild(modal);
}

// BUG2 FIX: try/catch around JSON.parse
function resumePartialAssessment(){
  const raw = localStorage.getItem(PARTIAL_KEY);
  if(!raw) return;
  try{
    const partial = JSON.parse(raw);
    document.getElementById('resumeAssessModal')?.remove();
    assessMode='full'; buildFullAssessment();
    allAnswers=partial.answers; currentQIdx=partial.currentQ;
    Object.assign(disorderScores, partial.disorderScores||{});
    Object.assign(impactScores, partial.impactScores||{});
    if(partial.dwsScore!=null){ dwsScore=partial.dwsScore; updateDWSDisplay(); }
    showScreen('screen-assessment'); renderQuestion();
  }catch(e){
    clearPartialProgress();
    document.getElementById('resumeAssessModal')?.remove();
    assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0;
    showScreen('screen-assessment'); renderQuestion();
  }
}

function discardAndStartFresh(){
  document.getElementById('resumeAssessModal')?.remove();
  clearPartialProgress();
  assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0;
  showScreen('screen-assessment'); renderQuestion();
}

// FEATURE9: Save & Exit mid-assessment
function saveAndExitAssessment(){
  savePartialProgress();
  showScreen('screen-home');
  showToast('✅ Progress saved — resume anytime from the check-up menu.'); // BUG10 FIX
}

// BUG5 FIX: warn if partial full assessment exists when starting single
function startSingleAssessmentWithCheck(dIdx){
  const partial = checkResumeAssessment();
  if(partial){
    const completedDisorders = DISORDERS.filter(d=>partial.disorderScores&&partial.disorderScores[d.id]!==undefined);
    const existing = document.getElementById('singleOverPartialModal');
    if(existing) existing.remove();
    const modal = document.createElement('div');
    modal.id='singleOverPartialModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML=`
      <div style="background:var(--card);border-radius:20px;padding:24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
        <div style="font-size:24px;text-align:center;margin-bottom:8px">⚠️</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);text-align:center;margin-bottom:8px">Full Check-Up In Progress</div>
        <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px;line-height:1.6">
          You have an unfinished Full Check-Up (${completedDisorders.length} of 6 disorder areas saved).<br>
          Starting a single check will keep your full check-up saved for later.
        </div>
        <button onclick="document.getElementById('singleOverPartialModal').remove();startSingleAssessment(${dIdx})" style="width:100%;padding:13px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;font-family:inherit">Start Single Check Anyway</button>
        <button onclick="document.getElementById('singleOverPartialModal').remove();showResumeModal(checkResumeAssessment())" style="width:100%;padding:11px;background:none;color:var(--muted);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Resume Full Check-Up Instead</button>
      </div>`;
    document.body.appendChild(modal);
    return;
  }
  startSingleAssessment(dIdx);
}

// FEATURE5: Guest mode warning before full assessment
function startFullAssessment(){
  // Guest warning
  if(!currentUser && !localStorage.getItem('guestAssessWarningShown')){
    const existing = document.getElementById('guestWarnModal');
    if(existing) existing.remove();
    const modal = document.createElement('div');
    modal.id='guestWarnModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML=`
      <div style="background:var(--card);border-radius:20px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
        <div style="font-size:32px;text-align:center;margin-bottom:8px">🔒</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);text-align:center;margin-bottom:8px">Save Your Results?</div>
        <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:18px;line-height:1.6">
          You're about to spend 20+ minutes on your check-up.<br><br>
          <strong style="color:var(--text)">Sign in first</strong> so your results are never lost — even if you clear the app or switch devices.
        </div>
        <button onclick="document.getElementById('guestWarnModal').remove();openLoginFlow()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;font-family:inherit">🔐 Sign In First (Recommended)</button>
        <button onclick="localStorage.setItem('guestAssessWarningShown','true');document.getElementById('guestWarnModal').remove();_doStartFullAssessment()" style="width:100%;padding:12px;background:none;color:var(--muted);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Continue Without Signing In</button>
      </div>`;
    document.body.appendChild(modal);
    return;
  }
  _doStartFullAssessment();
}

function _doStartFullAssessment(){
  const partial = checkResumeAssessment();
  if(partial){ showResumeModal(partial); return; }
  assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0;
  showScreen('screen-assessment'); renderQuestion();
}

function startQuickScan(){ assessMode='quick'; buildQuickAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }
function startSingleAssessment(dIdx){ assessMode='single'; singleDisorderIdx=dIdx; buildSingleAssessment(dIdx); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }

// H3 FIX: track pending auto-advance so manual Next tap cancels it, preventing double-fire
let _autoAdvanceTimer = null;

function renderQuestion(){
  const q = allQuestions[currentQIdx];
  const total = allQuestions.length;
  // L1 FIX: use currentQIdx+1 so bar shows accurate completion (was 0% on Q1)
  document.getElementById('qProgressFill').style.width = ((currentQIdx + 1) / total * 100) + '%';
  document.getElementById('qScaleInfo').textContent=q.scaleInfo;
  document.getElementById('qNumber').textContent=`Question ${currentQIdx+1} of ${total}`;
  document.getElementById('qText').textContent=q.text;
  const hintEl=document.getElementById('qHint');
  if(hintEl){ hintEl.textContent=q.hint||''; hintEl.style.display=q.hint?'block':'none'; }
  document.getElementById('qPrevBtn').style.opacity=currentQIdx===0?'0.3':'1';
  document.getElementById('qNextBtn').textContent=currentQIdx===total-1?'Finish ✓':'Next →';

  // FEATURE9: show Save & Exit only in full assessment
  const saveExitBtn=document.getElementById('qSaveExitBtn');
  if(saveExitBtn) saveExitBtn.style.display=assessMode==='full'?'block':'none';

  document.getElementById('qOptions').innerHTML=q.options.map((o,i)=>{
    const val=q.values[i];
    const sel=allAnswers[currentQIdx]===val;
    return `<button class="q-option${sel?' selected':''}" onclick="selectAnswer(${val})"><span>${o}</span><span class="q-option-label">${val}</span></button>`;
  }).join('');
}

function selectAnswer(val){
  allAnswers[currentQIdx]=val;
  savePartialProgress();
  renderQuestion();
  // H3 FIX: cancel any pending auto-advance before scheduling a new one
  if(_autoAdvanceTimer){ clearTimeout(_autoAdvanceTimer); _autoAdvanceTimer=null; }
  _autoAdvanceTimer=setTimeout(()=>{
    _autoAdvanceTimer=null;
    if(currentQIdx<allQuestions.length-1) nextQuestion(); else finishAssessment();
  },300);
}

function nextQuestion(){
  // H3 FIX: cancel pending auto-advance so manual tap + auto-advance don't both fire
  if(_autoAdvanceTimer){ clearTimeout(_autoAdvanceTimer); _autoAdvanceTimer=null; }
  // H1 FIX: use showToast instead of alert() — alert() is blocked in TWA/WebView
  if(allAnswers[currentQIdx]===null){ showToast('Please select an answer to continue.'); return; }
  if(currentQIdx<allQuestions.length-1){currentQIdx++;renderQuestion();}else finishAssessment();
}
function prevQuestion(){ if(currentQIdx>0){currentQIdx--;renderQuestion();} }

// ============================================================
// SCORING
// ============================================================
function finishAssessment(){
  if(assessMode==='full'){
    DISORDERS.forEach((d,di)=>{
      const qs=questionMeta.filter(m=>m.type==='disorder'&&m.dIdx===di);
      disorderScores[d.id]=qs.reduce((sum,m)=>sum+(allAnswers[questionMeta.indexOf(m)]||0),0);
      stampDisorderTime(d.id);
    });
    IMPACT_MODULES.forEach((m,mi)=>{
      const qs=questionMeta.filter(meta=>meta.type==='impact'&&meta.mIdx===mi);
      impactScores[m.id]=qs.reduce((sum,meta)=>sum+(allAnswers[questionMeta.indexOf(meta)]||0),0);
      stampDisorderTime(m.id);
    });
    dwsScore=calculateDWS();
  } else if(assessMode==='quick'){
    IMPACT_MODULES.forEach((m,mi)=>{
      const qs=questionMeta.filter(meta=>meta.type==='impact'&&meta.mIdx===mi);
      impactScores[m.id]=qs.reduce((sum,meta)=>sum+(allAnswers[questionMeta.indexOf(meta)]||0),0);
      stampDisorderTime(m.id);
    });
    // M1 FIX: impact-only DWS for Quick Scan — don't blend stale disorder scores
    dwsScore=calculateDWS(true);
  } else if(assessMode==='single'){
    const d=DISORDERS[singleDisorderIdx];
    disorderScores[d.id]=allAnswers.reduce((a,b)=>a+(b||0),0);
    stampDisorderTime(d.id);
    dwsScore=calculateDWS();
  }
  saveScores();
  clearPartialProgress();
  updateDWSDisplay();
  renderResults();
  checkAndAwardBadges();
  if(assessMode==='quick') switchResultTab('impact');
  showScreen('screen-results');
}

// M1 FIX: impactOnly=true for Quick Scan so stale disorderScores from a previous
// full assessment don't contaminate the Quick Scan DWS.
function calculateDWS(impactOnly=false){
  let totalRisk=0,totalMax=0;
  if(!impactOnly){
    DISORDERS.forEach(d=>{
      if(disorderScores[d.id]!==undefined){
        totalRisk+=(disorderScores[d.id]-d.questions.length)/(d.maxScore-d.questions.length);
        totalMax++;
      }
    });
  }
  IMPACT_MODULES.forEach(m=>{
    if(impactScores[m.id]!==undefined){
      totalRisk+=impactScores[m.id]/(m.questions.length*4)*0.5;
      totalMax+=0.5;
    }
  });
  if(totalMax===0) return null;
  return Math.round((1-totalRisk/totalMax)*100);
}

// BUG17 FIX: fallback to first (Minimal) level not last (Severe)
function getLevel(disorder,score){
  return disorder.levels.find(l=>score>=l.min&&score<=l.max) || disorder.levels[0];
}
function getImpactLevel(score){ if(score<=5)return{label:'Minimal',color:'#2ecc71'}; if(score<=10)return{label:'Mild',color:'#f5a623'}; if(score<=15)return{label:'Moderate',color:'#ff6b35'}; return{label:'High',color:'#ff4757'}; }
function getDWSStatus(score){ if(score>=80)return{status:'Excellent',color:'#2ecc71',sub:'Your digital habits are very healthy.'}; if(score>=65)return{status:'Good',color:'#00c9a7',sub:'Mostly healthy with minor concerns.'}; if(score>=50)return{status:'Moderate Risk',color:'#f5a623',sub:'Some digital behaviors need attention.'}; if(score>=35)return{status:'High Risk',color:'#ff6b35',sub:'Multiple digital behaviors causing harm.'}; return{status:'Critical',color:'#ff4757',sub:'Significant digital addiction patterns detected.'}; }

function updateDWSDisplay(){
  if(dwsScore!==null){
    const s=getDWSStatus(dwsScore);
    const pill=document.getElementById('dwsPill');
    const num=document.getElementById('home-dws-num');
    const stat=document.getElementById('home-dws-status');
    if(pill){pill.textContent=`DWS: ${dwsScore}`;pill.style.color=s.color;}
    if(num){num.textContent=dwsScore;num.style.color=s.color;}
    if(stat) stat.textContent=s.status;
  }
}

// ============================================================
// FEATURE13: Disorder correlation insight
// ============================================================
// BUG2 FIX: Only disorder-disorder pairs (impact IDs not in scoredIds)
const CORRELATION_PAIRS = [
  {a:'cyberchondria',b:'socialmedia',insight:"Health anxiety and social media use often reinforce each other — health content online can trigger more searching."},
  {a:'socialmedia',b:'shortform',insight:"Social media and short-form video addiction frequently co-occur — both exploit the same dopamine reward loop."},
  {a:'gaming',b:'ai',insight:"Gaming and AI dependency both involve digital escapes — one for entertainment, one for cognitive relief."},
  {a:'workaddiction',b:'ai',insight:"Digital work addiction and AI dependency often go hand in hand — AI tools can enable and disguise overworking."},
  {a:'workaddiction',b:'socialmedia',insight:"Work addiction and social media use often coexist — both compete for attention and erode boundaries between work and rest."},
  {a:'cyberchondria',b:'gaming',insight:"Health anxiety and gaming disorder can both be forms of escape — one into reassurance-seeking, one into virtual worlds."}
];

function getCorrelationInsights(){
  const insights = [];
  const CONCERN_THRESHOLD = 0.35;
  const scoredIds = DISORDERS.filter(d=>disorderScores[d.id]!==undefined).map(d=>d.id);
  // BUG2 FIX: all pairs now use only disorder IDs
  CORRELATION_PAIRS.forEach(pair=>{
    if(!scoredIds.includes(pair.a)||!scoredIds.includes(pair.b)) return;
    const da=DISORDERS.find(d=>d.id===pair.a);
    const db=DISORDERS.find(d=>d.id===pair.b);
    const normA=(disorderScores[pair.a]-da.questions.length)/(da.maxScore-da.questions.length);
    const normB=(disorderScores[pair.b]-db.questions.length)/(db.maxScore-db.questions.length);
    if(normA>CONCERN_THRESHOLD&&normB>CONCERN_THRESHOLD) insights.push(pair.insight);
  });
  // Impact-level correlation checks (separate from disorder pairs)
  if(impactScores.attention!==undefined && impactScores.sleep!==undefined && impactScores.attention>5 && impactScores.sleep>5)
    insights.push("Your sleep disruption and attention difficulties are closely linked — screens before bed fragment both sleep and daytime focus.");
  if(impactScores.emotional!==undefined && impactScores.productivity!==undefined && impactScores.emotional>5 && impactScores.productivity>5)
    insights.push("Emotional distress and lower productivity often feed each other — stress makes it harder to focus, and poor focus increases stress.");
  return insights;
}

// ============================================================
// FEATURE14: Population percentile lookup
// ============================================================
// BUG18 FIX: Percentile values are preliminary estimates (n<50).
// Hide or label as estimated until pilot data is collected.
// Update these tables after each data collection round.
// Set PERCENTILE_DATA_READY=true once n>=50 to show real percentiles.
const PERCENTILE_DATA_READY = false;
const PERCENTILE_LOOKUP = {
  cyberchondria:[{max:25,pct:20},{max:35,pct:40},{max:45,pct:60},{max:55,pct:75},{max:65,pct:90},{max:75,pct:99}],
  socialmedia:  [{max:12,pct:25},{max:16,pct:50},{max:20,pct:70},{max:24,pct:85},{max:30,pct:99}],
  shortform:    [{max:12,pct:25},{max:16,pct:50},{max:20,pct:70},{max:24,pct:85},{max:30,pct:99}],
  gaming:       [{max:15,pct:30},{max:22,pct:55},{max:30,pct:75},{max:38,pct:90},{max:45,pct:99}],
  ai:           [{max:15,pct:30},{max:22,pct:55},{max:30,pct:75},{max:38,pct:90},{max:45,pct:99}],
  workaddiction:[{max:14,pct:25},{max:18,pct:50},{max:23,pct:70},{max:28,pct:88},{max:35,pct:99}]
};

const DWS_PERCENTILE_LOOKUP = [
  {min:80,pct:90},{min:65,pct:70},{min:50,pct:45},{min:35,pct:20},{min:0,pct:5}
];

function getPercentile(disorderId, score){
  if(!PERCENTILE_DATA_READY) return null; // BUG18 FIX: hide until real data available
  const table = PERCENTILE_LOOKUP[disorderId];
  if(!table) return null;
  const entry = table.find(e=>score<=e.max);
  return entry ? entry.pct : 99;
}

function getDWSPercentile(score){
  if(!PERCENTILE_DATA_READY) return null; // BUG18 FIX
  const entry = DWS_PERCENTILE_LOOKUP.find(e=>score>=e.min);
  return entry ? entry.pct : 5;
}

// ============================================================
// HOME SCREEN — DISORDER GRADE CARDS
// ============================================================
function renderHomeDisorders(){
  const el=document.getElementById('home-disorder-list');
  if(!el) return;
  const timestamps=getDisorderTimestamps();

  function getStalenessLabel(id){
    const ts=timestamps[id];
    if(!ts) return null;
    const days=Math.floor((Date.now()-ts)/86400000);
    if(days===0) return{text:'Checked today',color:'#2ecc71',warn:false};
    if(days===1) return{text:'Checked yesterday',color:'#00c9a7',warn:false};
    if(days<7)  return{text:`Checked ${days} days ago`,color:'#f5a623',warn:false};
    if(days<30) return{text:`Checked ${days} days ago`,color:'#ff6b35',warn:false};
    return{text:`Last checked ${days} days ago`,color:'#ff4757',warn:true};
  }

  el.innerHTML=DISORDERS.map(d=>{
    const score=disorderScores[d.id];
    const hasScore=score!==undefined;
    const level=hasScore?getLevel(d,score):null;
    const pct=hasScore?Math.round(((score-d.questions.length)/(d.maxScore-d.questions.length))*100):0;
    const staleness=hasScore?getStalenessLabel(d.id):null;

    if(hasScore){
      return `
        <div class="assess-disorder-card" onclick="startSingleAssessmentWithCheck(${DISORDERS.indexOf(d)})"
          style="border-color:${d.color}40;background:linear-gradient(135deg,var(--card) 80%,${d.bg})">
          <div class="assess-card-icon" style="background:${d.bg}"><span style="font-size:22px">${d.icon}</span></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${d.name}</span>
              <span style="font-size:10px;font-weight:800;letter-spacing:0.5px;padding:2px 9px;border-radius:20px;background:${level.bg};color:${level.color};border:1px solid ${level.color}40">${level.label.toUpperCase()}</span>
              ${staleness?.warn?`<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(255,71,87,0.12);color:#ff4757;border:1px solid rgba(255,71,87,0.3)">⚠ Recheck</span>`:''}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${level.color};border-radius:3px;transition:width 0.5s ease"></div>
              </div>
              <span style="font-size:10px;color:var(--muted);flex-shrink:0">${score}/${d.maxScore}</span>
            </div>
            <div style="font-size:10px;margin-top:4px;color:${staleness?staleness.color:'var(--muted)'}">
              ${staleness?staleness.text+' · ':''}${d.scale} · Tap to recheck
            </div>
          </div>
        </div>`;
    } else {
      return `
        <div class="assess-disorder-card" onclick="showScaleInfo('${d.id}', ${DISORDERS.indexOf(d)})" style="opacity:0.65">
          <div class="assess-card-icon" style="background:var(--bg)"><span style="font-size:22px">${d.icon}</span></div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${d.name}</span>
              <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;background:var(--bg);color:var(--muted);border:1px solid var(--border)">Not checked</span>
            </div>
            <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden"></div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">${d.scale} · Tap to start</div>
          </div>
          <div class="assess-card-chevron">›</div>
        </div>`;
    }
  }).join('');
}
