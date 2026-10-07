# Graph Report - Turbopad  (2026-10-01)

## Corpus Check
- 83 files · ~583,067 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 571 nodes · 969 edges · 33 communities (27 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d3e4fc48`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TurboPad UI
- market-data.ts
- createStudioBoon
- TurboPad brand banner
- ThreeWorld
- web-next/package.json
- Turbopad logo
- holders.ts
- unit.test.ts
- three
- ThreeWorld.tsx
- Boons World frontend
- compilerOptions
- BoonsWorld.tsx
- studio-boon.ts
- createStudioBoon
- deploy-token.mjs
- package.json
- emote-performance.ts
- TurboPad
- SecondaryMotion
- walletconnect.entry.js
- TurboPad on Next.js
- scripts
- compile-token.mjs
- dev-server.mjs
- devDependencies
- PonsFamily Universe — frontend phase
- AGENTS.md
- web-next/AGENTS.md

## God Nodes (most connected - your core abstractions)
1. `ThreeWorld()` - 24 edges
2. `Boons World frontend` - 22 edges
3. `three` - 19 edges
4. `compilerOptions` - 18 edges
5. `createStudioBoon()` - 16 edges
6. `BoonsWorld()` - 15 edges
7. `CharacterAudio` - 14 edges
8. `TurboPad UI` - 13 edges
9. `mapPair()` - 11 edges
10. `createStudioBoon()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `resetCourse()` --calls--> `islandSupported()`  [EXTRACTED]
  web-next/app/boons/BoonsWorld.tsx → web-next/app/boons/island-layout.ts
- `tick()` --indirect_call--> `place()`  [INFERRED]
  web-next/app/boons/BoonsWorld.tsx → web-next/app/boons/kaykit-world.ts
- `walk()` --indirect_call--> `place()`  [INFERRED]
  web-next/app/boons/BoonsWorld.tsx → web-next/app/boons/kaykit-world.ts
- `nextStep()` --indirect_call--> `wallets()`  [INFERRED]
  web-next/app/boons/BoonsWorld.tsx → web-next/test/concentration.test.ts
- `simulate()` --indirect_call--> `wallets()`  [INFERRED]
  web-next/app/boons/BoonsWorld.tsx → web-next/test/concentration.test.ts

## Import Cycles
- None detected.

## Communities (33 total, 3 thin omitted)

### Community 0 - "TurboPad UI"
Cohesion: 0.14
Nodes (14): Blockchain contracts (not connected), Bonding curves (not connected), Creator Revenue presentation, Live market data (not connected), Meme Battles, Multi-launchpad labels, Responsive desktop and mobile interface, RWA backend (not connected) (+6 more)

### Community 1 - "market-data.ts"
Cohesion: 0.08
Nodes (41): Home(), loadMarkets(), revalidate, ROBINHOOD, TESTNET, FEATURED_BADGE, featuredAddress(), ageMinutes() (+33 more)

### Community 2 - "createStudioBoon"
Cohesion: 0.14
Nodes (12): createStudioBoon(), limb(), mesh(), sphere(), tube(), actors, emotes, geometry (+4 more)

### Community 3 - "TurboPad brand banner"
Cohesion: 0.40
Nodes (5): TurboPad brand banner, Dark cosmic and metallic visual identity, Ideas move faster tagline, Launch / Trade / Create / Win positioning, TurboPad

### Community 4 - "ThreeWorld"
Cohesion: 0.06
Nodes (17): CharacterAudio, loadGodotCharacter(), JumpMotion, ThreeWorld(), ball(), box(), cancel(), label() (+9 more)

### Community 5 - "web-next/package.json"
Cohesion: 0.05
Nodes (38): next, react-dom, @types/node, @types/react, @types/react-dom, @types/three, typescript, metadata (+30 more)

### Community 6 - "Turbopad logo"
Cohesion: 0.67
Nodes (3): Turbopad logo, Dark metallic visual identity with warm rim lighting, Winged T-shaped monogram

### Community 7 - "holders.ts"
Cohesion: 0.09
Nodes (38): dynamic, GET(), runtime, rpcCall(), RpcError, rpcOn(), testnetRpc(), assessRisk() (+30 more)

### Community 8 - "unit.test.ts"
Cohesion: 0.07
Nodes (53): addrWord(), decodeString(), encodeConstructor(), encodeMulticall(), formatUnits(), parseUnits(), u256(), explorerAddress() (+45 more)

### Community 9 - "three"
Cohesion: 0.13
Nodes (3): three, createLowpolyBoon(), createSmoothBoon()

### Community 10 - "ThreeWorld.tsx"
Cohesion: 0.23
Nodes (5): BoonAnimation, BoonAnimator, createBoonClips(), names, Props

### Community 11 - "Boons World frontend"
Cohesion: 0.09
Nodes (22): Active character, Activity audio restored / plaza concourse, Authored expressive performances, Bloom Plaza connected island (2026-10-01), Bloom Valley product presentation, Boons Warrior course, Boons World frontend, Character audio (+14 more)

### Community 12 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 13 - "BoonsWorld.tsx"
Cohesion: 0.05
Nodes (45): react, AnalogStick(), BoonsWorld(), nextStep(), resetCourse(), simulate(), tick(), walk() (+37 more)

### Community 14 - "studio-boon.ts"
Cohesion: 0.36
Nodes (10): CharacterRootMotion, groundToLocal(), localToGround(), weightHeight(), animate(), damp(), ease(), animate() (+2 more)

### Community 15 - "createStudioBoon"
Cohesion: 0.29
Nodes (7): FootContact, createStudioBoon(), limb(), mesh(), soleLayer(), sphere(), tube()

### Community 16 - "deploy-token.mjs"
Cohesion: 0.17
Nodes (8): artifact, CHAINS, factory, name, provider, supply, symbol, wallet

### Community 17 - "package.json"
Cohesion: 0.18
Nodes (10): description, engines, node, name, private, version, esbuild, ethers (+2 more)

### Community 18 - "emote-performance.ts"
Cohesion: 0.53
Nodes (4): EMOTE_DURATION, Key, performanceCurve(), sampleEmote()

### Community 19 - "TurboPad"
Cohesion: 0.22
Nodes (8): Architecture, Data sources, Features, License, Project structure, Quick start, Roadmap, TurboPad

### Community 21 - "walletconnect.entry.js"
Cohesion: 0.28
Nodes (6): connect(), ensureModal(), getAddress(), NOTE: open() resolves when the modal OPENS, not when it closes —, robinhood, robinhoodTestnet

### Community 23 - "TurboPad on Next.js"
Cohesion: 0.25
Nodes (7): Commands, Configuration, Deployment, Status, TurboPad on Next.js, What was ported, Why migrate at all

### Community 24 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build:wallet, check, compile:token, deploy:pages, dev, start

### Community 25 - "compile-token.mjs"
Cohesion: 0.29
Nodes (6): solc, artifact, errors, input, output, source

### Community 26 - "dev-server.mjs"
Cohesion: 0.29
Nodes (5): args, port, root, server, types

### Community 27 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, esbuild, ethers, @reown/appkit, @reown/appkit-adapter-ethers, solc

### Community 28 - "PonsFamily Universe — frontend phase"
Cohesion: 0.40
Nodes (4): Fullstack roadmap, Included, PonsFamily Universe — frontend phase, Reference asset

## Knowledge Gaps
- **197 isolated node(s):** `robinhood`, `robinhoodTestnet`, `name`, `version`, `private` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 282 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `wallets()` connect `BoonsWorld.tsx` to `holders.ts`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `ThreeWorld()` (e.g. with `.dispose()` and `.unlock()`) actually correct?**
  _`ThreeWorld()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `robinhood`, `robinhoodTestnet`, `name` to the rest of the system?**
  _197 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TurboPad UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `market-data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07918552036199095 - nodes in this community are weakly interconnected._
- **Should `createStudioBoon` be split into smaller, more focused modules?**
  _Cohesion score 0.13970588235294118 - nodes in this community are weakly interconnected._
- **Should `ThreeWorld` be split into smaller, more focused modules?**
  _Cohesion score 0.06280193236714976 - nodes in this community are weakly interconnected._