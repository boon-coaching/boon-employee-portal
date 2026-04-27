-- Fix RLS on goals / weekly_commitments / journal_entries.
--
-- The existing policies use:
--   employee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
--
-- That subquery requires the authenticated role to have SELECT on
-- auth.users.email, which Supabase intentionally does not grant by default
-- (other users' emails would leak). Result: every read returns 403 with
-- "permission denied for table users", and the Goals + Journal features
-- are broken portal-wide.
--
-- Replace with auth.jwt() ->> 'email' — same identity check, no auth.users
-- dependency, slightly faster (no extra round-trip).

-- goals
DROP POLICY IF EXISTS goals_select_own ON public.goals;
DROP POLICY IF EXISTS goals_insert_own ON public.goals;
DROP POLICY IF EXISTS goals_update_own ON public.goals;
DROP POLICY IF EXISTS goals_delete_own ON public.goals;

CREATE POLICY goals_select_own ON public.goals
  FOR SELECT TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY goals_insert_own ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY goals_update_own ON public.goals
  FOR UPDATE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'))
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY goals_delete_own ON public.goals
  FOR DELETE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));

-- journal_entries
DROP POLICY IF EXISTS journal_select_own ON public.journal_entries;
DROP POLICY IF EXISTS journal_insert_own ON public.journal_entries;
DROP POLICY IF EXISTS journal_update_own ON public.journal_entries;
DROP POLICY IF EXISTS journal_delete_own ON public.journal_entries;

CREATE POLICY journal_select_own ON public.journal_entries
  FOR SELECT TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY journal_insert_own ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY journal_update_own ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'))
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY journal_delete_own ON public.journal_entries
  FOR DELETE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));

-- weekly_commitments
DROP POLICY IF EXISTS commitments_select_own ON public.weekly_commitments;
DROP POLICY IF EXISTS commitments_insert_own ON public.weekly_commitments;
DROP POLICY IF EXISTS commitments_update_own ON public.weekly_commitments;
DROP POLICY IF EXISTS commitments_delete_own ON public.weekly_commitments;

CREATE POLICY commitments_select_own ON public.weekly_commitments
  FOR SELECT TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY commitments_insert_own ON public.weekly_commitments
  FOR INSERT TO authenticated
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY commitments_update_own ON public.weekly_commitments
  FOR UPDATE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'))
  WITH CHECK (employee_email = (auth.jwt() ->> 'email'));

CREATE POLICY commitments_delete_own ON public.weekly_commitments
  FOR DELETE TO authenticated
  USING (employee_email = (auth.jwt() ->> 'email'));
