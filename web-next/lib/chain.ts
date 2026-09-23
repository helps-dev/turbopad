/* Robinhood Chain network definitions and JSON-RPC plumbing.
   Ported from Web/dist/chain.js. Pure data + fetch, safe on both sides.

   Verified live: mainnet eth_chainId -> 0x1237 (4663),
   testnet eth_chainId -> 0xB626 (46630), block time ~0.101 s. */

export interface Network {
  chainId: number;
  chainIdHex: string;
  name: string;
  currency: string;
  /** Keyless public endpoints only. Keyed endpoints belong in rpc-server.ts. */
  rpc: readonly string[];
  explorer: string;
  testnet: boolean;
}

export const ROBINHOOD: Network = {
  chainId: 4663,
  chainIdHex: '0x1237',
  name: 'Robinhood Chain',
  currency: 'ETH',
  // dRPC public gateway first (the official endpoint geo-blocks some regions),
  // official Robinhood endpoint as fallback.
  rpc: ['https://robinhood.drpc.org', 'https://rpc.mainnet.chain.robinhood.com'],
  explorer: 'https://robinhoodchain.blockscout.com',
  testnet: false,
};

export const TESTNET: Network = {
  chainId: 46630,
  chainIdHex: '0xB626',
  name: 'Robinhood Chain Testnet',
  currency: 'ETH',
  rpc: ['https://robinhood-testnet.drpc.org', 'https://rpc.testnet.chain.robinhood.com'],
  explorer: 'https://explorer.testnet.chain.robinhood.com',
  testnet: true,
};

export const networkFor = (testnet: boolean): Network => (testnet ? TESTNET : ROBINHOOD);

export class RpcError extends Error {
  // Declared as a plain field, not a constructor parameter property:
  // parameter properties need a transform, and Node's type stripping only
  // erases types. Keeping strip-only compatible lets tests run without a build.
  readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

interface RpcResponse<T> {
  result?: T;
  error?: { code?: number; message?: string };
}

export async function rpcCall<T>(
  endpoint: string,
  method: string,
  params: unknown[] = [],
  timeoutMs = 12_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new RpcError(`RPC HTTP ${response.status}`);
    const payload = (await response.json()) as RpcResponse<T>;
    if (payload.error) throw new RpcError(payload.error.message || 'RPC error', payload.error.code);
    return payload.result as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Try each endpoint in order; throw the last error if all fail. */
export async function rpcOn<T>(
  endpoints: readonly string[],
  method: string,
  params: unknown[] = [],
  timeoutMs?: number,
): Promise<T> {
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      return await rpcCall<T>(endpoint, method, params, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new RpcError('No reachable RPC endpoint');
}

export const rpc = <T>(method: string, params: unknown[] = []): Promise<T> =>
  rpcOn<T>(ROBINHOOD.rpc, method, params);

export const testnetRpc = <T>(method: string, params: unknown[] = []): Promise<T> =>
  rpcOn<T>(TESTNET.rpc, method, params);

/* ---------- reads ---------- */

export async function latestBlock(testnet = false): Promise<number> {
  const hex = await rpcOn<string>(networkFor(testnet).rpc, 'eth_blockNumber');
  return parseInt(hex, 16);
}

/** Native ETH balance as a float. Precision is fine for display, not accounting. */
export async function getBalance(address: string, testnet = false): Promise<number> {
  const hex = await rpcOn<string>(networkFor(testnet).rpc, 'eth_getBalance', [address, 'latest']);
  return Number(BigInt(hex)) / 1e18;
}

/* ---------- explorer links ---------- */

export const explorerAddress = (address: string, testnet = false): string =>
  `${networkFor(testnet).explorer}/address/${address}`;

export const explorerTx = (hash: string, testnet = false): string =>
  `${networkFor(testnet).explorer}/tx/${hash}`;
