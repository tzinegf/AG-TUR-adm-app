-- Schema for coupons management

-- Ensure required extension for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Optional enums (keeping text + CHECKs for portability)
-- CREATE TYPE discount_type AS ENUM ('percentage','fixed');
-- CREATE TYPE coupon_status AS ENUM ('active','inactive');

-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (
    discount_value > 0 AND (
      (discount_type = 'percentage' AND discount_value <= 100) OR
      (discount_type = 'fixed')
    )
  ),
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons (code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON public.coupons (status);
CREATE INDEX IF NOT EXISTS idx_coupons_ends_at ON public.coupons (ends_at);

-- Create coupon usages table
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_before numeric(10,2) NOT NULL CHECK (amount_before >= 0),
  amount_discount numeric(10,2) NOT NULL CHECK (amount_discount >= 0),
  amount_after numeric(10,2) NOT NULL CHECK (amount_after >= 0),
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Enforce only one coupon per booking
  CONSTRAINT uq_coupon_usage_booking UNIQUE (booking_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON public.coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_booking ON public.coupon_usages (booking_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON public.coupon_usages (user_id);
-- Unique usage per user per coupon (when user is known)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_coupon_usage_user_nonnull'
  ) THEN
    CREATE UNIQUE INDEX uq_coupon_usage_user_nonnull
    ON public.coupon_usages (coupon_id, user_id)
    WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- Triggers: validate coupon usage and maintain used_count

-- Validation function
CREATE OR REPLACE FUNCTION public.validate_coupon_usage() RETURNS trigger AS $$
DECLARE
  c RECORD;
  already_used boolean;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE id = NEW.coupon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupom inexistente';
  END IF;

  -- Status ativo
  IF c.status <> 'active' THEN
    RAISE EXCEPTION 'Cupom inativo';
  END IF;

  -- Janela de validade
  IF c.starts_at IS NOT NULL AND NEW.applied_at < c.starts_at THEN
    RAISE EXCEPTION 'Cupom ainda não é válido';
  END IF;
  IF c.ends_at IS NOT NULL AND NEW.applied_at > c.ends_at THEN
    RAISE EXCEPTION 'Cupom expirado';
  END IF;

  -- Limite de uso
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RAISE EXCEPTION 'Limite de uso do cupom atingido';
  END IF;

  -- Uso único por usuário (quando conhecido)
  IF NEW.user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.coupon_usages cu
      WHERE cu.coupon_id = NEW.coupon_id AND cu.user_id = NEW.user_id
    ) INTO already_used;
    IF already_used THEN
      RAISE EXCEPTION 'Usuário já utilizou este cupom';
    END IF;
  END IF;

  -- Consistência dos valores
  IF NEW.amount_after <> (NEW.amount_before - NEW.amount_discount) THEN
    RAISE EXCEPTION 'Valores inconsistentes: after != before - discount';
  END IF;
  IF NEW.amount_discount < 0 OR NEW.amount_after < 0 THEN
    RAISE EXCEPTION 'Valores inválidos';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Increment function
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Decrement function
CREATE OR REPLACE FUNCTION public.decrement_coupon_used_count() RETURNS trigger AS $$
BEGIN
  UPDATE public.coupons
  SET used_count = GREATEST(used_count - 1, 0),
      updated_at = now()
  WHERE id = OLD.coupon_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS coupon_usage_validate ON public.coupon_usages;
CREATE TRIGGER coupon_usage_validate
BEFORE INSERT ON public.coupon_usages
FOR EACH ROW EXECUTE FUNCTION public.validate_coupon_usage();

DROP TRIGGER IF EXISTS coupon_usage_inc ON public.coupon_usages;
CREATE TRIGGER coupon_usage_inc
AFTER INSERT ON public.coupon_usages
FOR EACH ROW EXECUTE FUNCTION public.increment_coupon_used_count();

DROP TRIGGER IF EXISTS coupon_usage_dec ON public.coupon_usages;
CREATE TRIGGER coupon_usage_dec
AFTER DELETE ON public.coupon_usages
FOR EACH ROW EXECUTE FUNCTION public.decrement_coupon_used_count();