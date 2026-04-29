// premium-motions.js — PAUSE premium interaction layer. Visual only.
(function(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ready = fn => document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);
  function addAmbientFX(){
    const app=document.getElementById('app'); if(!app || app.dataset.pausePremiumFx==='on') return; app.dataset.pausePremiumFx='on';
    ['one','two','three'].forEach(cls=>{const orb=document.createElement('span');orb.className='pause-fx-orb '+cls;app.appendChild(orb);});
    if(!reduce){for(let i=0;i<18;i++){const s=document.createElement('span');s.className='pause-fx-spark';s.style.left=(8+Math.random()*84).toFixed(2)+'%';s.style.top=(8+Math.random()*84).toFixed(2)+'%';s.style.animationDelay=(-Math.random()*5).toFixed(2)+'s';s.style.animationDuration=(3.4+Math.random()*3.2).toFixed(2)+'s';app.appendChild(s);}}
  }
  function ripple(e){
    const t=e.target.closest('button,.disorder-card,.assess-disorder-card,.assess-impact-card,.card,.nav-btn,.tab'); if(!t || reduce) return;
    const r=t.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top; const sp=document.createElement('span'); sp.className='pause-ripple'; sp.style.left=x+'px'; sp.style.top=y+'px'; t.appendChild(sp); setTimeout(()=>sp.remove(),680);
  }
  function observeScreens(){
    const obs=new MutationObserver(ms=>ms.forEach(m=>{if(m.attributeName==='class'&&m.target.classList.contains('active')){m.target.classList.remove('pause-entered'); void m.target.offsetWidth; m.target.classList.add('pause-entered');}}));
    document.querySelectorAll('.screen').forEach(s=>obs.observe(s,{attributes:true,attributeFilter:['class']}));
  }
  ready(()=>{addAmbientFX();document.addEventListener('pointerdown',ripple,{passive:true});observeScreens();});
})();
