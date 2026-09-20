# Graph Report - Turbopad  (2026-09-20)

## Corpus Check
- 10 files; detector estimates ~99,740 words including image equivalents (not literal text).
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 47 nodes · 50 edges · 9 communities (6 shown, 2 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: unavailable for host-agent extraction; AST extraction uses no LLM tokens.

## Community Hubs (Navigation)
- Prototype Scope
- Application State and Dialogs
- Banner Animation
- Brand Banner
- Market Rendering and Navigation
- Terminal Table and Chart
- Logo Identity
- Market Detail Charts

## God Nodes (most connected - your core abstractions)
1. `TurboPad UI` - 13 edges
2. `tick()` - 4 edges
3. `TurboPad brand banner` - 4 edges
4. `draw()` - 3 edges
5. `chart()` - 3 edges
6. `card()` - 3 edges
7. `render()` - 3 edges
8. `setView()` - 3 edges
9. `syncTable()` - 2 edges
10. `setLayout()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `card()` --calls--> `chart()`  [EXTRACTED]
  Web/dist/app.js → Web/dist/app.js  _Bridges community 7 → community 4_

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "Prototype Scope"
Cohesion: 0.14
Nodes (14): Blockchain contracts (not connected), Bonding curves (not connected), Creator Revenue presentation, Live market data (not connected), Meme Battles, Multi-launchpad labels, Responsive desktop and mobile interface, RWA backend (not connected) (+6 more)

### Community 1 - "Application State and Dialogs"
Cohesion: 0.29
Nodes (3): dialog, markets, saved

### Community 2 - "Banner Animation"
Cohesion: 0.60
Nodes (5): draw(), resize(), select(), sync(), tick()

### Community 3 - "Brand Banner"
Cohesion: 0.40
Nodes (5): TurboPad brand banner, Dark cosmic and metallic visual identity, Ideas move faster tagline, Launch / Trade / Create / Win positioning, TurboPad

### Community 4 - "Market Rendering and Navigation"
Cohesion: 0.50
Nodes (4): battle(), card(), render(), setView()

### Community 6 - "Logo Identity"
Cohesion: 0.67
Nodes (3): Turbopad logo, Dark metallic visual identity with warm rim lighting, Winged T-shaped monogram

## Knowledge Gaps
- **21 isolated node(s):** `markets`, `saved`, `dialog`, `Turbo Score and market discovery`, `Turbo Radar signals` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 28 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `markets`, `saved`, `dialog` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Prototype Scope` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._

Audit limitations: Web/dist was explicitly included because default detection excludes dist. AST does not fully model global state and DOM MutationObserver dependencies. Token usage for host-agent semantic extraction is unavailable; zero counters do not mean no model tokens were consumed. Image-derived word counts are detector estimates, not literal document words.
