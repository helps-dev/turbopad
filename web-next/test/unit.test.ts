/* Unit tests — pure functions only, no network. These are the regression net for
   the static -> Next.js port: every expectation below was taken from the
   behaviour of the original Web/dist/*.js so a silent change gets caught. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { compact, priceText, ageText, ageMinutes, colorFor, clamp01, shortAddress } from '../lib/format.ts';
import { scoreComponents } from '../lib/score.ts';
import { mapPair, bestPairs, RWA_IDS } from '../lib/market-data.ts';
import { parseUnits, formatUnits, u256, addrWord, encodeConstructor, decodeString, encodeMulticall } from '../lib/abi.ts';
import { normaliseDraft, deployData, TOKEN_ARTIFACT } from '../lib/deploy.ts';
import { withSlippage, encodeSwap, ROUTER, WETH } from '../lib/swap.ts';
import { ROBINHOOD, TESTNET, networkFor, explorerAddress, explorerTx } from '../lib/chain.ts';
import type { DexPair } from '../lib/types.ts';

describe('format', () => {
  test('compact scales into K/M/B', () => {
    assert.equal(compact(0), '0.0000');
    assert.equal(compact(12.5), '12.50');
    assert.equal(compact(1234), '1.2K');
    assert.equal(compact(4_820_000), '4.82M');
    assert.equal(compact(2_110_000_000), '2.11B');
  });

  test('compact treats junk as zero', () => {
    assert.equal(compact(undefined), '0.0000');
    assert.equal(compact('not a number'), '0.0000');
  });

  test('priceText keeps significant digits for sub-cent prices', () => {
    assert.equal(priceText(0), '0');
    assert.equal(priceText(0.000842), '0.000842');
    assert.equal(priceText(3.059e-6), '0.000003059');
    assert.equal(priceText(2.43), '2.43');
    assert.equal(priceText(85_829), '85,829');
  });

  test('priceText reports missing data rather than NaN', () => {
    assert.equal(priceText(undefined), '—');
    assert.equal(priceText('abc'), '—');
  });

  test('ageMinutes/ageText describe pair age', () => {
    const now = 1_000_000_000_000;
    assert.equal(ageMinutes(undefined, now), null);
    assert.equal(ageMinutes(now - 5 * 60_000, now), 5);
    assert.equal(ageText(null), 'Established');
    assert.equal(ageText(5), '5m ago');
    assert.equal(ageText(120), '2h ago');
    assert.equal(ageText(2880), '2d ago');
  });

  test('ageMinutes never returns zero or negative', () => {
    const now = 1_000_000_000_000;
    assert.equal(ageMinutes(now, now), 1);
    assert.equal(ageMinutes(now + 60_000, now), 1);
  });

  test('colorFor is stable and deterministic', () => {
    assert.equal(colorFor('TURBO'), colorFor('TURBO'));
    assert.notEqual(colorFor('TURBO'), colorFor('PEPE'));
    assert.match(colorFor('TURBO'), /^hsl\(\d{1,3} 38% 64%\)$/);
  });

  test('clamp01 bounds to 0..1', () => {
    assert.equal(clamp01(-5), 0);
    assert.equal(clamp01(0.5), 0.5);
    assert.equal(clamp01(5), 1);
  });

  test('shortAddress keeps both ends', () => {
    assert.equal(shortAddress('0x10F5bA270B0B5dA5A4d21369F2C74a300BB16A8B'), '0x10F5…6A8B');
  });
});

describe('Turbo Score', () => {
  const pair = (over: Partial<DexPair> = {}): DexPair => ({
    pairAddress: '0xpair',
    baseToken: { symbol: 'T', name: 'T', address: '0xtoken' },
    priceUsd: '1',
    volume: { h24: 1_000_000 },
    liquidity: { usd: 200_000 },
    txns: { h24: { buys: 600, sells: 400 } },
    priceChange: { h24: 10 },
    ...over,
  });

  test('stays inside the advertised 1..99 band', () => {
    for (const p of [
      pair(),
      pair({ volume: { h24: 0 }, liquidity: { usd: 0 }, txns: { h24: { buys: 0, sells: 0 } }, priceChange: { h24: -99 } }),
      pair({ volume: { h24: 1e12 }, liquidity: { usd: 1e12 }, txns: { h24: { buys: 1e9, sells: 0 } }, priceChange: { h24: 1e6 } }),
    ]) {
      const { score } = scoreComponents(p);
      assert.ok(score >= 1 && score <= 99, `score ${score} out of band`);
    }
  });

  test('missing fields do not throw or produce NaN', () => {
    const { score, volumeQ, buyerQ, liquidityQ } = scoreComponents({});
    for (const value of [score, volumeQ, buyerQ, liquidityQ]) {
      assert.ok(Number.isFinite(value), 'component is not finite');
    }
  });

  test('more volume scores higher, all else equal', () => {
    const low = scoreComponents(pair({ volume: { h24: 1_000 } })).score;
    const high = scoreComponents(pair({ volume: { h24: 10_000_000 } })).score;
    assert.ok(high > low, `${high} should beat ${low}`);
  });

  test('buy pressure lifts the score over sell pressure', () => {
    const buying = scoreComponents(pair({ txns: { h24: { buys: 950, sells: 50 } } })).score;
    const selling = scoreComponents(pair({ txns: { h24: { buys: 50, sells: 950 } } })).score;
    assert.ok(buying > selling);
  });
});

describe('market mapping', () => {
  test('mapPair fills every display field from a sparse pair', () => {
    const market = mapPair({ pairAddress: '0xabc', chainId: 'robinhood' });
    assert.equal(market.id, '0xabc');
    assert.equal(market.source, 'Robinhood');
    assert.equal(market.name, 'Unknown');
    assert.equal(market.symbol, '—');
    assert.equal(market.kind, 'meme');
    assert.deepEqual(market.txns, { buys: 0, sells: 0 });
    assert.ok(market.url.includes('0xabc'));
    assert.ok(market.progress >= 1 && market.progress <= 100);
  });

  test('unknown chain ids fall back to the raw id', () => {
    assert.equal(mapPair({ pairAddress: '0x1', chainId: 'newchain' }).source, 'newchain');
    assert.equal(mapPair({ pairAddress: '0x1' }).source, 'Unknown');
  });

  test('bestPairs keeps the deepest liquidity per token', () => {
    const pairs: DexPair[] = [
      { pairAddress: '0xshallow', priceUsd: '1', baseToken: { address: '0xtoken' }, liquidity: { usd: 100 } },
      { pairAddress: '0xdeep', priceUsd: '1', baseToken: { address: '0xtoken' }, liquidity: { usd: 900 } },
    ];
    const result = bestPairs(pairs);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.pairAddress, '0xdeep');
  });

  test('bestPairs drops unpriced pairs and tolerates empty input', () => {
    assert.deepEqual(bestPairs([{ pairAddress: '0x1' }]), []);
    assert.deepEqual(bestPairs(undefined), []);
    assert.deepEqual(bestPairs(null), []);
  });

  test('RWA basket asks for 8 ids and no longer uses the retired maple id', () => {
    assert.equal(RWA_IDS.length, 8);
    assert.ok(RWA_IDS.includes('syrup'), 'Maple Finance is listed as syrup');
    assert.ok(!RWA_IDS.includes('maple'), 'the maple id was retired by CoinGecko');
    assert.equal(new Set(RWA_IDS).size, 8, 'ids must be unique');
  });
});

describe('ABI encoding', () => {
  test('parseUnits/formatUnits round-trip', () => {
    assert.equal(parseUnits('1', 18), 10n ** 18n);
    assert.equal(parseUnits('1.5', 18), 1_500_000_000_000_000_000n);
    assert.equal(parseUnits('0.000000000000000001', 18), 1n);
    assert.equal(formatUnits(10n ** 18n, 18), '1');
    assert.equal(formatUnits(1_500_000_000_000_000_000n, 18), '1.5');
    assert.equal(formatUnits(0n, 18), '0');
  });

  test('parseUnits truncates beyond the decimal precision', () => {
    assert.equal(parseUnits('1.9999', 2), 199n);
  });

  test('parseUnits rejects malformed amounts', () => {
    for (const bad of ['', 'abc', '-1', '1.2.3', '1e18', ' ']) {
      assert.throws(() => parseUnits(bad, 18), /Invalid amount/, `accepted "${bad}"`);
    }
  });

  test('words are 32 bytes', () => {
    assert.equal(u256(1).length, 64);
    assert.equal(addrWord('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73').length, 64);
    assert.ok(addrWord(WETH).endsWith('0bd7d308f8e1639fab988df18a8011f41eacad73'));
  });

  test('decodeString reverses an ABI string', () => {
    const encoded = '0x' + u256(0x20) + u256(5) + Buffer.from('TURBO').toString('hex').padEnd(64, '0');
    assert.equal(decodeString(encoded), 'TURBO');
  });

  test('constructor args are 32-byte aligned with correct offsets', () => {
    const data = encodeConstructor('Turbo Cat', 'TCAT', 10n ** 27n);
    assert.equal(data.length % 64, 0, 'not word aligned');
    assert.equal(data.slice(0, 64), u256(0x60), 'name offset');
    assert.equal(data.slice(64, 128), u256(0xa0), 'symbol offset');
    assert.equal(data.slice(128, 192), u256(10n ** 27n), 'supply');
    assert.ok(data.includes(Buffer.from('Turbo Cat').toString('hex')));
    assert.ok(data.includes(Buffer.from('TCAT').toString('hex')));
  });

  test('multicall encodes a selector, count and per-call offsets', () => {
    const a = '0x' + 'aa'.repeat(4);
    const b = '0x' + 'bb'.repeat(36); // spans two words, exercises padding
    const encoded = encodeMulticall('0xac9650d8', [a, b]);
    assert.ok(encoded.startsWith('0xac9650d8'));
    const body = encoded.slice(10);
    assert.equal(body.slice(0, 64), u256(0x20));
    assert.equal(body.slice(64, 128), u256(2), 'call count');
    assert.equal(body.length % 64, 0, 'not word aligned');
  });
});

describe('deploy validation', () => {
  test('accepts a sane draft and scales supply to wei', () => {
    const draft = normaliseDraft({ name: '  Turbo Cat ', symbol: 'tcat', supply: '1000000000' });
    assert.equal(draft.name, 'Turbo Cat');
    assert.equal(draft.symbol, 'TCAT', 'ticker is upper-cased');
    assert.equal(draft.supplyWei, 10n ** 9n * 10n ** 18n);
  });

  test('rejects drafts the contract would revert on', () => {
    const cases: [string, Parameters<typeof normaliseDraft>[0]][] = [
      ['empty name', { name: '', symbol: 'T', supply: '1' }],
      ['name over 40 chars', { name: 'x'.repeat(41), symbol: 'T', supply: '1' }],
      ['empty ticker', { name: 'Ok', symbol: '', supply: '1' }],
      ['ticker over 10 chars', { name: 'Ok', symbol: 'A'.repeat(11), supply: '1' }],
      ['ticker with punctuation', { name: 'Ok', symbol: 'A-B', supply: '1' }],
      ['zero supply', { name: 'Ok', symbol: 'T', supply: '0' }],
      ['fractional supply', { name: 'Ok', symbol: 'T', supply: '1.5' }],
      ['negative supply', { name: 'Ok', symbol: 'T', supply: '-1' }],
    ];
    for (const [label, input] of cases) {
      assert.throws(() => normaliseDraft(input), Error, `accepted ${label}`);
    }
  });

  test('deployData prefixes the compiled creation bytecode', () => {
    const draft = normaliseDraft({ name: 'Ok', symbol: 'OK', supply: '1' });
    const data = deployData(draft);
    assert.ok(data.startsWith(`0x${TOKEN_ARTIFACT.bytecode}`));
    assert.ok(TOKEN_ARTIFACT.bytecode.length > 1000, 'artifact looks truncated');
    assert.equal((data.length - 2) % 2, 0, 'odd number of hex chars');
  });
});

describe('swap encoding', () => {
  test('slippage lowers the minimum out, never raises it', () => {
    assert.equal(withSlippage(10_000n, 100), 9_900n); // 1%
    assert.equal(withSlippage(10_000n, 0), 10_000n);
    assert.ok(withSlippage(10_000n, 500) < 10_000n);
  });

  test('exactInputSingle packs 8 words after the selector', () => {
    const data = encodeSwap(WETH, '0x' + '11'.repeat(20), 3000, ROUTER, 10n ** 18n, 1n);
    assert.ok(data.startsWith('0x414bf389'));
    assert.equal((data.length - 10) / 64, 8, 'unexpected argument count');
  });
});

describe('chain config', () => {
  test('chain ids and their hex forms agree', () => {
    assert.equal(parseInt(ROBINHOOD.chainIdHex, 16), ROBINHOOD.chainId);
    assert.equal(parseInt(TESTNET.chainIdHex, 16), TESTNET.chainId);
    assert.equal(ROBINHOOD.chainId, 4663);
    assert.equal(TESTNET.chainId, 46630);
  });

  test('networkFor selects by the testnet flag', () => {
    assert.equal(networkFor(false).chainId, 4663);
    assert.equal(networkFor(true).chainId, 46630);
    assert.equal(networkFor(true).testnet, true);
  });

  test('explorer links point at the matching network', () => {
    assert.ok(explorerAddress('0xabc').startsWith(ROBINHOOD.explorer));
    assert.ok(explorerTx('0xdef', true).startsWith(TESTNET.explorer));
    assert.ok(explorerAddress('0xabc').endsWith('/address/0xabc'));
    assert.ok(explorerTx('0xdef').endsWith('/tx/0xdef'));
  });

  test('every configured RPC endpoint is https', () => {
    for (const network of [ROBINHOOD, TESTNET]) {
      for (const url of network.rpc) {
        assert.ok(url.startsWith('https://'), `${url} is not https`);
      }
    }
  });
});
