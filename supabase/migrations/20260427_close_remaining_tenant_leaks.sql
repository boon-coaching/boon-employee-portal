-- Close the remaining cross-company / over-permissive RLS gaps identified
-- by the live functional audit (2026-04-27). Each table had a
-- "USING (true)" policy that bypassed the otherwise-correct scoping.
--
-- Scope-checks:
--   coach_calendar_blocks: only consumed by edge functions (calendar-oauth,
--     calendar-sync, sf-absence-sync) which use service role and bypass RLS.
--     Locking down is safe.
--   program_config: portal reads via fetchProgramType / fetchWelcomeSurveyLink.
--     The remaining tenant_isolation_select / company_access /
--     allow_read_by_account_name / admin_full_access policies cover those.
--   pulse_responses: not read by either portal or any edge function in
--     this repo. External Pulse system uses service role.
--   coaches: portal renders coach cards (name, photo_url, headline, bio,
--     credentials, specialties). REVOKE on contact-PII columns only;
--     admins/service role still see them via SECURITY DEFINER paths.

-- 1. coach_calendar_blocks: drop wide-open SELECT.
DROP POLICY IF EXISTS "Authenticated users can read calendar blocks" ON public.coach_calendar_blocks;

-- 2. program_config: drop the "temp_public_read" placeholder.
DROP POLICY IF EXISTS temp_public_read ON public.program_config;

-- 3. pulse_responses: drop the wide-open SELECT.
DROP POLICY IF EXISTS "Public read pulse_responses" ON public.pulse_responses;

-- 4. coaches: revoke column-level SELECT on contact PII for anon + authenticated.
--    The portal needs the row-level "USING (true)" SELECT to render coach
--    cards across the catalog — that's intended product behavior. What was
--    NOT intended is exposing email/phone/birthdate/mailing_address.
--    Service role and admin (`auth.role() = 'service_role'`) bypass column
--    GRANTs.
REVOKE SELECT (email, phone, birthdate, mailing_address)
  ON public.coaches
  FROM anon, authenticated;
