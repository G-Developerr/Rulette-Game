/* ══════════════════════════════════════════════════════════════
   Roulette Royale — script.js   v3.0
   European roulette · canvas wheel · sounds · autoplay · shortcuts
══════════════════════════════════════════════════════════════ */

// ── CONSTANTS ──────────────────────────────────────────────────
const WHEEL_SEQ = [
   0, 32, 15, 19,  4, 21,  2, 25, 17, 34,  6, 27,
  13, 36, 11, 30,  8, 23, 10,  5, 24, 16, 33,  1,
  20, 14, 31,  9, 22, 18, 29,  7, 28, 12, 35,  3, 26
];

const RED_NUMS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const CHIP_BG = {
  1:   'radial-gradient(circle at 38% 32%, #4a90d9, #1d5c99)',
  5:   'radial-gradient(circle at 38% 32%, #e74c3c, #8b1e1e)',
  10:  'radial-gradient(circle at 38% 32%, #27ae60, #145e33)',
  25:  'radial-gradient(circle at 38% 32%, #e67e22, #7d3d0a)',
  50:  'radial-gradient(circle at 38% 32%, #8e44ad, #4a1166)',
  100: 'radial-gradient(circle at 38% 32%, #16a085, #0a4f3e)',
  500: 'radial-gradient(circle at 38% 32%, #f1c40f, #7a5d06)'
};

// ── STATE ──────────────────────────────────────────────────────
let balance       = 1000;
let activeBets    = [];
let betHistory    = [];
let lastBetSnap   = [];
let selectedChip  = 10;
let isSpinning    = false;
let wheelRot      = 0;
let ballRot       = 0;
let wins          = 0;
let losses        = 0;
let netGain       = 0;
let streak        = 0;
let roundNum      = 1;
let spinHistory   = [];
let numFrequency  = new Array(37).fill(0);
let soundEnabled  = true;
let autoPlay      = false;
let autoTimer     = null;
let audioCtx      = null;
let tipEl         = null;

// ── SOUND ENGINE ──────────────────────────────────────────────
function getACtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function snd_chip() {
  if (!soundEnabled) return;
  try {
    const c = getACtx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'triangle';
    o.frequency.setValueAtTime(1300, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.09);
    g.gain.setValueAtTime(0.20, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.start(c.currentTime); o.stop(c.currentTime + 0.12);
  } catch(e) {}
}
function snd_spin() {
  if (!soundEnabled) return;
  try {
    const c = getACtx(), buf = c.createBuffer(1, c.sampleRate*4, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*0.28;
    const src=c.createBufferSource(); src.buffer=buf;
    const flt=c.createBiquadFilter(); flt.type='bandpass'; flt.frequency.value=900; flt.Q.value=0.5;
    const g=c.createGain(); g.gain.setValueAtTime(0.15,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+4);
    src.connect(flt); flt.connect(g); g.connect(c.destination);
    src.start(c.currentTime); src.stop(c.currentTime+4);
  } catch(e) {}
}
function snd_win() {
  if (!soundEnabled) return;
  try {
    const c=getACtx();
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='sine';o.frequency.value=f;
      const t=c.currentTime+i*0.11;
      g.gain.setValueAtTime(0.001,t);g.gain.linearRampToValueAtTime(0.28,t+0.05);g.gain.exponentialRampToValueAtTime(0.001,t+0.55);
      o.start(t);o.stop(t+0.55);
    });
  } catch(e) {}
}
function snd_lose() {
  if (!soundEnabled) return;
  try {
    const c=getACtx();
    [280,200].forEach((f,i)=>{
      const o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);o.type='sawtooth';o.frequency.value=f;
      const t=c.currentTime+i*0.18;
      g.gain.setValueAtTime(0.11,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.4);
      o.start(t);o.stop(t+0.4);
    });
  } catch(e) {}
}
function toggleSound() {
  soundEnabled = !soundEnabled;
  const b = document.getElementById('sound-btn');
  b.textContent = soundEnabled ? '🔊' : '🔇';
  b.classList.toggle('muted', !soundEnabled);
}

