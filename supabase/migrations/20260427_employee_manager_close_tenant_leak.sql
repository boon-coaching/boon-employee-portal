-- P0 SECURITY: close cross-company leak on employee_manager.
--
-- The table had three overly permissive policies that let any authenticated
-- user read, update, or delete every row across all customers:
--   - users_can_read_employee_manager   USING (true)   SELECT
--   - "Authenticated users can update employees"   USING (true)   UPDATE
--   - "Authenticated users can delete employees"   USING (true)   DELETE
--
-- Verified live on 2026-04-26: a logged-in user from Amplify Credit Union
-- could fetch full PII rows (name, email, coach, manager_email, birthdate,
-- phone, slack_user_id) from Emergency Nurses Association.
--
-- The table already has properly-scoped tenant_isolation_* and
-- employees_view_own_profile policies. Dropping the open ones restores
-- isolation: SELECT becomes (company_id matches JWT) OR (own profile);
-- UPDATE/DELETE require company_id match; INSERT requires the new row's
-- company_id to match the JWT (was previously unconstrained).

-- 1. Drop the open SELECT policy.
DROP POLICY IF EXISTS users_can_read_employee_manager ON public.employee_manager;

-- 2. Drop the open UPDATE policy.
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employee_manager;

-- 3. Drop the open DELETE policy.
DROP POLICY IF EXISTS "Authenticated users can delete employees" ON public.employee_manager;

-- 4. Replace the open INSERT policies with one that constrains the new row's
--    company_id to the inserter's JWT company. Service role still bypasses
--    RLS for the sync edge functions.
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employee_manager;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.employee_manager;

CREATE POLICY tenant_isolation_insert ON public.employee_manager
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (((auth.jwt() -> 'app_metadata') ->> 'company_id'))::uuid
  );
