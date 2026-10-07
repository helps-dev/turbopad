# Graph Report - Turbopad  (2026-10-06)

## Corpus Check
- 23 files · ~215,109 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 182 nodes · 207 edges · 16 communities (13 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d3e4fc48`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TurboPad UI
- MAINNET_READINESS.md
- index.js
- TurboPad brand banner
- mainnet-readonly.cjs
- marketService.js
- Turbopad logo
- db.js
- deploy-token.mjs
- package.json
- TurboPad
- walletconnect.entry.js
- scripts
- dev-server.mjs
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `TurboPad UI` - 13 edges
2. `scripts` - 12 edges
3. `mapPair()` - 9 edges
4. `TurboPad` - 8 edges
5. `express` - 6 edges
6. `getRwaMarkets()` - 6 edges
7. `cached()` - 5 edges
8. `getJson()` - 5 edges
9. `getMemeMarkets()` - 5 edges
10. `searchMarkets()` - 4 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (16 total, 2 thin omitted)

### Community 0 - "TurboPad UI"
Cohesion: 0.14
Nodes (14): Blockchain contracts (not connected), Bonding curves (not connected), Creator Revenue presentation, Live market data (not connected), Meme Battles, Multi-launchpad labels, Responsive desktop and mobile interface, RWA backend (not connected) (+6 more)

### Community 2 - "index.js"
Cohesion: 0.07
Nodes (25): express, app, battlesRouter, cors, express, marketsRouter, path, STATIC_DIR (+17 more)

### Community 3 - "TurboPad brand banner"
Cohesion: 0.40
Nodes (5): TurboPad brand banner, Dark cosmic and metallic visual identity, Ideas move faster tagline, Launch / Trade / Create / Win positioning, TurboPad

### Community 4 - "mainnet-readonly.cjs"
Cohesion: 0.40
Nodes (3): {execFileSync}, fs, vm

### Community 5 - "marketService.js"
Cohesion: 0.19
Nodes (21): ageMinutes(), ageText(), bestPairs(), cache, cached(), CHAIN_LABEL, clamp01(), colorFor() (+13 more)

### Community 6 - "Turbopad logo"
Cohesion: 0.67
Nodes (3): Turbopad logo, Dark metallic visual identity with warm rim lighting, Winged T-shaped monogram

### Community 7 - "db.js"
Cohesion: 0.19
Nodes (8): castVote(), DB_DIR, DB_PATH, fs, getBattle(), getPairKey(), memoryStore, path

### Community 16 - "deploy-token.mjs"
Cohesion: 0.11
Nodes (13): ethers, artifact, CHAINS, factory, name, provider, supply, symbol (+5 more)

### Community 17 - "package.json"
Cohesion: 0.08
Nodes (23): dependencies, cors, express, description, devDependencies, esbuild, ethers, @reown/appkit (+15 more)

### Community 19 - "TurboPad"
Cohesion: 0.22
Nodes (8): Architecture, Data sources, Features, License, Project structure, Quick start, Roadmap, TurboPad

### Community 21 - "walletconnect.entry.js"
Cohesion: 0.22
Nodes (8): @reown/appkit, @reown/appkit-adapter-ethers, connect(), ensureModal(), getAddress(), NOTE: open() resolves when the modal OPENS, not when it closes —, robinhood, robinhoodTestnet

### Community 24 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build:wallet, check, check:server, compile:token, deploy:pages, dev, server (+4 more)

### Community 26 - "dev-server.mjs"
Cohesion: 0.29
Nodes (5): args, port, root, server, types

## Knowledge Gaps
- **112 isolated node(s):** `robinhood`, `robinhoodTestnet`, `name`, `version`, `private` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 131 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `index.js` to `package.json`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `ethers` connect `deploy-token.mjs` to `package.json`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `mapPair()` (e.g. with `getMemeMarkets()` and `searchMarkets()`) actually correct?**
  _`mapPair()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `robinhood`, `robinhoodTestnet`, `name` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TurboPad UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07056451612903226 - nodes in this community are weakly interconnected._