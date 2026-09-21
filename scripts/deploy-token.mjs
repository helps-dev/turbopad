/* Deploy TurboToken to Robinhood Chain from the CLI, signed by the key in .env.

   Usage:
     node scripts/deploy-token.mjs --name "Turbo Cat" --symbol TCAT --supply 1000000000 --testnet
     node scripts/deploy-token.mjs --name "Turbo Cat" --symbol TCAT --supply 1000000000 --mainnet --yes

   Safety rules baked in:
   - --testnet is the DEFAULT network; mainnet requires BOTH --mainnet and --yes.
   - The private key is read from .env only, never printed, never sent anywhere
     except as a locally-signed raw transaction to the chain RPC. */
import { readFileSync } from 'node:fs';
import { JsonRpcProvider, Wallet, ContractFactory, parseUnits, formatEther } from 'ethers';

const CHAINS = {
  testnet: { chainId: 46630, rpc: 'https://robinhood-testnet.drpc.org', explorer: 'https://explorer.testnet.chain.robinhood.com' },
  mainnet: { chainId: 4663, rpc: 'https://robinhood.drpc.org', explorer: 'https://robinhoodchain.blockscout.com' },
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}
const has = name => process.argv.includes(`--${name}`);

function loadKey() {
  let env = '';
  try { env = readFileSync('.env', 'utf8'); } catch { /* fall through to process.env */ }
  const fromFile = env.match(/^TURBOPAD_DEPLOYER_KEY=(.+)$/m)?.[1]?.trim();
  const key = fromFile || process.env.TURBOPAD_DEPLOYER_KEY || '';
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.error('ERROR: TURBOPAD_DEPLOYER_KEY missing or invalid. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  return key;
}

const name = arg('name')?.trim();
const symbol = arg('symbol')?.trim().toUpperCase();
const supply = arg('supply');
const testnet = !has('mainnet');

if (!name || name.length > 40 || !/^[A-Za-z0-9]{1,10}$/.test(symbol || '') || !/^\d+$/.test(supply || '') || BigInt(supply || 0) <= 0n) {
  console.error('Usage: node scripts/deploy-token.mjs --name "Token Name" --symbol TICKER --supply 1000000000 [--testnet|--mainnet --yes]');
  process.exit(1);
}
if (!testnet && !has('yes')) {
  console.error('Mainnet deploy refused: re-run with --yes to confirm you are spending REAL ETH on gas with an UNAUDITED contract.');
  process.exit(1);
}

const chain = testnet ? CHAINS.testnet : CHAINS.mainnet;
const artifact = JSON.parse(readFileSync('contracts/TurboToken.artifact.json', 'utf8'));

const provider = new JsonRpcProvider(chain.rpc, chain.chainId, { staticNetwork: true });
const wallet = new Wallet(loadKey(), provider);

console.log(`Network : ${testnet ? 'Robinhood Chain TESTNET' : 'Robinhood Chain MAINNET'} (chainId ${chain.chainId})`);
console.log(`Deployer: ${wallet.address}`);
console.log(`Token   : ${name} ($${symbol}), supply ${Number(supply).toLocaleString('en-US')} · 18 decimals`);

const balance = await provider.getBalance(wallet.address);
console.log(`Balance : ${formatEther(balance)} ETH`);
if (balance === 0n) {
  console.error('ERROR: deployer has 0 ETH. Fund it first (testnet: use the faucet).');
  process.exit(1);
}

const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
const deployTx = await factory.getDeployTransaction(name, symbol, parseUnits(supply, 18));
const estimated = await provider.estimateGas({ ...deployTx, from: wallet.address });
const fee = await provider.getFeeData();
console.log(`Gas est : ${estimated} units · gas price ${fee.gasPrice} wei · worst-case ${formatEther(estimated * (fee.gasPrice ?? 1n))} ETH`);

console.log('Sending deployment transaction…');
const contract = await factory.deploy(name, symbol, parseUnits(supply, 18));
const receipt = await contract.deploymentTransaction().wait();

console.log('\n✓ DEPLOYED');
console.log(`Contract : ${await contract.getAddress()}`);
console.log(`Tx hash  : ${receipt.hash}`);
console.log(`Block    : ${receipt.blockNumber}`);
console.log(`Gas used : ${receipt.gasUsed} (${formatEther(receipt.gasUsed * receipt.gasPrice)} ETH)`);
console.log(`Explorer : ${chain.explorer}/address/${await contract.getAddress()}`);
