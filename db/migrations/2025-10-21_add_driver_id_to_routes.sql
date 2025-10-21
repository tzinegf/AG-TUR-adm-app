-- Migration: Add driver_id to routes with FK to profiles(id)
-- Context: This project models users in table public.profiles (id uuid)
-- If your users table differs, adjust the REFERENCES target accordingly.

BEGIN;

-- 1) Add column (nullable for backward compatibility)
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS driver_id uuid;

-- 2) Add FK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_routes_driver_id_profiles'
      AND conrelid = 'public.routes'::regclass
  ) THEN
    ALTER TABLE public.routes
      ADD CONSTRAINT fk_routes_driver_id_profiles
      FOREIGN KEY (driver_id)
      REFERENCES public.profiles (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 3) Add index for efficient lookups by driver
CREATE INDEX IF NOT EXISTS idx_routes_driver_id
  ON public.routes (driver_id);

COMMIT;

-- Optional Down Migration (Rollback)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_routes_driver_id;
-- ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS fk_routes_driver_id_profiles;
-- ALTER TABLE public.routes DROP COLUMN IF EXISTS driver_id;
-- COMMIT;