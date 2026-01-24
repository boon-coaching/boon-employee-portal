-- Practice Evaluations table for storing practice session history
-- This enables the AI to learn from past practice sessions

CREATE TABLE IF NOT EXISTS practice_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  strengths TEXT[],
  areas_to_improve TEXT[],
  conversation JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_practice_evaluations_email
  ON practice_evaluations(employee_email);
CREATE INDEX IF NOT EXISTS idx_practice_evaluations_scenario
  ON practice_evaluations(employee_email, scenario_id);
CREATE INDEX IF NOT EXISTS idx_practice_evaluations_created
  ON practice_evaluations(employee_email, created_at DESC);

-- RLS policies
ALTER TABLE practice_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can read their own evaluations
CREATE POLICY "Users can read own evaluations"
  ON practice_evaluations FOR SELECT
  USING (lower(email) = lower(auth.jwt()->>'email') OR lower(employee_email) = lower(auth.jwt()->>'email'));

-- Users can insert their own evaluations
CREATE POLICY "Users can insert own evaluations"
  ON practice_evaluations FOR INSERT
  WITH CHECK (lower(employee_email) = lower(auth.jwt()->>'email'));

-- Service role has full access
CREATE POLICY "Service role full access to evaluations"
  ON practice_evaluations FOR ALL
  USING (auth.role() = 'service_role');
