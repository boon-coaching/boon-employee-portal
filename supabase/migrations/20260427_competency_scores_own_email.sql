-- Add email-based SELECT fallback on competency_scores so a user can always
-- read their own scores even if their JWT lacks app_metadata.company_id.
--
-- Why: 30 of 200 confirmed auth.users (~15%) have empty raw_app_meta_data
-- (no company_id, no role). The existing competency_scores policies all
-- depend on JWT.app_metadata.company_id (tenant_isolation_select,
-- company_access) — which means those users silently get 0 rows on any
-- competency_scores read.
--
-- The user-facing symptom: a GROW alumnus who has submitted their
-- end-of-program reflection (12 rows in competency_scores with
-- score_type='end_of_program') still gets routed to PENDING_REFLECTION
-- because hasEndOfProgramScores=false from their perspective. They see
-- "Complete your reflection" forever.
--
-- Verified live with erin.carr@rscmech.com: 12 EOP scores in DB, 0 visible
-- via her live JWT, home renders PendingReflectionHome with the survey
-- modal trying to re-collect scores she already submitted.
--
-- Fix: defense-in-depth policy that lets any authenticated user see their
-- own scores via email match. survey_submissions already has the same
-- shape (employees_view_own_surveys); aligning competency_scores.

CREATE POLICY employees_view_own_scores ON public.competency_scores
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));