// ── HELPERS ───────────────────────────────────────────────────
function numColor(n) { return n===0?'green': RED_NUMS.has(n)?'red':'black'; }
function fmt(n)      { return '$'+Math.abs(n).toLocaleString(); }
function bKey(t,v)   { return `${t}__${v}`; }
function multFor(t)  { return t==='number'?35: (t==='dozen'||t==='column')?2:1; }
function payLbl(t)   { return t==='number'?'35:1': (t==='dozen'||t==='column')?'2:1':'1:1'; }

function labelFor(type, value) {
  if (type==='number')  return `#${value}`;
  if (type==='color')   return value==='red'?'Red':'Black';
  if (type==='oddeven') return value==='odd'?'Odd':'Even';
  if (type==='highlow') return value==='low'?'1–18':'19–36';
  if (type==='dozen')   { const s=['','st','nd','rd']; return `${value}${s[value]||'th'} 12`; }
  if (type==='column')  return value==='top'?'Col 3':value==='mid'?'Col 2':'Col 1';
  return '';
}

function checkWin(type, value, n) {
  if (type==='number')  return n===parseInt(value);
  if (type==='color')   return n!==0 && numColor(n)===value;
  if (type==='oddeven') return n!==0 && (value==='odd'?n%2!==0:n%2===0);
  if (type==='highlow') return n!==0 && (value==='low'?n>=1&&n<=18:n>=19&&n<=36);
  if (type==='dozen') {
    if (n===0) return false;
    const d=parseInt(value); return d===1?n>=1&&n<=12:d===2?n>=13&&n<=24:n>=25&&n<=36;
  }
  if (type==='column') {
    if (n===0) return false;
    return value==='top'?n%3===0:value==='mid'?n%3===2:n%3===1;
  }
  return false;
}

// ── PHASE ─────────────────────────────────────────────────────
function setPhase(p) {
  const el = document.getElementById('phase-pill');
  if (p==='betting')  { el.textContent='PLACE YOUR BETS'; el.classList.remove('spinning'); }
  if (p==='spinning') { el.textContent='NO MORE BETS';    el.classList.add('spinning');    }
  if (p==='result')   { el.textContent='RESULT';          el.classList.add('spinning');    }
}

// ── CHIP SELECT ───────────────────────────────────────────────
function selectChip(el, val) {
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  selectedChip = val;
}

// ── BALANCE ANIMATION ─────────────────────────────────────────
function animateBalance(from, to) {
  const el  = document.getElementById('hud-balance');
  const dur = 650;
  const t0  = performance.now();
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = p<0.5?2*p*p:-1+(4-2*p)*p;
    el.textContent = fmt(Math.round(from + (to-from)*e));
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(tick);
}

// ── CHIP FLY ANIMATION ────────────────────────────────────────
function flyChip(targetEl) {
  const src = document.querySelector('.chip.active');
  if (!src || !targetEl || window.innerWidth < 700) return;
  const sr = src.getBoundingClientRect(), tr = targetEl.getBoundingClientRect();
  const fly = document.createElement('div');
  fly.style.cssText=`position:fixed;z-index:9999;pointer-events:none;width:22px;height:22px;
    border-radius:50%;background:${CHIP_BG[selectedChip]||CHIP_BG[10]};
    box-shadow:0 3px 10px rgba(0,0,0,.7);
    left:${sr.left+sr.width/2-11}px;top:${sr.top+sr.height/2-11}px;
    transition:left .3s cubic-bezier(.25,.46,.45,.94),top .3s,opacity .3s,transform .3s;`;
  document.body.appendChild(fly);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    fly.style.left=(tr.left+tr.width/2-11)+'px';
    fly.style.top=(tr.top+tr.height/2-11)+'px';
    fly.style.opacity='0.25';
    fly.style.transform='scale(0.45)';
  }));
  setTimeout(()=>fly.remove(),340);
}

// ── TOOLTIP ───────────────────────────────────────────────────
function initTip() { tipEl=document.getElementById('bet-tooltip'); }
function showTip(e,t){ tipEl.textContent=t; tipEl.style.display='block'; moveTip(e); }
function moveTip(e) { tipEl.style.left=(e.clientX+14)+'px'; tipEl.style.top=(e.clientY-32)+'px'; }
function hideTip()  { tipEl.style.display='none'; }

