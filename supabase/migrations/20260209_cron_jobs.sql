-- ===========================================
-- pg_cron 작업 설정 마이그레이션
-- 옛설판다 비즈니스 영어 학습 서비스
-- ===========================================

-- Enable pg_net extension for HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a table to log cron job executions (must be created before function)
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  executed_at timestamptz DEFAULT now(),
  status text DEFAULT 'success',
  error_message text
);

-- Enable RLS on cron_job_logs
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage cron logs
CREATE POLICY "Service role can manage cron logs"
ON cron_job_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE cron_job_logs IS 'Logs for cron job executions';

-- Store Edge Function base URL in config table
INSERT INTO config (key, value) VALUES
  ('EDGE_FUNCTION_URL', 'https://vsgvlspyrlfqlhchbwvj.supabase.co/functions/v1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create a function to call Edge Functions via HTTP
CREATE OR REPLACE FUNCTION call_edge_function(function_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
BEGIN
  -- Get Edge Function URL from config
  SELECT value INTO edge_function_url
  FROM config
  WHERE key = 'EDGE_FUNCTION_URL';

  -- Make HTTP POST request to Edge Function
  PERFORM net.http_post(
    url := edge_function_url || '/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );

  -- Log the execution
  INSERT INTO cron_job_logs (job_name, status)
  VALUES (function_name, 'triggered');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_job_logs (job_name, status, error_message)
  VALUES (function_name, 'error', SQLERRM);
END;
$$;

-- ===========================================
-- 크론 작업 스케줄 설정
-- KST (UTC+9) 기준으로 설정
-- ===========================================

-- 아침 학습 메일: 7:30 AM KST = 22:30 UTC (전날)
SELECT cron.schedule(
  'morning-words-daily',
  '30 22 * * *',
  $$SELECT call_edge_function('morning-words')$$
);

-- 점심 테스트: 1:00 PM KST = 04:00 UTC
SELECT cron.schedule(
  'lunch-quiz-daily',
  '0 4 * * *',
  $$SELECT call_edge_function('lunch-quiz')$$
);

-- 저녁 리뷰: 4:00 PM KST = 07:00 UTC (하루 학습 마무리 및 Day 증가)
SELECT cron.schedule(
  'evening-review-daily',
  '0 7 * * *',
  $$SELECT call_edge_function('evening-review')$$
);

-- ===========================================
-- 크론 작업 관리 뷰
-- ===========================================

-- View to see all scheduled jobs
CREATE OR REPLACE VIEW scheduled_jobs AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  active
FROM cron.job
ORDER BY jobname;

COMMENT ON VIEW scheduled_jobs IS 'View all scheduled cron jobs';

-- View to see recent job runs
CREATE OR REPLACE VIEW recent_job_runs AS
SELECT
  job_name,
  executed_at,
  status,
  error_message
FROM cron_job_logs
ORDER BY executed_at DESC
LIMIT 100;

COMMENT ON VIEW recent_job_runs IS 'View recent cron job execution logs';
