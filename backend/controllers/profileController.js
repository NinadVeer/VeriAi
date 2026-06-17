/**
 * controllers/profileController.js
 * Handles GET /api/profile — returns the authenticated user's profile + stats.
 */

'use strict';

const { getUserByFirebaseId } = require('../models/userModel');
const { getUserHistory }      = require('../models/analysisModel');
const { getSupabaseClient }   = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const { logger } = require('../middleware/logger');

async function get(req, res, next) {
  try {
    const firebaseId = req.user.uid;

    // Fetch user record
    const user = await getUserByFirebaseId(firebaseId);
    if (!user) {
      return sendError(res, 'User profile not found', 404);
    }

    // Fetch usage statistics
    const supabase = getSupabaseClient();
    const { data: stats } = await supabase
      .from('analysis_results')
      .select('content_type')
      .eq('user_id', user.id);

    const contentTypeCounts = { text: 0, image: 0, video: 0 };
    if (stats) {
      stats.forEach(({ content_type }) => {
        if (contentTypeCounts[content_type] !== undefined) {
          contentTypeCounts[content_type]++;
        }
      });
    }

    logger.info('Profile fetched', { uid: firebaseId });

    return sendSuccess(res, {
      id:           user.id,
      email:        user.email,
      name:         user.name,
      memberSince:  user.created_at,
      usage: {
        total:  (stats || []).length,
        ...contentTypeCounts,
      },
    });
  } catch (err) {
    logger.error('Profile controller error', { error: err.message });
    next(err);
  }
}

module.exports = { get };