// ── BUILD TABLE ───────────────────────────────────────────────
function buildTable() {
  const c = document.getElementById('bt-numbers');
  c.innerHTML='';
  for (let row=3; row>=1; row--) {
    const rowEl=document.createElement('div'); rowEl.className='bt-num-row';
    for (let col=1; col<=12; col++) {
      const n=(col-1)*3+row;
      const cell=document.createElement('div');
      cell.className=`bc ${RED_NUMS.has(n)?'num-red':'num-black'}`;
      cell.dataset.type='number'; cell.dataset.value=String(n);
      cell.textContent=n;
      cell.onclick=()=>placeBet(cell);
      cell.addEventListener('mouseenter',e=>showTip(e,`#${n}  ·  Pays 35:1`));
      cell.addEventListener('mousemove', moveTip);
      cell.addEventListener('mouseleave',hideTip);
      rowEl.appendChild(cell);
    }
    c.appendChild(rowEl);
  }
  // Tooltips for static cells
  document.querySelectorAll('.bc[data-type]:not([data-type="number"])').forEach(cell=>{
    const lbl=labelFor(cell.dataset.type,cell.dataset.value);
    const pay=payLbl(cell.dataset.type);
    cell.addEventListener('mouseenter',e=>showTip(e,`${lbl}  ·  Pays ${pay}`));
    cell.addEventListener('mousemove', moveTip);
    cell.addEventListener('mouseleave',hideTip);
  });
}

// ── PLACE BET ─────────────────────────────────────────────────
function placeBet(el) {
  if (isSpinning) return;
  const type=el.dataset.type, value=el.dataset.value, key=bKey(type,value);
  const total=activeBets.reduce((s,b)=>s+b.amount,0);
  if (total+selectedChip > balance) { setStatus('Not enough balance for this bet!','lose'); return; }

  betHistory.push(activeBets.map(b=>({...b})));
  flyChip(el);
  snd_chip();

  const ex=activeBets.find(b=>b.key===key);
  if (ex) { ex.amount+=selectedChip; updateCellChip(el,ex.amount); }
  else {
    activeBets.push({key,type,value,amount:selectedChip,label:labelFor(type,value),multiplier:multFor(type),el});
    updateCellChip(el,selectedChip);
  }
  updateHUD(); renderBetSummary();
}

function updateCellChip(el, amount) {
  let chip=el.querySelector('.cell-chip');
  if (!chip) { chip=document.createElement('div'); chip.className='cell-chip'; el.appendChild(chip); el.classList.add('has-bet'); }
  chip.style.background=chipBgFor(amount);
  chip.textContent=amount>=1000?(amount/1000)+'k':amount;
}
function chipBgFor(a){
  return a>=500?CHIP_BG[500]:a>=100?CHIP_BG[100]:a>=50?CHIP_BG[50]:a>=25?CHIP_BG[25]:a>=10?CHIP_BG[10]:a>=5?CHIP_BG[5]:CHIP_BG[1];
}

// ── BET MANAGEMENT ────────────────────────────────────────────
function clearAllBets() {
  if (isSpinning) return;
  activeBets.forEach(b=>removeCellChip(b.el));
  activeBets=[]; betHistory=[];
  updateHUD(); renderBetSummary();
}
function removeCellChip(el){ el.querySelector('.cell-chip')?.remove(); el.classList.remove('has-bet'); }

function undoLast() {
  if (isSpinning||betHistory.length===0) return;
  activeBets.forEach(b=>removeCellChip(b.el));
  const prev=betHistory.pop();
  activeBets=prev.map(b=>{
    const el=document.querySelector(`.bc[data-type="${b.type}"][data-value="${b.value}"]`);
    if(el){b.el=el; updateCellChip(el,b.amount);} return b;
  });
  updateHUD(); renderBetSummary();
}

function doubleAllBets() {
  if (isSpinning||activeBets.length===0) return;
  if (activeBets.reduce((s,b)=>s+b.amount,0) > balance) { setStatus('Not enough balance to double!','lose'); return; }
  betHistory.push(activeBets.map(b=>({...b})));
  activeBets.forEach(b=>{ b.amount*=2; updateCellChip(b.el,b.amount); });
  snd_chip(); updateHUD(); renderBetSummary();
}

