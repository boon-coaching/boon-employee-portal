-- Add grow_midpoint to survey_type constraint
-- This survey type is used for GROW program midpoint check-in (session 6)

-- First, drop the existing constraint
ALTER TABLE survey_submissions
DROP CONSTRAINT IF EXISTS survey_submissions_survey_type_check;

-- Update any NULL or unexpected survey_type values to a default
-- (Old surveys before the native survey system may have NULL)
UPDATE survey_submissions
SET survey_type = 'scale_feedback'
WHERE survey_type IS NULL
   OR survey_type NOT IN ('scale_feedback', 'scale_end', 'grow_baseline', 'grow_midpoint', 'grow_end');

-- Now add the new constraint that includes grow_midpoint
ALTER TABLE survey_submissions
ADD CONSTRAINT survey_submissions_survey_type_check
CHECK (survey_type IN ('scale_feedback', 'scale_end', 'grow_baseline', 'grow_midpoint', 'grow_end'));
