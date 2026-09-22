/* TurboPad live data layer.
   Sources: DexScreener (meme markets), CoinGecko (RWA tokens), GeckoTerminal (OHLCV charts).
   All read-only public endpoints; every consumer must handle rejection. */
window.TurboData = (() => {
  const DEX = 'https://api.dexscreener.com';
  const GECKO = 'https://api.geckoterminal.com/api/v2';
  const COINGECKO = 'https://api.coingecko.com/api/v3';

  const CHAIN_LABEL = {
    solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bsc: 'BNB Chain',
    arbitrum: 'Arbitrum', polygon: 'Polygon', avalanche: 'Avalanche',
    optimism: 'Optimism', ton: 'TON', sui: 'Sui', pulsechain: 'PulseChain',
    robinhood: 'Robinhood', abstract: 'Abstract', unichain: 'Unichain',
  };
  const GECKO_NETWORK = {
    solana: 'solana', ethereum: 'eth', base: 'base', bsc: 'bsc',
    arbitrum: 'arbitrum', polygon: 'polygon_pos', avalanche: 'avax',
    optimism: 'optimism', ton: 'ton', robinhood: 'robinhood',
  };
  const RWA_IDS = [
    'ondo-finance', 'mantra', 'polymesh', 'centrifuge-2',
    'maple', 'pendle', 'goldfinch', 'realio-network',
  ];

  const cache = new Map();
  function cached(key, ttlMs, loader) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.time < ttlMs) return Promise.resolve(hit.value);
    return loader().then(value => {
      cache.set(key, { time: Date.now(), value });
      return value;
    });
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }

  const clamp01 = value => Math.min(1, Math.max(0, value));

  function compact(value) {
    const number = Number(value) || 0;
    if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
    if (number >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
    if (number >= 1e3) return `${(number / 1e3).toFixed(1)}K`;
    return number.toFixed(number >= 1 ? 2 : 4);
  }

  function priceText(raw) {
    const number = Number(raw);
    if (!Number.isFinite(number)) return '—';
    if (number >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (number >= 1) return number.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (number === 0) return '0';
    // Keep up to 4 significant digits for small meme prices.
    const digits = Math.max(2, Math.ceil(-Math.log10(number)) + 3);
    return number.toFixed(Math.min(digits, 12)).replace(/0+$/, '').replace(/\.$/, '');
  }

  function ageMinutes(pairCreatedAt) {
    if (!pairCreatedAt) return null;
    return Math.max(1, Math.round((Date.now() - pairCreatedAt) / 60000));
  }

  function ageText(minutes) {
    if (minutes == null) return 'Established';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
    return `${Math.round(minutes / 1440)}d ago`;
  }

  function colorFor(text) {
    let hash = 0;
    for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 38% 64%)`;
  }

  // Turbo Score: computed from real 24h activity — volume, transactions,
  // liquidity depth, momentum and buy pressure. 0–100, activity only.
  function scoreComponents(pair) {
    const volume = Number(pair.volume?.h24) || 0;
    const liquidity = Number(pair.liquidity?.usd) || 0;
    const txns = pair.txns?.h24 || { buys: 0, sells: 0 };
    const totalTxns = (txns.buys || 0) + (txns.sells || 0);
    const change = Number(pair.priceChange?.h24) || 0;
    const volumeQ = clamp01(Math.log10(volume + 1) / 7.3);
    const buyerQ = clamp01(Math.log10(totalTxns + 1) / 5.2);
    const liquidityQ = clamp01(Math.log10(liquidity + 1) / 6.4);
    const momentumQ = clamp01((change + 60) / 160);
    const buyPressure = clamp01((txns.buys || 0) / (totalTxns || 1));
    const score = Math.round(
      100 * (0.3 * volumeQ + 0.2 * buyerQ + 0.2 * liquidityQ + 0.15 * momentumQ + 0.15 * buyPressure)
    );
    return {
      score: Math.max(1, Math.min(99, score)),
      volumeQ: Math.round(volumeQ * 100),
      buyerQ: Math.round(buyerQ * 100),
      liquidityQ: Math.round(liquidityQ * 100),
    };
  }

  function mapPair(pair) {
    const components = scoreComponents(pair);
    const age = ageMinutes(pair.pairCreatedAt);
    const liquidity = Number(pair.liquidity?.usd) || 0;
    return {
      id: pair.pairAddress,
      address: pair.baseToken?.address || null,
      name: pair.baseToken?.name || 'Unknown',
      symbol: pair.baseToken?.symbol || '—',
      creator: pair.dexId || 'DEX',
      color: colorFor(pair.baseToken?.symbol),
      source: CHAIN_LABEL[pair.chainId] || pair.chainId || 'Unknown',
      chainId: pair.chainId,
      price: priceText(pair.priceUsd),
      priceRaw: Number(pair.priceUsd) || 0,
      change: Number(pair.priceChange?.h24) || 0,
      change1h: Number(pair.priceChange?.h1) || 0,
      change5m: Number(pair.priceChange?.m5) || 0,
      change6h: Number(pair.priceChange?.h6) || 0,
      volume: compact(pair.volume?.h24),
      volumeRaw: Number(pair.volume?.h24) || 0,
      cap: compact(pair.marketCap || pair.fdv),
      capRaw: Number(pair.marketCap || pair.fdv) || 0,
      liquidity: compact(liquidity),
      liquidityRaw: liquidity,
      txns: pair.txns?.h24 || { buys: 0, sells: 0 },
      score: components.score,
      components,
      progress: Math.max(1, Math.min(100, Math.round((liquidity / 250000) * 100))),
      age,
      ageLabel: ageText(age),
      kind: 'meme',
      icon: pair.info?.imageUrl || null,
      url: pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`,
      socials: pair.info?.socials || [],
      websites: pair.info?.websites || [],
    };
  }

  function bestPairs(pairs) {
    const byToken = new Map();
    for (const pair of pairs || []) {
      if (!pair?.pairAddress || !pair.priceUsd) continue;
      const key = pair.baseToken?.address || pair.pairAddress;
      const existing = byToken.get(key);
      if (!existing || (Number(pair.liquidity?.usd) || 0) > (Number(existing.liquidity?.usd) || 0)) {
        byToken.set(key, pair);
      }
    }
    return [...byToken.values()];
  }

  async function memeMarkets() {
    return cached('meme', 45000, async () => {
      const boosts = await getJson(`${DEX}/token-boosts/top/v1`);
      const addresses = [...new Set(boosts.map(entry => entry.tokenAddress))].slice(0, 20);
      if (!addresses.length) throw new Error('No boosted tokens returned');
      const data = await getJson(`${DEX}/latest/dex/tokens/${addresses.join(',')}`);
      return bestPairs(data.pairs).map(mapPair).sort((a, b) => b.score - a.score).slice(0, 14);
    });
  }

  async function searchMarkets(query) {
    const data = await getJson(`${DEX}/latest/dex/search?q=${encodeURIComponent(query)}`);
    return bestPairs(data.pairs).map(mapPair).sort((a, b) => b.score - a.score).slice(0, 12);
  }

  async function rwaMarkets() {
    return cached('rwa', 300000, async () => {
      const coins = await getJson(
        `${COINGECKO}/coins/markets?vs_currency=usd&ids=${RWA_IDS.join(',')}&price_change_percentage=24h`
      );
      if (!Array.isArray(coins) || !coins.length) throw new Error('No RWA markets returned');
      return coins.map(coin => ({
        id: coin.id,
        name: coin.name,
        symbol: (coin.symbol || '').toUpperCase(),
        creator: 'CoinGecko listing',
        color: colorFor(coin.symbol),
        source: 'RWA',
        chainId: null,
        price: priceText(coin.current_price),
        priceRaw: Number(coin.current_price) || 0,
        change: Number(coin.price_change_percentage_24h) || 0,
        change1h: 0,
        change6h: 0,
        volume: compact(coin.total_volume),
        volumeRaw: Number(coin.total_volume) || 0,
        cap: compact(coin.market_cap),
        capRaw: Number(coin.market_cap) || 0,
        liquidity: '—',
        liquidityRaw: 0,
        txns: { buys: 0, sells: 0 },
        score: null,
        components: null,
        progress: 100,
        age: null,
        ageLabel: 'Listed asset',
        kind: 'rwa',
        icon: coin.image || null,
        url: `https://www.coingecko.com/en/coins/${coin.id}`,
        socials: [],
        websites: [],
      }));
    });
  }

  const OHLCV_PERIOD = {
    '1H': { path: 'minute', aggregate: 1, limit: 60 },
    // 5-minute candles: smooth lines for established pairs and usable
    // resolution for very young pairs (a 3h-old pair still gets ~36 points).
    '24H': { path: 'minute', aggregate: 5, limit: 288 },
    '7D': { path: 'hour', aggregate: 4, limit: 42 },
  };

  async function ohlcv(chainId, pairAddress, period = '24H') {
    const network = GECKO_NETWORK[chainId];
    const config = OHLCV_PERIOD[period] || OHLCV_PERIOD['24H'];
    if (!network) throw new Error(`No chart network for ${chainId}`);
    return cached(`ohlcv:${pairAddress}:${period}`, 300000, async () => {
      const data = await getJson(
        `${GECKO}/networks/${network}/pools/${pairAddress}/ohlcv/${config.path}` +
        `?aggregate=${config.aggregate}&limit=${config.limit}&currency=usd`
      );
      const list = data?.data?.attributes?.ohlcv_list;
      if (!Array.isArray(list) || !list.length) throw new Error('Empty chart data');
      // GeckoTerminal returns newest first: [timestamp, open, high, low, close, volume].
      return list
        .map(([t, open, high, low, close, volume]) => ({ t: t * 1000, open, high, low, close, volume }))
        .sort((a, b) => a.t - b.t);
    });
  }

  return { memeMarkets, searchMarkets, rwaMarkets, ohlcv, compact, priceText };
})();
