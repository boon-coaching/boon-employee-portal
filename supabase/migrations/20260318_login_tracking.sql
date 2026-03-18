-- Login tracking: last_login_at on employee_manager + login_events table
-- Enables adoption/engagement analysis for the employee portal

-- 1. Add last_login_at to employee_manager
ALTER TABLE employee_manager
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Create login_events table
CREATE TABLE IF NOT EXISTS login_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT REFERENCES employee_manager(id),
  auth_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT
);

-- Index for dedup lookups (most recent event per user)
CREATE INDEX IF NOT EXISTS idx_login_events_auth_user_logged_in
  ON login_events (auth_user_id, logged_in_at DESC);

-- Index for admin queries by company (join through employee_manager)
CREATE INDEX IF NOT EXISTS idx_login_events_employee_id
  ON login_events (employee_id);

-- 3. RLS on login_events
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own login events
CREATE POLICY "Users can insert own login events"
  ON login_events FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Only service role can read login events (admin analytics)
-- No SELECT policy for authenticated = service role only

-- 4. RPC: record_employee_login (SECURITY DEFINER for cross-table writes)
CREATE OR REPLACE FUNCTION record_employee_login(
  lookup_email TEXT,
  user_id UUID,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id BIGINT;
  v_last_login TIMESTAMPTZ;
BEGIN
  -- Find the employee
  SELECT id INTO v_employee_id
  FROM employee_manager
  WHERE LOWER(company_email) = LOWER(lookup_email)
  LIMIT 1;

  -- If no employee found, still log the event (might be useful for debugging)
  -- but skip the employee_manager update

  -- Check for duplicate: was there a login event for this user in the last hour?
  SELECT logged_in_at INTO v_last_login
  FROM login_events
  WHERE auth_user_id = user_id
  ORDER BY logged_in_at DESC
  LIMIT 1;

  IF v_last_login IS NOT NULL AND v_last_login > NOW() - INTERVAL '1 hour' THEN
    -- Duplicate within 1 hour, skip
    RETURN FALSE;
  END IF;

  -- Insert login event
  INSERT INTO login_events (employee_id, auth_user_id, email, user_agent)
  VALUES (v_employee_id, user_id, lookup_email, user_agent_string);

  -- Update last_login_at on employee_manager
  IF v_employee_id IS NOT NULL THEN
    UPDATE employee_manager
    SET last_login_at = NOW()
    WHERE id = v_employee_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION record_employee_login(TEXT, UUID, TEXT) TO authenticated;
