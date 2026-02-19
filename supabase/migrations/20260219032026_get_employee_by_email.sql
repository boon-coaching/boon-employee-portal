CREATE OR REPLACE FUNCTION get_employee_by_email(lookup_email TEXT)
RETURNS SETOF employee_manager
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM employee_manager
  WHERE lower(company_email) = lower(lookup_email)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_by_email TO anon, authenticated;
