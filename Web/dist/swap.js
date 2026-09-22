/* TurboPad swap layer: real buy/sell on the canonical Uniswap V3 deployment
   on Robinhood Chain mainnet (verified on-chain: factory 0x1f7d…2EfA,
   router 0xCaf6…5cb2, quoter 0x33e8…A9E7, WETH 0x0Bd7…AD73).
   Every transaction is signed by the user's own wallet — TurboPad never
   holds keys and never sends anything without an explicit wallet prompt. */
(() => {
  const ROUTER = '0xCaf681a66D020601342297493863E78C959E5cb2';
  const QUOTER = '0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7';
  const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73';
  const FEE_TIERS = [500, 3000, 10000, 100];

  const SEL = {
    quote: '0xc6a5026a',          // quoteExactInputSingle((address,address,uint256,uint24,uint160))
    exactInputSingle: '0x414bf389', // exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))
    multicall: '0xac9650d8',      // multicall(bytes[])
    unwrapWETH9: '0x49404b7c',    // unwrapWETH9(uint256,address)
    approve: '0x095ea7b3',
    allowance: '0xdd62ed3e',
    decimals: '0x313ce567',
    symbol: '0x95d89b41',
    balanceOf: '0x70a08231',
  };

  const addr = a => a.toLowerCase().replace('0x', '').padStart(64, '0');
  const u256 = v => BigInt(v).toString(16).padStart(64, '0');

  function parseUnits(value, decimals) {
    const text = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Invalid amount');
    const [whole, frac = ''] = text.split('.');
    const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || '0');
  }

  function formatUnits(value, decimals, maxDp = 6) {
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const frac = (value % base).toString().padStart(decimals, '0').slice(0, maxDp).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : `${whole}`;
  }

  async function call(to, data) {
    return TurboChain.rpc('eth_call', [{ to, data }, 'latest']);
  }

  function decodeString(hex) {
    const body = hex.slice(2);
    const len = parseInt(body.slice(64, 128), 16);
    const bytes = body.slice(128, 128 + len * 2);
    return new TextDecoder().decode(Uint8Array.from(bytes.match(/../g).map(b => parseInt(b, 16))));
  }

  async function tokenMeta(address) {
    const [symbolHex, decimalsHex] = await Promise.all([
      call(address, SEL.symbol),
      call(address, SEL.decimals),
    ]);
    return { symbol: decodeString(symbolHex), decimals: parseInt(decimalsHex, 16) };
  }

  async function balanceOf(token, owner) {
    const hex = await call(token, SEL.balanceOf + addr(owner));
    return BigInt(hex);
  }

  /* Best quote across fee tiers; throws when no pool has liquidity. */
  async function quote(tokenIn, tokenOut, amountIn) {
    let best = null;
    for (const fee of FEE_TIERS) {
      try {
        const res = await call(QUOTER, SEL.quote + addr(tokenIn) + addr(tokenOut) + u256(amountIn) + u256(fee) + u256(0));
        const amountOut = BigInt(res.slice(0, 66));
        if (amountOut > 0n && (!best || amountOut > best.amountOut)) best = { amountOut, fee };
      } catch { /* no pool on this fee tier */ }
    }
    if (!best) throw new Error('No Uniswap V3 pool with liquidity for this token');
    return best;
  }

  async function waitReceipt(hash, timeoutMs = 120000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const receipt = await TurboChain.rpc('eth_getTransactionReceipt', [hash]);
      if (receipt) {
        if (receipt.status === '0x0') throw new Error('Transaction reverted on-chain');
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Confirmation timed out — check the explorer for the final status');
  }

  function provider() {
    const reown = window.TurboConnect?.getProvider?.();
    if (reown?.request) return reown;
    if (!window.ethereum?.request) throw new Error('No EVM wallet detected');
    return window.ethereum;
  }

  async function account() {
    const p = provider();
    const accounts = await p.request({ method: 'eth_requestAccounts' });
    if (!accounts?.[0]) throw new Error('No wallet account available');
    return accounts[0];
  }

  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 1200);
  const withSlippage = (amountOut, bps) => (amountOut * BigInt(10000 - bps)) / 10000n;

  function encodeSwap(tokenIn, tokenOut, fee, recipient, amountIn, minOut) {
    return SEL.exactInputSingle + addr(tokenIn) + addr(tokenOut) + u256(fee) + addr(recipient)
      + u256(deadline()) + u256(amountIn) + u256(minOut) + u256(0);
  }

  function encodeMulticall(calls) {
    const offsets = [];
    let running = 32 * calls.length;
    for (const c of calls) {
      offsets.push(running);
      running += 32 + Math.ceil(((c.length - 2) / 2) / 32) * 32;
    }
    const body = calls.map(c => {
      const bytes = c.slice(2);
      return u256(bytes.length / 2) + bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
    }).join('');
    return SEL.multicall + u256(0x20) + u256(calls.length) + offsets.map(u256).join('') + body;
  }

  /** Buy `token` with ETH. @returns {{hash, amountOut, fee}} */
  async function buy({ token, amountWei, slippageBps = 100, onStatus = () => {} }) {
    const p = provider();
    const from = await account();
    onStatus('Finding the best pool…');
    const { amountOut, fee } = await quote(WETH, token, amountWei);
    const minOut = withSlippage(amountOut, slippageBps);
    onStatus('Confirm the swap in your wallet…');
    const hash = await p.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: ROUTER, value: `0x${amountWei.toString(16)}`, data: encodeSwap(WETH, token, fee, from, amountWei, minOut) }],
    });
    onStatus('Swap sent — waiting for confirmation…');
    await waitReceipt(hash);
    return { hash, amountOut, fee };
  }

  /** Sell `token` for ETH (approve once, then swap + unwrap in one tx). */
  async function sell({ token, amountWei, slippageBps = 100, onStatus = () => {} }) {
    const p = provider();
    const from = await account();
    onStatus('Finding the best pool…');
    const { amountOut, fee } = await quote(token, WETH, amountWei);
    const minOut = withSlippage(amountOut, slippageBps);

    onStatus('Checking token approval…');
    const allowanceHex = await call(token, SEL.allowance + addr(from) + addr(ROUTER));
    if (BigInt(allowanceHex) < amountWei) {
      onStatus('Approve the token in your wallet (one-time)…');
      const approveHash = await p.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: token, data: SEL.approve + addr(ROUTER) + u256(amountWei) }],
      });
      onStatus('Approval sent — waiting for confirmation…');
      await waitReceipt(approveHash);
    }

    onStatus('Confirm the swap in your wallet…');
    const swapCall = encodeSwap(token, WETH, fee, ROUTER, amountWei, minOut); // router keeps WETH…
    const unwrapCall = SEL.unwrapWETH9 + u256(minOut) + addr(from);            // …then unwraps to your ETH
    const hash = await p.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: ROUTER, data: encodeMulticall([swapCall, unwrapCall]) }],
    });
    onStatus('Swap sent — waiting for confirmation…');
    await waitReceipt(hash);
    return { hash, amountOut, fee };
  }

  window.TurboSwap = { ROUTER, QUOTER, WETH, FEE_TIERS, quote, buy, sell, tokenMeta, balanceOf, parseUnits, formatUnits };
})();
