-- Migration: Add salesforce_resource_id to coaches
-- Date: 2026-03-03
-- Purpose: Maps each coach to their Salesforce ServiceResource record
-- so sf-absence-sync can push calendar blocks as ResourceAbsence records.

ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS salesforce_resource_id TEXT;

-- One-to-one mapping: each SF ServiceResource belongs to exactly one coach
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaches_salesforce_resource_id
  ON coaches(salesforce_resource_id)
  WHERE salesforce_resource_id IS NOT NULL;

COMMENT ON COLUMN coaches.salesforce_resource_id IS 'Salesforce ServiceResource ID (18-char). Set for coaches on SF Scheduler.';
