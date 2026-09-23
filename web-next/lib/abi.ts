/* Hand-rolled ABI encoding. Kept from the static build on purpose: it avoids a
   ~200 kB ethers dependency for the handful of calls TurboPad actually makes.
   Ported from Web/dist/swap.js and Web/dist/deploy.js. */

/** Left-pad an address to a 32-byte ABI word. */
export const addrWord = (a: string): string =>
  a.toLowerCase().replace('0x', '').padStart(64, '0');

/** Left-pad a uint to a 32-byte ABI word. */
export const u256 = (v: bigint | number | string): string =>
  BigInt(v).toString(16).padStart(64, '0');

/** Decode an ABI-encoded dynamic string returned by eth_call. */
export function decodeString(hex: string): string {
  const body = hex.slice(2);
  const len = parseInt(body.slice(64, 128), 16);
  const bytes = body.slice(128, 128 + len * 2);
  const pairs = bytes.match(/../g) ?? [];
  return new TextDecoder().decode(Uint8Array.from(pairs.map(b => parseInt(b, 16))));
}

/** "1.5" at 18 decimals -> 1500000000000000000n. Rejects junk input. */
export function parseUnits(value: string | number, decimals: number): bigint {
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Invalid amount');
  const [whole = '0', frac = ''] = text.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

export function formatUnits(value: bigint, decimals: number, maxDp = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, '0').slice(0, maxDp).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** ABI-encode (string, string, uint256) for the TurboToken constructor. */
export function encodeConstructor(name: string, symbol: string, supplyWei: bigint): string {
  const encodeString = (text: string): string => {
    const bytes = new TextEncoder().encode(text);
    const body = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const padded = body.padEnd(Math.ceil(body.length / 64) * 64 || 64, '0');
    return u256(bytes.length) + padded;
  };
  // head: offset(name)=0x60, offset(symbol)=0xa0, supply
  const head = u256(0x60) + u256(0xa0) + u256(supplyWei);
  return head + encodeString(name) + encodeString(symbol);
}

/** Encode Uniswap V3 multicall(bytes[]) from already-encoded call payloads. */
export function encodeMulticall(selector: string, calls: readonly string[]): string {
  const offsets: number[] = [];
  let running = 32 * calls.length;
  for (const c of calls) {
    offsets.push(running);
    running += 32 + Math.ceil(((c.length - 2) / 2) / 32) * 32;
  }
  const body = calls
    .map(c => {
      const bytes = c.slice(2);
      return u256(bytes.length / 2) + bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
    })
    .join('');
  return selector + u256(0x20) + u256(calls.length) + offsets.map(o => u256(o)).join('') + body;
}
