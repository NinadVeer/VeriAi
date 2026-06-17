/**
 * middleware/upload.js
 * Multer configuration for image and video uploads.
 *
 * Files are stored in MEMORY (not on disk) as Buffer objects accessible
 * via req.file.buffer. This avoids disk I/O and simplifies cleanup.
 *
 * Limits:
 *   - Images: 20 MB max
 *   - Videos: 200 MB max
 */

'use strict';

const multer = require('multer');
const { sendError } = require('../utils/responseFormatter');

// In-memory storage — req.file.buffer contains the raw bytes
const storage = multer.memoryStorage();

// ── Image upload ──────────────────────────────────────────────────────────────
const imageUpload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image format: ${file.mimetype}`));
    }
  },
}).single('file'); // Frontend must send file in a field named "file"

// ── Video upload ──────────────────────────────────────────────────────────────
const videoUpload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported video format: ${file.mimetype}`));
    }
  },
}).single('file');

// ── Wrap multer in error-handling middleware ───────────────────────────────────
// Multer errors don't propagate to Express error handler automatically.
function handleImageUpload(req, res, next) {
  imageUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'Image file too large. Maximum size is 20 MB.', 413);
    }
    return sendError(res, err.message || 'File upload error', 400);
  });
}

function handleVideoUpload(req, res, next) {
  videoUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'Video file too large. Maximum size is 200 MB.', 413);
    }
    return sendError(res, err.message || 'File upload error', 400);
  });
}

module.exports = { handleImageUpload, handleVideoUpload };
