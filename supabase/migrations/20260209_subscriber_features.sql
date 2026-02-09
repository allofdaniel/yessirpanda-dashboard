-- Migration: Add subscriber features
-- Date: 2026-02-09
-- Purpose: Add invite_code, active_days, and referrer fields to subscribers

-- Add invite_code column for referral links
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Add active_days column for day-of-week scheduling
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS active_days INTEGER[] DEFAULT '{1,2,3,4,5}';

-- Add referrer column to track who invited the user
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS referred_by TEXT REFERENCES subscribers(email);

-- Create index on invite_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_invite_code ON subscribers(invite_code);

-- Create function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invite code on insert
DROP TRIGGER IF EXISTS set_invite_code ON subscribers;
CREATE TRIGGER set_invite_code
  BEFORE INSERT ON subscribers
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- Update existing subscribers without invite codes
UPDATE subscribers
SET invite_code = upper(substring(md5(random()::text || email) from 1 for 6))
WHERE invite_code IS NULL;

-- Comments
COMMENT ON COLUMN subscribers.invite_code IS 'Unique referral code for inviting new users';
COMMENT ON COLUMN subscribers.active_days IS 'Days of week to receive messages (0=Sun, 1=Mon, ..., 6=Sat)';
COMMENT ON COLUMN subscribers.referred_by IS 'Email of the user who referred this subscriber';
