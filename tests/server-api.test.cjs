const assert = require('node:assert/strict');
const app = require('../server/index.js');

(async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[Test] Running backend tests on ${baseUrl}…`);

  try {
    // 1. Test Healthcheck
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'TurboPad API');

    // 2. Test Meme Battles: Initial state
    const battleRes = await fetch(`${baseUrl}/api/battles?a=BYTE&b=GLITCH`);
    assert.equal(battleRes.status, 200);
    const battle = await battleRes.json();
    assert.equal(battle.success, true);
    assert.equal(battle.data.tokenA, 'BYTE');
    assert.equal(battle.data.tokenB, 'GLITCH');
    const initialVotesA = battle.data.votesA;

    // 3. Test Meme Battles: Cast Vote
    const testVoter = `voter-${Date.now()}`;
    const voteRes = await fetch(`${baseUrl}/api/battles/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'BYTE', b: 'GLITCH', choice: 'BYTE', voterId: testVoter }),
    });
    assert.equal(voteRes.status, 200);
    const voteData = await voteRes.json();
    assert.equal(voteData.success, true);
    assert.equal(voteData.data.votesA, initialVotesA + 1);

    // 4. Test Meme Battles: Reject duplicate vote from same voter
    const dupVoteRes = await fetch(`${baseUrl}/api/battles/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'BYTE', b: 'GLITCH', choice: 'BYTE', voterId: testVoter }),
    });
    assert.equal(dupVoteRes.status, 409); // Conflict

    // 5. Test Deployed Tokens: Register & List
    const testAddress = '0x' + Math.random().toString(16).slice(2).padStart(40, '0').slice(0, 40);
    const registerRes = await fetch(`${baseUrl}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: testAddress,
        name: 'Automated Test Token',
        symbol: 'AUTO',
        supply: '1000000',
        txHash: '0x' + '9'.repeat(64),
        deployer: '0x' + '8'.repeat(40),
        chainId: 4663,
        testnet: false,
      }),
    });
    assert.equal(registerRes.status, 201);
    const registered = await registerRes.json();
    assert.equal(registered.success, true);
    assert.equal(registered.data.symbol, 'AUTO');

    const listRes = await fetch(`${baseUrl}/api/tokens`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.success, true);
    assert(list.data.some(t => t.address === testAddress.toLowerCase()));

    // 6. Test Watchlist Sync
    const testWallet = '0x' + Math.random().toString(16).slice(2).padStart(40, '0').slice(0, 40);
    const watchToggleRes = await fetch(`${baseUrl}/api/watchlist/${testWallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId: 'token-xyz' }),
    });
    assert.equal(watchToggleRes.status, 200);
    const toggled = await watchToggleRes.json();
    assert.equal(toggled.saved, true);

    const watchGetRes = await fetch(`${baseUrl}/api/watchlist/${testWallet}`);
    assert.equal(watchGetRes.status, 200);
    const watchList = await watchGetRes.json();
    assert(watchList.data.includes('token-xyz'));

    console.log('PASS: Health, battles, anti-spam vote, token registry, and watchlist API tests passed.');
  } finally {
    server.close();
  }
})().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
