-- Add notification preferences to subscriber_settings
ALTER TABLE subscriber_settings
ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS kakao_enabled boolean DEFAULT true;

-- Add index for faster filtering when sending notifications
CREATE INDEX IF NOT EXISTS idx_subscriber_settings_email_enabled
ON subscriber_settings(email_enabled) WHERE email_enabled = true;

CREATE INDEX IF NOT EXISTS idx_subscriber_settings_kakao_enabled
ON subscriber_settings(kakao_enabled) WHERE kakao_enabled = true;
