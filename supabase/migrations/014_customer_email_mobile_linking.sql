-- Migration 014: Customer Email & Mobile Linking
-- Extends existing customer linking to support verified email-based customer accounts.
-- Migration 013 already makes customer_accounts.mobile nullable and adds the email index.

-- 1. Link existing shop customers to customer accounts by mobile OR email
CREATE OR REPLACE FUNCTION link_shop_customers_on_account_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Link by mobile when available
  IF NEW.mobile IS NOT NULL AND NEW.mobile != '' THEN
    UPDATE public.customers
    SET customer_account_id = NEW.id
    WHERE customer_account_id IS NULL
      AND normalize_indian_mobile(mobile) = NEW.mobile;
  END IF;

  -- Link by email when available
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    UPDATE public.customers
    SET customer_account_id = NEW.id
    WHERE customer_account_id IS NULL
      AND lower(trim(email)) = lower(trim(NEW.email));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Auto-link newly created/updated shop customers
-- to an existing customer account by mobile OR email
CREATE OR REPLACE FUNCTION auto_link_shop_customer_on_save()
RETURNS TRIGGER AS $$
DECLARE
  v_matched_account_id UUID;
  v_normalized_mobile VARCHAR;
BEGIN
  IF NEW.customer_account_id IS NULL THEN

    -- Try mobile first
    IF NEW.mobile IS NOT NULL AND NEW.mobile != '' THEN
      v_normalized_mobile := normalize_indian_mobile(NEW.mobile);

      IF v_normalized_mobile IS NOT NULL THEN
        SELECT id
        INTO v_matched_account_id
        FROM public.customer_accounts
        WHERE mobile = v_normalized_mobile
        LIMIT 1;
      END IF;
    END IF;

    -- If mobile did not match, try email
    IF v_matched_account_id IS NULL
       AND NEW.email IS NOT NULL
       AND NEW.email != '' THEN

      SELECT id
      INTO v_matched_account_id
      FROM public.customer_accounts
      WHERE lower(trim(email)) = lower(trim(NEW.email))
      LIMIT 1;

    END IF;

    IF v_matched_account_id IS NOT NULL THEN
      NEW.customer_account_id := v_matched_account_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;