/**
 * config/supabase.js
 * Initializes the Supabase client using the SERVICE ROLE key.
 *
 * IMPORTANT: The service role key bypasses Row Level Security.
 * It must NEVER be sent to the browser. It stays server-side only.
 * The frontend uses only the anon/publishable key for its own direct calls
 * (e.g., auth state sync). All analysis data goes through this backend.
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let _client;

function getSupabaseClient() {
  if (_client) return _client;

  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,   // Server-side — no session persistence
      autoRefreshToken: false,
    },
  });

  console.log('✅ Supabase client initialized');
  return _client;
}

module.exports = { getSupabaseClient };
