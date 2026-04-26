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
// PARTIAL PROGRESS — Auto-save completed disorder blocks mid-assessment
// ============================================================

const PARTIAL_KEY = 'pause_partial_full_assessment';

function savePartialProgress(){
  if(assessMode !== 'full') return;

  // Score any disorder whose every question has been answered
  DISORDERS.forEach((d, di) => {
    const metas = questionMeta
      .map((m, i) => ({...m, aIdx: i}))
      .filter(m => m.type === 'disorder' && m.dIdx === di);
    if(metas.length > 0 && metas.every(m => allAnswers[m.aIdx] !== null)){
      disorderScores[d.id] = metas.reduce((sum, m) => sum + (allAnswers[m.aIdx] || 0), 0);
      AppGrades.update(d.id, getLevel(d, disorderScores[d.id]).label);
    }
  });

  // Score any impact module whose every question has been answered
  IMPACT_MODULES.forEach((m, mi) => {
    const metas = questionMeta
      .map((meta, i) => ({...meta, aIdx: i}))
      .filter(meta => meta.type === 'impact' && meta.mIdx === mi);
    if(metas.length > 0 && metas.every(meta => allAnswers[meta.aIdx] !== null)){
      impactScores[m.id] = metas.reduce((sum, meta) => sum + (allAnswers[meta.aIdx] || 0), 0);
    }
  });

  // Recalculate DWS from whatever is complete so far
  const partialDWS = calculateDWS();
  if(partialDWS !== null){ dwsScore = partialDWS; updateDWSDisplay(); }

  // Persist completed scores so they survive a refresh/close
  if(Object.keys(disorderScores).length > 0 || Object.keys(impactScores).length > 0){
    saveScores();
  }

  // Save full resume state
  localStorage.setItem(PARTIAL_KEY, JSON.stringify({
    answers: allAnswers,
    currentQ: currentQIdx,
    disorderScores,
    impactScores,
    dwsScore,
    timestamp: Date.now()
  }));
}

function clearPartialProgress(){
  localStorage.removeItem(PARTIAL_KEY);
}

function checkResumeAssessment(){
  const raw = localStorage.getItem(PARTIAL_KEY);
  if(!raw) return null;
  try {
    const partial = JSON.parse(raw);
    // Discard if older than 24 hours
    if(Date.now() - partial.timestamp > 86400000){
      clearPartialProgress();
      return null;
    }
    return partial;
  } catch(e){
    clearPartialProgress();
    return null;
  }
}

