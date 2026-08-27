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

-- 8. Process Sale (Atomic Transaction)
CREATE OR REPLACE FUNCTION process_sale(
  p_shop_id UUID,
  p_user_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_payments JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_invoice_number VARCHAR;
  v_sale_id UUID;
  v_item JSONB;
  v_payment JSONB;
  v_product_id UUID;
  v_batch_id UUID;
  v_qty INTEGER;
  v_unit_price DECIMAL(12,2);
  v_cost_price DECIMAL(12,2);
  v_disc_pct DECIMAL(5,2);
  v_gst_rate DECIMAL(4,2);
  v_subtotal DECIMAL(14,2) := 0;
  v_total_discount DECIMAL(12,2) := 0;
  v_total_tax DECIMAL(12,2) := 0;
  v_grand_total DECIMAL(14,2) := 0;
  v_total_profit DECIMAL(14,2) := 0;
  v_paid_amount DECIMAL(14,2) := 0;
  v_due_amount DECIMAL(14,2) := 0;
  v_payment_status VARCHAR;
  v_product_name VARCHAR;
  v_curr_stock INTEGER;
  v_item_subtotal DECIMAL(12,2);
  v_item_disc DECIMAL(12,2);
  v_item_tax DECIMAL(12,2);
  v_item_total DECIMAL(12,2);
  v_item_profit DECIMAL(12,2);
  v_new_cust_balance DECIMAL(14,2);
BEGIN
  -- 1. Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_sale_id FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'duplicate', true);
    END IF;
  END IF;

  -- 2. Generate Invoice Number (Locks shop row)
  v_invoice_number := generate_invoice_number(p_shop_id);

  -- 3. Calculate Item Totals & Validate Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_disc_pct := COALESCE((v_item->>'discount_percent')::DECIMAL, 0);
    v_gst_rate := COALESCE((v_item->>'gst_rate')::DECIMAL, 0);

    SELECT name, current_stock, purchase_price 
    INTO v_product_name, v_curr_stock, v_cost_price
    FROM products 
    WHERE id = v_product_id AND shop_id = p_shop_id FOR UPDATE;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;

    IF v_curr_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', v_product_name, v_curr_stock, v_qty;
    END IF;

    v_item_subtotal := v_qty * v_unit_price;
    v_item_disc := (v_item_subtotal * v_disc_pct) / 100.0;
    v_item_tax := ((v_item_subtotal - v_item_disc) * v_gst_rate) / 100.0;
    v_item_profit := (v_unit_price - v_cost_price) * v_qty - v_item_disc;

    v_subtotal := v_subtotal + v_item_subtotal;
    v_total_discount := v_total_discount + v_item_disc;
    v_total_tax := v_total_tax + v_item_tax;
    v_total_profit := v_total_profit + v_item_profit;
  END LOOP;

  v_grand_total := v_subtotal - v_total_discount + v_total_tax;

  -- 4. Calculate Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_paid_amount := v_paid_amount + (v_payment->>'amount')::DECIMAL;
  END LOOP;

  v_due_amount := GREATEST(0, v_grand_total - v_paid_amount);

  IF v_paid_amount >= v_grand_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'credit';
  END IF;

  -- 5. Insert Sale Header
  INSERT INTO sales (
    shop_id, customer_id, invoice_number, sale_date, subtotal, discount_amount,
    tax_amount, total_amount, profit_amount, payment_status, status,
    idempotency_key, created_by
  ) VALUES (
    p_shop_id, p_customer_id, v_invoice_number, NOW(), v_subtotal, v_total_discount,
    v_total_tax, v_grand_total, v_total_profit, v_payment_status, 'completed',
    p_idempotency_key, p_user_id
  ) RETURNING id INTO v_sale_id;

  -- 6. Insert Sale Items & Deduct Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_batch_id := NULL;
    IF v_item->>'batch_id' IS NOT NULL AND (v_item->>'batch_id') != '' THEN
      v_batch_id := (v_item->>'batch_id')::UUID;
    END IF;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_disc_pct := COALESCE((v_item->>'discount_percent')::DECIMAL, 0);
    v_gst_rate := COALESCE((v_item->>'gst_rate')::DECIMAL, 0);

    SELECT name, current_stock, purchase_price INTO v_product_name, v_curr_stock, v_cost_price
    FROM products WHERE id = v_product_id;

    v_item_subtotal := v_qty * v_unit_price;
    v_item_disc := (v_item_subtotal * v_disc_pct) / 100.0;
    v_item_tax := ((v_item_subtotal - v_item_disc) * v_gst_rate) / 100.0;
    v_item_total := (v_item_subtotal - v_item_disc) + v_item_tax;
    v_item_profit := (v_unit_price - v_cost_price) * v_qty - v_item_disc;

    INSERT INTO sale_items (
      sale_id, product_id, batch_id, product_name, quantity, unit_price, cost_price,
      discount_percent, discount_amount, gst_rate, tax_amount, total_amount, profit_amount
    ) VALUES (
      v_sale_id, v_product_id, v_batch_id, v_product_name, v_qty, v_unit_price, v_cost_price,
      v_disc_pct, v_item_disc, v_gst_rate, v_item_tax, v_item_total, v_item_profit
    );

    UPDATE products SET current_stock = GREATEST(0, current_stock - v_qty) WHERE id = v_product_id;

    IF v_batch_id IS NOT NULL THEN
      UPDATE product_batches 
      SET quantity_available = GREATEST(0, quantity_available - v_qty)
      WHERE id = v_batch_id;
    END IF;

    INSERT INTO stock_transactions (
      shop_id, product_id, batch_id, transaction_type, previous_quantity,
      quantity_change, new_quantity, reason, reference_type, reference_id, created_by
    ) VALUES (
      p_shop_id, v_product_id, v_batch_id, 'SALE_OUT', v_curr_stock,
      -v_qty, GREATEST(0, v_curr_stock - v_qty), 'Sale ' || v_invoice_number, 'SALE', v_sale_id, p_user_id
    );
  END LOOP;

  -- 7. Record Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_payment->>'amount')::DECIMAL > 0 THEN
      INSERT INTO payments (
        shop_id, payment_type, reference_type, reference_id, customer_id,
        payment_method, amount, notes, created_by
      ) VALUES (
        p_shop_id, 'SALE', 'SALE', v_sale_id, p_customer_id,
        (v_payment->>'method')::VARCHAR, (v_payment->>'amount')::DECIMAL, p_notes, p_user_id
      );
    END IF;
  END LOOP;

  -- 8. Customer Ledger
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers 
    SET total_purchases = total_purchases + v_grand_total,
        total_paid = total_paid + v_paid_amount,
        outstanding = outstanding + v_due_amount
    WHERE id = p_customer_id
    RETURNING outstanding INTO v_new_cust_balance;

    INSERT INTO customer_ledger (
      shop_id, customer_id, description, reference_type, reference_id,
      debit, credit, balance, notes, created_by
    ) VALUES (
      p_shop_id, p_customer_id, 'Invoice #' || v_invoice_number, 'SALE', v_sale_id,
      v_grand_total, v_paid_amount, v_new_cust_balance, p_notes, p_user_id
    );
  END IF;

  -- 9. Audit Log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'CREATE_SALE', 'SALE', v_sale_id, jsonb_build_object('invoice_number', v_invoice_number, 'total_amount', v_grand_total));

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'invoice_number', v_invoice_number, 'grand_total', v_grand_total);
END;
$$ LANGUAGE plpgsql;
