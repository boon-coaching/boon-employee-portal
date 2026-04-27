-- Backfill auth.users.raw_app_meta_data.company_id for confirmed users
-- whose employee_manager row has a company_id but the auth record doesn't.
--
-- Counted live: 30 confirmed users without company_id in JWT, 20 of which
-- have a resolvable employee_manager row. The remaining 10 are auth-only
-- (likely test accounts or users without a portal record yet) and stay
-- untouched.
--
-- The competency_scores RLS fallback in 20260427_competency_scores_own_email.sql
-- handles the score-reading symptom directly. This migration is the
-- structural fix: future RLS policies that depend on company_id will work
-- for these users without case-by-case fallbacks, and the customer portal's
-- expected JWT shape is restored.
--
-- Picks the employee_manager row deterministically (most recent created_at,
-- then lowest id) when duplicates exist for the same email — same shape as
-- pickBestEmployeeRecord in AuthContext but we accept any company match.

DO $$
DECLARE
  updated_count integer;
BEGIN
  WITH resolved AS (
    SELECT DISTINCT ON (au.id)
      au.id            AS user_id,
      em.company_id    AS company_id,
      em.company_name  AS company_name
    FROM auth.users au
    JOIN public.employee_manager em
      ON LOWER(em.company_email) = LOWER(au.email)
    WHERE au.email_confirmed_at IS NOT NULL
      AND NOT (au.raw_app_meta_data ? 'company_id')
      AND em.company_id IS NOT NULL
    ORDER BY au.id, em.created_at DESC NULLS LAST, em.id ASC
  )
  UPDATE auth.users au
  SET raw_app_meta_data = COALESCE(au.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'company_id', resolved.company_id::text,
         'company',    resolved.company_name
       )
  FROM resolved
  WHERE au.id = resolved.user_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled company_id on % auth.users rows', updated_count;
END $$;
