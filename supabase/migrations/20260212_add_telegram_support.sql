-- Add Telegram support to subscriber_settings
-- This allows users to connect their Telegram account and receive notifications

-- Add telegram columns to subscriber_settings
ALTER TABLE subscriber_settings
ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

-- Create index for looking up by telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_subscriber_settings_telegram_chat_id
ON subscriber_settings(telegram_chat_id)
WHERE telegram_chat_id IS NOT NULL;

-- Update RLS policies to include telegram fields
-- (Existing policies should already cover these as they're on the same table)

COMMENT ON COLUMN subscriber_settings.telegram_enabled IS 'Whether user has enabled Telegram notifications';
COMMENT ON COLUMN subscriber_settings.telegram_chat_id IS 'Telegram chat ID for sending notifications';
