/**
 * middleware/validate.js
 * Request validation middleware using express-validator.
 *
 * Each exported function is an array of validation rules + a final
 * handleValidationErrors step that returns 422 if anything fails.
 */

'use strict';

const { body, validationResult } = require('express-validator');
const { sendError }              = require('../utils/responseFormatter');

// ── Generic error handler (must be last in any validation chain) ──────────────
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`);
    return sendError(res, messages.join('; '), 422);
  }
  next();
}

// ── Text analysis validation ──────────────────────────────────────────────────
const validateText = [
  body('text')
    .exists({ checkFalsy: true }).withMessage('text field is required')
    .isString().withMessage('text must be a string')
    .trim()
    .isLength({ min: 50 }).withMessage('text must be at least 50 characters')
    .isLength({ max: 50000 }).withMessage('text must not exceed 50,000 characters'),
  // Note: no .escape() — text is processed server-side only, never rendered as HTML
  handleValidationErrors,
];

// ── Image analysis validation (file already handled by multer) ────────────────
const validateImage = [
  // multer populates req.file; we just check it's present
  (req, res, next) => {
    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(req.file.mimetype)) {
      return sendError(res, `Unsupported image type: ${req.file.mimetype}. Allowed: JPG, PNG, WebP, GIF`, 415);
    }
    next();
  },
];

// ── Video analysis validation (file already handled by multer) ────────────────
const validateVideo = [
  (req, res, next) => {
    if (!req.file) {
      return sendError(res, 'No video file provided', 400);
    }
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowed.includes(req.file.mimetype)) {
      return sendError(res, `Unsupported video type: ${req.file.mimetype}. Allowed: MP4, WebM, MOV, AVI`, 415);
    }
    next();
  },
];

module.exports = { validateText, validateImage, validateVideo };
