/**
 * middleware/auth.js
 * Firebase ID token verification middleware.
 *
 * Usage: router.use(requireAuth) on any route that needs authentication.
 *
 * Flow:
 *  1. Extract "Bearer <token>" from the Authorization header.
 *  2. Verify the token with Firebase Admin SDK.
 *  3. Attach { uid, email, name } to req.user for downstream use.
 *  4. Upsert the user into Supabase so we always have a local record.
 */

'use strict';

const { getAuth }           = require('../config/firebase');
const { getSupabaseClient } = require('../config/supabase');
const { sendError }         = require('../utils/responseFormatter');
const { logger }            = require('./logger');

async function requireAuth(req, res, next) {
  try {
    // ── 1. Extract token ──────────────────────────────────────────────────────
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Missing or malformed Authorization header. Expected: Bearer <idToken>', 401);
    }

    const idToken = authHeader.slice(7); // Remove "Bearer " prefix

    // ── 2. Verify with Firebase Admin ─────────────────────────────────────────
    const firebaseAuth = getAuth();
    if (!firebaseAuth) {
      // Firebase Admin SDK not initialized (missing service account in dev)
      logger.error('Firebase Admin SDK not initialized — check FIREBASE_SERVICE_ACCOUNT_PATH');
      return sendError(res, 'Authentication service is not configured. Check server logs.', 503);
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (firebaseErr) {
      logger.warn('Firebase token verification failed', { error: firebaseErr.code });
      return sendError(res, 'Invalid or expired authentication token. Please sign in again.', 401);
    }

    // ── 3. Attach user info to request ────────────────────────────────────────
    req.user = {
      uid:   decodedToken.uid,
      email: decodedToken.email || '',
      name:  decodedToken.name  || decodedToken.email || 'Anonymous',
    };

    // ── 4. Upsert user into Supabase (ensure local DB record exists) ──────────
    try {
      const supabase = getSupabaseClient();
      const { error: upsertError } = await supabase
        .from('users')
        .upsert(
          {
            firebase_id: req.user.uid,
            email:       req.user.email,
            name:        req.user.name,
          },
          { onConflict: 'firebase_id', ignoreDuplicates: false }
        );

      if (upsertError) {
        // Non-fatal — log and continue. Don't block the request.
        logger.warn('Supabase user upsert failed', { error: upsertError.message });
      }
    } catch (dbErr) {
      logger.warn('Supabase upsert exception', { error: dbErr.message });
    }

    next();
  } catch (err) {
    logger.error('Unexpected error in auth middleware', { error: err.message });
    return sendError(res, 'Authentication error', 500);
  }
}

module.exports = { requireAuth };
