/**
 * routes/analyze.js
 * REST routes for all content analysis endpoints.
 *
 * POST /api/analyze/text   → analyze text for AI generation
 * POST /api/analyze/image  → analyze image for AI generation
 * POST /api/analyze/video  → analyze video for deepfakes
 *
 * All routes are protected by requireAuth middleware.
 * Rate limiting applied at server level to /api/analyze/*
 */

'use strict';

const { Router }        = require('express');
const { requireAuth }   = require('../middleware/auth');
const { validateText, validateImage, validateVideo } = require('../middleware/validate');
const { handleImageUpload, handleVideoUpload }       = require('../middleware/upload');
const analyzeController = require('../controllers/analyzeController');

const router = Router();

// ── POST /api/analyze/text ────────────────────────────────────────────────────
router.post(
  '/text',
  requireAuth,
  ...validateText,
  analyzeController.text
);

// ── POST /api/analyze/image ───────────────────────────────────────────────────
router.post(
  '/image',
  requireAuth,
  handleImageUpload,   // multer parses multipart form data
  ...validateImage,
  analyzeController.image
);

// ── POST /api/analyze/video ───────────────────────────────────────────────────
router.post(
  '/video',
  requireAuth,
  handleVideoUpload,
  ...validateVideo,
  analyzeController.video
);

module.exports = router;
