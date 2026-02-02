-- Migration: Fix survey_type constraint issue
-- Date: 2026-02-02
-- Problem: The original migration created an unnamed inline CHECK constraint
-- that later migrations couldn't drop (they tried to drop a named constraint).
-- This resulted in TWO constraints, one of which doesn't include grow_midpoint.

-- Step 1: Find and drop ALL check constraints on survey_type column
-- This handles both the unnamed inline constraint and the named one
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Loop through all check constraints on survey_submissions table
    -- that reference survey_type column
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'survey_submissions'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'  -- 'c' = check constraint
          AND pg_get_constraintdef(con.oid) LIKE '%survey_type%'
    LOOP
        EXECUTE format('ALTER TABLE survey_submissions DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END LOOP;
END $$;

-- Step 2: Add the correct named constraint with ALL survey types
ALTER TABLE survey_submissions
ADD CONSTRAINT survey_submissions_survey_type_check
CHECK (survey_type IN (
    'scale_feedback',
    'scale_end',
    'grow_baseline',
    'grow_first_session',
    'grow_midpoint',
    'grow_end'
));
