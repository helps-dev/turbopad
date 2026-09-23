/* SERVER ONLY. The keyed RPC endpoint lives here and must never reach the
   browser bundle: a static site cannot hold a secret, which is the core reason
   TurboPad moved to Next.js.

   Configure in .env.local (never commit it):
     TURBOPAD_RPC_URL=https://robinhood-mainnet.g.alchemy.com/v2/<key>

   Verified capabilities of the Alchemy free tier on Robinhood Chain:
     eth_getLogs           max 10 block range  -> unusable for history
     alchemy_getAssetTransfers  full range + pageKey -> what we actually use
     alchemy_getTokenMetadata   available
     trace_block                NOT available on this chain
   dRPC free rejects getLogs ranges above ~10 blocks in practice despite
   advertising 10,000, so neither public endpoint can rebuild holder history. */
import { ROBINHOOD, TESTNET, rpcCall, rpcOn, RpcError } from './chain.ts';

if (typeof window !== 'undefined') {
  throw new Error('rpc-server.ts was imported into a browser bundle — it holds the RPC key.');
}

/** Keyed endpoint first (higher limits + enhanced methods), public as fallback. */
function endpoints(testnet: boolean): string[] {
  const keyed = process.env[testnet ? 'TURBOPAD_RPC_URL_TESTNET' : 'TURBOPAD_RPC_URL'];
  const fallback = testnet ? TESTNET.rpc : ROBINHOOD.rpc;
  return keyed ? [keyed, ...fallback] : [...fallback];
}

export const hasKeyedRpc = (testnet = false): boolean =>
  Boolean(process.env[testnet ? 'TURBOPAD_RPC_URL_TESTNET' : 'TURBOPAD_RPC_URL']);

export const serverRpc = <T>(method: string, params: unknown[] = [], testnet = false): Promise<T> =>
  rpcOn<T>(endpoints(testnet), method, params, 30_000);

/** Enhanced Alchemy methods exist only on the keyed endpoint — no fallback. */
export function alchemyRpc<T>(method: string, params: unknown[] = [], testnet = false): Promise<T> {
  const keyed = process.env[testnet ? 'TURBOPAD_RPC_URL_TESTNET' : 'TURBOPAD_RPC_URL'];
  if (!keyed) {
    throw new RpcError(`${method} needs TURBOPAD_RPC_URL (an Alchemy endpoint); public RPCs do not support it`);
  }
  return rpcCall<T>(keyed, method, params, 30_000);
}
