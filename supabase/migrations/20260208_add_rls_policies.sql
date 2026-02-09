-- Add Row Level Security policies for all user tables
-- CRITICAL SECURITY FIX: Prevent unauthorized access to user data

-- ========================================
-- WRONG_WORDS TABLE
-- ========================================
ALTER TABLE wrong_words ENABLE ROW LEVEL SECURITY;

-- Users can only read their own wrong words
CREATE POLICY "Users can read own wrong words"
  ON wrong_words
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can only insert their own wrong words
CREATE POLICY "Users can insert own wrong words"
  ON wrong_words
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can only update their own wrong words
CREATE POLICY "Users can update own wrong words"
  ON wrong_words
  FOR UPDATE
  USING (
    email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can only delete their own wrong words
CREATE POLICY "Users can delete own wrong words"
  ON wrong_words
  FOR DELETE
  USING (
    email = auth.jwt() ->> 'email'
  );

-- ========================================
-- ATTENDANCE TABLE
-- ========================================
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Users can only read their own attendance
CREATE POLICY "Users can read own attendance"
  ON attendance
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can only insert their own attendance
CREATE POLICY "Users can insert own attendance"
  ON attendance
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can only update their own attendance
CREATE POLICY "Users can update own attendance"
  ON attendance
  FOR UPDATE
  USING (
    email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- ========================================
-- RESULTS TABLE (legacy)
-- ========================================
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Users can only read their own results
CREATE POLICY "Users can read own results"
  ON results
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can only insert their own results
CREATE POLICY "Users can insert own results"
  ON results
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- ========================================
-- SUBSCRIBER_SETTINGS TABLE
-- ========================================
ALTER TABLE subscriber_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own settings
CREATE POLICY "Users can read own settings"
  ON subscriber_settings
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can only insert their own settings
CREATE POLICY "Users can insert own settings"
  ON subscriber_settings
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can only update their own settings
CREATE POLICY "Users can update own settings"
  ON subscriber_settings
  FOR UPDATE
  USING (
    email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- ========================================
-- SUBSCRIBERS TABLE
-- ========================================
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscriber record
CREATE POLICY "Users can read own subscriber record"
  ON subscribers
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can insert their own subscriber record during signup
CREATE POLICY "Users can insert own subscriber record"
  ON subscribers
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can only update their own subscriber record
CREATE POLICY "Users can update own subscriber record"
  ON subscribers
  FOR UPDATE
  USING (
    email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- ========================================
-- WORDS TABLE (Read-only for all authenticated users)
-- ========================================
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read words
CREATE POLICY "Authenticated users can read words"
  ON words
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IS NOT NULL
  );

-- Only service role can modify words (admin operations)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ========================================
-- CONFIG TABLE (Read-only for all authenticated users)
-- ========================================
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read config
CREATE POLICY "Authenticated users can read config"
  ON config
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IS NOT NULL
  );

-- Only service role can modify config (admin operations)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ========================================
-- KAKAO_USERS TABLE
-- ========================================
ALTER TABLE kakao_users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own kakao user record
CREATE POLICY "Users can read own kakao user"
  ON kakao_users
  FOR SELECT
  USING (
    email = auth.jwt() ->> 'email'
  );

-- Users can insert their own kakao user record
CREATE POLICY "Users can insert own kakao user"
  ON kakao_users
  FOR INSERT
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

-- Users can update their own kakao user record
CREATE POLICY "Users can update own kakao user"
  ON kakao_users
  FOR UPDATE
  USING (
    email = auth.jwt() ->> 'email'
  )
  WITH CHECK (
    email = auth.jwt() ->> 'email'
  );

COMMENT ON POLICY "Users can read own wrong words" ON wrong_words IS 'RLS: Users can only access their own wrong words';
COMMENT ON POLICY "Users can read own attendance" ON attendance IS 'RLS: Users can only access their own attendance records';
COMMENT ON POLICY "Users can read own results" ON results IS 'RLS: Users can only access their own quiz results';
COMMENT ON POLICY "Users can read own settings" ON subscriber_settings IS 'RLS: Users can only access their own settings';
COMMENT ON POLICY "Users can read own subscriber record" ON subscribers IS 'RLS: Users can only access their own subscriber data';
COMMENT ON POLICY "Authenticated users can read words" ON words IS 'RLS: All authenticated users can read word list';
COMMENT ON POLICY "Authenticated users can read config" ON config IS 'RLS: All authenticated users can read app config';
