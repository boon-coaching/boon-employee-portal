-- Fix RLS policies that use scalar `column = (SELECT ...)` subqueries.
--
-- When the subquery returns multiple rows (which happens when a user has
-- duplicate rows in employee_manager — a known data integrity issue), Postgres
-- throws error 21000 "more than one row returned by a subquery used as an
-- expression" and the entire query fails with HTTP 500.
--
-- This was the root cause of broken survey_submissions / welcome_survey_scale
-- / action_items / session_tracking fetches in the live audit.
--
-- Fix pattern: change `=` to `IN` so the subquery can return any number of
-- rows safely.

-- survey_submissions
DROP POLICY IF EXISTS employees_view_own_surveys ON public.survey_submissions;

CREATE POLICY employees_view_own_surveys ON public.survey_submissions
  FOR SELECT TO authenticated
  USING (
    lower(email) IN (
      SELECT lower(em.company_email)
      FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- welcome_survey_scale
DROP POLICY IF EXISTS employees_view_own_baseline ON public.welcome_survey_scale;

CREATE POLICY employees_view_own_baseline ON public.welcome_survey_scale
  FOR SELECT TO authenticated
  USING (
    lower(email) IN (
      SELECT lower(em.company_email)
      FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- action_items
DROP POLICY IF EXISTS employees_manage_own_actions ON public.action_items;

CREATE POLICY employees_manage_own_actions ON public.action_items
  FOR ALL TO authenticated
  USING (
    lower(email) IN (
      SELECT lower(em.company_email)
      FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    lower(email) IN (
      SELECT lower(em.company_email)
      FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- session_tracking - SELECT
DROP POLICY IF EXISTS employees_view_own_sessions ON public.session_tracking;

CREATE POLICY employees_view_own_sessions ON public.session_tracking
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT em.id FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR employee_id IN (
      SELECT em.id FROM public.employee_manager em
      WHERE lower(em.company_email) = lower((auth.jwt() ->> 'email'))
    )
  );

-- session_tracking - UPDATE
DROP POLICY IF EXISTS employees_update_own_sessions ON public.session_tracking;

CREATE POLICY employees_update_own_sessions ON public.session_tracking
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT em.id FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
    OR employee_id IN (
      SELECT em.id FROM public.employee_manager em
      WHERE lower(em.company_email) = lower((auth.jwt() ->> 'email'))
    )
  );

-- session_tracking - pre-session notes (legacy duplicate of UPDATE policy)
DROP POLICY IF EXISTS "Employees can update their own pre-session notes" ON public.session_tracking;

CREATE POLICY "Employees can update their own pre-session notes" ON public.session_tracking
  FOR UPDATE TO authenticated
  USING (
    (employee_id)::text IN (
      SELECT (em.id)::text FROM public.employee_manager em
      WHERE em.auth_user_id = auth.uid()
    )
  );
