/* Browser wallet access (EIP-1193). Client-side only.

   Ported from the provider-resolution logic that was duplicated across
   Web/dist/{chain,swap,deploy}.js — one place now, so injected wallets and the
   Reown AppKit provider cannot drift apart. */
import { networkFor, type Network } from './chain.ts';

export interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    solana?: { connect(): Promise<{ publicKey?: { toString(): string } }> };
  }
}

/** EIP-1193 "user rejected request". */
export const USER_REJECTED = 4001;
/** EIP-3085 "chain not added to wallet yet". */
const CHAIN_NOT_ADDED = 4902;

export function isUserRejection(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { code?: number }).code === USER_REJECTED;
}

/** The injected provider, if any. AppKit is layered on top by the wallet hook. */
export function injectedProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum?.request ? window.ethereum : null;
}

export async function requestAccounts(provider: Eip1193Provider): Promise<string> {
  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  const first = accounts?.[0];
  if (!first) throw new Error('No wallet account available');
  return first;
}

export async function walletChainId(provider: Eip1193Provider): Promise<number> {
  const hex = await provider.request<string>({ method: 'eth_chainId' });
  return parseInt(hex, 16);
}

/** Ask the wallet to switch to Robinhood Chain, adding the network if unknown. */
export async function ensureRobinhood(
  provider: Eip1193Provider,
  testnet = false,
): Promise<Network> {
  const target = networkFor(testnet);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target.chainIdHex }],
    });
  } catch (error) {
    if ((error as { code?: number })?.code !== CHAIN_NOT_ADDED) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: target.chainIdHex,
        chainName: target.name,
        nativeCurrency: { name: target.currency, symbol: target.currency, decimals: 18 },
        rpcUrls: [...target.rpc],
        blockExplorerUrls: [target.explorer],
      }],
    });
  }
  return target;
}
