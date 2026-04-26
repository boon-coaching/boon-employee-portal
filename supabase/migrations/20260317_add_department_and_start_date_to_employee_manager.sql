-- Add department and employment_start_date columns to employee_manager
-- These fields sync bidirectionally with Salesforce Contact records

ALTER TABLE public.employee_manager
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS employment_start_date DATE;
