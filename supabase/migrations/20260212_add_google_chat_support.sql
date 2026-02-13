-- Add Google Chat support to subscriber_settings
-- This allows users to connect their Google Workspace Chat and receive notifications via webhooks

-- Add google chat columns to subscriber_settings
ALTER TABLE subscriber_settings
ADD COLUMN IF NOT EXISTS google_chat_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_chat_webhook TEXT DEFAULT NULL;

COMMENT ON COLUMN subscriber_settings.google_chat_enabled IS 'Whether user has enabled Google Chat notifications';
COMMENT ON COLUMN subscriber_settings.google_chat_webhook IS 'Google Chat webhook URL for sending notifications';
