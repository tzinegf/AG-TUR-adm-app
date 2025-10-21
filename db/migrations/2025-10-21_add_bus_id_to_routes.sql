-- Migration: Add bus_id to routes with FK to buses(id)
-- Context: This project models buses in table public.buses (id uuid)
-- This allows linking each route to a specific bus

BEGIN;

-- 1) Add column (nullable for backward compatibility)
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS bus_id uuid;

-- 2) Add FK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_routes_bus_id_buses'
      AND conrelid = 'public.routes'::regclass
  ) THEN
    ALTER TABLE public.routes
      ADD CONSTRAINT fk_routes_bus_id_buses
      FOREIGN KEY (bus_id)
      REFERENCES public.buses (id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 3) Add index for efficient lookups by bus
CREATE INDEX IF NOT EXISTS idx_routes_bus_id
  ON public.routes (bus_id);

COMMIT;

-- Optional Down Migration (Rollback)
-- BEGIN;
-- DROP INDEX IF EXISTS idx_routes_bus_id;
-- ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS fk_routes_bus_id_buses;
-- ALTER TABLE public.routes DROP COLUMN IF EXISTS bus_id;
-- COMMIT;