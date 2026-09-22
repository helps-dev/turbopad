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

  /* Open the wallet modal; resolves with {address, provider} or null if closed. */
  connect() {
    const m = ensureModal();
    return new Promise(resolve => {
      let settled = false;
      const finish = value => { if (!settled) { settled = true; unsubscribe?.(); resolve(value); } };
      const unsubscribe = m.subscribeAccount(account => {
        if (account?.isConnected && account.address) {
          finish({ address: account.address, provider: m.getWalletProvider() });
        }
      });
      m.open().then(() => finish(null)).catch(() => finish(null));
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
