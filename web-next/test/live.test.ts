/* Live integration tests — these hit real third-party APIs and the Robinhood
   Chain RPC. Kept separate from unit.test.ts so `npm run verify` stays offline
   and deterministic; run with `npm run test:live`.

   They assert the *contract* we depend on (shape, ranges, ordering) rather than
   specific prices, so they fail when an upstream API changes rather than when
   the market moves. */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { memeMarkets, rwaMarkets, searchMarkets, ohlcv, RWA_IDS, __clearCache } from '../lib/market-data.ts';
import { latestBlock, rpc, ROBINHOOD, TESTNET, rpcOn } from '../lib/chain.ts';
import type { Market } from '../lib/types.ts';

const MINUTE = 60_000;

function assertMarketShape(market: Market, label: string): void {
  assert.ok(market.id, `${label}: missing id`);
  assert.ok(market.symbol && market.symbol !== '—', `${label}: missing symbol`);
  assert.ok(Number.isFinite(market.priceRaw), `${label}: price is not finite`);
  assert.ok(Number.isFinite(market.change), `${label}: change is not finite`);
  assert.ok(Number.isFinite(market.volumeRaw), `${label}: volume is not finite`);
  assert.ok(market.price !== '—', `${label}: unformatted price`);
  assert.ok(['meme', 'rwa'].includes(market.kind), `${label}: bad kind`);
}

describe('DexScreener meme markets', { timeout: 2 * MINUTE }, () => {
  let markets: Market[] = [];

  before(async () => {
    __clearCache();
    markets = await memeMarkets();
  });

  test('returns a capped, non-empty set', () => {
    assert.ok(markets.length > 0, 'no markets returned');
    assert.ok(markets.length <= 14, `expected at most 14, got ${markets.length}`);
  });

  test('every market is well formed', () => {
    markets.forEach((m, i) => assertMarketShape(m, `meme[${i}] ${m.symbol}`));
  });

  test('scores are inside the advertised band and sorted descending', () => {
    for (const m of markets) {
      assert.ok(m.score !== null && m.score >= 1 && m.score <= 99, `${m.symbol} score ${m.score}`);
    }
    const scores = markets.map(m => m.score ?? 0);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'not sorted by score');
  });

  test('pair ids are unique', () => {
    assert.equal(new Set(markets.map(m => m.id)).size, markets.length);
  });
});

describe('CoinGecko RWA basket', { timeout: MINUTE }, () => {
  test('all 8 configured ids still resolve', async () => {
    __clearCache();
    const markets = await rwaMarkets();
    assert.equal(
      markets.length,
      RWA_IDS.length,
      `expected ${RWA_IDS.length} assets, got ${markets.length}: `
      + `${RWA_IDS.filter(id => !markets.some(m => m.id === id)).join(', ')} missing`,
    );
    markets.forEach(m => assertMarketShape(m, `rwa ${m.symbol}`));
    for (const m of markets) {
      assert.equal(m.kind, 'rwa');
      assert.equal(m.score, null, 'RWA listings carry no Turbo Score');
      assert.ok(m.capRaw > 0, `${m.symbol} has no market cap`);
    }
  });
});

describe('GeckoTerminal charts', { timeout: 2 * MINUTE }, () => {
  test('OHLCV comes back ascending with sane candles', async () => {
    __clearCache();
    const markets = await memeMarkets();
    const target = markets.find(m => m.chainId && m.liquidityRaw > 10_000) ?? markets[0];
    assert.ok(target?.chainId, 'no chartable market found');

    const candles = await ohlcv(target.chainId, target.id, '24H');
    assert.ok(candles.length > 0, 'empty chart');
    for (let i = 1; i < candles.length; i++) {
      assert.ok(candles[i]!.t >= candles[i - 1]!.t, 'timestamps not ascending');
    }
    for (const c of candles) {
      assert.ok(c.high >= c.low, 'high below low');
      assert.ok(c.t > 1_600_000_000_000, 'timestamp is not milliseconds');
    }
  });
});

describe('DexScreener search', { timeout: MINUTE }, () => {
  test('a common query returns capped, well-formed results', async () => {
    const results = await searchMarkets('pepe');
    assert.ok(results.length > 0, 'no search results');
    assert.ok(results.length <= 12);
    results.forEach((m, i) => assertMarketShape(m, `search[${i}] ${m.symbol}`));
  });
});

describe('Robinhood Chain RPC', { timeout: MINUTE }, () => {
  test('mainnet reports the chain id we ship', async () => {
    const hex = await rpc<string>('eth_chainId');
    assert.equal(parseInt(hex, 16), ROBINHOOD.chainId);
  });

  test('testnet reports the chain id we ship', async () => {
    const hex = await rpcOn<string>(TESTNET.rpc, 'eth_chainId');
    assert.equal(parseInt(hex, 16), TESTNET.chainId);
  });

  test('the chain is advancing', async () => {
    const block = await latestBlock();
    assert.ok(block > 70_000_000, `unexpectedly low block height ${block}`);
  });
});
