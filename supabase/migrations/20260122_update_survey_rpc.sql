-- Migration: Update submit_survey_for_user to populate employee data and new fields
-- Date: 2026-01-22

-- Drop existing function versions
DROP FUNCTION IF EXISTS submit_survey_for_user(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS submit_survey_for_user(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, BOOLEAN, INTEGER, BOOLEAN, TEXT[], BOOLEAN);

CREATE OR REPLACE FUNCTION submit_survey_for_user(
  user_email TEXT,
  p_survey_type TEXT,
  p_coach_name TEXT DEFAULT NULL,
  p_coach_satisfaction INTEGER DEFAULT NULL,
  p_outcomes TEXT DEFAULT NULL,
  p_feedback_suggestions TEXT DEFAULT NULL,
  p_nps INTEGER DEFAULT NULL,
  p_open_to_testimonial BOOLEAN DEFAULT FALSE,
  -- New fields for check-in survey
  p_match_rating INTEGER DEFAULT NULL,
  p_next_session_booked BOOLEAN DEFAULT NULL,
  p_not_booked_reasons TEXT[] DEFAULT NULL,
  p_open_to_followup BOOLEAN DEFAULT NULL
)
RETURNS survey_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result survey_submissions;
  emp_record RECORD;
BEGIN
  -- Look up employee data
  SELECT
    e.first_name,
    e.last_name,
    COALESCE(e.first_name || ' ' || e.last_name, e.first_name, e.last_name) as participant_name,
    e.account_name,
    e.program_title,
    e.program_type
  INTO emp_record
  FROM employees e
  WHERE lower(e.company_email) = lower(user_email)
  LIMIT 1;

  INSERT INTO survey_submissions (
    email,
    first_name,
    last_name,
    participant_name,
    account_name,
    program_title,
    program_type,
    survey_type,
    coach_name,
    coach_satisfaction,
    outcomes,
    feedback_suggestions,
    nps,
    open_to_testimonial,
    match_rating,
    next_session_booked,
    not_booked_reasons,
    open_to_followup,
    submitted_at
  ) VALUES (
    lower(user_email),
    emp_record.first_name,
    emp_record.last_name,
    emp_record.participant_name,
    emp_record.account_name,
    emp_record.program_title,
    emp_record.program_type,
    p_survey_type,
    p_coach_name,
    p_coach_satisfaction,
    p_outcomes,
    p_feedback_suggestions,
    p_nps,
    p_open_to_testimonial,
    p_match_rating,
    p_next_session_booked,
    p_not_booked_reasons,
    p_open_to_followup,
    NOW()
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_survey_for_user TO authenticated;
