-- Migration: Add Salesforce coach-match mirror fields to employee_manager
-- Date: 2026-04-25
--
-- The portal needs to render distinct UI for users in different SF lifecycle
-- states (Registered with matches sent vs Coach Selected vs Inactive-never-met
-- etc). The signal lives on the SF Contact in fields we don't currently mirror.
--
-- This migration adds the missing columns. A new edge function `sf-contact-sync`
-- will populate them from SF Contact via SOQL on a schedule. State-machine
-- changes that consume these fields ship in a follow-up PR.
--
-- Existing columns we already had (no-op here, just for reference):
--   client_status           <- SF Status__c (picklist: Unregistered, Registered,
--                              Coach Selected, Active, Inactive, Terminated, Ineligible)
--   coach                   <- SF Coach__c (the selected-coach Contact Id)
--   booking_link            <- SF Client_Booking_Link__c
--   salesforce_contact_id   <- SF Contact Id (15-char or 18-char)

ALTER TABLE employee_manager
  ADD COLUMN IF NOT EXISTS sf_coach_1_email text,
  ADD COLUMN IF NOT EXISTS sf_coach_1_booking_link text,
  ADD COLUMN IF NOT EXISTS sf_coach_2_email text,
  ADD COLUMN IF NOT EXISTS sf_coach_2_booking_link text,
  ADD COLUMN IF NOT EXISTS sf_initial_match_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sf_synced_at timestamptz;

COMMENT ON COLUMN employee_manager.sf_coach_1_email IS 'Mirror of SF Contact.Coach_1_Email__c (first match candidate email)';
COMMENT ON COLUMN employee_manager.sf_coach_1_booking_link IS 'Mirror of SF Contact.Coach_1_Booking_Link__c (first match candidate Salesforce Scheduler link)';
COMMENT ON COLUMN employee_manager.sf_coach_2_email IS 'Mirror of SF Contact.Coach_2_Email__c (second match candidate email)';
COMMENT ON COLUMN employee_manager.sf_coach_2_booking_link IS 'Mirror of SF Contact.Coach_2_Booking_Link__c (second match candidate Salesforce Scheduler link)';
COMMENT ON COLUMN employee_manager.sf_initial_match_email_sent_at IS 'Mirror of SF Contact.Initial_Coach_Match_Email_Sent__c (datetime ops sent the first match email)';
COMMENT ON COLUMN employee_manager.sf_synced_at IS 'Last time sf-contact-sync edge function updated this row from SF';

-- Index to support "find rows that need re-sync" queries
CREATE INDEX IF NOT EXISTS idx_employee_manager_sf_synced_at
  ON employee_manager (sf_synced_at NULLS FIRST);
