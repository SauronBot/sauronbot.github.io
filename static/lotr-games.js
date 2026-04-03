/**
 * LOTR Easter-Egg — Carry the Ring
 * Triggered by: ↑↑↓↓←→←→BA (Konami code)
 *
 * A 9-level dodge game across a scrolling 2× world with parallax backgrounds.
 *
 * Book I — The Fellowship of the Ring
 *   Ch.1: Shire → Rivendell. 3–5 Nazgûl. Gentle Eye. Green palette.
 *   Ch.2: Mines of Moria. Balrog boss, torch darkness, no sky.
 *   Ch.3: Lothlórien. Ethereal rest — Mirror of Galadriel tempts.
 *
 * Book II — The Two Towers
 *   Ch.4: Emyn Muil / Dead Marshes. 4–7 Nazgûl + Gollum. Eye wakes often.
 *   Ch.5: The Black Gate. Heavy orc patrols, industrial Mordor.
 *   Ch.6: Shelob's Lair. Spider boss, absolute darkness.
 *
 * Book III — The Return of the King
 *   Ch.7: Minas Morgul. Undead city, permanent Eye.
 *   Ch.8: Pelennor Fields. Battle rages, Eye distracted.
 *   Ch.9: Mount Doom. Full chaos, Ring corruption, final climb.
 *
 * Mechanics:
 *   - WASD / Arrow keys to move Frodo
 *   - 🔑 Key spawns 1s in — collect it to unlock the 🔒 goal
 *   - ♥ Life pickup appears mid-field when below max lives
 *   - Speed slows as you approach the goal (Ring grows heavier)
 *   - Eye of Sauron opens periodically — Nazgûl home in when active
 *   - Lives carry between levels; gameover restarts with 2 lives
 *   - Canvas scales to viewport (responsive); touch/pointer follow on mobile
 */
