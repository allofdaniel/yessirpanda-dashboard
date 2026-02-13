-- Migration: Add active_days column
-- Date: 2026-02-09
-- Purpose: Add active_days column to subscribers for day-of-week scheduling

-- Add active_days column for day-of-week scheduling
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS active_days INTEGER[] DEFAULT '{1,2,3,4,5}';

-- Add index for active_days queries
CREATE INDEX IF NOT EXISTS idx_subscribers_active_days ON subscribers USING GIN(active_days);

-- Comments
COMMENT ON COLUMN subscribers.active_days IS 'Days of week to receive messages (0=Sun, 1=Mon, ..., 6=Sat)';
