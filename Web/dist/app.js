/* TurboPad app core — live markets, wallet, watchlist, battles, launch planner. */
(() => {
  const $ = selector => document.querySelector(selector);
  const dialog = $('#dialog');
  const WATCHLIST_KEY = 'turbopad.watchlist.v2';
  const VOTES_KEY = 'turbopad.battles.v1';
  const DRAFTS_KEY = 'turbopad.launch.drafts.v1';
  const DEPLOYS_KEY = 'turbopad.deploys.v1';
  const WALLET_KEY = 'turbopad.wallet.v1';

  const state = {
    view: 'Explore', filter: 'All', query: '', source: 'All chains', layout: 'list',
    saved: loadSet(WATCHLIST_KEY), markets: [], loading: true, error: null, updatedAt: null,
    wallet: loadJson(WALLET_KEY, null), compare: [], sort: null, sparkPeriod: '24H',
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
    // Pin the featured token (e.g. official TURBO) ahead of every market.
    try {
      const featured = await TurboData.featuredMarket();
      if (featured) {
        const rest = markets.filter(market => market.id !== featured.id);
        markets.length = 0;
        markets.push(featured, ...rest);
      }
    } catch { /* featured token not configured or not indexed yet */ }
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

  function sparkline(market, width = 320, height = 96, period = state.sparkPeriod) {
    // Real multi-window returns from the API, drawn as cumulative performance.
    const now = 100;
    const m5 = market.change5m ?? market.change1h ?? market.change;
    const h1 = market.change1h ?? market.change;
    const h6 = market.change6h ?? market.change;
    const WINDOWS = {
      '1H': [h1, m5],
      '6H': [h6, h1, m5],
      '24H': [market.change, h6, h1, m5],
    };
    const changes = WINDOWS[period] || WINDOWS['24H'];
    const points = changes.map(change => now / (1 + (Number(change) || 0) / 100));
    points.push(now);
    const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
    const stepX = width / (points.length - 1);
    const path = points.map((value, index) =>
      `${(index * stepX).toFixed(1)},${(height - 10 - ((value - min) / span) * (height - 24)).toFixed(1)}`
    ).join(' ');
    // Colour by the selected period's overall change (first window in the series).
    const down = (changes[0] ?? market.change) < 0;
    const color = down ? '#dc9e90' : '#d9af79';
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${period} trend from live data"><path d="M0 ${height * 0.33}H${width}M0 ${height * 0.7}H${width}" stroke="#4a4238" stroke-dasharray="3 5"/><polygon points="0,${height} ${path} ${width},${height}" fill="${color}" opacity=".05"/><polyline points="${path}" fill="none" stroke="${color}" stroke-width="1.7" vector-effect="non-scaling-stroke"/></svg>`;
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
    const featuredBadge = market.featured ? `<span class="featured-badge">${escapeHtml(window.TurboFeatured?.badge || 'OFFICIAL')}</span>` : '';
    return `<article class="market-card ${market.featured ? 'featured' : ''}"><div class="card-head">${avatar(market)}<div class="token-info"><h3>${name}</h3><span>$${symbol} · ${market.kind === 'rwa' ? 'RWA token' : escapeHtml(market.ageLabel)}</span></div>${featuredBadge}<button class="save ${saved ? 'saved' : ''}" data-save="${escapeHtml(market.id)}" aria-label="${saved ? 'Remove' : 'Add'} ${name} ${saved ? 'from' : 'to'} watchlist" aria-pressed="${saved}">${saved ? '★' : '☆'}</button></div><div class="card-price"><strong class="${flashClass(market.id)}">$${escapeHtml(market.price)}</strong><span class="change ${market.change < 0 ? 'negative' : ''}">${market.change > 0 ? '↗ +' : '↘ '}${market.change.toFixed(2)}%</span></div><div class="chart">${sparkline(market)}</div><div class="card-metrics"><div><span>24H VOLUME</span><b>$${market.volume}</b></div><div><span>MARKET CAP</span><b>$${market.cap}</b></div><div><span>${market.kind === 'rwa' ? 'SOURCE' : 'TURBO SCORE'}</span><b class="score-badge">${market.kind === 'rwa' ? 'CoinGecko' : `ϟ ${market.score}`}</b></div></div><div class="progress-caption"><span>${market.kind === 'rwa' ? 'Listed asset' : 'Liquidity depth'}</span><span>${market.kind === 'rwa' ? escapeHtml(market.ageLabel) : `${market.progress}%`}</span></div><div class="progress"><i style="width:${market.kind === 'rwa' ? 100 : market.progress}%"></i></div><div class="card-bottom"><span class="source-tag">◈ ${escapeHtml(market.source)}</span><div class="card-actions"><button class="compare-btn ${state.compare.includes(market.id) ? 'active' : ''}" data-compare="${escapeHtml(market.id)}" aria-label="Compare ${name}" aria-pressed="${state.compare.includes(market.id)}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h11l-3.2-3.2M17 16H6l3.2 3.2"/></svg></button><button class="detail-button" data-detail="${escapeHtml(market.id)}">View market ↗</button></div></div></article>`;
  }

  const VIEW_COPY = {
    Explore: { title: 'Your next move.<br><em>Starts here.</em>', subtitle: 'Live markets.<br>Real momentum.', section: 'Discover markets' },
    'Turbo Radar': { title: 'Signal before the crowd.', subtitle: 'Live momentum, liquidity and buy pressure.', section: 'Radar signals' },
    Trade: { title: 'Trade the chain.', subtitle: 'Buy and sell on Uniswap V3, straight from your wallet.', section: 'Trade' },
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
    const isToolView = state.view === 'Creator Studio' || state.view === 'Trade';
    $('.controls').hidden = isToolView;
    $('#resultCount').hidden = isToolView;
  }

  function renderStudio() {
    $('#studio').innerHTML = '<div class="studio-panel"><span class="eyebrow">CREATOR REVENUE / SIMULATOR</span><h3>Build a community.<br>Share in its activity.</h3><p class="dialog-copy">Illustrative allocation: a 1% trading fee, with 50% of that fee assigned to the creator.</p><label for="volume">Trading volume in USD</label><input class="revenue-input" type="number" id="volume" value="100000" min="0" step="1000"><div class="revenue-result" id="revenue">$500.00</div><span class="muted">Estimated creator revenue · not a payout</span><div class="allocations"><i></i><i></i><i></i></div><p class="dialog-copy">50% Creator · 30% Protocol · 20% Ecosystem</p><button class="lime" data-launch>Plan a token launch ↗</button></div>';
  }

  /* ---------- Trade (Uniswap V3 on Robinhood Chain) ---------- */

  const trade = { direction: 'buy', meta: null, quoting: 0 };
  let tradeQuoteTimer = null;

  function renderTrade() {
    const panel = $('#trade');
    if (!panel.dataset.built) {
      panel.dataset.built = '1';
      panel.innerHTML = `<div class="studio-panel trade-box"><span class="eyebrow">TRADE / UNISWAP V3 · ROBINHOOD CHAIN</span><h3>Buy &amp; sell.<br>Straight from your wallet.</h3><p class="dialog-copy">Swaps run on the canonical Uniswap V3 deployment. Quotes come live from on-chain pools — your wallet signs every transaction.</p><label for="tradeToken">Token contract address</label><input id="tradeToken" placeholder="0x…" spellcheck="false" autocomplete="off"><div class="trade-meta muted" id="tradeMeta"></div><div class="trade-direction" role="group" aria-label="Trade direction"><button class="selected" id="tradeBuy" type="button">BUY · ETH → token</button><button id="tradeSell" type="button">SELL · token → ETH</button></div><label for="tradeAmount" id="tradeAmountLabel">Amount in ETH</label><input id="tradeAmount" type="number" min="0" step="any" placeholder="0.01"><label for="tradeSlippage">Slippage tolerance</label><select id="tradeSlippage"><option value="50">0.5%</option><option value="100" selected>1%</option><option value="300">3%</option></select><div class="trade-quote" id="tradeQuote">Paste a token address and enter an amount to get a live quote.</div><button class="lime full" id="tradeExecute" type="button">Connect wallet to trade</button><p class="dialog-copy fine-print">Only tokens with a Uniswap V3 pool on Robinhood Chain can be traded. A freshly deployed token needs liquidity first.</p></div>`;
    }
    paintTrade();
  }

  function paintTrade() {
    const isBuy = trade.direction === 'buy';
    $('#tradeBuy')?.classList.toggle('selected', isBuy);
    $('#tradeSell')?.classList.toggle('selected', !isBuy);
    const label = $('#tradeAmountLabel');
    if (label) label.textContent = isBuy ? 'Amount in ETH' : `Amount in ${trade.meta?.symbol || 'tokens'}`;
    const execute = $('#tradeExecute');
    if (execute) execute.textContent = state.wallet?.provider === 'EVM'
      ? (isBuy ? 'Buy with ETH ↗' : 'Sell for ETH ↗')
      : 'Connect wallet to trade';
  }

  function scheduleTradeQuote() {
    clearTimeout(tradeQuoteTimer);
    tradeQuoteTimer = setTimeout(tradeQuote, 500);
  }

  async function tradeQuote() {
    const quoteEl = $('#tradeQuote');
    if (!quoteEl) return;
    const address = $('#tradeToken').value.trim();
    const amountText = $('#tradeAmount').value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !amountText || Number(amountText) <= 0) {
      quoteEl.textContent = 'Paste a token address and enter an amount to get a live quote.';
      return;
    }
    const ticket = ++trade.quoting;
    try {
      if (trade.meta?.address?.toLowerCase() !== address.toLowerCase()) {
        quoteEl.textContent = 'Reading token contract…';
        const meta = await TurboSwap.tokenMeta(address);
        if (ticket !== trade.quoting) return;
        trade.meta = { address, ...meta };
        $('#tradeMeta').textContent = `${meta.symbol} · ${meta.decimals} decimals · verified on-chain`;
        paintTrade();
      }
      quoteEl.textContent = 'Quoting on-chain pools…';
      const isBuy = trade.direction === 'buy';
      const amountWei = TurboSwap.parseUnits(amountText, isBuy ? 18 : trade.meta.decimals);
      const { amountOut, fee } = await TurboSwap.quote(isBuy ? TurboSwap.WETH : address, isBuy ? address : TurboSwap.WETH, amountWei);
      if (ticket !== trade.quoting) return;
      const outText = isBuy
        ? `${TurboSwap.formatUnits(amountOut, trade.meta.decimals)} ${trade.meta.symbol}`
        : `${TurboSwap.formatUnits(amountOut, 18)} ETH`;
      quoteEl.innerHTML = `≈ <b>${escapeHtml(outText)}</b> · pool fee ${fee / 10000}% · live from Uniswap V3`;
    } catch (error) {
      if (ticket !== trade.quoting) return;
      trade.meta = trade.meta?.address?.toLowerCase() === address.toLowerCase() ? trade.meta : null;
      quoteEl.textContent = error?.message || 'Quote failed';
    }
  }

  async function tradeExecute() {
    if (!state.wallet || state.wallet.provider !== 'EVM') { connectWallet(); return; }
    if (!walletOnRobinhood()) {
      try { await TurboChain.ensureRobinhood(); await refreshWalletState(); }
      catch { toast('Switch your wallet to Robinhood Chain to trade'); return; }
    }
    const address = $('#tradeToken').value.trim();
    const amountText = $('#tradeAmount').value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { toast('Enter a valid token contract address'); return; }
    if (!amountText || Number(amountText) <= 0) { toast('Enter an amount first'); return; }
    const status = message => { const el = $('#tradeQuote'); if (el) el.textContent = message; };
    const isBuy = trade.direction === 'buy';
    try {
      const amountWei = TurboSwap.parseUnits(amountText, isBuy ? 18 : (trade.meta?.decimals ?? 18));
      const execute = isBuy ? TurboSwap.buy : TurboSwap.sell;
      const result = await execute({ token: address, amountWei, slippageBps: Number($('#tradeSlippage').value), onStatus: status });
      refreshWalletState();
      open(`<h2>${isBuy ? 'Buy' : 'Sell'} confirmed.</h2><p class="dialog-copy">Your swap executed on Uniswap V3 · Robinhood Chain mainnet.</p><div class="score-list"><div class="score-line"><span>Transaction</span><b><a href="${TurboChain.explorerTx(result.hash)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortAddress(result.hash))} ↗</a></b></div><div class="score-line"><span>Pool fee tier</span><b>${result.fee / 10000}%</b></div></div><button class="outline full" id="closeTrade">Done</button>`);
      toast('Swap confirmed on-chain');
    } catch (error) {
      status(error?.code === 4001 ? 'Signature declined — nothing was sent.' : (error?.message || 'Swap failed'));
      toast(error?.code === 4001 ? 'Signature declined' : 'Swap failed');
    }
  }

  function openTrade(tokenAddress) {
    if (!tokenPage.hidden) closeTokenPage();
    setView('Trade');
    const input = $('#tradeToken');
    if (input && tokenAddress) {
      input.value = tokenAddress;
      scheduleTradeQuote();
    }
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
    $('#trade').hidden = state.view !== 'Trade';
    if (state.view === 'Trade') renderTrade();
    const foot = document.querySelector('.market-foot span');
    if (foot && state.updatedAt) {
      foot.textContent = `Live data · updated ${state.updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    window.TurboPad.markets = state.markets;
    document.dispatchEvent(new CustomEvent('turbopad:render', { detail: { state, markets: visible } }));
    // Entrance stagger applies to explicit renders only; silent refreshes stay calm.
    state.silent = false;
    renderTray();
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

  /* ---------- Immersive token page ---------- */

  const tokenPage = $('#tokenPage');
  const tokenPageBody = $('#tokenPageBody');
  let tokenPageId = null;
  let tokenPeriod = '24H';

  function detail(id) { openTokenPage(id); }

  function openTokenPage(id) {
    const market = byId(id);
    if (!market) return;
    tokenPageId = id;
    tokenPeriod = '24H';
    renderTokenPage(market);
    tokenPage.hidden = false;
    tokenPage.classList.remove('closing');
    document.body.classList.add('token-open');
    tokenPage.scrollTop = 0;
    if (!location.hash.startsWith('#token/')) history.pushState(null, '', `#token/${encodeURIComponent(id)}`);
    renderTray();
    if (market.kind === 'meme') loadTokenChart(market);
  }

  function closeTokenPage() {
    if (tokenPage.hidden) return;
    tokenPage.classList.add('closing');
    document.body.classList.remove('token-open');
    tokenPageId = null;
    setTimeout(() => { tokenPage.hidden = true; tokenPage.classList.remove('closing'); renderTray(); }, 210);
  }

  function requestCloseTokenPage() {
    if (location.hash.startsWith('#token/')) history.back();
    else closeTokenPage();
  }

  function bigChart(candles, period) {
    const width = 720, height = 300;
    const closes = candles.map(candle => candle.close);
    const min = Math.min(...closes), max = Math.max(...closes), span = max - min || 1;
    const stepX = width / Math.max(1, closes.length - 1);
    const x = index => (index * stepX).toFixed(1);
    const y = value => (height - 30 - ((value - min) / span) * (height - 70)).toFixed(1);
    const path = closes.map((close, index) => `${x(index)},${y(close)}`).join(' ');
    const maxVolume = Math.max(...candles.map(candle => candle.volume || 0), 1);
    const barWidth = Math.max(2, stepX * 0.45);
    const bars = candles.map((candle, index) => {
      const barHeight = 8 + ((candle.volume || 0) / maxVolume) * 34;
      return `<rect x="${(index * stepX - barWidth / 2).toFixed(1)}" y="${height - barHeight}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" fill="#d9af79" opacity=".12"/>`;
    }).join('');
    const ticks = 6;
    const axis = Array.from({ length: ticks }, (_, tick) => {
      const candle = candles[Math.round((candles.length - 1) * (tick / (ticks - 1)))];
      const date = new Date(candle.t);
      const label = period === '7D'
        ? date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
        : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `<span>${label}</span>`;
    }).join('');
    return {
      svg: `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Live ${period} price chart"><defs><linearGradient id="tpArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d9af79" stop-opacity=".22"/><stop offset="1" stop-color="#d9af79" stop-opacity="0"/></linearGradient></defs><path d="M0 45H720M0 110H720M0 175H720M0 240H720" stroke="#ffffff0c" stroke-dasharray="2 6"/>${bars}<polygon points="0,${height} ${path} ${width},${height}" fill="url(#tpArea)"/><polyline points="${path}" fill="none" stroke="#d9af79" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(closes.length - 1)}" cy="${y(closes[closes.length - 1])}" r="4.5" fill="#ecd2ad"/></svg>`,
      axis,
    };
  }

  function loadTokenChart(market) {
    const chartEl = document.getElementById('tpChart');
    if (!chartEl) return;
    chartEl.innerHTML = '<div class="chart-loading">Loading live chart…</div>';
    TurboData.ohlcv(market.chainId, market.id, tokenPeriod)
      .then(candles => {
        if (tokenPageId !== market.id) return;
        const rendered = bigChart(candles, tokenPeriod);
        const target = document.getElementById('tpChart');
        const axisEl = document.getElementById('tpAxis');
        if (target) target.innerHTML = rendered.svg;
        if (axisEl) axisEl.innerHTML = rendered.axis;
      })
      .catch(() => {
        const target = document.getElementById('tpChart');
        const axisEl = document.getElementById('tpAxis');
        if (target) target.innerHTML = sparkline(market, 720, 300);
        if (axisEl) axisEl.innerHTML = ['-24h', '-18h', '-12h', '-6h', 'Now'].map(label => `<span>${label}</span>`).join('');
      });
  }

  function renderTokenPage(market) {
    const saved = state.saved.has(market.id);
    const total = market.txns.buys + market.txns.sells;
    const buyShare = total ? Math.round((market.txns.buys / total) * 100) : 0;
    const links = [
      ...market.websites.map(site => ({ label: site.label || 'Website', url: site.url })),
      ...market.socials.map(social => ({ label: social.type || 'Social', url: social.url })),
    ].slice(0, 4);
    const stats = market.kind === 'rwa'
      ? [['24H VOLUME', `$${market.volume}`], ['MARKET CAP', `$${market.cap}`], ['DATA SOURCE', 'CoinGecko'], ['ASSET TYPE', 'RWA token']]
      : [['24H VOLUME', `$${market.volume}`], ['LIQUIDITY', `$${market.liquidity}`], ['MARKET CAP', `$${market.cap}`], ['TRANSACTIONS', total.toLocaleString('en-US'), '24h'], ['BUYS', market.txns.buys.toLocaleString('en-US')], ['SELLS', market.txns.sells.toLocaleString('en-US')], ['BUY PRESSURE', `${buyShare}%`], ['PAIR AGE', market.ageLabel]];
    tokenPageBody.innerHTML = `
      <div class="tp-hero tp-section-anim" style="--tp-delay:0ms">
        <div class="avatar tp-avatar" style="--avatar:${market.color}">${escapeHtml((market.symbol || '?')[0])}${market.icon ? `<img src="${escapeHtml(market.icon)}" alt="" onerror="this.remove()">` : ''}</div>
        <div><h2>${escapeHtml(market.name)}<span>$${escapeHtml(market.symbol)}</span></h2><p class="tp-sub">◈ ${escapeHtml(market.source)} · ${escapeHtml(market.creator)}${market.kind === 'meme' ? ` · ϟ Turbo Score ${market.score}` : ''}</p></div>
        <div class="tp-hero-actions">
          <button class="outline" data-save="${escapeHtml(market.id)}">${saved ? '★ In watchlist' : '☆ Add to watchlist'}</button>
          ${market.chainId === 'robinhood' && market.address ? `<button class="lime" data-trade="${escapeHtml(market.address)}">Trade on TurboPad ↗</button>` : ''}
          <a class="lime link-button" href="${escapeHtml(market.url)}" target="_blank" rel="noopener noreferrer" style="padding:10px 18px">Trade on ${market.kind === 'rwa' ? 'CoinGecko' : 'DexScreener'} ↗</a>
        </div>
      </div>
      <div class="tp-price-row tp-section-anim" style="--tp-delay:70ms">
        <span class="tp-price">$${escapeHtml(market.price)}</span>
        <span class="tp-change ${market.change < 0 ? 'negative' : 'up'}">${market.change > 0 ? '↗ +' : '↘ '}${market.change.toFixed(2)}% <small>24h</small></span>
      </div>
      <div class="tp-panel tp-section-anim" style="--tp-delay:130ms">
        <div class="chart-tools"><span>PRICE / USD</span><div id="tpRanges" role="group" aria-label="Chart period">${['1H', '24H', '7D'].map(period => `<button data-tp-period="${period}" class="${period === tokenPeriod ? 'selected' : ''}" aria-pressed="${period === tokenPeriod}">${period}</button>`).join('')}</div></div>
        <div class="tp-chart" id="tpChart">${market.kind === 'rwa' ? sparkline(market, 720, 300) : '<div class="chart-loading">Loading live chart…</div>'}</div>
        <div class="tp-axis" id="tpAxis"></div>
      </div>
      <div class="tp-stats tp-section-anim" style="--tp-delay:190ms">${stats.map(([label, value, note]) => `<div class="tp-stat"><span>${label}</span><b>${escapeHtml(String(value))}${note ? `<small>${note}</small>` : ''}</b></div>`).join('')}</div>
      ${links.length ? `<div class="link-row tp-section-anim" style="--tp-delay:240ms">${links.map(link => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a>`).join('')}</div>` : ''}
      <p class="tp-note tp-section-anim" style="--tp-delay:280ms">${market.kind === 'rwa' ? 'Live RWA token data from CoinGecko. A listing is not an endorsement or investment advice.' : 'Live market data from DexScreener and GeckoTerminal. Turbo Score measures trading activity — always verify contracts before trading. TurboPad is read-only and never custodies funds.'}</p>`;
  }

  document.addEventListener('turbopad:ready', () => {
    const tokenMatch = location.hash.match(/^#token\/(.+)$/);
    if (tokenMatch && !tokenPageId) detail(decodeURIComponent(tokenMatch[1]));
    const compareMatch = location.hash.match(/^#compare\/(.+)$/);
    if (compareMatch && comparePage.hidden) {
      const ids = decodeURIComponent(compareMatch[1]).split(',').filter(id => byId(id));
      if (ids.length === 2) {
        state.compare = ids;
        syncCompareButtons();
        openComparePage();
      }
    }
  });
  addEventListener('popstate', () => {
    if (!location.hash.startsWith('#token/')) closeTokenPage();
    if (!location.hash.startsWith('#compare/')) closeComparePage();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!comparePage.hidden) requestCloseComparePage();
    else if (!tokenPage.hidden) requestCloseTokenPage();
  });
  $('#tokenBack').onclick = requestCloseTokenPage;
  tokenPage.addEventListener('click', event => {
    const button = event.target.closest('[data-tp-period]');
    if (!button) return;
    tokenPeriod = button.dataset.tpPeriod;
    tokenPage.querySelectorAll('[data-tp-period]').forEach(item => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    const market = byId(tokenPageId);
    if (market) loadTokenChart(market);
  });

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

  /* ---------- Compare mode ---------- */

  const comparePage = $('#comparePage');
  const compareBody = $('#compareBody');
  const tray = $('#compareTray');

  function toggleCompare(id) {
    const market = byId(id);
    if (!market) return;
    const index = state.compare.indexOf(id);
    if (index >= 0) {
      state.compare.splice(index, 1);
    } else if (state.compare.length >= 2) {
      toast('Compare holds two markets — remove one first');
      return;
    } else {
      state.compare.push(id);
      toast(state.compare.length === 1 ? `$${market.symbol} selected — pick one more to compare` : `Comparing two markets`);
    }
    syncCompareButtons();
    renderTray();
    if (state.compare.length === 2) openComparePage();
  }

  function syncCompareButtons() {
    document.querySelectorAll('[data-compare]').forEach(button => {
      const active = state.compare.includes(button.dataset.compare);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderTray() {
    const overlayOpen = !tokenPage.hidden || !comparePage.hidden;
    if (!state.compare.length || overlayOpen) { tray.hidden = true; return; }
    tray.hidden = false;
    const picks = state.compare.map(id => {
      const market = byId(id);
      if (!market) return '';
      return `<span class="tray-pick">${avatar(market)}$${escapeHtml(market.symbol)}<button class="tray-clear" data-uncompare="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(market.name)} from compare">×</button></span>`;
    });
    tray.innerHTML =
      picks.join('<span class="tray-vs">VS</span>') +
      (state.compare.length < 2 ? '<span class="tray-slot">Pick one more</span>' : '') +
      `<button class="lime" id="compareNow" ${state.compare.length < 2 ? 'disabled' : ''} style="padding:9px 18px">Compare →</button>`;
  }

  function openComparePage() {
    if (state.compare.length !== 2) return;
    const [a, b] = state.compare.map(byId);
    if (!a || !b) return;
    renderComparePage(a, b);
    comparePage.hidden = false;
    comparePage.classList.remove('closing');
    document.body.classList.add('token-open');
    comparePage.scrollTop = 0;
    if (!location.hash.startsWith('#compare/')) {
      history.pushState(null, '', `#compare/${encodeURIComponent(state.compare.join(','))}`);
    }
    renderTray();
    loadCompareCharts(a, b);
  }

  function closeComparePage() {
    if (comparePage.hidden) return;
    comparePage.classList.add('closing');
    document.body.classList.remove('token-open');
    setTimeout(() => { comparePage.hidden = true; comparePage.classList.remove('closing'); renderTray(); }, 210);
  }

  function requestCloseComparePage() {
    if (location.hash.startsWith('#compare/')) history.back();
    else closeComparePage();
  }

  function fallbackSeries(market) {
    const points = [
      market.change, market.change6h ?? market.change,
      market.change1h ?? market.change, market.change5m ?? market.change1h ?? market.change,
    ].map(change => 100 / (1 + (Number(change) || 0) / 100));
    points.push(100);
    const start = Date.now() - 24 * 3600 * 1000;
    return points.map((value, index) => ({ t: start + (index * 24 * 3600 * 1000) / (points.length - 1), close: value }));
  }

  async function chartSeries(market) {
    if (market.kind === 'meme') {
      try { return await TurboData.ohlcv(market.chainId, market.id, '24H'); } catch { /* fall through */ }
    }
    return fallbackSeries(market);
  }

  async function loadCompareCharts(a, b) {
    const chartEl = document.getElementById('cmpChart');
    if (!chartEl) return;
    chartEl.innerHTML = '<div class="chart-loading">Loading live charts…</div>';
    const [seriesA, seriesB] = await Promise.all([chartSeries(a), chartSeries(b)]);
    if (comparePage.hidden) return;
    renderCompareChart(seriesA, seriesB, a, b);
  }

  function renderCompareChart(seriesA, seriesB, a, b) {
    const chartEl = document.getElementById('cmpChart');
    const axisEl = document.getElementById('cmpAxis');
    if (!chartEl) return;
    // Index both series to 100 at their first point for a fair overlay.
    const index100 = series => series.map(point => ({ t: point.t, v: (point.close / series[0].close) * 100 }));
    const A = index100(seriesA), B = index100(seriesB);
    const width = 720, height = 300;
    // Shared time axis: both series are positioned by real timestamps over the
    // union of their ranges, so a shorter/younger series aligns honestly.
    const t0 = Math.min(A[0].t, B[0].t);
    const t1 = Math.max(A[A.length - 1].t, B[B.length - 1].t);
    const spanT = t1 - t0 || 1;
    const x = t => (((t - t0) / spanT) * width).toFixed(1);
    const all = [...A.map(p => p.v), ...B.map(p => p.v)];
    const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
    const y = value => (height - 30 - ((value - min) / span) * (height - 70)).toFixed(1);
    const line = (series, color, widthPx) => {
      const path = series.map(point => `${x(point.t)},${y(point.v)}`).join(' ');
      const last = series[series.length - 1];
      return `<polyline points="${path}" fill="none" stroke="${color}" stroke-width="${widthPx}" vector-effect="non-scaling-stroke"/><circle cx="${x(last.t)}" cy="${y(last.v)}" r="4.5" fill="${color}"/>`;
    };
    chartEl.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Indexed comparison chart for ${escapeHtml(a.symbol)} and ${escapeHtml(b.symbol)}"><path d="M0 45H720M0 110H720M0 175H720M0 240H720" stroke="#ffffff0c" stroke-dasharray="2 6"/><path d="M0 ${y(100)}H720" stroke="#d9af7933" stroke-dasharray="6 6"/>${line(B, '#a79be6', 1.8)}${line(A, '#d9af79', 2.2)}</svg>`;
    if (axisEl) {
      // Relative labels (-24h … Now) match the token page axis and can never
      // duplicate, unlike HH:mm labels on a 24h window.
      const ticks = 6;
      const hours = spanT / 3600000;
      axisEl.innerHTML = Array.from({ length: ticks }, (_, tick) => {
        const back = spanT - (spanT * tick) / (ticks - 1);
        if (tick === ticks - 1 || back <= 0) return '<span>Now</span>';
        const label = hours >= 2 ? `−${Math.round(back / 3600000)}h` : `−${Math.round(back / 60000)}m`;
        return `<span>${label}</span>`;
      }).join('');
    }
    const legend = document.getElementById('cmpLegend');
    if (legend) {
      legend.innerHTML = `<span><i class="legend-dot legend-a"></i>$${escapeHtml(a.symbol)} · indexed to 100</span><span><i class="legend-dot legend-b"></i>$${escapeHtml(b.symbol)} · indexed to 100</span>`;
    }
  }

  function renderComparePage(a, b) {
    const total = market => market.txns.buys + market.txns.sells;
    const buyShare = market => {
      const sum = total(market);
      return sum ? Math.round((market.txns.buys / sum) * 100) : 0;
    };
    const col = (market, delay) => `
      <div class="compare-col tp-section-anim" style="--tp-delay:${delay}ms">
        <div class="token-heading">${avatar(market)}<div><h3 style="margin:0">${escapeHtml(market.name)}</h3><span>$${escapeHtml(market.symbol)} · ${escapeHtml(market.source)}</span></div>${market.score ? `<b class="large-score">${market.score}<small>/100</small></b>` : ''}</div>
        <div class="tp-price-row" style="margin-bottom:0"><span class="tp-price">$${escapeHtml(market.price)}</span><span class="tp-change ${market.change < 0 ? 'negative' : 'up'}">${market.change > 0 ? '↗ +' : '↘ '}${market.change.toFixed(2)}%</span></div>
      </div>`;
    const rows = [
      ['24H VOLUME', a.volumeRaw, b.volumeRaw, value => `$${TurboData.compact(value)}`],
      ['LIQUIDITY', a.liquidityRaw, b.liquidityRaw, value => value ? `$${TurboData.compact(value)}` : '—'],
      ['MARKET CAP', a.capRaw, b.capRaw, value => `$${TurboData.compact(value)}`],
      ['TRANSACTIONS · 24H', total(a), total(b), value => value.toLocaleString('en-US')],
      ['BUY PRESSURE', buyShare(a), buyShare(b), value => `${value}%`],
      ['TURBO SCORE', a.score || 0, b.score || 0, value => value || '—'],
    ];
    compareBody.innerHTML = `
      <div class="compare-cols">${col(a, 0)}${col(b, 70)}</div>
      <div class="tp-panel tp-section-anim" style="--tp-delay:130ms">
        <div class="compare-legend" id="cmpLegend"></div>
        <div class="tp-chart" id="cmpChart"><div class="chart-loading">Loading live charts…</div></div>
        <div class="tp-axis" id="cmpAxis"></div>
      </div>
      <div class="cmp-table tp-section-anim" style="--tp-delay:190ms">${rows.map(([label, valueA, valueB, format]) => {
        const winA = valueA > valueB, winB = valueB > valueA;
        return `<div class="cmp-row"><b class="cmp-a ${winA ? 'cmp-win' : ''}">${format(valueA)}</b><span>${label}</span><b class="cmp-b ${winB ? 'cmp-win' : ''}">${format(valueB)}</b></div>`;
      }).join('')}</div>
      <p class="tp-note tp-section-anim" style="--tp-delay:240ms">Both series are indexed to 100 at the start of the window so relative performance is comparable. ✦ marks the stronger value in each row. Live data from DexScreener, CoinGecko and GeckoTerminal.</p>`;
  }

  $('#compareBack').onclick = requestCloseComparePage;
  document.addEventListener('compare:close', requestCloseComparePage);

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
    // Keep the open token page in sync without closing it.
    if (!tokenPage.hidden && tokenPageId === id) {
      const market = byId(id);
      if (market) {
        renderTokenPage(market);
        if (market.kind === 'meme') loadTokenChart(market);
      }
    }
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

  function walletOnRobinhood() {
    return state.wallet?.provider === 'EVM' && state.wallet.chainId === TurboChain.ROBINHOOD.chainId;
  }

  function paintWallet() {
    const button = $('#wallet');
    if (!state.wallet) { button.innerHTML = '◈ &nbsp; Connect wallet'; paintTrade(); return; }
    const address = escapeHtml(shortAddress(state.wallet.address));
    const balance = typeof state.wallet.balance === 'number' ? ` · ${state.wallet.balance.toFixed(4)} ETH` : '';
    const warn = state.wallet.provider === 'EVM' && !walletOnRobinhood() ? '⚠ ' : '';
    button.innerHTML = `${warn}◈ &nbsp; ${address}${balance}`;
    paintTrade();
  }

  /* Refresh chain id + real balance for an EVM wallet; never throws. */
  async function refreshWalletState() {
    if (state.wallet?.provider !== 'EVM') return;
    try { state.wallet.chainId = await TurboChain.walletChainId(); } catch { /* keep previous */ }
    try { state.wallet.balance = await TurboChain.getBalance(state.wallet.address); } catch { /* balance stays hidden */ }
    persist(WALLET_KEY, state.wallet);
    paintWallet();
  }

  /* Lazy-load the Reown AppKit bundle only when the user clicks connect —
     keeps the initial page fast (the bundle is ~4 MB). */
  async function ensureTurboConnect() {
    if (window.TurboConnect?.ready) return;
    toast('Loading wallet module…');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'walletconnect.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('wallet-module-failed'));
      document.body.appendChild(script);
    });
  }

  /* Wire account/network change events once per provider (injected or AppKit). */
  function attachProviderListeners(provider) {
    if (!provider?.on || provider.__tpWired) return;
    provider.__tpWired = true;
    provider.on('chainChanged', () => { if (state.wallet?.provider === 'EVM') refreshWalletState(); });
    provider.on('accountsChanged', accounts => {
      if (state.wallet?.provider !== 'EVM') return;
      if (!accounts?.[0]) {
        state.wallet = null;
        localStorage.removeItem(WALLET_KEY);
        paintWallet();
        toast('Wallet disconnected');
        return;
      }
      state.wallet.address = accounts[0];
      refreshWalletState();
    });
  }

  async function connectWallet() {
    if (state.wallet) {
      const w = state.wallet;
      const onRobinhood = walletOnRobinhood();
      const addressLine = w.provider === 'EVM'
        ? `<a href="${TurboChain.explorerAddress(w.address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortAddress(w.address))} ↗</a>`
        : escapeHtml(shortAddress(w.address));
      const lines = [
        `<div class="score-line"><span>Address</span><b>${addressLine}</b></div>`,
        typeof w.balance === 'number' ? `<div class="score-line"><span>Balance</span><b>${w.balance.toFixed(4)} ETH</b></div>` : '',
        w.provider === 'EVM' ? `<div class="score-line"><span>Network</span><b>${onRobinhood ? 'Robinhood Chain ✓' : 'Not Robinhood Chain ⚠'}</b></div>` : '',
      ].join('');
      const switcher = w.provider === 'EVM' && !onRobinhood
        ? '<button class="lime full" id="switchToRobinhood">Switch to Robinhood Chain</button>'
        : '';
      open(`<h2>Connected wallet</h2><p class="dialog-copy">${escapeHtml(w.provider)} wallet connected read-only. TurboPad never requests signatures or funds.</p><div class="score-list">${lines}</div>${switcher}<button class="outline full" id="disconnectWallet">Disconnect</button>`);
      return;
    }
    try {
      // Preferred path: Reown AppKit modal (WalletConnect, QR, mobile wallets).
      try { await ensureTurboConnect(); } catch { /* module unavailable — fall back to injected */ }
      if (window.TurboConnect?.ready) {
        const result = await window.TurboConnect.connect();
        if (!result?.address) return; // modal closed without connecting
        state.wallet = { address: result.address, provider: 'EVM' };
        persist(WALLET_KEY, state.wallet);
        paintWallet();
        toast('Wallet connected (read-only)');
        try { await TurboChain.ensureRobinhood(); } catch { toast('Tip: switch your wallet to Robinhood Chain'); }
        attachProviderListeners(result.provider);
        refreshWalletState();
        return;
      }
      if (window.ethereum?.request) {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts?.[0]) {
          state.wallet = { address: accounts[0], provider: 'EVM' };
          persist(WALLET_KEY, state.wallet);
          paintWallet();
          toast('EVM wallet connected (read-only)');
          try { await TurboChain.ensureRobinhood(); } catch { toast('Tip: switch your wallet to Robinhood Chain'); }
          refreshWalletState();
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

  async function switchToRobinhood() {
    try {
      await TurboChain.ensureRobinhood();
      await refreshWalletState();
      dialog.close();
      toast('Wallet is now on Robinhood Chain mainnet');
    } catch (error) {
      toast(error?.code === 4001 ? 'Network switch declined' : 'Could not switch network');
    }
  }

  /* ---------- Live network chip (real mainnet block height) ---------- */

  async function updateNetChip() {
    const chip = $('#netChip');
    if (!chip) return;
    try {
      const block = await TurboChain.latestBlock();
      chip.hidden = false;
      chip.textContent = `◆ Robinhood Chain · #${block.toLocaleString('en-US')}`;
      chip.classList.remove('offline');
    } catch {
      chip.hidden = false;
      chip.textContent = '◇ Mainnet RPC offline';
      chip.classList.add('offline');
    }
  }

  /* ---------- Launch planner (local drafts, honest outbound) ---------- */

  function launch() {
    open('<h2>Plan your launch.</h2><p class="dialog-copy">Drafts are saved on this device. Ready to go live? Deploy a real ERC-20 straight from your wallet — testnet is free, mainnet is one switch away.</p><form id="launchForm"><label for="tokenName">Token name</label><input id="tokenName" required maxlength="40" placeholder="Turbo Cat"><label for="ticker">Ticker</label><input id="ticker" required maxlength="10" pattern="[A-Za-z0-9]+" placeholder="TCAT"><label for="tokenSupply">Total supply</label><input id="tokenSupply" type="number" min="1" step="1" placeholder="1000000000" value="1000000000"><label for="launchMode">Launch mode</label><select id="launchMode"><option>Fair launch · bonding curve</option><option>Standard · fixed supply</option></select><button class="lime full" type="submit">Save launch draft ↗</button><div class="deploy-row"><button class="outline full" type="button" id="deployTestnet">Deploy · testnet (free)</button><button class="outline full deploy-mainnet" type="button" id="deployMainnet">Deploy · mainnet</button></div><p class="dialog-copy fine-print">Deployment is signed by your wallet. TurboPad never holds keys or funds. Contracts are unaudited — test on testnet first.</p></form>');
  }

  function deployToken(testnet) {
    if (!state.wallet || state.wallet.provider !== 'EVM') {
      toast('Connect an EVM wallet first to deploy');
      return;
    }
    const name = $('#tokenName')?.value.trim();
    const ticker = $('#ticker')?.value.trim();
    const supply = $('#tokenSupply')?.value.trim();
    if (!name || !ticker || !supply) {
      toast('Fill in name, ticker and supply first');
      return;
    }
    if (!testnet) {
      const ok = window.confirm(`You are about to deploy $${ticker.toUpperCase()} on Robinhood Chain MAINNET.\n\nThis spends real ETH on gas and the contract is unaudited. Continue?`);
      if (!ok) return;
    }
    open(`<h2>Deploying $${escapeHtml(ticker.toUpperCase())}…</h2><p class="dialog-copy" id="deployStatus">Preparing…</p>`);
    const status = message => { const el = $('#deployStatus'); if (el) el.textContent = message; };
    TurboDeploy.deploy({ name, symbol: ticker, supply, testnet, onStatus: status })
      .then(result => {
        const deploys = loadJson(DEPLOYS_KEY, []);
        deploys.unshift({ name, ticker: ticker.toUpperCase(), supply, address: result.address, txHash: result.txHash, testnet, created: Date.now() });
        persist(DEPLOYS_KEY, deploys.slice(0, 20));
        const net = testnet ? 'testnet' : 'MAINNET';
        open(`<h2>$${escapeHtml(ticker.toUpperCase())} is live on ${net}.</h2><p class="dialog-copy">Your token contract is confirmed on-chain and the full supply is in your wallet.</p><div class="score-list"><div class="score-line"><span>Contract</span><b><a href="${TurboChain.explorerAddress(result.address, testnet)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortAddress(result.address))} ↗</a></b></div><div class="score-line"><span>Transaction</span><b><a href="${TurboChain.explorerTx(result.txHash, testnet)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortAddress(result.txHash))} ↗</a></b></div><div class="score-line"><span>Supply</span><b>${escapeHtml(new Intl.NumberFormat('en-US').format(Number(supply)))} $${escapeHtml(ticker.toUpperCase())}</b></div></div><button class="outline full" id="closeTrade">Done</button>`);
        toast(`$${ticker.toUpperCase()} deployed on ${net}`);
      })
      .catch(error => {
        const declined = error?.code === 4001;
        open(`<h2>Deployment ${declined ? 'declined' : 'failed'}.</h2><p class="dialog-copy">${escapeHtml(declined ? 'You declined the signature in your wallet — nothing was sent.' : error?.message || 'Unknown error')}</p><button class="outline full" id="closeTrade">Back</button>`);
        toast(declined ? 'Signature declined' : 'Deployment failed');
      });
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
    open(`<h2>Draft saved.</h2><p class="dialog-copy"><b>${escapeHtml(draft.name)} ($${escapeHtml(draft.ticker)})</b> is stored on this device. When you are ready, deploy it from the launch planner or publish through an established launchpad:</p><div class="score-list">${drafts.slice(0, 3).map((item, index) => `<div class="score-line"><span>${index === 0 ? 'Latest' : `Draft ${index + 1}`}</span><b>$${escapeHtml(item.ticker)}</b></div>`).join('')}</div><div class="link-row"><a href="https://pump.fun/create" target="_blank" rel="noopener noreferrer">pump.fun ↗</a><a href="https://dexscreener.com" target="_blank" rel="noopener noreferrer">DexScreener ↗</a></div><button class="outline full" id="closeTrade">Back to markets</button>`);
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
    if ('compare' in button.dataset) toggleCompare(button.dataset.compare);
    if ('uncompare' in button.dataset) toggleCompare(button.dataset.uncompare);
    if (button.id === 'compareNow') openComparePage();
    if ('launch' in button.dataset) launch();
    if (button.id === 'deployTestnet') deployToken(true);
    if (button.id === 'deployMainnet') deployToken(false);
    if (button.dataset.trade) openTrade(button.dataset.trade);
    if (button.id === 'tradeBuy' || button.id === 'tradeSell') {
      trade.direction = button.id === 'tradeBuy' ? 'buy' : 'sell';
      paintTrade();
      scheduleTradeQuote();
    }
    if (button.id === 'tradeExecute') tradeExecute();
    if (button.dataset.vote) castVote(button.dataset.vote);
    if (button.id === 'retryLoad') loadMarkets();
    if (button.id === 'disconnectWallet') {
      state.wallet = null;
      localStorage.removeItem(WALLET_KEY);
      window.TurboConnect?.disconnect?.();
      paintWallet();
      dialog.close();
      toast('Wallet disconnected');
    }
    if (button.id === 'switchToRobinhood') switchToRobinhood();
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
    if (event.target.id === 'tradeToken' || event.target.id === 'tradeAmount') scheduleTradeQuote();
  });
  document.addEventListener('change', event => { if (event.target.id === 'tradeSlippage') scheduleTradeQuote(); });
  document.addEventListener('submit', event => { if (event.target.id === 'launchForm') saveDraft(event); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.updatedAt && Date.now() - state.updatedAt > 60000) loadMarkets({ silent: true });
  });

  window.TurboPad = { markets: state.markets, state, getVisibleMarkets, chart: candleChart, sparkline, detail, render, setView, loadMarkets };

  /* Keep wallet state honest when the user changes account or network. */
  attachProviderListeners(window.ethereum);

  paintWallet();
  refreshWalletState();
  render();
  loadMarkets();
  updateNetChip();
  setInterval(() => { if (!document.hidden) updateNetChip(); }, 15000);
  setInterval(() => { if (!document.hidden && !state.loading) loadMarkets({ silent: true }); }, 60000);
})();
