-- 1. Generate Invoice Number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_shop_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_counter INTEGER;
  v_invoice_number VARCHAR;
BEGIN
  -- Lock the shop row to prevent race conditions
  SELECT invoice_prefix, invoice_counter + 1 
  INTO v_prefix, v_counter
  FROM shops
  WHERE id = p_shop_id
  FOR UPDATE;

  -- Format with 6 digits (e.g., KOS-000001)
  v_invoice_number := v_prefix || '-' || LPAD(v_counter::TEXT, 6, '0');

  -- Update the counter
  UPDATE shops
  SET invoice_counter = v_counter
  WHERE id = p_shop_id;

  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Get Expiry Status
CREATE OR REPLACE FUNCTION get_expiry_status(expiry_date DATE)
RETURNS VARCHAR AS $$
DECLARE
  v_days INTEGER;
BEGIN
  v_days := expiry_date - CURRENT_DATE;
  
  IF v_days < 0 THEN
    RETURN 'EXPIRED';
  ELSIF v_days <= 30 THEN
    RETURN 'URGENT';
  ELSIF v_days <= 90 THEN
    RETURN 'WARNING';
  ELSIF v_days <= 180 THEN
    RETURN 'EXPIRING_SOON';
  ELSE
    RETURN 'NORMAL';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Get Dashboard Counts
CREATE OR REPLACE FUNCTION get_dashboard_counts(p_shop_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_low_stock_count INTEGER;
  v_expiring_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_low_stock_count
  FROM products
  WHERE shop_id = p_shop_id AND current_stock <= min_stock AND is_active = true;

  SELECT COUNT(*) INTO v_expiring_count
  FROM product_batches
  WHERE shop_id = p_shop_id AND quantity_available > 0 AND expiry_date <= (CURRENT_DATE + INTERVAL '90 days') AND is_active = true;

  RETURN jsonb_build_object(
    'low_stock_count', v_low_stock_count,
    'expiring_count', v_expiring_count
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Get Top Products
CREATE OR REPLACE FUNCTION get_top_products(p_shop_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  total_sold BIGINT,
  revenue DECIMAL(14,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    COALESCE(SUM(si.quantity), 0)::BIGINT AS total_sold,
    COALESCE(SUM(si.total_amount), 0)::DECIMAL(14,2) AS revenue
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  JOIN products p ON p.id = si.product_id
  WHERE s.shop_id = p_shop_id AND s.status = 'completed'
  GROUP BY p.id, p.name
  ORDER BY revenue DESC, total_sold DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Get Low Stock Products
CREATE OR REPLACE FUNCTION get_low_stock_products(p_shop_id UUID)
RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products
  WHERE shop_id = p_shop_id AND current_stock <= min_stock AND is_active = true
  ORDER BY current_stock ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Record Customer Payment
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_shop_id UUID,
  p_user_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL,
  p_method VARCHAR,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_new_balance DECIMAL(14,2);
BEGIN
  -- Insert into payments
  INSERT INTO payments (shop_id, payment_type, reference_type, reference_id, customer_id, payment_method, amount, notes, created_by)
  VALUES (p_shop_id, 'CUSTOMER_PAYMENT', 'CUSTOMER', p_customer_id, p_customer_id, p_method, p_amount, p_notes, p_user_id)
  RETURNING id INTO v_payment_id;

  -- Update customer total_paid and outstanding
  UPDATE customers
  SET total_paid = total_paid + p_amount,
      outstanding = GREATEST(0, outstanding - p_amount)
  WHERE id = p_customer_id
  RETURNING outstanding INTO v_new_balance;

  -- Record customer ledger
  INSERT INTO customer_ledger (shop_id, customer_id, description, reference_type, reference_id, credit, balance, notes, created_by)
  VALUES (p_shop_id, p_customer_id, 'Payment Received (' || p_method || ')', 'PAYMENT', v_payment_id, p_amount, v_new_balance, p_notes, p_user_id);

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Record Supplier Payment
CREATE OR REPLACE FUNCTION record_supplier_payment(
  p_shop_id UUID,
  p_user_id UUID,
  p_supplier_id UUID,
  p_amount DECIMAL,
  p_method VARCHAR,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_new_balance DECIMAL(14,2);
BEGIN
  INSERT INTO payments (shop_id, payment_type, reference_type, reference_id, supplier_id, payment_method, amount, notes, created_by)
  VALUES (p_shop_id, 'SUPPLIER_PAYMENT', 'SUPPLIER', p_supplier_id, p_supplier_id, p_method, p_amount, p_notes, p_user_id)
  RETURNING id INTO v_payment_id;

  UPDATE suppliers
  SET total_paid = total_paid + p_amount,
      outstanding = GREATEST(0, outstanding - p_amount)
  WHERE id = p_supplier_id
  RETURNING outstanding INTO v_new_balance;

  INSERT INTO supplier_ledger (shop_id, supplier_id, description, reference_type, reference_id, debit, balance, notes, created_by)
  VALUES (p_shop_id, p_supplier_id, 'Payment Paid (' || p_method || ')', 'PAYMENT', v_payment_id, p_amount, v_new_balance, p_notes, p_user_id);

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql;
