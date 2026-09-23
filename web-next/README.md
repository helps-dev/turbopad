# TurboPad on Next.js

Migration target for TurboPad. Built **alongside** the static site in
`../Web/dist`, which stays live and untouched until this app reaches parity.

## Why migrate at all

A static site cannot hold a secret, and it cannot do slow work once for
everybody. Both limits blocked the features we actually want:

- **Holder-concentration analysis** needs a keyed RPC. On the free public
  endpoints `eth_getLogs` caps out at ~10 blocks (≈1 second of history at this
  chain's 0.101 s block time), so history cannot be rebuilt. Alchemy's
  `alchemy_getAssetTransfers` accepts the full range with paging — but the key
  must never reach the browser.
- The work is **too slow to run per visitor**: measured on live tokens,
  6 requests / 9 s for a quiet token and 60 requests / 76 s for a busy one.

Server components and route handlers solve both: the key stays in
`process.env`, the result is computed once and cached.

## Status

Phase 1 of 4 is complete.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Scaffold, port the DOM-free logic layer, first test suite | **done** |
| 2 | Server-side holder concentration ("Rug Risk") | next |
| 3 | Port the terminal UI to React + the full theme | todo |
| 4 | News feed, ticker extraction, news → launch | todo |

## What was ported

The static build's logic layer had **zero DOM references**, so it moved across
with its behaviour intact rather than being rewritten:

| From | To | Notes |
| --- | --- | --- |
| `data.js` | `lib/market-data.ts` | + `lib/format.ts`, `lib/score.ts`, `lib/types.ts` |
| `chain.js` | `lib/chain.ts` | network config + JSON-RPC |
| `chain/swap/deploy` provider code | `lib/wallet.ts` | was duplicated in three files |
| `swap.js` | `lib/swap.ts` | + `lib/abi.ts` for the hand-rolled encoding |
| `deploy.js` | `lib/deploy.ts` | validation split out as a pure function |
| `featured.js` | `lib/featured.ts` | now env-configurable |
| `token-artifact.js` | `lib/token-artifact.ts` | emitted by `scripts/compile-token.mjs` |

ABI encoding stays hand-rolled on purpose: it avoids a ~200 kB `ethers`
dependency for the handful of calls TurboPad makes.

`lib/rpc-server.ts` is the one server-only module. It throws if it is ever
imported into a browser bundle.

## Commands

```bash
pnpm install          # npm install fails on this network; pnpm works
pnpm dev              # http://localhost:3000
pnpm verify           # typecheck + unit tests + production build
pnpm test:unit        # 34 offline tests, deterministic
pnpm test:live        # 10 tests against the real APIs and RPC
```

`verify` deliberately excludes `test:live` so it stays offline and repeatable.
The live suite talks to third-party APIs, so it is occasionally flaky: 1
transient failure in 5 consecutive runs during phase 1, cause not captured.
Treat a single red run as a retry, not a regression.

## Configuration

Copy `.env.example` to `.env.local`. `TURBOPAD_RPC_URL` has no `NEXT_PUBLIC_`
prefix, so Next.js refuses to inline it into client code — that is the whole
point. On Vercel, set it as an Environment Variable instead.

## Deployment

This app needs a Node runtime. Vercel with **Root Directory** set to
`web-next`. GitHub Pages and `output: 'export'` are not options: both strip the
server side and bring back the key-exposure problem the migration exists to fix.

The legacy `deploy:pages` script and `Web/.openai/hosting.json` apply only to
the static build.
