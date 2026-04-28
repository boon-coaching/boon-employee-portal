-- Phase C: Dedupe employee_manager + add UNIQUE (lower(company_email), company_id)
--
-- Background: 163 dupe groups / 171 extra rows (key = (lower(company_email), company_id)).
-- Confirmed write-path source in this codebase: portal-employee-sync.handleAdd had no
-- pre-insert lookup (fixed in same PR). A second writer (external, unknown — likely
-- SF Apex or a manual backfill script) inserts ~5 AM ET batches. The UNIQUE index
-- added at the end of this migration is the universal defense; it will surface the
-- mystery writer the next time it runs.
--
-- Winner-selection rule per dupe group, mirroring AuthContext.pickBestEmployeeRecord
-- (src/lib/AuthContext.tsx:19-28) plus session_count as a stronger middle tier:
--   1. coach_id NOT NULL DESC
--   2. (most session_tracking matches) DESC
--   3. created_at ASC
-- Verified by hand against agansert@auroraholdings.com, aharrison@ons.org,
-- aalto@brucemaudesign.com.
--
-- FK references against losers (verified 2026-04-27 against prod):
--   session_tracking: 84 rows  (CASCADE delete rule, but we repoint to preserve)
--   welcome_survey_baseline: 1 row
--   coaching_wins, login_events, manager_surveys, scheduler_booking_links,
--   scheduler_recurring_series, welcome_survey_scale: 0 rows each (defensive UPDATEs
--   anyway in case more land between now and migration time)
--
-- Safety:
--   - Wrapped in a single transaction
--   - Post-condition assertion (RAISE EXCEPTION) blocks the UNIQUE creation if any
--     dupes remain
--   - All UPDATEs are FK-repoints; only employee_manager DELETEs lose rows
--   - Re-running this migration on a clean DB is a no-op (the CTE finds no dupes,
--     all UPDATEs match nothing, the assertion passes, the index already exists)

BEGIN;

-- 1) Materialize the dedupe plan (winner per group + losers to delete)
CREATE TEMP TABLE _dedupe_plan ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    em.id,
    lower(em.company_email) AS email_lower,
    em.company_id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(em.company_email), em.company_id
      ORDER BY
        (em.coach_id IS NOT NULL) DESC,
        (SELECT COUNT(*) FROM session_tracking st WHERE st.employee_id = em.id) DESC,
        em.created_at ASC
    ) AS rn
  FROM employee_manager em
  WHERE em.company_email IS NOT NULL
    AND em.company_id IS NOT NULL
    AND (lower(em.company_email), em.company_id) IN (
      SELECT lower(company_email), company_id
      FROM employee_manager
      WHERE company_email IS NOT NULL AND company_id IS NOT NULL
      GROUP BY lower(company_email), company_id
      HAVING COUNT(*) > 1
    )
)
SELECT
  l.id AS loser_id,
  w.id AS winner_id
FROM ranked l
JOIN ranked w
  ON w.email_lower = l.email_lower
 AND w.company_id = l.company_id
 AND w.rn = 1
WHERE l.rn > 1;

-- 2) Repoint FKs onto the winner (one UPDATE per referencing table; defensive — most
-- have zero loser refs as of 2026-04-27, but the migration is idempotent and races
-- between dry-run and apply could change that).
UPDATE session_tracking SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE session_tracking.employee_id = p.loser_id;

UPDATE welcome_survey_baseline SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE welcome_survey_baseline.employee_id = p.loser_id;

UPDATE welcome_survey_scale SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE welcome_survey_scale.employee_id = p.loser_id;

UPDATE coaching_wins SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE coaching_wins.employee_id = p.loser_id;

UPDATE login_events SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE login_events.employee_id = p.loser_id;

UPDATE manager_surveys SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE manager_surveys.employee_id = p.loser_id;

UPDATE scheduler_booking_links SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE scheduler_booking_links.employee_id = p.loser_id;

UPDATE scheduler_recurring_series SET employee_id = p.winner_id
  FROM _dedupe_plan p WHERE scheduler_recurring_series.employee_id = p.loser_id;

-- 3) Promote a salesforce_contact_id onto the winner if winner has none.
-- Codebase convention is 15-char canonical (sf-contact-sync uses sfId15 helper),
-- so prefer 15-char loser values; fall back to 18-char truncated to 15 chars.
UPDATE employee_manager w
   SET salesforce_contact_id = (
         SELECT
           CASE
             WHEN length(em.salesforce_contact_id) >= 15
               THEN substring(em.salesforce_contact_id from 1 for 15)
             ELSE em.salesforce_contact_id
           END
         FROM employee_manager em
         JOIN _dedupe_plan p ON p.loser_id = em.id
         WHERE p.winner_id = w.id
           AND em.salesforce_contact_id IS NOT NULL
         ORDER BY length(em.salesforce_contact_id) ASC  -- prefer 15-char
         LIMIT 1
       )
 WHERE w.id IN (SELECT winner_id FROM _dedupe_plan)
   AND w.salesforce_contact_id IS NULL;

-- 4) Drop the losers
DELETE FROM employee_manager
WHERE id IN (SELECT loser_id FROM _dedupe_plan);

-- 5) Post-condition: zero dupes remain in the constrained scope
DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM (
    SELECT 1 FROM employee_manager
    WHERE company_email IS NOT NULL AND company_id IS NOT NULL
    GROUP BY lower(company_email), company_id
    HAVING COUNT(*) > 1
  ) x;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Phase C dedupe incomplete: % groups still duplicated', remaining;
  END IF;
END $$;

-- 6) Add the partial UNIQUE index. Rows with NULL company_id or NULL company_email
-- are excluded — those are legacy/ungated rows (~121 with NULL company, ~313 with
-- NULL email) that need a separate cleanup pass.
CREATE UNIQUE INDEX IF NOT EXISTS employee_manager_email_company_uniq
  ON employee_manager (lower(company_email), company_id)
  WHERE company_id IS NOT NULL AND company_email IS NOT NULL;

COMMIT;
