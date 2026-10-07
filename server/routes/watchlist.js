const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;
    if (!wallet) return res.status(400).json({ success: false, error: 'Wallet address required' });
    const items = db.getWatchlist(wallet);
    res.json({ success: true, wallet, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:wallet', (req, res) => {
  try {
    const { wallet } = req.params;
    const { tokenId } = req.body;
    if (!wallet || !tokenId) {
      return res.status(400).json({ success: false, error: 'Wallet and tokenId are required' });
    }
    const result = db.toggleWatchlist(wallet, tokenId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
