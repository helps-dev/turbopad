/* TurboPad deploy layer: real, wallet-signed ERC-20 deployment.
   Ported from Web/dist/deploy.js.

   TurboToken has no owner, no mint after deploy, no pause and no blacklist —
   that is a deliberate safety property we can prove, and something a launchpad
   that merely routes to a third party cannot promise.

   The user signs every transaction. Testnet is the default; mainnet is opt-in. */
import { TOKEN_ABI, TOKEN_BYTECODE } from './token-artifact.ts';
import { networkFor, rpcOn } from './chain.ts';
import { encodeConstructor } from './abi.ts';
import { requestAccounts, ensureRobinhood, type Eip1193Provider } from './wallet.ts';

export const TOKEN_ARTIFACT = { abi: TOKEN_ABI, bytecode: TOKEN_BYTECODE };

/** Fixed-supply ERC-20 with no privileged functions. Surfaced to the UI. */
export const TOKEN_GUARANTEES: readonly string[] = [
  'Fixed supply — no mint after deploy',
  'No owner or admin functions',
  'No pause, no blacklist, no transfer tax',
];

const MAX_NAME = 40;
const MAX_SYMBOL = 10;

export interface TokenDraft {
  name: string;
  symbol: string;
  supply: string | number | bigint;
}

export interface NormalisedDraft {
  name: string;
  symbol: string;
  supplyWei: bigint;
}

/** Validate and normalise user input. Pure, so it is unit-testable. */
export function normaliseDraft({ name, symbol, supply }: TokenDraft): NormalisedDraft {
  const cleanName = String(name ?? '').trim();
  const cleanSymbol = String(symbol ?? '').trim().toUpperCase();
  if (!cleanName || cleanName.length > MAX_NAME) {
    throw new Error(`Token name must be 1–${MAX_NAME} characters`);
  }
  if (!new RegExp(`^[A-Z0-9]{1,${MAX_SYMBOL}}$`).test(cleanSymbol)) {
    throw new Error(`Ticker must be 1–${MAX_SYMBOL} letters or digits`);
  }
  const whole = String(supply ?? '').trim();
  if (!/^\d+$/.test(whole)) throw new Error('Supply must be a whole number');
  const supplyWei = BigInt(whole) * 10n ** 18n;
  if (supplyWei <= 0n) throw new Error('Supply must be greater than zero');
  return { name: cleanName, symbol: cleanSymbol, supplyWei };
}

/** Full deployment calldata: creation bytecode + encoded constructor args. */
export function deployData(draft: NormalisedDraft): string {
  return `0x${TOKEN_ARTIFACT.bytecode}${encodeConstructor(draft.name, draft.symbol, draft.supplyWei)}`;
}

const toHex = (value: bigint): string => `0x${value.toString(16)}`;
const GAS_FALLBACK = '0x2DC6C0'; // 3,000,000

interface Receipt {
  status?: string;
  contractAddress?: string;
}

async function waitForReceipt(hash: string, testnet: boolean, timeoutMs = 180_000): Promise<Receipt> {
  const endpoints = networkFor(testnet).rpc;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const receipt = await rpcOn<Receipt | null>(endpoints, 'eth_getTransactionReceipt', [hash]);
    if (receipt) {
      if (receipt.status === '0x0') throw new Error('Transaction reverted on-chain');
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('Confirmation timed out — check the explorer for the final status');
}

export interface DeployOptions extends TokenDraft {
  provider: Eip1193Provider;
  testnet?: boolean;
  onStatus?: (message: string) => void;
}

export interface DeployResult {
  address: string;
  txHash: string;
  chainId: number;
  testnet: boolean;
}

export async function deploy({
  provider, name, symbol, supply, testnet = true, onStatus = () => {},
}: DeployOptions): Promise<DeployResult> {
  if (!TOKEN_ARTIFACT?.bytecode) throw new Error('Token artifact not loaded');
  const draft = normaliseDraft({ name, symbol, supply });

  onStatus(`Preparing wallet on ${testnet ? 'Robinhood testnet' : 'Robinhood Chain mainnet'}…`);
  const target = await ensureRobinhood(provider, testnet);
  const from = await requestAccounts(provider);
  const data = deployData(draft);

  let gas = GAS_FALLBACK;
  try {
    const estimated = await provider.request<string>({
      method: 'eth_estimateGas',
      params: [{ from, data }],
    });
    gas = toHex((BigInt(estimated) * 120n) / 100n); // +20% headroom
  } catch {
    /* keep the fallback */
  }

  onStatus('Waiting for your signature in the wallet…');
  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [{ from, data, gas }],
  });

  onStatus('Transaction sent — waiting for confirmation…');
  const receipt = await waitForReceipt(txHash, testnet);
  if (!receipt.contractAddress) throw new Error('Confirmed but no contract address returned');

  return { address: receipt.contractAddress, txHash, chainId: target.chainId, testnet };
}
