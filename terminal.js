/* TurboPad terminal: live market table, spotlight chart and radar panel. */
(() => {
  const table = document.getElementById('marketTable');
  const cards = document.getElementById('cards');
  const overview = document.getElementById('marketOverview');
  const displayOptions = document.querySelector('.display-options');
  let selectedPeriod = '24H';
  let spotlightId = null;
  let spotlightMarket = null;
  let radarId = null;

  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  /* ---------- Spotlight ---------- */

  function renderSpotlightChart(candles, period) {
    const width = 640, height = 222;
    const closes = candles.map(candle => candle.close);
    const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
    const stepX = width / Math.max(1, closes.length - 1);
    const x = index => (index * stepX).toFixed(1);
    const y = value => (height - 24 - ((value - min) / span) * (height - 56)).toFixed(1);
    const path = closes.map((close, index) => `${x(index)},${y(close)}`).join(' ');
    const maxVolume = Math.max(...candles.map(candle => candle.volume || 0), 1);
    const barWidth = Math.max(2, stepX * 0.5);
    const bars = candles.map((candle, index) => {
      const barHeight = 8 + ((candle.volume || 0) / maxVolume) * 26;
      return `<rect x="${(index * stepX - barWidth / 2).toFixed(1)}" y="${height - barHeight}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="#d9af79" opacity=".13"/>`;
    }).join('');
    document.getElementById('spotlightChart').innerHTML =
      `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Live ${period} price chart for ${escapeHtml(spotlightMarket?.name || 'market')}"><defs><linearGradient id="spotlightArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d9af79" stop-opacity=".2"/><stop offset="1" stop-color="#d9af79" stop-opacity="0"/></linearGradient></defs><path d="M0 35H640M0 85H640M0 135H640M0 185H640" stroke="#ffffff0c" stroke-dasharray="2 6"/><polygon points="0,${height} ${path} ${width},${height}" fill="url(#spotlightArea)"/>${bars}<polyline points="${path}" fill="none" stroke="#d9af79" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(closes.length - 1)}" cy="${y(closes[closes.length - 1])}" r="4" fill="#ecd2ad"/></svg>`;

    const axis = document.getElementById('chartAxis');
    const ticks = 5;
    axis.innerHTML = Array.from({ length: ticks }, (_, tick) => {
      const candle = candles[Math.round((candles.length - 1) * (tick / (ticks - 1)))];
      const date = new Date(candle.t);
      const label = period === '7D'
        ? date.toLocaleDateString('en-US', { weekday: 'short' })
        : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `<span>${label}</span>`;
    }).join('');
  }

  function loadSpotlightChart() {
    if (!spotlightMarket) return;
    const chart = document.getElementById('spotlightChart');
    chart.innerHTML = '<div class="chart-loading">Loading live chart…</div>';
    TurboData.ohlcv(spotlightMarket.chainId, spotlightMarket.id, selectedPeriod)
      .then(candles => { if (spotlightMarket) renderSpotlightChart(candles, selectedPeriod); })
      .catch(() => { chart.innerHTML = window.TurboPad.sparkline(spotlightMarket, 640, 222); });
  }

  function updateSpotlight(markets) {
    const top = markets.find(market => market.kind === 'meme');
    if (!top) { overview.hidden = true; spotlightId = null; return; }
    overview.hidden = false;
    const tag = overview.querySelector('.sample-tag');
    if (tag) tag.textContent = top.featured ? `${window.TurboFeatured?.badge || 'OFFICIAL'} · LIVE DATA` : 'LIVE DATA';
    const heading = overview.querySelector('.overview-heading');
    heading.querySelector('h2').innerHTML = `${escapeHtml(top.name)} <span>${escapeHtml(top.symbol)}</span>`;
    heading.querySelector('p').innerHTML = `${escapeHtml(top.source)} <span>·</span> ${escapeHtml(top.creator)}`;
    const avatarEl = heading.querySelector('.spotlight-avatar');
    avatarEl.style.setProperty('--avatar', top.color);
    avatarEl.innerHTML = `${escapeHtml(top.symbol[0])}${top.icon ? `<img src="${escapeHtml(top.icon)}" alt="" loading="lazy" onerror="this.remove()">` : ''}`;
    heading.querySelector('[data-detail]').dataset.detail = top.id;

    overview.querySelector('.overview-price strong').textContent = `$${top.price}`;
    const changeEl = overview.querySelector('.overview-price > span');
    changeEl.innerHTML = `${top.change > 0 ? '↗ +' : '↘ '}${top.change.toFixed(2)}% <small>24h</small>`;

    const bottom = overview.querySelectorAll('.overview-bottom > div');
    const setCell = (index, value) => { if (bottom[index]) bottom[index].querySelector('b').childNodes[0].textContent = value; };
    setCell(0, `$${top.volume}`);
    setCell(1, top.txns.buys.toLocaleString('en-US'));
    setCell(2, `$${top.cap}`);
    const progress = bottom[3]?.querySelector('b');
    if (progress) {
      progress.childNodes[0].textContent = `${top.progress}% `;
      const bar = progress.querySelector('.inline-progress');
      if (bar) bar.style.background = `linear-gradient(to right,#d0a572 ${top.progress}%,#3b3026 ${top.progress}%)`;
    }

    if (top.components) {
      const strengths = overview.querySelectorAll('.strength');
      const rows = [
        ['Volume quality', top.components.volumeQ],
        ['Buyer growth', top.components.buyerQ],
        ['Liquidity depth', top.components.liquidityQ],
      ];
      strengths.forEach((row, index) => {
        if (!rows[index]) return;
        row.querySelector('span').textContent = rows[index][0];
        row.querySelector('b').textContent = rows[index][1];
        row.querySelector('i').style.setProperty('--strength', `${rows[index][1]}%`);
      });
      const status = overview.querySelector('.insight-status');
      status.innerHTML = top.change >= 0 ? 'High momentum <span>↗</span>' : 'Cooling off <span>↘</span>';
    }

    const scoreEl = overview.querySelector('.score-orbit strong');
    if (scoreEl.textContent !== String(top.score)) {
      scoreEl.textContent = top.score;
      if (window.TurboCountUp) window.TurboCountUp(scoreEl, 400);
    }
    const arc = overview.querySelector('.score-arc');
    arc.style.setProperty('--score-offset', (377 * (1 - top.score / 100)).toFixed(1));

    if (spotlightId !== top.id) {
      spotlightId = top.id;
      spotlightMarket = top;
      loadSpotlightChart();
    } else {
      spotlightMarket = top;
    }
  }

  /* ---------- Radar panel ---------- */

  function updateRadar(markets) {
    const top = markets.filter(market => market.kind === 'meme').sort((a, b) => b.score - a.score)[0];
    if (!top) return;
    const feature = document.querySelector('.radar-feature');
    const total = top.txns.buys + top.txns.sells;
    const buyShare = total ? Math.round((top.txns.buys / total) * 100) : 0;
    feature.innerHTML = `<div class="token-heading"><div class="avatar lime-avatar" style="--avatar:${top.color}">${escapeHtml(top.symbol[0])}${top.icon ? `<img src="${escapeHtml(top.icon)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div><div><h3>${escapeHtml(top.name)}</h3><span>$${escapeHtml(top.symbol)} · ${escapeHtml(top.source)}</span></div><b class="large-score">${top.score}<small>/100</small></b></div><div class="radar-graph" id="radarGraph">${window.TurboPad.sparkline(top)}</div><div class="signal-row"><span>24h change</span><b>${top.change > 0 ? '+' : ''}${top.change.toFixed(1)}%</b></div><div class="signal-row"><span>24h transactions</span><b>${total.toLocaleString('en-US')}</b></div><div class="signal-row"><span>Buy pressure</span><strong>${buyShare}%</strong></div><button class="lime full" data-detail="${escapeHtml(top.id)}">Explore signal ↗</button>`;
    if (radarId !== top.id) {
      radarId = top.id;
      TurboData.ohlcv(top.chainId, top.id, '24H')
        .then(candles => {
          const graph = document.getElementById('radarGraph');
          if (graph && radarId === top.id) graph.innerHTML = window.TurboPad.chart(candles);
        })
        .catch(() => {});
    }
  }

  /* ---------- Market table ---------- */

  const SORT_KEYS = {
    name: market => market.name.toLowerCase(),
    price: market => market.priceRaw || 0,
    change: market => market.change,
    volume: market => market.volumeRaw || 0,
    score: market => (market.score == null ? -1 : market.score),
  };

  function sortMarkets(markets, sort) {
    if (!sort || !SORT_KEYS[sort.key]) return markets;
    const read = SORT_KEYS[sort.key];
    return [...markets].sort((a, b) => {
      const va = read(a), vb = read(b);
      const order = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }

  function cycleSort(key) {
    const state = window.TurboPad.state;
    const firstDir = key === 'name' ? 'asc' : 'desc';
    const sort = state.sort;
    if (!sort || sort.key !== key) state.sort = { key, dir: firstDir };
    else if (sort.dir === firstDir) state.sort = { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
    else state.sort = null;
    window.TurboPad.render();
  }

  function sortableTh(key, label, state) {
    const active = state.sort && state.sort.key === key;
    const arrow = active ? (state.sort.dir === 'asc' ? '↑' : '↓') : '↕';
    const ariaSort = active ? (state.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th${active ? ' class="sorted"' : ''} aria-sort="${ariaSort}"><button class="th-sort" data-sort="${key}" aria-label="Sort by ${label}${active ? `, currently ${ariaSort}` : ''}">${label}<span class="sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
  }

  function renderTable(visibleMarkets) {
    const state = window.TurboPad.state;
    if (state.loading && !state.markets.length) {
      table.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-row"></div>').join('');
      return;
    }
    if (state.error && !state.markets.length) {
      table.innerHTML = `<div class="empty">Live market data could not be loaded.<br>${escapeHtml(state.error)}</div><button class="outline" id="retryLoad">Retry ↻</button>`;
      return;
    }
    if (!visibleMarkets.length) {
      table.innerHTML = '<div class="empty">No markets match these filters.</div>';
      return;
    }
    const silent = state.silent;
    const flash = state.flash || new Map();
    const sortedRows = sortMarkets(visibleMarkets, state.sort);
    const head = `<thead><tr>${sortableTh('name', 'Market', state)}${sortableTh('price', 'Price', state)}${sortableTh('change', '24h change', state)}${sortableTh('volume', 'Volume', state)}<th>Trend ${escapeHtml(state.sparkPeriod || '24H')}</th>${sortableTh('score', 'Score', state)}<th><span class="sr-only">Details</span></th></tr></thead>`;
    table.innerHTML = `<table class="market-table">${head}<tbody>${sortedRows.map((market, rank) => `<tr${silent ? '' : ` class="row-enter" style="--row-delay:${Math.min(rank * 28, 280)}ms"`}><td><div class="table-token"><span class="rank">${String(rank + 1).padStart(2, '0')}</span><div class="avatar" style="--avatar:${market.color}">${escapeHtml(market.symbol[0])}${market.icon ? `<img src="${escapeHtml(market.icon)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div><div><b>${escapeHtml(market.name)}</b><small>${escapeHtml(market.symbol)} <span>· ${escapeHtml(market.source)}</span></small></div></div></td><td class="${flash.get(market.id) ? `tick-${flash.get(market.id)}` : ''}">$${escapeHtml(market.price)}</td><td class="${market.change < 0 ? 'negative' : 'up'}">${market.change > 0 ? '+' : ''}${market.change.toFixed(2)}%</td><td>$${market.volume}</td><td><div class="table-spark">${window.TurboPad.sparkline(market, 96, 36)}</div></td><td><span class="table-score">${market.score ? `ϟ ${market.score}` : 'RWA'}</span></td><td><div class="card-actions"><button class="compare-btn ${state.compare.includes(market.id) ? 'active' : ''}" data-compare="${escapeHtml(market.id)}" aria-label="Compare ${escapeHtml(market.name)}" aria-pressed="${state.compare.includes(market.id)}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h11l-3.2-3.2M17 16H6l3.2 3.2"/></svg></button><button data-detail="${escapeHtml(market.id)}" aria-label="View ${escapeHtml(market.name)}">↗</button></div></td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- Sync & layout ---------- */

  function sync({ detail }) {
    const studio = detail.state.view === 'Creator Studio';
    displayOptions.hidden = studio;
    table.hidden = studio || detail.state.layout === 'grid';
    cards.hidden = studio || detail.state.layout !== 'grid';
    if (!studio && detail.state.layout === 'list') renderTable(detail.markets);
    const sort = detail.state.sort;
    const sortLabels = { name: 'name', price: 'price', change: '24h change', volume: 'volume', score: 'score' };
    const rankLabel = document.getElementById('rankLabel');
    if (rankLabel) rankLabel.textContent = sort && sortLabels[sort.key]
      ? `Sorted by ${sortLabels[sort.key]} ${sort.dir === 'asc' ? '↑' : '↓'}`
      : 'Ranked by Turbo Score';
    if (detail.state.view === 'Explore' && detail.markets.length) updateSpotlight(detail.markets);
    else overview.hidden = detail.state.view !== 'Explore';
    if (detail.markets.length) updateRadar(detail.markets);
  }

  function setLayout(layout) {
    window.TurboPad.state.layout = layout;
    [['listView', 'list'], ['gridView', 'grid']].forEach(([id, value]) => {
      const selected = value === layout;
      const button = document.getElementById(id);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    window.TurboPad.render();
  }

  document.getElementById('listView').onclick = () => setLayout('list');
  document.getElementById('gridView').onclick = () => setLayout('grid');
  table.addEventListener('click', event => {
    const button = event.target.closest('[data-sort]');
    if (button) cycleSort(button.dataset.sort);
  });
  document.getElementById('sparkRanges').addEventListener('click', event => {
    const button = event.target.closest('[data-spark]');
    if (!button) return;
    window.TurboPad.state.sparkPeriod = button.dataset.spark;
    document.querySelectorAll('#sparkRanges [data-spark]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    window.TurboPad.render();
  });
  document.getElementById('chartRanges').onclick = event => {
    const button = event.target.closest('[data-period]');
    if (!button) return;
    selectedPeriod = button.dataset.period;
    document.querySelectorAll('[data-period]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    loadSpotlightChart();
  };
  document.addEventListener('turbopad:render', sync);
  document.addEventListener('turbopad:ready', () => {
    const markets = window.TurboPad.getVisibleMarkets();
    updateSpotlight(markets);
    updateRadar(window.TurboPad.markets);
  });
  sync({ detail: { state: window.TurboPad.state, markets: window.TurboPad.getVisibleMarkets() } });
})();
