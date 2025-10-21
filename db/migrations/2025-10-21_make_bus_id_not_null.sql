-- Migration: Enforce NOT NULL on routes.bus_id
-- Context: After linking UI enforces bus selection, persist constraint in DB

BEGIN;

-- Safety check: prevent applying NOT NULL if there are existing NULLs
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.routes WHERE bus_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot set bus_id NOT NULL: % route(s) have NULL bus_id. Please fix data before migrating.', null_count;
  END IF;
END
$$;

-- Enforce NOT NULL on bus_id
ALTER TABLE public.routes
  ALTER COLUMN bus_id SET NOT NULL;

COMMIT;

-- Optional Down Migration (Rollback)
-- BEGIN;
-- ALTER TABLE public.routes
--   ALTER COLUMN bus_id DROP NOT NULL;
-- COMMIT;