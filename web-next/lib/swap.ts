/* TurboPad swap layer: real buy/sell on the canonical Uniswap V3 deployment on
   Robinhood Chain mainnet. Ported from Web/dist/swap.js.

   Every transaction is signed by the user's own wallet. TurboPad never holds
   keys and never sends anything without an explicit wallet prompt. */
import { rpc } from './chain.ts';
import { addrWord, decodeString, u256, encodeMulticall } from './abi.ts';
import type { Eip1193Provider } from './wallet.ts';

export const ROUTER = '0xCaf681a66D020601342297493863E78C959E5cb2';
export const QUOTER = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';
export const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
export const FEE_TIERS: readonly number[] = [500, 3000, 10000, 100];

const SEL = {
  quote: '0xc6a5026a', // quoteExactInputSingle((address,address,uint256,uint24,uint160))
  exactInputSingle: '0x414bf389',
  multicall: '0xac9650d8',
  unwrapWETH9: '0x49404b7c',
  approve: '0x095ea7b3',
  allowance: '0xdd62ed3e',
  decimals: '0x313ce567',
  symbol: '0x95d89b41',
  balanceOf: '0x70a08231',
} as const;

const call = (to: string, data: string): Promise<string> =>
  rpc<string>('eth_call', [{ to, data }, 'latest']);

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

export async function tokenMeta(address: string): Promise<TokenMeta> {
  const [symbolHex, decimalsHex] = await Promise.all([
    call(address, SEL.symbol),
    call(address, SEL.decimals),
  ]);
  return { symbol: decodeString(symbolHex), decimals: parseInt(decimalsHex, 16) };
}

export async function balanceOf(token: string, owner: string): Promise<bigint> {
  return BigInt(await call(token, SEL.balanceOf + addrWord(owner)));
}

export interface Quote {
  amountOut: bigint;
  fee: number;
}

/** Best quote across fee tiers; throws when no pool has liquidity. */
export async function quote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote> {
  let best: Quote | null = null;
  for (const fee of FEE_TIERS) {
    try {
      const res = await call(
        QUOTER,
        SEL.quote + addrWord(tokenIn) + addrWord(tokenOut) + u256(amountIn) + u256(fee) + u256(0),
      );
      const amountOut = BigInt(res.slice(0, 66));
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) best = { amountOut, fee };
    } catch {
      /* no pool on this fee tier */
    }
  }
  if (!best) throw new Error('No Uniswap V3 pool with liquidity for this token');
  return best;
}

interface Receipt {
  status?: string;
  contractAddress?: string;
}

export async function waitReceipt(hash: string, timeoutMs = 120_000): Promise<Receipt> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = await rpc<Receipt | null>('eth_getTransactionReceipt', [hash]);
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted on-chain');
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Confirmation timed out — check the explorer for the final status');
}

const deadline = (): bigint => BigInt(Math.floor(Date.now() / 1000) + 1200);

export const withSlippage = (amountOut: bigint, bps: number): bigint =>
  (amountOut * BigInt(10_000 - bps)) / 10_000n;

export function encodeSwap(
  tokenIn: string, tokenOut: string, fee: number,
  recipient: string, amountIn: bigint, minOut: bigint,
): string {
  return SEL.exactInputSingle + addrWord(tokenIn) + addrWord(tokenOut) + u256(fee)
    + addrWord(recipient) + u256(deadline()) + u256(amountIn) + u256(minOut) + u256(0);
}

export interface SwapOptions {
  provider: Eip1193Provider;
  from: string;
  token: string;
  amountWei: bigint;
  slippageBps?: number;
  onStatus?: (message: string) => void;
}

export interface SwapResult {
  hash: string;
  amountOut: bigint;
  fee: number;
}

/** Buy `token` with ETH. */
export async function buy({
  provider, from, token, amountWei, slippageBps = 100, onStatus = () => {},
}: SwapOptions): Promise<SwapResult> {
  onStatus('Finding the best pool…');
  const { amountOut, fee } = await quote(WETH, token, amountWei);
  const minOut = withSlippage(amountOut, slippageBps);
  onStatus('Confirm the swap in your wallet…');
  const hash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [{
      from, to: ROUTER,
      value: `0x${amountWei.toString(16)}`,
      data: encodeSwap(WETH, token, fee, from, amountWei, minOut),
    }],
  });
  onStatus('Swap sent — waiting for confirmation…');
  await waitReceipt(hash);
  return { hash, amountOut, fee };
}

/** Sell `token` for ETH: approve once, then swap + unwrap in a single tx. */
export async function sell({
  provider, from, token, amountWei, slippageBps = 100, onStatus = () => {},
}: SwapOptions): Promise<SwapResult> {
  onStatus('Finding the best pool…');
  const { amountOut, fee } = await quote(token, WETH, amountWei);
  const minOut = withSlippage(amountOut, slippageBps);

  onStatus('Checking token approval…');
  const allowanceHex = await call(token, SEL.allowance + addrWord(from) + addrWord(ROUTER));
  if (BigInt(allowanceHex) < amountWei) {
    onStatus('Approve the token in your wallet (one-time)…');
    const approveHash = await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [{ from, to: token, data: SEL.approve + addrWord(ROUTER) + u256(amountWei) }],
    });
    onStatus('Approval sent — waiting for confirmation…');
    await waitReceipt(approveHash);
  }

  onStatus('Confirm the swap in your wallet…');
  const swapCall = encodeSwap(token, WETH, fee, ROUTER, amountWei, minOut); // router keeps WETH…
  const unwrapCall = SEL.unwrapWETH9 + u256(minOut) + addrWord(from);       // …then unwraps to your ETH
  const hash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [{ from, to: ROUTER, data: encodeMulticall(SEL.multicall, [swapCall, unwrapCall]) }],
  });
  onStatus('Swap sent — waiting for confirmation…');
  await waitReceipt(hash);
  return { hash, amountOut, fee };
}

export { SEL as SWAP_SELECTORS };
