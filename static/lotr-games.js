/**
 * LOTR Easter-Egg — Carry the Ring
 * Triggered by: ↑↑↓↓←→←→BA (Konami code)
 *
 * A 3-level dodge game across a scrolling 2× world with parallax backgrounds.
 *
 * Level 1 — The Fellowship of the Ring
 *   Shire → Rivendell. 3–5 Nazgûl. Gentle Eye. Green palette.
 *
 * Level 2 — The Two Towers
 *   Emyn Muil / Dead Marshes. 4–7 Nazgûl + Gollum. Eye wakes often.
 *
 * Level 3 — The Return of the King
 *   Full Mordor. 6–10 Nazgûl + Gollum. Eye barely rests.
 *   Ring corruption causes random blind flashes at high progress.
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

  function makeCloseBtn(ov, closeFn) {
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = 'Close (Esc)';
    Object.assign(btn.style, {
      position: 'absolute',
      top: '10px', left: '10px',
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(180,130,50,0.35)',
      color: 'rgba(180,130,50,0.65)',
      width: '32px', height: '32px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '10',
    });
    btn.onclick = closeFn;
    ov.appendChild(btn);
    const onKey = e => { if (e.key === 'Escape') { closeFn(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    return btn;
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
    {
      // Level 1 — The Fellowship of the Ring
      title:       'The Fellowship of the Ring',
      subtitle:    '"Even the smallest person can change the course of the future."',
      destination: 'Rivendell',
      bgSky:   ['#05060a','#0c1218'],
      bgGnd:   ['#142010','#0c180a'],
      roadCol: 'rgba(55,70,30,0.9)',
      horizon: '#1a280e',
      glow:    [80,160,40],  // RGB of the horizon glow
      glowAlpha: 0.18,
      destGlow:[80,160,40],
      initWraiths: 3,
      maxWraiths:  5,
      wraithSpeed: 1.2,
      eyeIdleBase: 18,
      eyeActiveDur: 6,
      spawnMin: 4,
      hasGollum: false,
      hasBlindFlash: false,
      flavour: ['The Shire grows distant...','The Road goes ever on...','Rivendell is near...','Almost there...'],
      winMsg:  'The Fellowship is complete.',
      winQuote:'"One ring to rule them all..."',
      progressLabel: 'THE ROAD TO RIVENDELL',
    },
    {
      // Level 2 — The Two Towers
      title:       'The Two Towers',
      subtitle:    '"There is some good in this world, and it\'s worth fighting for."',
      destination: 'Emyn Muil',
      bgSky:   ['#080610','#0e0c18'],
      bgGnd:   ['#1a1508','#100e06'],
      roadCol: 'rgba(60,50,20,0.9)',
      horizon: '#1e1a0a',
      glow:    [160,120,40],
      glowAlpha: 0.22,
      destGlow:[200,100,20],
      initWraiths: 4,
      maxWraiths:  7,
      wraithSpeed: 1.55,
      eyeIdleBase: 12,
      eyeActiveDur: 8,
      spawnMin: 2.8,
      hasGollum: true,
      hasBlindFlash: false,
      flavour: ['Gollum circles in the shadows...','The marshes pull at every step...','Something precious is near...','We musst go on, yess...'],
      winMsg:  'You have escaped the Emyn Muil.',
      winQuote:'"Not all those who wander are lost."',
      progressLabel: 'THE MARSHES OF EMYN MUIL',
    },
    {
      // Level 3 — The Return of the King
      title:       'The Return of the King',
      subtitle:    '"I can\'t carry it for you... but I can carry you!"',
      destination: 'Mount Doom',
      bgSky:   ['#04020a','#0e0408'],
      bgGnd:   ['#1c0a04','#0c0602'],
      roadCol: 'rgba(65,30,10,0.9)',
      horizon: '#1e0a04',
      glow:    [255,50,5],
      glowAlpha: 0.45,
      destGlow:[255,60,0],
      initWraiths: 6,
      maxWraiths:  10,
      wraithSpeed: 2.0,
      eyeIdleBase: 7,
      eyeActiveDur: 12,
      spawnMin: 1.8,
      hasGollum: true,
      hasBlindFlash: true,
      flavour: ['Every step is agony...','The Eye sees all...','The Ring commands you to stop...','Throw it in the fire!'],
      winMsg:  'It is done.',
      winQuote:'"My precious..."',
      progressLabel: 'THE ROAD TO MOUNT DOOM',
    },
  ];

  function launchCarryTheRing() {
    const ov = makeOverlay('#060309');
    const isTouch = 'ontouchstart' in window;

    // ── Size: maximise canvas, reserve just what controls need ──────────────
    // On mobile: full width, full height minus close btn (36px) and dash btn (80px)
    // On desktop: up to 1200×700
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const reserveH = isTouch ? 36 + 80 : 36 + 16; // close + (dash or margin)
    const maxW = isTouch ? vw         : Math.min(vw, 1200);
    const maxH = isTouch ? vh - reserveH : Math.min(vh - reserveH, 700);
    // Pick largest size that fits both width and 5:3 aspect ratio
    const W = maxW, H = Math.min(maxH, Math.round(maxW * 3 / 5));
    const WORLD_W = W * 2;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; ov.remove(); }
    makeCloseBtn(ov, close);

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
      keys[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      // Keyboard movement clears pointer target so both inputs don't fight
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
    let frodo, wraiths=[], gollum=null, particles=[], eye=null, shake={x:0,y:0}, timers={elapsed:0};
    let blindFlash = 0, levelTransTimer = 0;
    let lifePickup = null;  // {x,y,r,pulse}
    let keyPickup = null;   // {x,y,r,pulse} — must collect before goal unlocks
    let goalUnlocked = false;
    let dashCharges = 3;    // shared across all levels
    let dashRefill = null;  // {x,y,r,pulse} — refill token near Gollum's zone
    let dash = null;        // {vx,vy,timer} — active dash state

    // Difficulty multiplier per round (caps to avoid impossible)
    function diffMult() { return 1 + (round - 1) * 0.18; }

    function startLevel(lvl) {
      currentLevel = lvl;
      const def = LEVEL_DEFS[lvl];
      const prevLives = frodo ? frodo.lives : 3;
      frodo = {
        x: 80, y: H*0.62, r: 11,
        lives: (state === 'title' || round === 1 && lvl === 0) ? 3 : prevLives,
        invincible: false, invTimer: 0, hitFlash: 0, ringAngle: 0,
      };
      wraiths = [];
      // Spread initial wraiths across the world — last third near the goal
      const initCount = Math.min(def.initWraiths + Math.floor((round-1)*0.8), def.maxWraiths);
      for (let i = 0; i < initCount; i++) spawnWraith(def, i, initCount);
      gollum = def.hasGollum ? makeGollum() : null;
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
      if (state === 'title') dashCharges = 3; // only reset on fresh game
      // Key spawns at a random mid-field position, away from start and goal
      const kx = 300 + Math.random() * (WORLD_W - 700);
      const ky = H * 0.2 + Math.random() * (H * 0.6);
      keyPickup = { x: kx, y: ky, r: 14, pulse: 0, spawned: false, spawnTimer: 1 };
      state = 'playing';
    }

    function makeGollum() {
      return {
        x: W + 40, y: H*0.58,
        r: 9, speed: 2.4,
        wanderAngle: Math.PI, wanderTimer: 0,
        phase: 'lurk', // 'lurk' | 'dart'
        dartTimer: 0, dartCD: 5 + Math.random()*4,
        capePhase: 0,
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
        y = H * 0.25 + Math.random() * (H * 0.65);
      } else {
        // Dynamic spawn: near Frodo
        const baseX = frodo ? frodo.x : W/2;
        const edge = Math.floor(Math.random()*3);
        if (edge===0) { x=Math.max(40,Math.min(WORLD_W-40,baseX+(Math.random()-0.5)*700)); y=-35; }
        else if (edge===1) { x=Math.max(40,Math.min(WORLD_W-40,baseX+(Math.random()-0.5)*700)); y=H+35; }
        else { x=Math.random()<0.5 ? baseX-450-Math.random()*100 : baseX+450+Math.random()*100; x=Math.max(-35,Math.min(WORLD_W+35,x)); y=H*0.35+Math.random()*H*0.5; }
      }
      const spd = def.wraithSpeed * diffMult() * (0.9 + Math.random()*0.3);
      wraiths.push({x,y,r:14,wanderAngle:Math.random()*Math.PI*2,wanderTimer:0,
                    speed:spd,capePhase:Math.random()*Math.PI*2});
    }

    const GOAL = { x: WORLD_W - 120, y: Math.round(H * 0.15), r: 22 };
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
    const frodoSpd = (def) => (3.4 - progress()*2.2) * (currentLevel===2 ? 0.82 : 1);
    const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    const lerp  = (a,b,t) => a+(b-a)*t;

    let lastTs = 0;
    function loop(ts) {
      if (!alive) return;
      const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;
      const t = ts/1000;
      const def = LEVEL_DEFS[currentLevel] || LEVEL_DEFS[0];

      // ── UPDATE ──────────────────────────────────────────────────────
      if (state === 'playing') {
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
          if (currentLevel < 2) { state='levelwin'; levelTransTimer=0; }
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
            dashCharges = Math.min(3, dashCharges+1);
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
        const SENSE_RADIUS = 220; // px — Nazgûl sense the Ring within this range
        wraiths.forEach(w=>{
          w.capePhase+=dt*1.8; w.wanderTimer-=dt;
          const d2frodo = dist(frodo, w);
          const sensing = d2frodo < SENSE_RADIUS;
          // sense intensity 0→1 as they close in
          w.sense = Math.max(0, Math.min(1, 1 - d2frodo / SENSE_RADIUS));

          if(eyeActive || sensing){
            // Lock on to Frodo — Eye-active gives full speed, sensing gives partial
            const a=Math.atan2(frodo.y-w.y,frodo.x-w.x);
            const huntMult = eyeActive ? 1.9 : 0.9 + w.sense * 0.7;
            // When very close, cap speed so Frodo can always escape by moving
            const closePenalty = d2frodo < 120 ? Math.max(0.5, d2frodo/120) : 1;
            w.x+=Math.cos(a)*w.speed*huntMult*closePenalty*60*dt;
            w.y+=Math.sin(a)*w.speed*huntMult*closePenalty*60*dt;
          } else {
            if(w.wanderTimer<=0){
              w.wanderAngle=Math.atan2(frodo.y-w.y,frodo.x-w.x)+(Math.random()-0.5)*Math.PI*1.6;
              w.wanderTimer=1.2+Math.random()*2;
            }
            w.x+=Math.cos(w.wanderAngle)*w.speed*0.85*60*dt;
            w.y+=Math.sin(w.wanderAngle)*w.speed*0.85*60*dt;
          }
          if(w.x<-80||w.x>WORLD_W+80||w.y<-80||w.y>H+80){
            const tx=frodo?frodo.x:W/2;
            w.wanderAngle=Math.atan2(H*0.55-w.y,tx-w.x)+(Math.random()-0.5)*0.6;
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
          if (gollum.phase==='lurk') {
            // Orbit off to the side, approach slowly
            gollum.wanderTimer-=dt;
            if(gollum.wanderTimer<=0){
              gollum.wanderAngle=Math.atan2(frodo.y-gollum.y,frodo.x-gollum.x)+(Math.random()-0.5)*1.8;
              gollum.wanderTimer=1.5+Math.random()*2.5;
            }
            gollum.x+=Math.cos(gollum.wanderAngle)*gollum.speed*0.6*60*dt;
            gollum.y+=Math.sin(gollum.wanderAngle)*gollum.speed*0.6*60*dt;
            // Keep in bounds
            gollum.x=Math.max(-20,Math.min(WORLD_W+20,gollum.x));
            gollum.y=Math.max(H*0.25,Math.min(H,gollum.y));
            if(gollum.dartTimer<=0){
              gollum.phase='dart'; gollum.dartTimer=0.8;
            }
          } else {
            // Dart straight at Frodo
            const a=Math.atan2(frodo.y-gollum.y,frodo.x-gollum.x);
            gollum.x+=Math.cos(a)*gollum.speed*2.2*60*dt;
            gollum.y+=Math.sin(a)*gollum.speed*2.2*60*dt;
            if(gollum.dartTimer<=0){ gollum.phase='lurk'; gollum.dartCD=4+Math.random()*4; gollum.dartTimer=gollum.dartCD; }
          }
          if(!frodo.invincible&&dist(frodo,gollum)<frodo.r+gollum.r){
            hitFrodo();
          }
        }

        // Spawn more wraiths
        timers.spawnCD-=dt;
        const want=def.initWraiths+Math.floor(progress()*(def.maxWraiths-def.initWraiths));
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
        if(!lifePickup && timers.pickupCD<=0 && frodo.lives<3) {
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
            frodo.lives = Math.min(3, frodo.lives+1);
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
        drawGoal(ctx,GOAL,def,t,progress(),80,H*0.62,goalUnlocked);
        if(keyPickup&&keyPickup.spawned) drawKeyPickup(ctx,keyPickup,t,currentLevel);
        if(lifePickup) drawLifePickup(ctx,lifePickup,t);
        if(dashRefill) drawDashRefill(ctx,dashRefill,t);
        if (gollum) drawGollum(ctx,gollum,eye);
        drawWraiths1(ctx,wraiths,eye);
        if (frodo) drawFrodo1(ctx,frodo,progress(),timers.elapsed);
        ctx.globalAlpha=1;
        particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life*2.5);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1;
        ctx.restore(); // end world-space
        // Screen-space overlays (no camera offset)
        if(eye&&eye.open>0.02) drawEye1(ctx,W,eye);
        if(eye&&eye.phase==='active'){ctx.fillStyle=`rgba(160,0,0,${eye.open*0.16})`;ctx.fillRect(0,0,W,H);}
        if(eye&&eye.phase==='warning'&&Math.random()>0.65){ctx.fillStyle=`rgba(200,50,0,${Math.random()*0.09})`;ctx.fillRect(0,0,W,H);}
        if(blindFlash>0){ctx.fillStyle=`rgba(255,200,50,${blindFlash*0.92})`;ctx.fillRect(0,0,W,H);}
        drawUILevel(ctx,W,H,frodo,progress(),eye,timers.elapsed,currentLevel,def,dashCharges,score,round);
        // Level intro overlay (first 3.5s)
        if(timers.elapsed < 3.5) {
          const fade = timers.elapsed < 0.5 ? timers.elapsed*2 : timers.elapsed > 2.8 ? (3.5-timers.elapsed)/0.7 : 1;
          ctx.save(); ctx.globalAlpha = fade * 0.88;
          ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,H/2-70,W,130);
          ctx.globalAlpha = fade;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          const badge=['I','II','III'][currentLevel];
          ctx.fillStyle='rgba(200,160,50,0.8)'; ctx.font='bold 11px serif';
          ctx.fillText(`BOOK ${badge}`,W/2,H/2-42);
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
      round = 1; score = 0; dashCharges = 3;
      frodo = null;
    }

    function triggerDash() {
      if (dashCharges <= 0 || dash) return;
      dashCharges--;
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
      frodo.lives--; frodo.invincible=true; frodo.invTimer=2.8; frodo.hitFlash=1;
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

  function drawGoal(ctx, goal, def, t, prog, startX, startY, unlocked) {
    const { x, y, r } = goal;
    const lvl = LEVEL_DEFS.indexOf(def);
    const pulse = unlocked ? 1 + Math.sin(t * 3) * 0.22 : 1;
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
      ctx.shadowColor = lvl===0 ? '#80e0ff' : lvl===1 ? '#a0c840' : '#ff6000';
      ctx.shadowBlur  = 28 * pulse;
      const ringAlpha = 0.6 + Math.sin(t*3)*0.3;
      ctx.strokeStyle = lvl===0 ? `rgba(180,230,255,${ringAlpha})` :
                        lvl===1 ? `rgba(160,210,80,${ringAlpha})` :
                                  `rgba(255,120,20,${ringAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI*2); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = 1;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      const [cr,cg2,cb] = lvl===0 ? [140,210,255] : lvl===1 ? [130,200,60] : [255,90,10];
      cg.addColorStop(0, `rgba(${cr},${cg2},${cb},0.6)`);
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg; ctx.fillRect(x-r*2.5, y-r*2.5, r*5, r*5);
      ctx.fillStyle = lvl===0 ? 'rgba(200,235,255,0.95)' :
                      lvl===1 ? 'rgba(180,220,80,0.95)' :
                                `rgba(255,${140+Math.floor(Math.sin(t*4)*30)},0,0.95)`;
      ctx.font = `bold ${Math.round(r*0.9)}px serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(lvl===0 ? '★' : lvl===1 ? '▲' : '🔥', x, y);
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
    STARS.forEach(s=>{
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
      // Dead Marshes: eerie lights spread across world
      for(let i=0;i<10;i++){
        const mx=80+i*185, my=H*0.6+Math.sin(t*0.6+i)*6;
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,18);
        mg.addColorStop(0,`rgba(100,180,80,${0.12+Math.sin(t+i)*0.06})`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-18,my-18,36,36);
      }
    } else {
      // Mordor: restore parallax transform first, then doom glow screen-space
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
  function drawGollum(ctx,g,eye) {
    ctx.save(); ctx.translate(g.x,g.y);
    const ea=eye&&eye.phase==='active';
    // Glow
    const gg=ctx.createRadialGradient(0,0,0,0,0,g.r*3.5);
    gg.addColorStop(0,'rgba(60,100,30,0.3)'); gg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gg; ctx.fillRect(-g.r*3.5,-g.r*3.5,g.r*7,g.r*7);
    // Crouched body
    ctx.fillStyle='#1e1e10';
    ctx.beginPath(); ctx.ellipse(0,2,g.r*0.7,g.r*0.85,0,0,Math.PI*2); ctx.fill();
    // Head (large, bald)
    ctx.fillStyle='#2a2a18';
    ctx.beginPath(); ctx.ellipse(0,-g.r*0.9,g.r*0.75,g.r*0.7,0,0,Math.PI*2); ctx.fill();
    // Big pale eyes
    ctx.save();
    ctx.shadowColor=ea?'#80ff20':'#60d010'; ctx.shadowBlur=5;
    ctx.fillStyle=ea?'#a0ff30':'#80e020';
    [-4,4].forEach(ex2=>{ ctx.beginPath(); ctx.ellipse(ex2,-g.r*0.9,2.5,3,0,0,Math.PI*2); ctx.fill(); });
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
    const badge=['I','II','III'][lvl];
    ctx.fillStyle='#c8a838'; ctx.font=`bold 11px serif`;
    ctx.fillText(`BOOK ${badge} COMPLETE`,W/2,H/2-100);
    ctx.fillStyle='#e8d060'; ctx.font=`bold 28px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.title,W/2,H/2-68);
    ctx.fillStyle='#e8c848'; ctx.font=`italic 16px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.winMsg,W/2,H/2-36);
    ctx.fillStyle='#a07830'; ctx.font=`italic 13px serif`;
    ctx.fillText(def.winQuote,W/2,H/2-8);
    // Stars for completed level
    for(let i=0;i<3;i++){
      const sx=W/2-44+i*44, sy=H/2+28;
      const lit=i<=lvl;
      ctx.save(); ctx.shadowColor='#ffcc20'; ctx.shadowBlur=lit?14:0;
      ctx.fillStyle=lit?'#ffd030':'rgba(80,60,20,0.4)';
      ctx.font='26px serif'; ctx.fillText('★',sx,sy); ctx.restore();
    }
    ctx.fillStyle='rgba(180,140,60,0.85)'; ctx.font='bold 14px serif';
    ctx.fillText(`SPACE → ${['Book II: The Two Towers','Book III: The Return of the King',''][lvl]}`,W/2,H/2+80);
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
  function drawUILevel(ctx,W,H,frodo,prog,eye,elapsed,lvl,def,dashCharges=0,score=0,round=1){
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
    const badge=['I','II','III'][lvl]||'';
    ctx.fillStyle='rgba(180,140,50,0.7)'; ctx.font='bold 11px serif';
    ctx.fillText(`BOOK ${badge}  ·  RND ${round}`, 10, 42);
    ctx.fillStyle='rgba(160,130,60,0.6)'; ctx.font='10px serif';
    ctx.fillText(`⭐ ${Math.floor(score)}`, 10, 56);
    // Lives
    for(let i=0;i<3;i++){const lx=W-22-i*24,lit=i<frodo.lives;
      ctx.save(); if(lit){ctx.shadowColor='#d4a020';ctx.shadowBlur=8;}
      ctx.strokeStyle=lit?'#d4a820':'#3a2810'; ctx.lineWidth=lit?2.2:1;
      ctx.beginPath(); ctx.arc(lx,19,8,0,Math.PI*2); ctx.stroke();
      if(lit){ctx.fillStyle='rgba(212,168,32,0.18)';ctx.beginPath();ctx.arc(lx,19,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
    // Dash charges (⚡ pips below lives)
    ctx.font='bold 11px serif'; ctx.textAlign='right';
    for(let i=0;i<3;i++){const lx=W-16-i*22,lit=i<dashCharges;
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

  function drawWraiths1(ctx,wraiths,eye){
    const ea=eye&&eye.phase==='active';
    wraiths.forEach(w=>{
      ctx.save(); ctx.translate(w.x,w.y);
      const sense = w.sense || 0;
      const alert = ea || sense > 0.15; // visually alert when sensing OR eye active
      const gc = ea ? [130,20,200] : sense>0.15 ? [100,15,160] : [55,10,100];
      const glowR = w.r*(3 + sense*1.5);
      const wg=ctx.createRadialGradient(0,0,0,0,0,glowR);
      wg.addColorStop(0,`rgba(${gc},${0.35+sense*0.35})`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(-glowR,-glowR,glowR*2,glowR*2);
      const wave=Math.sin(w.capePhase)*5;
      ctx.fillStyle=ea?'#1c0535':sense>0.15?'#130430':'#0e0220'; ctx.beginPath();
      ctx.moveTo(0,-w.r*1.1); ctx.lineTo(-w.r*1.3,w.r*0.4+wave); ctx.lineTo(0,w.r*2.1); ctx.lineTo(w.r*1.3,w.r*0.4-wave); ctx.closePath(); ctx.fill();
      ctx.fillStyle=ea?'#250842':sense>0.15?'#1a0535':'#130128'; ctx.beginPath(); ctx.ellipse(0,-w.r*0.9,w.r*0.82,w.r*0.92,0,0,Math.PI*2); ctx.fill();
      // Eyes: grow with sense intensity
      const eyeR = 1.5 + sense * 2.5;
      const eyeCol = ea ? '#ff50c0' : sense>0.6 ? '#ff3090' : sense>0.15 ? '#cc2060' : '#900060';
      const eyeGlow = ea ? '#ff20a0' : sense>0.15 ? '#aa1060' : '#600030';
      ctx.save(); ctx.shadowColor=eyeGlow; ctx.shadowBlur=4+sense*10; ctx.fillStyle=eyeCol;
      [-3.5,3.5].forEach(ex=>{
        ctx.beginPath(); ctx.arc(ex,-w.r*0.9,eyeR,0,Math.PI*2); ctx.fill();
      }); ctx.restore();
      ctx.restore();
    });
  }
  function drawFrodo1(ctx,frodo,prog,elapsed){
    ctx.save(); ctx.translate(frodo.x,frodo.y);
    if(frodo.invincible&&Math.floor(elapsed*10)%2===0) ctx.globalAlpha=0.35;
    const warmth=1-prog*0.72;
    const bg=ctx.createRadialGradient(0,0,0,0,0,frodo.r*3.5);
    bg.addColorStop(0,`rgba(195,155,70,${0.22*warmth})`); bg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=bg; ctx.fillRect(-frodo.r*3.5,-frodo.r*3.5,frodo.r*7,frodo.r*7);
    ctx.fillStyle=`hsl(25,${38-prog*15}%,${22-prog*9}%)`; ctx.beginPath(); ctx.ellipse(0,3,frodo.r*0.88,frodo.r*1.15,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=`hsl(28,${48-prog*12}%,${36-prog*12}%)`; ctx.beginPath(); ctx.arc(0,-frodo.r*0.75,frodo.r*0.72,0,Math.PI*2); ctx.fill();
    const rDist=frodo.r*1.4,rx=Math.cos(frodo.ringAngle)*rDist*0.6,ry=Math.sin(frodo.ringAngle)*rDist*0.35-frodo.r*0.55;
    const rglow=12+prog*10;
    ctx.save(); ctx.shadowColor=`rgba(255,180,20,${0.6+prog*0.4})`; ctx.shadowBlur=rglow;
    const rg=ctx.createRadialGradient(rx,ry,0,rx,ry,rglow*1.4);
    rg.addColorStop(0,`rgba(255,195,30,${0.35+prog*0.45})`); rg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rg; ctx.fillRect(rx-rglow*2,ry-rglow*2,rglow*4,rglow*4);
    ctx.strokeStyle=`hsl(45,90%,${55+prog*22}%)`; ctx.lineWidth=2.2+prog*1.5;
    ctx.beginPath(); ctx.arc(rx,ry,5.5+prog*2,0,Math.PI*2); ctx.stroke(); ctx.restore();
    if(frodo.hitFlash>0){ctx.fillStyle=`rgba(255,40,0,${frodo.hitFlash*0.55})`; ctx.beginPath(); ctx.arc(0,0,frodo.r*2.2,0,Math.PI*2); ctx.fill();}
    ctx.restore();
  }
  function drawEye1(ctx,W,eye){
    const ex=W/2,ey=62,ew=75,eh=32*eye.open;
    ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=40*eye.open;
    const og=ctx.createRadialGradient(ex,ey,0,ex,ey,ew*1.8);
    og.addColorStop(0,`rgba(255,70,0,${0.35*eye.open})`); og.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=og; ctx.fillRect(ex-ew*2,ey-ew,ew*4,ew*2); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey-eh,ex+ew,ey); ctx.quadraticCurveTo(ex,ey+eh,ex-ew,ey); ctx.closePath(); ctx.clip();
    const iris=ctx.createRadialGradient(ex,ey,1,ex,ey,ew);
    iris.addColorStop(0,'#ff2000'); iris.addColorStop(0.25,'#cc3500'); iris.addColorStop(0.6,'#882000'); iris.addColorStop(1,'#3a0800');
    ctx.fillStyle=iris; ctx.fillRect(ex-ew,ey-eh,ew*2,eh*2);
    const px=ex-ew*0.45+(ew*0.9)*Math.max(0,Math.min(1,eye.px/W));
    ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(px,ey,6,eh*0.82,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    ctx.strokeStyle=`rgba(210,80,0,${0.85*eye.open})`; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey-eh,ex+ew,ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex-ew,ey); ctx.quadraticCurveTo(ex,ey+eh,ex+ew,ey); ctx.stroke();
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
    const titles=LEVEL_DEFS.map((d,i)=>`${['I','II','III'][i]}: ${d.title}`);
    ctx.fillText(titles.join('   ·   '),W/2,H/2+114);

    // Lives + dash summary
    ctx.fillStyle='rgba(160,120,50,0.5)'; ctx.font='10px serif';
    ctx.fillText('3 lives  ·  3 dash charges  ·  lives carry between levels  ·  dash charges shared',W/2,H/2+134);

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
    const book=['I','II','III'][lvl]||'?';
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
