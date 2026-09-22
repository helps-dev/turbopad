/* TurboPad featured token — the ONE file to edit when TURBO launches.

   Once the official TURBO token is live on Robinhood Chain (launched via
   ponsfamily.com), paste its contract address into `address` below and
   reload the site. Everything else is automatic:
   - TURBO becomes the spotlight market (hero chart + Turbo Score)
   - TURBO is pinned as the first market in Explore, with an OFFICIAL badge
   - its detail page gets the "Trade on TurboPad" button (Uniswap V3 swap)

   Requirements on TURBO's side: a liquidity pair on a DEX that DexScreener
   indexes (e.g. Uniswap V3 on Robinhood Chain) so live price data exists. */
window.TurboFeatured = {
  address: '', // ← TURBO contract address, e.g. '0xabc123…' (42 chars, starts with 0x)
  badge: 'OFFICIAL',
};
