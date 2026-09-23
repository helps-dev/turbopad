/* TurboPad market data layer.
   Sources: DexScreener (meme markets), CoinGecko (RWA basket),
   GeckoTerminal (OHLCV charts). All read-only public endpoints.

   Ported from Web/dist/data.js. Runs on both server and client: no DOM, no
   window. On the server this can be wrapped in route handlers so the browser
   never talks to upstream APIs directly. */
import { compact, priceText, ageMinutes, ageText, colorFor } from './format.ts';
import { scoreComponents } from './score.ts';
import type {
  Candle, ChartPeriod, CoinGeckoCoin, DexPair, Market,
} from './types.ts';

const DEX = 'https://api.dexscreener.com';
const GECKO = 'https://api.geckoterminal.com/api/v2';
const COINGECKO = 'https://api.coingecko.com/api/v3';

const CHAIN_LABEL: Readonly<Record<string, string>> = {
  solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bsc: 'BNB Chain',
  arbitrum: 'Arbitrum', polygon: 'Polygon', avalanche: 'Avalanche',
  optimism: 'Optimism', ton: 'TON', sui: 'Sui', pulsechain: 'PulseChain',
  robinhood: 'Robinhood', abstract: 'Abstract', unichain: 'Unichain',
};

const GECKO_NETWORK: Readonly<Record<string, string>> = {
  solana: 'solana', ethereum: 'eth', base: 'base', bsc: 'bsc',
  arbitrum: 'arbitrum', polygon: 'polygon_pos', avalanche: 'avax',
  optimism: 'optimism', ton: 'ton', robinhood: 'robinhood',
};

/* CoinGecko ids. Keep in sync with the live API: a renamed or delisted id is
   silently dropped from the response, shrinking the basket without an error.
   ('maple' was retired when Maple Finance migrated to SYRUP.) */
export const RWA_IDS: readonly string[] = [
  'ondo-finance', 'mantra', 'polymesh', 'centrifuge-2',
  'syrup', 'pendle', 'goldfinch', 'realio-network',
];

/* ---------- caching ---------- */

interface CacheEntry { time: number; value: unknown }
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ttlMs) return hit.value as T;
  const value = await loader();
  cache.set(key, { time: Date.now(), value });
  return value;
}

/** Exposed for tests; never call from UI code. */
export function __clearCache(): void {
  cache.clear();
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

/* ---------- mapping ---------- */

export function mapPair(pair: DexPair): Market {
  const components = scoreComponents(pair);
  const age = ageMinutes(pair.pairCreatedAt);
  const liquidity = Number(pair.liquidity?.usd) || 0;
  return {
    id: pair.pairAddress ?? '',
    address: pair.baseToken?.address ?? null,
    name: pair.baseToken?.name || 'Unknown',
    symbol: pair.baseToken?.symbol || '—',
    creator: pair.dexId || 'DEX',
    color: colorFor(pair.baseToken?.symbol),
    source: (pair.chainId && CHAIN_LABEL[pair.chainId]) || pair.chainId || 'Unknown',
    chainId: pair.chainId ?? null,
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
    txns: pair.txns?.h24 ?? { buys: 0, sells: 0 },
    score: components.score,
    components,
    progress: Math.max(1, Math.min(100, Math.round((liquidity / 250000) * 100))),
    age,
    ageLabel: ageText(age),
    kind: 'meme',
    icon: pair.info?.imageUrl ?? null,
    url: pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`,
    socials: pair.info?.socials ?? [],
    websites: pair.info?.websites ?? [],
  };
}

/** One pair per token: keep the deepest liquidity, drop unpriced pairs. */
export function bestPairs(pairs: DexPair[] | undefined | null): DexPair[] {
  const byToken = new Map<string, DexPair>();
  for (const pair of pairs ?? []) {
    if (!pair?.pairAddress || !pair.priceUsd) continue;
    const key = pair.baseToken?.address || pair.pairAddress;
    const existing = byToken.get(key);
    if (!existing || (Number(pair.liquidity?.usd) || 0) > (Number(existing.liquidity?.usd) || 0)) {
      byToken.set(key, pair);
    }
  }
  return [...byToken.values()];
}

/* ---------- public API ---------- */

interface BoostEntry { tokenAddress: string; chainId?: string }

export async function memeMarkets(): Promise<Market[]> {
  return cached('meme', 45_000, async () => {
    const boosts = await getJson<BoostEntry[]>(`${DEX}/token-boosts/top/v1`);
    const addresses = [...new Set(boosts.map(entry => entry.tokenAddress))].slice(0, 20);
    if (!addresses.length) throw new Error('No boosted tokens returned');
    const data = await getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/tokens/${addresses.join(',')}`);
    return bestPairs(data.pairs).map(mapPair).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 14);
  });
}

