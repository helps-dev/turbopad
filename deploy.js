/* TurboPad deploy layer: real, wallet-signed ERC-20 deployment.
   The user signs every transaction in their own wallet — TurboPad never
   touches private keys and never sends a transaction without an explicit
   wallet prompt. Testnet is the default; mainnet is opt-in upstream. */
(() => {
  const pad32 = value => value.toString(16).padStart(64, '0');

  /* ABI-encode (string, string, uint256) for the TurboToken constructor. */
  function encodeConstructor(name, symbol, supplyWei) {
    const nameBytes = new TextEncoder().encode(name);
    const symbolBytes = new TextEncoder().encode(symbol);
    const encodeString = bytes => {
      const body = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      const padded = body.padEnd(Math.ceil(body.length / 64) * 64 || 64, '0');
      return pad32(bytes.length) + padded;
    };
    const head = pad32(0x60) + pad32(0xa0) + pad32(supplyWei);
    return head + encodeString(nameBytes) + encodeString(symbolBytes);
  }

  const toHex = value => `0x${value.toString(16)}`;

  async function waitForReceipt(hash, testnet, timeoutMs = 180000) {
    const query = testnet ? TurboChain.testnetRpc : TurboChain.rpc;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const receipt = await query('eth_getTransactionReceipt', [hash]);
      if (receipt) {
        if (receipt.status === '0x0') throw new Error('Transaction reverted on-chain');
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    throw new Error('Confirmation timed out — check the explorer for the final status');
  }

  /**
   * Deploy a TurboToken. Always prompts the user's wallet for a signature.
   * @param {{name: string, symbol: string, supply: number|string, testnet?: boolean,
   *          onStatus?: (msg: string) => void}} options
   * @returns {Promise<{address: string, txHash: string, chainId: number, testnet: boolean}>}
   */
  async function deploy({ name, symbol, supply, testnet = true, onStatus = () => {} }) {
    const artifact = window.TurboTokenArtifact;
    if (!artifact?.bytecode) throw new Error('Token artifact not loaded');
    const provider = window.TurboConnect?.getProvider?.() || window.ethereum;
    if (!provider?.request) throw new Error('No EVM wallet detected');

    name = String(name || '').trim();
    symbol = String(symbol || '').trim().toUpperCase();
    if (!name || name.length > 40) throw new Error('Token name must be 1–40 characters');
    if (!/^[A-Za-z0-9]{1,10}$/.test(symbol)) throw new Error('Ticker must be 1–10 letters or digits');
    const supplyWei = BigInt(supply) * 10n ** 18n;
    if (supplyWei <= 0n) throw new Error('Supply must be greater than zero');

    onStatus('Preparing wallet on ' + (testnet ? 'Robinhood testnet' : 'Robinhood Chain mainnet') + '…');
    const target = await TurboChain.ensureRobinhood(testnet);
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const from = accounts?.[0];
    if (!from) throw new Error('No wallet account available');

    const data = `0x${artifact.bytecode}${encodeConstructor(name, symbol, supplyWei)}`;

    let gas = '0x2DC6C0'; // 3,000,000 fallback
    try {
      const estimated = await provider.request({ method: 'eth_estimateGas', params: [{ from, data }] });
      gas = toHex((BigInt(estimated) * 120n) / 100n); // +20% headroom
    } catch { /* keep fallback */ }

    onStatus('Waiting for your signature in the wallet…');
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, data, gas }],
    });

    onStatus('Transaction sent — waiting for confirmation…');
    const receipt = await waitForReceipt(txHash, testnet);
    if (!receipt.contractAddress) throw new Error('Confirmed but no contract address returned');

    return { address: receipt.contractAddress, txHash, chainId: target.chainId, testnet };
  }

  window.TurboDeploy = { deploy, encodeConstructor };
})();
