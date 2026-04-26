-- Add salesforce_contact_id to employee_manager for portal-employee-sync
ALTER TABLE public.employee_manager
  ADD COLUMN IF NOT EXISTS salesforce_contact_id text;
