/* TurboPad chain layer: real, read-only connection to Robinhood Chain mainnet.
   No transactions are ever sent from here — this module reads chain state and
   helps the user's wallet switch to the right network. */
(() => {
  const ROBINHOOD = {
    chainId: 4663,
    chainIdHex: '0x1237',
    name: 'Robinhood Chain',
    currency: 'ETH',
    // dRPC public gateway first (the official endpoint geo-blocks some regions),
    // official Robinhood endpoint as fallback.
    rpc: ['https://robinhood.drpc.org', 'https://rpc.mainnet.chain.robinhood.com'],
    explorer: 'https://robinhoodchain.blockscout.com',
  };
  const TESTNET = {
    chainId: 46630,
    chainIdHex: '0xB626',
    name: 'Robinhood Chain Testnet',
    currency: 'ETH',
    rpc: ['https://robinhood-testnet.drpc.org', 'https://rpc.testnet.chain.robinhood.com'],
    explorer: 'https://explorer.testnet.chain.robinhood.com',
  };

  async function rpcCall(endpoint, method, params, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.error) throw new Error(payload.error.message || 'RPC error');
      return payload.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async function rpc(method, params = []) {
    return rpcOn(ROBINHOOD.rpc, method, params);
  }

  async function rpcOn(endpoints, method, params = []) {
    let lastError = null;
    for (const endpoint of endpoints) {
      try { return await rpcCall(endpoint, method, params); }
      catch (error) { lastError = error; }
    }
    throw lastError || new Error('No reachable RPC endpoint');
  }

  async function testnetRpc(method, params = []) {
    return rpcOn(TESTNET.rpc, method, params);
  }

  async function latestBlock() {
    const hex = await rpc('eth_blockNumber');
    return parseInt(hex, 16);
  }

  async function getBalance(address) {
    const hex = await rpc('eth_getBalance', [address, 'latest']);
    return Number(BigInt(hex)) / 1e18;
  }

  function walletProvider() {
    const reown = window.TurboConnect?.getProvider?.();
    if (reown?.request) return reown;
    return window.ethereum?.request ? window.ethereum : null;
  }

  async function walletChainId() {
    const provider = walletProvider();
    if (!provider) return null;
    const hex = await provider.request({ method: 'eth_chainId' });
    return parseInt(hex, 16);
  }

  /* Ask the wallet to switch to Robinhood Chain, adding it if unknown. */
  async function ensureRobinhood(testnet = false) {
    const provider = walletProvider();
    if (!provider) throw new Error('No EVM wallet detected');
    const target = testnet ? TESTNET : ROBINHOOD;
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: target.chainIdHex }],
      });
    } catch (error) {
      if (error?.code !== 4902) throw error; // 4902 = chain not added yet
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: target.chainIdHex,
          chainName: target.name,
          nativeCurrency: { name: target.currency, symbol: target.currency, decimals: 18 },
          rpcUrls: target.rpc,
          blockExplorerUrls: [target.explorer],
        }],
      });
    }
    return target;
  }

  const explorerAddress = (address, testnet = false) =>
    `${testnet ? TESTNET.explorer : ROBINHOOD.explorer}/address/${address}`;
  const explorerTx = (hash, testnet = false) =>
    `${testnet ? TESTNET.explorer : ROBINHOOD.explorer}/tx/${hash}`;

  window.TurboChain = { ROBINHOOD, TESTNET, rpc, testnetRpc, latestBlock, getBalance, walletChainId, ensureRobinhood, explorerAddress, explorerTx };
})();