function repeatLastBet() {
  if (isSpinning||lastBetSnap.length===0) return;
  if (lastBetSnap.reduce((s,b)=>s+b.amount,0) > balance) { setStatus('Not enough balance to repeat!','lose'); return; }
  clearAllBets();
  lastBetSnap.forEach(b=>{
    const el=document.querySelector(`.bc[data-type="${b.type}"][data-value="${b.value}"]`);
    if (!el) return;
    activeBets.push({...b,el});
    updateCellChip(el,b.amount);
  });
  snd_chip(); updateHUD(); renderBetSummary();
  setStatus('Last bets restored! Press SPIN or adjust your bets.','');
}

// ── AUTO-PLAY ─────────────────────────────────────────────────
function toggleAutoPlay() {
  autoPlay = !autoPlay;
  const btn = document.getElementById('btn-auto');
  btn.textContent = autoPlay ? '⏸ Auto' : '▶ Auto';
  btn.classList.toggle('on', autoPlay);

  if (!autoPlay) {
    stopAutoCountdown();
    setStatus('Auto-play OFF.', '');
    return;
  }

  // Auto is now ON — spin immediately if possible
  if (isSpinning) {
    setStatus('Auto-play ON — will continue after this spin.', '');
    return;
  }
  if (activeBets.length > 0) {
    setStatus('Auto-play ON — spinning now!', '');
    setTimeout(doSpin, 280);
  } else if (lastBetSnap.length > 0) {
    setStatus('Auto-play ON — repeating last bets and spinning…', '');
    repeatLastBet();
    setTimeout(doSpin, 580);
  } else {
    setStatus('Auto-play ON — place your bets and press SPIN to start.', '');
  }
}

function startAutoCountdown(delay) {
  const bar=document.getElementById('auto-countdown');
  const fill=document.getElementById('auto-fill');
  bar.classList.add('active');
  fill.style.transition='none';
  fill.style.width='100%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    fill.style.transition=`width ${delay/1000}s linear`;
    fill.style.width='0%';
  }));
}
function stopAutoCountdown() {
  const bar=document.getElementById('auto-countdown');
  const fill=document.getElementById('auto-fill');
  bar.classList.remove('active');
  fill.style.width='0%';
  if (autoTimer) { clearTimeout(autoTimer); autoTimer=null; }
}

// ── HUD & STATUS ──────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-balance').textContent=fmt(balance);
  document.getElementById('hud-bet').textContent=fmt(activeBets.reduce((s,b)=>s+b.amount,0));
}
function setStatus(msg,cls){
  const el=document.getElementById('game-status');
  el.textContent=msg; el.className='game-status '+(cls||'');
}
function renderBetSummary(){
  const c=document.getElementById('bet-summary'); c.innerHTML='';
  activeBets.forEach(b=>{
    const t=document.createElement('div'); t.className='bs-tag';
    t.textContent=`${b.label}: ${fmt(b.amount)}`; c.appendChild(t);
  });
}

