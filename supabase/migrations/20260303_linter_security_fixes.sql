-- Security Hardening: Supabase Linter Findings (Pre-Pen-Test)
-- Addresses: auth_users_exposed, rls_disabled_in_public, policy_exists_rls_disabled,
--            rls_references_user_metadata
--
-- Applied in 5 parts:
-- 1. Enable RLS on 8 tables that had it disabled
-- 2. Add RLS policies for 5 tables that had none
-- 3. Tighten table-level grants (defense in depth)
-- 4. Revoke anon access on portal_activity views (auth_users_exposed)
-- 5. Fix together_* policies: user_metadata -> app_metadata

-- ============================================================
-- PART 1: Enable RLS on all flagged tables
-- ============================================================

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_valid_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_name_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_links_import ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 2: Add RLS policies for tables that had none
-- ============================================================

-- core_competencies: reference data, read-only for portal users
CREATE POLICY "service_role_all_core_competencies" ON core_competencies
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_core_competencies" ON core_competencies
  FOR SELECT TO authenticated USING (true);

-- company_name_mappings: reference mapping, read by authenticated
CREATE POLICY "service_role_all_company_name_mappings" ON company_name_mappings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_company_name_mappings" ON company_name_mappings
  FOR SELECT TO authenticated USING (true);

-- shared_recommendations: coach matching data, read by authenticated
CREATE POLICY "service_role_all_shared_recommendations" ON shared_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_shared_recommendations" ON shared_recommendations
  FOR SELECT TO authenticated USING (true);

-- temp_valid_appointments: temp import data, service_role only
CREATE POLICY "service_role_all_temp_valid_appointments" ON temp_valid_appointments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- appointment_links_import: import data, service_role only
CREATE POLICY "service_role_all_appointment_links_import" ON appointment_links_import
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- PART 3: Tighten table-level grants (defense in depth)
-- ============================================================

-- Admin/import tables: no client access at all
REVOKE ALL ON temp_valid_appointments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON temp_valid_appointments FROM authenticated;

REVOKE ALL ON appointment_links_import FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON appointment_links_import FROM authenticated;

-- Reference tables: anon gets nothing, authenticated reads only
REVOKE ALL ON core_competencies FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON core_competencies FROM authenticated;

REVOKE ALL ON company_name_mappings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON company_name_mappings FROM authenticated;

REVOKE ALL ON shared_recommendations FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shared_recommendations FROM authenticated;

-- coaches: keep SELECT grants, revoke writes
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coaches FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON coaches FROM authenticated;

-- programs (deprecated): keep SELECT, revoke writes
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON programs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON programs FROM authenticated;

-- coaching_wins: authenticated keeps SELECT+INSERT (per existing policies), anon gets nothing
REVOKE ALL ON coaching_wins FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON coaching_wins FROM authenticated;

-- ============================================================
-- PART 4: Fix portal_activity views (auth_users_exposed)
-- These join auth.users and were accessible to anon
-- ============================================================

REVOKE ALL ON portal_activity_by_client FROM anon;
REVOKE ALL ON portal_activity_by_user FROM anon;
REVOKE ALL ON portal_event_summary FROM anon;

-- Also revoke write grants from authenticated (views are read-only)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON portal_activity_by_client FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON portal_activity_by_user FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON portal_event_summary FROM authenticated;

-- ============================================================
-- PART 5: Fix together_* RLS policies
-- Switch from user_metadata (user-editable, exploitable) to app_metadata (admin-only)
-- Verified: all users have company_id in app_metadata
-- ============================================================

-- together_programs (direct company_id check)
DROP POLICY IF EXISTS "Users can view their company programs" ON together_programs;
DROP POLICY IF EXISTS "together_programs_company" ON together_programs;
CREATE POLICY "Users can view their company programs" ON together_programs
  FOR SELECT TO authenticated
  USING (company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid);

-- together_phases (program_id subquery)
DROP POLICY IF EXISTS "Users can view their company phases" ON together_phases;
DROP POLICY IF EXISTS "together_phases_company" ON together_phases;
CREATE POLICY "Users can view their company phases" ON together_phases
  FOR SELECT TO authenticated
  USING (program_id IN (
    SELECT id FROM together_programs
    WHERE company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_action_commitments
DROP POLICY IF EXISTS "Users can view their company action commitments" ON together_action_commitments;
CREATE POLICY "Users can view their company action commitments" ON together_action_commitments
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_attendance
DROP POLICY IF EXISTS "Users can view their company attendance" ON together_attendance;
CREATE POLICY "Users can view their company attendance" ON together_attendance
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_facilitators
DROP POLICY IF EXISTS "Users can view their company facilitators" ON together_facilitators;
CREATE POLICY "Users can view their company facilitators" ON together_facilitators
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_feedback
DROP POLICY IF EXISTS "Users can view their company feedback" ON together_feedback;
CREATE POLICY "Users can view their company feedback" ON together_feedback
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_frameworks
DROP POLICY IF EXISTS "Users can view their company frameworks" ON together_frameworks;
CREATE POLICY "Users can view their company frameworks" ON together_frameworks
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_future_topics
DROP POLICY IF EXISTS "Users can view their company future topics" ON together_future_topics;
CREATE POLICY "Users can view their company future topics" ON together_future_topics
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_group_agreements (program_id subquery)
DROP POLICY IF EXISTS "Users can view their company group agreements" ON together_group_agreements;
CREATE POLICY "Users can view their company group agreements" ON together_group_agreements
  FOR SELECT TO authenticated
  USING (program_id IN (
    SELECT id FROM together_programs
    WHERE company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_improvement_themes (program_id subquery)
DROP POLICY IF EXISTS "Users can view their company improvement themes" ON together_improvement_themes;
CREATE POLICY "Users can view their company improvement themes" ON together_improvement_themes
  FOR SELECT TO authenticated
  USING (program_id IN (
    SELECT id FROM together_programs
    WHERE company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_phase_ratings
DROP POLICY IF EXISTS "Users can view their company phase ratings" ON together_phase_ratings;
CREATE POLICY "Users can view their company phase ratings" ON together_phase_ratings
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_takeaways
DROP POLICY IF EXISTS "Users can view their company takeaways" ON together_takeaways;
CREATE POLICY "Users can view their company takeaways" ON together_takeaways
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));

-- together_tracks
DROP POLICY IF EXISTS "Users can view their company tracks" ON together_tracks;
CREATE POLICY "Users can view their company tracks" ON together_tracks
  FOR SELECT TO authenticated
  USING (phase_id IN (
    SELECT tp.id FROM together_phases tp
    JOIN together_programs tprog ON tp.program_id = tprog.id
    WHERE tprog.company_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'company_id'::text))::uuid
  ));
