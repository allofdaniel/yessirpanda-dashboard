-- Add SNS channels and postpone features to subscribers table
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS postponed_days integer[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_postponed_at timestamptz;

-- Create function to add channel to subscriber
CREATE OR REPLACE FUNCTION add_channel_to_subscriber(subscriber_email text, new_channel text)
RETURNS void AS $$
BEGIN
  UPDATE subscribers
  SET channels = array_append(
    COALESCE(channels, '{}'),
    new_channel
  )
  WHERE email = subscriber_email
  AND NOT (COALESCE(channels, '{}') @> ARRAY[new_channel]);
END;
$$ LANGUAGE plpgsql;

-- Enable Kakao OAuth in Supabase Auth (run in SQL editor)
-- Go to Supabase Dashboard > Authentication > Providers > Kakao
-- You need to set up:
-- 1. Kakao Client ID (REST API Key from Kakao Developers)
-- 2. Kakao Client Secret (from Kakao Developers)

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_channels ON subscribers USING gin(channels);
CREATE INDEX IF NOT EXISTS idx_subscribers_postponed ON subscribers USING gin(postponed_days);
