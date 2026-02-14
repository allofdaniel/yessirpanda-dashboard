-- Add active_days column to subscriber_settings
-- Array of integers: 0=Sunday, 1=Monday, ..., 6=Saturday
-- Default to weekdays (Mon-Fri)
ALTER TABLE subscriber_settings
ADD COLUMN IF NOT EXISTS active_days integer[] DEFAULT ARRAY[1,2,3,4,5];

-- Update existing rows to have default weekday schedule
UPDATE subscriber_settings
SET active_days = ARRAY[1,2,3,4,5]
WHERE active_days IS NULL;