export async function searchMarkets(query: string): Promise<Market[]> {
  const data = await getJson<{ pairs?: DexPair[] }>(
    `${DEX}/latest/dex/search?q=${encodeURIComponent(query)}`,
  );
  return bestPairs(data.pairs).map(mapPair).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 12);
}

export async function rwaMarkets(): Promise<Market[]> {
  return cached('rwa', 300_000, async () => {
    const coins = await getJson<CoinGeckoCoin[]>(
      `${COINGECKO}/coins/markets?vs_currency=usd&ids=${RWA_IDS.join(',')}&price_change_percentage=24h`,
    );
    if (!Array.isArray(coins) || !coins.length) throw new Error('No RWA markets returned');
    if (coins.length < RWA_IDS.length) {
      const missing = RWA_IDS.filter(id => !coins.some(coin => coin.id === id));
      console.warn(`market-data: CoinGecko returned no data for ${missing.join(', ')} — id renamed or delisted?`);
    }
    return coins.map<Market>(coin => ({
      id: coin.id,
      address: null,
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
      change5m: 0,
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
      icon: coin.image ?? null,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
      socials: [],
      websites: [],
    }));
  });
}

const OHLCV_PERIOD: Readonly<Record<ChartPeriod, { path: string; aggregate: number; limit: number }>> = {
  '1H': { path: 'minute', aggregate: 1, limit: 60 },
  // 5-minute candles: smooth for established pairs, still usable for a
  // 3h-old pair (~36 points).
  '24H': { path: 'minute', aggregate: 5, limit: 288 },
  '7D': { path: 'hour', aggregate: 4, limit: 42 },
};

type OhlcvRow = [number, number, number, number, number, number];

export async function ohlcv(
  chainId: string,
  pairAddress: string,
  period: ChartPeriod = '24H',
): Promise<Candle[]> {
  const network = GECKO_NETWORK[chainId];
  const config = OHLCV_PERIOD[period] ?? OHLCV_PERIOD['24H'];
  if (!network) throw new Error(`No chart network for ${chainId}`);
  return cached(`ohlcv:${pairAddress}:${period}`, 300_000, async () => {
    const data = await getJson<{ data?: { attributes?: { ohlcv_list?: OhlcvRow[] } } }>(
      `${GECKO}/networks/${network}/pools/${pairAddress}/ohlcv/${config.path}`
      + `?aggregate=${config.aggregate}&limit=${config.limit}&currency=usd`,
    );
    const list = data?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(list) || !list.length) throw new Error('Empty chart data');
    // GeckoTerminal returns newest first: [timestamp, open, high, low, close, volume].
    return list
      .map(([t, open, high, low, close, volume]) => ({ t: t * 1000, open, high, low, close, volume }))
      .sort((a, b) => a.t - b.t);
  });
}

/** Featured token (e.g. official TURBO), pinned ahead of every other market. */
export async function featuredMarket(address: string | undefined): Promise<Market | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) return null;
  const data = await getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/tokens/${address}`);
  const best = bestPairs(data.pairs)[0];
  if (!best) return null;
  return { ...mapPair(best), featured: true };
}

export { CHAIN_LABEL, GECKO_NETWORK };