// ── DRAW WHEEL ────────────────────────────────────────────────
function drawWheel() {
  const canvas=document.getElementById('wheel-canvas');
  const size=canvas.offsetWidth||290;
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  const cx=size/2,cy=size/2,r=size/2;
  const step=(2*Math.PI)/WHEEL_SEQ.length;

  WHEEL_SEQ.forEach((num,i)=>{
    const start=i*step-Math.PI/2, end=start+step, col=numColor(num);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end); ctx.closePath();
    ctx.fillStyle=col==='red'?'#a81a1a':col==='black'?'#0e0e0e':'#0d6632'; ctx.fill();
    ctx.strokeStyle='rgba(255,215,100,0.16)'; ctx.lineWidth=0.8; ctx.stroke();

    const mid=start+step/2, tr=r*0.76;
    ctx.save();
    ctx.translate(cx+tr*Math.cos(mid), cy+tr*Math.sin(mid));
    ctx.rotate(mid+Math.PI/2);
    ctx.fillStyle=col==='black'?'#d0d0d0':'#fff';
    ctx.font=`700 ${Math.max(7,Math.floor(r*0.065))}px Oswald,sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=4;
    ctx.fillText(String(num),0,0);
    ctx.restore();
  });

  // Inner ring
  ctx.beginPath(); ctx.arc(cx,cy,r*0.82,0,Math.PI*2);
  ctx.strokeStyle='rgba(201,162,53,0.2)'; ctx.lineWidth=1.5; ctx.stroke();

  // Vignette
  const vg=ctx.createRadialGradient(cx,cy,r*0.15,cx,cy,r);
  vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,0,0.28)');
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=vg; ctx.fill();
}

// ── SPIN ──────────────────────────────────────────────────────
function doSpin() {
  if (isSpinning) return;
  if (activeBets.length===0) { setStatus('Place at least one bet before spinning!','lose'); return; }
  const totalBet=activeBets.reduce((s,b)=>s+b.amount,0);
  if (totalBet>balance) { setStatus('Not enough balance!','lose'); return; }

  const prevBal=balance;
  balance-=totalBet;
  animateBalance(prevBal, balance);

  isSpinning=true;
  document.getElementById('btn-spin').disabled=true;
  document.getElementById('btn-repeat').disabled=true;
  document.getElementById('btn-auto').disabled=true;
  setPhase('spinning');
  setStatus('No more bets! The wheel is spinning…','');
  document.getElementById('win-display').classList.add('hidden');

  snd_spin();

  const winIdx=Math.floor(Math.random()*WHEEL_SEQ.length);
  const winNum=WHEEL_SEQ[winIdx];
  const sliceDeg = 360 / WHEEL_SEQ.length;
  // Correct formula: bring the CENTER of winIdx slice to the top pointer
  const targetMod = ((360 - (winIdx + 0.5) * sliceDeg) % 360 + 360) % 360;
  const curMod = ((wheelRot % 360) + 360) % 360;
  let delta=targetMod-curMod;
  if(delta<0) delta+=360;
  wheelRot+=(Math.floor(Math.random()*4)+7)*360+delta;

  const disk=document.getElementById('wheel-disk');
  disk.style.transition='transform 5.8s cubic-bezier(0.06,0.75,0.18,1)';
  disk.style.transform=`rotate(${wheelRot}deg)`;

  const ball=document.getElementById('ball');
  const orbit=document.getElementById('ball-orbit');
  ball.style.opacity='1';
  ballRot-=(Math.floor(Math.random()*4)+9)*360;
  orbit.style.transition='transform 5.2s cubic-bezier(0.04,0.65,0.26,1)';
  orbit.style.transform=`rotate(${ballRot}deg)`;

  setTimeout(()=>{ ball.style.opacity='0'; resolveRound(winNum,totalBet); }, 6000);
}

// ── RESOLVE ───────────────────────────────────────────────────
function resolveRound(winNum, totalBet) {
  const color=numColor(winNum);
  let payout=0, anyWin=false;

  // Flash ALL cells that win for this number
  document.querySelectorAll('.bc[data-type]').forEach(cell=>{
    if(checkWin(cell.dataset.type,cell.dataset.value,winNum)){
      cell.classList.add('winner-flash');
      setTimeout(()=>cell.classList.remove('winner-flash'),1600);
    }
  });

  activeBets.forEach(b=>{
    if(checkWin(b.type,b.value,winNum)){ payout+=b.amount*(b.multiplier+1); anyWin=true; }
  });

  const prevBal=balance;
  balance+=payout;
  animateBalance(prevBal, balance);

  const net=payout-totalBet;
  if(anyWin) wins++; else losses++;
  netGain+=net;

  // Streak
  if(anyWin) streak = streak>0 ? streak+1 : 1;
  else       streak = streak<0 ? streak-1 : -1;

  numFrequency[winNum]++;
  spinHistory.unshift(winNum);
  if(spinHistory.length>20) spinHistory.pop();
  lastBetSnap=activeBets.map(b=>({...b}));

  renderRecent();
  updateStats();
  updateScoreboard();
  showWinDisplay(winNum, color);
  showOverlay(winNum, color, anyWin, payout, totalBet);

  anyWin ? snd_win() : snd_lose();

  roundNum++;
  document.getElementById('round-num').textContent=roundNum;
  setPhase('result');
  isSpinning=false;
}

function showWinDisplay(n, color) {
  const wd=document.getElementById('win-display');
  const big=document.getElementById('win-num-big');
  const lbl=document.getElementById('win-label');
  big.textContent=n; big.className=`win-num-big ${color}`;
  lbl.textContent=color.toUpperCase();
  wd.classList.remove('hidden');
}

function showOverlay(winNum, color, anyWin, payout, totalBet) {
  document.getElementById('ov-ball').textContent=winNum;
  document.getElementById('ov-ball').className=`ov-ball ${color}`;
  document.getElementById('ov-tag').textContent=`${color.toUpperCase()} • ${winNum}`;

  if(anyWin){
    document.getElementById('ov-headline').textContent='YOU WIN!';
    document.getElementById('ov-headline').className='ov-headline win';
    document.getElementById('ov-payout').textContent='+'+fmt(payout);
    setStatus(`Winner! ${winNum} ${color.toUpperCase()} — You won ${fmt(payout)}!`,'win');
  } else {
    document.getElementById('ov-headline').textContent='NO WIN';
    document.getElementById('ov-headline').className='ov-headline lose';
    document.getElementById('ov-payout').textContent='−'+fmt(totalBet);
    setStatus(`${winNum} ${color.toUpperCase()} — Better luck next time!`,'lose');
  }

  if(autoPlay && lastBetSnap.length>0 && balance>0) {
    // Auto-play: dismiss overlay automatically after 2.2s
    const delay=2200;
    startAutoCountdown(delay);
    document.getElementById('overlay').classList.remove('hidden');
    autoTimer=setTimeout(()=>{ closeOverlay(); setTimeout(()=>{ repeatLastBet(); setTimeout(doSpin,500); },100); }, delay);
  } else {
    document.getElementById('overlay').classList.remove('hidden');
  }

  if(balance<=0){
    document.getElementById('btn-spin').disabled=true;
    setStatus('Out of funds! Press Reset to play again.','lose');
    if(autoPlay) toggleAutoPlay();
  }
}

// ── CLOSE OVERLAY ─────────────────────────────────────────────
function closeOverlay() {
  stopAutoCountdown();
  document.getElementById('overlay').classList.add('hidden');
  clearAllBets();
  // Always re-enable spin if balance allows
  document.getElementById('btn-spin').disabled   = (balance <= 0);
  document.getElementById('btn-repeat').disabled = (lastBetSnap.length === 0);
  document.getElementById('btn-auto').disabled   = false;
  setPhase('betting');
  if (balance > 0 && !autoPlay) setStatus('Place your bets and press SPIN!', '');

  // Auto-play: wait 1.8s then repeat + spin
  if (autoPlay && lastBetSnap.length > 0 && balance > 0) {
    const delay = 1800;
    startAutoCountdown(delay);
    autoTimer = setTimeout(() => {
      repeatLastBet();
      setTimeout(doSpin, 420);
    }, delay);
  }
}

function closeAndRepeat() {
  stopAutoCountdown();
  document.getElementById('overlay').classList.add('hidden');
  clearAllBets();
  document.getElementById('btn-spin').disabled   = (balance <= 0);
  document.getElementById('btn-auto').disabled   = false;
  setPhase('betting');
  setTimeout(()=>{ repeatLastBet(); document.getElementById('btn-repeat').disabled=false; }, 50);
}

// ── RECENT NUMBERS ────────────────────────────────────────────
function renderRecent() {
  const c=document.getElementById('bubble-row'); c.innerHTML='';
  spinHistory.forEach(n=>{
    const b=document.createElement('div');
    b.className=`nb ${numColor(n)}`; b.textContent=n; c.appendChild(b);
  });
  document.getElementById('spin-count').textContent=spinHistory.length+' spins';
}

// ── STATISTICS ────────────────────────────────────────────────
function updateStats() {
  const total=spinHistory.length||1;
  const red  =spinHistory.filter(n=>RED_NUMS.has(n)).length;
  const blk  =spinHistory.filter(n=>n!==0&&!RED_NUMS.has(n)).length;
  const grn  =spinHistory.filter(n=>n===0).length;
  const rp=Math.round(red/total*100),bp=Math.round(blk/total*100),gp=Math.round(grn/total*100);
  document.getElementById('bar-red').style.width=rp+'%';
  document.getElementById('bar-black').style.width=bp+'%';
  document.getElementById('bar-green').style.width=gp+'%';
  document.getElementById('pct-red').textContent=rp+'%';
  document.getElementById('pct-black').textContent=bp+'%';
  document.getElementById('pct-green').textContent=gp+'%';

  const played=numFrequency.map((c,n)=>({n,c})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c);
  renderHCNums('hc-hot', played.slice(0,4));
  renderHCNums('hc-cold',played.slice(-4).reverse());
}

function renderHCNums(id, items) {
  const c=document.getElementById(id); c.innerHTML='';
  if(!items.length){c.textContent='—';return;}
  items.forEach(({n})=>{
    const el=document.createElement('div');
    el.className=`hc-num ${numColor(n)}`; el.textContent=n; c.appendChild(el);
  });
}

function updateScoreboard() {
  document.getElementById('gs-wins').textContent=wins;
  document.getElementById('gs-losses').textContent=losses;
  // Streak
  const strEl=document.getElementById('gs-streak');
  if(streak>0){ strEl.textContent=streak+'W'; strEl.style.color='#2ecc71'; }
  else if(streak<0){ strEl.textContent=Math.abs(streak)+'L'; strEl.style.color='#e74c3c'; }
  else { strEl.textContent='—'; strEl.style.color=''; }
  // Net
  const nEl=document.getElementById('gs-net');
  nEl.textContent=(netGain>=0?'+':'−')+fmt(netGain);
  nEl.style.color=netGain>=0?'#2ecc71':'#e74c3c';
  // Balance
  document.getElementById('hud-balance').textContent=fmt(balance);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e=>{
    if(e.target.matches('input,select,textarea')) return;
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        if(!isSpinning && activeBets.length>0) doSpin();
        break;
      case 'Escape':
        if(!document.getElementById('overlay').classList.contains('hidden')) closeOverlay();
        break;
    }
    switch(e.key.toLowerCase()) {
      case 'r': if(!isSpinning) repeatLastBet(); break;
      case 'd': doubleAllBets(); break;
      case 'c': clearAllBets(); break;
      case 'u': undoLast(); break;
    }
  });
}

// ── RESET ─────────────────────────────────────────────────────
function resetAll() {
  if(isSpinning) return;
  if(autoPlay) toggleAutoPlay();
  stopAutoCountdown();

  balance=1000; wins=0; losses=0; netGain=0; streak=0;
  roundNum=1; wheelRot=0; ballRot=0;
  spinHistory=[]; numFrequency=new Array(37).fill(0);
  lastBetSnap=[]; betHistory=[];

  const disk=document.getElementById('wheel-disk');
  const orbit=document.getElementById('ball-orbit');
  const ball=document.getElementById('ball');
  disk.style.transition='none'; disk.style.transform='rotate(0deg)';
  orbit.style.transition='none'; orbit.style.transform='rotate(0deg)';
  ball.style.opacity='0';

  document.getElementById('btn-spin').disabled=false;
  document.getElementById('btn-repeat').disabled=true;
  document.getElementById('btn-auto').disabled=false;
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('win-display').classList.add('hidden');
  document.getElementById('round-num').textContent='1';

  ['gs-wins','gs-losses'].forEach(id=>document.getElementById(id).textContent='0');
  document.getElementById('gs-streak').textContent='—';
  document.getElementById('gs-streak').style.color='';
  document.getElementById('gs-net').textContent='$0';
  document.getElementById('gs-net').style.color='';
  ['bar-red','bar-black','bar-green'].forEach(id=>document.getElementById(id).style.width='0%');
  ['pct-red','pct-black','pct-green'].forEach(id=>document.getElementById(id).textContent='0%');
  document.getElementById('hc-hot').textContent='—';
  document.getElementById('hc-cold').textContent='—';
  document.getElementById('spin-count').textContent='0 spins';

  buildTable(); activeBets=[];
  renderBetSummary(); renderRecent(); updateHUD();
  setPhase('betting');
  setStatus('New game! Select a chip and place your bets.','');
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', ()=>{
  initTip();
  buildTable();
  drawWheel();
  updateHUD();
  renderRecent();
  setPhase('betting');
  initKeyboard();

  // Default chip: $10
  const def=document.querySelector('.chip[data-v="10"]');
  if(def) selectChip(def,10);

  // Redraw on resize
  let rt;
  window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(drawWheel,100); });
});
