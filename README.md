# TurboPad

Interactive visual prototype for **TurboPad** — a meme and real-world asset (RWA)
launchpad terminal concept, built as a fast, dependency-free static site.

![TurboPad banner](asset/banner.png)

> **Status:** UI preview with demo data. Wallet connectivity, blockchain
> contracts, live market data, bonding curves, and the RWA backend are not
> connected. TurboPad is independent and not affiliated with Robinhood.

## Features

- **Live meme markets** — real-time prices, 24h volume, liquidity and market
  caps for top boosted tokens via the DexScreener API, refreshed every minute
- **Live RWA markets** — real Ondo, Mantra, Polymesh, Centrifuge, Maple,
  Pendle, Goldfinch and Realio quotes via the CoinGecko API
- **Real charts** — OHLCV price history (1H / 24H / 7D) via the GeckoTerminal
  API, in the spotlight, radar panel and market detail dialog
- **Turbo Score** — computed live from real 24h activity: volume (30%),
  transactions (20%), liquidity depth (20%), momentum (15%), buy pressure (15%)
- **Live search** — type to filter, press Enter to search all of DexScreener
- **Wallet connection** — read-only EVM / Solana address connection; the app
  never requests signatures or funds
- **Watchlist** — persistent across sessions via stable pair IDs
- **Meme Battles** — live top-2 matchup with device-persistent voting
- **Creator Studio** — fee revenue simulator with real arithmetic
- **Launch planner** — save token drafts locally, publish via real launchpads
- Loading skeletons, error states with retry, and auto-refresh that pauses
  when the tab is hidden

## Architecture

```
Web/dist/
├── data.js          # API layer: DexScreener, CoinGecko, GeckoTerminal + caching
├── app.js           # State, rendering, wallet, watchlist, battles, launch planner
├── terminal.js      # Live market table, spotlight chart, radar panel
├── launch-motion.js # Featured-market carousel (starts on live data)
├── motion.js        # Entrance animations (progressive enhancement)
├── premium.js       # Eased count-up reveals (window.TurboCountUp)
└── style.css        # Layout, motion, theme palettes, live-data UI
```

All data is read-only public market data. No backend is required; the site is
fully static and every API failure degrades to a visible error state with retry.

## Quick start

No build step or external dependencies are required.

```bash
npm run dev
```

Then open the printed local URL (default `http://localhost:4173`).

The dev server accepts host and port overrides:

```bash
npm run dev -- --port 8080 --host 0.0.0.0
```

Any static file server works too, as long as it serves `Web/dist/`:

```bash
cd Web/dist && python3 -m http.server 4173
```

## Project structure

```
Turbopad/
├── Web/
│   ├── dist/               # The static site (serve this directory)
│   │   ├── index.html      # Page shell: navigation, banner, spotlight, tables, dialog
│   │   ├── app.js          # Market data, state, filters, watchlist, dialogs
│   │   ├── terminal.js     # Market table, layout switching, spotlight chart
│   │   ├── motion.js       # Entrance animations, pointer effects (progressive enhancement)
│   │   ├── launch-motion.js# Featured-market carousel and banner canvas
│   │   └── style.css       # Layout, motion layer, and theme palettes
│   └── .openai/            # Static hosting configuration
├── asset/                  # Source branding assets (PNG)
├── graphify-out/           # Codebase analysis reports and knowledge graph
└── scripts/                # Local development tooling
```

`Web/dist/` is intentionally plain HTML/CSS/JS — no framework, no bundler, no
runtime dependencies. Scripts load in a defined order (`app.js` → `motion.js` →
`terminal.js` → `launch-motion.js`); `terminal.js` consumes the
`window.TurboPad` API and `turbopad:render` events published by `app.js`.

## Data sources

| Source | Used for |
| --- | --- |
| DexScreener API | Live meme markets, pairs, images, live search |
| CoinGecko API | Live RWA token quotes (curated basket) |
| GeckoTerminal API | OHLCV chart history per pair and period |

Turbo Score is calculated locally from the live fields above — no score is
hard-coded. Watchlist, battle votes, launch drafts and wallet state persist in
`localStorage` on the device only.

## Roadmap

1. **Data contract** — stable market IDs, numeric fields, source and timestamp
   metadata, plus loading / error / empty states.
2. **Live data** — one read-only integration, validated before expanding.
3. **Onchain flow** — wallet connection, testnet contracts, transaction
   simulation and failure handling.
4. **RWA model** — real issuer / collateral / redemption model; concept cards
   alone are not sufficient for listing.
5. **Engineering** — test suite for critical flows, reproducible build, and CI.

See `graphify-out/PROJECT_ANALYSIS.md` for the latest full audit.

## License

All rights reserved. Branding assets in `asset/` and `Web/dist/` are proprietary.
