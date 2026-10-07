const express = require('express');
const crypto = require('node:crypto');
const router = express.Router();
const db = require('../db');

function getVoterId(req, customVoterId) {
  if (customVoterId && typeof customVoterId === 'string' && customVoterId.trim()) {
    return customVoterId.trim().toLowerCase();
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 32);
}

router.get('/', (req, res) => {
  try {
    const { a, b } = req.query;
    if (!a || !b) {
      return res.status(400).json({ success: false, error: 'Parameters a and b are required' });
    }
    const battle = db.getBattle(String(a), String(b));
    const total = battle.votesA + battle.votesB;
    const shareA = total > 0 ? Math.round((battle.votesA / total) * 100) : 50;
    const shareB = 100 - shareA;

    res.json({
      success: true,
      data: {
        ...battle,
        totalVotes: total,
        shareA,
        shareB,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/vote', (req, res) => {
  try {
    const { a, b, choice, voterId } = req.body;
    if (!a || !b || !choice) {
      return res.status(400).json({ success: false, error: 'Fields a, b, and choice are required' });
    }
    if (choice !== a && choice !== b) {
      return res.status(400).json({ success: false, error: 'choice must match either a or b' });
    }

    const voter = getVoterId(req, voterId);
    const updated = db.castVote(String(a), String(b), String(choice), voter);
    const total = updated.votesA + updated.votesB;
    const shareA = total > 0 ? Math.round((updated.votesA / total) * 100) : 50;

    res.json({
      success: true,
      message: 'Vote recorded',
      data: {
        ...updated,
        totalVotes: total,
        shareA,
        shareB: 100 - shareA,
      },
    });
  } catch (error) {
    if (error.code === 'ALREADY_VOTED') {
      return res.status(409).json({ success: false, error: error.message, code: error.code });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
