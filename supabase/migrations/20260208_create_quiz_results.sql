-- Create quiz_results table for storing quiz submissions
CREATE TABLE IF NOT EXISTS quiz_results (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  day INTEGER NOT NULL,
  quiz_type TEXT NOT NULL CHECK (quiz_type IN ('morning', 'lunch', 'evening')),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_quiz_results_email ON quiz_results(email);

-- Create index for faster lookups by day
CREATE INDEX IF NOT EXISTS idx_quiz_results_day ON quiz_results(day);

-- Create composite index for email and day queries
CREATE INDEX IF NOT EXISTS idx_quiz_results_email_day ON quiz_results(email, day);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_quiz_results_created_at ON quiz_results(created_at DESC);

-- Add comment to table
COMMENT ON TABLE quiz_results IS 'Stores quiz results with detailed answer information';
COMMENT ON COLUMN quiz_results.email IS 'User email address';
COMMENT ON COLUMN quiz_results.day IS 'Day number of the quiz';
COMMENT ON COLUMN quiz_results.quiz_type IS 'Type of quiz: morning, lunch, or evening';
COMMENT ON COLUMN quiz_results.score IS 'Number of correct answers';
COMMENT ON COLUMN quiz_results.total IS 'Total number of questions';
COMMENT ON COLUMN quiz_results.answers IS 'JSONB array of answer objects with word, meaning, and status';
COMMENT ON COLUMN quiz_results.created_at IS 'Timestamp when quiz was submitted';
