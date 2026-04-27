-- Lock down PII / internal columns on public.coaches.
--
-- Previous column-level REVOKE in 20260427_close_remaining_tenant_leaks.sql
-- did not take effect because anon and authenticated both have a wildcard
-- table-level SELECT grant. Wildcard grants override column-level revokes.
--
-- This migration revokes the wildcard and re-grants SELECT only on the
-- public-facing columns the portal actually needs to render coach cards.
--
-- EXCLUDED (sensitive — only service_role / admin-via-edge-function):
--   email, phone, birthdate, mailing_address              -- direct PII
--   gender, race, linkedin                                 -- demographic / personal
--   salesforce_id, salesforce_resource_id,
--   salesforce_coach_id, salesforce_contact_id             -- internal SF mapping
--   session_rate                                           -- coach compensation
--   account_name, companies                                -- account assignments
--   max_active_clients, max_client_capacity,
--   available_capacity                                     -- capacity planning
--   number_of_match_emails_*, number_of_selections_*,
--   coach_selection_rate_*                                 -- performance metrics
--   total_coach_appointments, scheduled_coach_appointments -- performance metrics
--   seniority_score                                        -- internal score
--   is_complimentary_pilot, is_paid_pilot                  -- internal contract type
--   coach_start_date, coach_termination_date,
--   reason_for_pause                                       -- HR data
--   insurance_expiration_date                              -- compliance data
--   zoom_id, paid_zoom_account                             -- internal infra
--   portal_sync_enabled, portal_sf_create_enabled          -- feature flags
--   booking_buffer_minutes, default_session_duration_minutes,
--   booking_page_enabled                                   -- internal scheduling
--   created_date                                           -- not needed by portal

REVOKE SELECT ON public.coaches FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  first_name,
  last_name,
  photo_url,
  bio,
  headline,
  notable_credentials,
  specialties,
  industries,
  services,
  special_services,
  coach_languages,
  coach_department,
  experienced_working_with,
  improvement_areas,
  pronouns,
  age_range,
  practitioner_type,
  timezone,
  preferred_time_window,
  icf_level,
  is_scale_coach,
  is_grow_coach,
  is_exec_coach,
  is_active,
  facilitator,
  x360_performance,
  assessments,
  created_at,
  updated_at
) ON public.coaches TO anon, authenticated;
