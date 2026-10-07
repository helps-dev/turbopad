const express = require('express');
const router = express.Router();
const marketService = require('../services/marketService');

router.get('/meme', async (req, res) => {
  try {
    const markets = await marketService.getMemeMarkets();
    res.json({ success: true, count: markets.length, data: markets });
  } catch (error) {
    console.error('[API] /markets/meme error:', error.message);
    res.status(502).json({ success: false, error: error.message || 'Meme markets unavailable' });
  }
});

router.get('/rwa', async (req, res) => {
  try {
    const markets = await marketService.getRwaMarkets();
    res.json({ success: true, count: markets.length, data: markets });
  } catch (error) {
    console.error('[API] /markets/rwa error:', error.message);
    res.status(502).json({ success: false, error: error.message || 'RWA markets unavailable' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const [memeRes, rwaRes] = await Promise.allSettled([
      marketService.getMemeMarkets(),
      marketService.getRwaMarkets(),
    ]);
    const meme = memeRes.status === 'fulfilled' ? memeRes.value : [];
    const rwa = rwaRes.status === 'fulfilled' ? rwaRes.value : [];
    res.json({
      success: true,
      count: meme.length + rwa.length,
      data: [...meme, ...rwa],
      errors: {
        meme: memeRes.status === 'rejected' ? memeRes.reason?.message : null,
        rwa: rwaRes.status === 'rejected' ? rwaRes.reason?.message : null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({ success: true, count: 0, data: [] });
    }
    const results = await marketService.searchMarkets(query);
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('[API] /markets/search error:', error.message);
    res.status(502).json({ success: false, error: error.message || 'Search failed' });
  }
});

router.get('/ohlcv', async (req, res) => {
  try {
    const { chainId, pair, period = '24H' } = req.query;
    if (!chainId || !pair) {
      return res.status(400).json({ success: false, error: 'chainId and pair query params required' });
    }
    const candles = await marketService.getOhlcv(chainId, pair, period);
    res.json({ success: true, pair, period, data: candles });
  } catch (error) {
    console.error('[API] /markets/ohlcv error:', error.message);
    res.status(502).json({ success: false, error: error.message || 'Chart data unavailable' });
  }
});

router.get('/block', async (req, res) => {
  try {
    const block = await marketService.getRobinhoodBlock();
    res.json({ success: true, block, chain: 'Robinhood Chain', chainId: 4663 });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message || 'RPC unavailable' });
  }
});

module.exports = router;
