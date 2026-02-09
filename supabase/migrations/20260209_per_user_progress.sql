-- Migration: Per-user progress tracking
-- Date: 2026-02-09
-- Purpose: Add current_day and started_at to subscribers for individual progress tracking

-- Add current_day column (each user starts at Day 1)
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS current_day INTEGER DEFAULT 1;

-- Add started_at column (when user started learning)
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

-- Add last_lesson_at column (when user last received a lesson)
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS last_lesson_at TIMESTAMPTZ;

-- Create index for active users on specific day
CREATE INDEX IF NOT EXISTS idx_subscribers_current_day ON subscribers(current_day);
CREATE INDEX IF NOT EXISTS idx_subscribers_status_day ON subscribers(status, current_day);

-- Comments
COMMENT ON COLUMN subscribers.current_day IS 'Current learning day for this user (1-90)';
COMMENT ON COLUMN subscribers.started_at IS 'When this user started the learning program';
COMMENT ON COLUMN subscribers.last_lesson_at IS 'When the user last received a lesson';

-- Function to advance user to next day
CREATE OR REPLACE FUNCTION advance_user_day(user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_day INTEGER;
BEGIN
  UPDATE subscribers
  SET current_day = LEAST(current_day + 1, 90),
      last_lesson_at = NOW()
  WHERE email = user_email
  RETURNING current_day INTO new_day;

  RETURN new_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION advance_user_day(TEXT) TO authenticated;
