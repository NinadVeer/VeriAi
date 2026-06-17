/**
 * middleware/errorHandler.js
 * Global Express error handler — must be the LAST middleware registered.
 *
 * Catches all errors thrown via next(err) or unhandled promise rejections
 * and formats them as consistent JSON. Never leaks stack traces in production.
 */

'use strict';

const env    = require('../config/env');
const { logger } = require('./logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Determine status code
  const status = err.status || err.statusCode || 500;

  // Log the error with full details server-side
  logger.error(`Unhandled error: ${err.message}`, {
    status,
    stack:  err.stack,
    method: req.method,
    path:   req.originalUrl,
  });

  // Build response — strip stack trace in production
  const response = {
    success: false,
    error: {
      message: status < 500 ? err.message : 'Internal server error',
      ...(env.IS_PRODUCTION ? {} : { stack: err.stack }),
    },
  };

  res.status(status).json(response);
}

// ── Catch unhandled promise rejections across the whole process ───────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err.message });
  process.exit(1);
});

module.exports = { errorHandler };
