-- Migration: SNS Account Linking Support
-- Date: 2026-02-09
-- Purpose: Add function to remove channel from subscriber for SNS unlinking

-- Create function to remove channel from subscriber
CREATE OR REPLACE FUNCTION remove_channel_from_subscriber(subscriber_email text, channel_to_remove text)
RETURNS void AS $$
BEGIN
  UPDATE subscribers
  SET channels = array_remove(COALESCE(channels, '{}'), channel_to_remove)
  WHERE email = subscriber_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION remove_channel_from_subscriber(text, text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION remove_channel_from_subscriber IS 'Removes a linked SNS channel from subscriber record';
