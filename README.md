# TurboPad

Interactive visual prototype for **TurboPad** — a meme and real-world asset (RWA)
launchpad terminal concept, built as a fast, dependency-free static site.

![TurboPad banner](asset/banner.png)

> **Status:** UI preview with demo data. Wallet connectivity, blockchain
> contracts, live market data, bonding curves, and the RWA backend are not
> connected. TurboPad is independent and not affiliated with Robinhood.

## Features

- **Explore** — market discovery with search, launchpad/category filters, and
  list or card layouts ranked by Turbo Score
- **Market spotlight** — featured market analysis with multi-period price chart
  (1H / 24H / 7D) and momentum profile
- **Turbo Radar** — momentum signal view sorted by Turbo Score
- **Meme Battles** — community vs. community demo voting
- **RWA Markets** — concept cards for real-world assets, clearly separated from
  meme momentum scoring
- **Creator Studio** — illustrative creator revenue simulator
- **Watchlist** — persistent across sessions via `localStorage`
- Responsive desktop and mobile interface with reduced-motion support,
  native `<dialog>`, and accessibility labeling throughout

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

## Data model

All markets are illustrative constants in `Web/dist/app.js`. Each market has a
name, symbol, creator, brand color, source launchpad (`TurboPad` / `Pons` /
`PEEPS` / `RWA`), price, 24h change, volume, market cap, Turbo Score (memes
only), bonding-curve progress, age, and kind (`meme` / `rwa`).

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
