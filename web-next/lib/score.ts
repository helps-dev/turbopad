/* Turbo Score — computed from real 24h activity, never hard-coded.
   Weights: volume 30%, transactions 20%, liquidity 20%, momentum 15%,
   buy pressure 15%. Behaviour matches Web/dist/data.js exactly.

   Activity is not safety: a high score means a market is busy, not sound. */
import { clamp01 } from './format.ts';
import type { DexPair, ScoreComponents } from './types.ts';

export function scoreComponents(pair: DexPair): ScoreComponents {
  const volume = Number(pair.volume?.h24) || 0;
  const liquidity = Number(pair.liquidity?.usd) || 0;
  const txns = pair.txns?.h24 ?? { buys: 0, sells: 0 };
  const totalTxns = (txns.buys || 0) + (txns.sells || 0);
  const change = Number(pair.priceChange?.h24) || 0;

  const volumeQ = clamp01(Math.log10(volume + 1) / 7.3);
  const buyerQ = clamp01(Math.log10(totalTxns + 1) / 5.2);
  const liquidityQ = clamp01(Math.log10(liquidity + 1) / 6.4);
  const momentumQ = clamp01((change + 60) / 160);
  const buyPressure = clamp01((txns.buys || 0) / (totalTxns || 1));

  const score = Math.round(
    100 * (0.3 * volumeQ + 0.2 * buyerQ + 0.2 * liquidityQ + 0.15 * momentumQ + 0.15 * buyPressure),
  );

  return {
    score: Math.max(1, Math.min(99, score)),
    volumeQ: Math.round(volumeQ * 100),
    buyerQ: Math.round(buyerQ * 100),
    liquidityQ: Math.round(liquidityQ * 100),
  };
}

/** Weights surfaced to the UI so the explainer dialog cannot drift from the maths. */
export const SCORE_WEIGHTS: ReadonlyArray<readonly [string, string]> = [
  ['24h volume', '30%'],
  ['Transactions', '20%'],
  ['Liquidity depth', '20%'],
  ['Price momentum', '15%'],
  ['Buy pressure', '15%'],
];
