-- Migration 007: Inventory Sync Engine, FEFO Multi-Batch Allocation & Stock Movements

-- 1. Standardize stock_transactions CHECK constraint preserving legacy types
ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_transaction_type_check;

ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_transaction_type_check
CHECK (transaction_type IN (
  'OPENING_STOCK', 'PURCHASE_IN', 'SALE_OUT', 'SALE_RETURN', 'PURCHASE_RETURN',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGED', 'EXPIRED', 'SALE_REVERSAL',
  'RETURN_IN', 'ADJUSTMENT'
));

-- 2. Central Stock Movement Function (Single Authority for Stock Modifications)
CREATE OR REPLACE FUNCTION process_stock_movement(
  p_shop_id UUID,
  p_product_id UUID,
  p_batch_id UUID DEFAULT NULL,
  p_transaction_type VARCHAR DEFAULT 'SALE_OUT',
  p_quantity_change INTEGER DEFAULT 0, -- Positive (+) for IN, Negative (-) for OUT
  p_reason TEXT DEFAULT NULL,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_curr_stock INTEGER;
  v_new_stock INTEGER;
  v_batch_avail INTEGER;
  v_new_batch_avail INTEGER;
  v_trans_id UUID;
  v_batch_exp DATE;
BEGIN
  -- Validate Inputs
  IF p_quantity_change = 0 THEN
    RAISE EXCEPTION 'Stock movement quantity change cannot be zero';
  END IF;

  -- Validate Adjustment reason requirement
  IF p_transaction_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED') AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required for inventory adjustments';
  END IF;

  -- 1. Lock Product Row for Concurrency Safety
  SELECT current_stock INTO v_curr_stock
  FROM products
  WHERE id = p_product_id AND shop_id = p_shop_id AND is_active = true FOR UPDATE;

  IF v_curr_stock IS NULL THEN
    RAISE EXCEPTION 'Product % not found or inactive in shop %', p_product_id, p_shop_id;
  END IF;

  v_new_stock := v_curr_stock + p_quantity_change;

  -- 2. Reject Negative Stock
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient product stock (Available: %, Change: %)', v_curr_stock, p_quantity_change;
  END IF;

  -- 3. Batch Stock Validation & Locks
  IF p_batch_id IS NOT NULL THEN
    SELECT quantity_available, expiry_date INTO v_batch_avail, v_batch_exp
    FROM product_batches
    WHERE id = p_batch_id AND product_id = p_product_id AND shop_id = p_shop_id FOR UPDATE;

    IF v_batch_avail IS NULL THEN
      RAISE EXCEPTION 'Batch % not found for product % in shop %', p_batch_id, p_product_id, p_shop_id;
    END IF;

    -- Prevent selling expired batches
    IF p_transaction_type = 'SALE_OUT' AND v_batch_exp IS NOT NULL AND v_batch_exp < CURRENT_DATE THEN
      RAISE EXCEPTION 'Cannot sell product from expired batch (Expired on %)', v_batch_exp;
    END IF;

    v_new_batch_avail := v_batch_avail + p_quantity_change;

    IF v_new_batch_avail < 0 THEN
      RAISE EXCEPTION 'Insufficient batch stock (Available: %, Change: %)', v_batch_avail, p_quantity_change;
    END IF;

    -- Update Batch Stock
    UPDATE product_batches
    SET quantity_available = v_new_batch_avail
    WHERE id = p_batch_id;
  END IF;

  -- 4. Update Product Aggregate Stock
  UPDATE products
  SET current_stock = v_new_stock
  WHERE id = p_product_id;

  -- 5. Record Stock Transaction Entry
  INSERT INTO stock_transactions (
    shop_id, product_id, batch_id, transaction_type, previous_quantity,
    quantity_change, new_quantity, reason, reference_type, reference_id, created_by
  ) VALUES (
    p_shop_id, p_product_id, p_batch_id, p_transaction_type, v_curr_stock,
    p_quantity_change, v_new_stock, p_reason, p_reference_type, p_reference_id, p_user_id
  ) RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'previous_stock', v_curr_stock,
    'new_stock', v_new_stock
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Multi-Batch FEFO Allocation Function
CREATE OR REPLACE FUNCTION process_fefo_sale_deduction(
  p_shop_id UUID,
  p_product_id UUID,
  p_requested_qty INTEGER,
  p_reference_id UUID,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_batch RECORD;
  v_qty_needed INTEGER := p_requested_qty;
  v_deduct INTEGER;
  v_batch_count INTEGER := 0;
  v_allocations JSONB := '[]'::jsonb;
BEGIN
  IF p_requested_qty <= 0 THEN
    RAISE EXCEPTION 'Requested sale quantity must be greater than zero';
  END IF;

  FOR v_batch IN 
    SELECT id, batch_number, quantity_available, expiry_date
    FROM product_batches
    WHERE shop_id = p_shop_id 
      AND product_id = p_product_id 
      AND quantity_available > 0
      AND expiry_date >= CURRENT_DATE
      AND is_active = true
    ORDER BY expiry_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    IF v_qty_needed <= 0 THEN
      EXIT;
    END IF;

    v_deduct := LEAST(v_batch.quantity_available, v_qty_needed);
    
    PERFORM process_stock_movement(
      p_shop_id, p_product_id, v_batch.id, 'SALE_OUT',
      -v_deduct, 'FEFO Multi-Batch Sale Deduction', 'SALE', p_reference_id, p_user_id
    );

    v_qty_needed := v_qty_needed - v_deduct;
    v_batch_count := v_batch_count + 1;
    v_allocations := v_allocations || jsonb_build_object('batch_id', v_batch.id, 'batch_number', v_batch.batch_number, 'deducted', v_deduct);
  END LOOP;

  IF v_qty_needed > 0 THEN
    RAISE EXCEPTION 'Insufficient non-expired batch stock for product % (Short by % units)', p_product_id, v_qty_needed;
  END IF;

  RETURN jsonb_build_object('success', true, 'batch_count', v_batch_count, 'allocations', v_allocations);
END;
$$ LANGUAGE plpgsql;

-- 4. Atomic Sale Processing Procedure Integrated with Stock Engine
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
  v_batch_tracking BOOLEAN;
  v_item_subtotal DECIMAL(12,2);
  v_item_disc DECIMAL(12,2);
  v_item_tax DECIMAL(12,2);
  v_item_total DECIMAL(12,2);
  v_item_profit DECIMAL(12,2);
  v_new_cust_balance DECIMAL(14,2);
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_sale_id FROM sales WHERE idempotency_key = p_idempotency_key;
    IF v_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'duplicate', true);
    END IF;
  END IF;

  v_invoice_number := generate_invoice_number(p_shop_id);

  -- Pre-calculate economics & validate products
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_disc_pct := COALESCE((v_item->>'discount_percent')::DECIMAL, 0);
    v_gst_rate := COALESCE((v_item->>'gst_rate')::DECIMAL, 0);

    SELECT name, purchase_price INTO v_product_name, v_cost_price
    FROM products WHERE id = v_product_id AND shop_id = p_shop_id;

    IF v_product_name IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
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

  INSERT INTO sales (
    shop_id, customer_id, invoice_number, sale_date, subtotal, discount_amount,
    tax_amount, total_amount, profit_amount, payment_status, status,
    idempotency_key, created_by
  ) VALUES (
    p_shop_id, p_customer_id, v_invoice_number, NOW(), v_subtotal, v_total_discount,
    v_total_tax, v_grand_total, v_total_profit, v_payment_status, 'completed',
    p_idempotency_key, p_user_id
  ) RETURNING id INTO v_sale_id;

  -- Process Items & Stock Deductions via Central Engine
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

    SELECT name, purchase_price, batch_tracking INTO v_product_name, v_cost_price, v_batch_tracking
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

    -- Stock Movement via Stock Engine
    IF v_batch_tracking = true AND v_batch_id IS NULL THEN
      -- Execute FEFO Multi-Batch Deduction
      PERFORM process_fefo_sale_deduction(p_shop_id, v_product_id, v_qty, v_sale_id, p_user_id);
    ELSE
      -- Specific batch or normal product stock reduction
      PERFORM process_stock_movement(
        p_shop_id, v_product_id, v_batch_id, 'SALE_OUT',
        -v_qty, 'Sale Invoice #' || v_invoice_number, 'SALE', v_sale_id, p_user_id
      );
    END IF;
  END LOOP;

  -- Payments & Customer Ledger
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

  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'CREATE_SALE', 'SALE', v_sale_id, jsonb_build_object('invoice_number', v_invoice_number, 'total_amount', v_grand_total));

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'invoice_number', v_invoice_number, 'grand_total', v_grand_total);
END;
$$ LANGUAGE plpgsql;
