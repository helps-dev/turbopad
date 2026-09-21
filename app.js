/* TurboPad app core — live markets, wallet, watchlist, battles, launch planner. */
(() => {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#dialog');
  const WATCHLIST_KEY = 'turbopad.watchlist.v2';
  const VOTES_KEY = 'turbopad.battles.v1';
  const DRAFTS_KEY = 'turbopad.launch.drafts.v1';
  const WALLET_KEY = 'turbopad.wallet.v1';

  const state = {
    view: 'Explore', filter: 'All', query: '', source: 'All chains', layout: 'list',
    saved: loadSet(WATCHLIST_KEY), markets: [], loading: true, error: null, updatedAt: null,
    wallet: loadJson(WALLET_KEY, null),
  };
  let votes = loadJson(VOTES_KEY, null);
  let statsAnimated = false;

  function loadSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]').filter(value => typeof value === 'string')); }
    catch { return new Set(); }
  }
  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  const persist = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  /* ---------- Live data ---------- */

  async function loadMarkets({ silent = false } = {}) {
    state.silent = silent;
    if (!silent) { state.loading = true; state.error = null; render(); }
    const [meme, rwa] = await Promise.allSettled([TurboData.memeMarkets(), TurboData.rwaMarkets()]);
    const markets = [
      ...(meme.status === 'fulfilled' ? meme.value : []),
      ...(rwa.status === 'fulfilled' ? rwa.value : []),
    ];
    if (!markets.length) {
      state.error = meme.reason?.message || rwa.reason?.message || 'Market data unavailable';
      state.loading = false;
      render();
      return;
    }
    // Detect price moves since the last snapshot for tick-flash styling.
    state.flash = new Map();
    if (silent) {
      const previous = new Map(state.markets.map(market => [market.id, market.price]));
      for (const market of markets) {
        const before = previous.get(market.id);
        if (before != null && before !== market.price) {
          state.flash.set(market.id, Number(market.price) > Number(before) ? 'up' : 'down');
        }
      }
    }
    state.markets = markets;
    state.loading = false;
    state.error = null;
    state.updatedAt = new Date();
    render();
    if (!window.__turbopadReady) {
      window.__turbopadReady = true;
      document.dispatchEvent(new CustomEvent('turbopad:ready'));
    }
    updateStats();
    updateBattlePanel();
  }

  function updateStats() {
    const meme = state.markets.filter(market => market.kind === 'meme');
    const rwa = state.markets.filter(market => market.kind === 'rwa');
    if (!meme.length) return;
    const volume = meme.reduce((sum, market) => sum + market.volumeRaw, 0);
    const txns = meme.reduce((sum, market) => sum + market.txns.buys + market.txns.sells, 0);
    const rwaCap = rwa.reduce((sum, market) => sum + market.capRaw, 0);
    const time = state.updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const cells = document.querySelectorAll('.stats > div');
    const values = [
      [`$${TurboData.compact(volume)}`, `Live · updated ${time}`],
      [txns.toLocaleString('en-US'), `Across ${meme.length} tracked markets`],
      [`$${TurboData.compact(volume * 0.005)}`, 'Illustrative 1% fee, 50% creator share'],
      [`$${TurboData.compact(rwaCap)}`, 'CoinGecko RWA basket'],
    ];
    const labels = ['24H VOLUME', '24H TRANSACTIONS', 'EST. CREATOR FEES', 'RWA MARKET CAP'];
    cells.forEach((cell, index) => {
      if (!values[index]) return;
      const [value, note] = values[index];
      cell.querySelector('span').textContent = labels[index];
      const strong = cell.querySelector('strong');
      strong.innerHTML = escapeHtml(value);
      cell.querySelector('small').innerHTML = `<i>${escapeHtml(note)}</i>`;
      if (!statsAnimated && window.TurboCountUp) window.TurboCountUp(strong, 150 + index * 120);
    });
    statsAnimated = true;
  }

  /* ---------- Filtering & rendering ---------- */

  function getVisibleMarkets() {
    const query = state.query.trim().toLowerCase();
    return state.markets
      .filter(market => {
        const matchesQuery = !query || `${market.name} ${market.symbol} ${market.creator}`.toLowerCase().includes(query);
        const matchesSource = state.source === 'All chains' || (state.source === 'RWA' ? market.kind === 'rwa' : market.source === state.source);
        const matchesView =
          state.view === 'RWA Markets' ? market.kind === 'rwa' :
          state.view === 'Turbo Radar' ? market.score !== null :
          state.view === 'Watchlist' ? state.saved.has(market.id) : true;
        const matchesFilter =
          state.filter === 'Trending' ? market.change > 10 :
          state.filter === 'New' ? market.age != null && market.age <= 360 :
          state.filter === 'Graduating' ? market.kind === 'meme' && market.progress >= 80 : true;
        return matchesQuery && matchesSource && matchesView && matchesFilter;
      })
      .sort((a, b) => state.view === 'Turbo Radar' ? (b.score || 0) - (a.score || 0) : 0);
  }

  function sparkline(market, width = 320, height = 96) {
    // Real multi-window returns from the API, drawn as cumulative performance.
    const now = 100;
    const points = [
      ['h24', market.change], ['h6', market.change6h ?? market.change],
      ['h1', market.change1h ?? market.change], ['m5', market.change5m ?? market.change1h ?? market.change],
    ].map(([, change]) => now / (1 + (Number(change) || 0) / 100));
    points.push(now);
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const stepX = width / (points.length - 1);
    const path = points.map((value, index) =>
      `${(index * stepX).toFixed(1)},${(height - 10 - ((value - min) / span) * (height - 24)).toFixed(1)}`
    ).join(' ');
    const down = market.change < 0;
    const color = down ? '#dc9e90' : '#d9af79';
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="24 hour trend from live data"><path d="M0 ${height * 0.33}H${width}M0 ${height * 0.7}H${width}" stroke="#4a4238" stroke-dasharray="3 5"/><polygon points="0,${height} ${path} ${width},${height}" fill="${color}" opacity=".05"/><polyline points="${path}" fill="none" stroke="${color}" stroke-width="1.7" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function avatar(market, extraClass = '') {
    const letter = escapeHtml((market.symbol || '?')[0]);
    const image = market.icon
      ? `<img src="${escapeHtml(market.icon)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `<div class="avatar ${extraClass}" style="--avatar:${market.color}">${letter}${image}</div>`;
  }

  const flashClass = id => (state.flash?.get(id) ? `tick-${state.flash.get(id)}` : '');

  function card(market) {
    const saved = state.saved.has(market.id);
    const name = escapeHtml(market.name), symbol = escapeHtml(market.symbol);
    return `<article class="market-card"><div class="card-head">${avatar(market)}<div class="token-info"><h3>${name}</h3><span>$${symbol} · ${market.kind === 'rwa' ? 'RWA token' : escapeHtml(market.ageLabel)}</span></div><button class="save ${saved ? 'saved' : ''}" data-save="${escapeHtml(market.id)}" aria-label="${saved ? 'Remove' : 'Add'} ${name} ${saved ? 'from' : 'to'} watchlist" aria-pressed="${saved}">${saved ? '★' : '☆'}</button></div><div class="card-price"><strong class="${flashClass(market.id)}">$${escapeHtml(market.price)}</strong><span class="change ${market.change < 0 ? 'negative' : ''}">${market.change > 0 ? '↗ +' : '↘ '}${market.change.toFixed(2)}%</span></div><div class="chart">${sparkline(market)}</div><div class="card-metrics"><div><span>24H VOLUME</span><b>$${market.volume}</b></div><div><span>MARKET CAP</span><b>$${market.cap}</b></div><div><span>${market.kind === 'rwa' ? 'SOURCE' : 'TURBO SCORE'}</span><b class="score-badge">${market.kind === 'rwa' ? 'CoinGecko' : `ϟ ${market.score}`}</b></div></div><div class="progress-caption"><span>${market.kind === 'rwa' ? 'Listed asset' : 'Liquidity depth'}</span><span>${market.kind === 'rwa' ? escapeHtml(market.ageLabel) : `${market.progress}%`}</span></div><div class="progress"><i style="width:${market.kind === 'rwa' ? 100 : market.progress}%"></i></div><div class="card-bottom"><span class="source-tag">◈ ${escapeHtml(market.source)}</span><button class="detail-button" data-detail="${escapeHtml(market.id)}">View market ↗</button></div></article>`;
  }

  const VIEW_COPY = {
    Explore: { title: 'Your next move.<br><em>Starts here.</em>', subtitle: 'Live markets.<br>Real momentum.', section: 'Discover markets' },
    'Turbo Radar': { title: 'Signal before the crowd.', subtitle: 'Live momentum, liquidity and buy pressure.', section: 'Radar signals' },
    'Meme Battles': { title: 'Community discovery.', subtitle: 'A place in the spotlight.', section: 'Discover markets' },
    'RWA Markets': { title: 'Markets with context.', subtitle: 'Live real-world asset tokens.', section: 'Real-world asset tokens' },
    'Creator Studio': { title: 'Creator Studio.', subtitle: 'Understand the economics behind your next launch.', section: 'Creator tools' },
    Watchlist: { title: 'Your next move.', subtitle: 'Your saved markets, ready when you are.', section: 'Saved markets' },
  };

  function updateChrome() {
    const copy = VIEW_COPY[state.view];
    $('#crumb').textContent = state.view;
    $('#title').innerHTML = copy.title;
    $('#subtitle').innerHTML = copy.subtitle;
    $('#sectionTitle').textContent = copy.section;
    $('#savedCount').textContent = state.saved.size;
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === state.filter));
    $('.controls').hidden = state.view === 'Creator Studio';
    $('#resultCount').hidden = state.view === 'Creator Studio';
  }

  function renderStudio() {
    $('#studio').innerHTML = '<div class="studio-panel"><span class="eyebrow">CREATOR REVENUE / SIMULATOR</span><h3>Build a community.<br>Share in its activity.</h3><p class="dialog-copy">Illustrative allocation: a 1% trading fee, with 50% of that fee assigned to the creator.</p><label for="volume">Trading volume in USD</label><input class="revenue-input" type="number" id="volume" value="100000" min="0" step="1000"><div class="revenue-result" id="revenue">$500.00</div><span class="muted">Estimated creator revenue · not a payout</span><div class="allocations"><i></i><i></i><i></i></div><p class="dialog-copy">50% Creator · 30% Protocol · 20% Ecosystem</p><button class="lime" data-launch>Plan a token launch ↗</button></div>';
  }

  function render() {
    updateChrome();
    const visible = getVisibleMarkets();
    const cards = $('#cards');
    if (state.loading && !state.markets.length) {
      cards.innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton-card"></div>').join('');
      $('#resultCount').textContent = 'Loading live markets…';
    } else if (state.error && !state.markets.length) {
      cards.innerHTML = `<div class="empty">Live market data could not be loaded.<br>${escapeHtml(state.error)}</div><button class="outline" id="retryLoad">Retry ↻</button>`;
      $('#resultCount').textContent = 'Connection issue';
    } else {
      cards.innerHTML = visible.map(card).join('') || '<div class="empty">No markets match these filters.<br>Try another filter or broaden your search.</div>';
      $('#resultCount').textContent = `${visible.length} ${visible.length === 1 ? 'market' : 'markets'}`;
    }
    $('#studio').hidden = state.view !== 'Creator Studio';
    if (state.view === 'Creator Studio') renderStudio();
    const foot = document.querySelector('.market-foot span');
    if (foot && state.updatedAt) {
      foot.textContent = `Live data · updated ${state.updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    window.TurboPad.markets = state.markets;
    document.dispatchEvent(new CustomEvent('turbopad:render', { detail: { state, markets: visible } }));
    // Entrance stagger applies to explicit renders only; silent refreshes stay calm.
    state.silent = false;
  }

  function setView(nextView) {
    state.view = nextView;
    state.filter = 'All';
    state.query = '';
    state.source = 'All chains';
    $('#search').value = '';
    $('#source').value = 'All chains';
    render();
    // Soft cross-slide for the content region on every view change.
    const region = document.querySelector('.content-grid');
    if (region) {
      region.classList.remove('view-shift');
      void region.offsetWidth;
      region.classList.add('view-shift');
    }
    if (nextView === 'Meme Battles') battle();
  }

  /* ---------- Dialogs ---------- */

  function open(content) {
    $('#dialogContent').innerHTML = content;
    if (!dialog.open) dialog.showModal();
  }

  function byId(id) { return state.markets.find(market => market.id === id); }

  function detail(id) {
    const market = byId(id);
    if (!market) return;
    const saved = state.saved.has(market.id);
    const links = [
      ...market.websites.map(site => ({ label: site.label || 'Website', url: site.url })),
      ...market.socials.map(social => ({ label: social.type || 'Social', url: social.url })),
    ].slice(0, 3);
    open(`<div class="token-heading">${avatar(market)}<div><h2>${escapeHtml(market.name)}</h2><span>$${escapeHtml(market.symbol)} · ${escapeHtml(market.source)}</span></div></div><div class="card-price"><strong>$${escapeHtml(market.price)}</strong><span class="change ${market.change < 0 ? 'negative' : ''}">${market.change > 0 ? '↗ +' : '↘ '}${market.change.toFixed(2)}% · 24h</span></div><div class="chart" id="detailChart">${sparkline(market)}</div><p class="dialog-copy">${market.kind === 'rwa' ? 'Live RWA token data from CoinGecko. Listing does not constitute endorsement or investment advice.' : 'Live data from DexScreener. Turbo Score measures trading activity — it does not certify token safety.'}</p><div class="score-list"><div class="score-line"><span>24h volume</span><b>$${market.volume}</b></div><div class="score-line"><span>${market.kind === 'rwa' ? 'Market cap' : 'Liquidity'}</span><b>$${market.kind === 'rwa' ? market.cap : market.liquidity}</b></div>${market.kind === 'rwa' ? '' : `<div class="score-line"><span>24h transactions</span><b>${(market.txns.buys + market.txns.sells).toLocaleString('en-US')}</b></div>`}<div class="score-line"><span>${market.kind === 'rwa' ? 'Rank source' : 'Turbo Score'}</span><b>${market.kind === 'rwa' ? 'CoinGecko' : `ϟ ${market.score} / 100`}</b></div></div>${links.length ? `<div class="link-row">${links.map(link => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a>`).join('')}</div>` : ''}<button class="outline full" data-save="${escapeHtml(market.id)}">${saved ? 'Remove from' : 'Add to'} watchlist</button><a class="lime full link-button" href="${escapeHtml(market.url)}" target="_blank" rel="noopener noreferrer">Trade on ${market.kind === 'rwa' ? 'CoinGecko' : 'DexScreener'} ↗</a>`);
    if (market.kind === 'meme') {
      TurboData.ohlcv(market.chainId, market.id, '24H')
        .then(candles => {
          const target = document.getElementById('detailChart');
          if (target && dialog.open) target.innerHTML = candleChart(candles);
        })
        .catch(() => {});
    }
  }

  function candleChart(candles, width = 320, height = 96) {
    const closes = candles.map(candle => candle.close);
    const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
    const stepX = width / Math.max(1, closes.length - 1);
    const path = closes.map((close, index) =>
      `${(index * stepX).toFixed(1)},${(height - 8 - ((close - min) / span) * (height - 18)).toFixed(1)}`
    ).join(' ');
    const up = closes[closes.length - 1] >= closes[0];
    const color = up ? '#d9af79' : '#dc9e90';
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Live price chart"><polygon points="0,${height} ${path} ${width},${height}" fill="${color}" opacity=".05"/><polyline points="${path}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /* ---------- Toast & watchlist ---------- */

  function toast(message) {
    const element = $('#toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function toggleSaved(id) {
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    persist(WATCHLIST_KEY, [...state.saved]);
    render();
    toast(state.saved.has(id) ? 'Added to your watchlist' : 'Removed from your watchlist');
    if (dialog.open) detail(id);
  }

  /* ---------- Meme battles (local, persistent) ---------- */

  function battlePair() {
    const meme = state.markets.filter(market => market.kind === 'meme').slice(0, 2);
    return meme.length === 2 ? meme : null;
  }

  function getVotes(pair) {
    if (!votes || votes.a !== pair[0].id || votes.b !== pair[1].id) {
      votes = { a: pair[0].id, b: pair[1].id, counts: { [pair[0].id]: 64, [pair[1].id]: 36 } };
      persist(VOTES_KEY, votes);
    }
    return votes;
  }

  function updateBattlePanel() {
    const pair = battlePair();
    if (!pair) return;
    const tally = getVotes(pair);
    const total = tally.counts[pair[0].id] + tally.counts[pair[1].id];
    const left = Math.round((tally.counts[pair[0].id] / total) * 100);
    const panel = document.querySelector('.battle-panel');
    const cells = panel.querySelectorAll('.fight > div');
    cells[0].innerHTML = `${avatar(pair[0], 'lime-avatar')}<b>$${escapeHtml(pair[0].symbol)}</b>`;
    cells[1].innerHTML = `${avatar(pair[1], 'purple-avatar')}<b>$${escapeHtml(pair[1].symbol)}</b>`;
    $('#battleFill').style.width = `${left}%`;
    $('#battleLeft').textContent = `${left}%`;
    $('#battleRight').textContent = `${100 - left}%`;
  }

  function battle() {
    const pair = battlePair();
    if (!pair) { open('<h2>The arena is warming up.</h2><p class="dialog-copy">Live markets are still loading. Try again in a moment.</p>'); return; }
    const tally = getVotes(pair);
    open(`<h2>Choose your community.</h2><p class="dialog-copy">Live standings from this device's votes. The winning community receives discovery exposure in this concept — not financial rewards.</p><div class="fight"><div>${avatar(pair[0], 'lime-avatar')}<b>$${escapeHtml(pair[0].symbol)}</b><span class="muted">${tally.counts[pair[0].id]} votes</span></div><span>VS</span><div>${avatar(pair[1], 'purple-avatar')}<b>$${escapeHtml(pair[1].symbol)}</b><span class="muted">${tally.counts[pair[1].id]} votes</span></div></div><button class="lime full" data-vote="${escapeHtml(pair[0].id)}">Support $${escapeHtml(pair[0].symbol)}</button><button class="outline full" data-vote="${escapeHtml(pair[1].id)}">Support $${escapeHtml(pair[1].symbol)}</button>`);
  }

  function castVote(id) {
    const market = byId(id);
    if (!market || !votes) return;
    votes.counts[id] = (votes.counts[id] || 0) + 1;
    persist(VOTES_KEY, votes);
    updateBattlePanel();
    dialog.close();
    toast(`Vote recorded for $${market.symbol} on this device`);
  }

  /* ---------- Wallet (read-only connection) ---------- */

  const shortAddress = address => `${address.slice(0, 6)}…${address.slice(-4)}`;

  function paintWallet() {
    const button = $('#wallet');
    button.innerHTML = state.wallet ? `◈ &nbsp; ${escapeHtml(shortAddress(state.wallet.address))}` : '◈ &nbsp; Connect wallet';
  }

  async function connectWallet() {
    if (state.wallet) {
      open(`<h2>Connected wallet</h2><p class="dialog-copy">${escapeHtml(state.wallet.provider)} wallet connected read-only. TurboPad never requests signatures or funds.</p><div class="score-list"><div class="score-line"><span>Address</span><b>${escapeHtml(shortAddress(state.wallet.address))}</b></div></div><button class="outline full" id="disconnectWallet">Disconnect</button>`);
      return;
    }
    try {
      if (window.ethereum?.request) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts?.[0]) {
          state.wallet = { address: accounts[0], provider: 'EVM' };
          persist(WALLET_KEY, state.wallet);
          paintWallet();
          toast('EVM wallet connected (read-only)');
          return;
        }
      }
      if (window.solana?.connect) {
        const response = await window.solana.connect();
        const address = response.publicKey?.toString();
        if (address) {
          state.wallet = { address, provider: 'Solana' };
          persist(WALLET_KEY, state.wallet);
          paintWallet();
          toast('Solana wallet connected (read-only)');
          return;
        }
      }
      open('<h2>No wallet detected</h2><p class="dialog-copy">Install a browser wallet to connect. TurboPad only reads your public address — it never requests signatures or funds.</p><div class="link-row"><a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">MetaMask ↗</a><a href="https://phantom.com/" target="_blank" rel="noopener noreferrer">Phantom ↗</a></div>');
    } catch (error) {
      toast(error?.code === 4001 ? 'Connection request declined' : 'Wallet connection failed');
    }
  }

  /* ---------- Launch planner (local drafts, honest outbound) ---------- */

  function launch() {
    open('<h2>Plan your launch.</h2><p class="dialog-copy">Drafts are saved on this device. Publishing a token happens on a real launchpad — TurboPad links you there.</p><form id="launchForm"><label for="tokenName">Token name</label><input id="tokenName" required maxlength="40" placeholder="Turbo Cat"><label for="ticker">Ticker</label><input id="ticker" required maxlength="10" pattern="[A-Za-z0-9]+" placeholder="TCAT"><label for="launchMode">Launch mode</label><select id="launchMode"><option>Fair launch · bonding curve</option><option>Standard · fixed supply</option></select><button class="lime full" type="submit">Save launch draft ↗</button></form>');
  }

  function saveDraft(event) {
    event.preventDefault();
    const drafts = loadJson(DRAFTS_KEY, []);
    const draft = {
      name: $('#tokenName').value.trim(),
      ticker: $('#ticker').value.trim().toUpperCase(),
      mode: $('#launchMode').value,
      created: Date.now(),
    };
    drafts.unshift(draft);
    persist(DRAFTS_KEY, drafts.slice(0, 10));
    open(`<h2>Draft saved.</h2><p class="dialog-copy"><b>${escapeHtml(draft.name)} ($${escapeHtml(draft.ticker)})</b> is stored on this device. When you are ready, publish through an established launchpad:</p><div class="score-list">${drafts.slice(0, 3).map((item, index) => `<div class="score-line"><span>${index === 0 ? 'Latest' : `Draft ${index + 1}`}</span><b>$${escapeHtml(item.ticker)}</b></div>`).join('')}</div><div class="link-row"><a href="https://pump.fun/create" target="_blank" rel="noopener noreferrer">pump.fun ↗</a><a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer">DexScreener ↗</a></div><button class="outline full" id="closeTrade">Back to markets</button>`);
  }

  /* ---------- Search (local filter + live remote search) ---------- */

  async function remoteSearch() {
    const query = state.query.trim();
    if (query.length < 2) return;
    toast(`Searching DexScreener for “${query}”…`);
    try {
      const results = await TurboData.searchMarkets(query);
      if (!results.length) { toast('No live markets match that search'); return; }
      const known = new Map(state.markets.map(market => [market.id, market]));
      results.forEach(market => known.set(market.id, market));
      state.markets = [...known.values()];
      if (state.view !== 'Explore') setView('Explore'); else render();
      toast(`${results.length} live result${results.length === 1 ? '' : 's'} for “${query}”`);
    } catch {
      toast('Live search is unavailable right now');
    }
  }

  /* ---------- Events ---------- */

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.view) setView(button.dataset.view);
    if (button.dataset.filter) { state.filter = button.dataset.filter; render(); }
    if ('save' in button.dataset) toggleSaved(button.dataset.save);
    if ('detail' in button.dataset) detail(button.dataset.detail);
    if ('launch' in button.dataset) launch();
    if (button.dataset.vote) castVote(button.dataset.vote);
    if (button.id === 'retryLoad') loadMarkets();
    if (button.id === 'disconnectWallet') {
      state.wallet = null;
      localStorage.removeItem(WALLET_KEY);
      paintWallet();
      dialog.close();
      toast('Wallet disconnected');
    }
    if (button.id === 'closeTrade') dialog.close();
  });

  document.querySelector('.brand-refined').addEventListener('click', event => { event.preventDefault(); setView('Explore'); });
  $('#close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  $('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('#search').addEventListener('keydown', event => { if (event.key === 'Enter') remoteSearch(); });
  $('#source').addEventListener('change', event => { state.source = event.target.value; render(); });
  $('#radarMore').onclick = () => setView('Turbo Radar');
  $('#battleOpen').onclick = battle;
  $('#wallet').onclick = connectWallet;
  $('#scoreHelp').onclick = () => open('<h2>Turbo Score, computed live.</h2><p class="dialog-copy">Every score is calculated from real 24h market activity, refreshed each minute.</p><div class="score-list">' + [['24h volume', '30%'], ['Transactions', '20%'], ['Liquidity depth', '20%'], ['Price momentum', '15%'], ['Buy pressure', '15%']].map(([label, weight]) => `<div class="score-line"><span>${label}</span><b>${weight}</b></div>`).join('') + '</div><p class="dialog-copy">Activity is not safety. Always verify contracts before trading.</p>');
  document.addEventListener('input', event => {
    if (event.target.id === 'volume') {
      $('#revenue').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
        .format(Math.max(0, Number(event.target.value) || 0) * 0.005);
    }
  });
  document.addEventListener('submit', event => { if (event.target.id === 'launchForm') saveDraft(event); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.updatedAt && Date.now() - state.updatedAt > 60000) loadMarkets({ silent: true });
  });

  window.TurboPad = { markets: state.markets, state, getVisibleMarkets, chart: candleChart, sparkline, detail, render, setView };

  paintWallet();
  render();
  loadMarkets();
  setInterval(() => { if (!document.hidden && !state.loading) loadMarkets({ silent: true }); }, 60000);
})();
