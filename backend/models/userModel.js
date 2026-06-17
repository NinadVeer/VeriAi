/**
 * models/userModel.js
 * Supabase query wrappers for the `users` table.
 * All database operations for users are centralized here.
 */

'use strict';

const { getSupabaseClient } = require('../config/supabase');
const { logger }            = require('../middleware/logger');

/**
 * Upsert a user record (insert or update on firebase_id conflict).
 * Called automatically from auth middleware on every authenticated request.
 */
async function upsertUser({ firebaseId, email, name }) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { firebase_id: firebaseId, email, name },
      { onConflict: 'firebase_id' }  // `returning` removed — deprecated in Supabase v2
    )
    .select()
    .single();

  if (error) {
    logger.error('userModel.upsertUser error', { error: error.message });
    throw new Error(`Failed to upsert user: ${error.message}`);
  }
  return data;
}

/**
 * Get the internal Supabase user record by Firebase UID.
 * Returns null if not found.
 */
async function getUserByFirebaseId(firebaseId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, created_at')
    .eq('firebase_id', firebaseId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
    logger.error('userModel.getUserByFirebaseId error', { error: error.message });
    throw new Error(`Failed to fetch user: ${error.message}`);
  }
  return data || null;
}

/**
 * Get a user's profile including their analysis stats.
 * Fixed: was using a broken nested subquery — now uses sequential queries.
 */
async function getUserProfile(firebaseId) {
  const supabase = getSupabaseClient();

  // Step 1: Get the user record
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, name, created_at')
    .eq('firebase_id', firebaseId)
    .single();

  if (userError) {
    if (userError.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch profile: ${userError.message}`);
  }

  if (!userData) return null;

  // Step 2: Count their analyses
  const { count, error: countError } = await supabase
    .from('analysis_results')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userData.id);

  if (countError) {
    logger.warn('userModel.getUserProfile count error', { error: countError.message });
  }

  return {
    ...userData,
    totalAnalyses: count || 0,
  };
}

module.exports = { upsertUser, getUserByFirebaseId, getUserProfile };

