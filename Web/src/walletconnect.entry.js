/* TurboPad wallet entry — Reown AppKit (WalletConnect) integration.
   Bundled locally by esbuild (scripts: npm run build:wallet) so the site
   has zero runtime CDN dependency for wallet connections.
   Exposes window.TurboConnect used by app.js / chain.js. */
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';

const PROJECT_ID = 'f03c866a8282707d399c591136099922';

const robinhood = defineChain({
  id: 4663,
  caipNetworkId: 'eip155:4663',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://robinhood.drpc.org'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' } },
});

const robinhoodTestnet = defineChain({
  id: 46630,
  caipNetworkId: 'eip155:46630',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://robinhood-testnet.drpc.org'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
});

let modal = null;

function ensureModal() {
  if (modal) return modal;
  modal = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [robinhood, robinhoodTestnet],
    metadata: {
      name: 'TurboPad',
      description: 'TurboPad — terminal & launchpad on Robinhood Chain',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.png`],
    },
    projectId: PROJECT_ID,
    // Popular wallets pinned to the first screen; the "All Wallets" view
    // still offers hundreds more via the WalletConnect explorer.
    featuredWalletIds: [
      'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
      '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
    ],
    features: { analytics: false, email: false, socials: false },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': '#d9af79',
      '--w3m-color-accent': '#d9af79',
      '--w3m-border-radius-master': '2px',
    },
  });
  return modal;
}

window.TurboConnect = {
  ready: true,

  /* Open the wallet modal; resolves with {address, provider} when the user
     connects, or null when the modal is closed without connecting. */
  connect() {
    const m = ensureModal();
    // Already connected from a previous session? Return immediately.
    try {
      const existing = m.getAddress?.();
      if (existing) return Promise.resolve({ address: existing, provider: m.getWalletProvider() });
    } catch { /* fall through to modal flow */ }
    return new Promise(resolve => {
      let settled = false;
      let unsubAccount, unsubEvents;
      const finish = value => {
        if (settled) return;
        settled = true;
        unsubAccount?.();
        unsubEvents?.();
        resolve(value);
      };
      unsubAccount = m.subscribeAccount(account => {
        if (account?.isConnected && account.address) {
          finish({ address: account.address, provider: m.getWalletProvider() });
        }
      });
      unsubEvents = m.subscribeEvents(event => {
        const name = event?.name || event?.data?.event;
        if (name === 'MODAL_CLOSE') finish(null);
      });
      // NOTE: open() resolves when the modal OPENS, not when it closes —
      // never use it to detect the end of the flow.
      m.open().catch(() => finish(null));
    });
  },

  getProvider() {
    try { return modal?.getWalletProvider() || null; } catch { return null; }
  },

  getAddress() {
    try { return modal?.getAddress?.() || null; } catch { return null; }
  },

  async disconnect() {
    try { await modal?.disconnect(); } catch { /* already disconnected */ }
  },
};
