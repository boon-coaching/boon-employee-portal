-- Migration: Create action_items from session_tracking.plan field
-- This takes each client's most recent completed session plan and creates individual action_items
-- Plans are typically newline-separated

-- Step 1: Create a temp table with the most recent session per employee that has a plan
WITH latest_sessions AS (
  SELECT DISTINCT ON (employee_id)
    id,
    employee_id,
    plan,
    session_date
  FROM session_tracking
  WHERE status = 'Completed'
    AND plan IS NOT NULL
    AND trim(plan) != ''
  ORDER BY employee_id, session_date DESC
),
-- Step 2: Split plans into individual lines
plan_lines AS (
  SELECT
    ls.id as session_id,
    ls.employee_id,
    ls.session_date,
    -- Split by newline and clean up each line
    trim(regexp_replace(line, E'^[\\s•\\-\\*\\d\\.\\)]+', '')) as action_text
  FROM latest_sessions ls,
  LATERAL unnest(string_to_array(ls.plan, E'\n')) as line
  WHERE trim(line) != ''
)
-- Step 3: Insert as action_items (skip if already exists)
INSERT INTO action_items (employee_id, action_text, source_session_id, status, created_at)
SELECT
  pl.employee_id,
  pl.action_text,
  pl.session_id,
  'pending',
  NOW()
FROM plan_lines pl
WHERE pl.action_text != ''
  AND length(pl.action_text) > 5  -- Skip very short lines
  -- Don't create duplicates
  AND NOT EXISTS (
    SELECT 1 FROM action_items ai
    WHERE ai.employee_id = pl.employee_id
      AND ai.action_text = pl.action_text
  );
