-- Migration 012: Customer Portal & Multi-Shop Security Architecture
-- Adds customer accounts, multi-shop customer linking, customer notifications, and Customer RLS policies.

-- 1. Mobile Number Normalization Utility
CREATE OR REPLACE FUNCTION normalize_indian_mobile(p_mobile TEXT)
RETURNS VARCHAR AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_mobile IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove all non-digit characters
  v_digits := regexp_replace(p_mobile, '\D', '', 'g');

  -- Case 1: 12 digits starting with '91' (e.g., 919876543210)
  IF length(v_digits) = 12 AND v_digits LIKE '91%' THEN
    v_digits := substring(v_digits FROM 3);
  END IF;

  -- Case 2: 11 digits starting with '0' (e.g., 09876543210)
  IF length(v_digits) = 11 AND v_digits LIKE '0%' THEN
    v_digits := substring(v_digits FROM 2);
  END IF;

  -- Verify valid Indian 10-digit mobile starting with 6, 7, 8, or 9
  IF length(v_digits) = 10 AND v_digits ~ '^[6-9][0-9]{9}$' THEN
    RETURN v_digits;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Customer Accounts Table
CREATE TABLE IF NOT EXISTS customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile VARCHAR(15) UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR,
  village VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_accounts_auth_user ON customer_accounts(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_mobile ON customer_accounts(mobile);

DROP TRIGGER IF EXISTS set_customer_accounts_updated_at ON customer_accounts;
CREATE TRIGGER set_customer_accounts_updated_at
BEFORE UPDATE ON customer_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Add customer_account_id to shop customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_account_id ON customers(customer_account_id);

-- 4. Customer Notifications Table
CREATE TABLE IF NOT EXISTS customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  type VARCHAR NOT NULL CHECK (type IN ('NEW_BILL', 'PAYMENT_RECEIVED', 'OUTSTANDING_REMINDER', 'SALE_RETURN', 'INFO')),
  title VARCHAR NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_account_read ON customer_notifications(customer_account_id, is_read);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at DESC);

-- 5. Helper Function: Get Current Authenticated Customer Account ID
CREATE OR REPLACE FUNCTION get_customer_account_id()
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id
  FROM public.customer_accounts
  WHERE auth_user_id = auth.uid();
  
  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Trigger: Link Existing Shop Customers when a Customer Account is Registered
CREATE OR REPLACE FUNCTION link_shop_customers_on_account_create()
RETURNS TRIGGER AS $$
BEGIN
  -- When a verified customer account is created or mobile updated,
  -- securely link all shop customer records matching this verified normalized mobile number
  IF NEW.mobile IS NOT NULL THEN
    UPDATE public.customers
    SET customer_account_id = NEW.id
    WHERE customer_account_id IS NULL
      AND normalize_indian_mobile(mobile) = NEW.mobile;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_link_shop_customers_on_account_create ON customer_accounts;
CREATE TRIGGER trg_link_shop_customers_on_account_create
AFTER INSERT OR UPDATE OF mobile ON customer_accounts
FOR EACH ROW EXECUTE FUNCTION link_shop_customers_on_account_create();

-- 7. Trigger: Auto-link New or Updated Shop Customer Records to existing Customer Accounts
CREATE OR REPLACE FUNCTION auto_link_shop_customer_on_save()
RETURNS TRIGGER AS $$
DECLARE
  v_matched_account_id UUID;
  v_normalized_mobile VARCHAR;
BEGIN
  IF NEW.customer_account_id IS NULL AND NEW.mobile IS NOT NULL THEN
    v_normalized_mobile := normalize_indian_mobile(NEW.mobile);
    
    IF v_normalized_mobile IS NOT NULL THEN
      SELECT id INTO v_matched_account_id
      FROM public.customer_accounts
      WHERE mobile = v_normalized_mobile
      LIMIT 1;

      IF v_matched_account_id IS NOT NULL THEN
        NEW.customer_account_id := v_matched_account_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_link_shop_customer_on_save ON customers;
CREATE TRIGGER trg_auto_link_shop_customer_on_save
BEFORE INSERT OR UPDATE OF mobile ON customers
FOR EACH ROW EXECUTE FUNCTION auto_link_shop_customer_on_save();

