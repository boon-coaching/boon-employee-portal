-- Add 'checkin' to the survey_type constraint

-- Drop the existing constraint
ALTER TABLE survey_submissions
DROP CONSTRAINT IF EXISTS survey_submissions_survey_type_check;

-- Allow NULL or any of the defined types
ALTER TABLE survey_submissions
ADD CONSTRAINT survey_submissions_survey_type_check
CHECK (survey_type IS NULL OR survey_type IN ('first_session', 'feedback', 'touchpoint', 'end_of_program', 'checkin'));
