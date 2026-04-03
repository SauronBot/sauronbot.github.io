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
      bgSky:   ['#05060a','#0c1218'], bgGnd: ['#142010','#0c180a'],
      roadCol: 'rgba(55,70,30,0.9)', horizon: '#1a280e',
      glow: [80,160,40], glowAlpha: 0.18, destGlow: [80,160,40],
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
    function close() { alive = false; ov.remove(); }
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

    const keys = {};

    // ── Pointer follow (touch/mouse — Frodo follows finger/cursor) ───────────────
    let pointerTarget = null; // {x,y} in world space

    function pointerToWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const lx = (clientX - rect.left) * scaleX;
      const ly = (clientY - rect.top)  * scaleY;
      return { x: lx + cameraX, y: ly };
    }

    function handlePointerDown(e) {
      e.preventDefault();
      if (state !== 'playing') {
        if (state==='title') startLevel(0);
        else if (state==='levelwin') startLevel(currentLevel+1);
        else if (state==='gameover') { fullReset(); startLevel(0); }
        else if (state==='win') { round++; score+=200; startLevel(0); }
        return;
      }
      const pt = e.touches ? e.touches[0] : e;
      pointerTarget = pointerToWorld(pt.clientX, pt.clientY);
    }
    function handlePointerMove(e) {
      if (state !== 'playing' || !pointerTarget) return;
      e.preventDefault();
      const pt = e.touches ? e.touches[0] : e;
      pointerTarget = pointerToWorld(pt.clientX, pt.clientY);
    }
    function handlePointerUp(e) { pointerTarget = null; }

    canvas.addEventListener('touchstart', handlePointerDown, {passive:false});
    canvas.addEventListener('touchmove',  handlePointerMove, {passive:false});
    canvas.addEventListener('touchend',   handlePointerUp,   {passive:false});
    canvas.addEventListener('mousedown',  handlePointerDown);
    canvas.addEventListener('mousemove',  (e) => { if(e.buttons) handlePointerMove(e); });
    canvas.addEventListener('mouseup',    handlePointerUp);

    // ── Keyboard input ──────────────────────────────────────────────────────
    const MOVE_KEYS = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S']);
    const onKd = e => {
      if (pauseCtrl.isPaused()) return; // block input while paused
      keys[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (MOVE_KEYS.has(e.key)) pointerTarget = null;
      if (e.key === ' ') {
        if (state === 'title')    startLevel(0);
        else if (state === 'levelwin') startLevel(currentLevel + 1);
        else if (state === 'gameover') { fullReset(); startLevel(0); }
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
    let frodo, wraiths=[], gollum=null, balrog=null, shelob=null, particles=[], eye=null, shake={x:0,y:0}, timers={elapsed:0};
    let eyeDistracted=false, eyeDistractTimer=15, eyeEagleTimer=0, eagleParticles=[];
    let blindFlash = 0, levelTransTimer = 0;
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
      state = 'playing';
    }

    function makeGollum() {
      return {
        x: W + 40, y: H*0.58,
        r: 9, speed: 2.4,
        wanderAngle: Math.PI, wanderTimer: 0,
        phase: 'lurk', // 'lurk' | 'dart' | 'jump'
        dartTimer: 0, dartCD: 5 + Math.random()*4,
        capePhase: 0,
        jumpCD: 5 + Math.random()*3,
        jumpTimer: 0, jumpDuration: 0, jumpGroundY: 0, jumpPeakY: 0, jumpStartX: 0,
        jumpAttemptsLeft: 0,
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
      const nazgulCount = wraiths.filter(e=>e.type==='wraith').length;
      const isNazgul    = nazgulCount < 7;
      const eType = isNazgul ? 'wraith' : 'orc';
      const wr = eType==='orc' ? 10 : 14;
      const ws = eType==='orc' ? spd * 1.15 : spd;
      if (eType==='orc') y = Math.max(SKY_Y, Math.min(H-wr*2, y));
      wraiths.push({x,y,r:wr,wanderAngle:Math.random()*Math.PI*2,wanderTimer:0,
                    speed:ws,capePhase:Math.random()*Math.PI*2,type:eType});
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
      return (3.4 - progress()*2.2) * (currentLevel===8 ? 0.82 : 1) * mirrorSlow;
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
        // Score: points per second (scales with round + level)
        score += dt * (1 + currentLevel * 0.5) * round;
        const spd = frodoSpd(def);
        let dx=0,dy=0;
        if (keys['ArrowLeft']||keys['a']||keys['A']) dx-=1;
        if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
        if (keys['ArrowUp']||keys['w']||keys['W']) dy-=1;
        if (keys['ArrowDown']||keys['s']||keys['S']) dy+=1;
        if (dx&&dy){dx*=0.707;dy*=0.707;}
        // Pointer follow: steer toward finger/cursor (overrides keyboard direction)
        if (pointerTarget && !dash) {
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
          if (currentLevel < 8) { state='levelwin'; levelTransTimer=0; }
          else { state='win'; }
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
          if(eye.timer>=eye.warnDur){eye.phase='active';eye.timer=0;}
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

        // Wraiths
        const SENSE_RADIUS = Math.round(120 * areaScale); // scales with canvas size
        wraiths.forEach(w=>{
          w.capePhase+=dt*1.8; w.wanderTimer-=dt;
          const d2frodo = dist(frodo, w);
          const sensing = d2frodo < SENSE_RADIUS;
          // sense intensity 0→1 as they close in
          w.sense = Math.max(0, Math.min(1, 1 - d2frodo / SENSE_RADIUS));

          // Orcs stay on the ground (lower 60% of screen)
          const orcMinY = w.type==='orc' ? SKY_Y : 0;
          const targetY = w.type==='orc' ? Math.max(frodo.y, SKY_Y) : frodo.y;
          // Nazgûl on Fell Beast (sky) get +10% speed
          const skyBoost = (w.type==='wraith' && w.y < SKY_Y && !def.hasBalrog && !def.hasShelob) ? 1.1 : 1.0;

          if(eyeActive || sensing){
            // Eye active or sensing: hunt
            const a=Math.atan2(targetY-w.y,frodo.x-w.x);
            const huntMult = eyeActive ? 1.35 : 0.9 + w.sense * 0.5;
            const closePenalty = d2frodo < 120 ? Math.max(0.5, d2frodo/120) : 1;
            w.x+=Math.cos(a)*w.speed*huntMult*closePenalty*skyBoost*60*dt;
            w.y+=Math.sin(a)*w.speed*huntMult*closePenalty*skyBoost*60*dt;
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
            w.x+=Math.cos(w.wanderAngle)*w.speed*0.7*60*dt;
            w.y+=Math.sin(w.wanderAngle)*w.speed*0.7*60*dt;
          } else {
            // Nazgûl: loosely wander toward Frodo
            if(w.wanderTimer<=0){
              w.wanderAngle=Math.atan2(targetY-w.y,frodo.x-w.x)+(Math.random()-0.5)*Math.PI*1.6;
              w.wanderTimer=1.2+Math.random()*2;
            }
            w.x+=Math.cos(w.wanderAngle)*w.speed*0.85*skyBoost*60*dt;
            w.y+=Math.sin(w.wanderAngle)*w.speed*0.85*skyBoost*60*dt;
          }
          // Clamp orc Y to ground zone
          if(w.type==='orc') w.y = Math.max(orcMinY, Math.min(H-w.r, w.y));

          if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
            const tx=frodo?frodo.x:W/2;
            const ty=w.type==='orc'?H*0.65:H*0.55;
            w.wanderAngle=Math.atan2(ty-w.y,tx-w.x)+(Math.random()-0.5)*0.6;
            w.wanderTimer=2;
          }
          if(!frodo.invincible&&dist(frodo,w)<frodo.r+w.r){
            hitFrodo();
          }
        });

        // Gollum
        if (gollum) {
          gollum.capePhase += dt*3;
          gollum.dartTimer -= dt;
          gollum.jumpCD -= dt;
          const frodoInSky = frodo.y < SKY_Y;
          // Gollum is always slightly slower than Frodo (never catches him by speed alone)
          const gollumTopSpeed = frodoSpd(def) * 0.82;

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
          } else { // dart — Gollum's pounce: faster than Frodo's base, short duration
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
              frodo.lives = Math.max(0, frodo.lives - 2);
              frodo.invincible=true; frodo.invTimer=3.5; frodo.hitFlash=1;
              shake={x:0,y:0,dur:0.8,intensity:18};
              // Reset balrog 400px behind Frodo
              const backA = Math.atan2(frodo.y-balrog.y,frodo.x-balrog.x)+Math.PI;
              balrog.x = frodo.x + Math.cos(backA)*400;
              balrog.y = frodo.y;
              if (frodo.lives <= 0) { lastScore=score;lastRound=round;lastLevel=currentLevel; state='gameover'; }
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

        // Lothlórien — Eye glows silver-green instead of red
        // (handled in drawEye1 via def flag; here just soften its red tinge)
        // Minas Morgul — Eye never fully closes
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
            // Burst particles
            for(let i=0;i<12;i++){const a=(i/12)*Math.PI*2,s=2+Math.random()*2;
              particles.push({x:lifePickup.x,y:lifePickup.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,
                              life:0.6+Math.random()*0.3,size:3+Math.random()*3,color:'#d4a020'});}
            lifePickup = null;
          }
        }

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
        drawGoal(ctx,GOAL,def,t,progress(),80,H*0.62,goalUnlocked,currentLevel,H);
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
        drawWraiths1(ctx,wraiths,eye,H,SKY_Y,!!(def.hasBalrog||def.hasShelob));
        if (frodo) drawFrodo1(ctx,frodo,progress(),timers.elapsed);
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
        if(blindFlash>0){ctx.fillStyle=`rgba(255,200,50,${blindFlash*0.92})`;ctx.fillRect(0,0,W,H);}
        // Torch darkness (Moria + Shelob)
        if(def.hasBalrog||def.hasShelob){
          const fsx=frodo.x-cameraX, fsy=frodo.y;
          const torchR=90-progress()*20;
          const dark=ctx.createRadialGradient(fsx,fsy,torchR*0.25,fsx,fsy,torchR*2.8);
          dark.addColorStop(0,'rgba(0,0,0,0)');
          dark.addColorStop(0.55,'rgba(0,0,0,0.65)');
          dark.addColorStop(1,'rgba(0,0,0,0.97)');
          ctx.fillStyle=dark; ctx.fillRect(0,0,W,H);
        }
        // Black Gate — first sight of the Eye
        if(currentLevel===4&&eye.phase==='active'&&timers.elapsed<20&&Math.sin(timers.elapsed*2)>0){
          ctx.save(); ctx.shadowColor='#ff2200'; ctx.shadowBlur=10;
          ctx.fillStyle='rgba(220,60,0,0.9)'; ctx.font='bold 12px serif';
          ctx.textAlign='center';
          ctx.fillText('THE EYE OF SAURON — FIRST SIGHT',W/2,48);
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
        drawUILevel(ctx,W,H,frodo,progress(),eye,timers.elapsed,currentLevel,def,dashCharges,score,round,GOD_MODE,maxLives(),maxDash());
        // Level intro overlay (first 3.5s)
        if(timers.elapsed < 3.5) {
          const fade = timers.elapsed < 0.5 ? timers.elapsed*2 : timers.elapsed > 2.8 ? (3.5-timers.elapsed)/0.7 : 1;
          ctx.save(); ctx.globalAlpha = fade * 0.88;
          ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,H/2-70,W,130);
          ctx.globalAlpha = fade;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          const badge=def.book||['I','II','III'][currentLevel]||'I';
          ctx.fillStyle='rgba(200,160,50,0.8)'; ctx.font='bold 11px serif';
          ctx.fillText(`BOOK ${badge} · CH.${def.chapter||'?'}`,W/2,H/2-42);
          ctx.fillStyle='#e8d060'; ctx.font=`bold 26px "Palatino Linotype",Palatino,Georgia,serif`;
          ctx.fillText(def.title,W/2,H/2-16);
          ctx.fillStyle='rgba(180,140,60,0.75)'; ctx.font=`italic 12px serif`;
          ctx.fillText(def.subtitle,W/2,H/2+16);
          ctx.restore();
        }
      }

      if(state==='title') {
        drawTitleScreen(ctx,W,H,t);
      }
      if(state==='levelwin') drawLevelWin(ctx,W,H,def,currentLevel,t,levelTransTimer);
      if(state==='gameover') drawGameOver(ctx,W,H,t,lastScore,lastRound,lastLevel);
      if(state==='win')      drawFinalWin(ctx,W,H,t,round,score);

      ctx.restore();
      requestAnimationFrame(loop);
    }

    function fullReset() {
      // lastScore/lastRound/lastLevel already captured in hitFrodo()
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

  function drawGoal(ctx, goal, def, t, prog, startX, startY, unlocked, currentLvl=0, H=580) {
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
        const tx=x+ox, th=H-y+r*1.5, ty=y+r*0.5;
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
      ctx.shadowBlur  = 28 * pulse;
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

    // Level atmosphere: parallax 0.45x mid-ground
    ctx.save(); ctx.translate(-cameraX*0.45, 0);
    if (def === LEVEL_DEFS[0]) {
      // Shire: rolling green hills and scattered trees
      ctx.fillStyle='#1e3a12';
      ctx.beginPath(); ctx.arc(60,H*0.48,55,Math.PI,0); ctx.fill();
      [W*0.28,W*0.52,W*0.78,W*1.05,W*1.35,W*1.6,W*1.85].forEach(tx=>{
        ctx.fillStyle='#1a3010';
        ctx.beginPath(); ctx.arc(tx,H*0.46,22+Math.sin(tx)*4,Math.PI,0); ctx.fill();
        ctx.fillStyle='#162808'; ctx.fillRect(tx-3,H*0.46,6,14);
      });
    } else if (def === LEVEL_DEFS[1]) {
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
      // Stone columns
      for(let i=0;i<8;i++){
        const cx=120+i*240, cw=32;
        const cg=ctx.createLinearGradient(cx,H*0.35,cx+cw,H*0.35);
        cg.addColorStop(0,'#1a1210'); cg.addColorStop(0.5,'#2a1e18'); cg.addColorStop(1,'#141008');
        ctx.fillStyle=cg; ctx.fillRect(cx,H*0.35,cw,H*0.65);
        // Column cap
        ctx.fillStyle='#221a14'; ctx.fillRect(cx-4,H*0.35,cw+8,8);
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
    } else if (def === LEVEL_DEFS[2]) {
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
    } else if (def === LEVEL_DEFS[3]) {
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
    } else if (def === LEVEL_DEFS[4]) {
      // Black Gate: fortress walls + forge fires + orc patrol dust
      // Ground dust clouds
      for(let i=0;i<8;i++){
        const dx=60+i*240+Math.sin(t*0.4+i)*30, dy=H*0.56;
        const dg=ctx.createRadialGradient(dx,dy,0,dx,dy,30);
        dg.addColorStop(0,`rgba(60,30,10,${0.08+Math.sin(t*0.6+i)*0.04})`);
        dg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=dg; ctx.fillRect(dx-30,dy-12,60,20);
      }
      // Battlements (parallax 0.2x via translate above)
      ctx.save(); ctx.translate(-cameraX*(0.2-0.45), 0); // adjust for outer translate
      const battleH = H*0.32;
      for(let i=0;i<6;i++){
        const bx=i*320-80;
        ctx.fillStyle='#1a0c08'; ctx.fillRect(bx,battleH,280,H*0.2);
        // Battlements
        for(let j=0;j<7;j++) ctx.fillRect(bx+j*38,battleH-22,24,22);
        // Arrow slits
        ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='rgba(200,60,0,0.5)';
        for(let j=0;j<3;j++) ctx.fillRect(bx+50+j*80,battleH+10,6,16);
        ctx.restore();
      }
      ctx.restore();
      // Forge fires / smokestacks
      for(let i=0;i<8;i++){
        const fx=100+i*248;
        ctx.fillStyle='#1a0c08'; ctx.fillRect(fx,H*0.36,12,H*0.16); // stack
        // Fire glow at top
        const fg=ctx.createRadialGradient(fx+6,H*0.36,0,fx+6,H*0.36,28);
        fg.addColorStop(0,`rgba(255,120,0,${0.4+Math.sin(t*2.5+i)*0.15})`);
        fg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=fg; ctx.fillRect(fx-22,H*0.2,56,H*0.2);
      }
    } else if (def === LEVEL_DEFS[5]) {
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
    } else if (def === LEVEL_DEFS[6]) {
      // Minas Morgul: undead city, green-lit towers, pulsing light-beam
      // City walls (parallax adjustment)
      ctx.save(); ctx.translate(-cameraX*(0.2-0.45), 0);
      for(let i=0;i<5;i++){
        const cx=i*400-100, cw=200;
        ctx.fillStyle='#060e06';
        ctx.fillRect(cx,H*0.28,cw,H*0.25);
        // Towers
        ctx.fillStyle='#040c04';
        ctx.fillRect(cx-12,H*0.18,28,H*0.35);
        ctx.fillRect(cx+cw-16,H*0.20,28,H*0.32);
        // Green-lit windows
        for(let j=0;j<4;j++){
          const wx=cx+30+j*40, wy=H*0.30+Math.floor(j/2)*20;
          ctx.save(); ctx.shadowColor='#40ff80'; ctx.shadowBlur=6;
          ctx.fillStyle=`rgba(40,200,80,${0.3+Math.sin(t*1.5+i+j)*0.15})`;
          ctx.fillRect(wx,wy,6,10); ctx.restore();
        }
        // Tower beam of light (like the Morgul beacon)
        if(i===2){
          ctx.save(); ctx.shadowColor='#40ff80'; ctx.shadowBlur=14;
          const bAlpha=0.15+Math.sin(t*0.5)*0.08;
          const bg=ctx.createLinearGradient(cx+cw*0.5,H*0.18,cx+cw*0.5+H*0.25,0);
          bg.addColorStop(0,`rgba(40,200,80,${bAlpha})`);
          bg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=bg;
          ctx.beginPath(); ctx.moveTo(cx+cw*0.5,H*0.18); ctx.lineTo(cx+cw*0.5+30,0); ctx.lineTo(cx+cw*0.5+H*0.35,0); ctx.lineTo(cx+cw*0.5+H*0.2,H*0.18); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
      // Constant green glow
      ctx.restore(); // end parallax
      const gg=ctx.createRadialGradient(W,H*0.45,0,W,H*0.45,W*0.8);
      gg.addColorStop(0,`rgba(40,200,80,${0.18+Math.sin(t*0.8)*0.05})`);
      gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gg; ctx.fillRect(0,0,W,H);
      return; // already restored
    } else if (def === LEVEL_DEFS[7]) {
      // Pelennor Fields: battlefield smoke + fires + siege engines
      // Distant battle fires
      ctx.save(); ctx.translate(-cameraX*(0.15-0.45), 0);
      for(let i=0;i<18;i++){
        const fx=50+i*110, fy=H*0.48+Math.sin(i*1.3)*H*0.04;
        const fg=ctx.createRadialGradient(fx,fy,0,fx,fy,14+Math.sin(t*2+i)*4);
        fg.addColorStop(0,`rgba(255,100,0,${0.3+Math.sin(t*2+i)*0.12})`);
        fg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=fg; ctx.fillRect(fx-18,fy-18,36,36);
      }
      // Siege engine silhouettes (catapults)
      [200,550,980,1400].forEach(sx=>{
        ctx.fillStyle='#1a0a08';
        // Arm
        ctx.save(); ctx.translate(sx,H*0.49);
        ctx.rotate(-0.6+Math.sin(t*0.3+sx*0.003)*0.15);
        ctx.fillRect(-3,-35,6,40);
        ctx.fillRect(-12,-3,24,6); // beam
        ctx.restore();
        // Base
        ctx.fillStyle='#120806';
        ctx.fillRect(sx-18,H*0.49,36,12);
        // Wheels
        ctx.strokeStyle='#1a0e0a'; ctx.lineWidth=3;
        [-10,10].forEach(ox=>{ ctx.beginPath(); ctx.arc(sx+ox,H*0.51,6,0,Math.PI*2); ctx.stroke(); });
      });
      ctx.restore();
      // Smoke wisps on ground
      for(let i=0;i<10;i++){
        const sx=100+i*200, sy=H*0.56+Math.sin(t*0.6+i)*8;
        const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,35);
        sg.addColorStop(0,`rgba(60,50,50,${0.12+Math.sin(t*0.4+i)*0.05})`);
        sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=sg; ctx.fillRect(sx-35,sy-20,70,35);
      }
    } else {
      // Mordor (Mount Doom): restore parallax transform first, then doom glow screen-space
      ctx.restore();
      if(prog>0){
        const g2=ctx.createRadialGradient(W,H*0.2,0,W,H*0.2,300+prog*120);
        g2.addColorStop(0,`rgba(255,60,0,${prog*0.28})`); g2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
      }
      return; // already restored
    }
    ctx.restore();
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

  // ── LEVEL WIN SCREEN ─────────────────────────────────────────────────
  function drawLevelWin(ctx,W,H,def,lvl,t,timer) {
    ctx.fillStyle=`rgba(0,0,0,${Math.min(0.82,timer*1.2)})`; ctx.fillRect(0,0,W,H);
    if(timer<0.5) return;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const fade=Math.min(1,(timer-0.5)*1.5);
    ctx.globalAlpha=fade;
    const badge=LEVEL_DEFS[lvl]?.book||['I','II','III'][lvl]||'I';
    ctx.fillStyle='#c8a838'; ctx.font=`bold 11px serif`;
    ctx.fillText(`BOOK ${badge} COMPLETE`,W/2,H/2-100);
    ctx.fillStyle='#e8d060'; ctx.font=`bold 28px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.title,W/2,H/2-68);
    ctx.fillStyle='#e8c848'; ctx.font=`italic 16px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.winMsg,W/2,H/2-36);
    ctx.fillStyle='#a07830'; ctx.font=`italic 13px serif`;
    ctx.fillText(def.winQuote,W/2,H/2-8);
    // Stars for completed book (1 star = Book I done, etc.)
    for(let i=0;i<3;i++){
      const sx=W/2-44+i*44, sy=H/2+28;
      const lit=i<=Math.floor(lvl/3);
      ctx.save(); ctx.shadowColor='#ffcc20'; ctx.shadowBlur=lit?14:0;
      ctx.fillStyle=lit?'#ffd030':'rgba(80,60,20,0.4)';
      ctx.font='26px serif'; ctx.fillText('★',sx,sy); ctx.restore();
    }
    ctx.fillStyle='rgba(180,140,60,0.85)'; ctx.font='bold 14px serif';
    const nextDef=LEVEL_DEFS[lvl+1]; ctx.fillText(nextDef?`SPACE → Book ${nextDef.book} Ch.${nextDef.chapter}: ${nextDef.title}`:'',W/2,H/2+80);
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
  function drawUILevel(ctx,W,H,frodo,prog,eye,elapsed,lvl,def,dashCharges=0,score=0,round=1,godMode=false,maxL=3,maxD=3){
    // Progress bar
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(10,10,210,18);
    const [dr,dg,db]=def.destGlow;
    const bar=ctx.createLinearGradient(10,0,220,0);
    bar.addColorStop(0,`rgb(${Math.floor(dr*0.3)},${Math.floor(dg*0.6)},${Math.floor(db*0.3)})`);
    bar.addColorStop(1,`rgb(${dr},${dg},${db})`);
    ctx.fillStyle=bar; ctx.fillRect(10,10,210*prog,18);
    ctx.strokeStyle='rgba(140,95,40,0.75)'; ctx.lineWidth=1; ctx.strokeRect(10,10,210,18);
    ctx.fillStyle='rgba(200,160,70,0.85)'; ctx.font='9px serif'; ctx.textAlign='left';
    ctx.fillText(def.progressLabel,13,23);
    // Level badge + round + score
    const badge=LEVEL_DEFS[lvl]?.book||['I','II','III'][lvl]||'';
    ctx.fillStyle='rgba(180,140,50,0.7)'; ctx.font='bold 11px serif';
    ctx.fillText(`BOOK ${badge}  ·  RND ${round}`, 10, 42);
    ctx.fillStyle='rgba(160,130,60,0.6)'; ctx.font='10px serif';
    ctx.fillText(`⭐ ${Math.floor(score)}`, 10, 56);
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
    const fi=Math.min(def.flavour.length-1,Math.floor(prog*(def.flavour.length)));
    if(prog>0.1){
      ctx.fillStyle=`rgba(200,138,38,${Math.min(1,(prog-0.1)*2.5)})`;
      ctx.font='italic 11px serif'; ctx.textAlign='center';
      ctx.fillText(def.flavour[fi],W/2,H-10);
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
      if (w.type==='orc')  { drawOrc(ctx,w,ea); ctx.restore(); return; }
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

  function drawFrodo1(ctx,frodo,prog,elapsed){
    ctx.save(); ctx.translate(frodo.x,frodo.y);
    if(frodo.invincible&&Math.floor(elapsed*10)%2===0) ctx.globalAlpha=0.4;
    const warmth=1-prog*0.72, r=frodo.r;
    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.2;
    const sg=ctx.createRadialGradient(0,r*1.5,0,0,r*1.5,r*2);
    sg.addColorStop(0,'rgba(0,0,0,0.8)'); sg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sg; ctx.beginPath(); ctx.ellipse(0,r*1.5,r*1.6,r*0.4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Warm glow
    const bg=ctx.createRadialGradient(0,0,0,0,0,r*4);
    bg.addColorStop(0,`rgba(195,155,70,${0.18*warmth})`); bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(-r*4,-r*4,r*8,r*8);
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
    // Hit flash
    if(frodo.hitFlash>0){ ctx.fillStyle=`rgba(255,50,0,${frodo.hitFlash*0.6})`;
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
    ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';

    // Title
    ctx.fillStyle='#d4a020'; ctx.font=`bold 42px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText('Carry the Ring',W/2,H/2-155);
    ctx.fillStyle='rgba(160,120,50,0.7)'; ctx.font=`italic 13px serif`;
    ctx.fillText('"Even the smallest person can change the course of the future."',W/2,H/2-118);

    // Divider
    ctx.strokeStyle='rgba(140,100,40,0.35)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(W/2-220,H/2-100); ctx.lineTo(W/2+220,H/2-100); ctx.stroke();

    // How to play — left column
    const col1=W/2-160, col2=W/2+30;
    const rowH=22, rowStart=H/2-82;
    const rows=[
      ['🔸 Move',      ('ontouchstart' in window) ? 'Touch & hold the screen' : 'WASD or Arrow keys'],
      ['🔸 Dash',      'SPACE / ⚡ button — burst of speed + invincibility'],
      ['🔑 Key',       'Collect within 1s to unlock the goal'],
      ['🔒 Goal',      'Reach it to complete the level'],
      ['♥  Life',      'Pickup restores 1 life (max 3)'],
      ['⚡ Dash +1',   'Refill token spawns after each use'],
      ['👁️  The Eye',   'Opens periodically — Nazgûl hunt you'],
      ['💀 Nazgûl',   'Sense the Ring nearby — eyes grow larger'],
    ];
    rows.forEach(([label,desc],i)=>{
      const y=rowStart+i*rowH;
      ctx.textAlign='right'; ctx.fillStyle='rgba(210,170,70,0.9)'; ctx.font='bold 11px serif';
      ctx.fillText(label,W/2-10,y);
      ctx.textAlign='left'; ctx.fillStyle='rgba(180,148,80,0.75)'; ctx.font='11px serif';
      ctx.fillText(desc,W/2+10,y);
    });

    // Divider
    ctx.strokeStyle='rgba(140,100,40,0.35)';
    ctx.beginPath(); ctx.moveTo(W/2-220,H/2+98); ctx.lineTo(W/2+220,H/2+98); ctx.stroke();

    // Level list
    ctx.textAlign='center'; ctx.font='11px serif'; ctx.fillStyle='rgba(160,120,50,0.55)';
    const titles=LEVEL_DEFS.map((d,i)=>`Book ${d.book} Ch.${d.chapter}: ${d.title}`);
    ctx.fillText(titles.join('   ·   '),W/2,H/2+114);

    // Lives + dash summary
    ctx.fillStyle='rgba(160,120,50,0.5)'; ctx.font='10px serif';
    ctx.fillText('3 lives + 3 dash charges (each +1 per round, max 5)  ·  9 levels across 3 books',W/2,H/2+134);

    // Start prompt
    if(Math.sin(t*2.4)>0){
      ctx.fillStyle='#c89040'; ctx.font='bold 15px serif';
      ctx.fillText('— Press SPACE to begin —',W/2,H/2+160);
    }
  }

  function drawGameOver(ctx,W,H,t,score,rnd,lvl) {
    ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#8c0010'; ctx.font=`bold 40px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText('The Ring is Lost',W/2,H/2-110);
    ctx.fillStyle='rgba(160,80,40,0.8)'; ctx.font=`italic 13px serif`;
    ctx.fillText('"All hope is gone. The Dark Lord has won."',W/2,H/2-75);
    // Stats box
    ctx.strokeStyle='rgba(140,60,30,0.4)'; ctx.lineWidth=1;
    ctx.strokeRect(W/2-160,H/2-52,320,110);
    const book=LEVEL_DEFS[lvl]?.book||'?'; const chapter=LEVEL_DEFS[lvl]?.chapter||'?';
    const rows=[
      [`Book ${book} — Round ${rnd}`, 'rgba(200,140,60,0.9)', 'bold 14px serif'],
      [`Score: ${Math.floor(score).toLocaleString()}`, 'rgba(220,180,80,0.95)', 'bold 22px "Palatino Linotype",Palatino,Georgia,serif'],
      [`Progress: ${['Fellowship','Two Towers','Return of the King'][lvl]}`, 'rgba(160,120,50,0.7)', '12px serif'],
    ];
    rows.forEach(([txt,col,font],i)=>{
      ctx.fillStyle=col; ctx.font=font;
      ctx.fillText(txt,W/2,H/2-28+i*30);
    });
    if(Math.sin(t*2.2)>0){
      ctx.fillStyle='rgba(180,80,40,0.85)'; ctx.font='bold 14px serif';
      ctx.fillText('— Press SPACE to try again from the beginning —',W/2,H/2+82);
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
