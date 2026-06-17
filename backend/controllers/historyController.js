/**
 * controllers/historyController.js
 * Handles GET /api/history — paginated analysis history for the signed-in user.
 */

'use strict';

const { getUserHistory } = require('../models/analysisModel');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { logger } = require('../middleware/logger');

async function list(req, res, next) {
  try {
    const firebaseId = req.user.uid;
    const page  = parseInt(req.query.page,  10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    if (page < 1 || limit < 1 || limit > 50) {
      return sendError(res, 'Invalid pagination parameters. page ≥ 1, limit 1–50.', 400);
    }

    const history = await getUserHistory(firebaseId, page, limit);

    logger.info('History fetched', { uid: firebaseId, page, total: history.total });

    return sendSuccess(res, history);
  } catch (err) {
    logger.error('History controller error', { error: err.message });
    next(err);
  }
}

module.exports = { list };
