/* Shared market shapes for TurboPad.
   Ported from the static build's implicit object shapes in Web/dist/data.js,
   now made explicit so the compiler catches drift between layers. */

export type MarketKind = 'meme' | 'rwa';

export interface TxnCounts {
  buys: number;
  sells: number;
}

/** Sub-scores behind a Turbo Score, each already scaled to 0–100. */
export interface ScoreComponents {
  score: number;
  volumeQ: number;
  buyerQ: number;
  liquidityQ: number;
}

export interface Market {
  id: string;
  address: string | null;
  name: string;
  symbol: string;
  creator: string;
  color: string;
  /** Human chain label, or 'RWA' for the CoinGecko basket. */
  source: string;
  chainId: string | null;
  /** Display-formatted price. `priceRaw` is the number to compute with. */
  price: string;
  priceRaw: number;
  change: number;
  change1h: number;
  change5m: number;
  change6h: number;
  volume: string;
  volumeRaw: number;
  cap: string;
  capRaw: number;
  liquidity: string;
  liquidityRaw: number;
  txns: TxnCounts;
  /** null for RWA listings, which have no on-chain activity to score. */
  score: number | null;
  components: ScoreComponents | null;
  progress: number;
  /** Age in minutes, or null for established listings. */
  age: number | null;
  ageLabel: string;
  kind: MarketKind;
  icon: string | null;
  url: string;
  socials: unknown[];
  websites: unknown[];
  featured?: boolean;
}

export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartPeriod = '1H' | '24H' | '7D';

/* ---------- Raw upstream shapes (only the fields we read) ---------- */

export interface DexPair {
  pairAddress?: string;
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  pairCreatedAt?: number;
  marketCap?: number;
  fdv?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: TxnCounts };
  info?: { imageUrl?: string; socials?: unknown[]; websites?: unknown[] };
}

export interface CoinGeckoCoin {
  id: string;
  name: string;
  symbol: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
}
