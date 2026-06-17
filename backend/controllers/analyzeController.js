/**
 * controllers/analyzeController.js
 * Handles all three analysis endpoints:
 *   POST /api/analyze/text
 *   POST /api/analyze/image
 *   POST /api/analyze/video
 *
 * Flow for each:
 *   1. Extract input from request
 *   2. Call the appropriate detector service
 *   3. Save result to Supabase via analysisModel
 *   4. Return structured JSON response
 */

'use strict';

const { analyzeText }  = require('../services/textDetector');
const { analyzeImage } = require('../services/imageDetector');
const { analyzeVideo } = require('../services/videoDetector');
const { createAnalysis } = require('../models/analysisModel');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { logger } = require('../middleware/logger');

// ── POST /api/analyze/text ────────────────────────────────────────────────────
async function text(req, res, next) {
  try {
    const { text: inputText } = req.body;
    const firebaseId = req.user.uid;

    logger.info('Text analysis requested', {
      uid:    firebaseId,
      length: inputText.length,
    });

    // Run detection
    const result = analyzeText(inputText);

    // Persist to Supabase (non-blocking on failure)
    try {
      await createAnalysis({
        firebaseId,
        contentType:     'text',
        result:          result.verdict,
        confidenceScore: result.confidence,
        details:         result,
      });
    } catch (dbErr) {
      logger.warn('Failed to persist text analysis', { error: dbErr.message });
      // Don't fail the request — detection succeeded
    }

    return sendSuccess(res, {
      type:   'text',
      result,
    });
  } catch (err) {
    logger.error('Text analysis controller error', { error: err.message });
    next(err);
  }
}

// ── POST /api/analyze/image ───────────────────────────────────────────────────
async function image(req, res, next) {
  try {
    const firebaseId = req.user.uid;
    const buffer     = req.file.buffer;
    const mimeType   = req.file.mimetype;

    // Optional dimension metadata sent from client
    const meta = {
      width:  parseInt(req.body.width,  10) || undefined,
      height: parseInt(req.body.height, 10) || undefined,
    };

    logger.info('Image analysis requested', {
      uid:      firebaseId,
      mimeType,
      sizeKB:   (buffer.length / 1024).toFixed(1),
    });

    // Run detection
    const result = analyzeImage(buffer, mimeType, meta);

    // Persist to Supabase
    try {
      await createAnalysis({
        firebaseId,
        contentType:     'image',
        result:          result.verdict,
        confidenceScore: result.confidence,
        details:         result,
        fileUrl:         null, // File stored in-memory only — set this if you add Supabase Storage
      });
    } catch (dbErr) {
      logger.warn('Failed to persist image analysis', { error: dbErr.message });
    }

    return sendSuccess(res, {
      type:   'image',
      result,
    });
  } catch (err) {
    logger.error('Image analysis controller error', { error: err.message });
    next(err);
  }
}

// ── POST /api/analyze/video ───────────────────────────────────────────────────
async function video(req, res, next) {
  try {
    const firebaseId = req.user.uid;
    const buffer     = req.file.buffer;
    const mimeType   = req.file.mimetype;

    // Optional metadata from client (duration in seconds, frame count)
    const meta = {
      duration:   parseFloat(req.body.duration)   || undefined,
      frameCount: parseInt(req.body.frameCount, 10) || undefined,
    };

    logger.info('Video analysis requested', {
      uid:     firebaseId,
      mimeType,
      sizeMB:  (buffer.length / (1024 * 1024)).toFixed(2),
    });

    // Run detection
    const result = analyzeVideo(buffer, mimeType, meta);

    // Persist to Supabase
    try {
      await createAnalysis({
        firebaseId,
        contentType:     'video',
        result:          result.verdict,
        confidenceScore: result.confidence,
        details:         result,
        fileUrl:         null,
      });
    } catch (dbErr) {
      logger.warn('Failed to persist video analysis', { error: dbErr.message });
    }

    return sendSuccess(res, {
      type:   'video',
      result,
    });
  } catch (err) {
    logger.error('Video analysis controller error', { error: err.message });
    next(err);
  }
}

module.exports = { text, image, video };
