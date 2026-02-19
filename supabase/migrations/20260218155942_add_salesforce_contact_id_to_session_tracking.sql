-- Add salesforce_contact_id to session_tracking
-- Stores the Salesforce Contact record ID sent from the Apex class.
-- Used for deterministic employee matching alongside email-based lookup.

ALTER TABLE public.session_tracking
ADD COLUMN IF NOT EXISTS salesforce_contact_id text;
