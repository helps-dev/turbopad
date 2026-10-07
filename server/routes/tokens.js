const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const testnet = req.query.testnet !== undefined ? req.query.testnet === 'true' || req.query.testnet === '1' : null;
    const tokens = db.getDeployedTokens({ limit, testnet });
    res.json({ success: true, count: tokens.length, data: tokens });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { address, name, symbol, supply, txHash, deployer, chainId, testnet } = req.body;
    if (!address || !name || !symbol || !supply) {
      return res.status(400).json({
        success: false,
        error: 'Fields address, name, symbol, and supply are required',
      });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ success: false, error: 'Invalid EVM contract address' });
    }

    const saved = db.saveDeployedToken({
      address,
      name,
      symbol,
      supply,
      txHash,
      deployer,
      chainId: chainId || 4663,
      testnet: !!testnet,
    });

    res.status(201).json({
      success: true,
      message: 'Token registered successfully',
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
