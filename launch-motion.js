/* Featured-market banner: waits for live data, then runs the carousel and dot field. */
(() => {
  const root = document.getElementById('launchMotionBanner');
  const canvas = document.getElementById('launchField');
  const ctx = canvas.getContext('2d');
  const track = document.getElementById('bannerTrack');
  const dots = document.getElementById('bannerDots');
  const pause = document.getElementById('bannerPause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  let index = 0, paused = reduced.matches, hover = false, focused = false, visible = true;
  let frame = 0, last = 0, elapsed = 0, phase = 0, width = 0, height = 0, featured = [];

  function buildSlides() {
    const markets = (window.TurboPad.markets || []).filter(market => market.kind === 'meme').slice(0, 3);
    if (!markets.length) return false;
    featured = markets;
    track.innerHTML = markets.map((m, n) => `<article class="banner-slide" aria-hidden="${n !== 0}" inert><div class="banner-market-art"><span class="slide-tag">TURBO SCORE ${m.score}</span><strong>${escapeHtml(m.symbol)}</strong><div class="slide-chart">${window.TurboPad.sparkline(m)}</div><span class="slide-gain">${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%</span></div><div class="banner-market-info"><div class="avatar" style="--avatar:${m.color}">${escapeHtml(m.symbol[0])}${m.icon ? `<img src="${escapeHtml(m.icon)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div><div><h2>${escapeHtml(m.name)}</h2><small>$${escapeHtml(m.symbol)} · ${escapeHtml(m.source)}</small></div><button data-detail="${escapeHtml(m.id)}" aria-label="Explore ${escapeHtml(m.name)}">↗</button></div><div class="banner-curve"><span>LIQUIDITY DEPTH</span><i><b style="width:${m.progress}%"></b></i><strong>${m.progress}%</strong></div></article>`).join('');
    dots.innerHTML = markets.map((m, n) => `<button data-slide="${n}" aria-label="Show ${escapeHtml(m.name)}" aria-pressed="${n === 0}"></button>`).join('');
    select(0);
    return true;
  }

  function select(n) {
    if (!featured.length) return;
    index = (n + featured.length) % featured.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    [...track.children].forEach((el, i) => { el.inert = i !== index; el.setAttribute('aria-hidden', String(i !== index)); });
    dots.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
    elapsed = 0;
  }

  const running = () => featured.length > 1 && !paused && !reduced.matches && !document.hidden && visible && !hover && !focused;

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const t = phase;
    for (let x = 15; x < width; x += 23) for (let y = 13; y < height; y += 23) {
      const wave = (Math.sin(x * 0.009 + y * 0.014 - t * 0.65) + 1) / 2;
      const radius = 0.6 + wave * 0.65;
      ctx.fillStyle = `rgba(217,175,121,${0.05 + wave * 0.18})`;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.strokeStyle = 'rgba(217,175,121,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(width * 0.2 + Math.sin(t * 0.12) * 13, height * 0.58, height * (0.48 + i * 0.34), height * (0.21 + i * 0.2), -0.35 + t * 0.016, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function tick(now) {
    frame = 0;
    if (!running()) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    if (now - last >= 1000 / 30) {
      phase += dt;
      elapsed += dt;
      last = now;
      draw();
      if (elapsed > 5.5) select(index + 1);
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    const isPaused = paused || reduced.matches;
    pause.textContent = isPaused ? '▷' : 'Ⅱ';
    pause.setAttribute('aria-label', isPaused ? 'Play banner animation' : 'Pause banner animation');
    root.classList.toggle('banner-still', isPaused);
    if (running()) { last = performance.now(); frame = requestAnimationFrame(tick); }
  }

  function resize() {
    const rect = root.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  pause.onclick = () => { if (reduced.matches) return; paused = !paused; sync(); };
  dots.onclick = event => { const b = event.target.closest('[data-slide]'); if (b) select(+b.dataset.slide); };
  document.getElementById('bannerPrevious').onclick = () => select(index - 1);
  document.getElementById('bannerNext').onclick = () => select(index + 1);
  root.addEventListener('pointerenter', () => { hover = true; sync(); });
  root.addEventListener('pointerleave', () => { hover = false; sync(); });
  root.addEventListener('focusin', () => { focused = true; sync(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) { focused = false; sync(); } });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(root);
  else addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(root);

  function start() {
    if (!buildSlides()) return;
    resize();
    sync();
  }

  // Slides need live markets; the canvas field can start immediately.
  resize();
  if (window.TurboPad?.markets?.length) start();
  else document.addEventListener('turbopad:ready', start, { once: true });
})();
