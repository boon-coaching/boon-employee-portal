-- Practice Team Members table
-- Stores team members that users add for personalized practice scenarios

CREATE TABLE IF NOT EXISTS practice_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by employee
CREATE INDEX idx_practice_team_members_email ON practice_team_members(employee_email);

-- RLS policies
ALTER TABLE practice_team_members ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own team members
CREATE POLICY "Users can view own team members"
  ON practice_team_members FOR SELECT
  USING (employee_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own team members"
  ON practice_team_members FOR INSERT
  WITH CHECK (employee_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own team members"
  ON practice_team_members FOR UPDATE
  USING (employee_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own team members"
  ON practice_team_members FOR DELETE
  USING (employee_email = auth.jwt() ->> 'email');


-- Practice Saved Plans table
-- Stores generated plans in the user's playbook

CREATE TABLE IF NOT EXISTS practice_saved_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  context TEXT NOT NULL,
  team_member_id UUID REFERENCES practice_team_members(id) ON DELETE SET NULL,
  team_member_name TEXT,
  plan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by employee
CREATE INDEX idx_practice_saved_plans_email ON practice_saved_plans(employee_email);
CREATE INDEX idx_practice_saved_plans_created ON practice_saved_plans(created_at DESC);

-- RLS policies
ALTER TABLE practice_saved_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own saved plans
CREATE POLICY "Users can view own saved plans"
  ON practice_saved_plans FOR SELECT
  USING (employee_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own saved plans"
  ON practice_saved_plans FOR INSERT
  WITH CHECK (employee_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can delete own saved plans"
  ON practice_saved_plans FOR DELETE
  USING (employee_email = auth.jwt() ->> 'email');
