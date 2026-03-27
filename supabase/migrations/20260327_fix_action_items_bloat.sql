-- Migration: Fix action items bloat
-- Problem: trigger fires on every UPDATE to session_tracking (SF sync, reconciliation, etc.)
-- causing duplicate action items. Zach has 243 open items.
--
-- Fixes:
-- 1. Guard trigger: skip if action_items already exist for this session_id
-- 2. Cap at 5 items per session
-- 3. Clean up existing bloat: dismiss items older than 3 most recent sessions per employee

-- Step 1: Replace the trigger function with a guarded version
CREATE OR REPLACE FUNCTION sync_session_plan_to_action_items()
RETURNS TRIGGER AS $$
DECLARE
  employee_email TEXT;
  line TEXT;
  action_text TEXT;
  item_count INT := 0;
BEGIN
  -- Only process if status is Completed and plan exists
  IF NEW.status = 'Completed' AND NEW.plan IS NOT NULL AND trim(NEW.plan) != '' THEN

    -- Early exit: if action items already exist for this session, do nothing
    IF EXISTS (SELECT 1 FROM action_items WHERE session_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Get employee email
    SELECT company_email INTO employee_email
    FROM employee_manager
    WHERE id = NEW.employee_id;

    IF employee_email IS NOT NULL THEN
      -- Split plan by newlines and create action items (max 5 per session)
      FOREACH line IN ARRAY string_to_array(NEW.plan, E'\n')
      LOOP
        -- Stop after 5 items
        EXIT WHEN item_count >= 5;

        -- Clean up the line (remove bullets, numbers, etc.)
        action_text := trim(regexp_replace(line, E'^[\\s•\\-\\*\\d\\.\\)]+', ''));

        -- Skip empty or very short lines
        IF action_text != '' AND length(action_text) > 5 THEN
          -- Insert if not duplicate (secondary safety net)
          INSERT INTO action_items (email, session_id, coach_name, action_text, status, due_date, created_at)
          SELECT
            employee_email,
            NEW.id,
            NEW.coach_name,
            action_text,
            'pending',
            CURRENT_DATE + 7,
            NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM action_items ai
            WHERE ai.email = employee_email
              AND ai.action_text = action_text
          );

          item_count := item_count + 1;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Recreate trigger (same definition, function body changed above)
DROP TRIGGER IF EXISTS trigger_sync_plan_to_action_items ON session_tracking;
CREATE TRIGGER trigger_sync_plan_to_action_items
  AFTER INSERT OR UPDATE ON session_tracking
  FOR EACH ROW
  EXECUTE FUNCTION sync_session_plan_to_action_items();

-- Step 3: Clean up existing bloat
-- Dismiss pending action items older than the 3 most recent sessions per employee
WITH recent_sessions AS (
  SELECT email, session_id
  FROM action_items
  WHERE session_id IS NOT NULL
    AND session_id IN (
      SELECT id FROM session_tracking WHERE status = 'Completed'
    )
  GROUP BY email, session_id
),
ranked AS (
  SELECT rs.email, rs.session_id,
    ROW_NUMBER() OVER (
      PARTITION BY rs.email
      ORDER BY st.session_date DESC
    ) as rn
  FROM recent_sessions rs
  JOIN session_tracking st ON st.id = rs.session_id
)
UPDATE action_items SET status = 'dismissed'
WHERE status = 'pending'
  AND session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ranked r
    WHERE r.email = action_items.email
      AND r.session_id = action_items.session_id
      AND r.rn <= 3
  );
