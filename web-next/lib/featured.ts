/* Featured token — the ONE place to edit when TURBO launches.

   Paste the official TURBO contract address into TURBOPAD_FEATURED_ADDRESS
   (or the literal below) and TURBO becomes the spotlight market, is pinned
   first in Explore with an OFFICIAL badge, and gets the Trade button.

   Requirement on TURBO's side: a liquidity pair on a DEX that DexScreener
   indexes (e.g. Uniswap V3 on Robinhood Chain), otherwise there is no price. */

const LITERAL = ''; // e.g. '0xabc123…' (42 chars, starts with 0x)

export const FEATURED_BADGE = 'OFFICIAL';

export const featuredAddress = (): string | null => {
  const value = (process.env.NEXT_PUBLIC_TURBOPAD_FEATURED_ADDRESS || LITERAL).trim();
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? value : null;
};
