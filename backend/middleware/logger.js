/**
 * middleware/logger.js
 * Winston-based structured request logger.
 * - Development: colorized console output
 * - Production:  JSON logs written to logs/combined.log + logs/error.log
 */

'use strict';

const winston = require('winston');
const env     = require('../config/env');

const { combine, timestamp, colorize, printf, json } = winston.format;

// ── Console format (dev) ──────────────────────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// ── JSON format (production) ──────────────────────────────────────────────────
const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level: env.IS_PRODUCTION ? 'info' : 'debug',
  format: env.IS_PRODUCTION ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(env.IS_PRODUCTION
      ? [
          new winston.transports.File({ filename: 'logs/error.log',    level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log'               }),
        ]
      : []),
  ],
});

// ── Express request-logging middleware ────────────────────────────────────────
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level    = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info';
    logger[level](`${req.method} ${req.originalUrl}`, {
      status:   res.statusCode,
      duration: `${duration}ms`,
      ip:       req.ip,
    });
  });
  next();
}

module.exports = { logger, requestLogger };
