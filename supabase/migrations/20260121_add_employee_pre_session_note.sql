-- Migration: Add employee_pre_session_note column to session_tracking
-- Date: 2026-01-21
-- Allows employees to add notes before their upcoming sessions

ALTER TABLE session_tracking
ADD COLUMN IF NOT EXISTS employee_pre_session_note TEXT;

-- Allow employees to update their own pre-session notes
-- Update existing RLS policy or create a new one for updates
DROP POLICY IF EXISTS "employees_update_own_sessions" ON session_tracking;

CREATE POLICY "employees_update_own_sessions"
ON session_tracking
FOR UPDATE
USING (
  -- Match by employee_id through employee_manager (via auth_user_id)
  employee_id = (
    SELECT id
    FROM employee_manager
    WHERE auth_user_id = auth.uid()
  )
  OR
  -- Fallback: Match by employee_id through employee_manager (via email)
  employee_id = (
    SELECT id
    FROM employee_manager
    WHERE lower(company_email) = lower(auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  -- Same conditions for the update check
  employee_id = (
    SELECT id
    FROM employee_manager
    WHERE auth_user_id = auth.uid()
  )
  OR
  employee_id = (
    SELECT id
    FROM employee_manager
    WHERE lower(company_email) = lower(auth.jwt() ->> 'email')
  )
);
