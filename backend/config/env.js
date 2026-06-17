/**
 * config/env.js
 * Loads .env and validates all required environment variables on startup.
 * The server will crash immediately with a clear message if anything is missing.
 */

'use strict';

require('dotenv').config();

// Only Supabase vars are hard-required — Firebase path is validated at init time
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('\n❌  Missing required environment variables:\n');
  missing.forEach((key) => console.error(`   • ${key}`));
  console.error('\n   Copy backend/.env.example → backend/.env and fill in your values.\n');
  process.exit(1);
}

// Warn when SERVICE KEY is still the placeholder (common mistake)
if (process.env.SUPABASE_SERVICE_KEY === 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE') {
  console.warn('\n⚠️  SUPABASE_SERVICE_KEY is still the placeholder value.');
  console.warn('   Replace it with your real service role key from:');
  console.warn('   Supabase Dashboard → Settings → API → service_role key\n');
}

module.exports = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5500',

  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebase-service-account.json',

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
};
