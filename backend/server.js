'use strict';

// ── Must be first — validates all required env vars ───────────────────────────
const env = require('./config/env');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { requestLogger, logger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');

const analyzeRoutes = require('./routes/analyze');
const historyRoutes = require('./routes/history');
const profileRoutes = require('./routes/profile');

const app = express();

// ── 1. Security Headers (Helmet) ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow frontend to fetch files
  contentSecurityPolicy: false, // CSP handled by frontend HTML
}));

// ── 2. CORS ───────────────────────────────────────────────────────────────────
// Build allowed origins: configured origin + localhost/127.0.0.1 variants
const allowedOrigins = new Set([
  env.CORS_ORIGIN,
  env.CORS_ORIGIN.replace('localhost', '127.0.0.1'),
  env.CORS_ORIGIN.replace('127.0.0.1', 'localhost'),
]);

app.use(cors({
  origin(origin, callback) {
    // Allow no-origin requests (Postman, curl) in dev
    if (!origin && !env.IS_PRODUCTION) return callback(null, true);
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));


// ── 3. Request Logging ────────────────────────────────────────────────────────
app.use(requestLogger);

// ── 4. Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));           // JSON bodies (text analysis)
app.use(express.urlencoded({ extended: true }));    // Form data (file metadata fields)

// ── 5. Rate Limiting on Analysis Routes ──────────────────────────────────────
const analyzeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please wait before submitting another analysis.' },
    timestamp: new Date().toISOString(),
  },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,       // 120 general requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/analyze', analyzeLimiter);

// ── 6. Mount Routes ───────────────────────────────────────────────────────────
app.use('/api/analyze', analyzeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/profile', profileRoutes);

// ── 7. Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'VeriAI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  });
});

// ── 8. API Root Info ──────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    service: 'VeriAI Detection API',
    version: '1.0.0',
    endpoints: [
      'POST /api/analyze/text',
      'POST /api/analyze/image',
      'POST /api/analyze/video',
      'GET  /api/history',
      'GET  /api/profile',
      'GET  /health',
    ],
  });
});

// ── 9. 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found' },
    timestamp: new Date().toISOString(),
  });
});

// ── 10. Global Error Handler (must be last) ───────────────────────────────────
app.use(errorHandler);

// ── 11. Start Server ──────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  logger.info(`\n🚀 VeriAI Backend running on http://localhost:${env.PORT}`);
  logger.info(`   Environment : ${env.NODE_ENV}`);
  logger.info(`   CORS origin : ${env.CORS_ORIGIN}`);
  logger.info(`   Rate limit  : ${env.RATE_LIMIT_MAX} req / ${env.RATE_LIMIT_WINDOW_MS / 1000}s\n`);
});

module.exports = app; // Export for testing