function showResumeModal(partial){
  // Count how many disorders were fully completed
  const completedDisorders = DISORDERS.filter(d => partial.disorderScores && partial.disorderScores[d.id] !== undefined);
  const qDone = partial.currentQ + 1;
  const qTotal = partial.answers.length;
  const pct = Math.round((qDone / qTotal) * 100);

  // Build summary chips
  const chips = completedDisorders.map(d =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:${d.bg};color:${d.color};border:1px solid ${d.color}40;border-radius:20px;padding:4px 10px;font-size:12px;font-weight:700">${d.icon} ${d.name}</span>`
  ).join('');

  // Inject a lightweight modal dynamically
  const existing = document.getElementById('resumeAssessModal');
  if(existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'resumeAssessModal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:var(--card);border-radius:20px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
      <div style="font-size:28px;text-align:center;margin-bottom:8px">📋</div>
      <div style="font-size:18px;font-weight:800;color:var(--text);text-align:center;margin-bottom:6px">Unfinished Check-Up Found</div>
      <div style="font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px">You completed <strong style="color:var(--text)">${qDone} of ${qTotal} questions</strong> (${pct}%)</div>
      ${completedDisorders.length > 0 ? `
        <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Already scored & saved</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">${chips}</div>
      ` : ''}
      <div style="font-size:12px;color:var(--muted);background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:20px">
        💡 Your completed sections are already saved — resume to pick up exactly where you left off.
      </div>
      <button onclick="resumePartialAssessment()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;font-family:inherit">▶ Resume Check-Up</button>
      <button onclick="discardAndStartFresh()" style="width:100%;padding:12px;background:none;color:var(--muted);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Start Fresh Instead</button>
    </div>`;
  document.body.appendChild(modal);
}

function resumePartialAssessment(){
  const raw = localStorage.getItem(PARTIAL_KEY);
  if(!raw) return;
  const partial = JSON.parse(raw);
  document.getElementById('resumeAssessModal')?.remove();

  assessMode = 'full';
  buildFullAssessment();
  allAnswers = partial.answers;
  currentQIdx = partial.currentQ;
  // Restore already-scored data
  Object.assign(disorderScores, partial.disorderScores || {});
  Object.assign(impactScores, partial.impactScores || {});
  if(partial.dwsScore !== null && partial.dwsScore !== undefined){
    dwsScore = partial.dwsScore;
    updateDWSDisplay();
  }
  showScreen('screen-assessment');
  renderQuestion();
}

function discardAndStartFresh(){
  document.getElementById('resumeAssessModal')?.remove();
  clearPartialProgress();
  assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion();
}

function startFullAssessment(){
  const partial = checkResumeAssessment();
  if(partial){
    showResumeModal(partial);
    return;
  }
  assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion();
}
function startQuickScan(){ assessMode='quick'; buildQuickAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }
function startSingleAssessment(dIdx){ assessMode='single'; singleDisorderIdx=dIdx; buildSingleAssessment(dIdx); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }

function renderQuestion(){
  const q = allQuestions[currentQIdx];
  const total = allQuestions.length;
  document.getElementById('qProgressFill').style.width = ((currentQIdx)/total*100)+'%';
  document.getElementById('qScaleInfo').textContent = q.scaleInfo;
  document.getElementById('qNumber').textContent = `Question ${currentQIdx+1} of ${total}`;
  document.getElementById('qText').textContent = q.text;
  const hintEl = document.getElementById('qHint');
  if(hintEl) hintEl.textContent = q.hint || '';
  if(hintEl) hintEl.style.display = q.hint ? 'block' : 'none';
  document.getElementById('qPrevBtn').style.opacity = currentQIdx === 0 ? '0.3' : '1';
  document.getElementById('qNextBtn').textContent = currentQIdx === total-1 ? 'Finish ✓' : 'Next →';
  document.getElementById('qOptions').innerHTML = q.options.map((o,i) => {
    const val = q.values[i];
    const sel = allAnswers[currentQIdx] === val;
    return `<button class="q-option${sel?' selected':''}" onclick="selectAnswer(${val})"><span>${o}</span><span class="q-option-label">${val}</span></button>`;
  }).join('');
}

function selectAnswer(val){
  allAnswers[currentQIdx] = val;
  savePartialProgress(); // auto-save completed disorder blocks after every answer
  renderQuestion();
  setTimeout(() => { if(currentQIdx < allQuestions.length-1) nextQuestion(); else finishAssessment(); }, 300);
}

function nextQuestion(){ if(allAnswers[currentQIdx]===null){alert('Please select an answer.');return;} if(currentQIdx<allQuestions.length-1){currentQIdx++;renderQuestion();}else finishAssessment(); }
function prevQuestion(){ if(currentQIdx>0){currentQIdx--;renderQuestion();} }

// ============================================================
// SCORING
// ============================================================
function finishAssessment(){
  if(assessMode==='full'){
    // Score all 6 disorders
    DISORDERS.forEach((d,di) => {
      const qs = questionMeta.filter(m => m.type==='disorder' && m.dIdx===di);
      disorderScores[d.id] = qs.reduce((sum,m) => sum + (allAnswers[questionMeta.indexOf(m)]||0), 0);
    });
    // Score all 4 impact modules
    IMPACT_MODULES.forEach((m,mi) => {
      const qs = questionMeta.filter(meta => meta.type==='impact' && meta.mIdx===mi);
      impactScores[m.id] = qs.reduce((sum,meta) => sum + (allAnswers[questionMeta.indexOf(meta)]||0), 0);
    });
    // Calculate DWS from full data
    dwsScore = calculateDWS();

  } else if(assessMode==='quick'){
    // Score all 4 impact modules
    IMPACT_MODULES.forEach((m,mi) => {
      const qs = questionMeta.filter(meta => meta.type==='impact' && meta.mIdx===mi);
      impactScores[m.id] = qs.reduce((sum,meta) => sum + (allAnswers[questionMeta.indexOf(meta)]||0), 0);
    });
    // FIX: Calculate DWS using whatever data is available (impact only is fine)
    // calculateDWS() already handles missing disorder scores gracefully
    dwsScore = calculateDWS();

  } else if(assessMode==='single'){
    const d = DISORDERS[singleDisorderIdx];
    // Score the single disorder
    disorderScores[d.id] = allAnswers.reduce((a,b) => a+(b||0), 0);
    // FIX: Always recalculate DWS using all available scores
    // Removed the overly strict condition that required ALL disorders + ALL impacts
    // calculateDWS() already skips undefined scores gracefully
    dwsScore = calculateDWS();
  }

  saveScores();
  clearPartialProgress(); // full assessment complete — clear resume state
  updateDWSDisplay();
  renderResults();
  checkAndAwardBadges();
  if(assessMode==='quick') switchResultTab('impact');
  showScreen('screen-results');
}

function calculateDWS(){
  let totalRisk=0, totalMax=0;
  // Include disorder scores only if available
  DISORDERS.forEach(d => {
    if(disorderScores[d.id]!==undefined){
      totalRisk += (disorderScores[d.id] - d.questions.length) / (d.maxScore - d.questions.length);
      totalMax++;
    }
  });
  // Include impact scores only if available (weighted at 0.5 each)
  IMPACT_MODULES.forEach(m => {
    if(impactScores[m.id]!==undefined){
      totalRisk += impactScores[m.id] / (m.questions.length * 4) * 0.5;
      totalMax += 0.5;
    }
  });
  if(totalMax===0) return null;
  return Math.round((1 - totalRisk / totalMax) * 100);
}

function getLevel(disorder, score){ return disorder.levels.find(l => score>=l.min && score<=l.max)||disorder.levels[disorder.levels.length-1]; }
function getImpactLevel(score){ if(score<=5)return{label:'Minimal',color:'#2ecc71'}; if(score<=10)return{label:'Mild',color:'#f5a623'}; if(score<=15)return{label:'Moderate',color:'#ff6b35'}; return{label:'High',color:'#ff4757'}; }
function getDWSStatus(score){ if(score>=80)return{status:'Excellent',color:'#2ecc71',sub:'Your digital habits are very healthy.'}; if(score>=65)return{status:'Good',color:'#00c9a7',sub:'Mostly healthy with minor concerns.'}; if(score>=50)return{status:'Moderate Risk',color:'#f5a623',sub:'Some digital behaviors need attention.'}; if(score>=35)return{status:'High Risk',color:'#ff6b35',sub:'Multiple digital behaviors causing harm.'}; return{status:'Critical',color:'#ff4757',sub:'Significant digital addiction patterns detected.'}; }

function updateDWSDisplay(){
  if(dwsScore!==null){
    const s = getDWSStatus(dwsScore);
    document.getElementById('dwsPill').textContent = `DWS: ${dwsScore}`;
    document.getElementById('dwsPill').style.color = s.color;
    document.getElementById('home-dws-num').textContent = dwsScore;
    document.getElementById('home-dws-num').style.color = s.color;
    document.getElementById('home-dws-status').textContent = s.status;
  }
}