(function () {
  'use strict';

  // ── KONAMI DETECTOR ───────────────────────────────────────────────────
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown',
                  'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
                  'b','a'];
  let konamiIdx = 0;
  document.addEventListener('keydown', e => {
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        launchCarryTheRing();
      }
    } else {
      konamiIdx = (e.key === KONAMI[0]) ? 1 : 0;
    }
  });

  // ── LAUNCHER ──────────────────────────────────────────────────────────
  // Exposed for testing
  window.__lotrLaunch = () => launchCarryTheRing();

  // ── AUDIO ENGINE ─────────────────────────────────────────────────────
  let _audioCtx = null, _audioEnabled = false;
  function getAudioCtx() {
    if (!_audioCtx) { try { _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} }
    return _audioCtx;
  }
  function playTone(freq, type, gainVal, duration, fadeOut=true, delay=0) {
    if (!_audioEnabled) return;
    const ac = getAudioCtx(); if (!ac) return;
    try {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ac.currentTime+delay);
      g.gain.linearRampToValueAtTime(gainVal, ac.currentTime+delay+0.05);
      if (fadeOut) g.gain.linearRampToValueAtTime(0, ac.currentTime+delay+duration);
      osc.connect(g); g.connect(ac.destination);
      osc.start(ac.currentTime+delay); osc.stop(ac.currentTime+delay+duration+0.05);
    } catch(e){}
  }
  function playNoise(gainVal, duration, filterFreq=400) {
    if (!_audioEnabled) return;
    const ac = getAudioCtx(); if (!ac) return;
    try {
      const bufLen = ac.sampleRate * duration;
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i=0;i<bufLen;i++) data[i]=(Math.random()*2-1);
      const src = ac.createBufferSource();
      const filt = ac.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=filterFreq;
      const g = ac.createGain();
      g.gain.setValueAtTime(gainVal, ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime+duration);
      src.buffer=buf; src.connect(filt); filt.connect(g); g.connect(ac.destination);
      src.start(); src.stop(ac.currentTime+duration+0.05);
    } catch(e){}
  }
  // Sound events
  function sndHit()      { playTone(120,'sawtooth',0.18,0.35); playNoise(0.06,0.25,300); }
  function sndDash()     {
    // Whoosh: descending sweep + brief invincibility zing
    const ac = getAudioCtx(); if (!ac || !_audioEnabled) return;
    try {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.22);
      g.gain.setValueAtTime(0.12, ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.22);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.23);
    } catch(e){}
    playTone(1200,'sine',0.04,0.08);
  }
  function sndPickup()   { playTone(880,'sine',0.07,0.08); playTone(1100,'sine',0.05,0.08,true,0.06); }
  function sndKey()      { [440,550,660,880].forEach((f,i)=>playTone(f,'sine',0.06,0.12,true,i*0.06)); }
  function sndLevelWin() { [523,659,784,1047].forEach((f,i)=>playTone(f,'sine',0.07,0.25,true,i*0.1)); }
  function sndEyeOpen()  { playTone(55,'sawtooth',0.12,1.2); playTone(80,'sawtooth',0.08,1.5,true,0.2); }
  function sndBalrog()   { playTone(40,'sawtooth',0.2,1.8); playNoise(0.1,1.5,200); }
  function sndHorn()     { playTone(220,'square',0.1,0.4); playTone(174,'square',0.08,0.6,true,0.35); }

  // ── AMBIENT DRONE ENGINE ──────────────────────────────────────────────────
  let _droneNodes = [];  // {osc, gain} pairs currently playing
  function stopDrones() {
    const ac = _audioCtx;
    _droneNodes.forEach(({osc,gain}) => {
      try {
        if (ac) { gain.gain.linearRampToValueAtTime(0, ac.currentTime+1.0); osc.stop(ac.currentTime+1.1); }
        else { osc.stop(); }
      } catch(e){}
    });
    _droneNodes = [];
  }
  function startDroneLayer(freq, type, gainVal, detune=0) {
    const ac = getAudioCtx(); if (!ac || !_audioEnabled) return;
    try {
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = type; osc.frequency.value = freq;
      if (detune) osc.detune.value = detune;
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(gainVal, ac.currentTime+2);
      osc.connect(g); g.connect(ac.destination);
      osc.start();
      _droneNodes.push({osc, gain:g});
    } catch(e){}
  }
  // Level-specific ambient drones
  const LEVEL_DRONES = [
    // L0 Shire: warm soft hum (morning birds feel)
    () => { startDroneLayer(220,'sine',0.025); startDroneLayer(330,'sine',0.015,5); },
    // L1 Moria: deep ominous pulse + distant drums sim
    () => { startDroneLayer(55,'sawtooth',0.035); startDroneLayer(110,'sawtooth',0.02,-8); startDroneLayer(82,'square',0.012); },
    // L2 Lothl: ethereal silver hum
    () => { startDroneLayer(528,'sine',0.018); startDroneLayer(792,'sine',0.010,10); },
    // L3 Marshes: low eerie moan
    () => { startDroneLayer(80,'sawtooth',0.022,-5); startDroneLayer(120,'sine',0.012,7); },
    // L4 Black Gate: industrial grind
    () => { startDroneLayer(55,'sawtooth',0.04); startDroneLayer(73,'sawtooth',0.025,-12); },
    // L5 Shelob: high tense buzz + low rumble
    () => { startDroneLayer(60,'sawtooth',0.03); startDroneLayer(440,'sine',0.008,15); },
    // L6 Morgul: undead whine
    () => { startDroneLayer(90,'sawtooth',0.025); startDroneLayer(135,'sine',0.015,-6); },
    // L7 Pelennor: war bass
    () => { startDroneLayer(65,'sawtooth',0.038); startDroneLayer(97,'sawtooth',0.02,8); },
    // L8 Mt Doom: volcanic deep rumble
    () => { startDroneLayer(40,'sawtooth',0.045); startDroneLayer(60,'sawtooth',0.03,-15); startDroneLayer(80,'sine',0.018); },
  ];
  function startLevelDrone(lvl) {
    stopDrones();
    if (_audioEnabled && LEVEL_DRONES[lvl]) LEVEL_DRONES[lvl]();
  }

  // ── OVERLAY HELPERS ───────────────────────────────────────────────────
  function makeOverlay(bgColor) {
    window.__lotrActive = true;
    // Prevent text selection + scroll while game is open
    const _bodySelect   = document.body.style.userSelect;
    const _bodyOverflow = document.body.style.overflow;
    document.body.style.userSelect      = 'none';
    document.body.style.webkitUserSelect= 'none';
    document.body.style.overflow        = 'hidden';
    const ov = document.createElement('div');
    Object.assign(ov.style, {
      position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      background: bgColor || '#060309',
      zIndex: '99999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Palatino Linotype",Palatino,Georgia,serif',
      overflow: 'hidden',
    });
    document.body.appendChild(ov);
    // Clean up flag when overlay is removed
    const mo = new MutationObserver(() => {
      if (!document.body.contains(ov)) {
        window.__lotrActive = false;
        document.body.style.userSelect       = _bodySelect;
        document.body.style.webkitUserSelect  = _bodySelect;
        document.body.style.overflow          = _bodyOverflow;
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true });
    return ov;
  }

  function makeCanvas(ov, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const c = document.createElement('canvas');
    // Buffer at device pixels for crisp rendering
    c.width  = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    // CSS size = logical game size (already viewport-fitted by caller)
    c.style.display = 'block';
    c.style.width   = w + 'px';
    c.style.height  = h + 'px';
    // Clean up resize listener on close
    const mo = new MutationObserver(() => {
      if (!document.body.contains(ov)) mo.disconnect();
    });
    mo.observe(document.body, { childList: true });
    ov.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return c;
  }

  function makeCloseBtn(ov, closeFn, getState) {
    // Pause modal
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      display: 'none', position: 'absolute', inset: '0',
      background: 'rgba(0,0,0,0.82)',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: '16px',
      zIndex: '20', fontFamily: '"Palatino Linotype",Palatino,Georgia,serif',
    });
    const title = document.createElement('p');
    title.textContent = '— Paused —';
    Object.assign(title.style, { color: '#d4a020', fontSize: '22px', fontWeight: 'bold', margin: '0' });
    const sub = document.createElement('p');
    sub.textContent = 'The Ring waits...';
    Object.assign(sub.style, { color: 'rgba(180,140,60,0.7)', fontSize: '13px', fontStyle: 'italic', margin: '0' });
    function makeModalBtn(label, col, fn) {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        background: 'transparent', border: `1px solid ${col}`, color: col,
        padding: '8px 28px', cursor: 'pointer', borderRadius: '6px',
        fontFamily: 'inherit', fontSize: '14px', letterSpacing: '1px',
      });
      b.onclick = fn;
      return b;
    }
    let paused = false;
    function showModal() {
      paused = true;
      modal.style.display = 'flex';
      continueBtn.focus();
    }
    function hideModal() {
      paused = false;
      modal.style.display = 'none';
    }
    const continueBtn = makeModalBtn('Continue', 'rgba(180,140,60,0.8)', hideModal);
    const exitBtn     = makeModalBtn('Exit game', 'rgba(180,60,60,0.8)', closeFn);
    modal.append(title, sub, continueBtn, exitBtn);
    ov.appendChild(modal);

    // Expose pause state so game loop can check it
    ov._isPaused = () => paused;

    // Focus trap: Tab cycles only between Continue and Exit while modal is open
    const onTab = e => {
      if (!paused || e.key !== 'Tab') return;
      e.preventDefault();
      const btns = [continueBtn, exitBtn];
      const cur = document.activeElement;
      const idx = btns.indexOf(cur);
      btns[(idx + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    };
    document.addEventListener('keydown', onTab);

    // Esc: if playing → show modal; if modal open → hide modal
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      const st = typeof getState === 'function' ? getState() : 'playing';
      if (paused) { hideModal(); }
      else if (st === 'playing') { showModal(); }
      else { closeFn(); }
    };
    document.addEventListener('keydown', onKey);
    // Cleanup
    const mo = new MutationObserver(() => {
      if (!document.body.contains(ov)) {
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keydown', onTab);
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList: true });
    // No visible X button — close only via modal
    return { showModal, hideModal, isPaused: () => paused };
  }

  // ── SHARED STAR FIELD ─────────────────────────────────────────────────
  const STARS = Array.from({length: 60}, () => ({
    x: Math.random(), y: Math.random() * 0.55,
    r: Math.random() * 0.9 + 0.3,
    twinkle: Math.random() * Math.PI * 2,
  }));

  function drawStars(ctx, W, H, t) {
    STARS.forEach(s => {
      const alpha = 0.4 + Math.sin(t * 0.8 + s.twinkle) * 0.25;
      ctx.fillStyle = `rgba(255,250,220,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // GAME 1: CARRY THE RING  (3 levels)
  // ─────────────────────────────────────────────────────────────────────
  const LEVEL_DEFS = [
    // ── BOOK I ───────────────────────────────────────────────────────────
    {
      book: 'I', chapter: 1,
      title:       'The Fellowship of the Ring',
      subtitle:    '"Even the smallest person can change the course of the future."',
      destination: 'Rivendell',
      bgSky:   ['#0a1520','#1a2c18'], bgGnd: ['#1a3010','#122008'],
      roadCol: 'rgba(65,85,35,0.9)', horizon: '#223818',
      glow: [100,180,60], glowAlpha: 0.20, destGlow: [100,180,60],
      initWraiths:3, maxWraiths:5, wraithSpeed:1.1, eyeIdleBase:22, eyeActiveDur:5, spawnMin:4.5,
      hasGollum:false, hasBlindFlash:false, hasShelob:false, hasBalrog:false,
      companion: 'fellowship', // Gandalf + Aragorn silhouettes at goal
      flavour:['The Shire grows distant...','The Road goes ever on...','Rivendell is near...','Almost there...'],
      winMsg:'The Fellowship is formed.', winQuote:'"One ring to rule them all..."',
      progressLabel:'THE ROAD TO RIVENDELL',
    },
    {
      book: 'I', chapter: 2,
      title:       'The Mines of Moria',
      subtitle:    '"Fly, you fools!"',
      destination: 'Bridge of Khazad-dûm',
      bgSky:   ['#000000','#040208'], bgGnd: ['#0a0608','#060404'],
      roadCol: 'rgba(30,20,10,0.95)', horizon: '#0d0a0a',
      glow: [180,80,20], glowAlpha: 0.35, destGlow: [200,90,10],
      initWraiths:4, maxWraiths:8, wraithSpeed:1.3, eyeIdleBase:15, eyeActiveDur:7, spawnMin:3.5,
      hasGollum:false, hasBlindFlash:false, hasShelob:false, hasBalrog:true,
      companion: 'gandalf',
      flavour:['The darkness is absolute...','Something stirs in the deep...','The drums... drums in the deep...','The bridge is ahead!'],
      winMsg:'You have crossed Khazad-dûm.', winQuote:'"You cannot pass!"',
      progressLabel:'THE MINES OF MORIA',
    },
    {
      book: 'I', chapter: 3,
      title:       'Lothlórien',
      subtitle:    '"Even the smallest light can be found in the darkest of times."',
      destination: 'The Mirror of Galadriel',
      bgSky:   ['#020508','#060c10'], bgGnd: ['#081408','#040c04'],
      roadCol: 'rgba(20,50,20,0.85)', horizon: '#0a1e0a',
      glow: [160,255,180], glowAlpha: 0.15, destGlow: [160,255,180],
      initWraiths:2, maxWraiths:4, wraithSpeed:1.0, eyeIdleBase:28, eyeActiveDur:4, spawnMin:6,
      hasGollum:false, hasBlindFlash:false, hasShelob:false, hasBalrog:false,
      companion: 'galadriel',
      flavour:['The wood breathes...','Light flows between the leaves...','The Mirror calls...','Do not look into it!'],
      winMsg:"Galadriel's gift is yours.", winQuote:'"Even the smallest person can change the course of the future."',
      progressLabel:'THE GOLDEN WOOD',
    },
    // ── BOOK II ──────────────────────────────────────────────────────────
    {
      book: 'II', chapter: 4,
      title:       'The Dead Marshes',
      subtitle:    '"There are dead things... faces in the water."',
      destination: 'Emyn Muil',
      bgSky:   ['#080610','#0e0c18'], bgGnd: ['#1a1508','#100e06'],
      roadCol: 'rgba(60,50,20,0.9)', horizon: '#1e1a0a',
      glow: [160,120,40], glowAlpha: 0.22, destGlow: [200,100,20],
      initWraiths:4, maxWraiths:7, wraithSpeed:1.4, eyeIdleBase:14, eyeActiveDur:7, spawnMin:3.2,
      hasGollum:true, hasBlindFlash:false, hasShelob:false, hasBalrog:false,
      companion: null,
      flavour:['Gollum circles in the shadows...','The marshes pull at every step...','The faces glow beneath the water...','We musst go on, yess...'],
      winMsg:'The Emyn Muil is behind you.', winQuote:'"Not all those who wander are lost."',
      progressLabel:'THE DEAD MARSHES',
    },
    {
      book: 'II', chapter: 5,
      title:       'The Black Gate',
      subtitle:    '"The Gate is shut. There is no way in."',
      destination: 'The Secret Stair',
      bgSky:   ['#040208','#080410'], bgGnd: ['#140808','#0a0404'],
      roadCol: 'rgba(50,20,10,0.95)', horizon: '#160808',
      glow: [200,30,10], glowAlpha: 0.38, destGlow: [220,40,0],
      initWraiths:5, maxWraiths:9, wraithSpeed:1.65, eyeIdleBase:10, eyeActiveDur:9, spawnMin:2.5,
      hasGollum:true, hasBlindFlash:false, hasShelob:false, hasBalrog:false,
      companion: null,
      flavour:['The armies of Mordor mass at the gate...','No way through the front...','Gollum knows another path...','The stair is close!'],
      winMsg:'You found the secret stair.', winQuote:'"There is another way... Gollum knows it."',
      progressLabel:'THE ROAD TO CIRITH UNGOL',
    },
    {
      book: 'II', chapter: 6,
      title:       "Shelob's Lair",
      subtitle:    '"She hunts by feel, by smell."',
      destination: 'The Pass of Cirith Ungol',
      bgSky:   ['#000000','#020004'], bgGnd: ['#040002','#020001'],
      roadCol: 'rgba(10,0,10,0.98)', horizon: '#060004',
      glow: [100,0,120], glowAlpha: 0.3, destGlow: [120,20,140],
      initWraiths:3, maxWraiths:6, wraithSpeed:1.5, eyeIdleBase:12, eyeActiveDur:8, spawnMin:3.5,
      hasGollum:true, hasBlindFlash:true, hasShelob:true, hasBalrog:false,
      companion: null,
      flavour:['The darkness is absolute...','Something enormous moves above...','She is close...','The light of Eärendil!'],
      winMsg:'You have passed through the lair.', winQuote:'"In the darkness bind them."',
      progressLabel:"SHELOB'S LAIR",
    },
    // ── BOOK III ─────────────────────────────────────────────────────────
    {
      book: 'III', chapter: 7,
      title:       'Minas Morgul',
      subtitle:    '"The tower of the dead."',
      destination: 'The Morgul Road',
      bgSky:   ['#010308','#020410'], bgGnd: ['#060a06','#040804'],
      roadCol: 'rgba(10,30,10,0.95)', horizon: '#081008',
      glow: [40,200,60], glowAlpha: 0.28, destGlow: [60,220,80],
      initWraiths:6, maxWraiths:10, wraithSpeed:1.8, eyeIdleBase:8, eyeActiveDur:11, spawnMin:2.2,
      hasGollum:true, hasBlindFlash:true, hasShelob:false, hasBalrog:false,
      companion: null,
      flavour:['The dead city pulses with green light...','The Nazgûl Lord rides out...','The Ring screams to be used...','Keep moving!'],
      winMsg:'Minas Morgul is behind you.', winQuote:'"The power of the Ring could not be hidden."',
      progressLabel:'THE MORGUL ROAD',
    },
    {
      book: 'III', chapter: 8,
      title:       'The Pelennor Fields',
      subtitle:    '"I am no man!"',
      destination: 'The Crack of Doom',
      bgSky:   ['#060208','#0c040e'], bgGnd: ['#180808','#0e0404'],
      roadCol: 'rgba(60,20,10,0.9)', horizon: '#1a0808',
      glow: [255,120,20], glowAlpha: 0.35, destGlow: [255,140,0],
      initWraiths:7, maxWraiths:12, wraithSpeed:1.9, eyeIdleBase:6, eyeActiveDur:12, spawnMin:2.0,
      hasGollum:true, hasBlindFlash:true, hasShelob:false, hasBalrog:false,
      companion: null,
      flavour:['The battle rages all around...','Eagles! The eagles are coming!','The Eye is distracted by war...','Almost to Mordor!'],
      winMsg:'The battle is won. Mordor awaits.', winQuote:'"I cannot carry it for you... but I can carry you!"',
      progressLabel:'ACROSS PELENNOR',
    },
    {
      book: 'III', chapter: 9,
      title:       'The Return of the King',
      subtitle:    '"I cannot carry it for you... but I can carry you!"',
      destination: 'Mount Doom',
      bgSky:   ['#04020a','#0e0408'], bgGnd: ['#1c0a04','#0c0602'],
      roadCol: 'rgba(65,30,10,0.9)', horizon: '#1e0a04',
      glow: [255,50,5], glowAlpha: 0.45, destGlow: [255,60,0],
      initWraiths:8, maxWraiths:14, wraithSpeed:2.2, eyeIdleBase:5, eyeActiveDur:14, spawnMin:1.6,
      hasGollum:true, hasBlindFlash:true, hasShelob:false, hasBalrog:false,
      companion: null,
      flavour:['Every step is agony...','The Eye sees all...','The Ring commands you to stop...','Throw it in the fire!'],
      winMsg:'It is done.', winQuote:'"My precious..."',
      progressLabel:'THE ROAD TO MOUNT DOOM',
    },
  ];
  function launchCarryTheRing() {
    // God mode: ?god=chema — infinite lives and infinite dash
    const GOD_MODE = new URLSearchParams(window.location.search).get('god') === 'chema';

    const ov = makeOverlay('#060309');
    const isTouch = 'ontouchstart' in window;
    // Fill the whole screen. Close btn is absolute (no flex space). Dash btn takes 90px on touch.
    const W = window.innerWidth;
    const H = window.innerHeight - (isTouch ? 90 : 0);
    const WORLD_W = W * 2;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; stopDrones(); ov.remove(); }
    const pauseCtrl = makeCloseBtn(ov, close, () => state);

    // ── Mobile dash button ─────────────────────────────────────────────────────────
    const dashBtn = document.createElement('button');
    dashBtn.textContent = '⚡';
    Object.assign(dashBtn.style, {
      width: '72px', height: '72px',
      borderRadius: '50%',
      background: 'rgba(60,100,200,0.25)',
      border: '2px solid rgba(100,160,255,0.55)',
      color: 'rgba(160,210,255,0.95)',
      fontSize: '30px',
      cursor: 'pointer',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      marginTop: '10px',
      flexShrink: '0',
      display: 'none',   // shown only on touch
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.12s',
    });
    dashBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      dashBtn.style.background = 'rgba(60,100,200,0.6)';
      triggerDash();
    }, {passive:false});
    dashBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); e.stopPropagation();
      dashBtn.style.background = 'rgba(60,100,200,0.25)';
    }, {passive:false});
    ov.appendChild(dashBtn);
    if ('ontouchstart' in window) dashBtn.style.display = 'flex';

    // Sound toggle button (top-right corner)
    _audioEnabled = true; // on by default
    const sndBtn = document.createElement('button');
    sndBtn.textContent = '\uD83D\uDD0A';
    Object.assign(sndBtn.style, {
      position:'absolute', top:'8px', right:'8px',
      background:'rgba(0,0,0,0.4)', border:'1px solid rgba(180,140,60,0.4)',
      color:'rgba(200,160,60,0.9)', fontSize:'16px', width:'32px', height:'32px',
      borderRadius:'6px', cursor:'pointer', zIndex:'10', lineHeight:'1',
    });
    sndBtn.title = 'Toggle sound';
    sndBtn.addEventListener('click', () => {
      _audioEnabled = !_audioEnabled;
      sndBtn.textContent = _audioEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
      sndBtn.style.color = _audioEnabled ? 'rgba(200,160,60,0.9)' : 'rgba(100,80,40,0.5)';
      if (_audioEnabled) { const ac = getAudioCtx(); if (ac && ac.state==='suspended') ac.resume(); }
      else stopDrones();
    });
    ov.appendChild(sndBtn);

    const keys = {};

    // ── Virtual joystick (touch) + mouse follow ──────────────────────────────────
    let pointerTarget = null;
    const joystick = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, id: -1 };
    const JOY_R = 48; // joystick radius
    const JOY_ZONE_W = W * 0.45; // left 45% of screen = joystick zone

    function pointerToWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const lx = (clientX - rect.left) * scaleX;
      const ly = (clientY - rect.top)  * scaleY;
      return { x: lx + cameraX, y: ly };
    }

    function getCanvasXY(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return { x: (clientX-rect.left)*(W/rect.width), y: (clientY-rect.top)*(H/rect.height) };
    }

    function handlePointerDown(e) {
      e.preventDefault();
      if (state !== 'playing') {
        if (state==='title') startLevel(0);
        else if (state==='levelwin') startLevel(currentLevel+1);
        else if (state==='gameover') {
          if (e.key === 'c' || e.key === 'C') { if (sessionCheckpoint > 0) { fullReset(); startLevel(sessionCheckpoint); } }
          else { fullReset(); startLevel(0); }
        }
        else if (state==='win') { round++; score+=200; startLevel(0); }
        return;
      }
      const touches = e.touches ? Array.from(e.changedTouches) : [e];
      touches.forEach(pt => {
        const {x,y} = getCanvasXY(pt.clientX, pt.clientY);
        if (isTouch && x < JOY_ZONE_W) {
          // Joystick zone
          if (!joystick.active) {
            joystick.active = true;
            joystick.baseX = x; joystick.baseY = y;
            joystick.dx = 0; joystick.dy = 0;
            joystick.id = pt.identifier !== undefined ? pt.identifier : -1;
          }
        } else {
          pointerTarget = pointerToWorld(pt.clientX, pt.clientY);
        }
      });
    }
    function handlePointerMove(e) {
      if (state !== 'playing') return;
      e.preventDefault();
      const touches = e.touches ? Array.from(e.changedTouches) : [e];
      touches.forEach(pt => {
        if (isTouch && joystick.active && pt.identifier === joystick.id) {
          const {x,y} = getCanvasXY(pt.clientX, pt.clientY);
          const dx = x - joystick.baseX, dy = y - joystick.baseY;
          const d = Math.hypot(dx,dy)||1;
          const clamped = Math.min(d, JOY_R);
          joystick.dx = (dx/d)*clamped/JOY_R;
          joystick.dy = (dy/d)*clamped/JOY_R;
        } else if (!joystick.active || pt.identifier !== joystick.id) {
          pointerTarget = pointerToWorld(pt.clientX, pt.clientY);
        }
      });
    }
    function handlePointerUp(e) {
      const touches = e.touches ? Array.from(e.changedTouches) : [e];
      touches.forEach(pt => {
        if (isTouch && joystick.active && pt.identifier === joystick.id) {
          joystick.active = false; joystick.dx = 0; joystick.dy = 0;
        } else {
          pointerTarget = null;
        }
      });
    }

    canvas.addEventListener('touchstart', handlePointerDown, {passive:false});
    canvas.addEventListener('touchmove',  handlePointerMove, {passive:false});
    canvas.addEventListener('touchend',   handlePointerUp,   {passive:false});
    canvas.addEventListener('mousedown',  handlePointerDown);
    canvas.addEventListener('mousemove',  (e) => { if(e.buttons) handlePointerMove(e); });
    canvas.addEventListener('mouseup',    handlePointerUp);

    // ── Keyboard input ──────────────────────────────────────────────────────
    const MOVE_KEYS = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S']);
    // Unlock AudioContext on first user gesture
    function unlockAudio() {
      const ac = getAudioCtx();
      if (ac && ac.state === 'suspended') ac.resume();
    }
    canvas.addEventListener('mousedown', unlockAudio, {once:true});
    canvas.addEventListener('touchstart', unlockAudio, {once:true, passive:true});
    document.addEventListener('keydown', unlockAudio, {once:true});

    const onKd = e => {
      if (pauseCtrl.isPaused()) return; // block input while paused
      keys[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (MOVE_KEYS.has(e.key)) pointerTarget = null;
      if (e.key === ' ') {
        if (state === 'title')    startLevel(0);
        else if (state === 'levelwin') startLevel(currentLevel + 1);
        else if (state === 'gameover') { if(sessionCheckpoint>0){fullReset();startLevel(sessionCheckpoint);}else{fullReset();startLevel(0);} }
        else if (state === 'win') { round++; score+=200; startLevel(0); }
        else if (state === 'playing') triggerDash();
      }
    };
    const onKu = e => { keys[e.key] = false; };
    document.addEventListener('keydown', onKd);
    document.addEventListener('keyup',   onKu);
    // Cleanup keyboard listeners when overlay is removed
    new MutationObserver(() => {
      if (!document.body.contains(ov)) {
        document.removeEventListener('keydown', onKd);
        document.removeEventListener('keyup',   onKu);
      }
    }).observe(document.body, {childList:true});

    let state = 'title';
    let currentLevel = 0;
    let round = 1;    // increments after completing all 3 levels
    let score = 0;    // accumulated points
    let lastScore = 0, lastRound = 1, lastLevel = 0; // for gameover screen
    let sessionCheckpoint = 0; // furthest level reached this session
    let frodo, wraiths=[], gollum=null, balrog=null, shelob=null, particles=[], eye=null, shake={x:0,y:0}, timers={elapsed:0};
    let spiderlings = [];
    let blessingPickup = null;
    let blessingActive = 0;
    let hornTimer = 20;
    let hornActive = 0;
    let ynapassTimer = 0;
    let eyeDistracted=false, eyeDistractTimer=15, eyeEagleTimer=0, eagleParticles=[];
    let blindFlash = 0, levelTransTimer = 0;
    let seenEnemyTypes = new Set(), enemyIntroTimer = 0, enemyIntroName = '';
    let flavourIdx = -1, flavourAlpha = 0;
    let hitFlashLevel = 0;
    let whisperText = '', whisperTimer = 0, whisperCooldown = 0;
    let ambientParticles = [], ambientSpawnTimer = 0;
    let comboTimer = 0, comboMult = 1, comboFlash = 0; // score combo
    let ringPullTimer = 0, ringPullActive = 0, ringPullAngle = 0; // Ring corruption pull
    let lifePickup = null;  // {x,y,r,pulse}
    let keyPickup = null;   // {x,y,r,pulse} — must collect before goal unlocks
    let goalUnlocked = false;
    let dashCharges = 3;    // shared across all levels
    const maxLives     = () => Math.min(5, 3 + (round - 1)); // +1 per round, max 5
    const maxDash      = () => Math.min(5, 3 + (round - 1)); // +1 per round, max 5
    let dashRefill = null;  // {x,y,r,pulse} — refill token near Gollum's zone
    let dash = null;        // {vx,vy,timer} — active dash state

    // Difficulty multiplier per round (caps to avoid impossible)
    function diffMult() { return 1 + (round - 1) * 0.10; } // +10% enemy speed per round, Frodo unaffected

    function startLevel(lvl) {
      currentLevel = lvl;
      const def = LEVEL_DEFS[lvl];
      const prevLives = frodo ? frodo.lives : 3;
      frodo = {
        x: 80, y: H*0.62, r: 11,
        lives: (state === 'title' || round === 1 && lvl === 0) ? maxLives() : prevLives,
        invincible: false, invTimer: 0, hitFlash: 0, ringAngle: 0,
      };
      wraiths = [];
      // Spread initial wraiths across the world — last third near the goal
      const scaledInit = Math.round(def.initWraiths * areaScale);
      const scaledMax  = Math.round(def.maxWraiths  * areaScale);
      // +1 enemy per round completed, capped at scaledMax
      const initCount  = Math.min(scaledInit + (round - 1), scaledMax);
      for (let i = 0; i < initCount; i++) spawnWraith(def, i, initCount);
      gollum = def.hasGollum ? makeGollum() : null;
      balrog = def.hasBalrog ? makeBalrog() : null;
      shelob = def.hasShelob ? makeShelob() : null;
      eyeDistracted=false; eyeDistractTimer=15+Math.random()*5; eyeEagleTimer=0; eagleParticles=[];
      particles = [];
      eye = {
        phase: 'idle', timer: 0, open: 0,
        idleDur: Math.max(6, (def.eyeIdleBase + 3 + Math.random()*6) / diffMult()),
        activeDur: def.eyeActiveDur,
        warnDur: 2.2, closeDur: 1.5,
        px: W/2, py: 65,
      };
      shake = {x:0,y:0,dur:0,intensity:0};
      timers = {elapsed:0,spawnCD:0,pickupCD:3};
      blindFlash = 0;
      lifePickup = null;
      goalUnlocked = false;
      dash = null;
      dashRefill = null;
      // On fresh game reset to base; on new round top up to round bonus
      if (state === 'title') dashCharges = maxLives(); // round=1 → 3
      else dashCharges = Math.max(dashCharges, maxDash()); // carry + give round bonus
      // Key spawns at a random mid-field position, away from start and goal
      const kx = 300 + Math.random() * (WORLD_W - 700);
      const ky = H * 0.2 + Math.random() * (H * 0.6);
      keyPickup = { x: kx, y: ky, r: 14, pulse: 0, spawned: false, spawnTimer: 1 };
      GOAL.y = GOAL_Y_BY_LEVEL[lvl] || GOAL_Y_BY_LEVEL[0];
      spiderlings = def.hasShelob ? Array.from({length:5},()=>({x:W*0.5+Math.random()*200-100, y:-80+Math.random()*40, r:5, angle:Math.random()*Math.PI*2, speed:2.5+Math.random()})) : [];
      blessingPickup = (lvl === 2) ? {x: WORLD_W*0.5, y: H*0.4, r: 16, pulse: 0, collected: false} : null;
      blessingActive = 0;
      hornTimer = 20 + Math.random()*5;
      hornActive = 0;
      ynapassTimer = 0;
      seenEnemyTypes = new Set();
      enemyIntroTimer = 0; enemyIntroName = '';
      flavourIdx = -1; flavourAlpha = 0;
      hitFlashLevel = lvl;
      whisperText = ''; whisperTimer = 0; whisperCooldown = 0;
      ambientParticles = []; ambientSpawnTimer = 0;
      comboTimer = 0; comboMult = 1; comboFlash = 0;
      ringPullTimer = 8 + Math.random()*8; ringPullActive = 0;
      state = 'playing';
      startLevelDrone(lvl);
    }

    function makeGollum() {
      return {
        x: W + 40, y: H*0.58,
        r: 9, speed: 2.4,
        wanderAngle: Math.PI, wanderTimer: 0,
        phase: 'lurk', // 'lurk' | 'dart' | 'jump' | 'fixate' | 'lunge'
        dartTimer: 0, dartCD: 5 + Math.random()*4,
        capePhase: 0,
        jumpCD: 5 + Math.random()*3,
        jumpTimer: 0, jumpDuration: 0, jumpGroundY: 0, jumpPeakY: 0, jumpStartX: 0,
        jumpAttemptsLeft: 0,
        whisperCD: 8 + Math.random()*6, // precious whisper cooldown
        fixateTimer: 0,                 // holds still, stares
        lungeCD: 20 + Math.random()*10, // rare goal lunge
      };
    }

    function makeBalrog() {
      return {
        x: -400, y: H*0.6, r: 38,
        firePhase: 0, active: false,
        whipTimer: 0, activationShown: false,
      };
    }

    function makeShelob() {
      return {
        x: W*0.5, y: -80, r: 35,
        firePhase: 0, phase: 'lurk',
        dropTimer: 4 + Math.random()*3,
        returnSpeed: 3.5,
      };
    }

    function spawnWraith(def, initIdx, initTotal) {
      let x, y;
      if (initIdx !== undefined) {
        // Initial placement: distribute evenly across the world
        // Last third of wraiths spawn near the goal end
        const section = initIdx / initTotal;
        if (section >= 0.6) {
          // Near goal: right quarter of world
          x = WORLD_W * 0.75 + Math.random() * WORLD_W * 0.22;
        } else if (section >= 0.3) {
          // Middle of world
          x = WORLD_W * 0.35 + Math.random() * WORLD_W * 0.35;
        } else {
          // Near start but not on top of Frodo
          x = 200 + Math.random() * (WORLD_W * 0.3);
        }
        y = H * 0.25 + Math.random() * (H * 0.65); // adjusted below for orcs
      } else {
        // Dynamic spawn: near Frodo
        const baseX = frodo ? frodo.x : W/2;
        const edge = Math.floor(Math.random()*3);
        if (edge===0) { x=Math.max(40,Math.min(WORLD_W-40,baseX+(Math.random()-0.5)*700)); y=-35; }
        else if (edge===1) { x=Math.max(40,Math.min(WORLD_W-40,baseX+(Math.random()-0.5)*700)); y=H+35; }
        else { x=Math.random()<0.5 ? baseX-450-Math.random()*100 : baseX+450+Math.random()*100; x=Math.max(-35,Math.min(WORLD_W+35,x)); y=H*0.35+Math.random()*H*0.5; }
      }
      const spd = def.wraithSpeed * diffMult() * (0.9 + Math.random()*0.3);
      // Max 7 Nazgûl on screen (lore-accurate). Beyond that: orcs.
      // Fell Beast: rare variant in L2/L3 replacing one Nazgûl slot.
      // Nazgûl (max 7) or orc. Fell Beast form is determined at draw-time by Y position.
      const nazgulCount  = wraiths.filter(e=>e.type==='wraith').length;
      const trollCount   = wraiths.filter(e=>e.type==='troll').length;
      const wightCount   = wraiths.filter(e=>e.type==='wight').length;
      const urukCount    = wraiths.filter(e=>e.type==='uruk').length;
      const orcCount     = wraiths.filter(e=>e.type==='orc').length;
      const scaledMaxSW  = Math.round(def.maxWraiths * areaScale);

      let eType = 'wraith';
      if (def === LEVEL_DEFS[1] && trollCount < 2 && Math.random() < 0.35) {
        eType = 'troll';
      } else if ((def === LEVEL_DEFS[6] || def === LEVEL_DEFS[7]) && wightCount < 5 && nazgulCount >= 4) {
        eType = 'wight';
      } else if ((def === LEVEL_DEFS[4] || def === LEVEL_DEFS[5]) && orcCount >= 3 && urukCount < Math.floor(scaledMaxSW * 0.4)) {
        eType = 'uruk';
      } else {
        eType = nazgulCount < 7 ? 'wraith' : 'orc';
      }

      const wr = eType==='troll' ? 22 : eType==='wight' ? 10 : eType==='uruk' ? 13 : eType==='orc' ? 10 : 14;
      const ws = eType==='troll' ? spd * 0.65 : eType==='wight' ? spd * 0.9 : eType==='uruk' ? spd * 1.2 : eType==='orc' ? spd * 1.15 : spd;
      if (eType==='orc' || eType==='troll' || eType==='uruk') y = Math.max(SKY_Y, Math.min(H-wr*2, y));
      wraiths.push({x,y,r:wr,wanderAngle:Math.random()*Math.PI*2,wanderTimer:0,
                    speed:ws,capePhase:Math.random()*Math.PI*2,type:eType,sense:0});
    }

    // Goal Y varies by level: L1=ground-ish, L2=mid-high, L3=near-top (climb the mountain)
    // Sky/ground boundary — road top edge is at H*0.44, mountains at H*0.5
    // Use H*0.46 so Fell Beast appears as soon as Nazgûl clears the road
    const SKY_Y = H * 0.46;

    const GOAL_Y_BY_LEVEL = [
      Math.round(H * 0.62), // 1: Rivendell — valley floor
      Math.round(H * 0.70), // 2: Moria bridge — ground level (no sky)
      Math.round(H * 0.55), // 3: Lothlórien — mid height (in the trees)
      Math.round(H * 0.30), // 4: Emyn Muil — elevated cliff
      Math.round(H * 0.48), // 5: Black Gate — road level
      Math.round(H * 0.55), // 6: Shelob's Lair — ground (darkness)
      Math.round(H * 0.40), // 7: Minas Morgul — mid sky, eerie
      Math.round(H * 0.35), // 8: Pelennor — mid-high
      Math.round(H * 0.12), // 9: Mount Doom — summit
    ];
    const GOAL = { x: WORLD_W - 120, y: GOAL_Y_BY_LEVEL[0], r: 22 };
    // Scale enemy counts with canvas area (square root — linear spread, not quadratic)
    const REF_AREA = 960 * 580;
    const areaScale = Math.min(2.5, Math.max(0.5, Math.sqrt(W * H / REF_AREA)));
    const progress = () => {
      if (!frodo) return 0;
      return Math.max(0, Math.min(1, (frodo.x - 80) / (GOAL.x - 80)));
    };
    // Camera: follows Frodo horizontally, clamped to world bounds
    let cameraX = 0;
    function updateCamera() {
      if (!frodo) return;
      cameraX = Math.max(0, Math.min(WORLD_W - W, frodo.x - W * 0.4));
    }
    const frodoSpd = (def) => {
      const mirrorSlow = (currentLevel===2 && goalUnlocked && Math.hypot(frodo?frodo.x-GOAL.x:9999,frodo?frodo.y-GOAL.y:9999)<90) ? 0.6 : 1;
      return (3.9 - progress()*2.2) * (currentLevel===8 ? 0.82 : 1) * mirrorSlow;
    };
    const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    const lerp  = (a,b,t) => a+(b-a)*t;

    let lastTs = 0;
    function loop(ts) {
      if (!alive) return;
      const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;
      const t = ts/1000;
      const def = LEVEL_DEFS[currentLevel] || LEVEL_DEFS[0];

      // ── UPDATE ──────────────────────────────────────────────────────
      if (state === 'playing' && !pauseCtrl.isPaused()) {
        timers.elapsed += dt;
        // Score: points per second with combo multiplier
        comboTimer += dt;
        if (comboTimer >= 10 && comboMult < 4) {
          comboMult = Math.min(4, comboMult + 1);
          comboTimer = 0; comboFlash = 1.2;
          particles.push(...Array.from({length:10},(_,i)=>{
            const a=(i/10)*Math.PI*2;
            return {x:frodo.x,y:frodo.y,vx:Math.cos(a)*2,vy:Math.sin(a)*2-1,
              life:0.6,size:3,color:'#ffd040'};
          }));
        }
        if (comboFlash > 0) comboFlash -= dt * 2;
        score += dt * (1 + currentLevel * 0.5) * round * comboMult;
        // Ring corruption pull (Books II+, progress > 0.35)
        if (currentLevel >= 3 && progress() > 0.35) {
          ringPullTimer -= dt;
          if (ringPullActive > 0) {
            ringPullActive -= dt;
            // Pull toward Eye (top-center of screen)
            const pullStrength = 0.55 * (1 - ringPullActive / 0.6);
            frodo.x = Math.max(frodo.r, Math.min(WORLD_W-frodo.r, frodo.x + Math.cos(ringPullAngle)*pullStrength*60*dt));
            frodo.y = Math.max(frodo.r, Math.min(H-frodo.r, frodo.y + Math.sin(ringPullAngle)*pullStrength*60*dt));
            blindFlash = Math.min(0.25, blindFlash + dt*0.3);
          }
          if (ringPullTimer <= 0 && ringPullActive <= 0) {
            ringPullActive = 0.6;
            ringPullAngle = Math.atan2(0 - frodo.y, (W/2+cameraX) - frodo.x); // toward Eye
            ringPullTimer = 12 + Math.random()*10;
            playTone(180,'sine',0.06,0.5);
          }
        }
        const spd = frodoSpd(def);
        let dx=0,dy=0;
        if (keys['ArrowLeft']||keys['a']||keys['A']) dx-=1;
        if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
        if (keys['ArrowUp']||keys['w']||keys['W']) dy-=1;
        if (keys['ArrowDown']||keys['s']||keys['S']) dy+=1;
        if (dx&&dy){dx*=0.707;dy*=0.707;}
        // Joystick input (touch, left zone)
        if (joystick.active && !dash) {
          dx = joystick.dx; dy = joystick.dy;
        }
        // Pointer follow: steer toward finger/cursor (overrides keyboard, right zone only)
        if (pointerTarget && !joystick.active && !dash) {
          const pdx = pointerTarget.x - frodo.x;
          const pdy = pointerTarget.y - frodo.y;
          const pd  = Math.hypot(pdx, pdy);
          if (pd > 6) { dx = pdx/pd; dy = pdy/pd; } else { dx=0; dy=0; }
        }
        frodo.x = Math.max(frodo.r, Math.min(WORLD_W-frodo.r, frodo.x+dx*spd*60*dt));
        frodo.y = Math.max(frodo.r, Math.min(H-frodo.r, frodo.y+dy*spd*60*dt));
        updateCamera();
        frodo.ringAngle += dt*(1.2+progress()*2.5);

        // Level clear
        if (Math.hypot(frodo.x-GOAL.x, frodo.y-GOAL.y) < frodo.r + GOAL.r) {
          if (currentLevel < 8) { state='levelwin'; levelTransTimer=0; sndLevelWin(); sessionCheckpoint=Math.max(sessionCheckpoint,currentLevel+1); }
          else { state='win'; sndLevelWin(); updateProgress(); }
        }

        if (frodo.invincible){frodo.invTimer-=dt;if(frodo.invTimer<=0)frodo.invincible=false;}
        frodo.hitFlash = Math.max(0,frodo.hitFlash-dt*4);
        blindFlash = Math.max(0, blindFlash-dt*1.2);

        // Active dash: override movement with burst velocity
        if (dash) {
          dash.timer -= dt;
          frodo.x = Math.max(frodo.r, Math.min(WORLD_W-frodo.r, frodo.x + dash.vx*60*dt));
          frodo.y = Math.max(frodo.r, Math.min(H-frodo.r, frodo.y + dash.vy*60*dt));
          // Blue trail particles
          if (Math.random()<0.4) particles.push({x:frodo.x,y:frodo.y,vx:(Math.random()-0.5),vy:(Math.random()-0.5),
            life:0.18,size:4+Math.random()*3,color:'#60a0ff'});
          if (dash.timer <= 0) dash = null;
        }

        // Dash refill pickup
        if (dashRefill) {
          dashRefill.pulse += dt*2.5;
          if (Math.hypot(frodo.x-dashRefill.x, frodo.y-dashRefill.y) < frodo.r+dashRefill.r) {
            dashCharges = Math.min(maxDash(), dashCharges+1);
            for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,s=2+Math.random()*2;
              particles.push({x:dashRefill.x,y:dashRefill.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,
                              life:0.5,size:3+Math.random()*3,color:'#60a0ff'});}
            dashRefill = null;
          }
        }

        // Ring corruption blind flash (level 3 only)
        if (def.hasBlindFlash && progress() > 0.3 && Math.random()<0.006) {
          blindFlash = Math.min(0.9, blindFlash + 0.45 + progress()*0.2);
        }

        // Eye
        eye.timer+=dt;
        if (eye.phase==='idle'){
          eye.open=Math.max(0,eye.open-dt*1.5);
          if(eye.timer>=eye.idleDur){eye.phase='warning';eye.timer=0;}
        } else if (eye.phase==='warning'){
          eye.open=Math.min(0.25,eye.open+dt*0.4);
          if(eye.timer>=eye.warnDur){eye.phase='active';eye.timer=0;sndEyeOpen();}
        } else if (eye.phase==='active'){
          eye.open=Math.min(1,eye.open+dt*2.5);
          eye.px=lerp(eye.px,lerp(W*0.2,W*0.8,frodo.x/W),dt*2);
          eye.py=lerp(eye.py,65+(frodo.y/H-0.5)*30,dt*2);
          if(eye.timer>=eye.activeDur){eye.phase='closing';eye.timer=0;}
        } else {
          eye.open=Math.max(0,eye.open-dt*1.2);
          if(eye.timer>=eye.closeDur){
            eye.phase='idle';eye.timer=0;
            eye.idleDur=Math.max(6,(def.eyeIdleBase-progress()*8+3+Math.random()*6)/diffMult());
          }
        }

        const eyeActive = eye.phase==='active';
        const enemySpeedMult = (blessingActive > 0 ? 0.8 : 1) * (hornActive > 0 ? 0.5 : 1);
        if (ynapassTimer > 0) ynapassTimer -= dt;
        if (enemyIntroTimer > 0) enemyIntroTimer -= dt;
        if (whisperTimer > 0) whisperTimer -= dt;
        if (whisperCooldown > 0) whisperCooldown -= dt;
        // Contextual companion whispers
        if (whisperCooldown <= 0) {
          const nearestDist = wraiths.length ? Math.min(...wraiths.map(w=>Math.hypot(frodo.x-w.x,frodo.y-w.y))) : 9999;
          const eyeNow = eye && eye.phase === 'active';
          let wt = '';
          if (frodo.lives === 1) wt = currentLevel<3?'Hold on, Mr. Frodo!':'Almost out of strength...';
          else if (eyeNow && Math.random()<0.4) wt = currentLevel<3?'Don\'t put it on!':'The Eye sees you!';
          else if (nearestDist < 80 && Math.random()<0.35) wt = currentLevel<3?'Keep to the shadows!':'Run, Mr. Frodo, run!';
          else if (progress() > 0.85 && Math.random()<0.3) wt = currentLevel===8?'Throw it in the fire!':'Almost there...';
          else if (progress() > 0.45 && Math.random()<0.12) wt = ['The road goes ever on...','Keep moving.','Trust in the Fellowship.','One step at a time.'][Math.floor(Math.random()*4)];
          if (wt) { whisperText = wt; whisperTimer = 3.2; whisperCooldown = 12 + Math.random()*8; }
        }
        // Enemy introduction detection
        wraiths.forEach(w => {
          if (!seenEnemyTypes.has(w.type) && (w.type==='troll'||w.type==='wight'||w.type==='uruk')) {
            seenEnemyTypes.add(w.type);
            enemyIntroTimer = 2.2;
            enemyIntroName = w.type==='troll'?'Cave Troll':w.type==='wight'?'Morgul Wight':'Uruk-hai';
          }
        });
        // Flavour text crossfade
        const newFi = Math.min(def.flavour.length-1, Math.floor(progress()*def.flavour.length));
        if (newFi !== flavourIdx) { flavourIdx = newFi; flavourAlpha = 0; }
        if (flavourAlpha < 1) flavourAlpha = Math.min(1, flavourAlpha + dt * 1.5);

        // Wraiths
        const SENSE_RADIUS = Math.round(120 * areaScale); // scales with canvas size
        let nearMiss = false;
        wraiths.forEach(w=>{
          // Cave Troll: slow stomp, ground-bound
          if (w.type === 'troll') {
            w.capePhase += dt;
            const d2f = dist(frodo, w);
            w.sense = Math.max(0, Math.min(1, 1 - d2f / (SENSE_RADIUS * 1.5)));
            const tSpd = w.speed * enemySpeedMult;
            if (eyeActive || d2f < SENSE_RADIUS * 1.5) {
              const a = Math.atan2(frodo.y - w.y, frodo.x - w.x);
              w.x += Math.cos(a) * tSpd * 60 * dt;
              w.y += Math.sin(a) * tSpd * 60 * dt;
            } else {
              w.wanderTimer -= dt;
              if (w.wanderTimer <= 0) { w.wanderAngle = Math.random() * Math.PI * 2; w.wanderTimer = 3 + Math.random() * 3; }
              w.x += Math.cos(w.wanderAngle) * tSpd * 0.3 * 60 * dt;
              w.y += Math.sin(w.wanderAngle) * tSpd * 0.3 * 60 * dt;
            }
            w.y = Math.max(SKY_Y, Math.min(H - w.r * 2, w.y));
            if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
              w.wanderAngle=Math.atan2(H*0.65-w.y,(frodo?frodo.x:W/2)-w.x)+(Math.random()-0.5)*0.6; w.wanderTimer=2;
            }
            if (!frodo.invincible && dist(frodo, w) < frodo.r + w.r) hitFrodo();
            return;
          }
          // Morgul Wight: always drifts toward Frodo
          if (w.type === 'wight') {
            w.capePhase += dt * 1.5;
            const d2f = dist(frodo, w);
            w.sense = Math.max(0, Math.min(1, 1 - d2f / SENSE_RADIUS));
            const burstMult = d2f < 40 ? 2.5 : 1.0;
            const a = Math.atan2(frodo.y - w.y, frodo.x - w.x);
            const wSpd = w.speed * enemySpeedMult;
            w.x += Math.cos(a) * wSpd * burstMult * 60 * dt;
            w.y += Math.sin(a) * wSpd * burstMult * 60 * dt;
            if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
              w.wanderAngle=Math.atan2(H*0.55-w.y,(frodo?frodo.x:W/2)-w.x)+(Math.random()-0.5)*0.6; w.wanderTimer=2;
            }
            if (!frodo.invincible && d2f < frodo.r + w.r) hitFrodo();
            return;
          }
          // Uruk-hai: coordinated pair hunt
          if (w.type === 'uruk') {
            w.capePhase += dt * 2;
            const d2f = dist(frodo, w);
            w.sense = Math.max(0, Math.min(1, 1 - d2f / SENSE_RADIUS));
            const partner = wraiths.find(o => o !== w && o.type === 'uruk' && dist(o, w) < 120);
            let targetAngle = Math.atan2(frodo.y - w.y, frodo.x - w.x);
            if (partner) {
              const side = w.x < partner.x ? -1 : 1;
              targetAngle += side * Math.PI * 0.25;
            }
            const huntMult = eyeActive ? 1.3 : 0.85 + w.sense * 0.5;
            const uSpd = w.speed * enemySpeedMult;
            w.x += Math.cos(targetAngle) * uSpd * huntMult * 60 * dt;
            w.y += Math.sin(targetAngle) * uSpd * huntMult * 60 * dt;
            w.y = Math.max(SKY_Y, Math.min(H - w.r * 2, w.y));
            if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
              w.wanderAngle=Math.atan2(H*0.65-w.y,(frodo?frodo.x:W/2)-w.x)+(Math.random()-0.5)*0.6; w.wanderTimer=2;
            }
            if (!frodo.invincible && d2f < frodo.r + w.r) hitFrodo();
            return;
          }

          w.capePhase+=dt*1.8; w.wanderTimer-=dt;
          const d2frodo = dist(frodo, w);
          const sensing = d2frodo < SENSE_RADIUS;
          // sense intensity 0->1 as they close in
          w.sense = Math.max(0, Math.min(1, 1 - d2frodo / SENSE_RADIUS));

          // Orcs stay on the ground (lower 60% of screen)
          const orcMinY = w.type==='orc' ? SKY_Y : 0;
          const targetY = w.type==='orc' ? Math.max(frodo.y, SKY_Y) : frodo.y;
          // Nazgul on Fell Beast (sky) get +10% speed
          const skyBoost = (w.type==='wraith' && w.y < SKY_Y && !def.hasBalrog && !def.hasShelob) ? 1.1 : 1.0;
          const eSpd = w.speed * enemySpeedMult;

          if(eyeActive || sensing){
            // Eye active or sensing: hunt
            const a=Math.atan2(targetY-w.y,frodo.x-w.x);
            const huntMult = eyeActive ? 1.35 : 0.9 + w.sense * 0.5;
            const closePenalty = d2frodo < 120 ? Math.max(0.5, d2frodo/120) : 1;
            w.x+=Math.cos(a)*eSpd*huntMult*closePenalty*skyBoost*60*dt;
            w.y+=Math.sin(a)*eSpd*huntMult*closePenalty*skyBoost*60*dt;
          } else if (w.type==='orc') {
            // Orcs: free wander with loose bias, occasional random direction change
            if(w.wanderTimer<=0){
              const toFrodo=Math.atan2(frodo.y-w.y,frodo.x-w.x);
              // 30% chance to head vaguely toward Frodo, 70% fully random
              w.wanderAngle=Math.random()<0.3
                ? toFrodo+(Math.random()-0.5)*Math.PI*0.8
                : Math.random()*Math.PI*2;
              w.wanderTimer=2+Math.random()*4;
            }
            w.x+=Math.cos(w.wanderAngle)*eSpd*0.7*60*dt;
            w.y+=Math.sin(w.wanderAngle)*eSpd*0.7*60*dt;
          } else {
            // Nazgul: loosely wander toward Frodo
            if(w.wanderTimer<=0){
              w.wanderAngle=Math.atan2(targetY-w.y,frodo.x-w.x)+(Math.random()-0.5)*Math.PI*1.6;
              w.wanderTimer=1.2+Math.random()*2;
            }
            w.x+=Math.cos(w.wanderAngle)*eSpd*0.85*skyBoost*60*dt;
            w.y+=Math.sin(w.wanderAngle)*eSpd*0.85*skyBoost*60*dt;
          }
          // Clamp orc Y to ground zone
          if(w.type==='orc') w.y = Math.max(orcMinY, Math.min(H-w.r, w.y));

          if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
            const tx=frodo?frodo.x:W/2;
            const ty=w.type==='orc'?H*0.65:H*0.55;
            w.wanderAngle=Math.atan2(ty-w.y,tx-w.x)+(Math.random()-0.5)*0.6;
            w.wanderTimer=2;
          }
          const d2frodo2 = dist(frodo, w);
          if(!frodo.invincible&&d2frodo2<frodo.r+w.r){
            hitFrodo();
          } else if(!frodo.invincible && d2frodo2 < frodo.r+w.r+22 && d2frodo2 >= frodo.r+w.r) {
            nearMiss = true;
          }
        });
        if(nearMiss && shake.dur <= 0){
          shake = {x:0,y:0,dur:0.18,intensity:3};
          // Brief Ring hum on near-miss
          playTone(740,'sine',0.025,0.15,true,0);
        }

        // Gollum
        if (gollum) {
          gollum.capePhase += dt*3;
          gollum.dartTimer -= dt;
          gollum.jumpCD -= dt;
          gollum.whisperCD -= dt;
          gollum.lungeCD -= dt;
          const frodoInSky = frodo.y < SKY_Y;
          // Gollum is always slightly slower than Frodo (never catches him by speed alone)
          const gollumTopSpeed = frodoSpd(def) * 0.82;
          // Precious whisper
          if (gollum.whisperCD <= 0) {
            gollum.whisperCD = 8 + Math.random()*8;
            const lines = ['My precious...','Yess, precious, yess...','We wants it!','Sneaky little hobbitses...','Gollum! Gollum!','It\'s ours, precious, ours!'];
            whisperText = lines[Math.floor(Math.random()*lines.length)];
            whisperTimer = 2.5; whisperCooldown = 5;
            playTone(280,'sawtooth',0.03,0.3);
          }
          // Rare lunge at goal when progress > 0.7
          if (gollum.lungeCD <= 0 && progress() > 0.7 && goalUnlocked) {
            gollum.lungeCD = 25 + Math.random()*15;
            gollum.phase = 'lunge';
            gollum.dartTimer = 1.2;
          }
          if (gollum.phase === 'lunge') {
            // Sprint toward goal
            const a = Math.atan2(GOAL.y - gollum.y, GOAL.x - gollum.x);
            gollum.x += Math.cos(a)*gollumTopSpeed*2.2*60*dt;
            gollum.y += Math.sin(a)*gollumTopSpeed*2.2*60*dt;
            // If Gollum reaches goal zone: block briefly, particles
            if (Math.hypot(gollum.x-GOAL.x, gollum.y-GOAL.y) < 40) {
              gollum.phase = 'lurk';
              for(let i=0;i<10;i++){const a2=(i/10)*Math.PI*2;
                particles.push({x:GOAL.x,y:GOAL.y,vx:Math.cos(a2)*2,vy:Math.sin(a2)*2,
                  life:0.5,size:4,color:'#c8a030'});}
              whisperText = 'Mine! MINE!';
              whisperTimer = 2.0; whisperCooldown = 4;
            }
            if (gollum.dartTimer <= 0) gollum.phase = 'lurk';
            gollum.y = Math.max(SKY_Y, Math.min(H, gollum.y));
            if (!frodo.invincible && dist(frodo, gollum) < frodo.r+gollum.r) hitFrodo();
          }

          if (gollum.phase === 'jump') {
            // Parabolic leap from SKY_Y boundary
            gollum.jumpTimer += dt;
            const frac = Math.min(1, gollum.jumpTimer / gollum.jumpDuration);
            // Purely vertical — X stays fixed at launch position
            gollum.y = gollum.jumpGroundY - Math.sin(frac * Math.PI) * (gollum.jumpGroundY - gollum.jumpPeakY);
            if (frac >= 1) {
              // Land back at boundary
              gollum.y = SKY_Y;
              gollum.jumpAttemptsLeft--;
              if (gollum.jumpAttemptsLeft > 0) {
                // Another leap after a short pause
                gollum.jumpCD = 1.2 + Math.random()*0.8;
                gollum.phase = 'lurk';
              } else {
                // Done trying — back to free wandering
                gollum.phase = 'lurk';
                gollum.jumpCD = 8 + Math.random()*6; // long cooldown before noticing Frodo in sky again
              }
            }
          } else if (gollum.phase === 'lurk') {
            // Trigger a burst of leaps when Frodo is in sky and cooldown elapsed
            if (frodoInSky && gollum.jumpCD <= 0 && gollum.jumpAttemptsLeft === 0) {
              gollum.jumpAttemptsLeft = 2 + Math.floor(Math.random()*2); // 2-3 attempts
            }
            // If attempts remain and cooldown is up, launch
            if (gollum.jumpAttemptsLeft > 0 && gollum.jumpCD <= 0) {
              // Climb vertically to SKY_Y from current X (no horizontal tracking)
              if (gollum.y > SKY_Y + gollum.r*2) {
                gollum.y = Math.max(SKY_Y, gollum.y - gollumTopSpeed*2*60*dt);
              } else {
                // At boundary — leap
                gollum.y = SKY_Y;
                gollum.phase = 'jump';
                gollum.jumpTimer = 0;
                gollum.jumpDuration = 0.6 + Math.random()*0.25;
                gollum.jumpGroundY = SKY_Y;
                gollum.jumpStartX = gollum.x;
                gollum.jumpPeakY = Math.max(20, frodo.y - gollum.r);
              }
            } else {
              // Free wandering — Gollum does his own thing
              gollum.wanderTimer -= dt;
              if (gollum.wanderTimer <= 0) {
                if (frodoInSky) {
                  // Frodo's in the sky — Gollum wanders freely, no bias
                  gollum.wanderAngle = Math.random() * Math.PI * 2;
                } else {
                  // Frodo on ground — loose bias toward him
                  const toFrodo = Math.atan2(frodo.y - gollum.y, frodo.x - gollum.x);
                  gollum.wanderAngle = toFrodo + (Math.random()-0.5) * Math.PI * 1.4;
                }
                gollum.wanderTimer = 2 + Math.random()*3;
              }
              gollum.x += Math.cos(gollum.wanderAngle)*gollumTopSpeed*0.55*60*dt;
              gollum.y += Math.sin(gollum.wanderAngle)*gollumTopSpeed*0.55*60*dt;
              gollum.x = Math.max(-20, Math.min(WORLD_W+20, gollum.x));
              gollum.y = Math.max(SKY_Y, Math.min(H, gollum.y));
              if (gollum.dartTimer <= 0 && !frodoInSky) {
                gollum.phase='dart';
                gollum.dartTimer=0.5 + Math.random()*0.4; // short burst
              }
            }
          } else if (gollum.phase === 'dart') { // dart — Gollum's pounce: faster than Frodo's base, short duration
            const a = Math.atan2(frodo.y-gollum.y, frodo.x-gollum.x);
            // Dart speed: ~1.8× Frodo's current speed (comparable to Frodo's dash burst)
            const dartSpd = frodoSpd(def) * 1.8;
            gollum.x += Math.cos(a)*dartSpd*60*dt;
            gollum.y += Math.sin(a)*dartSpd*60*dt;
            gollum.y = Math.max(SKY_Y, Math.min(H, gollum.y));
            if (gollum.dartTimer <= 0) {
              gollum.phase='lurk';
              gollum.dartCD = 5 + Math.random()*5; // cooldown before next pounce
              gollum.dartTimer = gollum.dartCD;
            }
          }
          if(!frodo.invincible&&dist(frodo,gollum)<frodo.r+gollum.r){
            hitFrodo();
          }
        }

        // Balrog
        if (balrog) {
          balrog.firePhase += dt*2.5;
          if (!balrog.active && progress() > 0.52) {
            balrog.active = true;
            sndBalrog();
            ynapassTimer = 1.8;
            shake = {x:0,y:0,dur:1.8,intensity:14};
            for(let i=0;i<28;i++){const a=(i/28)*Math.PI*2,s=3+Math.random()*4;
              particles.push({x:balrog.x,y:balrog.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
                              life:0.8+Math.random()*0.5,size:5+Math.random()*6,color:Math.random()>0.4?'#ff6600':'#ff2200'});}
          }
          if (balrog.active) {
            const bspd = (2.0 + progress()*1.2) * diffMult() * 0.55;
            const ba = Math.atan2(frodo.y - balrog.y, frodo.x - balrog.x);
            balrog.x += Math.cos(ba)*bspd*60*dt;
            balrog.y += Math.sin(ba)*bspd*60*dt;
            balrog.y = Math.max(H*0.3, Math.min(H*0.85, balrog.y));
            // Fire trail
            if (Math.random()<0.5) {
              particles.push({x:balrog.x+(Math.random()-0.5)*30,y:balrog.y+(Math.random()-0.5)*20,
                vx:(Math.random()-0.5)*1.5,vy:-1-Math.random()*2,
                life:0.3+Math.random()*0.3,size:6+Math.random()*8,color:Math.random()>0.3?'#ff4400':'#ff8800'});
            }
            if (!frodo.invincible && Math.hypot(frodo.x-balrog.x,frodo.y-balrog.y) < frodo.r+balrog.r) {
              if (!GOD_MODE) {
                frodo.lives = Math.max(0, frodo.lives - 2);
                if (frodo.lives <= 0) { lastScore=score;lastRound=round;lastLevel=currentLevel; state='gameover'; }
              }
              frodo.invincible=true; frodo.invTimer=3.5; frodo.hitFlash=1;
              shake={x:0,y:0,dur:0.8,intensity:18};
              // Reset balrog 400px behind Frodo
              const backA = Math.atan2(frodo.y-balrog.y,frodo.x-balrog.x)+Math.PI;
              balrog.x = frodo.x + Math.cos(backA)*400;
              balrog.y = frodo.y;
              for(let i=0;i<18;i++){const a=(i/18)*Math.PI*2,s=2+Math.random()*3;
                particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
                  life:0.6+Math.random()*0.4,size:4+Math.random()*4,color:Math.random()>0.5?'#ff4400':'#903010'});}
            }
          }
        }

        // Shelob
        if (shelob) {
          shelob.firePhase += dt*3;
          shelob.dropTimer -= dt;
          if (shelob.phase === 'lurk') {
            // Track Frodo's X when nearly aligned
            const targetX = frodo ? frodo.x : W;
            const sdx = targetX - shelob.x;
            shelob.x += Math.sign(sdx)*Math.min(Math.abs(sdx), 2.5*60*dt);
            shelob.y = Math.max(-80, shelob.y - shelob.returnSpeed*60*dt);
            // Telegraph: when dropTimer < 1.2s, Shelob aligns faster and shadow pulses
            if (shelob.dropTimer < 1.2) {
              shelob.x += Math.sign(sdx)*Math.min(Math.abs(sdx), 4.5*60*dt);
            }
            if (shelob.dropTimer <= 0) {
              shelob.phase = 'drop';
              shelob.dropTimer = 5 + Math.random()*3;
            }
          } else if (shelob.phase === 'drop') {
            shelob.y += 5.5*60*dt;
            if (!frodo.invincible && Math.hypot(frodo.x-shelob.x,frodo.y-shelob.y) < frodo.r+shelob.r) {
              hitFrodo();
              shelob.phase = 'return';
            }
            if (shelob.y > H*0.75) shelob.phase = 'return';
          } else { // return
            shelob.y -= shelob.returnSpeed*60*dt;
            if (shelob.y <= -60) { shelob.y=-60; shelob.phase='lurk'; }
          }
        }

        // Spiderlings (Shelob's lair)
        if (spiderlings.length > 0) {
          spiderlings.forEach(sp => {
            sp.angle += dt * (2 + sp.speed * 0.3);
            const orbitR = 70 + Math.sin(sp.angle * 2) * 20;
            const targetX = (shelob ? shelob.x : frodo.x) + Math.cos(sp.angle) * orbitR;
            const targetY = (shelob ? Math.max(0, shelob.y) : frodo.y) + Math.sin(sp.angle) * orbitR * 0.4;
            sp.x += (targetX - sp.x) * dt * 4;
            sp.y += (targetY - sp.y) * dt * 4;
            if (shelob && shelob.phase === 'drop') {
              const sa = Math.atan2(frodo.y - sp.y, frodo.x - sp.x);
              sp.x += Math.cos(sa) * sp.speed * 30 * dt;
              sp.y += Math.sin(sa) * sp.speed * 30 * dt;
            }
          });
        }

        // Pelennor Eye distraction mechanic
        if (currentLevel === 7) {
          eyeDistractTimer -= dt;
          if (eyeEagleTimer > 0) {
            eyeEagleTimer -= dt;
            eagleParticles.forEach(ep=>{ ep.x -= 3.5*60*dt; ep.life-=dt; });
            eagleParticles = eagleParticles.filter(ep=>ep.life>0);
          }
          if (!eyeDistracted && eyeDistractTimer <= 0) {
            eyeDistracted = true; eyeDistractTimer = 8;
            eyeEagleTimer = 6;
            eagleParticles = Array.from({length:3},(_, i)=>({x:W+60+i*80, y:H*0.25+i*30, life:6}));
          } else if (eyeDistracted && eyeDistractTimer <= 0) {
            eyeDistracted = false; eyeDistractTimer = 15 + Math.random()*8;
          }
          if (eyeDistracted) { eye.idleDur=15; eye.activeDur=2; }
          else { eye.idleDur=Math.max(6,(LEVEL_DEFS[7].eyeIdleBase+3+Math.random()*6)/diffMult()); eye.activeDur=LEVEL_DEFS[7].eyeActiveDur; }
        }

        // Horn of Gondor (Pelennor)
        if (currentLevel === 7) {
          hornTimer -= dt;
          if (hornActive > 0) hornActive -= dt;
          if (hornTimer <= 0 && hornActive <= 0) {
            hornActive = 3;
            sndHorn();
            hornTimer = 20 + Math.random() * 10;
          }
        }

        // Lothlórien -- Eye glows silver-green instead of red
        // (handled in drawEye1 via def flag; here just soften its red tinge)
        // Minas Morgul -- Eye never fully closes
        if (currentLevel === 6 && eye.open < 0.22) eye.open = 0.22;

        // Spawn more wraiths
        timers.spawnCD-=dt;
        const scaledInit2 = Math.round(def.initWraiths * areaScale);
        const scaledMax2  = Math.round(def.maxWraiths  * areaScale);
        const want = scaledInit2 + Math.floor(progress()*(scaledMax2-scaledInit2));
        if(wraiths.length<want&&timers.spawnCD<=0){spawnWraith(def);timers.spawnCD=def.spawnMin+Math.random()*2.5;}

        // Key pickup (unlocks goal)
        if(keyPickup) {
          if(!keyPickup.spawned) {
            keyPickup.spawnTimer -= dt;
            if(keyPickup.spawnTimer <= 0) keyPickup.spawned = true;
          } else {
            keyPickup.pulse += dt*2.8;
            if(Math.hypot(frodo.x-keyPickup.x, frodo.y-keyPickup.y) < frodo.r+keyPickup.r) {
              goalUnlocked = true;
              sndKey();
              keyPickup = null;
              shake = {x:0,y:0,dur:0.3,intensity:5};
              // Golden unlock burst
              for(let i=0;i<18;i++){const a=(i/18)*Math.PI*2,s=2+Math.random()*3;
                particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
                                life:0.7+Math.random()*0.4,size:4+Math.random()*3,color:'#ffd030'});}
            }
          }
        }

        // Prevent reaching goal unless unlocked
        if(!goalUnlocked) {
          const d=Math.hypot(frodo.x-GOAL.x, frodo.y-GOAL.y);
          if(d < frodo.r + GOAL.r + 20) {
            // Push Frodo away from locked goal
            const a=Math.atan2(frodo.y-GOAL.y, frodo.x-GOAL.x);
            frodo.x += Math.cos(a)*3; frodo.y += Math.sin(a)*3;
          }
        }

        // Life pickup
        timers.pickupCD-=dt;
        if(!lifePickup && timers.pickupCD<=0 && frodo.lives<maxLives()) {
          // Spawn away from goal and away from start
          // Spawn pickup somewhere ahead of Frodo in world space
          const spawnMin2 = frodo ? frodo.x + 150 : 300;
          const spawnMax2 = Math.min(WORLD_W - 300, (frodo ? frodo.x : 0) + 700);
          const px = spawnMin2 + Math.random() * Math.max(50, spawnMax2 - spawnMin2);
          const py = H*0.2 + Math.random()*(H*0.6);
          lifePickup = {x:px, y:py, r:12, pulse:0};
          timers.pickupCD = 20+Math.random()*10;
        }
        if(lifePickup) {
          lifePickup.pulse += dt*3;
          if(Math.hypot(frodo.x-lifePickup.x, frodo.y-lifePickup.y) < frodo.r+lifePickup.r) {
            frodo.lives = Math.min(maxLives(), frodo.lives+1);
            sndPickup();
            // Burst particles
            for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,s=2+Math.random()*2;
              particles.push({x:lifePickup.x,y:lifePickup.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,
                              life:0.6+Math.random()*0.3,size:3+Math.random()*3,color:'#d4a020'});}
            lifePickup = null;
          }
        }

        // Galadriel's blessing (Lothlorien)
        if (blessingPickup && !blessingPickup.collected) {
          blessingPickup.pulse += dt * 2;
          if (Math.hypot(frodo.x - blessingPickup.x, frodo.y - blessingPickup.y) < frodo.r + blessingPickup.r) {
            blessingPickup.collected = true;
            dashCharges = Math.min(maxDash(), dashCharges + 2);
            blessingActive = 8;
            for(let i=0;i<16;i++){const a=(i/16)*Math.PI*2,s=2+Math.random()*3;
              particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
                life:0.8+Math.random()*0.4,size:4+Math.random()*4,color:'#c0d8ff'});}
          }
        }
        if (blessingActive > 0) blessingActive -= dt;

        // Ambient particles (level atmosphere)
        ambientSpawnTimer -= dt;
        if (ambientSpawnTimer <= 0) {
          ambientSpawnTimer = currentLevel===0?0.25:currentLevel===2?0.35:currentLevel===7?0.2:currentLevel===8?0.15:0.45;
          const ax = frodo.x + (Math.random()-0.5)*W*1.2, ay = Math.random()*H;
          if (currentLevel===0) // Shire: pollen drifting rightward
            ambientParticles.push({x:ax,y:ay,vx:0.6+Math.random()*0.4,vy:-0.1+Math.random()*0.2,life:4+Math.random()*3,size:1.5+Math.random(),color:'rgba(220,210,120,0.55)',type:'pollen'});
          else if (currentLevel===1) // Moria: dust falling from ceiling
            ambientParticles.push({x:ax,y:0,vx:(Math.random()-0.5)*0.3,vy:0.4+Math.random()*0.6,life:3+Math.random()*2,size:1+Math.random()*1.5,color:'rgba(100,80,60,0.4)',type:'dust'});
          else if (currentLevel===2) // Lothl: silver petals
            ambientParticles.push({x:ax,y:0,vx:(Math.random()-0.5)*0.4,vy:0.3+Math.random()*0.5,life:5+Math.random()*3,size:2+Math.random()*1.5,color:`rgba(200,220,255,${0.4+Math.random()*0.25})`,type:'petal'});
          else if (currentLevel===7) // Pelennor: embers
            ambientParticles.push({x:ax,y:H*0.6+Math.random()*H*0.3,vx:(Math.random()-0.5)*0.8,vy:-(0.8+Math.random()*1.2),life:1.5+Math.random(),size:1.5+Math.random()*2,color:Math.random()<0.6?'rgba(255,120,0,0.6)':'rgba(200,80,0,0.5)',type:'ember'});
          else if (currentLevel===8) // Mount Doom: ash
            ambientParticles.push({x:ax,y:0,vx:(Math.random()-0.5)*0.6,vy:0.5+Math.random()*0.8,life:4+Math.random()*3,size:1+Math.random()*2,color:`rgba(60,50,45,${0.3+Math.random()*0.25})`,type:'ash'});
        }
        ambientParticles=ambientParticles.filter(p=>p.life>0);
        ambientParticles.forEach(p=>{p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;p.life-=dt;});

        // Shake
        if(shake.dur>0){shake.dur-=dt;shake.x=(Math.random()-0.5)*shake.intensity*2;shake.y=(Math.random()-0.5)*shake.intensity*2;}
        else{shake.x=shake.y=0;}

        // Particles
        particles=particles.filter(p=>p.life>0);
        particles.forEach(p=>{p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.vy+=0.08*dt*60;p.life-=dt;p.size=Math.max(0,p.size-dt*4);});
      }

      if (state === 'levelwin') {
        levelTransTimer += dt;
      }

      // ── DRAW ────────────────────────────────────────────────────────
      updateCamera(); // always sync before draw
      ctx.save();
      if(shake&&(shake.x||shake.y)) ctx.translate(shake.x,shake.y);

      // Background: drawn with parallax (handles its own cameraX offset)
      drawBgLevel(ctx,W,H,t,def,state==='playing'?progress():0,cameraX);

      if(state==='playing'||state==='levelwin'){
        // Apply camera transform for all world-space objects
        ctx.save();
        ctx.translate(-cameraX, 0);
        drawGoal(ctx,GOAL,def,t,progress(),80,H*0.62,goalUnlocked,currentLevel,H,eye?eye.open:0);
        if(keyPickup&&keyPickup.spawned) drawKeyPickup(ctx,keyPickup,t,currentLevel);
        if(lifePickup) drawLifePickup(ctx,lifePickup,t);
        if(dashRefill) drawDashRefill(ctx,dashRefill,t);
        if (gollum) drawGollum(ctx,gollum,eye,frodo);
        if (balrog && balrog.active) drawBalrog(ctx,balrog,H);
        if (shelob) {
          // Shelob telegraph shadow on ground when about to drop
          if (shelob.phase==='lurk' && shelob.dropTimer<1.5) {
            const sAlpha=Math.max(0,(1.5-shelob.dropTimer)/1.5)*0.4;
            const sg=ctx.createRadialGradient(shelob.x,H*0.7,0,shelob.x,H*0.7,40);
            sg.addColorStop(0,`rgba(80,0,100,${sAlpha})`);
            sg.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle=sg; ctx.fillRect(shelob.x-40,H*0.5,80,H*0.4);
          }
          drawShelob(ctx,shelob,eye);
        }
        // Spiderlings
        // Ambient particles
        ambientParticles.forEach(p=>{
          ctx.save(); ctx.globalAlpha=Math.min(1,p.life*0.5);
          ctx.fillStyle=p.color;
          if(p.type==='petal'){
            ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*1.4,p.size*0.7,p.x*0.01,0,Math.PI*2); ctx.fill();
          } else {
            ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
          }
          ctx.restore();
        });
        spiderlings.forEach(sp => drawSpiderling(ctx, sp));
        // Blessing pickup
        if (blessingPickup && !blessingPickup.collected) drawBlessingPickup(ctx, blessingPickup, t);
        drawWraiths1(ctx,wraiths,eye,H,SKY_Y,!!(def.hasBalrog||def.hasShelob));
        if (frodo) drawFrodo1(ctx,frodo,progress(),timers.elapsed,currentLevel);
        // Eagle particles (Pelennor distraction)
        eagleParticles.forEach(ep=>{
          ctx.save(); ctx.globalAlpha=Math.min(1,ep.life*0.5);
          ctx.fillStyle='#c8a030'; ctx.font='18px serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('🦅',ep.x-cameraX,ep.y); ctx.restore();
        });
        ctx.globalAlpha=1;
        particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life*2.5);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1;
        ctx.restore(); // end world-space
        // Screen-space overlays (no camera offset)
        if(eye&&eye.open>0.02) drawEye1(ctx,W,eye);
        if(eye&&eye.phase==='active'){ctx.fillStyle=`rgba(160,0,0,${eye.open*0.16})`;ctx.fillRect(0,0,W,H);}
        if(eye&&eye.phase==='warning'&&Math.random()>0.65){ctx.fillStyle=`rgba(200,50,0,${Math.random()*0.09})`;ctx.fillRect(0,0,W,H);}
        // Permanent level atmosphere tint
        const LEVEL_TINTS=['rgba(20,10,5,0.06)','rgba(20,10,5,0.06)','rgba(10,30,10,0.05)','rgba(15,20,8,0.08)','rgba(20,5,0,0.08)','rgba(10,0,15,0.10)','rgba(0,20,5,0.09)','rgba(20,10,0,0.07)','rgba(25,5,0,0.12)'];
        if(LEVEL_TINTS[currentLevel]){ctx.fillStyle=LEVEL_TINTS[currentLevel];ctx.fillRect(0,0,W,H);}
        // Virtual joystick overlay (touch only)
        if(isTouch&&joystick.active){
          ctx.save();
          // Base ring
          ctx.globalAlpha=0.35;
          ctx.strokeStyle='rgba(200,160,60,0.8)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(joystick.baseX,joystick.baseY,JOY_R,0,Math.PI*2); ctx.stroke();
          // Inner fill
          ctx.fillStyle='rgba(200,160,60,0.1)';
          ctx.beginPath(); ctx.arc(joystick.baseX,joystick.baseY,JOY_R,0,Math.PI*2); ctx.fill();
          // Thumb nub
          const nx=joystick.baseX+joystick.dx*JOY_R, ny=joystick.baseY+joystick.dy*JOY_R;
          ctx.globalAlpha=0.65;
          ctx.fillStyle='rgba(200,160,60,0.6)';
          ctx.beginPath(); ctx.arc(nx,ny,JOY_R*0.38,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(200,160,60,0.9)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.arc(nx,ny,JOY_R*0.38,0,Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        // Companion whisper
        if(whisperTimer>0&&whisperText){
          const wFade=whisperTimer<0.6?whisperTimer/0.6:Math.min(1,(3.2-whisperTimer)*3);
          ctx.save(); ctx.globalAlpha=wFade*0.88;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.font='italic 12px "Palatino Linotype",Palatino,Georgia,serif';
          const wm=ctx.measureText(whisperText);
          ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(W/2-wm.width/2-12,H*0.88-10,wm.width+24,22);
          ctx.fillStyle='rgba(200,180,130,0.95)';
          ctx.fillText(whisperText,W/2,H*0.88);
          ctx.restore();
        }
        // Enemy introduction flash
        if(enemyIntroTimer>0){
          const introFade=enemyIntroTimer<0.5?enemyIntroTimer*2:Math.min(1,(2.2-enemyIntroTimer)*4);
          ctx.save(); ctx.globalAlpha=introFade*0.92;
          ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(W/2-130,H*0.42,260,38);
          ctx.fillStyle='#e8c840'; ctx.font='bold 13px "Palatino Linotype",Palatino,Georgia,serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(enemyIntroName.toUpperCase(),W/2,H*0.42+13);
          ctx.fillStyle='rgba(180,140,60,0.7)'; ctx.font='italic 10px serif';
          ctx.fillText('new enemy',W/2,H*0.42+28);
          ctx.restore();
        }
        if(blindFlash>0){ctx.fillStyle=`rgba(255,200,50,${blindFlash*0.92})`;ctx.fillRect(0,0,W,H);}
        // YOU SHALL NOT PASS (Moria balrog activation)
        if (ynapassTimer > 0) {
          const fade = ynapassTimer < 0.5 ? ynapassTimer * 2 : 1;
          ctx.save(); ctx.globalAlpha = fade * 0.95;
          ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 20;
          ctx.fillStyle = '#ffd700';
          ctx.font = `bold ${Math.round(W * 0.055)}px "Palatino Linotype",Palatino,Georgia,serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('YOU SHALL NOT PASS', W/2, H/2);
          ctx.restore();
        }
        // Dead Marshes fog (index 3)
        if (currentLevel === 3 && progress() > 0.4) {
          const fogAlpha = (0.05 + Math.sin(timers.elapsed * 1.2) * 0.05) * Math.min(1, (progress() - 0.4) * 5);
          ctx.fillStyle = `rgba(80,90,70,${fogAlpha})`;
          ctx.fillRect(0, 0, W, H);
        }
        // Torch darkness (Moria + Shelob)
        // Eye opening/open: darkness lifts so player can see and react
        if(def.hasBalrog||def.hasShelob){
          const eyePhase = eye ? eye.phase : 'idle';
          const eyeOpen  = eye ? (eye.open||0) : 0;
          // When Eye is warning/active, fade darkness out proportionally
          const eyeSuppression = eyePhase==='active' ? eyeOpen
            : eyePhase==='warning' ? eyeOpen*0.6
            : 0;
          if(eyeSuppression < 0.99){
            const fsx=frodo.x-cameraX, fsy=frodo.y;
            const torchR = def.hasBalrog
              ? (160 - progress()*40) * (1 + Math.sin(t*2.1)*0.04)
              : 90 - progress()*20;
            // Scale darkness strength down as Eye opens
            const darkStr = 1 - eyeSuppression;
            const dark=ctx.createRadialGradient(fsx,fsy,torchR*0.18,fsx,fsy,torchR*2.2);
            dark.addColorStop(0,'rgba(0,0,0,0)');
            dark.addColorStop(0.45,`rgba(0,0,0,${0.55*darkStr})`);
            dark.addColorStop(1,`rgba(0,0,0,${0.97*darkStr})`);
            ctx.fillStyle=dark; ctx.fillRect(0,0,W,H);
          }
        }
        // Blessing halo (Lothlorien)
        if (blessingActive > 0) {
          const fx = frodo.x - cameraX, fy = frodo.y;
          ctx.save(); ctx.shadowColor='rgba(180,220,255,0.6)'; ctx.shadowBlur=20;
          ctx.strokeStyle=`rgba(180,220,255,${0.3+Math.sin(timers.elapsed*3)*0.15})`;
          ctx.lineWidth=2.5;
          ctx.beginPath(); ctx.arc(fx, fy, frodo.r * 2.2, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }
        // Black Gate — first sight of the Eye
        if(currentLevel===4&&eye.phase==='active'&&timers.elapsed<20&&Math.sin(timers.elapsed*2)>0){
          ctx.save(); ctx.shadowColor='#ff2200'; ctx.shadowBlur=10;
          ctx.fillStyle='rgba(220,60,0,0.9)'; ctx.font='bold 12px serif';
          ctx.textAlign='center';
          ctx.fillText('THE EYE OF SAURON -- FIRST SIGHT',W/2,48);
          ctx.restore();
        }
        // Pelennor — Eye distracted banner
        if(currentLevel===7&&eyeDistracted&&Math.sin(timers.elapsed*3)>0){
          ctx.save(); ctx.shadowColor='#80c030'; ctx.shadowBlur=8;
          ctx.fillStyle='rgba(120,200,40,0.85)'; ctx.font='bold 11px serif';
          ctx.textAlign='center';
          ctx.fillText('THE EYE TURNS TO WAR',W/2,32);
          ctx.restore();
        }
        // Horn of Gondor banner (Pelennor)
        if (currentLevel === 7 && hornActive > 0 && Math.sin(timers.elapsed * 4) > 0) {
          ctx.save(); ctx.shadowColor='#ffd700'; ctx.shadowBlur=12;
          ctx.fillStyle='rgba(255,215,0,0.9)'; ctx.font='bold 14px "Palatino Linotype",Palatino,Georgia,serif';
          ctx.textAlign='center';
          ctx.fillText('THE HORN OF GONDOR SOUNDS',W/2,H*0.25);
          ctx.restore();
        }
        // Mount Doom endgame (index 8, progress >= 0.9)
        if (currentLevel === 8 && progress() >= 0.9) {
          const eyeScale = (progress() - 0.9) * 10;
          ctx.save(); ctx.globalAlpha = eyeScale * 0.4;
          const doomEye = ctx.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.3, W*0.6);
          doomEye.addColorStop(0, 'rgba(255,80,0,0.8)');
          doomEye.addColorStop(0.3, 'rgba(180,20,0,0.5)');
          doomEye.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = doomEye; ctx.fillRect(0, 0, W, H);
          ctx.restore();
          if (Math.sin(timers.elapsed * 2) > 0) {
            ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
            ctx.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(timers.elapsed*3)*0.3})`;
            ctx.font = 'italic 16px "Palatino Linotype",Palatino,Georgia,serif';
            ctx.textAlign = 'center';
            ctx.fillText('One last step.', W/2, H - 30);
            ctx.restore();
          }
        }
        drawUILevel(ctx,W,H,frodo,progress(),eye,timers.elapsed,currentLevel,def,dashCharges,score,round,GOD_MODE,maxLives(),maxDash(),comboMult,comboFlash,comboTimer,flavourIdx,flavourAlpha);
        // Cinematic level intro (4.5s total)
        if(timers.elapsed < 4.5) {
          const el = timers.elapsed;
          // Phase 1 (0-1.2s): black + badge only
          // Phase 2 (1.2-3.8s): title + subtitle
          // Phase 3 (3.8-4.5s): fade out
          const bgAlpha = el < 0.6 ? el/0.6 : el > 3.8 ? Math.max(0,(4.5-el)/0.7) : 1;
          ctx.save();
          ctx.fillStyle=`rgba(0,0,0,${bgAlpha*0.78})`; ctx.fillRect(0,H/2-80,W,160);
          ctx.globalAlpha = bgAlpha;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          const badge=def.book||'I';
          // Badge always visible in phase 1+2
          const badgeFade = el<0.4?el/0.4:1;
          ctx.globalAlpha = bgAlpha * badgeFade;
          ctx.fillStyle='rgba(200,160,50,0.85)'; ctx.font='bold 12px serif';
          ctx.fillText(`BOOK ${badge}  --  CHAPTER ${def.chapter||'?'}`,W/2,H/2-52);
          // Title + subtitle slide in at 1.2s
          if(el > 1.2) {
            const titleFade = Math.min(1,(el-1.2)/0.4);
            const slideY = (1-titleFade)*18;
            ctx.globalAlpha = bgAlpha * titleFade;
            ctx.fillStyle='#f0d860'; ctx.font=`bold 28px "Palatino Linotype",Palatino,Georgia,serif`;
            ctx.fillText(def.title,W/2,H/2-16+slideY);
            if(el > 1.7) {
              const subFade = Math.min(1,(el-1.7)/0.5);
              ctx.globalAlpha = bgAlpha * subFade * 0.85;
              ctx.fillStyle='rgba(220,180,80,1)'; ctx.font=`italic 13px "Palatino Linotype",Palatino,Georgia,serif`;
              ctx.fillText(def.subtitle,W/2,H/2+18);
            }
          }
          ctx.restore();
        }
      }

      if(state==='title') {
        drawTitleScreen(ctx,W,H,t);
      }
      if(state==='levelwin') drawLevelWin(ctx,W,H,def,currentLevel,t,levelTransTimer);
      if(state==='gameover') drawGameOver(ctx,W,H,t,lastScore,lastRound,lastLevel,sessionCheckpoint);
      if(state==='win')      drawFinalWin(ctx,W,H,t,round,score);

      ctx.restore();
      requestAnimationFrame(loop);
    }

    // Persistent progress helpers
    function loadProgress() {
      try { return JSON.parse(localStorage.getItem('lotr_ring_progress')||'{}'); } catch(e) { return {}; }
    }
    function saveProgress(data) {
      try { localStorage.setItem('lotr_ring_progress', JSON.stringify(data)); } catch(e) {}
    }
    function updateProgress() {
      const p = loadProgress();
      if (score > (p.bestScore||0)) p.bestScore = Math.floor(score);
      if (round > (p.bestRound||0)) p.bestRound = round;
      if (currentLevel > (p.furthestLevel||0)) p.furthestLevel = currentLevel;
      p.gamesPlayed = (p.gamesPlayed||0) + 1;
      saveProgress(p);
    }

    function fullReset() {
      // lastScore/lastRound/lastLevel already captured in hitFrodo()
      updateProgress();
      round = 1; score = 0; dashCharges = maxDash(); // round=1 → 3
      frodo = null;
    }

    function triggerDash() {
      if ((!GOD_MODE && dashCharges <= 0) || dash) return;
      if (!GOD_MODE) dashCharges--;
      // Dash direction: current keys, else away from nearest Nazgûl
      let dx=0, dy=0;
      if (keys['ArrowLeft']||keys['a']||keys['A']) dx-=1;
      if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
      if (keys['ArrowUp']||keys['w']||keys['W']) dy-=1;
      if (keys['ArrowDown']||keys['s']||keys['S']) dy+=1;
      if (!dx && !dy && wraiths.length) {
        // Flee from nearest Nazgûl
        const nearest = wraiths.reduce((a,b)=>dist(frodo,a)<dist(frodo,b)?a:b);
        const a = Math.atan2(frodo.y-nearest.y, frodo.x-nearest.x);
        dx=Math.cos(a); dy=Math.sin(a);
      }
      const len = Math.hypot(dx,dy)||1;
      dash = { vx:(dx/len)*18, vy:(dy/len)*18, timer:0.32 };
      frodo.invincible=true; frodo.invTimer=0.35;
      // Trail burst
      for(let i=0;i<10;i++){
        const a=Math.random()*Math.PI*2, s=1+Math.random()*2;
        particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,
                        life:0.3+Math.random()*0.2,size:2+Math.random()*3,color:'#80c0ff'});
      }
      // Spawn refill token in left/mid world if charges now < 3
      if (dashCharges < 3 && !dashRefill) {
        const rx = 100 + Math.random() * (WORLD_W * 0.4); // left half
        const ry = H*0.2 + Math.random()*(H*0.6);
        dashRefill = {x:rx, y:ry, r:13, pulse:0};
      }
    }

    function hitFrodo() {
      if (!GOD_MODE) frodo.lives--;
      sndHit();
      comboMult = 1; comboTimer = 0;
      frodo.invincible=true; frodo.invTimer=2.8; frodo.hitFlash=1;
      shake={x:0,y:0,dur:0.45,intensity:9};
      for(let i=0;i<14;i++){
        const a=(i/14)*Math.PI*2+Math.random()*0.4, s=1.2+Math.random()*3.5;
        particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,
                        life:0.5+Math.random()*0.4,size:3+Math.random()*3,
                        color:Math.random()>0.5?'#d4a020':'#903010'});
      }
      if(frodo.lives<=0) {
        // Capture stats NOW before fullReset() wipes them
        lastScore = score; lastRound = round; lastLevel = currentLevel;
        state = 'gameover';
      }
    }

    function hitFrodoHard() {
      if (GOD_MODE) return;
      frodo.lives = Math.max(0, frodo.lives - 2);
      frodo.invincible = true; frodo.invTimer = 3.5; frodo.hitFlash = 1;
      shake = {x:0,y:0,dur:0.8,intensity:16};
      for(let i=0;i<20;i++){
        const a=(i/20)*Math.PI*2,s=2+Math.random()*4;
        particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,
          life:0.7+Math.random()*0.4,size:5+Math.random()*5,
          color:Math.random()>0.4?'#ff4400':'#903010'});
      }
      if(frodo.lives<=0){lastScore=score;lastRound=round;lastLevel=currentLevel;state='gameover';}
    }

    requestAnimationFrame(loop);
  }

  // ── LEVEL BACKGROUNDS ─────────────────────────────────────────────────
  // ── LIFE PICKUP ───────────────────────────────────────────────────
  function drawLifePickup(ctx, p, t) {
    const pulse = 1 + Math.sin(p.pulse)*0.2;
    ctx.save();
    ctx.shadowColor = '#d4a020'; ctx.shadowBlur = 18*pulse;
    ctx.strokeStyle = `rgba(212,160,32,${0.6+Math.sin(p.pulse)*0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r*pulse, 0, Math.PI*2); ctx.stroke();
    const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*1.6);
    g.addColorStop(0,'rgba(212,168,32,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(p.x-p.r*2,p.y-p.r*2,p.r*4,p.r*4);
    ctx.fillStyle='rgba(220,180,40,0.95)';
    ctx.font = `bold ${Math.round(p.r*1.2)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('♥', p.x, p.y);
    ctx.restore();
  }

  // ── GOAL MARKER ────────────────────────────────────────────────────
  function drawDashRefill(ctx, p, t) {
    const pulse = 1 + Math.sin(p.pulse)*0.22;
    ctx.save();
    ctx.shadowColor='#60a0ff'; ctx.shadowBlur=18*pulse;
    ctx.strokeStyle=`rgba(100,160,255,${0.7+Math.sin(p.pulse)*0.25})`;
    ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2); ctx.stroke();
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*2);
    g.addColorStop(0,'rgba(80,140,255,0.4)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(p.x-p.r*2,p.y-p.r*2,p.r*4,p.r*4);
    ctx.fillStyle='rgba(160,210,255,0.95)';
    ctx.font=`bold ${Math.round(p.r*1.2)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('⚡',p.x,p.y);
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(120,180,255,0.8)'; ctx.font='bold 9px serif';
    ctx.fillText('DASH +1',p.x,p.y+p.r+10);
    ctx.restore();
  }

  function drawGoal(ctx, goal, def, t, prog, startX, startY, unlocked, currentLvl=0, H=580, eyeOpen=0) {
    const { x, y, r } = goal;
    const lvl = currentLvl;
    const pulse = unlocked ? 1 + Math.sin(t * 3) * 0.22 : 1;

    // Level 1: Rivendell — elven forest, waterfall, archways around the goal
    if (lvl === 0) {
      ctx.save();
      // Soft elven light glow behind goal
      const eg=ctx.createRadialGradient(x,y,0,x,y,r*5);
      eg.addColorStop(0,`rgba(180,240,200,${0.3+Math.sin(t*1.2)*0.08})`);
      eg.addColorStop(0.5,`rgba(100,200,140,0.12)`);
      eg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=eg; ctx.fillRect(x-r*6,y-r*4,r*12,H-y+r*4);

      // Tall elven trees flanking the gate — slender trunks, layered canopy
      const treePositions=[-r*4.5,-r*2.8,r*2.8,r*4.5];
      treePositions.forEach((ox,i)=>{
        const tx=x+ox, th=r*2.2, ty=y+r*0.5; // short trunks
        // Trunk
        ctx.fillStyle=`hsl(${28+i*4},${45}%,${18}%)`;
        ctx.fillRect(tx-r*0.12,ty,r*0.24,th);
        // Layered canopy (3 tiers, each slightly offset)
        [0,1,2].forEach(tier=>{
          const cr2=r*(1.4-tier*0.3), cy=ty-r*(0.6+tier*0.9);
          const canopyG=ctx.createRadialGradient(tx,cy,0,tx,cy,cr2);
          canopyG.addColorStop(0,`hsl(${125+tier*8},${60}%,${22+tier*3}%)`);
          canopyG.addColorStop(0.7,`hsl(${120+tier*6},${50}%,${16+tier*2}%)`);
          canopyG.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=canopyG;
          ctx.beginPath(); ctx.arc(tx,cy,cr2,0,Math.PI*2); ctx.fill();
          // Leaf shimmer
          ctx.save(); ctx.globalAlpha=0.12+Math.sin(t*0.8+i+tier)*0.06;
          ctx.fillStyle='rgba(160,255,160,1)';
          ctx.beginPath(); ctx.arc(tx+cr2*0.3,cy-cr2*0.2,cr2*0.25,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
      });

      // Stone archway over the goal
      const aw=r*2.2, ah=r*2.0;
      ctx.strokeStyle='rgba(200,220,200,0.55)'; ctx.lineWidth=r*0.22;
      ctx.beginPath();
      ctx.moveTo(x-aw,y+ah); ctx.lineTo(x-aw,y);
      ctx.quadraticCurveTo(x,y-ah*0.5,x+aw,y);
      ctx.lineTo(x+aw,y+ah); ctx.stroke();
      // Arch detail — elven rune glow
      ctx.save(); ctx.shadowColor='rgba(150,255,200,0.6)'; ctx.shadowBlur=8;
      ctx.strokeStyle=`rgba(180,255,210,${0.25+Math.sin(t*1.8)*0.1})`; ctx.lineWidth=r*0.08;
      ctx.beginPath();
      ctx.moveTo(x-aw*0.8,y+ah); ctx.lineTo(x-aw*0.8,y+r*0.2);
      ctx.quadraticCurveTo(x,y-ah*0.35,x+aw*0.8,y+r*0.2);
      ctx.lineTo(x+aw*0.8,y+ah); ctx.stroke();
      ctx.restore();

      // Waterfall on right side — thin luminous streams
      ctx.save(); ctx.shadowColor='rgba(160,220,255,0.5)'; ctx.shadowBlur=6;
      [r*3.5,r*4.0,r*4.5].forEach((ox,i)=>{
        const wg=ctx.createLinearGradient(x+ox,y-r,x+ox,H);
        wg.addColorStop(0,`rgba(180,230,255,${0.4+Math.sin(t*1.5+i)*0.1})`);
        wg.addColorStop(1,'rgba(120,180,220,0.1)');
        ctx.strokeStyle=wg; ctx.lineWidth=r*0.08+i*r*0.03;
        ctx.beginPath(); ctx.moveTo(x+ox,y-r);
        ctx.bezierCurveTo(x+ox+r*0.1,y+r*1.5,x+ox-r*0.1,y+r*3,x+ox+r*0.05,H);
        ctx.stroke();
      });
      ctx.restore();

      // Fireflies / motes of light
      ctx.save();
      for(let i=0;i<8;i++){
        const mx2=x+(Math.sin(t*0.7+i*1.2)*r*4),my2=y+r*0.5+(Math.cos(t*0.5+i)*r*3);
        const mg2=ctx.createRadialGradient(mx2,my2,0,mx2,my2,r*0.4);
        mg2.addColorStop(0,`rgba(200,255,200,${0.5+Math.sin(t*2+i)*0.3})`);
        mg2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg2; ctx.fillRect(mx2-r*0.4,my2-r*0.4,r*0.8,r*0.8);
      }
      ctx.restore();
      ctx.restore();
    }

    // Level 2: Moria Bridge — narrow span over fiery chasm
    if (lvl === 1) {
      ctx.save();
      // Fiery abyss below
      const abyss=ctx.createLinearGradient(x,y+r,x,H);
      abyss.addColorStop(0,`rgba(255,100,0,${0.5+Math.sin(t*1.8)*0.1})`);
      abyss.addColorStop(0.3,'rgba(180,40,0,0.4)');
      abyss.addColorStop(1,'rgba(20,0,0,0.2)');
      ctx.fillStyle=abyss; ctx.fillRect(x-r*4,y+r,r*8,H-y-r);
      // Bridge
      ctx.fillStyle='#2a1e14';
      ctx.fillRect(x-r*2,y+r*0.5,r*4,r*0.45);
      ctx.fillRect(x-r*1.8,y+r*0.95,r*3.6,r*0.25);
      // Bridge edge glow
      ctx.save(); ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
      ctx.strokeStyle='rgba(255,120,0,0.35)'; ctx.lineWidth=1.5;
      ctx.strokeRect(x-r*2,y+r*0.5,r*4,r*0.7);
      ctx.restore();
      // Stone pillars
      [x-r*2.8,x+r*2.2].forEach(px=>{
        ctx.fillStyle='#221812';
        ctx.fillRect(px,y,r*0.6,H-y);
        ctx.fillStyle='#2e2018'; ctx.fillRect(px-r*0.1,y-r*0.3,r*0.8,r*0.35);
      });
      // Lava glow from chasm
      const lg=ctx.createRadialGradient(x,H*0.8,0,x,H*0.8,r*5);
      lg.addColorStop(0,`rgba(255,80,0,${0.3+Math.sin(t*2)*0.1})`);
      lg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=lg; ctx.fillRect(x-r*5,y,r*10,H-y);
      ctx.restore();
    }

    // Level 3: Lothlórien Mirror
    if (lvl === 2) {
      ctx.save();
      // Galadriel silhouette beside the mirror
      const gx=x+r*3.5, gy=y-r*2;
      const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,r*3);
      gg.addColorStop(0,`rgba(220,240,255,${0.35+Math.sin(t*1.2)*0.1})`);
      gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gg; ctx.fillRect(gx-r*3,gy-r*2,r*6,r*6);
      // Tall figure
      ctx.fillStyle='rgba(220,240,255,0.45)';
      ctx.beginPath(); ctx.ellipse(gx,gy,r*0.3,r*1.4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(240,250,255,0.55)';
      ctx.beginPath(); ctx.arc(gx,gy-r*1.6,r*0.28,0,Math.PI*2); ctx.fill();
      // Stone basin
      ctx.fillStyle='#2a3830';
      ctx.beginPath(); ctx.ellipse(x,y+r*0.5,r*1.6,r*0.4,0,0,Math.PI*2); ctx.fill();
      // Still water
      const wg=ctx.createRadialGradient(x,y+r*0.5,0,x,y+r*0.5,r*1.5);
      wg.addColorStop(0,`rgba(180,220,255,${0.5+Math.sin(t*0.8)*0.12})`);
      wg.addColorStop(0.7,'rgba(120,180,220,0.2)');
      wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.beginPath(); ctx.ellipse(x,y+r*0.5,r*1.4,r*0.32,0,0,Math.PI*2); ctx.fill();
      // Silver upward glow
      ctx.save(); ctx.shadowColor='rgba(200,220,255,0.6)'; ctx.shadowBlur=20;
      const sg2=ctx.createLinearGradient(x,y+r,x,y-r*3);
      sg2.addColorStop(0,`rgba(200,220,255,${0.3+Math.sin(t*1.5)*0.08})`);
      sg2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg2; ctx.fillRect(x-r,y-r*3,r*2,r*4);
      ctx.restore();
      ctx.restore();
    }

    // Level 5: Black Gate
    if (lvl === 4) {
      ctx.save();
      // Two massive pylons
      const pyl=r*1.8;
      [x-pyl*1.2,x+pyl*0.2].forEach((px,i)=>{
        ctx.fillStyle='#1a0a06';
        ctx.fillRect(px,y-r*1.5,pyl,H-y+r*1.5);
        // Rivets
        ctx.fillStyle='rgba(80,40,20,0.5)';
        for(let j=0;j<5;j++) for(let k=0;k<3;k++)
          ctx.fillRect(px+8+k*18,y-r*1.2+j*22,4,4);
        // Orc banner
        ctx.fillStyle='#800000';
        ctx.fillRect(px+pyl*0.3,y-r*2.5,pyl*0.35,r*1.2);
        ctx.fillStyle='#400000';
        ctx.fillText(i===0?'☠':'️',px+pyl*0.38,y-r*2.1);
      });
      // Red-orange crack between gates
      const cg=ctx.createLinearGradient(x,y-r,x,y+r);
      cg.addColorStop(0,'rgba(255,100,0,0.6)');
      cg.addColorStop(0.5,`rgba(255,60,0,${0.5+Math.sin(t*3)*0.15})`);
      cg.addColorStop(1,'rgba(180,30,0,0.4)');
      ctx.fillStyle=cg; ctx.fillRect(x-r*0.08,y-r*1.5,r*0.16,H-y+r*1.5);
      ctx.restore();
    }

    // Level 6: Shelob's Lair exit — light of Eärendil
    if (lvl === 5) {
      ctx.save();
      ctx.shadowColor='rgba(220,240,255,0.8)'; ctx.shadowBlur=30;
      const lg=ctx.createRadialGradient(x,y,0,x,y,r*4);
      lg.addColorStop(0,`rgba(220,240,255,${0.7+Math.sin(t*1.8)*0.15})`);
      lg.addColorStop(0.3,'rgba(180,200,240,0.4)');
      lg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=lg; ctx.fillRect(x-r*4,y-r*3,r*8,r*7);
      ctx.restore();
    }

    // Level 7: Minas Morgul road arch
    if (lvl === 6) {
      ctx.save();
      // Green stone arch
      const aw=r*2.2, ah=r*1.8;
      ctx.shadowColor='#40ff80'; ctx.shadowBlur=16;
      ctx.strokeStyle=`rgba(40,200,80,${0.5+Math.sin(t*1.5)*0.2})`; ctx.lineWidth=r*0.22;
      ctx.beginPath();
      ctx.moveTo(x-aw,y+ah); ctx.lineTo(x-aw,y);
      ctx.quadraticCurveTo(x,y-ah*0.55,x+aw,y);
      ctx.lineTo(x+aw,y+ah); ctx.stroke();
      // Skull motifs
      ctx.fillStyle=`rgba(40,180,70,${0.5+Math.sin(t*2)*0.2})`;
      ctx.font=`${Math.round(r*0.7)}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('💀',x,y-ah*0.2);
      ctx.restore();
    }

    // Level 8: Pelennor — way to Mordor
    if (lvl === 7) {
      ctx.save();
      // Dark mountain silhouette
      ctx.fillStyle='#120608';
      ctx.beginPath(); ctx.moveTo(x-r*5,y+r); ctx.lineTo(x-r*2,y-r*1.5); ctx.lineTo(x,y-r*0.5); ctx.lineTo(x+r*2.5,y-r*2); ctx.lineTo(x+r*5,y+r); ctx.fill();
      // Mount Doom glow on right
      const dg=ctx.createRadialGradient(x+r*4,y-r*1.5,0,x+r*4,y-r*1.5,r*3);
      dg.addColorStop(0,`rgba(255,80,0,${0.4+Math.sin(t*1.8)*0.1})`);
      dg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=dg; ctx.fillRect(x,y-r*4,r*8,r*7);
      ctx.restore();
    }

    // Level 4: Emyn Muil — jagged rock columns flanking the goal
    if (lvl === 3) {
      ctx.save();
      const rockBase = H; // columns rise from bottom toward goal
      const rockTop  = y + r * 2;
      const colH     = rockBase - rockTop;
      // Stone colour — grey-brown
      const rockG = ctx.createLinearGradient(x, rockTop, x, rockBase);
      rockG.addColorStop(0, '#2a2420');
      rockG.addColorStop(0.5, '#1e1a16');
      rockG.addColorStop(1, '#141210');
      ctx.fillStyle = rockG;
      // Five jagged columns of varying width and height
      const cols = [
        { ox: -r*3.2, w: r*0.9,  topFrac: 0.22 },
        { ox: -r*1.8, w: r*1.1,  topFrac: 0.08 },
        { ox: -r*0.4, w: r*0.8,  topFrac: 0.0  }, // tallest — directly below goal
        { ox:  r*1.1, w: r*1.0,  topFrac: 0.12 },
        { ox:  r*2.5, w: r*0.85, topFrac: 0.28 },
      ];
      cols.forEach(({ ox, w: cw, topFrac }) => {
        const ct = rockTop + colH * topFrac;
        const jagged = r * 0.18;
        ctx.beginPath();
        ctx.moveTo(x + ox,           rockBase);
        ctx.lineTo(x + ox,           ct + jagged);
        ctx.lineTo(x + ox + cw*0.2,  ct);
        ctx.lineTo(x + ox + cw*0.45, ct + jagged*0.7);
        ctx.lineTo(x + ox + cw*0.65, ct - jagged*0.4);
        ctx.lineTo(x + ox + cw*0.85, ct + jagged*0.5);
        ctx.lineTo(x + ox + cw,      ct + jagged*0.2);
        ctx.lineTo(x + ox + cw,      rockBase);
        ctx.closePath();
        ctx.fill();
        // Column face crack
        ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(x + ox + cw*0.4, ct + jagged*0.5);
        ctx.lineTo(x + ox + cw*0.45, ct + colH*(0.3+topFrac));
        ctx.stroke();
        ctx.restore();
      });
      // Cliff edge highlight
      ctx.save(); ctx.strokeStyle='rgba(100,80,60,0.25)'; ctx.lineWidth=1.5;
      cols.forEach(({ ox, w: cw, topFrac }) => {
        const ct = rockTop + colH * topFrac;
        ctx.beginPath(); ctx.moveTo(x+ox, ct+r*0.18); ctx.lineTo(x+ox+cw, ct+r*0.18+r*0.2); ctx.stroke();
      });
      ctx.restore();
      // Moss/lichen patches (dark green tint)
      ctx.save(); ctx.globalAlpha=0.12; ctx.fillStyle='#304020';
      cols.forEach(({ ox, w: cw, topFrac }) => {
        const ct = rockTop + colH * topFrac;
        ctx.fillRect(x+ox, ct+r*0.3, cw*0.6, colH*0.1);
      });
      ctx.restore();
      ctx.restore();
    }

    // Level 9: Mount Doom mountain below the goal
    if (lvl === 8) {
      ctx.save();
      // Mountain body
      const mw = r*5, mh = H - y - r*2; // extends from goal down to ground
      const mx = x;
      // Outer mountain silhouette
      const mg = ctx.createLinearGradient(mx,y+r,mx,H);
      mg.addColorStop(0,'#1a0804'); mg.addColorStop(0.4,'#120603'); mg.addColorStop(1,'#0a0402');
      ctx.fillStyle=mg;
      ctx.beginPath();
      ctx.moveTo(mx-mw*0.95, H);
      ctx.lineTo(mx-mw*0.6, y+mh*0.55);
      ctx.lineTo(mx-mw*0.35, y+mh*0.3);
      ctx.lineTo(mx, y+r*1.5); // peak at goal
      ctx.lineTo(mx+mw*0.35, y+mh*0.3);
      ctx.lineTo(mx+mw*0.6, y+mh*0.55);
      ctx.lineTo(mx+mw*0.95, H);
      ctx.closePath(); ctx.fill();
      // Lava cracks glowing on mountain face
      ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
      const lavaG = ctx.createLinearGradient(mx,y+r,mx,H);
      lavaG.addColorStop(0,`rgba(255,80,0,${0.7+Math.sin(t*2)*0.15})`);
      lavaG.addColorStop(1,'rgba(200,40,0,0.3)');
      ctx.strokeStyle=lavaG; ctx.lineWidth=2;
      // Left crack
      ctx.beginPath(); ctx.moveTo(mx-r*0.5,y+mh*0.25);
      ctx.bezierCurveTo(mx-r*1.2,y+mh*0.4, mx-r*0.8,y+mh*0.6, mx-r*1.5,y+mh*0.8); ctx.stroke();
      // Right crack
      ctx.beginPath(); ctx.moveTo(mx+r*0.3,y+mh*0.2);
      ctx.bezierCurveTo(mx+r*0.8,y+mh*0.4, mx+r*0.4,y+mh*0.65, mx+r*1.2,y+mh*0.85); ctx.stroke();
      ctx.restore();
      // Summit smoke/fire glow
      const smokeG=ctx.createRadialGradient(mx,y,0,mx,y,r*3);
      smokeG.addColorStop(0,`rgba(255,100,0,${0.4+Math.sin(t*1.5)*0.1})`);
      smokeG.addColorStop(0.5,'rgba(180,30,0,0.15)');
      smokeG.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=smokeG; ctx.fillRect(mx-r*3,y-r*2,r*6,r*5);
      ctx.restore();
    }

    ctx.save();
    if (!unlocked) {
      // Locked: dim grey with padlock
      ctx.globalAlpha = 0.35;
      ctx.shadowColor = '#888'; ctx.shadowBlur = 10;
      ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = 'rgba(160,160,160,0.7)';
      ctx.font = `bold ${Math.round(r*1.1)}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🔒', x, y);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(140,140,140,0.5)';
      ctx.font = 'bold 9px serif';
      ctx.fillText('LOCKED', x, y + r + 10);
    } else {
      // Unlocked: full bright beacon
      const GOAL_HEX=['#80e0ff','#ff8030','#b0ffd0','#a0c840','#c04020','#c060ff','#40ff80','#ff8040','#ff6000'];
      const GOAL_RGB=[[140,210,255],[255,130,50],[170,255,200],[130,200,60],[200,80,40],[200,100,255],[60,220,120],[255,150,80],[255,90,10]];
      const GOAL_ICON=['★','🌉','✶','▲','⚔','🕯','💫','⚔','🔥'];
      const GOAL_STROKE=[`rgba(180,230,255,`,`rgba(255,160,60,`,`rgba(170,255,200,`,`rgba(160,210,80,`,`rgba(220,80,40,`,`rgba(200,110,255,`,`rgba(60,220,120,`,`rgba(255,160,80,`,`rgba(255,120,20,`];
      const gHex = GOAL_HEX[lvl]||GOAL_HEX[0];
      const [cr,cg2,cb] = GOAL_RGB[lvl]||GOAL_RGB[0];
      const ringAlpha = 0.6 + Math.sin(t*3)*0.3;
      ctx.shadowColor = gHex;
      ctx.shadowBlur  = 28 * pulse * (1 - eyeOpen * 0.45);
      ctx.strokeStyle = (GOAL_STROKE[lvl]||GOAL_STROKE[0])+`${ringAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI*2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      cg.addColorStop(0, `rgba(${cr},${cg2},${cb},0.6)`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(x-r*2.5, y-r*2.5, r*5, r*5);
      ctx.fillStyle = `rgba(${cr},${cg2},${cb},0.95)`;
      ctx.font = `bold ${Math.round(r*0.9)}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(GOAL_ICON[lvl]||'★', x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(200,160,60,0.85)';
      ctx.font = 'bold 9px serif';
      ctx.fillText(def.destination.toUpperCase(), x, y + r + 10);
    }
    // Dotted path hint
    if (prog < 0.15) {
      ctx.save(); ctx.globalAlpha = (0.15 - prog) * 5 * 0.3;
      ctx.strokeStyle = 'rgba(200,160,60,0.5)'; ctx.lineWidth = 1;
      ctx.setLineDash([4,8]);
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawKeyPickup(ctx, k, t, lvl) {
    const pulse = 1 + Math.sin(k.pulse) * 0.25;
    const colors = ['#80d0ff','#90e040','#ff8020'];
    const col = colors[lvl] || '#ffd030';
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 20 * pulse;
    // Outer ring
    ctx.strokeStyle = col.replace(')',`,${0.7+Math.sin(k.pulse)*0.2})`).replace('rgb','rgba');
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(k.x, k.y, k.r * pulse, 0, Math.PI*2); ctx.stroke();
    // Glow
    const g = ctx.createRadialGradient(k.x,k.y,0,k.x,k.y,k.r*2);
    g.addColorStop(0,`rgba(255,220,80,0.45)`); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(k.x-k.r*2,k.y-k.r*2,k.r*4,k.y-k.y+k.r*4);
    // Key symbol
    ctx.fillStyle = '#ffd030';
    ctx.font = `bold ${Math.round(k.r*1.3)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🔑', k.x, k.y);
    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,200,60,0.8)';
    ctx.font = 'bold 9px serif';
    ctx.fillText('COLLECT ME', k.x, k.y + k.r + 10);
    ctx.restore();
  }

  function drawBgLevel(ctx,W,H,t,def,prog,cameraX=0) {
    const [s1,s2]=def.bgSky;
    const sky=ctx.createLinearGradient(0,0,0,H*0.55);
    sky.addColorStop(0,s1); sky.addColorStop(1,s2);
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.55);

    // Stars: parallax 0.08x (nearly fixed, like distant sky)
    const noStars = def===LEVEL_DEFS[1]||def===LEVEL_DEFS[5]; // Moria + Shelob: no stars
    STARS.forEach(s=>{
      if(noStars) return;
      const base = def===LEVEL_DEFS[0] ? 0.15 : 0.4;
      const alpha = base + Math.sin(t*0.8+s.twinkle)*0.2;
      ctx.fillStyle=`rgba(255,250,220,${alpha})`;
      const sx = ((s.x*W - cameraX*0.08) % W + W) % W;
      ctx.beginPath(); ctx.arc(sx, s.y*H, s.r, 0, Math.PI*2); ctx.fill();
    });

    // Destination glow: screen-space (always right side, intensifies near goal)
    const [dr,dg,db]=def.destGlow;
    const dgl=ctx.createRadialGradient(W,H*0.5,0,W,H*0.5,340);
    dgl.addColorStop(0,`rgba(${dr},${dg},${db},${def.glowAlpha+prog*0.25})`);
    dgl.addColorStop(0.35,`rgba(${Math.floor(dr/2)},${Math.floor(dg/2)},${Math.floor(db/2)},0.12)`);
    dgl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=dgl; ctx.fillRect(0,0,W,H);

    // Mountains: parallax 0.25x — tile across 3 screens
    ctx.save(); ctx.translate(-cameraX*0.25, 0);
    ctx.fillStyle=def.horizon;
    for(let tile=0; tile<4; tile++) {
      const ox = tile * W;
      ctx.beginPath(); ctx.moveTo(ox,H*0.5);
      [[180,0],[240,0.08],[310,-0.02],[400,0.06],[480,0],[560,0.07],[640,0.01],[720,0.05],[W,0]]
        .forEach(([x,o])=>ctx.lineTo(ox+x,H*(0.5-o)));
      ctx.lineTo(ox+W,H*0.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Ground: screen-space (always fills bottom)
    const [g1,g2]=def.bgGnd;
    const ground=ctx.createLinearGradient(0,H*0.5,0,H);
    ground.addColorStop(0,g1); ground.addColorStop(1,g2);
    ctx.fillStyle=ground; ctx.fillRect(0,H*0.5,W,H*0.5);

    // Horizon haze — subtle atmospheric gradient at sky/ground boundary
    const hazeG = ctx.createLinearGradient(0, H*0.44, 0, H*0.58);
    hazeG.addColorStop(0, 'rgba(0,0,0,0)');
    hazeG.addColorStop(0.4, `rgba(${def.glow.join(',')},0.06)`);
    hazeG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hazeG; ctx.fillRect(0, H*0.44, W, H*0.14);

    // Road: screen-space infinite strip
    const road=ctx.createLinearGradient(0,H*0.48,0,H*0.62);
    road.addColorStop(0,def.roadCol); road.addColorStop(1,'rgba(0,0,0,0.2)');
    ctx.fillStyle=road; ctx.beginPath();
    ctx.moveTo(0,H*0.46); ctx.lineTo(W,H*0.44); ctx.lineTo(W,H*0.60); ctx.lineTo(0,H*0.62);
    ctx.closePath(); ctx.fill();

    // Level atmosphere: each branch draws in its own save/restore -- NO shared outer save
    // This eliminates all save/restore stack bugs from branch control flow
    if (def === LEVEL_DEFS[0]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Shire: lush rolling hills, hedgerows, oak trees, wildflowers, morning mist

      // Rolling far hills (behind road, parallax already applied)
      const hillColors = ['#1a3a0e','#1e4010','#163208'];
      [[0.02,0.4,0.22],[0.18,0.5,0.18],[0.42,0.42,0.2],[0.65,0.5,0.16],[0.88,0.44,0.19],[1.1,0.48,0.17],[1.35,0.42,0.21],[1.62,0.50,0.18],[1.85,0.44,0.20]]
        .forEach(([tx,ty,rr],i)=>{
          ctx.fillStyle=hillColors[i%3];
          ctx.beginPath(); ctx.arc(tx*W, H*ty, rr*W, Math.PI, 0); ctx.fill();
        });

      // Morning mist sitting in the valleys
      for(let i=0;i<8;i++){
        const mx=i*240+80, my=H*0.54;
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,90);
        mg.addColorStop(0,`rgba(200,215,180,${0.07+Math.sin(t*0.3+i)*0.03})`);
        mg.addColorStop(0.5,`rgba(180,200,160,0.04)`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-90,my-30,180,60);
      }

      // Hedgerows along the roadside — dense low shrubs
      for(let i=0;i<18;i++){
        const hx=i*118-20;
        // Lower hedge
        const hg=ctx.createRadialGradient(hx,H*0.595,0,hx,H*0.595,28);
        hg.addColorStop(0,'#1c3a0c'); hg.addColorStop(0.6,'#142e08'); hg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=hg; ctx.beginPath(); ctx.ellipse(hx,H*0.595,28,14,0,0,Math.PI*2); ctx.fill();
        // Upper hedge bump
        ctx.fillStyle='#1a3a0c';
        ctx.beginPath(); ctx.ellipse(hx+Math.sin(i)*8,H*0.578,12,10,Math.sin(i)*0.2,0,Math.PI*2); ctx.fill();
        // Occasional wildflower dot (yellow or white)
        if(i%3===0){
          ctx.fillStyle=i%6===0?'rgba(255,220,60,0.7)':'rgba(240,240,230,0.65)';
          ctx.beginPath(); ctx.arc(hx+15,H*0.582,2.5,0,Math.PI*2); ctx.fill();
        }
      }

      // Oak trees — proper silhouettes with trunk, main branches, irregular canopy
      const OAKS = [
        {x:0.06,  base:0.60, h:0.22, spread:0.055, lean: 0.04},
        {x:0.19,  base:0.62, h:0.20, spread:0.048, lean:-0.02},
        {x:0.36,  base:0.60, h:0.24, spread:0.060, lean: 0.03},
        {x:0.52,  base:0.61, h:0.21, spread:0.052, lean:-0.03},
        {x:0.68,  base:0.60, h:0.23, spread:0.057, lean: 0.02},
        {x:0.84,  base:0.62, h:0.20, spread:0.050, lean:-0.02},
        {x:1.00,  base:0.60, h:0.22, spread:0.055, lean: 0.03},
        {x:1.18,  base:0.61, h:0.21, spread:0.048, lean:-0.03},
        {x:1.36,  base:0.60, h:0.24, spread:0.058, lean: 0.02},
        {x:1.54,  base:0.62, h:0.20, spread:0.050, lean:-0.02},
        {x:1.72,  base:0.60, h:0.23, spread:0.055, lean: 0.03},
        {x:1.90,  base:0.61, h:0.22, spread:0.052, lean:-0.02},
      ];
      OAKS.forEach((oak, i) => {
        const tx = oak.x * W;
        const baseY = H * oak.base;
        const treeH = H * oak.h;
        const spread = oak.spread * W;
        const lean = oak.lean * W;
        // Trunk — tapered, slightly curved
        const trunkW = spread * 0.12;
        const trunkG = ctx.createLinearGradient(tx-trunkW,0,tx+trunkW,0);
        trunkG.addColorStop(0,'#2a1e0e'); trunkG.addColorStop(0.4,'#3a2a14'); trunkG.addColorStop(1,'#221808');
        ctx.fillStyle = trunkG;
        ctx.beginPath();
        ctx.moveTo(tx - trunkW, baseY);
        ctx.bezierCurveTo(tx - trunkW*0.6, baseY - treeH*0.45, tx + lean*0.3 - trunkW*0.3, baseY - treeH*0.7, tx + lean - trunkW*0.2, baseY - treeH*0.82);
        ctx.lineTo(tx + lean + trunkW*0.2, baseY - treeH*0.82);
        ctx.bezierCurveTo(tx + lean*0.3 + trunkW*0.3, baseY - treeH*0.7, tx + trunkW*0.6, baseY - treeH*0.45, tx + trunkW, baseY);
        ctx.closePath(); ctx.fill();
        // Main branches (2-3 visible)
        ctx.strokeStyle='#2a1e0e'; ctx.lineWidth=trunkW*0.7; ctx.lineCap='round';
        [[0.82,-0.55,0.4],[0.88, 0.65,0.38],[0.78,-0.30,0.28]].forEach(([fy,dir,ext])=>{
          const bx=tx+lean*(fy-0.8)*1.5, by=baseY-treeH*fy;
          ctx.beginPath();
          ctx.moveTo(bx,by);
          ctx.quadraticCurveTo(bx+dir*spread*0.45, by-treeH*0.08, bx+dir*spread*ext, by-treeH*0.18);
          ctx.stroke();
        });
        // Canopy — 4-6 overlapping lobes for irregular oak shape
        const canopyTop = baseY - treeH;
        const cx = tx + lean;
        const lobes = [
          {ox:0,    oy:0,    rx:spread*0.82, ry:spread*0.72},
          {ox:-spread*0.35, oy:spread*0.18, rx:spread*0.58, ry:spread*0.50},
          {ox: spread*0.38, oy:spread*0.22, rx:spread*0.55, ry:spread*0.48},
          {ox:-spread*0.18, oy:-spread*0.25,rx:spread*0.50, ry:spread*0.42},
          {ox: spread*0.20, oy:-spread*0.20,rx:spread*0.48, ry:spread*0.40},
        ];
        // Back shadow lobe first
        ctx.fillStyle=`hsl(115,42%,${12+i%3}%)`;
        ctx.beginPath(); ctx.ellipse(cx, canopyTop+spread*0.15, spread*0.88, spread*0.75, 0, 0, Math.PI*2); ctx.fill();
        // Main lobes
        lobes.forEach((l,li)=>{
          const shade=14+li*2+(i%2);
          ctx.fillStyle=`hsl(${118+li*3},${44+li}%,${shade}%)`;
          ctx.beginPath(); ctx.ellipse(cx+l.ox, canopyTop+l.oy, l.rx, l.ry, Math.sin(i+li)*0.15, 0, Math.PI*2); ctx.fill();
        });
        // Sunlight highlight on top-left
        ctx.save(); ctx.globalAlpha=0.12+Math.sin(t*0.6+i)*0.05;
        ctx.fillStyle='rgba(180,220,100,1)';
        ctx.beginPath(); ctx.ellipse(cx-spread*0.25, canopyTop-spread*0.1, spread*0.32, spread*0.25, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        // Leaf shimmer in wind
        ctx.save(); ctx.globalAlpha=0.08+Math.sin(t*1.1+i*0.8)*0.05;
        ctx.fillStyle='rgba(200,240,120,1)';
        ctx.beginPath(); ctx.ellipse(cx+spread*0.2, canopyTop+spread*0.05, spread*0.22, spread*0.18, 0.2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      });

      // Wildflowers scattered in the grass (foreground)
      for(let i=0;i<22;i++){
        const fx=(i*193+37)%(W*2), fy=H*0.56+Math.sin(i*0.9)*H*0.04;
        const fc=i%3===0?'rgba(255,220,60,0.75)':i%3===1?'rgba(255,255,255,0.65)':'rgba(200,100,180,0.6)';
        ctx.fillStyle=fc;
        ctx.beginPath(); ctx.arc(fx,fy,2+Math.sin(i)*0.5,0,Math.PI*2); ctx.fill();
        // Stem
        ctx.strokeStyle='rgba(80,120,40,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx+Math.sin(i)*2,fy+6); ctx.stroke();
      }

      // Distant hobbit hole door (once, around x=W*0.55)
      ctx.save();
      const hx=W*0.55, hy=H*0.52;
      ctx.fillStyle='#1a3008';
      ctx.beginPath(); ctx.ellipse(hx,hy,22,18,0,Math.PI,0); ctx.fill();
      ctx.fillStyle='#4a2808';
      ctx.beginPath(); ctx.ellipse(hx,hy,18,14,0,Math.PI,0); ctx.fill();
      ctx.strokeStyle='#6a3a10'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(hx,hy,16,Math.PI,0); ctx.stroke();
      // Round door
      ctx.fillStyle='#3a1e08';
      ctx.beginPath(); ctx.arc(hx,hy+2,7,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.shadowColor='rgba(180,120,40,0.5)'; ctx.shadowBlur=6;
      ctx.fillStyle='rgba(200,140,50,0.6)';
      ctx.beginPath(); ctx.arc(hx+3,hy+1,1.5,0,Math.PI*2); ctx.fill(); // door knob
      ctx.restore(); ctx.restore();
      ctx.restore(); // end Shire parallax

    } else if (def === LEVEL_DEFS[1]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Moria: stone columns + lava fissures + stalactites
      // Lava fissures on ground
      ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=8;
      for(let i=0;i<12;i++){
        const fx=80+i*165, fy=H*0.58;
        const lg=ctx.createLinearGradient(fx,fy,fx,fy+20);
        lg.addColorStop(0,`rgba(255,100,0,${0.5+Math.sin(t*1.8+i)*0.15})`);
        lg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=lg; ctx.fillRect(fx,fy,3+Math.sin(i)*2,20+Math.random()*8);
      }
      ctx.restore();
      // Stone columns with wall-mounted fire torches
      for(let i=0;i<8;i++){
        const cx=120+i*240, cw=32;
        // Column glow from torch (drawn first, behind column)
        const tgy=H*0.38; // torch height on column
        const flicker=0.7+Math.sin(t*7.3+i*1.9)*0.15+Math.sin(t*13.1+i)*0.08;
        const glow=ctx.createRadialGradient(cx+cw*0.5,tgy,0,cx+cw*0.5,tgy,90);
        glow.addColorStop(0,`rgba(255,140,30,${0.22*flicker})`);
        glow.addColorStop(0.4,`rgba(200,80,10,${0.10*flicker})`);
        glow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=glow; ctx.fillRect(cx-90,tgy-90,cw+180,180);
        // Column body
        const cg=ctx.createLinearGradient(cx,H*0.35,cx+cw,H*0.35);
        cg.addColorStop(0,'#1a1210'); cg.addColorStop(0.5,'#2a1e18'); cg.addColorStop(1,'#141008');
        ctx.fillStyle=cg; ctx.fillRect(cx,H*0.35,cw,H*0.65);
        // Column cap
        ctx.fillStyle='#221a14'; ctx.fillRect(cx-4,H*0.35,cw+8,8);
        // Torch bracket on front face of column
        const tx=cx+cw*0.5, ty=tgy;
        ctx.fillStyle='#3a2a18'; ctx.fillRect(tx-3,ty,6,12); // bracket stem
        ctx.fillStyle='#4a3520'; ctx.fillRect(tx-6,ty-3,12,6); // bracket crossbar
        // Torch bowl
        ctx.fillStyle='#2a1e10'; ctx.beginPath();
        ctx.moveTo(tx-5,ty-3); ctx.lineTo(tx+5,ty-3); ctx.lineTo(tx+3,ty+2); ctx.lineTo(tx-3,ty+2); ctx.closePath(); ctx.fill();
        // Fire flames (layered for depth)
        ctx.save();
        const f1h=(14+Math.sin(t*8.1+i*2.3)*5)*flicker;
        const f2h=(10+Math.sin(t*9.7+i*1.1+1)*4)*flicker;
        const f3h=(7+Math.sin(t*11.3+i*3.1+2)*3)*flicker;
        // Outer flame (orange)
        const fg1=ctx.createRadialGradient(tx,ty-f1h*0.5,0,tx,ty-f1h*0.5,f1h*0.8);
        fg1.addColorStop(0,`rgba(255,200,60,${0.9*flicker})`);
        fg1.addColorStop(0.5,`rgba(255,100,10,${0.7*flicker})`);
        fg1.addColorStop(1,'rgba(200,40,0,0)');
        ctx.fillStyle=fg1;
        ctx.beginPath(); ctx.ellipse(tx,ty-f1h*0.5,f1h*0.45,f1h*0.9,Math.sin(t*6+i)*0.12,0,Math.PI*2); ctx.fill();
        // Mid flame (yellow)
        const fg2=ctx.createRadialGradient(tx,ty-f2h*0.6,0,tx,ty-f2h*0.6,f2h*0.6);
        fg2.addColorStop(0,`rgba(255,240,120,${0.95*flicker})`);
        fg2.addColorStop(0.6,`rgba(255,160,20,${0.6*flicker})`);
        fg2.addColorStop(1,'rgba(255,80,0,0)');
        ctx.fillStyle=fg2;
        ctx.beginPath(); ctx.ellipse(tx,ty-f2h*0.6,f2h*0.3,f2h*0.8,Math.sin(t*9+i+0.5)*0.15,0,Math.PI*2); ctx.fill();
        // Core (white-hot)
        const fg3=ctx.createRadialGradient(tx,ty-f3h*0.4,0,tx,ty-f3h*0.4,f3h*0.35);
        fg3.addColorStop(0,`rgba(255,255,200,${flicker})`);
        fg3.addColorStop(1,'rgba(255,200,80,0)');
        ctx.fillStyle=fg3;
        ctx.beginPath(); ctx.ellipse(tx,ty-f3h*0.4,f3h*0.18,f3h*0.55,0,0,Math.PI*2); ctx.fill();
        // Ember sparks rising
        for(let s=0;s<3;s++){
          const sa=((t*40+i*17+s*7)%1);
          const sx2=tx+(Math.sin(i*3+s*2.1+t*1.2))*8;
          const sy2=ty-sa*28;
          const salpha=Math.max(0,(1-sa)*0.8*flicker);
          ctx.fillStyle=`rgba(255,180,40,${salpha})`;
          ctx.beginPath(); ctx.arc(sx2,sy2,1.2*(1-sa*0.5),0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }
      // Stalactites (top of screen)
      for(let i=0;i<20;i++){
        const sx=60+i*190+Math.sin(i*1.3)*30;
        const sl=H*0.08+Math.sin(i*0.7)*H*0.06;
        const drip=Math.sin(t*1.2+i)*3;
        ctx.fillStyle='#1e1814';
        ctx.beginPath();
        ctx.moveTo(sx-12,0); ctx.lineTo(sx+12,0);
        ctx.lineTo(sx+5,sl+drip); ctx.lineTo(sx,sl+drip+8);
        ctx.lineTo(sx-5,sl+drip); ctx.closePath(); ctx.fill();
        // Drip drop
        ctx.save(); ctx.shadowColor='rgba(100,80,60,0.4)'; ctx.shadowBlur=4;
        ctx.fillStyle=`rgba(100,80,60,${0.3+Math.sin(t*1.5+i)*0.2})`;
        ctx.beginPath(); ctx.arc(sx,sl+drip+12,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.restore(); // end Moria parallax
    } else if (def === LEVEL_DEFS[2]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Lothlórien: golden trees + silver stream + floating motes
      // Silver stream on ground
      ctx.save(); ctx.shadowColor='rgba(200,220,255,0.4)'; ctx.shadowBlur=8;
      const sg=ctx.createLinearGradient(0,H*0.6,W*2,H*0.6);
      sg.addColorStop(0,'rgba(180,220,240,0.12)'); sg.addColorStop(0.5,'rgba(200,230,255,0.22)'); sg.addColorStop(1,'rgba(180,220,240,0.1)');
      ctx.strokeStyle=sg; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(0,H*0.62);
      for(let i=0;i<8;i++) ctx.bezierCurveTo(i*280+70,H*0.6+Math.sin(t*0.5+i)*8,i*280+150,H*0.62+Math.cos(t*0.4+i)*6,(i+1)*280,H*0.62);
      ctx.stroke(); ctx.restore();
      // Golden trees
      [80,320,580,840,1100,1360,1620,1880].forEach((tx,i)=>{
        // Trunk
        const tg=ctx.createLinearGradient(tx,H*0.35,tx+14,H*0.35);
        tg.addColorStop(0,'#5a4020'); tg.addColorStop(1,'#3a2810');
        ctx.fillStyle=tg; ctx.fillRect(tx,H*0.38,14,H*0.25);
        // Canopy layers
        [0,1,2].forEach(tier=>{
          const cr=38-tier*8, cy=H*0.38-tier*30;
          const cg=ctx.createRadialGradient(tx+7,cy,0,tx+7,cy,cr);
          cg.addColorStop(0,`rgba(180,200,80,${0.7-tier*0.1})`);
          cg.addColorStop(0.6,`rgba(120,160,40,0.55)`);
          cg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(tx+7,cy,cr,0,Math.PI*2); ctx.fill();
          // Shimmer
          ctx.save(); ctx.globalAlpha=0.1+Math.sin(t*0.9+i+tier)*0.07;
          ctx.fillStyle='rgba(255,255,160,1)';
          ctx.beginPath(); ctx.arc(tx+cr*0.35,cy-cr*0.25,cr*0.22,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
      });
      // Floating silver motes
      for(let i=0;i<14;i++){
        const mx=((t*18+i*140)%(W*2)), my=H*0.3+Math.sin(t*0.6+i)*H*0.25-((t*8+i*20)%H*0.4);
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,6);
        mg.addColorStop(0,`rgba(220,240,255,${0.5+Math.sin(t*1.2+i)*0.25})`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-6,my-6,12,12);
      }
      ctx.restore(); // end Lothlórien parallax
    } else if (def === LEVEL_DEFS[3]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Dead Marshes: eerie lights + face glimmers beneath the water
      for(let i=0;i<10;i++){
        const mx=80+i*185, my=H*0.6+Math.sin(t*0.6+i)*6;
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,22);
        mg.addColorStop(0,`rgba(100,180,80,${0.14+Math.sin(t+i)*0.07})`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-22,my-22,44,44);
        // Dead face glimmer (one per 3 lights)
        if(i%3===0){
          ctx.save(); ctx.globalAlpha=Math.max(0,0.18+Math.sin(t*0.9+i*2.1)*0.14);
          ctx.fillStyle='rgba(180,200,160,0.6)';
          ctx.beginPath(); ctx.ellipse(mx,my+6,8,6,0,0,Math.PI*2); ctx.fill();
          // Eyes
          ctx.fillStyle='rgba(120,180,100,0.7)';
          ctx.beginPath(); ctx.arc(mx-3,my+5,2,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx+3,my+5,2,0,Math.PI*2); ctx.fill();
          ctx.restore();
        }
      }
      // Fog wisps on water surface
      for(let i=0;i<7;i++){
        const fx=40+i*265, fy=H*0.58+Math.sin(t*0.5+i)*5;
        const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,40);
        fg.addColorStop(0,`rgba(80,120,60,${0.08+Math.sin(t*0.7+i)*0.04})`);
        fg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=fg; ctx.fillRect(fx-40,fy-15,80,25);
      }
      ctx.restore(); // end Dead Marshes parallax
    } else if (def === LEVEL_DEFS[4]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Black Gate: multi-layered fortress, lava rivers, orc army silhouettes
      // Far background: volcanic sky glow (screen-space)
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      const skyGlow=ctx.createLinearGradient(0,0,0,H*0.5);
      skyGlow.addColorStop(0,'rgba(0,0,0,0)');
      skyGlow.addColorStop(0.7,`rgba(180,40,0,${0.12+Math.sin(t*0.4)*0.04})`);
      skyGlow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=skyGlow; ctx.fillRect(0,0,W,H*0.5);
      ctx.restore(); // back to parallax

      // Ground dust clouds
      for(let i=0;i<8;i++){
        const dx=60+i*240+Math.sin(t*0.4+i)*30, dy=H*0.56;
        const dg=ctx.createRadialGradient(dx,dy,0,dx,dy,30);
        dg.addColorStop(0,`rgba(60,30,10,${0.08+Math.sin(t*0.6+i)*0.04})`);
        dg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=dg; ctx.fillRect(dx-30,dy-12,60,20);
      }
      // Orc army silhouettes marching (far background)
      for(let i=0;i<24;i++){
        const ox=i*85+((t*18)%85), oy=H*0.50+Math.sin(i*0.7)*4;
        ctx.fillStyle='rgba(10,5,3,0.55)';
        // Body
        ctx.beginPath(); ctx.ellipse(ox,oy,4,7,0,0,Math.PI*2); ctx.fill();
        // Head
        ctx.beginPath(); ctx.arc(ox,oy-9,3.5,0,Math.PI*2); ctx.fill();
        // Spear
        ctx.strokeStyle='rgba(10,5,3,0.45)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(ox+3,oy-14); ctx.lineTo(ox+3,oy+6); ctx.stroke();
      }
      // Battlements (deeper parallax)
      ctx.save(); ctx.translate(-cameraX*(0.2-0.45), 0);
      const battleH = H*0.28;
      // Second wall layer (farther back, lighter)
      ctx.fillStyle='#120a06';
      for(let i=0;i<7;i++){
        const bx=i*290-60;
        ctx.fillRect(bx,battleH+H*0.05,240,H*0.18);
        for(let j=0;j<6;j++) ctx.fillRect(bx+j*36,battleH+H*0.05-18,22,18);
      }
      // Main front wall
      ctx.fillStyle='#1a0c08';
      for(let i=0;i<6;i++){
        const bx=i*320-80;
        ctx.fillRect(bx,battleH,280,H*0.22);
        // Battlements top
        for(let j=0;j<7;j++) ctx.fillRect(bx+j*38,battleH-24,24,24);
        // Lava rivers down wall face
        ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=6;
        const lv=ctx.createLinearGradient(bx+120,battleH,bx+120,battleH+H*0.12);
        lv.addColorStop(0,`rgba(255,80,0,${0.35+Math.sin(t*1.5+i)*0.12})`);
        lv.addColorStop(1,'rgba(200,40,0,0.1)');
        ctx.fillStyle=lv; ctx.fillRect(bx+115,battleH,10,H*0.12);
        ctx.restore();
        // Arrow slits with red glow
        ctx.save(); ctx.shadowColor='#cc2200'; ctx.shadowBlur=4;
        ctx.fillStyle=`rgba(200,60,0,${0.4+Math.sin(t*1.2+i)*0.1})`;
        for(let j=0;j<3;j++) ctx.fillRect(bx+50+j*80,battleH+14,6,18);
        ctx.restore();
      }
      ctx.restore();
      // Forge fires with smoke
      for(let i=0;i<8;i++){
        const fx=100+i*248;
        ctx.fillStyle='#1a0c08'; ctx.fillRect(fx,H*0.33,14,H*0.18);
        // Smoke column
        for(let s=0;s<5;s++){
          const sy=H*0.33-s*22, sw=6+s*4;
          const sg=ctx.createRadialGradient(fx+7+Math.sin(t*0.5+i+s)*8,sy,0,fx+7,sy,sw);
          sg.addColorStop(0,`rgba(40,30,25,${0.15-s*0.025})`);
          sg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=sg; ctx.fillRect(fx+7-sw,sy-sw,sw*2,sw*2);
        }
        // Fire glow at top
        const fg=ctx.createRadialGradient(fx+7,H*0.33,0,fx+7,H*0.33,32);
        fg.addColorStop(0,`rgba(255,130,0,${0.5+Math.sin(t*2.5+i)*0.18})`);
        fg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=fg; ctx.fillRect(fx-18,H*0.14,50,H*0.22);
      }
      ctx.restore(); // end Black Gate parallax
    } else if (def === LEVEL_DEFS[5]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Shelob's Lair: webs + bioluminescence (pure darkness handled by torch overlay)
      // Web strands
      ctx.save(); ctx.globalAlpha=0.2; ctx.strokeStyle='rgba(220,220,200,0.7)'; ctx.lineWidth=1;
      for(let i=0;i<16;i++){
        const wx=i*120, wy=0;
        ctx.beginPath();
        ctx.moveTo(wx,0); ctx.bezierCurveTo(wx+60,H*0.08+Math.sin(i)*H*0.04,wx+80,H*0.12,wx+160,H*0.05+Math.cos(i)*H*0.03);
        ctx.stroke();
        // Radial strands
        for(let j=0;j<5;j++){
          const a=(j/5)*Math.PI;
          ctx.beginPath(); ctx.moveTo(wx+60,H*0.08);
          ctx.lineTo(wx+60+Math.cos(a)*80, H*0.08+Math.sin(a)*70); ctx.stroke();
        }
      }
      ctx.restore();
      // Bioluminescent patches
      for(let i=0;i<8;i++){
        const bx=60+i*220, by=H*0.55+Math.sin(i*1.7)*H*0.1;
        const bg=ctx.createRadialGradient(bx,by,0,bx,by,22);
        bg.addColorStop(0,`rgba(80,180,60,${0.15+Math.sin(t*0.8+i)*0.07})`);
        bg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=bg; ctx.fillRect(bx-22,by-22,44,44);
      }
      ctx.restore(); // end Shelob parallax
    } else if (def === LEVEL_DEFS[6]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Minas Morgul: undead city, corrupted green sky, wights drifting
      // Ground-level green mist
      for(let i=0;i<12;i++){
        const mx=i*165+Math.sin(t*0.3+i)*30, my=H*0.56;
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,55);
        mg.addColorStop(0,`rgba(20,120,40,${0.12+Math.sin(t*0.5+i)*0.05})`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-55,my-20,110,35);
      }
      // City walls (deeper parallax)
      ctx.save(); ctx.translate(-cameraX*(0.2-0.45), 0);
      for(let i=0;i<5;i++){
        const cx=i*400-100, cw=200;
        // Wall gradient
        const wg=ctx.createLinearGradient(cx,H*0.28,cx,H*0.55);
        wg.addColorStop(0,'#08140a'); wg.addColorStop(1,'#040c06');
        ctx.fillStyle=wg;
        ctx.fillRect(cx,H*0.28,cw,H*0.27);
        // Crenellations
        for(let j=0;j<8;j++) ctx.fillRect(cx+j*24,H*0.28-16,16,16);
        // Tall spires
        [cx-12, cx+cw-14].forEach((sx,si)=>{
          ctx.fillStyle='#050e06';
          ctx.fillRect(sx,H*0.14+si*H*0.03,26,H*0.37);
          // Spire tip
          ctx.beginPath(); ctx.moveTo(sx,H*0.14+si*H*0.03); ctx.lineTo(sx+13,H*0.06+si*H*0.03); ctx.lineTo(sx+26,H*0.14+si*H*0.03); ctx.closePath(); ctx.fill();
          // Spire glow
          ctx.save(); ctx.shadowColor='#40ff80'; ctx.shadowBlur=8;
          ctx.fillStyle=`rgba(40,200,80,${0.4+Math.sin(t*1.2+i+si)*0.2})`;
          ctx.beginPath(); ctx.arc(sx+13,H*0.06+si*H*0.03,3,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });
        // Green-lit windows
        for(let j=0;j<6;j++){
          const wx=cx+18+j*28, wy=H*0.34+Math.floor(j/3)*22;
          ctx.save(); ctx.shadowColor='#40ff80'; ctx.shadowBlur=8;
          ctx.fillStyle=`rgba(40,200,80,${0.4+Math.sin(t*1.5+i+j)*0.2})`;
          ctx.fillRect(wx,wy,7,12); ctx.restore();
        }
        // Morgul beacon
        if(i===2){
          ctx.save(); ctx.shadowColor='#40ff80'; ctx.shadowBlur=20;
          const bAlpha=0.2+Math.sin(t*0.5)*0.1;
          const bg=ctx.createLinearGradient(cx+cw*0.5,H*0.1,cx+cw*0.5+W*0.4,0);
          bg.addColorStop(0,`rgba(40,200,80,${bAlpha})`); bg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=bg;
          ctx.beginPath(); ctx.moveTo(cx+cw*0.5,H*0.1); ctx.lineTo(cx+cw*0.5+40,0); ctx.lineTo(cx+cw*0.5+W*0.45,0); ctx.lineTo(cx+cw*0.5+W*0.28,H*0.1); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore(); // end city parallax sub-save
      // Constant green glow (screen-space)
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      const gg=ctx.createRadialGradient(W*0.6,H*0.4,0,W*0.6,H*0.4,W*0.75);
      gg.addColorStop(0,`rgba(40,200,80,${0.20+Math.sin(t*0.8)*0.06})`);
      gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);
      ctx.restore(); // end green glow
      ctx.restore(); // end Morgul parallax
    } else if (def === LEVEL_DEFS[7]) {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Pelennor: massive war -- army clash, oliphaunts silhouette, fires everywhere
      // War glow on horizon (screen-space)
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      const warGlow=ctx.createLinearGradient(0,H*0.35,0,H*0.55);
      warGlow.addColorStop(0,'rgba(0,0,0,0)');
      warGlow.addColorStop(0.5,`rgba(200,80,0,${0.10+Math.sin(t*0.3)*0.04})`);
      warGlow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=warGlow; ctx.fillRect(0,0,W,H);
      ctx.restore(); // back to parallax transform

      // Distant infantry lines (far background)
      ctx.save(); ctx.translate(-cameraX*(0.08-0.45), 0);
      for(let row=0;row<3;row++){
        for(let i=0;i<40;i++){
          const ix=i*48+row*16, iy=H*0.46+row*8;
          ctx.fillStyle=`rgba(8,4,2,${0.4-row*0.1})`;
          ctx.fillRect(ix,iy-10,3,12); // body
          ctx.beginPath(); ctx.arc(ix+1.5,iy-12,2.5,0,Math.PI*2); ctx.fill(); // head
        }
      }
      // Oliphaunt silhouette (one huge beast in background)
      ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#100606';
      const ox2=W*0.55, oy2=H*0.41;
      ctx.beginPath(); ctx.ellipse(ox2,oy2,55,30,0,0,Math.PI*2); ctx.fill(); // body
      ctx.beginPath(); ctx.ellipse(ox2+65,oy2-5,18,22,0.3,0,Math.PI*2); ctx.fill(); // head
      ctx.strokeStyle='#100606'; ctx.lineWidth=8; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(ox2+72,oy2+8); ctx.quadraticCurveTo(ox2+85,oy2+30,ox2+78,oy2+45); ctx.stroke(); // trunk
      [-35,-15,15,35].forEach(lx=>{ // legs
        ctx.beginPath(); ctx.moveTo(ox2+lx,oy2+25); ctx.lineTo(ox2+lx,oy2+50); ctx.stroke();
      });
      ctx.restore(); // end oliphaunt save
      ctx.restore(); // end infantry save

      // Distant battle fires
      ctx.save(); ctx.translate(-cameraX*(0.15-0.45), 0);
      for(let i=0;i<18;i++){
        const fx=50+i*110, fy=H*0.47+Math.sin(i*1.3)*H*0.04;
        const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,16+Math.sin(t*2+i)*5);
        fg.addColorStop(0,`rgba(255,110,0,${0.35+Math.sin(t*2+i)*0.14})`);
        fg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=fg; ctx.fillRect(fx-20,fy-20,40,38);
      }
      // Siege engines (catapults)
      [200,550,980,1400].forEach(sx=>{
        ctx.fillStyle='#1a0a08';
        ctx.save(); ctx.translate(sx,H*0.49);
        ctx.rotate(-0.6+Math.sin(t*0.3+sx*0.003)*0.15);
        ctx.fillRect(-3,-35,6,40); ctx.fillRect(-12,-3,24,6);
        ctx.restore();
        ctx.fillStyle='#120806'; ctx.fillRect(sx-18,H*0.49,36,12);
        ctx.strokeStyle='#1a0e0a'; ctx.lineWidth=3;
        [-10,10].forEach(lx=>{ ctx.beginPath(); ctx.arc(sx+lx,H*0.51,6,0,Math.PI*2); ctx.stroke(); });
      });
      ctx.restore();
      // Ground smoke
      for(let i=0;i<12;i++){
        const sx=80+i*165, sy=H*0.56+Math.sin(t*0.6+i)*8;
        const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,42);
        sg.addColorStop(0,`rgba(55,45,40,${0.14+Math.sin(t*0.4+i)*0.05})`);
        sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=sg; ctx.fillRect(sx-42,sy-18,84,30);
      }
      ctx.restore(); // end Pelennor parallax
    } else {
      ctx.save(); ctx.translate(-cameraX*0.45, 0);
      // Mount Doom: ash rain + intensifying doom glow
      // Restore parallax before screen-space drawing
      ctx.restore(); // end Doom parallax (nothing to draw in world-space here)
      if(prog>0.2){
        ctx.save(); ctx.globalAlpha=prog*0.3;
        for(let i=0;i<15;i++){
          const ax=((t*22+i*130)%W), ay=((t*35+i*60)%H);
          ctx.fillStyle=`rgba(80,60,50,${0.3+Math.sin(t+i)*0.15})`;
          ctx.beginPath(); ctx.arc(ax,ay,1.5,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
      }
      // Doom glow — intensifies with progress
      const g2=ctx.createRadialGradient(W*0.7,H*0.15,0,W*0.7,H*0.15,350+prog*200);
      g2.addColorStop(0,`rgba(255,80,0,${prog*0.38})`);
      g2.addColorStop(0.5,`rgba(200,30,0,${prog*0.18})`);
      g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
      // Lava eruption flashes near summit (progress > 0.8)
      if(prog>0.8&&Math.random()<0.04){
        ctx.fillStyle=`rgba(255,150,0,${(prog-0.8)*0.6})`; ctx.fillRect(0,0,W,H);
      }
      return;
    }
    // (each branch manages its own save/restore)
  }

  // ── GOLLUM ────────────────────────────────────────────────────────────
  function drawGollum(ctx,g,eye,frodo) {
    ctx.save(); ctx.translate(g.x,g.y);
    const ea = eye&&eye.phase==='active';
    const t  = g.capePhase;
    const r  = g.r;
    const isJumping = g.phase === 'jump';
    const isDarting = g.phase === 'dart';
    // Jump: body elongates vertically
    const stretchY = isJumping ? (0.5 + Math.sin(Math.min(1, g.jumpTimer/g.jumpDuration)*Math.PI)*0.5) : 0;
    const scaleY   = 1 + stretchY*0.4;
    const scaleX   = 1 - stretchY*0.15;
    if (isJumping) ctx.scale(scaleX, scaleY);
    // Dart: body leans forward (rotate slightly in movement direction)
    if (isDarting) {
      const leanDir = frodo && g.x < frodo.x ? 1 : -1;
      ctx.rotate(leanDir * 0.32); // lean 18° forward
    }

    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.18;
    const sg=ctx.createRadialGradient(0,r*1.2,0,0,r*1.2,r*2);
    sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,r*1.2,r*1.5,r*0.3,0,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Eerie glow (green when lurking, yellow when darting)
    const glowCol = ea ? 'rgba(180,255,60,0.25)' : g.phase==='dart' ? 'rgba(255,220,50,0.2)' : 'rgba(60,120,20,0.18)';
    const gg=ctx.createRadialGradient(0,0,0,0,0,r*4);
    gg.addColorStop(0,glowCol); gg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gg; ctx.fillRect(-r*4,-r*4,r*8,r*8);

    // Crouched torso — lean forward, hunched
    ctx.fillStyle='#252510';
    ctx.beginPath();
    ctx.moveTo(-r*0.5,-r*0.3);
    ctx.bezierCurveTo(-r*0.8,r*0.2, -r*0.7,r*0.9, -r*0.3,r*1.1);
    ctx.lineTo(r*0.3,r*1.1);
    ctx.bezierCurveTo(r*0.7,r*0.9, r*0.8,r*0.2, r*0.5,-r*0.3);
    ctx.closePath(); ctx.fill();

    // Loincloth rags
    ctx.fillStyle='#1a1808';
    ctx.beginPath();
    ctx.moveTo(-r*0.4,r*0.5);
    ctx.lineTo(-r*0.65,r*1.15); ctx.lineTo(-r*0.15,r*0.9);
    ctx.lineTo(r*0.15,r*0.9); ctx.lineTo(r*0.65,r*1.15);
    ctx.lineTo(r*0.4,r*0.5); ctx.closePath(); ctx.fill();

    // Long spindly arms reaching forward
    const armBob = Math.sin(t*1.4)*r*0.15;
    ctx.strokeStyle='#252510'; ctx.lineWidth=r*0.28;
    ctx.lineCap='round';
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-r*0.4,r*0.1);
    ctx.bezierCurveTo(-r*1.0,r*0.4+armBob, -r*1.4,r*0.2+armBob, -r*1.5,r*0.7+armBob);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(r*0.4,r*0.1);
    ctx.bezierCurveTo(r*1.0,r*0.4-armBob, r*1.4,r*0.2-armBob, r*1.5,r*0.7-armBob);
    ctx.stroke();
    // Clawed fingers (left)
    ctx.strokeStyle='#353520'; ctx.lineWidth=r*0.12;
    [-r*0.15, 0, r*0.15].forEach((ox,i)=>{
      ctx.beginPath();
      ctx.moveTo(-r*1.5+ox, r*0.7+armBob);
      ctx.lineTo(-r*1.6+ox*1.2, r*1.05+armBob+i*r*0.05); ctx.stroke();
    });
    // Clawed fingers (right)
    [-r*0.15, 0, r*0.15].forEach((ox,i)=>{
      ctx.beginPath();
      ctx.moveTo(r*1.5+ox, r*0.7-armBob);
      ctx.lineTo(r*1.6+ox*1.2, r*1.05-armBob+i*r*0.05); ctx.stroke();
    });

    // Feet — flat, clawed
    ctx.fillStyle='#202010';
    ctx.beginPath(); ctx.ellipse(-r*0.25,r*1.15,r*0.38,r*0.18,-0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.25,r*1.15,r*0.38,r*0.18,0.2,0,Math.PI*2); ctx.fill();

    // Oversized head — bald, gaunt
    const headSkin = ea ? '#3a3820' : '#2e2c18';
    ctx.fillStyle=headSkin;
    ctx.beginPath(); ctx.ellipse(0,-r*0.95,r*0.88,r*0.82,0,0,Math.PI*2); ctx.fill();

    // Skull definition — cheekbones
    ctx.save(); ctx.globalAlpha=0.25;
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(-r*0.38,-r*0.82,r*0.22,r*0.12,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.38,-r*0.82,r*0.22,r*0.12,-0.3,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Sunken nose
    ctx.fillStyle='#1a1808';
    ctx.beginPath(); ctx.ellipse(0,-r*0.88,r*0.1,r*0.07,0,0,Math.PI*2); ctx.fill();

    // Thin slash mouth — slightly open, showing teeth
    ctx.strokeStyle='#0e0c06'; ctx.lineWidth=r*0.1;
    ctx.beginPath(); ctx.moveTo(-r*0.28,-r*0.72); ctx.quadraticCurveTo(0,-r*0.68,r*0.28,-r*0.72); ctx.stroke();
    // Teeth peaking
    ctx.fillStyle='rgba(220,210,180,0.6)';
    [-r*0.12,0,r*0.12].forEach(tx=>{
      ctx.beginPath(); ctx.rect(tx-r*0.04,-r*0.73,r*0.07,r*0.06); ctx.fill();
    });

    // Large pale eyes with ring-hunger gleam
    const eyeSize = r*0.28 + (ea ? r*0.08 : 0);
    // Eye whites (sunken sockets)
    ctx.save();
    ctx.fillStyle='#0a0a06';
    ctx.beginPath(); ctx.ellipse(-r*0.3,-r*1.02,r*0.32,r*0.26,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3,-r*1.02,r*0.32,r*0.26,0,0,Math.PI*2); ctx.fill();
    // Iris — pale yellow-green
    ctx.shadowColor=ea?'#ccff30':'#88dd10'; ctx.shadowBlur=ea?12:6;
    ctx.fillStyle=ea?'#ccff40':'#90e020';
    ctx.beginPath(); ctx.ellipse(-r*0.3,-r*1.02,eyeSize,eyeSize*1.15,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3,-r*1.02,eyeSize,eyeSize*1.15,0,0,Math.PI*2); ctx.fill();
    // Pupils — slit like a cat
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(-r*0.3,-r*1.02,eyeSize*0.25,eyeSize*1.0,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3,-r*1.02,eyeSize*0.25,eyeSize*1.0,0,0,Math.PI*2); ctx.fill();
    // Eye shine
    ctx.fillStyle='rgba(255,255,220,0.7)';
    ctx.beginPath(); ctx.arc(-r*0.25,-r*1.07,eyeSize*0.18,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.35,-r*1.07,eyeSize*0.18,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Wispy thin hair strands
    ctx.save(); ctx.globalAlpha=0.3; ctx.strokeStyle='#3a3820'; ctx.lineWidth=1;
    [-r*0.5,-r*0.2,r*0.1,r*0.4].forEach((hx,i)=>{
      ctx.beginPath();
      ctx.moveTo(hx,-r*1.6+i*r*0.04);
      ctx.quadraticCurveTo(hx+r*0.1*Math.sin(t+i),-r*1.3,hx+r*0.15*Math.sin(t*1.2+i),-r*1.05);
      ctx.stroke();
    });
    ctx.restore();

    ctx.restore();
  }

  // ── BALROG ─────────────────────────────────────────────────────────────
  function drawBalrog(ctx, b, H) {
    ctx.save(); ctx.translate(b.x, b.y);
    const t = b.firePhase;
    const r = b.r;
    // Aura glow
    const ag=ctx.createRadialGradient(0,0,0,0,0,r*5);
    ag.addColorStop(0,'rgba(255,80,0,0.45)'); ag.addColorStop(0.4,'rgba(200,40,0,0.2)'); ag.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ag; ctx.fillRect(-r*5,-r*4,r*10,r*9);
    // Shadow mass body
    const flapA = Math.sin(t*1.2)*0.18;
    // Wings
    ['left','right'].forEach((side,si)=>{
      const sign=si===0?-1:1;
      ctx.fillStyle='#0a0006';
      ctx.beginPath();
      ctx.moveTo(sign*r*0.5,-r*0.5);
      ctx.bezierCurveTo(sign*r*2,-r*(1.8+flapA),sign*r*3.5,-r*(0.6+flapA),sign*r*3.2,r*(0.8-flapA));
      ctx.bezierCurveTo(sign*r*2.5,r*1.0,sign*r*1.5,r*0.4,sign*r*0.5,r*0.4);
      ctx.closePath(); ctx.fill();
      // Fire rim on wings
      ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=12;
      ctx.strokeStyle=`rgba(255,${80+Math.floor(Math.sin(t*2+si)*40)},0,0.5)`; ctx.lineWidth=2.5;
      ctx.beginPath();
      ctx.moveTo(sign*r*0.5,-r*0.5);
      ctx.bezierCurveTo(sign*r*2,-r*(1.8+flapA),sign*r*3.5,-r*(0.6+flapA),sign*r*3.2,r*(0.8-flapA));
      ctx.stroke(); ctx.restore();
    });
    // Body
    const bg=ctx.createLinearGradient(-r*0.8,0,r*0.8,0);
    bg.addColorStop(0,'#1a0206'); bg.addColorStop(0.5,'#2e0408'); bg.addColorStop(1,'#1a0206');
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.ellipse(0,0,r*0.85,r*1.1,0,0,Math.PI*2); ctx.fill();
    // Lava cracks on body
    ctx.save(); ctx.shadowColor='#ff5500'; ctx.shadowBlur=8;
    ctx.strokeStyle=`rgba(255,100,0,${0.6+Math.sin(t*3)*0.2})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.8); ctx.bezierCurveTo(-r*0.6,-r*0.3,-r*0.4,r*0.4,-r*0.5,r*0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.2,-r*0.6); ctx.bezierCurveTo(r*0.5,-r*0.2,r*0.3,r*0.5,r*0.4,r*0.9); ctx.stroke();
    ctx.restore();
    // Head with horns
    ctx.fillStyle='#1e0408';
    ctx.beginPath(); ctx.ellipse(0,-r*1.3,r*0.65,r*0.62,0,0,Math.PI*2); ctx.fill();
    // Horns
    ctx.fillStyle='#120206';
    [[-1,1],[1,1]].forEach(([sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(sx*r*0.4,-r*1.7); ctx.lineTo(sx*r*0.6,-r*2.3); ctx.lineTo(sx*r*0.2,-r*2.5);
      ctx.closePath(); ctx.fill();
    });
    // Eyes
    ctx.save(); ctx.shadowColor='#ffcc00'; ctx.shadowBlur=14;
    ctx.fillStyle='#ffcc00';
    [-r*0.25,r*0.25].forEach(ex=>{
      ctx.beginPath(); ctx.ellipse(ex,-r*1.3,r*0.16,r*0.14,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,200,0,0.5)'; ctx.beginPath(); ctx.ellipse(ex,-r*1.3,r*0.25,r*0.22,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffcc00';
    }); ctx.restore();
    // Fiery whip
    ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=10;
    ctx.strokeStyle=`rgba(255,${100+Math.floor(Math.sin(t*4)*50)},0,0.8)`; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(r*0.6,-r*0.2);
    ctx.bezierCurveTo(r*1.5,r*0.3+Math.sin(t*3)*r*0.3, r*2.8,r*0.1+Math.sin(t*2.5)*r*0.4, r*3.5,r*(0.8+Math.sin(t*4)*0.3));
    ctx.stroke();
    ctx.lineWidth=1.5; ctx.strokeStyle='rgba(255,200,50,0.5)';
    ctx.beginPath();
    ctx.moveTo(r*0.6,-r*0.2);
    ctx.bezierCurveTo(r*1.5,r*0.3+Math.sin(t*3)*r*0.3, r*2.8,r*0.1+Math.sin(t*2.5)*r*0.4, r*3.5,r*(0.8+Math.sin(t*4)*0.3));
    ctx.stroke(); ctx.restore();
    ctx.restore();
  }

  // ── SHELOB ─────────────────────────────────────────────────────────────
  function drawShelob(ctx, s, eye) {
    ctx.save(); ctx.translate(s.x, s.y);
    const t = s.firePhase;
    const r = s.r;
    const ea = eye&&eye.phase==='active';
    // Eerie aura
    const ag=ctx.createRadialGradient(0,0,0,0,0,r*3.5);
    ag.addColorStop(0,`rgba(80,0,100,${0.25+ea*0.1})`); ag.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ag; ctx.fillRect(-r*3.5,-r*3.5,r*7,r*7);
    // 8 legs
    ctx.strokeStyle='#1a0820'; ctx.lineWidth=r*0.22; ctx.lineCap='round';
    for(let i=0;i<8;i++){
      const sign = i<4?-1:1;
      const j = i<4?i:i-4;
      const baseA = sign*(0.3+j*0.35);
      const legBob = Math.sin(t*2+i)*r*0.15;
      ctx.beginPath();
      ctx.moveTo(sign*r*0.6,r*0.2*(j-1.5));
      ctx.bezierCurveTo(
        sign*(r*1.5+legBob), r*(-0.3+j*0.4)+legBob,
        sign*(r*2.4+legBob*0.5), r*(0.1+j*0.5)+legBob,
        sign*r*3.0, r*(-0.5+j*0.8)+legBob
      );
      ctx.stroke();
    }
    // Egg-sac abdomen
    const ag2=ctx.createRadialGradient(-r*0.2,r*0.5,0,-r*0.2,r*0.5,r*1.2);
    ag2.addColorStop(0,'#3a1840'); ag2.addColorStop(0.6,'#1e0c24'); ag2.addColorStop(1,'#0a0410');
    ctx.fillStyle=ag2;
    ctx.beginPath(); ctx.ellipse(-r*0.2,r*0.5,r*1.0,r*1.1,0.2,0,Math.PI*2); ctx.fill();
    // Body
    const bg=ctx.createRadialGradient(0,-r*0.1,0,0,-r*0.1,r*0.8);
    bg.addColorStop(0,'#2e1035'); bg.addColorStop(1,'#160818');
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.ellipse(0,-r*0.1,r*0.75,r*0.72,0,0,Math.PI*2); ctx.fill();
    // Hourglass marking
    ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#ff0020';
    ctx.beginPath(); ctx.moveTo(-r*0.18,-r*0.4); ctx.lineTo(r*0.18,-r*0.4); ctx.lineTo(0,-r*0.1); ctx.lineTo(r*0.18,r*0.25); ctx.lineTo(-r*0.18,r*0.25); ctx.lineTo(0,-r*0.1); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Eye cluster
    ctx.save(); ctx.shadowColor='#ff2020'; ctx.shadowBlur=6+ea*6;
    const eyePositions=[[-r*0.2,-r*0.65],[r*0.2,-r*0.65],[-r*0.38,-r*0.45],[r*0.38,-r*0.45],[0,-r*0.8],[-r*0.12,-r*0.38],[r*0.12,-r*0.38],[0,-r*0.55]];
    eyePositions.forEach(([ex,ey])=>{
      ctx.fillStyle=ea?'#ff4040':'#cc1010';
      ctx.beginPath(); ctx.arc(ex,ey,r*0.07,0,Math.PI*2); ctx.fill();
    }); ctx.restore();
    // Web trailing upward
    ctx.save(); ctx.globalAlpha=0.3; ctx.strokeStyle='rgba(220,210,200,0.6)'; ctx.lineWidth=1;
    for(let i=0;i<3;i++) {
      ctx.beginPath(); ctx.moveTo((i-1)*r*0.5,0); ctx.lineTo((i-1)*r*0.3,-r*6); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // ── CAVE TROLL ──────────────────────────────────────────────
  function drawCaveTroll(ctx, w, ea) {
    const r = w.r, t = w.capePhase, sense = w.sense || 0;
    // Ground shadow
    ctx.save(); ctx.globalAlpha = 0.2;
    const sg = ctx.createRadialGradient(0, r*1.6, 0, 0, r*1.6, r*2.5);
    sg.addColorStop(0, 'rgba(0,0,0,0.8)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, r*1.6, r*2, r*0.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Glow (greenish)
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r*3);
    gg.addColorStop(0, `rgba(${ea?'100,120,60':'60,80,40'},${0.15+sense*0.2})`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.fillRect(-r*3, -r*3, r*6, r*6);
    // Thick legs
    const stride = Math.sin(t * 2) * r * 0.12;
    ctx.fillStyle = '#3a3828';
    ctx.beginPath(); ctx.ellipse(-r*0.45, r*1.3+stride, r*0.4, r*0.7, 0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.45, r*1.3-stride, r*0.4, r*0.7, -0.1, 0, Math.PI*2); ctx.fill();
    // Huge rounded body
    const bg = ctx.createRadialGradient(0, r*0.1, 0, 0, r*0.1, r*1.3);
    bg.addColorStop(0, '#4a4a38'); bg.addColorStop(0.5, '#3a3a28'); bg.addColorStop(1, '#2a2a1e');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, r*0.1, r*1.1, r*1.2, 0, 0, Math.PI*2); ctx.fill();
    // Greenish tinge overlay
    ctx.save(); ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#406030';
    ctx.beginPath(); ctx.ellipse(0, r*0.1, r*1.0, r*1.1, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Arms
    const armBob = Math.sin(t * 2.5) * r * 0.1;
    ctx.strokeStyle = '#3a3828'; ctx.lineWidth = r*0.45; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.8, r*0.0); ctx.lineTo(-r*1.5, r*0.5+armBob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.8, r*0.0); ctx.lineTo(r*1.6, -r*0.3+armBob); ctx.stroke();
    // Club in right hand
    ctx.save(); ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#5a4a28'; ctx.lineWidth = r*0.3;
    ctx.beginPath(); ctx.moveTo(r*1.5, -r*0.3+armBob); ctx.lineTo(r*1.8, -r*1.4+armBob); ctx.stroke();
    // Club head
    ctx.fillStyle = '#6a5a38';
    ctx.beginPath(); ctx.ellipse(r*1.8, -r*1.6+armBob, r*0.45, r*0.35, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Small head
    ctx.fillStyle = '#4a4a38';
    ctx.beginPath(); ctx.ellipse(0, -r*1.15, r*0.5, r*0.45, 0, 0, Math.PI*2); ctx.fill();
    // Beady eyes
    ctx.save(); ctx.shadowColor = ea ? '#ff4400' : '#aa6600'; ctx.shadowBlur = 4+sense*4;
    ctx.fillStyle = ea ? '#ff5500' : '#cc8800';
    ctx.beginPath(); ctx.arc(-r*0.18, -r*1.18, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.18, -r*1.18, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Mouth
    ctx.strokeStyle = '#1a1a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -r*1.0, r*0.2, 0.2, Math.PI-0.2); ctx.stroke();
  }

  // ── MORGUL WIGHT ────────────────────────────────────────────
  function drawMorgulWight(ctx, w, ea) {
    const r = w.r, t = w.capePhase, sense = w.sense || 0;
    ctx.save(); ctx.globalAlpha = 0.65;
    // Blue-white glow
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r*4);
    gg.addColorStop(0, `rgba(${ea?'160,200,255':'100,140,200'},${0.3+sense*0.2})`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.fillRect(-r*4, -r*4, r*8, r*8);
    // Tattered robe
    const wave = Math.sin(t) * r * 0.3;
    ctx.fillStyle = ea ? '#3a4560' : '#2a3548';
    ctx.beginPath();
    ctx.moveTo(0, -r*0.8);
    ctx.bezierCurveTo(-r*1.3, -r*0.2+wave, -r*1.4, r*0.8+wave, -r*0.3, r*2.0);
    ctx.lineTo(r*0.3, r*2.0);
    ctx.bezierCurveTo(r*1.4, r*0.8-wave, r*1.3, -r*0.2-wave, 0, -r*0.8);
    ctx.fill();
    // Tattered edges
    ctx.strokeStyle = 'rgba(140,160,200,0.3)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const bx = -r*0.3 + i * r * 0.15;
      ctx.beginPath(); ctx.moveTo(bx, r*1.8); ctx.lineTo(bx + Math.sin(t+i)*r*0.15, r*2.3); ctx.stroke();
    }
    // Arms reaching out
    ctx.strokeStyle = '#8090a8'; ctx.lineWidth = r*0.2; ctx.lineCap = 'round';
    const reach = Math.sin(t * 1.2) * r * 0.2;
    ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.1); ctx.lineTo(-r*2.0-reach, r*0.0+reach); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.5, r*0.1); ctx.lineTo(r*2.0+reach, r*0.0-reach); ctx.stroke();
    // Bony fingers
    [-1, 1].forEach(side => {
      const hx = side * (r*2.0 + (side===-1?-reach:reach));
      const hy = r*0.0 + (side===-1?reach:-reach);
      for (let f = 0; f < 3; f++) {
        const fa = side * (0.3 + f * 0.3) - 0.3;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(fa)*r*0.5, hy + Math.sin(fa)*r*0.4); ctx.stroke();
      }
    });
    // Skeletal face
    ctx.fillStyle = '#b0b8c8';
    ctx.beginPath(); ctx.ellipse(0, -r*0.85, r*0.5, r*0.55, 0, 0, Math.PI*2); ctx.fill();
    // Hollow eyes
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(-r*0.18, -r*0.9, r*0.13, r*0.16, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.18, -r*0.9, r*0.13, r*0.16, 0, 0, Math.PI*2); ctx.fill();
    // Eye glow inside sockets
    ctx.save(); ctx.shadowColor = '#80c0ff'; ctx.shadowBlur = 6+sense*6;
    ctx.fillStyle = ea ? '#a0d0ff' : '#6090c0';
    ctx.beginPath(); ctx.arc(-r*0.18, -r*0.9, r*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.18, -r*0.9, r*0.06, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Nose hole
    ctx.fillStyle = '#606878';
    ctx.beginPath(); ctx.ellipse(0, -r*0.72, r*0.06, r*0.08, 0, 0, Math.PI*2); ctx.fill();
    // Jaw
    ctx.strokeStyle = '#8090a0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -r*0.65, r*0.25, 0.3, Math.PI-0.3); ctx.stroke();
    // Tattered armour
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#5a6578';
    ctx.fillRect(-r*0.4, -r*0.3, r*0.8, r*0.5);
    ctx.restore();
    ctx.restore(); // end globalAlpha 0.65
  }

  // ── URUK-HAI ────────────────────────────────────────────────
  function drawUrukHai(ctx, w, ea) {
    const r = w.r, t = w.capePhase, sense = w.sense || 0;
    // Ground shadow
    ctx.save(); ctx.globalAlpha = 0.18;
    const sg = ctx.createRadialGradient(0, r*1.4, 0, 0, r*1.4, r*2);
    sg.addColorStop(0, 'rgba(0,0,0,0.8)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, r*1.4, r*1.6, r*0.35, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // Glow (dark red)
    const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r*3.5);
    gg.addColorStop(0, `rgba(${ea?'180,30,0':'120,20,0'},${0.2+sense*0.25})`);
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.fillRect(-r*3.5, -r*3.5, r*7, r*7);
    // Legs
    const stride = Math.sin(t * 3) * r * 0.15;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(-r*0.3, r*1.1+stride, r*0.25, r*0.55, 0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3, r*1.1-stride, r*0.25, r*0.55, -0.1, 0, Math.PI*2); ctx.fill();
    // Angular black armour body
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath();
    ctx.moveTo(-r*0.75, -r*0.3);
    ctx.lineTo(-r*0.7, r*0.7); ctx.lineTo(r*0.7, r*0.7); ctx.lineTo(r*0.75, -r*0.3);
    ctx.lineTo(r*0.4, -r*0.9); ctx.lineTo(-r*0.4, -r*0.9);
    ctx.closePath(); ctx.fill();
    // Armour plate highlights
    ctx.save(); ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-r*0.55, -r*0.6, r*1.1, r*0.2);
    ctx.fillRect(-r*0.5, r*0.15, r*1.0, r*0.15);
    ctx.restore();
    // Arms
    const armSwing = Math.sin(t * 3) * r * 0.1;
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = r*0.35; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.65, r*0.0); ctx.lineTo(-r*1.3, r*0.5-armSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.65, r*0.0); ctx.lineTo(r*1.3, -r*0.2+armSwing); ctx.stroke();
    // Pike in right hand
    ctx.save(); ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#4a3a1a'; ctx.lineWidth = r*0.12;
    ctx.beginPath(); ctx.moveTo(r*1.2, -r*0.2+armSwing); ctx.lineTo(r*1.4, -r*2.2); ctx.stroke();
    // Spearhead
    ctx.fillStyle = ea ? '#d0e0ff' : '#a0a8b8';
    ctx.beginPath(); ctx.moveTo(r*1.25, -r*2.4); ctx.lineTo(r*1.55, -r*2.1); ctx.lineTo(r*1.4, -r*1.8); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Head with helmet
    ctx.fillStyle = '#0e0e0e';
    ctx.beginPath(); ctx.ellipse(0, -r*1.15, r*0.58, r*0.55, 0, 0, Math.PI*2); ctx.fill();
    // Helmet crest
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(0, -r*1.85); ctx.lineTo(-r*0.15, -r*1.45); ctx.lineTo(r*0.15, -r*1.45);
    ctx.closePath(); ctx.fill();
    // White hand of Saruman on helm
    ctx.save(); ctx.fillStyle = '#e0dcd0'; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0, -r*1.15, r*0.2, r*0.22, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#e0dcd0'; ctx.lineWidth = r*0.06;
    var fingerAngles = [-0.5, -0.25, 0, 0.25, 0.5];
    fingerAngles.forEach(function(fa) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(fa)*r*0.18, -r*1.15 - r*0.2);
      ctx.lineTo(Math.sin(fa)*r*0.28, -r*1.15 - r*0.42);
      ctx.stroke();
    });
    ctx.restore();
    // Red glowing eyes
    ctx.save(); ctx.shadowColor = ea ? '#ff2200' : '#cc0000'; ctx.shadowBlur = 6+sense*8;
    ctx.fillStyle = ea ? '#ff4400' : '#dd2200';
    ctx.beginPath(); ctx.arc(-r*0.2, -r*1.15, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.2, -r*1.15, r*0.1, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── SPIDERLING ──────────────────────────────────────────────
  function drawSpiderling(ctx, sp) {
    ctx.save(); ctx.translate(sp.x, sp.y);
    ctx.fillStyle = '#2a1030';
    ctx.beginPath(); ctx.ellipse(0, 0, sp.r, sp.r*0.7, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#1a0820'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + sp.angle * 0.5;
      const legLen = sp.r * 2.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * sp.r * 0.5, Math.sin(a) * sp.r * 0.35);
      ctx.lineTo(Math.cos(a) * legLen, Math.sin(a) * legLen * 0.6);
      ctx.stroke();
    }
    ctx.fillStyle = '#cc2020';
    ctx.beginPath(); ctx.arc(-sp.r*0.2, -sp.r*0.2, 1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sp.r*0.2, -sp.r*0.2, 1, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── BLESSING PICKUP ─────────────────────────────────────────
  function drawBlessingPickup(ctx, p, t) {
    const pulse = 1 + Math.sin(p.pulse) * 0.25;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.shadowColor = '#c0d8ff'; ctx.shadowBlur = 20 * pulse;
    ctx.fillStyle = `rgba(200,220,255,${0.6+Math.sin(p.pulse)*0.3})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? p.r * pulse : p.r * 0.4 * pulse;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    const ig = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 0.6);
    ig.addColorStop(0, 'rgba(255,220,150,0.8)'); ig.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(200,220,255,0.7)'; ctx.font = 'bold 8px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('BLESSING', 0, p.r + 4);
    ctx.restore();
  }

  // ── LEVEL WIN SCREEN ─────────────────────────────────────────────────
  // Journey waypoints for the map
  const JOURNEY_MAP = [
    { label: 'Shire',       x: 0.08 },
    { label: 'Moria',       x: 0.20 },
    { label: 'Lorien',      x: 0.30 },
    { label: 'Marshes',     x: 0.40 },
    { label: 'Black Gate',  x: 0.50 },
    { label: 'Shelob',      x: 0.60 },
    { label: 'Morgul',      x: 0.70 },
    { label: 'Pelennor',    x: 0.80 },
    { label: 'Mt. Doom',    x: 0.92 },
  ];

  function drawJourneyMap(ctx, W, mapY, clearedLvl) {
    const mapW = W * 0.72, mapX = W * 0.14;
    // Road line
    ctx.save();
    ctx.strokeStyle = 'rgba(140,100,40,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(mapX, mapY); ctx.lineTo(mapX + mapW, mapY); ctx.stroke();
    ctx.setLineDash([]);
    // Waypoints
    JOURNEY_MAP.forEach((wp, i) => {
      const wx = mapX + mapW * ((wp.x - 0.08) / (0.92 - 0.08));
      const lit = i <= clearedLvl;
      const isCurrent = i === clearedLvl;
      ctx.save();
      if (isCurrent) { ctx.shadowColor = '#ffd040'; ctx.shadowBlur = 12; }
      ctx.fillStyle = lit ? '#ffd030' : 'rgba(80,60,20,0.5)';
      ctx.beginPath(); ctx.arc(wx, mapY, isCurrent ? 6 : 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = lit ? 'rgba(200,160,60,0.9)' : 'rgba(100,80,40,0.4)';
      ctx.font = isCurrent ? 'bold 9px serif' : '8px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(wp.label, wx, mapY - 9);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawLevelWin(ctx,W,H,def,lvl,t,timer) {
    ctx.fillStyle=`rgba(0,0,0,${Math.min(0.88,timer*1.2)})`; ctx.fillRect(0,0,W,H);
    if(timer<0.5) return;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const fade=Math.min(1,(timer-0.5)*1.5);
    ctx.globalAlpha=fade;
    // Journey map at top
    drawJourneyMap(ctx, W, H/2 - 125, lvl);
    const badge=LEVEL_DEFS[lvl]?.book||'I';
    ctx.fillStyle='rgba(180,140,50,0.7)'; ctx.font='bold 10px serif';
    ctx.fillText(`BOOK ${badge}  --  CHAPTER ${LEVEL_DEFS[lvl]?.chapter||'?'}  COMPLETE`,W/2,H/2-88);
    ctx.fillStyle='#e8d060'; ctx.font=`bold 26px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.title,W/2,H/2-62);
    ctx.fillStyle='#e8c848'; ctx.font=`italic 15px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.winMsg,W/2,H/2-36);
    // Tolkien quote with aged parchment feel
    ctx.fillStyle='rgba(180,140,60,0.15)'; ctx.fillRect(W/2-180,H/2-22,360,40);
    ctx.fillStyle='rgba(160,120,50,0.8)'; ctx.font=`italic 12px serif`;
    ctx.fillText(def.winQuote,W/2,H/2-8);
    ctx.fillStyle='rgba(120,90,40,0.5)'; ctx.font='9px serif';
    ctx.fillText('-- J.R.R. Tolkien',W/2,H/2+10);
    // Stars for completed book
    for(let i=0;i<3;i++){
      const sx=W/2-44+i*44, sy=H/2+38;
      const lit=i<=Math.floor(lvl/3);
      ctx.save(); ctx.shadowColor='#ffcc20'; ctx.shadowBlur=lit?14:0;
      ctx.fillStyle=lit?'#ffd030':'rgba(80,60,20,0.4)';
      ctx.font='26px serif'; ctx.fillText('★',sx,sy); ctx.restore();
    }
    const nextDef=LEVEL_DEFS[lvl+1];
    // Chapter break: 2.5s rest moment with single quote before continue prompt
    const REST_QUOTES = [
      '"The road goes ever on and on..."',
      '"Fly, you fools!"',
      '"Even darkness must pass."',
      '"Not all those who wander are lost."',
      '"There is another way."',
      '"In the darkness bind them."',
      '"The power of the Ring could not be hidden."',
      '"I cannot carry it for you, but I can carry you."',
      '"It is done."',
    ];
    if(nextDef && timer > 1.8 && timer < 4.5){
      const rf = Math.min(1,(timer-1.8)/0.6);
      ctx.save(); ctx.globalAlpha=rf*0.9;
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(W/2-200,H/2+55,400,38);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='italic 13px "Palatino Linotype",Palatino,Georgia,serif';
      ctx.fillText(REST_QUOTES[lvl]||'',W/2,H/2+68);
      ctx.fillStyle='rgba(180,160,120,0.5)'; ctx.font='9px serif';
      ctx.fillText('-- J.R.R. Tolkien',W/2,H/2+82);
      ctx.restore();
    }
    if(nextDef && timer > 4.2){
      const cf = Math.min(1,(timer-4.2)/0.4);
      ctx.save(); ctx.globalAlpha=cf*0.9;
      ctx.fillStyle='rgba(180,140,60,0.9)'; ctx.font='bold 13px serif';
      ctx.fillText(`SPACE  --  ${nextDef.title}`,W/2,H/2+105);
      ctx.fillStyle='rgba(140,110,50,0.6)'; ctx.font='italic 11px serif';
      ctx.fillText(nextDef.subtitle,W/2,H/2+122);
      ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  // ── FINAL WIN ─────────────────────────────────────────────────────────
  function drawFinalWin(ctx,W,H,t,round=1,score=0){
    ctx.fillStyle='rgba(15,4,0,0.9)'; ctx.fillRect(0,0,W,H);
    const fire=ctx.createRadialGradient(W/2,H/2+40,8,W/2,H/2+40,300);
    fire.addColorStop(0,`rgba(255,110,0,${0.6+Math.sin(t*3)*0.08})`);
    fire.addColorStop(0.4,'rgba(190,42,0,0.3)'); fire.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fire; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#ffd060'; ctx.font='bold 42px "Palatino Linotype",Palatino,Georgia,serif';
    ctx.fillText('It is done.',W/2,H/2-90);
    ctx.fillStyle='#c07830'; ctx.font='italic 15px serif';
    ctx.fillText('"My precious..."',W/2,H/2-50);
    // Three stars
    for(let i=0;i<3;i++){
      const sx=W/2-50+i*50, sy=H/2-5;
      ctx.save(); ctx.shadowColor='#ffcc20'; ctx.shadowBlur=18+Math.sin(t*2+i)*6;
      ctx.fillStyle=`hsl(45,90%,${58+Math.sin(t*3+i)*10}%)`;
      ctx.font='32px serif'; ctx.fillText('★',sx,sy); ctx.restore();
    }
    const ry=H/2+45+Math.sin(t*1.6)*9;
    ctx.save(); ctx.shadowColor='#ff7700'; ctx.shadowBlur=30+Math.sin(t*4)*10;
    ctx.strokeStyle=`hsl(45,92%,${58+Math.sin(t*5)*10}%)`; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(W/2,ry,22,0,Math.PI*2); ctx.stroke(); ctx.restore();
    ctx.fillStyle='#b07030'; ctx.font='14px serif';
    ctx.fillStyle='rgba(200,160,60,0.8)'; ctx.font='13px serif';
    ctx.fillText(`Round ${round} complete  ·  Score: ${Math.floor(score).toLocaleString()}`,W/2,H/2+80);
    ctx.fillStyle='rgba(160,120,50,0.6)'; ctx.font='11px serif';
    ctx.fillText('Middle-earth is free — but darkness stirs again...',W/2,H/2+102);
    if(Math.sin(t*2.2)>0){
      ctx.fillStyle='#c08838'; ctx.font='bold 14px serif';
      ctx.fillText(`— Press SPACE for Round ${round+1} (harder) —`,W/2,H/2+130);
    }
  }

  // ── UI (shared) ───────────────────────────────────────────────────────
  function drawUILevel(ctx,W,H,frodo,prog,eye,elapsed,lvl,def,dashCharges=0,score=0,round=1,godMode=false,maxL=3,maxD=3,comboMult=1,comboFlash=0,comboTimer=0,flavourIdx=-1,flavourAlpha=0){
    // Progress bar -- grows heavier/darker with level number
    const ringHeaviness = lvl / 8; // 0 at Shire, 1.0 at Mount Doom
    ctx.fillStyle=`rgba(0,0,0,${0.55+ringHeaviness*0.25})`; ctx.fillRect(10,10,210,18);
    const [dr,dg,db]=def.destGlow;
    const bar=ctx.createLinearGradient(10,0,220,0);
    // Bar colour desaturates and reddens with Ring weight
    const barR=Math.floor(dr*0.3+ringHeaviness*80), barG=Math.floor(dg*0.6*(1-ringHeaviness*0.5)), barB=Math.floor(db*0.3*(1-ringHeaviness*0.7));
    bar.addColorStop(0,`rgb(${barR},${barG},${barB})`);
    bar.addColorStop(1,`rgb(${Math.min(255,dr+ringHeaviness*60)},${Math.floor(dg*(1-ringHeaviness*0.4))},${Math.floor(db*(1-ringHeaviness*0.6))})`);
    ctx.fillStyle=bar; ctx.fillRect(10,10,210*prog,18);
    // Ring weight indicator marks
    if(ringHeaviness>0.4){
      for(let i=1;i<4;i++){
        ctx.save(); ctx.globalAlpha=ringHeaviness*0.4;
        ctx.fillStyle='rgba(180,30,0,0.6)';
        ctx.fillRect(10+210*(i/4)-1,10,2,18);
        ctx.restore();
      }
    }
    ctx.strokeStyle=`rgba(${140+Math.floor(ringHeaviness*80)},${Math.floor(95*(1-ringHeaviness*0.3))},40,0.75)`;
    ctx.lineWidth=1; ctx.strokeRect(10,10,210,18);
    ctx.fillStyle='rgba(200,160,70,0.85)'; ctx.font='9px serif'; ctx.textAlign='left';
    ctx.fillText(def.progressLabel,13,23);
    // Level badge + round + score
    const badge=LEVEL_DEFS[lvl]?.book||'I';
    ctx.fillStyle='rgba(180,140,50,0.7)'; ctx.font='bold 11px serif';
    ctx.fillText(`BOOK ${badge}  --  RND ${round}`, 10, 42);
    ctx.fillStyle='rgba(160,130,60,0.6)'; ctx.font='10px serif';
    ctx.fillText(`⭐ ${Math.floor(score)}`, 10, 56);
    // Combo multiplier
    if(comboMult > 1){
      const cf = Math.min(1, comboFlash > 0 ? 1 : 0.8);
      ctx.save();
      if(comboFlash>0){ ctx.shadowColor='#ffd040'; ctx.shadowBlur=12; }
      ctx.fillStyle=`rgba(255,${180+Math.floor(comboFlash*60)},40,${cf})`;
      ctx.font=`bold ${comboFlash>0?14:11}px serif`;
      ctx.fillText(`${comboMult}x COMBO`,10,70);
      ctx.restore();
    } else if(comboTimer > 5){
      const progress2 = (comboTimer-5)/5;
      ctx.fillStyle=`rgba(160,120,50,${0.3+progress2*0.3})`;
      ctx.font='9px serif';
      ctx.fillText(`combo in ${Math.ceil(10-comboTimer)}s`,10,70);
    }
    // God mode badge
    if (godMode) {
      ctx.save(); ctx.shadowColor='#ffd700'; ctx.shadowBlur=8;
      ctx.fillStyle='rgba(255,215,0,0.85)'; ctx.font='bold 10px serif'; ctx.textAlign='left';
      ctx.fillText('✨ GOD MODE', 10, 70);
      ctx.restore();
    }
    // Lives (up to maxL pips)
    for(let i=0;i<maxL;i++){const lx=W-22-i*24,lit=i<frodo.lives;
      ctx.save(); if(lit){ctx.shadowColor='#d4a020';ctx.shadowBlur=8;}
      ctx.strokeStyle=lit?'#d4a820':'#3a2810'; ctx.lineWidth=lit?2.2:1;
      ctx.beginPath(); ctx.arc(lx,19,8,0,Math.PI*2); ctx.stroke();
      if(lit){ctx.fillStyle='rgba(212,168,32,0.18)';ctx.beginPath();ctx.arc(lx,19,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
    // Dash charges (⚡ pips, up to maxD)
    ctx.font='bold 11px serif'; ctx.textAlign='right';
    for(let i=0;i<maxD;i++){const lx=W-16-i*22,lit=i<dashCharges;
      ctx.save();
      if(lit){ctx.shadowColor='#60a0ff';ctx.shadowBlur=6;}
      ctx.fillStyle=lit?'rgba(100,160,255,0.95)':'rgba(40,60,120,0.3)';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font=`${lit?'bold ':' '}12px serif`;
      ctx.fillText('⚡',lx,40);
      ctx.restore();
    }

    // Eye warning
    if(eye&&eye.phase==='warning'&&Math.sin(elapsed*11)>0){
      ctx.fillStyle='#ff6010';ctx.font='bold 11px serif';ctx.textAlign='center';
      ctx.fillText('THE EYE OPENS...',W/2,32);}
    // Flavour
    if(prog>0.08 && flavourIdx >= 0 && flavourIdx < def.flavour.length){
      ctx.fillStyle=`rgba(200,138,38,${flavourAlpha*Math.min(1,(prog-0.08)*3)})`;
      ctx.font='italic 11px serif'; ctx.textAlign='center';
      ctx.fillText(def.flavour[flavourIdx],W/2,H-10);
    }
  }

  function drawOrc(ctx,w,ea){
    const r=w.r, t=w.capePhase, sense=w.sense||0;
    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.15;
    const sg=ctx.createRadialGradient(0,r*1.4,0,0,r*1.4,r*2);
    sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,r*1.4,r*1.5,r*0.3,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Glow (red-orange, aggressive)
    const og=ctx.createRadialGradient(0,0,0,0,0,r*3.5);
    og.addColorStop(0,`rgba(${ea?'200,60,0':'140,40,0'},${0.2+sense*0.25})`);
    og.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=og; ctx.fillRect(-r*3.5,-r*3.5,r*7,r*7);
    // Legs — running stride
    const stride=Math.sin(t*3)*r*0.18;
    ctx.fillStyle='#2a1a0a';
    ctx.beginPath(); ctx.ellipse(-r*0.3,r*1.1+stride,r*0.28,r*0.55,0.15,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.3,r*1.1-stride,r*0.28,r*0.55,-0.15,0,Math.PI*2); ctx.fill();
    // Heavy armour body
    ctx.fillStyle='#2e1e0e';
    ctx.beginPath();
    ctx.moveTo(-r*0.7,-r*0.2);
    ctx.lineTo(-r*0.65,r*0.7); ctx.lineTo(r*0.65,r*0.7); ctx.lineTo(r*0.7,-r*0.2);
    ctx.bezierCurveTo(r*0.8,-r*0.6,r*0.4,-r*0.85,0,-r*0.9);
    ctx.bezierCurveTo(-r*0.4,-r*0.85,-r*0.8,-r*0.6,-r*0.7,-r*0.2);
    ctx.fill();
    // Armour plates
    ctx.save(); ctx.globalAlpha=0.5;
    ctx.fillStyle='#3a2a12';
    ctx.fillRect(-r*0.55,-r*0.6,r*1.1,r*0.25); // chest band
    ctx.fillRect(-r*0.45,r*0.1,r*0.9,r*0.2);   // belly band
    ctx.restore();
    // Arms
    const armSwing=Math.sin(t*3)*r*0.12;
    ctx.strokeStyle='#2a1a0a'; ctx.lineWidth=r*0.35; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-r*0.6,r*0.0); ctx.lineTo(-r*1.2,r*0.6-armSwing); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r*0.6,r*0.0);  ctx.lineTo(r*1.2,r*0.6+armSwing);  ctx.stroke();
    // Spear
    ctx.save(); ctx.globalAlpha=0.75;
    ctx.strokeStyle='#5a3a10'; ctx.lineWidth=r*0.14;
    ctx.beginPath(); ctx.moveTo(r*1.1,-r*0.8); ctx.lineTo(r*1.3,r*0.7); ctx.stroke();
    // Spearhead
    ctx.fillStyle=ea?'#c0d0ff':'#909aaa';
    ctx.beginPath(); ctx.moveTo(r*0.95,-r*1.0); ctx.lineTo(r*1.2,-r*0.85); ctx.lineTo(r*1.05,-r*0.65); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Brutish head
    ctx.fillStyle='#3a2810';
    ctx.beginPath(); ctx.ellipse(0,-r*1.15,r*0.62,r*0.58,0,0,Math.PI*2); ctx.fill();
    // Helmet
    ctx.fillStyle='#2a1e0e';
    ctx.beginPath(); ctx.ellipse(0,-r*1.38,r*0.62,r*0.32,0,Math.PI,Math.PI*2); ctx.fill();
    ctx.fillRect(-r*0.62,-r*1.38,r*1.24,r*0.15); // helmet brim
    // Angry eyes
    ctx.save(); ctx.shadowColor=ea?'#ff4400':'#cc2200'; ctx.shadowBlur=4+sense*6;
    ctx.fillStyle=ea?'#ff5500':'#dd3300';
    [-r*0.22,r*0.22].forEach(ex2=>{
      ctx.beginPath(); ctx.ellipse(ex2,-r*1.12,r*0.12,r*0.08,-0.1,0,Math.PI*2); ctx.fill();
    });
    ctx.restore();
    // Tusks
    ctx.fillStyle='rgba(220,200,160,0.8)';
    ctx.beginPath(); ctx.ellipse(-r*0.15,-r*0.88,r*0.06,r*0.14,0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.15,-r*0.88,r*0.06,r*0.14,-0.3,0,Math.PI*2); ctx.fill();
  }

  function drawFellBeast(ctx,w,ea){
    const r=w.r*1.8, t=w.capePhase, sense=w.sense||0; // Fell Beast drawn larger than base radius

    // Fell Beast outer glow — dark red/purple
    const glowR=r*3.5;
    const fg=ctx.createRadialGradient(0,0,0,0,0,glowR);
    fg.addColorStop(0,`rgba(${ea?'180,20,80':'120,10,40'},${0.3+sense*0.2})`);
    fg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fg; ctx.fillRect(-glowR,-glowR,glowR*2,glowR*2);

    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.25;
    const sg=ctx.createRadialGradient(0,r*0.8,0,0,r*0.8,r*2.5);
    sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,r*0.8,r*2.2,r*0.4,0,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Wings — sweeping bezier curves, animated flap
    // Slow soaring flap — gentle continuous motion like a large predator gliding
    const flapAngle = Math.sin(t*1.4)*0.14 + Math.sin(t*2.1)*0.06;
    const wingCol = ea?'#1a0520':'#120318';
    const wingEdge = ea?'rgba(180,20,80,0.25)':'rgba(100,10,40,0.2)';
    // Left wing
    ctx.fillStyle=wingCol;
    ctx.beginPath();
    ctx.moveTo(-r*0.4,-r*0.2);
    ctx.bezierCurveTo(-r*1.8,-r*(1.2+flapAngle), -r*2.8,-r*(0.5+flapAngle), -r*2.5,r*(0.6-flapAngle));
    ctx.bezierCurveTo(-r*2.0,r*0.9, -r*1.2,r*0.5, -r*0.4,r*0.3);
    ctx.closePath(); ctx.fill();
    // Left wing membrane lines
    ctx.save(); ctx.strokeStyle=wingEdge; ctx.lineWidth=1;
    for(let i=1;i<=3;i++){
      const f=i/4;
      ctx.beginPath();
      ctx.moveTo(-r*0.4,-r*0.2);
      ctx.bezierCurveTo(-r*(0.8+f*1.0),-r*(0.8+flapAngle*f),-r*(2.0+f*0.5),-r*(0.2+flapAngle*f),-r*(2.5-f*0.3),r*(0.6-flapAngle)*f);
      ctx.stroke();
    }
    ctx.restore();
    // Right wing
    ctx.fillStyle=wingCol;
    ctx.beginPath();
    ctx.moveTo(r*0.4,-r*0.2);
    ctx.bezierCurveTo(r*1.8,-r*(1.2+flapAngle), r*2.8,-r*(0.5+flapAngle), r*2.5,r*(0.6-flapAngle));
    ctx.bezierCurveTo(r*2.0,r*0.9, r*1.2,r*0.5, r*0.4,r*0.3);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.strokeStyle=wingEdge; ctx.lineWidth=1;
    for(let i=1;i<=3;i++){
      const f=i/4;
      ctx.beginPath();
      ctx.moveTo(r*0.4,-r*0.2);
      ctx.bezierCurveTo(r*(0.8+f*1.0),-r*(0.8+flapAngle*f),r*(2.0+f*0.5),-r*(0.2+flapAngle*f),r*(2.5-f*0.3),r*(0.6-flapAngle)*f);
      ctx.stroke();
    }
    ctx.restore();

    // Beast body — serpentine, dark scaled
    const bodyG=ctx.createLinearGradient(-r*0.6,0,r*0.6,0);
    bodyG.addColorStop(0,'#1a0810'); bodyG.addColorStop(0.5,ea?'#3a1030':'#250818'); bodyG.addColorStop(1,'#1a0810');
    ctx.fillStyle=bodyG;
    ctx.beginPath(); ctx.ellipse(0,-r*0.1,r*0.65,r*0.85,0,0,Math.PI*2); ctx.fill();

    // Scale texture (vertical lines)
    ctx.save(); ctx.globalAlpha=0.15; ctx.strokeStyle='#000'; ctx.lineWidth=0.8;
    for(let i=-2;i<=2;i++){
      ctx.beginPath(); ctx.moveTo(i*r*0.22,-r*0.9); ctx.lineTo(i*r*0.22,r*0.7); ctx.stroke();
    }
    ctx.restore();

    // Neck stretched forward
    ctx.fillStyle='#1e0c14';
    ctx.beginPath();
    ctx.moveTo(-r*0.3,-r*0.9);
    ctx.bezierCurveTo(-r*0.4,-r*1.5, -r*0.1,-r*1.9, r*0.3,-r*2.0);
    ctx.bezierCurveTo(r*0.5,-r*1.9, r*0.4,-r*1.3, r*0.3,-r*0.9);
    ctx.closePath(); ctx.fill();

    // Beast head — elongated, fanged
    ctx.fillStyle='#1e0c14';
    ctx.beginPath(); ctx.ellipse(r*0.25,-r*2.1,r*0.45,r*0.32,-0.4,0,Math.PI*2); ctx.fill();
    // Upper jaw
    ctx.beginPath(); ctx.ellipse(r*0.35,-r*2.0,r*0.55,r*0.18,-0.4,0,Math.PI*2); ctx.fill();
    // Fangs
    ctx.fillStyle=ea?'rgba(255,100,80,0.9)':'rgba(200,180,160,0.7)';
    [[r*0.1,-r*2.15,r*0.07,r*0.2,-0.5],[r*0.4,-r*2.0,r*0.06,r*0.18,-0.3]].forEach(([fx,fy,fw,fh,fa])=>{
      ctx.beginPath(); ctx.ellipse(fx,fy,fw,fh,fa,0,Math.PI*2); ctx.fill();
    });
    // Beast eye — red slit
    ctx.save(); ctx.shadowColor=ea?'#ff0000':'#cc0000'; ctx.shadowBlur=8;
    ctx.fillStyle=ea?'#ff2020':'#cc1010';
    ctx.beginPath(); ctx.ellipse(r*0.15,-r*2.18,r*0.09,r*0.07,-0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(r*0.15,-r*2.18,r*0.03,r*0.07,-0.3,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Rider on top — small Nazgûl silhouette
    ctx.fillStyle=ea?'#1a0430':'#100220';
    ctx.beginPath(); ctx.moveTo(-r*0.3,-r*0.2);
    ctx.bezierCurveTo(-r*0.5,r*0.1,-r*0.4,r*0.6,-r*0.1,r*0.7);
    ctx.lineTo(r*0.1,r*0.7);
    ctx.bezierCurveTo(r*0.4,r*0.6,r*0.5,r*0.1,r*0.3,-r*0.2);
    ctx.closePath(); ctx.fill();
    // Rider head
    ctx.beginPath(); ctx.arc(0,-r*0.35,r*0.22,0,Math.PI*2); ctx.fill();
    // Rider eyes — grow with sense like regular Nazgûl
    const riderEyeR = r*0.05 + sense*r*0.06;
    const riderEyeCol = ea?'#ff70ff':sense>0.6?'#ff30aa':sense>0.15?'#dd1880':'#cc0070';
    const riderEyeGlow = ea?'#cc00ff':sense>0.15?'#990066':'#aa0060';
    ctx.save(); ctx.shadowColor=riderEyeGlow; ctx.shadowBlur=4+sense*12; ctx.fillStyle=riderEyeCol;
    [-r*0.07,r*0.07].forEach(ex2=>{
      ctx.beginPath(); ctx.arc(ex2,-r*0.36,riderEyeR,0,Math.PI*2); ctx.fill();
      // Eye spark
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(ex2-riderEyeR*0.3,-r*0.36-riderEyeR*0.3,riderEyeR*0.28,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=riderEyeCol;
    });
    ctx.restore();
  }

  function drawWraiths1(ctx,wraiths,eye,H=580,SKY_Y=290,noSky=false){
    const ea = eye&&eye.phase==='active';
    wraiths.forEach(w=>{
      ctx.save(); ctx.translate(w.x,w.y);
      const transitionRange = w.r * 6;
      const skyRatio = (w.type==='wraith' && !noSky)
        ? Math.max(0, Math.min(1, (SKY_Y - w.y) / transitionRange))
        : 0;
      if (w.type==='wraith' && skyRatio > 0) {
        if (skyRatio >= 1) {
          // Fully in sky: only Fell Beast
          drawFellBeast(ctx,w,ea); ctx.restore(); return;
        }
        // Blending: draw wraith fading out, Fell Beast fading in
        ctx.globalAlpha = 1 - skyRatio;
        // fall through to draw cloaked wraith below
      }
      if (w.type==='orc')   { drawOrc(ctx,w,ea); ctx.restore(); return; }
      if (w.type==='troll') { drawCaveTroll(ctx,w,ea); ctx.restore(); return; }
      if (w.type==='wight') { drawMorgulWight(ctx,w,ea); ctx.restore(); return; }
      if (w.type==='uruk')  { drawUrukHai(ctx,w,ea); ctx.restore(); return; }
      const sense = w.sense||0, t2 = w.capePhase;
      // Glow halo
      const gc = ea?[160,30,255]:sense>0.15?[120,20,200]:[60,10,120];
      const glowR = w.r*(3.5+sense*2);
      const wg = ctx.createRadialGradient(0,0,0,0,0,glowR);
      wg.addColorStop(0,`rgba(${gc},${0.25+sense*0.3})`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(-glowR,-glowR,glowR*2,glowR*2);
      // Ground shadow
      ctx.save(); ctx.globalAlpha=0.22;
      const sg=ctx.createRadialGradient(0,w.r*1.8,0,0,w.r*1.8,w.r*2);
      sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,w.r*1.8,w.r*1.4,w.r*0.35,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // Billowing cloak — back layer
      const wave1=Math.sin(t2)*w.r*0.35, wave2=Math.sin(t2*1.3+1)*w.r*0.2;
      ctx.fillStyle=ea?'#130328':sense>0.15?'#0e0225':'#08011a';
      ctx.beginPath();
      ctx.moveTo(0,-w.r);
      ctx.bezierCurveTo(-w.r*1.6,-w.r*0.2+wave2,-w.r*1.8,w.r+wave2,0,w.r*2.2);
      ctx.bezierCurveTo(w.r*1.8,w.r-wave2,w.r*1.6,-w.r*0.2-wave2,0,-w.r);
      ctx.fill();
      // Front layer
      ctx.fillStyle=ea?'#1c0440':sense>0.15?'#160330':'#0d0225';
      ctx.beginPath();
      ctx.moveTo(0,-w.r*0.9);
      ctx.bezierCurveTo(-w.r*1.1,-w.r*0.1+wave1,-w.r*1.2,w.r*0.8+wave1,0,w.r*2.0);
      ctx.bezierCurveTo(w.r*1.2,w.r*0.8-wave1,w.r*1.1,-w.r*0.1-wave1,0,-w.r*0.9);
      ctx.fill();
      // Hood
      ctx.fillStyle=ea?'#220550':sense>0.15?'#1a0340':'#10022e';
      ctx.beginPath(); ctx.ellipse(0,-w.r*0.85,w.r*0.85,w.r*0.95,0,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.strokeStyle=`rgba(${ea?'180,80,255':sense>0.15?'130,40,200':'60,10,140'},0.3)`;
      ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(0,-w.r*0.85,w.r*0.85,w.r*0.95,0,Math.PI*0.1,Math.PI*0.9); ctx.stroke();
      ctx.restore();
      // Armour chest plate visible under cloak
      ctx.save(); ctx.globalAlpha=0.4+sense*0.2;
      const armCol=ea?'#3a1060':'#1e0838';
      ctx.fillStyle=armCol;
      ctx.beginPath(); ctx.moveTo(-w.r*0.5,w.r*0.0); ctx.lineTo(-w.r*0.35,-w.r*0.55);
      ctx.lineTo(0,-w.r*0.65); ctx.lineTo(w.r*0.35,-w.r*0.55); ctx.lineTo(w.r*0.5,w.r*0.0);
      ctx.closePath(); ctx.fill();
      // Armour trim lines
      ctx.strokeStyle=ea?'rgba(200,100,255,0.3)':'rgba(100,50,160,0.25)'; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(-w.r*0.3,-w.r*0.5); ctx.lineTo(0,-w.r*0.6); ctx.lineTo(w.r*0.3,-w.r*0.5); ctx.stroke();
      ctx.restore();

      // Void face
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(0,-w.r*0.9,w.r*0.5,w.r*0.55,0,0,Math.PI*2); ctx.fill();
      // Eyes
      const eyeR=1.8+sense*3;
      const eyeCol=ea?'#ff70ff':sense>0.6?'#ff30aa':sense>0.15?'#dd1880':'#aa0050';
      ctx.save(); ctx.shadowColor=ea?'#cc00ff':sense>0.15?'#990066':'#660033'; ctx.shadowBlur=6+sense*14;
      ctx.fillStyle=eyeCol;
      [-4,4].forEach(ex2=>{
        ctx.beginPath(); ctx.arc(ex2,-w.r*0.9,eyeR,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(ex2-eyeR*0.2,-w.r*0.9-eyeR*0.2,eyeR*0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=eyeCol;
      }); ctx.restore();
      // Sword (larger, more visible)
      ctx.save(); ctx.globalAlpha=0.35+sense*0.2;
      ctx.shadowColor='#c0c8ff'; ctx.shadowBlur=ea?8:4;
      ctx.strokeStyle=ea?'#d0d8ff':'#b0b8e0'; ctx.lineWidth=2.5;
      // Blade
      ctx.beginPath(); ctx.moveTo(w.r*0.85,-w.r*0.4); ctx.lineTo(w.r*2.1,w.r*1.1); ctx.stroke();
      // Crossguard
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(w.r*1.0,-w.r*0.15); ctx.lineTo(w.r*1.35,w.r*0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w.r*1.45,w.r*0.05); ctx.lineTo(w.r*1.65,w.r*0.55); ctx.stroke();
      ctx.restore();
      // Fell Beast overlay during sky transition
      if (skyRatio > 0 && skyRatio < 1) {
        ctx.globalAlpha = skyRatio;
        drawFellBeast(ctx, w, ea);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
  }

  function drawFrodo1(ctx,frodo,prog,elapsed,lvl=0){
    ctx.save(); ctx.translate(frodo.x,frodo.y);
    // Corruption: lean forward more with each book, cloak darkens
    const corruption = lvl / 8;  // 0 = Shire, 1.0 = Mount Doom
    if (corruption > 0.1) ctx.rotate(corruption * 0.22); // hunching forward
    if(frodo.invincible&&Math.floor(elapsed*10)%2===0) ctx.globalAlpha=0.4;
    const warmth=(1-prog*0.72)*(1-corruption*0.4), r=frodo.r;
    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.2;
    const sg=ctx.createRadialGradient(0,r*1.5,0,0,r*1.5,r*2);
    sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,r*1.5,r*1.6,r*0.4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Warm glow (shifts cooler and darker with corruption)
    const glowRGB = lvl<3?'195,155,70':lvl<6?'140,110,50':'160,80,40';
    const bg=ctx.createRadialGradient(0,0,0,0,0,r*4);
    bg.addColorStop(0,`rgba(${glowRGB},${0.18*warmth})`); bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(-r*4,-r*4,r*8,r*8);
    // Ring corruption aura (grows in Books II and III)
    if(corruption > 0.3){
      const ca=ctx.createRadialGradient(0,0,0,0,0,r*3.5);
      ca.addColorStop(0,`rgba(80,0,0,${(corruption-0.3)*0.35})`);
      ca.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=ca; ctx.fillRect(-r*3.5,-r*3.5,r*7,r*7);
    }
    // Big hobbit feet
    ctx.fillStyle=`hsl(20,45%,${20-prog*8}%)`;
    ctx.beginPath(); ctx.ellipse(-r*0.45,r*1.1,r*0.52,r*0.28,Math.PI*0.12,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.45,r*1.1,r*0.52,r*0.28,-Math.PI*0.12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`hsl(30,40%,${28-prog*8}%)`;
    ctx.beginPath(); ctx.ellipse(-r*0.45,r*0.9,r*0.38,r*0.15,Math.PI*0.12,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.45,r*0.9,r*0.38,r*0.15,-Math.PI*0.12,0,Math.PI*2); ctx.fill();
    // Cloak
    ctx.fillStyle=`hsl(25,${38-prog*15}%,${22-prog*9}%)`;
    ctx.beginPath();
    ctx.moveTo(-r*0.6,-r*0.5);
    ctx.bezierCurveTo(-r*1.1,-r*0.2,-r*1.1,r*0.6,-r*0.5,r*0.95);
    ctx.lineTo(r*0.5,r*0.95);
    ctx.bezierCurveTo(r*1.1,r*0.6,r*1.1,-r*0.2,r*0.6,-r*0.5);
    ctx.closePath(); ctx.fill();
    ctx.save(); ctx.strokeStyle=`rgba(${prog>0.5?'80,40,10':'140,100,50'},${0.3-prog*0.2})`; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-r*0.6,-r*0.5); ctx.bezierCurveTo(-r*1.1,-r*0.2,-r*1.1,r*0.6,-r*0.5,r*0.95); ctx.stroke(); ctx.restore();
    // Head
    ctx.fillStyle=`hsl(28,${50-prog*12}%,${40-prog*15}%)`;
    ctx.beginPath(); ctx.arc(0,-r*0.85,r*0.78,0,Math.PI*2); ctx.fill();
    // Curly hair
    ctx.fillStyle=`hsl(22,${55-prog*15}%,${28-prog*10}%)`;
    ctx.beginPath(); ctx.arc(0,-r*1.4,r*0.65,Math.PI,0); ctx.fill();
    [-r*0.55,-r*0.25,0,r*0.25,r*0.55].forEach((hx,i)=>{
      ctx.beginPath(); ctx.arc(hx,-r*1.38+Math.sin(i)*r*0.05,r*0.22,0,Math.PI*2); ctx.fill();
    });
    // Eyes
    ctx.fillStyle='#1a0a00';
    ctx.beginPath(); ctx.ellipse(-r*0.22,-r*0.88,r*0.12,r*0.1,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.22,-r*0.88,r*0.12,r*0.1,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,240,220,0.85)';
    ctx.beginPath(); ctx.ellipse(-r*0.22,-r*0.89,r*0.07,r*0.06,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r*0.22,-r*0.89,r*0.07,r*0.06,0,0,Math.PI*2); ctx.fill();
    // Nose
    ctx.fillStyle=`hsl(22,40%,${35-prog*10}%)`;
    ctx.beginPath(); ctx.arc(0,-r*0.78,r*0.12,0,Math.PI); ctx.fill();
    // Ring chain on chest
    ctx.save(); ctx.strokeStyle=`rgba(${160+prog*60},${120+prog*30},${20-prog*10},0.55)`;
    ctx.lineWidth=1.2; ctx.setLineDash([2,2]);
    ctx.beginPath(); ctx.moveTo(-r*0.35,-r*0.55); ctx.quadraticCurveTo(0,-r*0.3,r*0.35,-r*0.55); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    // Orbiting Ring
    const rDist=r*1.6, rx=Math.cos(frodo.ringAngle)*rDist*0.65, ry=Math.sin(frodo.ringAngle)*rDist*0.4-r*0.6;
    const rglow=14+prog*12;
    ctx.save(); ctx.shadowColor=`rgba(255,180,20,${0.7+prog*0.3})`; ctx.shadowBlur=rglow;
    const rg=ctx.createRadialGradient(rx,ry,0,rx,ry,rglow*1.6);
    rg.addColorStop(0,`rgba(255,200,40,${0.45+prog*0.45})`); rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg; ctx.fillRect(rx-rglow*2,ry-rglow*2,rglow*4,rglow*4);
    ctx.strokeStyle=`hsl(45,95%,${58+prog*20}%)`; ctx.lineWidth=3+prog*2;
    ctx.beginPath(); ctx.arc(rx,ry,6+prog*2.5,0,Math.PI*2); ctx.stroke();
    if(prog>0.4){ ctx.strokeStyle=`rgba(255,100,0,${(prog-0.4)*1.4})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(rx,ry,9+prog*2.5,0,Math.PI*2); ctx.stroke(); }
    ctx.fillStyle=`rgba(255,240,100,${0.7+prog*0.2})`;
    ctx.beginPath(); ctx.arc(rx-2,ry-2,1.5,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Hit flash (level-tinted)
    const HIT_FLASH_COLS=['80,200,80','255,120,0','160,200,255','100,160,60','200,30,0','160,60,200','60,200,100','255,160,40','220,20,0'];
    const hfc = HIT_FLASH_COLS[lvl]||'255,50,0';
    if(frodo.hitFlash>0){ ctx.fillStyle=`rgba(${hfc},${frodo.hitFlash*0.55})`;
      ctx.beginPath(); ctx.arc(0,0,r*2.5,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  function drawEye1(ctx,W,eye){
    if(eye.open<0.01) return;
    const ex=W/2, ey=Math.round(W*0.07), ew=Math.round(W*0.1), eh=Math.round(ew*0.43*eye.open);
    // Tower
    ctx.save(); ctx.globalAlpha=eye.open*0.6; ctx.fillStyle='#050104';
    ctx.beginPath(); ctx.moveTo(ex-ew*0.4,ey+eh+10); ctx.lineTo(ex-ew*0.2,ey-eh-20);
    ctx.lineTo(ex+ew*0.2,ey-eh-20); ctx.lineTo(ex+ew*0.4,ey+eh+10); ctx.fill();
    [-ew*0.3,-ew*0.1,ew*0.1,ew*0.3].forEach(bx=>{ ctx.fillRect(ex+bx-5,ey-eh-30,8,14); });
    ctx.restore();
    // Corona
    ctx.save(); ctx.shadowColor='#ff3300'; ctx.shadowBlur=50*eye.open;
    const corona=ctx.createRadialGradient(ex,ey,0,ex,ey,ew*3);
    corona.addColorStop(0,`rgba(255,80,0,${0.4*eye.open})`);
    corona.addColorStop(0.5,`rgba(180,20,0,${0.15*eye.open})`);
    corona.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=corona; ctx.fillRect(ex-ew*3.5,ey-ew*1.5,ew*7,ew*3); ctx.restore();
    // Clip to eye shape
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey-eh-4,ex+ew,ey);
    ctx.quadraticCurveTo(ex,ey+eh+4,ex-ew,ey); ctx.closePath(); ctx.clip();
    // Iris
    const iris=ctx.createRadialGradient(ex,ey,0,ex,ey,ew);
    iris.addColorStop(0,'#fff060'); iris.addColorStop(0.12,'#ff6600');
    iris.addColorStop(0.35,'#cc2200'); iris.addColorStop(0.7,'#881000'); iris.addColorStop(1,'#2a0400');
    ctx.fillStyle=iris; ctx.fillRect(ex-ew,ey-eh*1.2,ew*2,eh*2.4);
    // Fire streaks
    ctx.save(); ctx.globalAlpha=0.25*eye.open;
    for(let i=0;i<10;i++){
      const a=(i/10)*Math.PI*2;
      ctx.strokeStyle='#ff8800'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ex+Math.cos(a)*ew*0.1,ey+Math.sin(a)*eh*0.1);
      ctx.lineTo(ex+Math.cos(a)*ew*0.85,ey+Math.sin(a)*ew*0.85*0.43); ctx.stroke();
    } ctx.restore();
    // Pupil
    const px=ex+(Math.max(0,Math.min(1,eye.px/W))-0.5)*ew*0.9;
    ctx.save(); ctx.shadowColor='#000'; ctx.shadowBlur=8; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(px,ey,Math.max(2,ew*0.07),Math.max(2,eh*0.88),0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,60,0,0.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(px,ey,Math.max(3,ew*0.09),Math.max(3,eh*0.95),0,0,Math.PI*2); ctx.stroke();
    ctx.restore(); ctx.restore();
    // Eyelid outlines
    ctx.save(); ctx.shadowColor='#ff2200'; ctx.shadowBlur=12*eye.open;
    ctx.strokeStyle=`rgba(220,80,0,${0.9*eye.open})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey-eh-4,ex+ew,ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey+eh+4,ex+ew,ey); ctx.stroke();
    ctx.restore();
  }

  // ── SHARED SCREEN HELPER ──────────────────────────────────────────────
  function drawTitleScreen(ctx,W,H,t) {
    ctx.fillStyle='rgba(0,0,0,0.88)'; ctx.fillRect(0,0,W,H);
    // Load + show persistent progress
    let _savedProgress = {};
    try { _savedProgress = JSON.parse(localStorage.getItem('lotr_ring_progress')||'{}'); } catch(e) {}
    const hasSaved = _savedProgress.bestScore > 0 || _savedProgress.furthestLevel > 0;
    ctx.textAlign='center'; ctx.textBaseline='middle';

    // Animated One Ring -- right side of title area
    const ringX = W*0.82, ringY = H*0.14, ringR = Math.min(36, W*0.045);
    ctx.save();
    // Outer glow
    const rg=ctx.createRadialGradient(ringX,ringY,ringR*0.6,ringX,ringY,ringR*2.2);
    rg.addColorStop(0,`rgba(200,160,40,${0.18+Math.sin(t*1.4)*0.06})`);
    rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg; ctx.fillRect(ringX-ringR*2.2,ringY-ringR*2.2,ringR*4.4,ringR*4.4);
    // Ring band
    ctx.shadowColor='#d4a020'; ctx.shadowBlur=10+Math.sin(t*1.8)*4;
    ctx.strokeStyle=`hsl(42,80%,${46+Math.sin(t*2)*6}%)`; ctx.lineWidth=ringR*0.22;
    ctx.beginPath(); ctx.arc(ringX,ringY,ringR,0,Math.PI*2); ctx.stroke();
    // Fire inscription text rotating around the ring
    const INSCRIPTION = 'One Ring to rule them all  ';
    ctx.font=`${Math.round(ringR*0.22)}px serif`;
    ctx.fillStyle=`rgba(255,${140+Math.floor(Math.sin(t*3)*30)},0,0.85)`;
    ctx.shadowColor='#ff6600'; ctx.shadowBlur=4;
    const chars = INSCRIPTION.split('');
    const angleStep = (Math.PI*2)/chars.length;
    chars.forEach((ch,i)=>{
      const a = i*angleStep + t*0.4;
      const cx2=ringX+Math.cos(a)*(ringR+ringR*0.32);
      const cy2=ringY+Math.sin(a)*(ringR+ringR*0.32);
      ctx.save(); ctx.translate(cx2,cy2); ctx.rotate(a+Math.PI/2);
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(ch,0,0); ctx.restore();
    });
    ctx.restore();

    // Ambient firefly glow
    for(let i=0;i<6;i++){
      const fx=W*0.1+Math.sin(t*0.5+i*1.1)*W*0.38, fy=H*0.15+Math.cos(t*0.4+i*0.8)*H*0.12;
      const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,18);
      fg.addColorStop(0,`rgba(200,220,100,${0.2+Math.sin(t*1.2+i)*0.12})`);
      fg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=fg; ctx.fillRect(fx-18,fy-18,36,36);
    }

    // Title
    ctx.save(); ctx.shadowColor='#c8a020'; ctx.shadowBlur=20;
    ctx.fillStyle='#e8c030'; ctx.font=`bold 46px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText('Carry the Ring',W/2,H*0.12);
    ctx.restore();
    ctx.fillStyle='rgba(160,120,50,0.7)'; ctx.font=`italic 13px serif`;
    ctx.fillText('"Even the smallest person can change the course of the future."',W/2,H*0.19);

    // Journey map
    ctx.fillStyle='rgba(140,100,40,0.3)'; ctx.fillRect(W/2-220,H*0.24,440,32);
    drawJourneyMap(ctx, W, H*0.24+16, -1);

    // Divider
    ctx.strokeStyle='rgba(140,100,40,0.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2-220,H*0.33); ctx.lineTo(W/2+220,H*0.33); ctx.stroke();

    // Controls
    const rowH=21, rowStart=H*0.35;
    const rows=[
      ['🔸 Move',       'WASD / Arrow keys  (touch: hold screen)'],
      ['⚡ Dash',       'SPACE -- burst of speed + brief invincibility'],
      ['🔑 Key',        'Collect to unlock the goal'],
      ['♥ Life',        'Restore 1 life (max 3)'],
      ['👁️ Eye of Sauron', 'Opens periodically -- Nazgul hunt you when active'],
    ];
    rows.forEach(([label,desc],i)=>{
      const ry=rowStart+i*rowH;
      ctx.textAlign='right'; ctx.fillStyle='rgba(210,170,70,0.9)'; ctx.font='bold 11px serif';
      ctx.fillText(label,W/2-8,ry);
      ctx.textAlign='left'; ctx.fillStyle='rgba(180,148,80,0.75)'; ctx.font='11px serif';
      ctx.fillText(desc,W/2+8,ry);
    });

    // Chapter enemies legend
    ctx.strokeStyle='rgba(140,100,40,0.35)';
    ctx.beginPath(); ctx.moveTo(W/2-220,H*0.58); ctx.lineTo(W/2+220,H*0.58); ctx.stroke();
    ctx.fillStyle='rgba(160,120,50,0.55)'; ctx.font='bold 9px serif'; ctx.textAlign='center';
    ctx.fillText('CHAPTER ENEMIES',W/2,H*0.60);
    const enemyRows=[
      'L2 Moria: Cave Troll (heavy, -2 lives)    L5-6 Black Gate/Shelob: Uruk-hai (fast, flanks)',
      'L7-8 Morgul/Pelennor: Morgul Wight (always hunts, bursts close)',
    ];
    ctx.font='9px serif'; ctx.fillStyle='rgba(140,110,50,0.5)';
    enemyRows.forEach((r,i)=>ctx.fillText(r,W/2,H*0.625+i*14));

    // Divider
    ctx.strokeStyle='rgba(140,100,40,0.35)';
    ctx.beginPath(); ctx.moveTo(W/2-220,H*0.67); ctx.lineTo(W/2+220,H*0.67); ctx.stroke();

    // Book list
    ctx.font='10px serif'; ctx.fillStyle='rgba(150,115,50,0.5)';
    ['Book I: Fellowship -- Shire, Moria, Lothlorien',
     'Book II: Two Towers -- Marshes, Black Gate, Shelob',
     'Book III: Return -- Morgul, Pelennor, Mt. Doom'
    ].forEach((b,i)=>ctx.fillText(b,W/2,H*0.69+i*14));

    // Persistent progress badge
    if(hasSaved){
      ctx.fillStyle='rgba(80,60,20,0.5)'; ctx.fillRect(W/2-150,H*0.73,300,28);
      ctx.fillStyle='rgba(200,160,60,0.8)'; ctx.font='bold 10px serif'; ctx.textAlign='center';
      const lvlNames=['Shire','Moria','Lorien','Marshes','Black Gate','Shelob','Morgul','Pelennor','Mt.Doom'];
      const fl = _savedProgress.furthestLevel||0;
      ctx.fillText(`Best: ${(_savedProgress.bestScore||0).toLocaleString()} pts  --  Furthest: ${lvlNames[fl]}  --  Rounds: ${_savedProgress.bestRound||0}`,W/2,H*0.73+16);
    }
    // Start prompt
    if(Math.sin(t*2.4)>0){
      ctx.save(); ctx.shadowColor='#c89040'; ctx.shadowBlur=8;
      ctx.fillStyle='#c89040'; ctx.font='bold 15px serif';
      ctx.fillText('-- Press SPACE to begin --',W/2,H*0.82);
      ctx.restore();
    }
  }

  function drawGameOver(ctx,W,H,t,score,rnd,lvl,checkpoint=0) {
    ctx.fillStyle='rgba(0,0,0,0.88)'; ctx.fillRect(0,0,W,H);
    // Dark red eye glow
    const dg=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.5);
    dg.addColorStop(0,'rgba(120,0,0,0.35)'); dg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=dg; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.save(); ctx.shadowColor='#800010'; ctx.shadowBlur=16;
    ctx.fillStyle='#8c0010'; ctx.font=`bold 40px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText('The Ring is Lost',W/2,H/2-115);
    ctx.restore();
    const DEATH_QUOTES = [
      '"I wish the Ring had never come to me."',
      '"You cannot pass -- and yet you did not."',
      '"Do not look into the Mirror again."',
      '"The lights have taken you."',
      '"The Gate is shut. There is no way in."',
      '"She hunts by feel, by smell. She found you."',
      '"The Ring screamed to be used. You hesitated."',
      '"The war is lost. The Eye turns south."',
      '"So close. So close to the fire."',
    ];
    ctx.fillStyle='rgba(160,80,40,0.8)'; ctx.font=`italic 13px serif`;
    ctx.fillText(DEATH_QUOTES[lvl]||'"All hope is gone."',W/2,H/2-80);
    // Journey map showing how far they got
    ctx.fillStyle='rgba(80,40,20,0.3)'; ctx.fillRect(W/2-200,H/2-62,400,20);
    drawJourneyMap(ctx,W,H/2-52,lvl);
    // Stats box
    ctx.strokeStyle='rgba(140,60,30,0.4)'; ctx.lineWidth=1;
    ctx.strokeRect(W/2-160,H/2-32,320,90);
    const book=LEVEL_DEFS[lvl]?.book||'?';
    const levelTitle=LEVEL_DEFS[lvl]?.title||'?';
    const rows=[
      [`Fell in: ${levelTitle}`, 'rgba(200,140,60,0.9)', 'bold 13px serif'],
      [`Score: ${Math.floor(score).toLocaleString()}  --  Round ${rnd}`, 'rgba(220,180,80,0.95)', 'bold 20px "Palatino Linotype",Palatino,Georgia,serif'],
    ];
    rows.forEach(([txt,col,font],i)=>{
      ctx.fillStyle=col; ctx.font=font;
      ctx.fillText(txt,W/2,H/2-14+i*30);
    });
    if(Math.sin(t*2.2)>0){
      ctx.fillStyle='rgba(180,80,40,0.85)'; ctx.font='bold 14px serif';
      const lvlNames2=['Shire','Moria','Lorien','Marshes','Black Gate','Shelob','Morgul','Pelennor','Mt.Doom'];
      if(checkpoint>0){
        ctx.fillStyle='rgba(180,140,60,0.9)'; ctx.font='bold 13px serif';
        ctx.fillText(`C — Continue from ${lvlNames2[checkpoint]}`,W/2,H/2+68);
        ctx.fillStyle='rgba(140,100,40,0.65)'; ctx.font='11px serif';
        ctx.fillText('SPACE — Start over from The Shire',W/2,H/2+86);
      } else {
        ctx.fillStyle='rgba(180,100,40,0.85)'; ctx.font='bold 13px serif';
        ctx.fillText('— SPACE to try again —',W/2,H/2+82);
      }
    }
  }

  function drawScreen(ctx, W, H, title, sub, hint2, t, isDeath) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = `bold 38px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillStyle = isDeath ? '#8c0010' : '#d4a020';
    ctx.fillText(title, W/2, H/2 - 72);
    ctx.font = `italic 13px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillStyle = '#9a7030';
    ctx.fillText(sub, W/2, H/2 - 26);
    ctx.font = '13px serif'; ctx.fillStyle = 'rgba(175,132,68,0.85)';
    ctx.fillText(hint2, W/2, H/2 + 20);
    if (Math.sin(t*2.4)>0){
      ctx.fillStyle='#c89040'; ctx.font='bold 14px serif';
      ctx.fillText('— Press SPACE to begin —', W/2, H/2 + 60);
    }
  }

})();
