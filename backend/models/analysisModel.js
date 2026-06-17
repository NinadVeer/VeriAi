/**
 * models/analysisModel.js
 * Supabase query wrappers for the `analysis_results` table.
 * All detection result persistence is centralized here.
 */

'use strict';

const { getSupabaseClient } = require('../config/supabase');
const { logger }            = require('../middleware/logger');

/**
 * Save an analysis result for an authenticated user.
 * @param {Object} params
 * @param {string} params.firebaseId    - Firebase UID (used to look up Supabase user.id)
 * @param {string} params.contentType   - 'text' | 'image' | 'video'
 * @param {string} params.result        - verdict string
 * @param {number} params.confidenceScore - 0–100 integer
 * @param {Object} params.details       - Full result object (stored as JSONB)
 * @param {string} [params.fileUrl]     - Optional URL if file was stored
 * @returns {Object} The inserted row
 */
async function createAnalysis({ firebaseId, contentType, result, confidenceScore, details, fileUrl }) {
  const supabase = getSupabaseClient();

  // Resolve Supabase user ID from Firebase UID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_id', firebaseId)
    .single();

  if (userError || !userData) {
    logger.error('analysisModel.createAnalysis — user not found', { firebaseId, error: userError?.message });
    throw new Error('User not found in database. Please sign in again.');
  }

  const { data, error } = await supabase
    .from('analysis_results')
    .insert([
      {
        user_id:          userData.id,
        content_type:     contentType,
        result,
        confidence_score: confidenceScore,
        details,
        file_url:         fileUrl || null,
      },
    ])
    .select()
    .single();

  if (error) {
    logger.error('analysisModel.createAnalysis insert error', { error: error.message });
    throw new Error(`Failed to save analysis: ${error.message}`);
  }

  logger.info('Analysis saved', { id: data.id, contentType, confidenceScore });
  return data;
}

/**
 * Get paginated analysis history for a user.
 * @param {string} firebaseId
 * @param {number} page   - 1-indexed page number
 * @param {number} limit  - results per page (max 50)
 * @returns {{ items: Array, total: number, page: number, limit: number }}
 */
async function getUserHistory(firebaseId, page = 1, limit = 20) {
  const supabase   = getSupabaseClient();
  const safePage   = Math.max(1, parseInt(page, 10));
  const safeLimit  = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset     = (safePage - 1) * safeLimit;

  // Get user ID
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_id', firebaseId)
    .single();

  if (!userData) return { items: [], total: 0, page: safePage, limit: safeLimit };

  const { data, error, count } = await supabase
    .from('analysis_results')
    .select('id, content_type, result, confidence_score, file_url, created_at', { count: 'exact' })
    .eq('user_id', userData.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + safeLimit - 1);

  if (error) {
    logger.error('analysisModel.getUserHistory error', { error: error.message });
    throw new Error(`Failed to fetch history: ${error.message}`);
  }

  return { items: data || [], total: count || 0, page: safePage, limit: safeLimit };
}

/**
 * Get a single analysis result by ID (only if it belongs to the user).
 */
async function getAnalysisById(firebaseId, analysisId) {
  const supabase = getSupabaseClient();

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('firebase_id', firebaseId)
    .single();

  if (!userData) return null;

  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', userData.id)
    .single();

  if (error) return null;
  return data;
}

module.exports = { createAnalysis, getUserHistory, getAnalysisById };
