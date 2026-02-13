-- Add SMS support to subscriber_settings
ALTER TABLE subscriber_settings
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN subscriber_settings.sms_enabled IS 'Whether user has enabled SMS notifications';
