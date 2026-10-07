const fs = require('node:fs');
const path = require('node:path');

const DB_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'turbopad.db');

let db = null;
let useNativeSqlite = false;

try {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  useNativeSqlite = true;
  console.log(`[Database] Connected to native SQLite at ${DB_PATH}`);
} catch (err) {
  console.warn('[Database] node:sqlite not available, falling back to in-memory store:', err.message);
}

// In-memory fallback if sqlite is unavailable
const memoryStore = {
  battles: new Map(),
  votes: new Set(),
  deployed_tokens: [],
  watchlists: new Map(), // wallet -> Set of tokenIds
};

if (useNativeSqlite) {
  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS battles (
      pair_id TEXT PRIMARY KEY,
      token_a TEXT NOT NULL,
      token_b TEXT NOT NULL,
      votes_a INTEGER NOT NULL DEFAULT 64,
      votes_b INTEGER NOT NULL DEFAULT 36,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      choice TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(pair_id, voter_id)
    );

    CREATE TABLE IF NOT EXISTS deployed_tokens (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      supply TEXT NOT NULL,
      tx_hash TEXT,
      deployer TEXT,
      chain_id INTEGER NOT NULL DEFAULT 4663,
      testnet INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlists (
      wallet TEXT NOT NULL,
      token_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (wallet, token_id)
    );
  `);
}

function getPairKey(a, b) {
  return [a, b].sort().join(':');
}

/* ================= Battle Functions ================= */

function getBattle(tokenA, tokenB) {
  const pairKey = getPairKey(tokenA, tokenB);
  if (useNativeSqlite) {
    const row = db.prepare('SELECT * FROM battles WHERE pair_id = ?').get(pairKey);
    if (row) {
      const isReversed = row.token_a !== tokenA;
      return {
        pairId: pairKey,
        tokenA,
        tokenB,
        votesA: isReversed ? row.votes_b : row.votes_a,
        votesB: isReversed ? row.votes_a : row.votes_b,
        updatedAt: row.updated_at,
      };
    }
    // Seed default baseline
    const now = Date.now();
    db.prepare('INSERT INTO battles (pair_id, token_a, token_b, votes_a, votes_b, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(pairKey, tokenA, tokenB, 64, 36, now);
    return { pairId: pairKey, tokenA, tokenB, votesA: 64, votesB: 36, updatedAt: now };
  } else {
    if (!memoryStore.battles.has(pairKey)) {
      memoryStore.battles.set(pairKey, { tokenA, tokenB, votesA: 64, votesB: 36, updatedAt: Date.now() });
    }
    const b = memoryStore.battles.get(pairKey);
    const isReversed = b.tokenA !== tokenA;
    return {
      pairId: pairKey,
      tokenA,
      tokenB,
      votesA: isReversed ? b.votesB : b.votesA,
      votesB: isReversed ? b.votesA : b.votesB,
      updatedAt: b.updatedAt,
    };
  }
}

function castVote(tokenA, tokenB, choice, voterId) {
  const pairKey = getPairKey(tokenA, tokenB);
  const now = Date.now();

  if (useNativeSqlite) {
    // Check if voter already voted for this pair
    const existing = db.prepare('SELECT id FROM votes WHERE pair_id = ? AND voter_id = ?').get(pairKey, voterId);
    if (existing) {
      const err = new Error('You have already voted in this battle round');
      err.code = 'ALREADY_VOTED';
      throw err;
    }

    // Ensure battle row exists
    getBattle(tokenA, tokenB);

    // Record vote
    db.prepare('INSERT INTO votes (pair_id, voter_id, choice, created_at) VALUES (?, ?, ?, ?)')
      .run(pairKey, voterId, choice, now);

    // Increment corresponding counter
    const row = db.prepare('SELECT token_a FROM battles WHERE pair_id = ?').get(pairKey);
    if (row.token_a === choice) {
      db.prepare('UPDATE battles SET votes_a = votes_a + 1, updated_at = ? WHERE pair_id = ?').run(now, pairKey);
    } else {
      db.prepare('UPDATE battles SET votes_b = votes_b + 1, updated_at = ? WHERE pair_id = ?').run(now, pairKey);
    }

    return getBattle(tokenA, tokenB);
  } else {
    const voteKey = `${pairKey}:${voterId}`;
    if (memoryStore.votes.has(voteKey)) {
      const err = new Error('You have already voted in this battle round');
      err.code = 'ALREADY_VOTED';
      throw err;
    }
    memoryStore.votes.add(voteKey);
    const b = getBattle(tokenA, tokenB);
    if (choice === tokenA) b.votesA += 1;
    else b.votesB += 1;
    b.updatedAt = now;
    return b;
  }
}

/* ================= Deployed Tokens Functions ================= */

function saveDeployedToken({ address, name, symbol, supply, txHash, deployer, chainId, testnet }) {
  const now = Date.now();
  const safeAddress = String(address).toLowerCase();
  if (useNativeSqlite) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO deployed_tokens (address, name, symbol, supply, tx_hash, deployer, chain_id, testnet, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      safeAddress,
      String(name || '').trim(),
      String(symbol || '').trim().toUpperCase(),
      String(supply || '0'),
      txHash || null,
      deployer ? String(deployer).toLowerCase() : null,
      Number(chainId) || 4663,
      testnet ? 1 : 0,
      now
    );
  } else {
    const existingIdx = memoryStore.deployed_tokens.findIndex(t => t.address === safeAddress);
    const tokenObj = {
      address: safeAddress,
      name,
      symbol: (symbol || '').toUpperCase(),
      supply,
      txHash,
      deployer,
      chainId: chainId || 4663,
      testnet: !!testnet,
      createdAt: now,
    };
    if (existingIdx >= 0) memoryStore.deployed_tokens[existingIdx] = tokenObj;
    else memoryStore.deployed_tokens.unshift(tokenObj);
  }
  return { address: safeAddress, name, symbol, supply, txHash, deployer, chainId, testnet, createdAt: now };
}

function getDeployedTokens({ limit = 50, testnet = null } = {}) {
  if (useNativeSqlite) {
    let query = 'SELECT * FROM deployed_tokens';
    const params = [];
    if (testnet !== null) {
      query += ' WHERE testnet = ?';
      params.push(testnet ? 1 : 0);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit) || 50);

    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      address: r.address,
      name: r.name,
      symbol: r.symbol,
      supply: r.supply,
      txHash: r.tx_hash,
      deployer: r.deployer,
      chainId: r.chain_id,
      testnet: Boolean(r.testnet),
      createdAt: r.created_at,
    }));
  } else {
    let list = memoryStore.deployed_tokens;
    if (testnet !== null) {
      list = list.filter(t => t.testnet === !!testnet);
    }
    return list.slice(0, limit);
  }
}

/* ================= Watchlist Sync Functions ================= */

function getWatchlist(wallet) {
  const safeWallet = String(wallet).toLowerCase();
  if (useNativeSqlite) {
    const rows = db.prepare('SELECT token_id FROM watchlists WHERE wallet = ? ORDER BY created_at DESC').all(safeWallet);
    return rows.map(r => r.token_id);
  } else {
    const set = memoryStore.watchlists.get(safeWallet) || new Set();
    return Array.from(set);
  }
}

function toggleWatchlist(wallet, tokenId) {
  const safeWallet = String(wallet).toLowerCase();
  const safeToken = String(tokenId);
  if (useNativeSqlite) {
    const existing = db.prepare('SELECT token_id FROM watchlists WHERE wallet = ? AND token_id = ?').get(safeWallet, safeToken);
    if (existing) {
      db.prepare('DELETE FROM watchlists WHERE wallet = ? AND token_id = ?').run(safeWallet, safeToken);
      return { saved: false, tokenId: safeToken };
    } else {
      db.prepare('INSERT INTO watchlists (wallet, token_id, created_at) VALUES (?, ?, ?)').run(safeWallet, safeToken, Date.now());
      return { saved: true, tokenId: safeToken };
    }
  } else {
    if (!memoryStore.watchlists.has(safeWallet)) {
      memoryStore.watchlists.set(safeWallet, new Set());
    }
    const set = memoryStore.watchlists.get(safeWallet);
    if (set.has(safeToken)) {
      set.delete(safeToken);
      return { saved: false, tokenId: safeToken };
    } else {
      set.add(safeToken);
      return { saved: true, tokenId: safeToken };
    }
  }
}

module.exports = {
  getBattle,
  castVote,
  saveDeployedToken,
  getDeployedTokens,
  getWatchlist,
  toggleWatchlist,
};
