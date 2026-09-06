-- Migration 010: GST-Inclusive Selling Price Calculation for process_sale RPC engine

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
  v_item_cgst DECIMAL(12,2);
  v_item_sgst DECIMAL(12,2);
  v_taxable_amt DECIMAL(12,2);
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

  -- Pre-calculate economics & validate products (GST INCLUSIVE PRICING)
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

    -- GST-inclusive calculations:
    -- v_unit_price is the customer selling price INCLUDING GST
    v_item_subtotal := v_qty * v_unit_price;
    v_item_disc := (v_item_subtotal * v_disc_pct) / 100.0;
    v_item_total := v_item_subtotal - v_item_disc;

    IF v_gst_rate > 0 THEN
      v_taxable_amt := ROUND((v_item_total * 100.0 / (100.0 + v_gst_rate))::numeric, 2);
      v_item_tax := v_item_total - v_taxable_amt;
    ELSE
      v_taxable_amt := v_item_total;
      v_item_tax := 0;
    END IF;

    v_item_profit := v_taxable_amt - (v_cost_price * v_qty);

    v_subtotal := v_subtotal + v_taxable_amt;
    v_total_discount := v_total_discount + v_item_disc;
    v_total_tax := v_total_tax + v_item_tax;
    v_total_profit := v_total_profit + v_item_profit;
    v_grand_total := v_grand_total + v_item_total;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_paid_amount := v_paid_amount + COALESCE((v_payment->>'amount')::DECIMAL, 0);
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
    v_item_total := v_item_subtotal - v_item_disc;

    IF v_gst_rate > 0 THEN
      v_taxable_amt := ROUND((v_item_total * 100.0 / (100.0 + v_gst_rate))::numeric, 2);
      v_item_tax := v_item_total - v_taxable_amt;
      v_item_cgst := ROUND((v_item_tax / 2.0)::numeric, 2);
      v_item_sgst := v_item_tax - v_item_cgst;
    ELSE
      v_taxable_amt := v_item_total;
      v_item_tax := 0;
      v_item_cgst := 0;
      v_item_sgst := 0;
    END IF;

    v_item_profit := v_taxable_amt - (v_cost_price * v_qty);

    INSERT INTO sale_items (
      sale_id, product_id, batch_id, product_name, quantity, unit_price, cost_price,
      discount_percent, discount_amount, gst_rate, cgst_amount, sgst_amount, tax_amount, total_amount, profit_amount
    ) VALUES (
      v_sale_id, v_product_id, v_batch_id, v_product_name, v_qty, v_unit_price, v_cost_price,
      v_disc_pct, v_item_disc, v_gst_rate, v_item_cgst, v_item_sgst, v_item_tax, v_item_total, v_item_profit
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
