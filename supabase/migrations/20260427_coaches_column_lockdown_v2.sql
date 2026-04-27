-- Revise the previous coaches column lockdown.
--
-- The first pass (20260427_coaches_column_lockdown.sql) revoked email and
-- salesforce_contact_id alongside truly-sensitive columns. But the portal
-- needs to filter on those:
--   - fetchCoachByEmail (sf_coach_1/2_email matching)
--   - fetchCoachBySfId (Coach__c -> coaches.salesforce_contact_id)
-- A WHERE clause on a revoked column fails with 42501. Net result: coach
-- card rendering broke for any user routed through those lookups.
--
-- This pass re-grants the lookup columns (email, salesforce_contact_id)
-- while keeping truly-sensitive PII / internal data revoked.

REVOKE SELECT ON public.coaches FROM anon, authenticated;

GRANT SELECT (
  -- Identity / lookup keys
  id,
  salesforce_contact_id,
  -- Name display
  name,
  first_name,
  last_name,
  -- Public profile (rendered on coach cards across both portals)
  email,
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
  -- Filtering flags
  is_scale_coach,
  is_grow_coach,
  is_exec_coach,
  is_active,
  facilitator,
  x360_performance,
  assessments,
  -- Timestamps
  created_at,
  updated_at
) ON public.coaches TO anon, authenticated;

-- Still REVOKED (only service_role / admin via edge function):
--   phone, birthdate, mailing_address                   -- real PII
--   gender, race, linkedin                              -- demographic
--   salesforce_id, salesforce_resource_id,
--   salesforce_coach_id                                 -- other internal SF ids
--   session_rate                                        -- coach compensation
--   account_name, companies                             -- account assignments
--   max_active_clients, max_client_capacity,
--   available_capacity                                  -- capacity planning
--   number_of_match_emails_*, number_of_selections_*,
--   coach_selection_rate_*                              -- performance metrics
--   total_coach_appointments,
--   scheduled_coach_appointments                        -- performance metrics
--   seniority_score                                     -- internal scoring
--   is_complimentary_pilot, is_paid_pilot               -- contract type
--   coach_start_date, coach_termination_date,
--   reason_for_pause                                    -- HR data
--   insurance_expiration_date                           -- compliance data
--   zoom_id, paid_zoom_account                          -- internal infra
--   portal_sync_enabled, portal_sf_create_enabled       -- feature flags
--   booking_buffer_minutes,
--   default_session_duration_minutes,
--   booking_page_enabled                                -- internal scheduling
--   created_date                                        -- not needed by portal
