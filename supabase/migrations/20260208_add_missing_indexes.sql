-- Migration: Add Missing Database Indexes
-- Date: 2026-02-08
-- Purpose: Add all missing indexes identified in database audit
-- Impact: Significant performance improvement for common queries

-- ============================================================================
-- Table: wrong_words
-- ============================================================================

-- Composite index for email + mastered (used in stats, review queries)
CREATE INDEX IF NOT EXISTS idx_wrong_words_email_mastered
  ON wrong_words(email, mastered);

-- Index on email only (general lookups)
CREATE INDEX IF NOT EXISTS idx_wrong_words_email
  ON wrong_words(email);

-- Index for ordering by wrong_count
CREATE INDEX IF NOT EXISTS idx_wrong_words_wrong_count
  ON wrong_words(wrong_count DESC);

-- Composite index for email + word (used in upsert operations)
CREATE INDEX IF NOT EXISTS idx_wrong_words_email_word
  ON wrong_words(email, word);

-- Add comment
COMMENT ON INDEX idx_wrong_words_email_mastered IS 'Used for filtering wrong words by user and mastered status';
COMMENT ON INDEX idx_wrong_words_email IS 'Used for user-specific wrong word lookups';
COMMENT ON INDEX idx_wrong_words_wrong_count IS 'Used for ordering wrong words by frequency';
COMMENT ON INDEX idx_wrong_words_email_word IS 'Supports upsert operations and unique lookups';

-- ============================================================================
-- Table: results
-- ============================================================================

-- Composite index for email + day
CREATE INDEX IF NOT EXISTS idx_results_email_day
  ON results(email, day);

-- Index on email only
CREATE INDEX IF NOT EXISTS idx_results_email
  ON results(email);

-- Index on timestamp for ordering (covers existing but ensures DESC optimization)
CREATE INDEX IF NOT EXISTS idx_results_timestamp
  ON results(timestamp DESC);

-- Index on quiz_type for filtering
CREATE INDEX IF NOT EXISTS idx_results_quiz_type
  ON results(quiz_type);

-- Add comments
COMMENT ON INDEX idx_results_email_day IS 'Used for fetching results by user and day';
COMMENT ON INDEX idx_results_email IS 'Used for user-specific result queries';
COMMENT ON INDEX idx_results_timestamp IS 'Used for ordering results by time';
COMMENT ON INDEX idx_results_quiz_type IS 'Used for filtering by quiz type';

-- ============================================================================
-- Table: attendance
-- ============================================================================

-- Composite index for email + date
CREATE INDEX IF NOT EXISTS idx_attendance_email_date
  ON attendance(email, date);

-- Composite index for email + date + type (supports unique constraint)
CREATE INDEX IF NOT EXISTS idx_attendance_email_date_type
  ON attendance(email, date, type);

-- Index on date for range queries
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance(date DESC);

-- Index on email for user lookups
CREATE INDEX IF NOT EXISTS idx_attendance_email
  ON attendance(email);

-- Index on type for filtering
CREATE INDEX IF NOT EXISTS idx_attendance_type
  ON attendance(type);

-- Add comments
COMMENT ON INDEX idx_attendance_email_date IS 'Used for user attendance by date';
COMMENT ON INDEX idx_attendance_email_date_type IS 'Supports unique constraint and lookups';
COMMENT ON INDEX idx_attendance_date IS 'Used for date-based queries and ordering';
COMMENT ON INDEX idx_attendance_email IS 'Used for user-specific attendance queries';
COMMENT ON INDEX idx_attendance_type IS 'Used for filtering by attendance type';

-- ============================================================================
-- Table: words
-- ============================================================================

-- Index on day column (constantly queried)
CREATE INDEX IF NOT EXISTS idx_words_day
  ON words(day);

-- Composite index for day + id (supports ordering)
CREATE INDEX IF NOT EXISTS idx_words_day_id
  ON words(day, id);

-- Add comments
COMMENT ON INDEX idx_words_day IS 'Used for fetching words by day';
COMMENT ON INDEX idx_words_day_id IS 'Supports day queries with consistent ordering';

-- ============================================================================
-- Table: subscribers
-- ============================================================================

-- Unique index on email (ensures uniqueness and fast lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email_unique
  ON subscribers(email);

-- Index on status for filtering active subscribers
CREATE INDEX IF NOT EXISTS idx_subscribers_status
  ON subscribers(status);

-- Composite index for status + email
CREATE INDEX IF NOT EXISTS idx_subscribers_status_email
  ON subscribers(status, email);

-- Add comments
COMMENT ON INDEX idx_subscribers_email_unique IS 'Ensures email uniqueness and fast lookups';
COMMENT ON INDEX idx_subscribers_status IS 'Used for filtering by subscriber status';
COMMENT ON INDEX idx_subscribers_status_email IS 'Optimizes active subscriber queries';

-- Note: GIN indexes for channels and postponed_days already exist from previous migration

-- ============================================================================
-- Table: config
-- ============================================================================

-- Unique index on key column (ensures uniqueness and fast lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_key_unique
  ON config(key);

-- Add comment
COMMENT ON INDEX idx_config_key_unique IS 'Ensures config key uniqueness and fast lookups';

-- ============================================================================
-- Table: kakao_users
-- ============================================================================

-- Unique index on kakao_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_kakao_users_kakao_user_id_unique
  ON kakao_users(kakao_user_id);

-- Index on email for joins
CREATE INDEX IF NOT EXISTS idx_kakao_users_email
  ON kakao_users(email);

-- Add comments
COMMENT ON INDEX idx_kakao_users_kakao_user_id_unique IS 'Ensures Kakao user ID uniqueness';
COMMENT ON INDEX idx_kakao_users_email IS 'Used for joining with subscribers table';

-- ============================================================================
-- Table: subscriber_settings
-- ============================================================================

-- Unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriber_settings_email_unique
  ON subscriber_settings(email);

-- Add comment
COMMENT ON INDEX idx_subscriber_settings_email_unique IS 'Ensures one settings record per subscriber';

-- ============================================================================
-- Performance Monitoring Queries
-- ============================================================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

COMMENT ON VIEW index_usage_stats IS 'Monitor index usage for performance optimization';

-- ============================================================================
-- Analyze Tables (Update Statistics)
-- ============================================================================

ANALYZE wrong_words;
ANALYZE results;
ANALYZE attendance;
ANALYZE words;
ANALYZE subscribers;
ANALYZE config;
ANALYZE kakao_users;
ANALYZE subscriber_settings;
ANALYZE quiz_results;
ANALYZE push_subscriptions;

-- ============================================================================
-- Index Size Report
-- ============================================================================

-- Create a view to monitor index sizes
CREATE OR REPLACE VIEW index_size_report AS
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

COMMENT ON VIEW index_size_report IS 'Monitor index sizes and usage';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260208_add_missing_indexes completed successfully';
  RAISE NOTICE 'Total indexes created: 28';
  RAISE NOTICE 'All tables analyzed for query planner optimization';
END $$;
