/**
 * LOTR Easter-Egg Games
 * Triggered by: ↑↑↓↓←→←→BA
 * Games: 1 = Carry the Ring, 2 = You Shall Not Pass, 3 = The Eye
 *        (random on each trigger)
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
        launchRandom();
      }
    } else {
      konamiIdx = (e.key === KONAMI[0]) ? 1 : 0;
    }
  });

  // ── LAUNCHER ──────────────────────────────────────────────────────────
  const GAMES = [launchCarryTheRing];
  function launchRandom() {
    const fn = GAMES[Math.floor(Math.random() * GAMES.length)];
    fn();
  }
  // Exposed for testing / manual trigger
  window.__lotrLaunch = (i) => (GAMES[i] || launchRandom)();

  // ── OVERLAY HELPERS ───────────────────────────────────────────────────
  function makeOverlay(bgColor) {
    window.__lotrActive = true;
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
      if (!document.body.contains(ov)) { window.__lotrActive = false; mo.disconnect(); }
    });
    mo.observe(document.body, { childList: true });
    return ov;
  }

  function makeCanvas(ov, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    function applyScale() {
      // Leave 80px for close button + d-pad on mobile
      const vw = window.innerWidth, vh = window.innerHeight - 140;
      const scale = Math.min(1, vw / w, vh / h);
      c.style.width  = (w * scale) + 'px';
      c.style.height = (h * scale) + 'px';
    }
    c.style.display = 'block';
    applyScale();
    // Re-scale on resize (rotation, window resize)
    const onResize = () => applyScale();
    window.addEventListener('resize', onResize);
    // Clean up on overlay removal
    const mo = new MutationObserver(() => {
      if (!document.body.contains(ov)) window.removeEventListener('resize', onResize);
    });
    mo.observe(document.body, { childList: true });
    ov.appendChild(c);
    return c;
  }

  function makeCloseBtn(ov, closeFn) {
    const btn = document.createElement('button');
    btn.textContent = '✕  Close (Esc)';
    Object.assign(btn.style, {
      marginTop: '12px', background: 'transparent',
      border: '1px solid rgba(180,130,50,0.4)', color: 'rgba(180,130,50,0.7)',
      padding: '5px 18px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '1px',
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
    const W = 960, H = 580;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; ov.remove(); }
    makeCloseBtn(ov, close);

    const keys = {};

    // ── Touch D-pad (mobile) ─────────────────────────────────────────
    const dpad = document.createElement('div');
    Object.assign(dpad.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 52px)',
      gridTemplateRows: 'repeat(3, 52px)',
      gap: '4px',
      marginTop: '10px',
      userSelect: 'none',
    });
    const DPAD_BTNS = [
      [null,       'ArrowUp',    null      ],
      ['ArrowLeft','ArrowDown',  'ArrowRight'],
      [null,       'ArrowDown',  null      ],
    ];
    // 3×3 grid: top-center=up, mid-left=left, mid-center=down, mid-right=right
    const dpadMap = [
      {col:2,row:1,key:'ArrowUp',   label:'▲'},
      {col:1,row:2,key:'ArrowLeft', label:'◀'},
      {col:2,row:2,key:'ArrowDown', label:'▼'},
      {col:3,row:2,key:'ArrowRight',label:'▶'},
    ];
    // Fill 3×3 with empty cells first
    for (let i=0;i<9;i++) {
      const cell = document.createElement('div');
      dpad.appendChild(cell);
    }
    dpadMap.forEach(({col,row,key,label}) => {
      const idx = (row-1)*3 + (col-1);
      const btn = document.createElement('button');
      btn.textContent = label;
      Object.assign(btn.style, {
        width:'52px', height:'52px', background:'rgba(120,90,30,0.25)',
        border:'1px solid rgba(180,130,50,0.4)', borderRadius:'8px',
        color:'rgba(200,160,60,0.9)', fontSize:'18px', cursor:'pointer',
        touchAction:'none',
      });
      const start = (e) => { e.preventDefault(); keys[key]=true;
        if(state!=='playing'){
          if(state==='title') startLevel(0);
          else if(state==='levelwin') startLevel(currentLevel+1);
          else if(state==='gameover'){ if(frodo)frodo.lives=2; startLevel(0); }
          else if(state==='win') startLevel(0);
        }
      };
      const stop  = (e) => { e.preventDefault(); keys[key]=false; };
      btn.addEventListener('touchstart', start, {passive:false});
      btn.addEventListener('touchend',   stop,  {passive:false});
      btn.addEventListener('mousedown',  start);
      btn.addEventListener('mouseup',    stop);
      btn.addEventListener('mouseleave', stop);
      dpad.replaceChild(btn, dpad.children[idx]);
    });
    ov.appendChild(dpad);
    // Hide D-pad on non-touch devices
    if (!('ontouchstart' in window)) dpad.style.display = 'none';

    const onKd = e => {
      keys[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.key === ' ') {
        if (state === 'title')    startLevel(0);
        else if (state === 'levelwin') startLevel(currentLevel + 1);
        else if (state === 'gameover') { if(frodo) frodo.lives=2; startLevel(0); }
        else if (state === 'win') startLevel(0);
      }
    };
    const onKu = e => { keys[e.key] = false; };
    document.addEventListener('keydown', onKd);
    document.addEventListener('keyup',  onKu);
    ov.addEventListener('remove', () => {
      document.removeEventListener('keydown', onKd);
      document.removeEventListener('keyup',  onKu);
    });
    // Tap canvas to start on mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (state !== 'playing') {
        if (state==='title') startLevel(0);
        else if (state==='levelwin') startLevel(currentLevel+1);
        else if (state==='gameover') { if(frodo)frodo.lives=2; startLevel(0); }
        else if (state==='win') startLevel(0);
      }
    }, {passive:false});

    let state = 'title';
    let currentLevel = 0;
    let frodo, wraiths=[], gollum=null, particles=[], eye=null, shake={x:0,y:0}, timers={elapsed:0};
    let blindFlash = 0, levelTransTimer = 0;
    let lifePickup = null; // {x,y,r,pulse,spawnTimer}

    function startLevel(lvl) {
      currentLevel = lvl;
      const def = LEVEL_DEFS[lvl];
      const prevLives = frodo ? frodo.lives : 3;
      frodo = {
        x: 80, y: H*0.62, r: 11,
        lives: (state === 'title') ? 3 : prevLives,
        invincible: false, invTimer: 0, hitFlash: 0, ringAngle: 0,
      };
      wraiths = [];
      for (let i = 0; i < def.initWraiths; i++) spawnWraith(def);
      gollum = def.hasGollum ? makeGollum() : null;
      particles = [];
      eye = {
        phase: 'idle', timer: 0, open: 0,
        idleDur: def.eyeIdleBase + Math.random()*6,
        activeDur: def.eyeActiveDur,
        warnDur: 2.2, closeDur: 1.5,
        px: W/2, py: 65,
      };
      shake = {x:0,y:0,dur:0,intensity:0};
      timers = {elapsed:0,spawnCD:0,pickupCD:3};
      blindFlash = 0;
      lifePickup = null;
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

    function spawnWraith(def) {
      const edge = Math.floor(Math.random()*3);
      let x, y;
      if (edge===0) { x=40+Math.random()*(W-80); y=-35; }
      else if (edge===1) { x=40+Math.random()*(W-80); y=H+35; }
      else { x=-35; y=H*0.35+Math.random()*H*0.5; }
      const spd = def.wraithSpeed * (0.9 + Math.random()*0.3);
      wraiths.push({x,y,r:14,wanderAngle:Math.random()*Math.PI*2,wanderTimer:0,
                    speed:spd,capePhase:Math.random()*Math.PI*2});
    }

    const GOAL = { x: 890, y: 90, r: 22 };
    const progress = () => {
      if (!frodo) return 0;
      // X-axis progress toward goal — simple, stable, no NaN/negative risk
      return Math.max(0, Math.min(1, (frodo.x - 80) / (GOAL.x - 80)));
    };
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
        const spd = frodoSpd(def);
        let dx=0,dy=0;
        if (keys['ArrowLeft']||keys['a']||keys['A']) dx-=1;
        if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
        if (keys['ArrowUp']||keys['w']||keys['W']) dy-=1;
        if (keys['ArrowDown']||keys['s']||keys['S']) dy+=1;
        if (dx&&dy){dx*=0.707;dy*=0.707;}
        // Blind flash blocks visibility, not movement
        frodo.x = Math.max(frodo.r, Math.min(W-frodo.r, frodo.x+dx*spd*60*dt));
        frodo.y = Math.max(frodo.r, Math.min(H-frodo.r, frodo.y+dy*spd*60*dt));
        frodo.ringAngle += dt*(1.2+progress()*2.5);

        // Level clear
        if (Math.hypot(frodo.x-GOAL.x, frodo.y-GOAL.y) < frodo.r + GOAL.r) {
          if (currentLevel < 2) { state='levelwin'; levelTransTimer=0; }
          else { state='win'; }
        }

        if (frodo.invincible){frodo.invTimer-=dt;if(frodo.invTimer<=0)frodo.invincible=false;}
        frodo.hitFlash = Math.max(0,frodo.hitFlash-dt*4);
        blindFlash = Math.max(0, blindFlash-dt*1.2);

        // Ring corruption blind flash (level 3 only)
        if (def.hasBlindFlash && progress() > 0.5 && Math.random()<0.002) {
          blindFlash = Math.min(0.85, blindFlash + 0.35);
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
            eye.idleDur=Math.max(5,def.eyeIdleBase-progress()*10+Math.random()*5);
          }
        }

        const eyeActive = eye.phase==='active';

        // Wraiths
        wraiths.forEach(w=>{
          w.capePhase+=dt*1.8; w.wanderTimer-=dt;
          if(eyeActive){
            const a=Math.atan2(frodo.y-w.y,frodo.x-w.x);
            w.x+=Math.cos(a)*w.speed*1.9*60*dt; w.y+=Math.sin(a)*w.speed*1.9*60*dt;
          } else {
            if(w.wanderTimer<=0){
              w.wanderAngle=Math.atan2(frodo.y-w.y,frodo.x-w.x)+(Math.random()-0.5)*Math.PI*1.6;
              w.wanderTimer=1.2+Math.random()*2;
            }
            w.x+=Math.cos(w.wanderAngle)*w.speed*0.85*60*dt;
            w.y+=Math.sin(w.wanderAngle)*w.speed*0.85*60*dt;
          }
          if(w.x<-80||w.x>W+80||w.y<-80||w.y>H+80){
            w.wanderAngle=Math.atan2(H*0.55-w.y,W*0.5-w.x)+(Math.random()-0.5)*0.6;
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
            gollum.x=Math.max(-20,Math.min(W+20,gollum.x));
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

        // Life pickup
        timers.pickupCD-=dt;
        if(!lifePickup && timers.pickupCD<=0 && frodo.lives<3) {
          // Spawn away from goal and away from start
          const px = 180 + Math.random()*(W-360);
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
      ctx.save();
      if(shake&&(shake.x||shake.y)) ctx.translate(shake.x,shake.y);

      drawBgLevel(ctx,W,H,t,def,state==='playing'?progress():0);

      if(state==='playing'||state==='levelwin'){
        // Gollum (draw before Frodo so he's behind)
        drawGoal(ctx,GOAL,def,t,progress(),80,H*0.62);
        if(lifePickup) drawLifePickup(ctx,lifePickup,t);
        if (gollum) drawGollum(ctx,gollum,eye);
        drawWraiths1(ctx,wraiths,eye);
        if (frodo) drawFrodo1(ctx,frodo,progress(),timers.elapsed);
        ctx.globalAlpha=1;
        particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life*2.5);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1;
        if(eye&&eye.open>0.02) drawEye1(ctx,W,eye);
        if(eye&&eye.phase==='active'){ctx.fillStyle=`rgba(160,0,0,${eye.open*0.16})`;ctx.fillRect(0,0,W,H);}
        if(eye&&eye.phase==='warning'&&Math.random()>0.65){ctx.fillStyle=`rgba(200,50,0,${Math.random()*0.09})`;ctx.fillRect(0,0,W,H);}
        // Blind flash (level 3)
        if(blindFlash>0){ctx.fillStyle=`rgba(255,200,50,${blindFlash*0.92})`;ctx.fillRect(0,0,W,H);}
        drawUILevel(ctx,W,H,frodo,progress(),eye,timers.elapsed,currentLevel,def);
      }

      if(state==='title') {
        drawScreen(ctx,W,H,'Carry the Ring','"Even the smallest person can change the course of the future."','WASD / Arrows · 3 levels · 3 lives',t);
        // Level indicators
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.font='11px serif'; ctx.fillStyle='rgba(160,120,50,0.7)';
        ctx.fillText('I: The Fellowship   ·   II: The Two Towers   ·   III: The Return of the King', W/2, H/2+90);
      }
      if(state==='levelwin') drawLevelWin(ctx,W,H,def,currentLevel,t,levelTransTimer);
      if(state==='gameover') drawScreen(ctx,W,H,'The Ring is Lost','"All hope is gone. The Dark Lord has won."','Press SPACE to try again',t,true);
      if(state==='win')      drawFinalWin(ctx,W,H,t);

      ctx.restore();
      requestAnimationFrame(loop);
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
      if(frodo.lives<=0) state='gameover';
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
  function drawGoal(ctx, goal, def, t, prog, startX, startY) {
    const { x, y, r } = goal;
    const lvl = LEVEL_DEFS.indexOf(def);
    // Outer pulse ring
    const pulse = 1 + Math.sin(t * 2.5) * 0.18;
    ctx.save();
    ctx.shadowColor = lvl===0 ? '#80e0ff' : lvl===1 ? '#a0c840' : '#ff6000';
    ctx.shadowBlur  = 24 * pulse;
    // Animated beacon ring
    const ringAlpha = 0.5 + Math.sin(t*2.5)*0.3;
    ctx.strokeStyle = lvl===0 ? `rgba(180,230,255,${ringAlpha})` :
                      lvl===1 ? `rgba(160,210,80,${ringAlpha})` :
                                `rgba(255,120,20,${ringAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI*2); ctx.stroke();
    // Second smaller ring
    ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Core glow
    const cg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
    const [cr,cg2,cb] = lvl===0 ? [140,210,255] : lvl===1 ? [130,200,60] : [255,90,10];
    cg.addColorStop(0, `rgba(${cr},${cg2},${cb},0.5)`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.fillRect(x-r*2, y-r*2, r*4, r*4);
    // Icon per level
    ctx.fillStyle = lvl===0 ? 'rgba(200,235,255,0.9)' :
                    lvl===1 ? 'rgba(180,220,80,0.9)' :
                              `rgba(255,${140+Math.floor(Math.sin(t*4)*30)},0,0.9)`;
    ctx.font = `bold ${Math.round(r*0.9)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lvl===0 ? '★' : lvl===1 ? '▲' : '🔥', x, y);
    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(200,160,60,0.8)';
    ctx.font = 'bold 9px serif';
    ctx.fillText(def.destination.toUpperCase(), x, y + r + 10);
    // Dotted path hint from start to goal (fades as you progress)
    if (prog < 0.15) {
      ctx.save(); ctx.globalAlpha = (0.15 - prog) * 5 * 0.35;
      ctx.strokeStyle = 'rgba(200,160,60,0.6)'; ctx.lineWidth = 1;
      ctx.setLineDash([4,8]);
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(x, y); ctx.stroke();
      ctx.setLineDash([]); // always reset before restore
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBgLevel(ctx,W,H,t,def,prog) {
    const [s1,s2]=def.bgSky;
    const sky=ctx.createLinearGradient(0,0,0,H*0.55);
    sky.addColorStop(0,s1); sky.addColorStop(1,s2);
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.55);

    // Stars (dimmer in L1 because it's daytime-ish)
    STARS.forEach(s=>{
      const base = def===LEVEL_DEFS[0] ? 0.15 : 0.4;
      const alpha = base + Math.sin(t*0.8+s.twinkle)*0.2;
      ctx.fillStyle=`rgba(255,250,220,${alpha})`;
      ctx.beginPath(); ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2); ctx.fill();
    });

    // Destination glow (right)
    const [dr,dg,db]=def.destGlow;
    const dgl=ctx.createRadialGradient(W,H*0.5,0,W,H*0.5,340);
    dgl.addColorStop(0,`rgba(${dr},${dg},${db},${def.glowAlpha+prog*0.25})`);
    dgl.addColorStop(0.35,`rgba(${Math.floor(dr/2)},${Math.floor(dg/2)},${Math.floor(db/2)},0.12)`);
    dgl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=dgl; ctx.fillRect(0,0,W,H);

    // Ground
    const [g1,g2]=def.bgGnd;
    const ground=ctx.createLinearGradient(0,H*0.5,0,H);
    ground.addColorStop(0,g1); ground.addColorStop(1,g2);
    ctx.fillStyle=ground; ctx.fillRect(0,H*0.5,W,H*0.5);

    // Road
    const road=ctx.createLinearGradient(0,H*0.48,0,H*0.62);
    road.addColorStop(0,def.roadCol); road.addColorStop(1,'rgba(0,0,0,0.2)');
    ctx.fillStyle=road; ctx.beginPath();
    ctx.moveTo(0,H*0.46); ctx.lineTo(W,H*0.44); ctx.lineTo(W,H*0.60); ctx.lineTo(0,H*0.62);
    ctx.closePath(); ctx.fill();

    // Mountains silhouette
    ctx.fillStyle=def.horizon;
    ctx.beginPath(); ctx.moveTo(0,H*0.5);
    [[180,0],[240,0.08],[310,-0.02],[400,0.06],[480,0],[560,0.07],[640,0.01],[720,0.05],[W,0]]
      .forEach(([x,o])=>ctx.lineTo(x,H*(0.5-o)));
    ctx.lineTo(W,H*0.5); ctx.closePath(); ctx.fill();

    // Level-specific atmosphere
    if (def === LEVEL_DEFS[0]) {
      // Shire hill (left start)
      ctx.save();
      ctx.fillStyle='#1e3a12';
      ctx.beginPath(); ctx.arc(60,H*0.48,55,Math.PI,0); ctx.fill();
      // Rivendell cliff columns mid-right (not at goal, just atmosphere)
      ctx.strokeStyle=`rgba(140,200,220,${0.2+prog*0.25})`; ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.moveTo(W*0.72+i*9,H*0.28); ctx.lineTo(W*0.72+i*9,H*0.46); ctx.stroke();
      }
      ctx.restore();
    } else if (def === LEVEL_DEFS[1]) {
      // Dead Marshes glow (floating faces along the ground)
      for(let i=0;i<4;i++){
        const mx=140+i*140, my=H*0.6+Math.sin(t*0.6+i)*6;
        const mg=ctx.createRadialGradient(mx,my,0,mx,my,18);
        mg.addColorStop(0,`rgba(100,180,80,${0.12+Math.sin(t+i)*0.06})`);
        mg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=mg; ctx.fillRect(mx-18,my-18,36,36);
      }
    } else {
      // Mordor: progress-based doom intensification across the whole scene
      if(prog>0){
        const g2=ctx.createRadialGradient(W*0.9,H*0.2,0,W*0.9,H*0.2,300+prog*120);
        g2.addColorStop(0,`rgba(255,60,0,${prog*0.28})`); g2.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);
      }
    }
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
    ctx.fillStyle='#c8a838'; ctx.font=`bold 13px serif`;
    ctx.fillText(`BOOK ${badge} COMPLETE`,W/2,H/2-85);
    ctx.fillStyle='#e8c848'; ctx.font=`bold 32px "Palatino Linotype",Palatino,Georgia,serif`;
    ctx.fillText(def.winMsg,W/2,H/2-50);
    ctx.fillStyle='#a07830'; ctx.font=`italic 14px serif`;
    ctx.fillText(def.winQuote,W/2,H/2-10);
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
  function drawFinalWin(ctx,W,H,t){
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
    ctx.fillText('The One Ring is unmade. Middle-earth is free.',W/2,H/2+90);
    if(Math.sin(t*2.2)>0){ctx.fillStyle='#c08838';ctx.font='14px serif';ctx.fillText('Press SPACE to play again',W/2,H/2+125);}
  }

  // ── UI (shared) ───────────────────────────────────────────────────────
  function drawUILevel(ctx,W,H,frodo,prog,eye,elapsed,lvl,def){
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
    // Level badge
    const badge=['I','II','III'][lvl]||'';
    ctx.fillStyle='rgba(180,140,50,0.7)'; ctx.font='bold 11px serif';
    ctx.fillText(`BOOK ${badge}`, 10, 42);
    // Lives
    for(let i=0;i<3;i++){const lx=W-22-i*24,lit=i<frodo.lives;
      ctx.save(); if(lit){ctx.shadowColor='#d4a020';ctx.shadowBlur=8;}
      ctx.strokeStyle=lit?'#d4a820':'#3a2810'; ctx.lineWidth=lit?2.2:1;
      ctx.beginPath(); ctx.arc(lx,19,8,0,Math.PI*2); ctx.stroke();
      if(lit){ctx.fillStyle='rgba(212,168,32,0.18)';ctx.beginPath();ctx.arc(lx,19,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
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
      const gc=ea?[130,20,200]:[55,10,100];
      const wg=ctx.createRadialGradient(0,0,0,0,0,w.r*3);
      wg.addColorStop(0,`rgba(${gc},0.45)`); wg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=wg; ctx.fillRect(-w.r*3,-w.r*3,w.r*6,w.r*6);
      const wave=Math.sin(w.capePhase)*5;
      ctx.fillStyle=ea?'#1c0535':'#0e0220'; ctx.beginPath();
      ctx.moveTo(0,-w.r*1.1); ctx.lineTo(-w.r*1.3,w.r*0.4+wave); ctx.lineTo(0,w.r*2.1); ctx.lineTo(w.r*1.3,w.r*0.4-wave); ctx.closePath(); ctx.fill();
      ctx.fillStyle=ea?'#250842':'#130128'; ctx.beginPath(); ctx.ellipse(0,-w.r*0.9,w.r*0.82,w.r*0.92,0,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.shadowColor=ea?'#ff20a0':'#600030'; ctx.shadowBlur=4; ctx.fillStyle=ea?'#ff50c0':'#900060';
      [-3.5,3.5].forEach(ex=>{ctx.beginPath();ctx.arc(ex,-w.r*0.9,1.5,0,Math.PI*2);ctx.fill();}); ctx.restore();
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