-- 8. Trigger: Create Customer Notification on Sale Creation (Safe execution)
CREATE OR REPLACE FUNCTION notify_customer_on_new_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_shop_name VARCHAR;
  v_invoice_num VARCHAR;
  v_amount DECIMAL;
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_account_id INTO v_account_id
    FROM public.customers
    WHERE id = NEW.customer_id;

    IF v_account_id IS NOT NULL THEN
      SELECT name INTO v_shop_name FROM public.shops WHERE id = NEW.shop_id;
      v_shop_name := COALESCE(v_shop_name, 'Krushi Kendra');
      v_invoice_num := COALESCE(NEW.invoice_number, 'Bill');
      v_amount := COALESCE(NEW.total_amount, 0);

      INSERT INTO public.customer_notifications (
        customer_account_id,
        shop_id,
        sale_id,
        type,
        title,
        message
      ) VALUES (
        v_account_id,
        NEW.shop_id,
        NEW.id,
        'NEW_BILL',
        'New Bill Received',
        'Invoice #' || v_invoice_num || ' of ₹' || v_amount::TEXT || ' generated from ' || v_shop_name
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the shopkeeper's sale transaction if notification logging encounters an edge case
  RAISE WARNING 'Customer notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_customer_on_new_sale ON sales;
CREATE TRIGGER trg_notify_customer_on_new_sale
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION notify_customer_on_new_sale();

-- 9. Row Level Security Policies for Customer Portal

-- Enable RLS on newly created tables
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

-- customer_accounts RLS
DROP POLICY IF EXISTS "Customers can view own account" ON customer_accounts;
CREATE POLICY "Customers can view own account"
ON customer_accounts FOR SELECT
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own account" ON customer_accounts;
CREATE POLICY "Customers can update own account"
ON customer_accounts FOR UPDATE
USING (auth_user_id = auth.uid());

-- customers table: Customer can view their linked records across all shops
DROP POLICY IF EXISTS "Customers can view own linked customer records" ON customers;
CREATE POLICY "Customers can view own linked customer records"
ON customers FOR SELECT
USING (
  customer_account_id IS NOT NULL
  AND customer_account_id = get_customer_account_id()
);

-- sales table: Customer can view sales belonging to their linked records
DROP POLICY IF EXISTS "Customers can view own sales" ON sales;
CREATE POLICY "Customers can view own sales"
ON sales FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE customer_account_id = get_customer_account_id()
  )
);

-- sale_items table: Customer can view items of their sales
DROP POLICY IF EXISTS "Customers can view own sale_items" ON sale_items;
CREATE POLICY "Customers can view own sale_items"
ON sale_items FOR SELECT
USING (
  sale_id IN (
    SELECT s.id FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE c.customer_account_id = get_customer_account_id()
  )
);

-- payments table: Customer can view payments for their linked records
DROP POLICY IF EXISTS "Customers can view own payments" ON payments;
CREATE POLICY "Customers can view own payments"
ON payments FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE customer_account_id = get_customer_account_id()
  )
);

-- customer_ledger table: Customer can view ledger entries for their linked records
DROP POLICY IF EXISTS "Customers can view own customer_ledger" ON customer_ledger;
CREATE POLICY "Customers can view own customer_ledger"
ON customer_ledger FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE customer_account_id = get_customer_account_id()
  )
);

-- shops table: Customer can view basic shop info for shops where they have linked records
DROP POLICY IF EXISTS "Customers can view shops of their purchases" ON shops;
CREATE POLICY "Customers can view shops of their purchases"
ON shops FOR SELECT
USING (
  id IN (
    SELECT shop_id FROM customers WHERE customer_account_id = get_customer_account_id()
  )
);

-- customer_notifications table RLS
DROP POLICY IF EXISTS "Customers can view own notifications" ON customer_notifications;
CREATE POLICY "Customers can view own notifications"
ON customer_notifications FOR SELECT
USING (customer_account_id = get_customer_account_id());

DROP POLICY IF EXISTS "Customers can update own notifications" ON customer_notifications;
CREATE POLICY "Customers can update own notifications"
ON customer_notifications FOR UPDATE
USING (customer_account_id = get_customer_account_id())
WITH CHECK (customer_account_id = get_customer_account_id());
