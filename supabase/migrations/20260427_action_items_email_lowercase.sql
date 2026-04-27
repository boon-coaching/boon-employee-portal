-- Force action_items.email lowercase so the existing `(lower(email), status)`
-- index is hit by .eq('email', lowercase) from the client.
--
-- Why: the home page calls fetchActionItems on every load with
--   .ilike('email', email).gte('created_at', ninetyDaysAgo).limit(100)
-- ILIKE-with-no-wildcards looks like equality but the planner can't use the
-- functional index on lower(email), so the query falls back to a parallel
-- sequential scan of all 218k rows. EXPLAIN: 165 ms hot, statement_timeout
-- (~9-10s) cold. Rewriting the client to .eq('email', email.toLowerCase())
-- drops it to 0.19 ms by hitting idx_action_items_email_status — but that
-- only works if stored emails are already lowercase. Today 13,947 rows
-- (220 distinct users) have mixed-case emails. Without this backfill,
-- those users would silently see zero action items.
--
-- Backfill is safe: action_items.email is a non-PK string column, never
-- referenced by any FK, and emails are case-insensitive by RFC. Six
-- emails have a lowercase twin already; UPDATE merges them into the
-- canonical lowercase form. No row count change.

UPDATE public.action_items
   SET email = lower(email)
 WHERE email IS NOT NULL
   AND email != lower(email);

-- Trigger keeps the invariant for new inserts/updates so the client can
-- rely on .eq('email', email.toLowerCase()) without case-drift recurring.
CREATE OR REPLACE FUNCTION public.action_items_lowercase_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_items_lowercase_email ON public.action_items;
CREATE TRIGGER trg_action_items_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON public.action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.action_items_lowercase_email();
