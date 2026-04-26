// ============================================================
// PERCENTILE DATA (simulated from published research)
// ============================================================
const PERCENTILE_REFS = {
  cyberchondria:  [15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60,63,66,69,72,75],
  socialmedia:    [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,25,27,30],
  shortform:      [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,30],
  gaming:         [9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,26,28,31,34,38,45],
  ai:             [9,10,11,12,13,14,15,17,19,21,23,25,27,29,31,33,35,37,39,42,45],
  workaddiction:  [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,25,27,30,35]
};

// Bug 11 FIX: getPercentile() and getDWSPercentile() are also defined in assessment.js
// (with PERCENTILE_DATA_READY guard). Renaming to private names here so share.js
// doesn't overwrite the authoritative assessment.js versions for the rest of the app.
// These private versions use reference data arrays for the canvas share card only.
function _shareGetPercentile(disorderId, score){
  const ref = PERCENTILE_REFS[disorderId];
  if(!ref) return null;
  let rank = 0;
  for(let i=0; i<ref.length; i++){ if(score > ref[i]) rank = i+1; }
  return Math.round((rank/ref.length)*100);
}

function _shareDWSPercentile(dws){
  const ref = [20,25,30,35,40,45,50,55,60,62,65,67,69,71,73,75,78,81,85,90,100];
  let rank = 0;
  for(let i=0; i<ref.length; i++){ if(dws > ref[i]) rank = i+1; }
  return Math.round((rank/ref.length)*100);
}

// ============================================================
// CANVAS SHARE CARD
// ============================================================
async function shareResults(){
  localStorage.setItem('hasShared','true');
  checkAndAwardBadges();

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, '#0a1628');
  bg.addColorStop(1, '#1a3a6e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative circles
  ctx.beginPath(); ctx.arc(950, 200, 280, 0, Math.PI*2); ctx.fillStyle='rgba(61,111,255,0.08)'; ctx.fill();
  ctx.beginPath(); ctx.arc(130, 1700, 200, 0, Math.PI*2); ctx.fillStyle='rgba(0,201,167,0.06)'; ctx.fill();

  // PAUSE App title
  ctx.font = 'bold 52px sans-serif';
  ctx.fillStyle = '#60b3ff';
  ctx.fillText('PAUSE', 80, 120);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(' App', 80 + ctx.measureText('PAUSE').width, 120);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Digital Wellness Platform', 80, 158);

  // DWS Score circle
  const cx = 540, cy = 420, r = 200;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(61,111,255,0.3)'; ctx.lineWidth = 3; ctx.stroke();

  if(dwsScore !== null){
    const s = getDWSStatus(dwsScore);
    const pct = getDWSPercentile ? _shareDWSPercentile(dwsScore) : 0;
    // Score arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, (-Math.PI/2) + (dwsScore/100)*Math.PI*2);
    ctx.strokeStyle = s.color; ctx.lineWidth = 14; ctx.lineCap='round'; ctx.stroke();
    // Score number
    ctx.font = 'bold 120px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(dwsScore, cx, cy + 20);
    ctx.font = '30px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('out of 100', cx, cy + 68);
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = s.color;
    ctx.fillText(s.status, cx, cy + 120);
    // DWS percentile
    if(Object.keys(disorderScores).length === 6){
      ctx.font = '26px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`Better than ${pct}% of all users`, cx, cy + 165);
    }
  } else {
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('--', cx, cy + 30);
  }

  ctx.textAlign = 'left';

  // Disorder results
  let y = 700;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('DISORDER SCREENING RESULTS', 80, y);
  y += 44;

  DISORDERS.filter(d => disorderScores[d.id] !== undefined).forEach(d => {
    const score = disorderScores[d.id];
    const level = getLevel(d, score);
    const pct = ((score - d.questions.length)/(d.maxScore - d.questions.length))*100;
    const percentile = _shareGetPercentile(d.id, score);

    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, 80, y, 920, 110, 20);
    ctx.fill();

    // Disorder name
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${d.icon} ${d.name}`, 110, y + 38);

    // Level badge
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = level.color;
    ctx.textAlign = 'right';
    ctx.fillText(level.label, 970, y + 38);
    ctx.textAlign = 'left';

    // Bar background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 110, y + 52, 860, 10, 5);
    ctx.fill();

    // Bar fill
    ctx.fillStyle = level.color;
    roundRect(ctx, 110, y + 52, Math.max(10, 860 * pct/100), 10, 5);
    ctx.fill();

    // Percentile
    if(percentile !== null){
      ctx.font = '22px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`Higher than ${percentile}% of users`, 110, y + 96);
    }

    y += 128;
  });

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(80, 1820, 920, 1);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('Download PAUSE App on Google Play', 540, 1870);
  ctx.font = '24px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillText('#PAUSEApp  #DigitalWellness  #DigitalHealth', 540, 1910);

  // Share the image
  canvas.toBlob(async blob => {
    const file = new File([blob], 'pause-score.png', {type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:'My PAUSE App Score'});
    } else if(navigator.share){
      const score = dwsScore||'--';
      await navigator.share({
        title:'My PAUSE App Score',
        text:`🧠 My Digital Wellness Score: ${score}/100\n\nScreened using PAUSE App — 6 disorder digital wellness platform\n\nDownload PAUSE App on Google Play\n\n#PAUSEApp #DigitalWellness`
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pause-score.png'; a.click();
      URL.revokeObjectURL(url);
    }
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}