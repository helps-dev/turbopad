# Graph Report - Turbopad  (2026-10-03)

## Corpus Check
- 13 files · ~208,666 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 101 nodes · 96 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d3e4fc48`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TurboPad UI
- MAINNET_READINESS.md
- transaction-safety.cjs
- TurboPad brand banner
- Turbopad logo
- deploy-token.mjs
- package.json
- TurboPad
- walletconnect.entry.js
- scripts
- compile-token.mjs
- dev-server.mjs
- devDependencies
- AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `TurboPad UI` - 13 edges
2. `scripts` - 8 edges
3. `TurboPad` - 8 edges
4. `TurboPad brand banner` - 4 edges
5. `connect()` - 3 edges
6. `ethers` - 3 edges
7. `ensureModal()` - 2 edges
8. `getAddress()` - 2 edges
9. `engines` - 2 edges
10. `@reown/appkit` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (14 total, 2 thin omitted)

### Community 0 - "TurboPad UI"
Cohesion: 0.14
Nodes (14): Blockchain contracts (not connected), Bonding curves (not connected), Creator Revenue presentation, Live market data (not connected), Meme Battles, Multi-launchpad labels, Responsive desktop and mobile interface, RWA backend (not connected) (+6 more)

### Community 2 - "transaction-safety.cjs"
Cohesion: 0.29
Nodes (5): ethers, { AbiCoder, Interface }, assert, fs, vm

### Community 3 - "TurboPad brand banner"
Cohesion: 0.40
Nodes (5): TurboPad brand banner, Dark cosmic and metallic visual identity, Ideas move faster tagline, Launch / Trade / Create / Win positioning, TurboPad

### Community 6 - "Turbopad logo"
Cohesion: 0.67
Nodes (3): Turbopad logo, Dark metallic visual identity with warm rim lighting, Winged T-shaped monogram

### Community 16 - "deploy-token.mjs"
Cohesion: 0.17
Nodes (8): artifact, CHAINS, factory, name, provider, supply, symbol, wallet

### Community 17 - "package.json"
Cohesion: 0.22
Nodes (8): description, engines, node, name, private, version, esbuild, @reown/appkit

### Community 19 - "TurboPad"
Cohesion: 0.22
Nodes (8): Architecture, Data sources, Features, License, Project structure, Quick start, Roadmap, TurboPad

### Community 21 - "walletconnect.entry.js"
Cohesion: 0.24
Nodes (7): @reown/appkit-adapter-ethers, connect(), ensureModal(), getAddress(), NOTE: open() resolves when the modal OPENS, not when it closes —, robinhood, robinhoodTestnet

### Community 24 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build:wallet, check, compile:token, deploy:pages, dev, start, test:transactions

### Community 25 - "compile-token.mjs"
Cohesion: 0.29
Nodes (6): solc, artifact, errors, input, output, source

### Community 26 - "dev-server.mjs"
Cohesion: 0.29
Nodes (5): args, port, root, server, types

### Community 27 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, esbuild, ethers, @reown/appkit, @reown/appkit-adapter-ethers, solc

## Knowledge Gaps
- **69 isolated node(s):** `robinhood`, `robinhoodTestnet`, `name`, `version`, `private` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 81 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ethers` connect `transaction-safety.cjs` to `deploy-token.mjs`, `package.json`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `solc` connect `compile-token.mjs` to `package.json`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `robinhood`, `robinhoodTestnet`, `name` to the rest of the system?**
  _69 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TurboPad UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._