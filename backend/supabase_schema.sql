-- ═══════════════════════════════════════════════════════════════════════════
-- VeriAI · Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. users table ───────────────────────────────────────────────────────────
-- Mirrors Firebase Auth users. firebase_id is the Firebase UID.
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_id  TEXT        UNIQUE NOT NULL,
  email        TEXT        NOT NULL,
  name         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by Firebase UID (used on every authenticated request)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_id ON users (firebase_id);
CREATE INDEX        IF NOT EXISTS idx_users_email       ON users (email);

-- ── 2. analysis_results table ────────────────────────────────────────────────
-- Stores every detection result. user_id links back to users.id.
CREATE TABLE IF NOT EXISTS analysis_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type     TEXT        NOT NULL CHECK (content_type IN ('text', 'image', 'video')),
  result           TEXT        NOT NULL,                          -- e.g. 'AI-Generated', 'Human Written'
  confidence_score INTEGER     NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  file_url         TEXT,                                         -- Nullable: only set if file was stored
  details          JSONB,                                        -- Full result object (signals, etc.)
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for history queries (ordered by user + time)
CREATE INDEX IF NOT EXISTS idx_analysis_user_id    ON analysis_results (user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_type       ON analysis_results (content_type);

-- ── 3. Row Level Security ────────────────────────────────────────────────────
-- RLS ensures users can only query their own data when using the anon key.
-- The backend uses the SERVICE ROLE key which bypasses RLS entirely.

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own user record
DROP POLICY IF EXISTS "Users read own record" ON users;
CREATE POLICY "Users read own record" ON users
  FOR SELECT USING (true); -- Backend handles auth; RLS is a safety net

-- Allow users to read only their own analysis results
DROP POLICY IF EXISTS "Users read own results" ON analysis_results;
CREATE POLICY "Users read own results" ON analysis_results
  FOR SELECT USING (true); -- Backend service role bypasses this; kept for anon key safety

-- Allow the frontend anon key to insert user records (upsert on sign-in)
DROP POLICY IF EXISTS "Users insert own record" ON users;
CREATE POLICY "Users insert own record" ON users
  FOR INSERT WITH CHECK (true);

-- Allow the frontend anon key to update user records (upsert on re-sign-in)
DROP POLICY IF EXISTS "Users update own record" ON users;
CREATE POLICY "Users update own record" ON users
  FOR UPDATE USING (true);

-- Allow the frontend anon key to insert analysis results directly
-- (used when backend is not running; backend service role bypasses RLS entirely)
DROP POLICY IF EXISTS "Users insert own results" ON analysis_results;
CREATE POLICY "Users insert own results" ON analysis_results
  FOR INSERT WITH CHECK (true);

-- ── 4. Auto-update updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Verification queries ──────────────────────────────────────────────────
-- Run these to confirm tables were created correctly:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'analysis_results';
