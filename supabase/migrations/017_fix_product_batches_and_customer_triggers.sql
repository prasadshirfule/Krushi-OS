-- Migration 017: Fix product_batches expiry_date nullability and correct customer linking triggers
-- 1. Makes product_batches.expiry_date nullable for non-perishable / optional expiry products.
-- 2. Corrects the product_batches manufacturing vs expiry date check constraint.
-- 3. Fixes auto_link_shop_customer_on_save and link_shop_customers_on_account_create triggers
--    so they safely operate on customers.mobile only without referencing non-existent customers.email.

-- ============================================================================
-- PART 1: PRODUCT BATCHES EXPIRY DATE FIX
-- ============================================================================

-- 1. Make expiry_date nullable on product_batches
ALTER TABLE public.product_batches
  ALTER COLUMN expiry_date DROP NOT NULL;

-- 2. Drop existing expiry check constraint (dynamic lookup + common names)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.product_batches'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%expiry_date%manufacturing_date%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.product_batches DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.product_batches DROP CONSTRAINT IF EXISTS product_batches_check;
ALTER TABLE public.product_batches DROP CONSTRAINT IF EXISTS product_batches_expiry_date_check;
ALTER TABLE public.product_batches DROP CONSTRAINT IF EXISTS product_batches_expiry_check;

-- 3. Add corrected check constraint: allow nulls on either date; enforce expiry > manufacturing only when both exist
ALTER TABLE public.product_batches
  ADD CONSTRAINT product_batches_expiry_check
  CHECK (
    expiry_date IS NULL
    OR manufacturing_date IS NULL
    OR expiry_date > manufacturing_date
  );

-- ============================================================================
-- PART 2: CUSTOMER TRIGGER FIX (REMOVE ERRONEOUS customers.email REFERENCES)
-- ============================================================================

-- 1. Link existing shop customers to a customer account by mobile ONLY
CREATE OR REPLACE FUNCTION link_shop_customers_on_account_create()
RETURNS TRIGGER AS $$
BEGIN
  -- When a customer account is created or mobile updated,
  -- link existing shop customer records matching this normalized mobile
  IF NEW.mobile IS NOT NULL AND NEW.mobile != '' THEN
    UPDATE public.customers
    SET customer_account_id = NEW.id
    WHERE customer_account_id IS NULL
      AND normalize_indian_mobile(mobile) = NEW.mobile;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Auto-link new or updated shop customer records to existing customer account by mobile ONLY
CREATE OR REPLACE FUNCTION auto_link_shop_customer_on_save()
RETURNS TRIGGER AS $$
DECLARE
  v_matched_account_id UUID;
  v_normalized_mobile VARCHAR;
BEGIN
  IF NEW.customer_account_id IS NULL THEN
    IF NEW.mobile IS NOT NULL AND NEW.mobile != '' THEN
      v_normalized_mobile := normalize_indian_mobile(NEW.mobile);

      IF v_normalized_mobile IS NOT NULL THEN
        SELECT id
        INTO v_matched_account_id
        FROM public.customer_accounts
        WHERE mobile = v_normalized_mobile
        LIMIT 1;

        IF v_matched_account_id IS NOT NULL THEN
          NEW.customer_account_id := v_matched_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
