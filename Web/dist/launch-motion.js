(() => {
  const root=document.getElementById('launchMotionBanner'),canvas=document.getElementById('launchField'),ctx=canvas.getContext('2d');
  const track=document.getElementById('bannerTrack'),dots=document.getElementById('bannerDots'),pause=document.getElementById('bannerPause');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const featured=[0,2,1]; let index=0,paused=reduced.matches,hover=false,focused=false,visible=true,frame=0,last=0,elapsed=0,phase=0,width=0,height=0;
  track.innerHTML=featured.map((i,n)=>{const m=markets[i];return `<article class="banner-slide" aria-hidden="${n!==0}" inert><div class="banner-market-art"><span class="slide-tag">TURBO SCORE ${m.score}</span><strong>${m.symbol}</strong><div class="slide-chart">${chart(i+3)}</div><span class="slide-gain">+${m.change}%</span></div><div class="banner-market-info"><div class="avatar" style="--avatar:${m.color}">${m.symbol[0]}</div><div><h2>${m.name}</h2><small>$${m.symbol} · ${m.source}</small></div><button data-detail="${i}" aria-label="Explore ${m.name}">↗</button></div><div class="banner-curve"><span>GRADUATION</span><i><b style="width:${m.progress}%"></b></i><strong>${m.progress}%</strong></div></article>`}).join('');
  dots.innerHTML=featured.map((i,n)=>`<button data-slide="${n}" aria-label="Show ${markets[i].name}" aria-pressed="${n===0}"></button>`).join('');
  function select(n){index=(n+featured.length)%featured.length;track.style.transform=`translateX(-${index*100}%)`;[...track.children].forEach((el,i)=>{el.inert=i!==index;el.setAttribute('aria-hidden',String(i!==index))});dots.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));elapsed=0;}
  const running=()=>!paused&&!reduced.matches&&!document.hidden&&visible&&!hover&&!focused;
  function draw(){if(!ctx)return;ctx.clearRect(0,0,width,height);const t=phase;
    for(let x=15;x<width;x+=23)for(let y=13;y<height;y+=23){const wave=(Math.sin(x*.009+y*.014-t*.65)+1)/2;const radius=0.6+wave*.65;ctx.fillStyle=`rgba(195,223,82,${.045+wave*.18})`;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);}
    ctx.strokeStyle='rgba(193,221,91,0.11)';ctx.lineWidth=1;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(width*.2+Math.sin(t*.12)*13,height*.58,height*(.48+i*.34),height*(.21+i*.2),-.35+t*.016,0,Math.PI*2);ctx.stroke();}
  }
  function tick(now){frame=0;if(!running())return;const dt=Math.min((now-last)/1000,.1);if(now-last>=1000/30){phase+=dt;elapsed+=dt;last=now;draw();if(elapsed>5.5)select(index+1);}frame=requestAnimationFrame(tick);}
  function sync(){cancelAnimationFrame(frame);frame=0;const isPaused=paused||reduced.matches;pause.textContent=isPaused?'▷':'Ⅱ';pause.setAttribute('aria-label',isPaused?'Play banner animation':'Pause banner animation');root.classList.toggle('banner-still',isPaused);if(running()){last=performance.now();frame=requestAnimationFrame(tick);}}
  function resize(){const rect=root.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);draw();}
  pause.onclick=()=>{if(reduced.matches)return;paused=!paused;sync()};dots.onclick=e=>{const b=e.target.closest('[data-slide]');if(b)select(+b.dataset.slide)};
  document.getElementById('bannerPrevious').onclick=()=>select(index-1);document.getElementById('bannerNext').onclick=()=>select(index+1);
  root.addEventListener('pointerenter',()=>{hover=true;sync()});root.addEventListener('pointerleave',()=>{hover=false;sync()});root.addEventListener('focusin',()=>{focused=true;sync()});root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget)){focused=false;sync()}});
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',()=>{paused=reduced.matches;sync()});
  if('ResizeObserver'in window)new ResizeObserver(resize).observe(root);else addEventListener('resize',resize);
  if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()}).observe(root);
  select(0);resize();sync();
})();
