# Graph Report - Turbopad  (2026-10-07)

## Corpus Check
- 25 files · ~216,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 201 nodes · 224 edges · 19 communities (15 shown, 3 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.85)
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
- Panduan Deployment TurboPad ke VPS
- compile-token.mjs
- devDependencies
- deploy.sh
- deploy-token.mjs
- package.json
- TurboPad
- scripts
- dev-server.mjs
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `TurboPad UI` - 13 edges
2. `scripts` - 12 edges
3. `mapPair()` - 9 edges
4. `Panduan Deployment TurboPad ke VPS` - 8 edges
5. `TurboPad` - 8 edges
6. `express` - 6 edges
7. `getRwaMarkets()` - 6 edges
8. `cached()` - 5 edges
9. `getJson()` - 5 edges
10. `getMemeMarkets()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (19 total, 3 thin omitted)

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

### Community 9 - "Panduan Deployment TurboPad ke VPS"
Cohesion: 0.12
Nodes (16): 1. Spesifikasi Minimum VPS, 2. Persiapan Awal di VPS, 3. Metode A: Deployment Menggunakan Docker & Docker Compose (Sangat Disarankan), 4. Konfigurasi Domain & SSL (HTTPS) Gratis via Certbot, 5. Metode B: Deployment Tanpa Docker (PM2 + Host Nginx), 6. Pembaruan Aplikasi di Masa Depan (Update / Redeploy), 7. Verifikasi API Kesehatan Server, Langkah 3.1: Install Docker di VPS (+8 more)

### Community 10 - "compile-token.mjs"
Cohesion: 0.29
Nodes (6): solc, artifact, errors, input, output, source

### Community 11 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, esbuild, ethers, @reown/appkit, @reown/appkit-adapter-ethers, solc

### Community 16 - "deploy-token.mjs"
Cohesion: 0.11
Nodes (13): ethers, artifact, CHAINS, factory, name, provider, supply, symbol (+5 more)

### Community 17 - "package.json"
Cohesion: 0.10
Nodes (19): dependencies, cors, express, description, engines, node, name, private (+11 more)

### Community 19 - "TurboPad"
Cohesion: 0.22
Nodes (8): Architecture, Data sources, Features, License, Project structure, Quick start, Roadmap, TurboPad

### Community 24 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build:wallet, check, check:server, compile:token, deploy:pages, dev, server (+4 more)

### Community 26 - "dev-server.mjs"
Cohesion: 0.29
Nodes (5): args, port, root, server, types

## Knowledge Gaps
- **125 isolated node(s):** `robinhood`, `robinhoodTestnet`, `name`, `version`, `private` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 146 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `index.js` to `package.json`?**
  _High betweenness centrality (0.216) - this node is a cross-community bridge._
- **Why does `ethers` connect `deploy-token.mjs` to `package.json`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `mapPair()` (e.g. with `getMemeMarkets()` and `searchMarkets()`) actually correct?**
  _`mapPair()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `robinhood`, `robinhoodTestnet`, `name` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TurboPad UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07056451612903226 - nodes in this community are weakly interconnected._