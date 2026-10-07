const express = require('express');
const cors = require('cors');
const path = require('node:path');

const marketsRouter = require('./routes/markets');
const battlesRouter = require('./routes/battles');
const tokensRouter = require('./routes/tokens');
const watchlistRouter = require('./routes/watchlist');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS for frontend clients
app.use(cors());
app.use(express.json());

// Request logging in development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      const ms = Date.now() - start;
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TurboPad API',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/markets', marketsRouter);
app.use('/api/battles', battlesRouter);
app.use('/api/tokens', tokensRouter);
app.use('/api/watchlist', watchlistRouter);

// Serve static frontend files from Web/dist
const STATIC_DIR = path.resolve(__dirname, '../Web/dist');
app.use(express.static(STATIC_DIR));

// SPA Fallback: non-API GET routes return index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(STATIC_DIR, 'index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`
=====================================================
  ◈ TurboPad Backend Server Running
  ◈ Local URL:   http://localhost:${PORT}
  ◈ API Health:  http://localhost:${PORT}/api/health
  ◈ Serving UI:  ${STATIC_DIR}
=====================================================
`);
  });
}

module.exports = app;
