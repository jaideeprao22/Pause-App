// ============================================================
// ASSESSMENT ENGINE
// ============================================================
function buildFullAssessment(){
  allQuestions=[]; questionMeta=[];
  DISORDERS.forEach((d,di) => d.questions.forEach((q,qi) => {
    allQuestions.push({text:q.t, options:d.options, values:d.optionValues, scaleInfo:`${d.name} · ${d.scale}`, disorderIdx:di});
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
    allQuestions.push({text:q.t, options:d.options, values:d.optionValues, scaleInfo:`${d.name} · ${d.scale}`, disorderIdx:dIdx});
    questionMeta.push({type:'disorder', dIdx:dIdx, qIdx:qi});
  });
}

function startFullAssessment(){ assessMode='full'; buildFullAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }
function startQuickScan(){ assessMode='quick'; buildQuickAssessment(); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }
function startSingleAssessment(dIdx){ assessMode='single'; singleDisorderIdx=dIdx; buildSingleAssessment(dIdx); allAnswers=new Array(allQuestions.length).fill(null); currentQIdx=0; showScreen('screen-assessment'); renderQuestion(); }

function renderQuestion(){
  const q = allQuestions[currentQIdx];
  const total = allQuestions.length;
  document.getElementById('qProgressFill').style.width = ((currentQIdx)/total*100)+'%';
  document.getElementById('qScaleInfo').textContent = q.scaleInfo;
  document.getElementById('qNumber').textContent = `Question ${currentQIdx+1} of ${total}`;
  document.getElementById('qText').textContent = q.text;
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
    DISORDERS.forEach((d,di) => {
      const qs = questionMeta.filter(m => m.type==='disorder' && m.dIdx===di);
      disorderScores[d.id] = qs.reduce((sum,m) => sum + (allAnswers[questionMeta.indexOf(m)]||0), 0);
    });
    IMPACT_MODULES.forEach((m,mi) => {
      const qs = questionMeta.filter(meta => meta.type==='impact' && meta.mIdx===mi);
      impactScores[m.id] = qs.reduce((sum,meta) => sum + (allAnswers[questionMeta.indexOf(meta)]||0), 0);
    });
    dwsScore = calculateDWS();
  } else if(assessMode==='quick'){
    IMPACT_MODULES.forEach((m,mi) => {
      const qs = questionMeta.filter(meta => meta.type==='impact' && meta.mIdx===mi);
      impactScores[m.id] = qs.reduce((sum,meta) => sum + (allAnswers[questionMeta.indexOf(meta)]||0), 0);
    });
  } else if(assessMode==='single'){
    const d = DISORDERS[singleDisorderIdx];
    disorderScores[d.id] = allAnswers.reduce((a,b) => a+(b||0), 0);
    if(Object.keys(disorderScores).length===DISORDERS.length && Object.keys(impactScores).length===IMPACT_MODULES.length) dwsScore = calculateDWS();
  }
  saveScores();
  updateDWSDisplay();
  renderResults();
  checkAndAwardBadges();
  if(assessMode==='quick') switchResultTab('impact');
  showScreen('screen-results');
}

function calculateDWS(){
  let totalRisk=0, totalMax=0;
  DISORDERS.forEach(d => { if(disorderScores[d.id]!==undefined){ totalRisk+=(disorderScores[d.id]-d.questions.length)/(d.maxScore-d.questions.length); totalMax++; } });
  IMPACT_MODULES.forEach(m => { if(impactScores[m.id]!==undefined){ totalRisk+=impactScores[m.id]/(m.questions.length*4)*0.5; totalMax+=0.5; } });
  if(totalMax===0) return null;
  return Math.round((1-totalRisk/totalMax)*100);
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