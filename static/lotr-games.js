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
  const GAMES = [launchCarryTheRing, launchYouShallNotPass, launchTheEye];
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
    // Scale canvas to fit viewport while preserving aspect ratio
    const vw = window.innerWidth, vh = window.innerHeight - 80;
    const scale = Math.min(1, vw / w, vh / h);
    Object.assign(c.style, {
      display: 'block',
      width: (w * scale) + 'px',
      height: (h * scale) + 'px',
    });
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
  // GAME 1: CARRY THE RING
  // ─────────────────────────────────────────────────────────────────────
  function launchCarryTheRing() {
    const ov = makeOverlay('#060309');
    const W = 800, H = 480;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; ov.remove(); }
    makeCloseBtn(ov, close);

    const keys = {};
    const onKd = e => {
      keys[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.key === ' ' && state !== 'playing') startGame();
    };
    const onKu = e => { keys[e.key] = false; };
    document.addEventListener('keydown', onKd);
    document.addEventListener('keyup',  onKu);
    ov.addEventListener('remove', () => {
      document.removeEventListener('keydown', onKd);
      document.removeEventListener('keyup',  onKu);
    });

    let state = 'title', frodo, wraiths, particles, eye, shake, timers;

    function startGame() {
      frodo = { x:80, y:H*0.62, r:11, lives:3, invincible:false, invTimer:0, hitFlash:0, ringAngle:0 };
      wraiths = []; for (let i=0;i<3;i++) spawnWraith();
      particles = [];
      eye = { phase:'idle', timer:0, open:0, idleDur:20+Math.random()*8,
              activeDur:7, warnDur:2.5, closeDur:1.5, px:W/2, py:65 };
      shake = {x:0,y:0,dur:0,intensity:0};
      timers = {elapsed:0,spawnCD:0};
      state = 'playing';
    }

    function spawnWraith() {
      const edge = Math.floor(Math.random()*3);
      let x,y;
      if (edge===0) { x=40+Math.random()*(W-80); y=-35; }
      else if (edge===1) { x=40+Math.random()*(W-80); y=H+35; }
      else { x=-35; y=H*0.35+Math.random()*H*0.5; }
      wraiths.push({x,y,r:14,wanderAngle:Math.random()*Math.PI*2,wanderTimer:0,
                    speed:1.1+Math.random()*0.5,capePhase:Math.random()*Math.PI*2});
    }

    const progress = () => Math.max(0,Math.min(1,(frodo.x-80)/650));
    const frodoSpeed = () => 3.6 - progress()*2.1;
    const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    const lerp = (a,b,t) => a+(b-a)*t;

    let lastTs = 0;
    function loop(ts) {
      if (!alive) return;
      const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;

      // UPDATE
      if (state === 'playing') {
        timers.elapsed += dt;
        const spd = frodoSpeed();
        let dx=0,dy=0;
        if (keys['ArrowLeft']||keys['a']||keys['A']) dx-=1;
        if (keys['ArrowRight']||keys['d']||keys['D']) dx+=1;
        if (keys['ArrowUp']||keys['w']||keys['W']) dy-=1;
        if (keys['ArrowDown']||keys['s']||keys['S']) dy+=1;
        if (dx&&dy){dx*=0.707;dy*=0.707;}
        frodo.x = Math.max(frodo.r,Math.min(W-frodo.r, frodo.x+dx*spd*60*dt));
        frodo.y = Math.max(H*0.3,Math.min(H-frodo.r*2, frodo.y+dy*spd*60*dt));
        frodo.ringAngle += dt*(1.2+progress()*2.5);
        if (frodo.x>=745){state='win';}
        if (frodo.invincible){frodo.invTimer-=dt;if(frodo.invTimer<=0)frodo.invincible=false;}
        frodo.hitFlash = Math.max(0,frodo.hitFlash-dt*4);

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
          if(eye.timer>=eye.closeDur){eye.phase='idle';eye.timer=0;
            eye.idleDur=Math.max(8,18-progress()*9+Math.random()*5);}
        }
        const eyeActive=eye.phase==='active';
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
            frodo.lives--; frodo.invincible=true; frodo.invTimer=2.8; frodo.hitFlash=1;
            shake={x:0,y:0,dur:0.45,intensity:9};
            for(let i=0;i<14;i++){const a2=(i/14)*Math.PI*2+Math.random()*0.4,s2=1.2+Math.random()*3.5;
              particles.push({x:frodo.x,y:frodo.y,vx:Math.cos(a2)*s2,vy:Math.sin(a2)*s2-1.5,
                              life:0.5+Math.random()*0.4,size:3+Math.random()*3,
                              color:Math.random()>0.5?'#d4a020':'#903010'});}
            if(frodo.lives<=0) state='gameover';
          }
        });
        timers.spawnCD-=dt;
        const want=3+Math.floor(progress()*3.5);
        if(wraiths.length<want&&timers.spawnCD<=0){spawnWraith();timers.spawnCD=4+Math.random()*3;}
        if(shake.dur>0){shake.dur-=dt;shake.x=(Math.random()-0.5)*shake.intensity*2;shake.y=(Math.random()-0.5)*shake.intensity*2;}
        else{shake.x=shake.y=0;}
        particles=particles.filter(p=>p.life>0);
        particles.forEach(p=>{p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.vy+=0.08*dt*60;p.life-=dt;p.size=Math.max(0,p.size-dt*4);});
      }

      // DRAW
      ctx.save();
      if(shake.x||shake.y) ctx.translate(shake.x,shake.y);
      drawBg1(ctx,W,H,ts/1000,state==='playing'?progress():0);
      if(state!=='title'){
        drawWraiths1(ctx,wraiths,eye);
        drawFrodo1(ctx,frodo,progress(),timers.elapsed);
        ctx.globalAlpha=1;
        particles.forEach(p=>{ctx.globalAlpha=Math.min(1,p.life*2.5);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});
        ctx.globalAlpha=1;
        if(eye&&eye.open>0.02) drawEye1(ctx,W,eye);
        if(eye&&eye.phase==='active'){ctx.fillStyle=`rgba(160,0,0,${eye.open*0.16})`;ctx.fillRect(0,0,W,H);}
        if(eye&&eye.phase==='warning'&&Math.random()>0.65){ctx.fillStyle=`rgba(200,50,0,${Math.random()*0.09})`;ctx.fillRect(0,0,W,H);}
        drawUI1(ctx,W,H,frodo,progress(),eye,timers.elapsed);
      }
      if(state==='title') drawScreen(ctx,W,H,'Carry the Ring','"One ring to rule them all"','WASD/Arrows to move · Reach Mount Doom · 3 lives',ts/1000);
      if(state==='gameover') drawScreen(ctx,W,H,'The Ring is Lost','"All hope is gone. The Dark Lord has won."','Press SPACE to try again',ts/1000,true);
      if(state==='win') drawWin1(ctx,W,H,ts/1000);
      ctx.restore();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function drawBg1(ctx,W,H,t,prog) {
    const sky=ctx.createLinearGradient(0,0,0,H*0.55);
    sky.addColorStop(0,'#04020a'); sky.addColorStop(1,'#0e080f');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.55);
    drawStars(ctx,W,H,t);
    const dg=ctx.createRadialGradient(W,H*0.5,0,W,H*0.5,340);
    dg.addColorStop(0,`rgba(255,70,5,0.5)`); dg.addColorStop(0.35,'rgba(180,35,3,0.25)'); dg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=dg; ctx.fillRect(0,0,W,H);
    const ground=ctx.createLinearGradient(0,H*0.5,0,H);
    ground.addColorStop(0,'#1c1108'); ground.addColorStop(1,'#0c0904');
    ctx.fillStyle=ground; ctx.fillRect(0,H*0.5,W,H*0.5);
    const road=ctx.createLinearGradient(0,H*0.48,0,H*0.62);
    road.addColorStop(0,'rgba(65,48,20,0.9)'); road.addColorStop(1,'rgba(40,28,10,0.4)');
    ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(0,H*0.46); ctx.lineTo(W,H*0.44); ctx.lineTo(W,H*0.60); ctx.lineTo(0,H*0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#080508'; ctx.beginPath(); ctx.moveTo(0,H*0.5);
    [[180,0],[240,0.08],[310,-0.02],[400,0.06],[480,0],[560,0.07],[640,0.01],[720,0.05],[W,0]].forEach(([x,o])=>ctx.lineTo(x,H*(0.5-o)));
    ctx.lineTo(W,H*0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#0a0304'; ctx.beginPath(); ctx.moveTo(W-70,H*0.5); ctx.lineTo(W-28,H*0.18); ctx.lineTo(W,H*0.24); ctx.lineTo(W,H*0.5); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor='#ff5000'; ctx.shadowBlur=8;
    const lava=ctx.createLinearGradient(W-32,H*0.22,W-18,H*0.5);
    lava.addColorStop(0,'rgba(255,100,0,0)'); lava.addColorStop(0.3,'rgba(255,80,0,0.8)'); lava.addColorStop(1,'rgba(255,160,0,0.6)');
    ctx.strokeStyle=lava; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(W-28,H*0.22);
    ctx.bezierCurveTo(W-35,H*0.31,W-22,H*0.38,W-20,H*0.5); ctx.stroke(); ctx.restore();
    if(prog>0){const g2=ctx.createRadialGradient(W,H*0.5,0,W,H*0.5,200+prog*100);
      g2.addColorStop(0,`rgba(255,60,0,${prog*0.25})`); g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);}
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
  function drawUI1(ctx,W,H,frodo,prog,eye,elapsed){
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(10,10,210,18);
    const bar=ctx.createLinearGradient(10,0,220,0);
    bar.addColorStop(0,'#3a6018'); bar.addColorStop(0.5,'#9a6818'); bar.addColorStop(1,'#cc3808');
    ctx.fillStyle=bar; ctx.fillRect(10,10,210*prog,18);
    ctx.strokeStyle='rgba(140,95,40,0.75)'; ctx.lineWidth=1; ctx.strokeRect(10,10,210,18);
    ctx.fillStyle='rgba(200,160,70,0.85)'; ctx.font='9px serif'; ctx.textAlign='left'; ctx.fillText('THE ROAD TO MOUNT DOOM',13,23);
    for(let i=0;i<3;i++){const lx=W-22-i*24,lit=i<frodo.lives;
      ctx.save(); if(lit){ctx.shadowColor='#d4a020';ctx.shadowBlur=8;}
      ctx.strokeStyle=lit?'#d4a820':'#3a2810'; ctx.lineWidth=lit?2.2:1;
      ctx.beginPath(); ctx.arc(lx,19,8,0,Math.PI*2); ctx.stroke();
      if(lit){ctx.fillStyle='rgba(212,168,32,0.18)';ctx.beginPath();ctx.arc(lx,19,8,0,Math.PI*2);ctx.fill();}
      ctx.restore();}
    if(eye&&eye.phase==='warning'&&Math.sin(elapsed*11)>0){ctx.fillStyle='#ff6010';ctx.font='bold 11px serif';ctx.textAlign='center';ctx.fillText('THE EYE OPENS...',W/2,32);}
    if(prog>0.12){const msg=prog<0.38?'The Ring grows heavy...':prog<0.62?'The burden is immense...':prog<0.85?'Every step a torment...':'The fire draws near...';
      ctx.fillStyle=`rgba(200,138,38,${Math.min(1,(prog-0.12)*2.2)})`; ctx.font='italic 11px serif'; ctx.textAlign='center'; ctx.fillText(msg,W/2,H-10);}
  }
  function drawWin1(ctx,W,H,t){
    ctx.fillStyle='rgba(15,4,0,0.88)'; ctx.fillRect(0,0,W,H);
    const fire=ctx.createRadialGradient(W/2,H/2+40,8,W/2,H/2+40,280);
    fire.addColorStop(0,`rgba(255,110,0,${0.55+Math.sin(t*3)*0.08})`); fire.addColorStop(0.4,'rgba(190,42,0,0.3)'); fire.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fire; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#ffd060'; ctx.font='bold 40px "Palatino Linotype",Palatino,Georgia,serif'; ctx.fillText('It is done.',W/2,H/2-75);
    ctx.fillStyle='#c07830'; ctx.font='italic 15px serif'; ctx.fillText('"My precious..."',W/2,H/2-30);
    const ry=H/2+20+Math.sin(t*1.6)*9;
    ctx.save(); ctx.shadowColor='#ff7700'; ctx.shadowBlur=30+Math.sin(t*4)*10;
    ctx.strokeStyle=`hsl(45,92%,${58+Math.sin(t*5)*10}%)`; ctx.lineWidth=3.5;
    ctx.beginPath(); ctx.arc(W/2,ry,20,0,Math.PI*2); ctx.stroke(); ctx.restore();
    ctx.fillStyle='#b07030'; ctx.font='14px serif'; ctx.fillText('The One Ring is unmade. Middle-earth is free.',W/2,H/2+85);
    if(Math.sin(t*2.2)>0){ctx.fillStyle='#c08838'; ctx.font='14px serif'; ctx.fillText('Press SPACE to play again',W/2,H/2+125);}
  }

  // ─────────────────────────────────────────────────────────────────────
  // GAME 2: YOU SHALL NOT PASS
  // ─────────────────────────────────────────────────────────────────────
  function launchYouShallNotPass() {
    const ov = makeOverlay('#04020a');
    const W = 700, H = 400;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; ov.remove(); }
    makeCloseBtn(ov, close);

    const hint = document.createElement('p');
    Object.assign(hint.style, { color:'rgba(150,110,40,0.55)', fontSize:'11px', letterSpacing:'2px', marginTop:'6px' });
    hint.textContent = 'SPACE / CLICK — slam the staff';
    ov.appendChild(hint);

    let state = 'title', score = 0, combo = 0, lives = 3;
    let enemies = [], staffSlam = 0, slamFx = 0, shakeTimer = 0;
    let spawnTimer = 0, spawnInterval = 2.2;
    const BRIDGE_Y = H * 0.68;
    const GANDALF_X = W * 0.18;

    function startGame() {
      score = 0; combo = 0; lives = 3;
      enemies = []; staffSlam = 0; slamFx = 0; shakeTimer = 0;
      spawnTimer = 0; spawnInterval = 2.2;
      state = 'playing';
    }

    function slam() {
      if (state !== 'playing') { startGame(); return; }
      staffSlam = 0.35; slamFx = 0.5;
      // kill enemies within reach
      let killed = false;
      enemies = enemies.filter(e => {
        if (e.x < W * 0.45 && e.x > W * 0.08) {
          score += 10 * (1 + combo); combo++; shakeTimer = 0.12; killed = true; return false;
        }
        return true;
      });
      if (!killed) combo = 0;
    }

    document.addEventListener('keydown', function onK(e) {
      if (!alive) { document.removeEventListener('keydown', onK); return; }
      if (e.key === ' ') { e.preventDefault(); slam(); }
    });
    canvas.addEventListener('click', slam);

    function spawnEnemy() {
      const types = ['orc','orc','orc','balrog'];
      const type = types[Math.floor(Math.random()*types.length)];
      const spd = type === 'balrog' ? 38 + score * 0.015 : 55 + score * 0.02 + Math.random() * 25;
      enemies.push({ x: W + 30, type, speed: spd, r: type==='balrog'?22:14, hp: type==='balrog'?3:1 });
    }

    let lastTs = 0;
    function loop(ts) {
      if (!alive) return;
      const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;
      const t = ts / 1000;

      if (state === 'playing') {
        staffSlam = Math.max(0, staffSlam - dt * 3);
        slamFx    = Math.max(0, slamFx - dt * 2);
        shakeTimer= Math.max(0, shakeTimer - dt);
        spawnTimer += dt;
        spawnInterval = Math.max(0.9, 2.2 - score * 0.003);
        if (spawnTimer >= spawnInterval) { spawnEnemy(); spawnTimer = 0; }

        enemies.forEach(e => { e.x -= e.speed * dt; });
        const passed = enemies.filter(e => e.x < W * 0.08 - e.r);
        passed.forEach(() => { lives--; combo = 0; shakeTimer = 0.3; });
        enemies = enemies.filter(e => e.x >= W * 0.08 - e.r);
        if (lives <= 0) state = 'gameover';
      }

      // DRAW
      ctx.save();
      if (shakeTimer > 0) ctx.translate((Math.random()-0.5)*6, (Math.random()-0.5)*4);

      // Background
      const sky = ctx.createLinearGradient(0,0,0,H*0.5);
      sky.addColorStop(0,'#04020a'); sky.addColorStop(1,'#0d0810');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
      drawStars(ctx,W,H,t);

      // Abyss below bridge
      ctx.fillStyle = '#020105'; ctx.fillRect(0, BRIDGE_Y + 28, W, H - BRIDGE_Y - 28);
      const abyss = ctx.createLinearGradient(0, BRIDGE_Y+28, 0, H);
      abyss.addColorStop(0,'rgba(60,0,100,0.4)'); abyss.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = abyss; ctx.fillRect(0, BRIDGE_Y+28, W, H - BRIDGE_Y - 28);

      // Lava glow from abyss
      ctx.save();
      ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 40;
      const lavag = ctx.createLinearGradient(0, BRIDGE_Y+20, 0, H);
      lavag.addColorStop(0,`rgba(255,60,0,${0.2+Math.sin(t*1.5)*0.06})`);
      lavag.addColorStop(1,'rgba(100,20,0,0.1)');
      ctx.fillStyle = lavag; ctx.fillRect(0, BRIDGE_Y+20, W, H - BRIDGE_Y - 20);
      ctx.restore();

      // Bridge
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, BRIDGE_Y, W, 28);
      ctx.strokeStyle = 'rgba(80,60,20,0.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(0, BRIDGE_Y, W, 28);
      // Bridge cracks
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
      [[W*0.55, BRIDGE_Y+4, W*0.6, BRIDGE_Y+22],[W*0.7, BRIDGE_Y+2, W*0.73, BRIDGE_Y+18]].forEach(([x1,y1,x2,y2])=>{
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      // Enemies
      enemies.forEach(e => {
        ctx.save(); ctx.translate(e.x, BRIDGE_Y + 14);
        if (e.type === 'balrog') {
          // Balrog
          ctx.save(); ctx.shadowColor='#ff4400'; ctx.shadowBlur=20;
          ctx.fillStyle = '#1a0808';
          ctx.beginPath(); ctx.ellipse(0,0,e.r,e.r*1.3,0,0,Math.PI*2); ctx.fill();
          // Wings
          ctx.fillStyle='rgba(40,0,0,0.85)';
          ctx.beginPath(); ctx.moveTo(-e.r,0); ctx.lineTo(-e.r*2.8,-e.r*1.2); ctx.lineTo(-e.r,e.r*0.5); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(e.r,0); ctx.lineTo(e.r*2.8,-e.r*1.2); ctx.lineTo(e.r,e.r*0.5); ctx.closePath(); ctx.fill();
          // Fire eyes
          ctx.shadowColor='#ff8800'; ctx.shadowBlur=8; ctx.fillStyle='#ff6600';
          ctx.beginPath(); ctx.arc(-7,-5,3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(7,-5,3,0,Math.PI*2); ctx.fill();
          ctx.restore();
        } else {
          // Orc
          ctx.fillStyle = '#2a1f10';
          ctx.beginPath(); ctx.ellipse(0,0,e.r,e.r*1.1,0,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#1a1208'; ctx.beginPath(); ctx.arc(0,-e.r*0.6,e.r*0.65,0,Math.PI*2); ctx.fill();
          // spear
          ctx.strokeStyle='#5a4020'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.moveTo(e.r*0.8,-e.r*0.3); ctx.lineTo(e.r*0.8+22,-e.r*0.3); ctx.stroke();
          ctx.fillStyle='#8a8070'; ctx.beginPath(); ctx.moveTo(e.r*0.8+22,-e.r*0.3-4); ctx.lineTo(e.r*0.8+28,-e.r*0.3); ctx.lineTo(e.r*0.8+22,-e.r*0.3+4); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });

      // Gandalf
      ctx.save();
      const gandalfY = BRIDGE_Y + 14;
      ctx.translate(GANDALF_X, gandalfY);
      // Robe
      ctx.fillStyle = '#d4cdb8';
      ctx.beginPath(); ctx.moveTo(-12,28); ctx.lineTo(-9,-28); ctx.lineTo(9,-28); ctx.lineTo(12,28); ctx.closePath(); ctx.fill();
      // Head/hat
      ctx.fillStyle = '#c8c0aa';
      ctx.beginPath(); ctx.arc(0,-30,10,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#9090a0';
      ctx.beginPath(); ctx.moveTo(-14,-26); ctx.lineTo(0,-52); ctx.lineTo(14,-26); ctx.closePath(); ctx.fill();
      // Staff
      const staffTilt = staffSlam > 0 ? -0.6 : -0.1;
      ctx.save(); ctx.rotate(staffTilt);
      ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(8, 28); ctx.lineTo(18,-48); ctx.stroke();
      // Staff glow
      if (staffSlam > 0) {
        ctx.save(); ctx.shadowColor='#ffffaa'; ctx.shadowBlur=30*staffSlam;
        ctx.strokeStyle=`rgba(255,255,180,${staffSlam*0.9})`; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(18+2,-50,8+staffSlam*12,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();

      // Slam shockwave
      if (slamFx > 0) {
        ctx.save(); ctx.globalAlpha = slamFx * 0.7;
        ctx.strokeStyle = '#ffffaa'; ctx.lineWidth = 2;
        const r = (1 - slamFx) * W * 0.38 + 20;
        ctx.beginPath(); ctx.arc(GANDALF_X + 20, gandalfY - 10, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // UI
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(180,140,60,0.9)'; ctx.font = 'bold 15px serif';
      ctx.fillText(`Score: ${score}`, 10, 10);
      if (combo > 1) { ctx.fillStyle='#ffcc44'; ctx.font='bold 13px serif'; ctx.fillText(`×${combo} combo!`, 10, 30); }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? 'rgba(200,160,60,0.9)' : 'rgba(60,40,20,0.4)';
        ctx.beginPath(); ctx.arc(W - 20 - i * 24, 19, 8, 0, Math.PI * 2); ctx.fill();
      }

      ctx.textAlign='center';
      if (state === 'title') drawScreen(ctx,W,H,'You Shall Not Pass!','"Fly, you fools!"','SPACE or click to slam your staff',t);
      if (state === 'gameover') drawScreen(ctx,W,H,'The Bridge is Lost!',`Score: ${score}`,'Press SPACE to try again',t,true);

      ctx.restore();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────────────────
  // GAME 3: THE EYE
  // ─────────────────────────────────────────────────────────────────────
  function launchTheEye() {
    const ov = makeOverlay('#04020a');
    const W = 700, H = 450;
    const canvas = makeCanvas(ov, W, H);
    const ctx = canvas.getContext('2d');

    let alive = true;
    function close() { alive = false; ov.remove(); }
    makeCloseBtn(ov, close);

    const hint = document.createElement('p');
    Object.assign(hint.style, { color:'rgba(150,110,40,0.55)', fontSize:'11px', letterSpacing:'2px', marginTop:'6px' });
    hint.textContent = 'WASD / ARROWS — stay in the shadows';
    ov.appendChild(hint);

    let state = 'title', survived = 0;
    let hobbit, eyeBeams, shadows, particles2;
    const FLOOR_Y = H * 0.8;

    function startGame() {
      hobbit = { x: W*0.15, y: FLOOR_Y - 16, r: 11, detected: 0, detTimer: 0, invTimer: 0 };
      // Shadows: safe zones
      shadows = [
        { x: W*0.1, y: FLOOR_Y - 20, w: 90, h: 50 },
        { x: W*0.35, y: FLOOR_Y - 30, w: 70, h: 60 },
        { x: W*0.58, y: FLOOR_Y - 15, w: 100, h: 45 },
        { x: W*0.82, y: FLOOR_Y - 25, w: 75, h: 55 },
      ];
      eyeBeams = [];
      spawnBeam();
      particles2 = [];
      survived = 0;
      state = 'playing';
    }

    function spawnBeam() {
      const dur = Math.max(1.8, 4.5 - survived * 0.008);
      eyeBeams.push({
        angle: -Math.PI * 0.6 + Math.random() * Math.PI * 0.2,
        targetAngle: -Math.PI * 0.15 + Math.random() * Math.PI * 0.1,
        speed: 0.22 + survived * 0.0008,
        width: 0.18 + survived * 0.0005,
        alpha: 0, phase: 'opening', timer: 0,
        openDur: 0.8, activeDur: dur, closeDur: 0.6,
        nextIn: Math.max(1.5, 4 - survived * 0.006),
        nextTimer: 0,
      });
    }

    const keys2 = {};
    const onKd = e => {
      keys2[e.key] = true;
      if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.key === ' ' && state !== 'playing') startGame();
    };
    const onKu = e => { keys2[e.key] = false; };
    document.addEventListener('keydown', onKd);
    document.addEventListener('keyup', onKu);

    function inShadow() {
      return shadows.some(s =>
        hobbit.x > s.x && hobbit.x < s.x + s.w &&
        hobbit.y > s.y && hobbit.y < s.y + s.h
      );
    }

    function inBeam(beam) {
      const EX = W / 2, EY = 45;
      const ax = Math.cos(beam.angle), ay = Math.sin(beam.angle);
      const dx = hobbit.x - EX, dy = hobbit.y - EY;
      const dist2 = Math.sqrt(dx*dx+dy*dy);
      if (dist2 < 5) return false;
      const dot = (dx/dist2)*ax + (dy/dist2)*ay;
      const cross = Math.abs((dx/dist2)*ay - (dy/dist2)*ax);
      return dot > 0.7 && cross < beam.width && dist2 < H * 1.5;
    }

    let lastTs = 0;
    function loop(ts) {
      if (!alive) return;
      const dt = Math.min((ts-lastTs)/1000, 0.05); lastTs = ts;
      const t = ts/1000;

      if (state === 'playing') {
        survived += dt;
        // Move hobbit
        const spd = 2.8 * 60 * dt;
        if (keys2['ArrowLeft']||keys2['a']||keys2['A']) hobbit.x = Math.max(hobbit.r, hobbit.x - spd);
        if (keys2['ArrowRight']||keys2['d']||keys2['D']) hobbit.x = Math.min(W-hobbit.r, hobbit.x + spd);
        if (keys2['ArrowUp']||keys2['w']||keys2['W']) hobbit.y = Math.max(FLOOR_Y-80, hobbit.y - spd*0.5);
        if (keys2['ArrowDown']||keys2['s']||keys2['S']) hobbit.y = Math.min(FLOOR_Y, hobbit.y + spd*0.5);

        const safe = inShadow();
        let caught = false;

        eyeBeams.forEach(beam => {
          beam.timer += dt;
          if (beam.phase==='opening') {
            beam.alpha = Math.min(1, beam.timer/beam.openDur);
            if (beam.timer >= beam.openDur) { beam.phase='active'; beam.timer=0; }
          } else if (beam.phase==='active') {
            beam.angle += beam.speed * dt;
            if (beam.angle > beam.targetAngle) beam.speed *= -1;
            if (beam.angle < -Math.PI*0.6) beam.speed = Math.abs(beam.speed);
            if (beam.timer >= beam.activeDur) { beam.phase='closing'; beam.timer=0; }
            if (!safe && inBeam(beam)) caught = true;
          } else if (beam.phase==='closing') {
            beam.alpha = Math.max(0, 1 - beam.timer/beam.closeDur);
            beam.nextTimer += dt;
            if (beam.timer >= beam.closeDur) {
              if (beam.nextTimer >= beam.nextIn) spawnBeam();
              beam.phase='dead';
            }
          }
        });
        eyeBeams = eyeBeams.filter(b=>b.phase!=='dead');
        if (eyeBeams.length === 0) spawnBeam();

        if (caught && hobbit.invTimer<=0) {
          hobbit.detected = Math.min(3, hobbit.detected + dt * 1.8);
          if (hobbit.detected >= 3) { state='gameover'; }
        } else {
          hobbit.detected = Math.max(0, hobbit.detected - dt * (safe ? 1.2 : 0.3));
        }
        hobbit.invTimer = Math.max(0, hobbit.invTimer - dt);
      }

      // DRAW
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#04020a'); sky.addColorStop(1,'#0a0510');
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      drawStars(ctx,W,H,t);

      // Doom glow
      const dg=ctx.createRadialGradient(W*0.9,H*0.4,0,W*0.9,H*0.4,280);
      dg.addColorStop(0,'rgba(255,50,0,0.35)'); dg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=dg; ctx.fillRect(0,0,W,H);

      // Ground
      ctx.fillStyle='#100d06'; ctx.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);

      // Shadow zones (slightly lighter patches)
      shadows.forEach(s => {
        const sg=ctx.createRadialGradient(s.x+s.w/2,s.y+s.h/2,0,s.x+s.w/2,s.y+s.h/2,Math.max(s.w,s.h)*0.7);
        sg.addColorStop(0,'rgba(30,20,8,0.7)'); sg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=sg; ctx.fillRect(s.x,s.y,s.w,s.h);
        // Shadow label
        ctx.fillStyle='rgba(100,80,30,0.25)'; ctx.font='9px serif'; ctx.textAlign='center';
        ctx.fillText('shadow',s.x+s.w/2,s.y+s.h-4);
      });

      // Eye beams
      eyeBeams.forEach(beam => {
        if (beam.alpha < 0.02) return;
        const EX=W/2, EY=45;
        ctx.save();
        ctx.globalAlpha = beam.alpha;
        const beamW = beam.width * 280;
        ctx.shadowColor='#ff2200'; ctx.shadowBlur=25;
        const bg=ctx.createLinearGradient(EX,EY,EX+Math.cos(beam.angle)*H,EY+Math.sin(beam.angle)*H);
        bg.addColorStop(0,`rgba(255,80,0,0.85)`); bg.addColorStop(0.4,'rgba(255,40,0,0.4)'); bg.addColorStop(1,'rgba(200,10,0,0)');
        ctx.fillStyle=bg;
        ctx.save();
        ctx.translate(EX,EY); ctx.rotate(beam.angle);
        ctx.beginPath(); ctx.moveTo(0,-beamW/2); ctx.lineTo(H*1.6,-(beamW/2+H*0.08)); ctx.lineTo(H*1.6,(beamW/2+H*0.08)); ctx.lineTo(0,beamW/2); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.restore();
      });

      // Eye of Sauron
      drawEye1(ctx,W,{open:0.7+Math.sin(t*0.9)*0.1, phase:'active', px:W/2+(survived>5?Math.cos(t*0.4)*W*0.25:0), py:45});

      // Detection meter
      if (state==='playing') {
        const det = hobbit ? hobbit.detected/3 : 0;
        ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(W/2-75,10,150,14);
        const dm=ctx.createLinearGradient(W/2-75,0,W/2+75,0);
        dm.addColorStop(0,'#333308'); dm.addColorStop(0.5,'#aa5500'); dm.addColorStop(1,'#cc0000');
        ctx.fillStyle=dm; ctx.fillRect(W/2-75,10,150*det,14);
        ctx.strokeStyle='rgba(130,80,30,0.6)'; ctx.lineWidth=1; ctx.strokeRect(W/2-75,10,150,14);
        ctx.fillStyle='rgba(200,150,50,0.8)'; ctx.font='9px serif'; ctx.textAlign='center'; ctx.fillText('DETECTION',W/2,21);
        // Survived time
        ctx.fillStyle='rgba(170,120,40,0.7)'; ctx.font='bold 12px serif';
        ctx.fillText(`${Math.floor(survived)}s`,W-35,20);
      }

      // Hobbit
      if (hobbit && state==='playing') {
        ctx.save(); ctx.translate(hobbit.x, hobbit.y);
        const safe2=inShadow();
        const hg=ctx.createRadialGradient(0,0,0,0,0,hobbit.r*3);
        hg.addColorStop(0,safe2?'rgba(50,80,20,0.3)':'rgba(180,120,40,0.2)'); hg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=hg; ctx.fillRect(-hobbit.r*3,-hobbit.r*3,hobbit.r*6,hobbit.r*6);
        ctx.fillStyle=safe2?'#2a3a15':'#4a3518';
        ctx.beginPath(); ctx.ellipse(0,3,hobbit.r*0.85,hobbit.r*1.1,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=safe2?'#3a4a20':'#5a4020';
        ctx.beginPath(); ctx.arc(0,-hobbit.r*0.75,hobbit.r*0.7,0,Math.PI*2); ctx.fill();
        if (!safe2 && hobbit.detected > 0) {
          ctx.strokeStyle=`rgba(255,80,0,${hobbit.detected/3*0.8})`; ctx.lineWidth=2;
          ctx.beginPath(); ctx.arc(0,0,hobbit.r*1.5,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
      }

      ctx.textAlign='center';
      if (state==='title') drawScreen(ctx,W,H,'The Eye','"Three rings for the Elven-kings..."','Move through the shadows · Avoid the Eye\'s gaze',t);
      if (state==='gameover') drawScreen(ctx,W,H,'The Eye Has Found You!',`Survived: ${Math.floor(survived)}s`,'Press SPACE to try again',t,true);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
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
