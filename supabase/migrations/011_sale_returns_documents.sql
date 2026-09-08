-- Migration 011: Sales Returns Documents, Items, Batch Linkage & Atomic Return/Cancellation RPCs

-- 1. Create sale_returns Table
CREATE TABLE IF NOT EXISTS sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  return_number VARCHAR NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  return_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL,
  refund_mode VARCHAR NOT NULL DEFAULT 'CREDIT_ADJUSTMENT' CHECK (refund_mode IN ('CREDIT_ADJUSTMENT', 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD')),
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, return_number)
);

-- 2. Create sale_return_items Table
CREATE TABLE IF NOT EXISTS sale_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_return_id UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(4,2) DEFAULT 0,
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add sale_return_id to sale_return_item_batches if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sale_return_item_batches' AND column_name = 'sale_return_id'
  ) THEN
    ALTER TABLE sale_return_item_batches 
    ADD COLUMN sale_return_id UUID REFERENCES sale_returns(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_sale_returns_shop_date ON sale_returns(shop_id, return_date DESC);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer_id ON sale_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_return ON sale_return_items(sale_return_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_item ON sale_return_items(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_item_batches_return ON sale_return_item_batches(sale_return_id);

-- 5. Row Level Security Policies
ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sale returns in their shop" ON sale_returns;
CREATE POLICY "Users can view sale returns in their shop" ON sale_returns
  FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Users can insert sale returns in their shop" ON sale_returns;
CREATE POLICY "Users can insert sale returns in their shop" ON sale_returns
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Users can view sale return items in their shop" ON sale_return_items;
CREATE POLICY "Users can view sale return items in their shop" ON sale_return_items
  FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Users can insert sale return items in their shop" ON sale_return_items;
CREATE POLICY "Users can insert sale return items in their shop" ON sale_return_items
  FOR INSERT WITH CHECK (shop_id = get_user_shop_id());

-- 6. Drop legacy/overloaded function signatures first to avoid ambiguous RPC signatures in PostgREST
DROP FUNCTION IF EXISTS process_sale_return(UUID, UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS process_sale_return(UUID, UUID, JSONB, UUID, VARCHAR);
DROP FUNCTION IF EXISTS process_sale_return(UUID, UUID, JSONB, UUID, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS cancel_sale(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS cancel_sale(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS generate_return_number(UUID, VARCHAR);

-- 7. Helper: Concurrency-safe Return Number Generation
CREATE OR REPLACE FUNCTION generate_return_number(
  p_shop_id UUID,
  p_invoice_number VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_count INTEGER;
  v_clean_inv VARCHAR;
  v_ret_num VARCHAR;
BEGIN
  -- Extract base invoice number
  v_clean_inv := REPLACE(p_invoice_number, 'INV-', '');
  v_clean_inv := REPLACE(v_clean_inv, 'KOS-', '');

  -- Count existing returns for this sale to generate sequential suffix (01, 02, etc.)
  SELECT COUNT(*) INTO v_count
  FROM sale_returns
  WHERE shop_id = p_shop_id AND return_number LIKE 'RET-' || v_clean_inv || '-%';

  v_ret_num := 'RET-' || v_clean_inv || '-' || LPAD((v_count + 1)::TEXT, 2, '0');

  -- Ensure uniqueness if collision occurs
  WHILE EXISTS (SELECT 1 FROM sale_returns WHERE shop_id = p_shop_id AND return_number = v_ret_num) LOOP
    v_count := v_count + 1;
    v_ret_num := 'RET-' || v_clean_inv || '-' || LPAD((v_count + 1)::TEXT, 2, '0');
  END LOOP;

  RETURN v_ret_num;
END;
$$ LANGUAGE plpgsql;

-- 8. Atomic RPC: process_sale_return
CREATE OR REPLACE FUNCTION process_sale_return(
  p_shop_id UUID,
  p_sale_id UUID,
  p_items JSONB, -- Array of { saleItemId: UUID, quantity: INTEGER, reason: TEXT }
  p_user_id UUID,
  p_refund_mode VARCHAR DEFAULT 'CREDIT_ADJUSTMENT',
  p_reason TEXT DEFAULT 'Customer Return'
) RETURNS JSONB AS $$
DECLARE
  v_sale RECORD;
  v_item JSONB;
  v_sale_item RECORD;
  v_sale_item_id UUID;
  v_ret_qty INTEGER;
  v_item_reason TEXT;
  v_qty_to_restore INTEGER;
  v_already_returned INTEGER;
  v_available_qty INTEGER;
  v_return_number VARCHAR;
  v_return_id UUID;
  v_total_refund DECIMAL(14,2) := 0;
  v_total_subtotal DECIMAL(14,2) := 0;
  v_total_tax DECIMAL(12,2) := 0;
  v_item_subtotal DECIMAL(12,2);
  v_item_disc DECIMAL(12,2);
  v_item_tax DECIMAL(12,2);
  v_item_cgst DECIMAL(12,2);
  v_item_sgst DECIMAL(12,2);
  v_item_total DECIMAL(12,2);
  v_taxable_amt DECIMAL(12,2);
  v_sib RECORD;
  v_batch_already_returned INTEGER;
  v_batch_returnable INTEGER;
  v_restore_chunk INTEGER;
  v_all_items_returned BOOLEAN := true;
  v_other_item RECORD;
  v_new_cust_balance DECIMAL(14,2);
  v_effective_refund_mode VARCHAR;
BEGIN
  -- 1. Lock Sale Row and Validate Authorization
  SELECT * INTO v_sale 
  FROM sales 
  WHERE id = p_sale_id AND shop_id = p_shop_id 
  FOR UPDATE;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale % not found in shop %', p_sale_id, p_shop_id;
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot return products from a cancelled sale';
  END IF;

  IF v_sale.status = 'returned' THEN
    RAISE EXCEPTION 'This sale is already fully returned';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No items provided for return';
  END IF;

  v_effective_refund_mode := COALESCE(p_refund_mode, 'CREDIT_ADJUSTMENT');
  IF v_effective_refund_mode NOT IN ('CREDIT_ADJUSTMENT', 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD') THEN
    RAISE EXCEPTION 'Invalid refund mode: %', v_effective_refund_mode;
  END IF;

  -- 2. Generate Return Document Number
  v_return_number := generate_return_number(p_shop_id, v_sale.invoice_number);

  -- 3. Insert Return Header Shell
  INSERT INTO sale_returns (
    shop_id, sale_id, return_number, customer_id, return_date,
    subtotal, tax_amount, total_amount, refund_mode, reason, notes, created_by
  ) VALUES (
    p_shop_id, p_sale_id, v_return_number, v_sale.customer_id, NOW(),
    0, 0, 0, v_effective_refund_mode, p_reason, p_reason, p_user_id
  ) RETURNING id INTO v_return_id;

  -- 4. Process Each Requested Item Return
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := (v_item->>'saleItemId')::UUID;
    v_ret_qty := (v_item->>'quantity')::INTEGER;
    v_item_reason := COALESCE(v_item->>'reason', p_reason, 'Customer Return');

    IF v_ret_qty <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be greater than zero';
    END IF;

    -- Lock and retrieve sale_item
    SELECT * INTO v_sale_item
    FROM sale_items
    WHERE id = v_sale_item_id AND sale_id = p_sale_id
    FOR UPDATE;

    IF v_sale_item IS NULL THEN
      RAISE EXCEPTION 'Sale item % not found for sale %', v_sale_item_id, p_sale_id;
    END IF;

    -- Calculate already returned quantity for this sale_item
    SELECT COALESCE(SUM(quantity), 0) INTO v_already_returned
    FROM sale_return_item_batches
    WHERE sale_item_id = v_sale_item_id;

    -- Also verify against sale_items.returned_quantity if populated
    v_already_returned := GREATEST(v_already_returned, COALESCE(v_sale_item.returned_quantity, 0));
    v_available_qty := v_sale_item.quantity - v_already_returned;

    IF v_ret_qty > v_available_qty THEN
      RAISE EXCEPTION 'Cannot return % units of %. Maximum available to return is % units (Sold: %, Already Returned: %)',
        v_ret_qty, v_sale_item.product_name, v_available_qty, v_sale_item.quantity, v_already_returned;
    END IF;

    -- Calculate GST-inclusive Economics (unit_price is GST-inclusive selling price)
    v_item_subtotal := v_ret_qty * v_sale_item.unit_price;
    v_item_disc := 0;
    IF COALESCE(v_sale_item.discount_percent, 0) > 0 THEN
      v_item_disc := (v_item_subtotal * v_sale_item.discount_percent) / 100.0;
    ELSIF COALESCE(v_sale_item.discount_amount, 0) > 0 AND v_sale_item.quantity > 0 THEN
      v_item_disc := (v_sale_item.discount_amount / v_sale_item.quantity) * v_ret_qty;
    END IF;

    v_item_total := v_item_subtotal - v_item_disc;

    IF COALESCE(v_sale_item.gst_rate, 0) > 0 THEN
      v_taxable_amt := ROUND((v_item_total * 100.0 / (100.0 + v_sale_item.gst_rate))::numeric, 2);
      v_item_tax := v_item_total - v_taxable_amt;
      v_item_cgst := ROUND((v_item_tax / 2.0)::numeric, 2);
      v_item_sgst := v_item_tax - v_item_cgst;
    ELSE
      v_taxable_amt := v_item_total;
      v_item_tax := 0;
      v_item_cgst := 0;
      v_item_sgst := 0;
    END IF;

    v_total_subtotal := v_total_subtotal + v_taxable_amt;
    v_total_tax := v_total_tax + v_item_tax;
    v_total_refund := v_total_refund + v_item_total;

    -- Insert sale_return_items record
    INSERT INTO sale_return_items (
      shop_id, sale_return_id, sale_item_id, product_id, batch_id,
      quantity, unit_price, discount_percent, discount_amount,
      gst_rate, cgst_amount, sgst_amount, tax_amount, total_amount, reason
    ) VALUES (
      p_shop_id, v_return_id, v_sale_item_id, v_sale_item.product_id, v_sale_item.batch_id,
      v_ret_qty, v_sale_item.unit_price, COALESCE(v_sale_item.discount_percent, 0), v_item_disc,
      COALESCE(v_sale_item.gst_rate, 0), v_item_cgst, v_item_sgst, v_item_tax, v_item_total, v_item_reason
    );

    -- Update returned_quantity on sale_items
    UPDATE sale_items
    SET returned_quantity = v_already_returned + v_ret_qty
    WHERE id = v_sale_item_id;

    -- EXACT BATCH ALLOCATION RESTORATION (Reverse Original Sale Allocations)
    v_qty_to_restore := v_ret_qty;

    IF EXISTS (SELECT 1 FROM sale_item_batches WHERE sale_item_id = v_sale_item_id) THEN
      FOR v_sib IN 
        SELECT id, batch_id, quantity 
        FROM sale_item_batches 
        WHERE sale_item_id = v_sale_item_id 
        ORDER BY created_at ASC
        FOR UPDATE
      LOOP
        IF v_qty_to_restore <= 0 THEN
          EXIT;
        END IF;

        -- Check how many units were already returned from this exact batch allocation
        SELECT COALESCE(SUM(quantity), 0) INTO v_batch_already_returned
        FROM sale_return_item_batches
        WHERE sale_item_batch_id = v_sib.id;

        v_batch_returnable := v_sib.quantity - v_batch_already_returned;

        IF v_batch_returnable > 0 THEN
          v_restore_chunk := LEAST(v_batch_returnable, v_qty_to_restore);

          -- Restore stock to the exact original batch via Central Stock Engine
          PERFORM process_stock_movement(
            p_shop_id, v_sale_item.product_id, v_sib.batch_id, 'SALE_RETURN',
            v_restore_chunk, 'Sale Return #' || v_return_number || ': ' || v_item_reason,
            'SALE_RETURN', v_return_id, p_user_id
          );

          -- Persist return batch allocation
          INSERT INTO sale_return_item_batches (
            shop_id, sale_id, sale_return_id, sale_item_id, sale_item_batch_id, batch_id, quantity
          ) VALUES (
            p_shop_id, p_sale_id, v_return_id, v_sale_item_id, v_sib.id, v_sib.batch_id, v_restore_chunk
          );

          v_qty_to_restore := v_qty_to_restore - v_restore_chunk;
        END IF;
      END LOOP;

      IF v_qty_to_restore > 0 THEN
        RAISE EXCEPTION 'Could not restore return quantity across original batch allocations for item % (Remaining: %)',
          v_sale_item.product_name, v_qty_to_restore;
      END IF;

    ELSE
      -- Non-batch tracked or single batch item
      PERFORM process_stock_movement(
        p_shop_id, v_sale_item.product_id, v_sale_item.batch_id, 'SALE_RETURN',
        v_ret_qty, 'Sale Return #' || v_return_number || ': ' || v_item_reason,
        'SALE_RETURN', v_return_id, p_user_id
      );
    END IF;

  END LOOP;

  -- 5. Update Return Header Totals
  UPDATE sale_returns
  SET subtotal = v_total_subtotal,
      tax_amount = v_total_tax,
      total_amount = v_total_refund
  WHERE id = v_return_id;

  -- 6. Financial & Ledger Adjustments
  IF v_effective_refund_mode = 'CREDIT_ADJUSTMENT' AND v_sale.customer_id IS NOT NULL AND v_total_refund > 0 THEN
    -- Adjust customer outstanding & total purchases
    UPDATE customers 
    SET outstanding = GREATEST(0, outstanding - v_total_refund),
        total_purchases = GREATEST(0, total_purchases - v_total_refund)
    WHERE id = v_sale.customer_id 
    RETURNING outstanding INTO v_new_cust_balance;

    -- Record Credit Note entry in customer_ledger
    INSERT INTO customer_ledger (
      shop_id, customer_id, date, description, reference_type, reference_id,
      debit, credit, balance, notes, created_by
    ) VALUES (
      p_shop_id, v_sale.customer_id, NOW(),
      'Credit Note #' || v_return_number || ' (Inv #' || v_sale.invoice_number || ')',
      'RETURN', v_return_id,
      0, v_total_refund, v_new_cust_balance, p_reason, p_user_id
    );

  ELSIF v_effective_refund_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD') AND v_total_refund > 0 THEN
    -- Insert payment refund record
    INSERT INTO payments (
      shop_id, payment_type, reference_type, reference_id, customer_id,
      payment_method, amount, payment_date, notes, created_by
    ) VALUES (
      p_shop_id, 'REFUND', 'SALE_RETURN', v_return_id, v_sale.customer_id,
      v_effective_refund_mode, v_total_refund, NOW(),
      'Refund for Return #' || v_return_number || ' (' || v_effective_refund_mode || ')',
      p_user_id
    );

    IF v_sale.customer_id IS NOT NULL THEN
      UPDATE customers
      SET total_purchases = GREATEST(0, total_purchases - v_total_refund)
      WHERE id = v_sale.customer_id;
    END IF;
  END IF;

  -- 7. Check if All Items in the Sale Are Now Fully Returned
  FOR v_other_item IN 
    SELECT id, quantity, returned_quantity
    FROM sale_items
    WHERE sale_id = p_sale_id
  LOOP
    IF COALESCE(v_other_item.returned_quantity, 0) < v_other_item.quantity THEN
      v_all_items_returned := false;
      EXIT;
    END IF;
  END LOOP;

  IF v_all_items_returned THEN
    UPDATE sales SET status = 'returned' WHERE id = p_sale_id;
  ELSE
    UPDATE sales SET status = 'partially_returned' WHERE id = p_sale_id;
  END IF;

  -- 8. Audit Log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (
    p_shop_id, p_user_id, 'PROCESS_SALE_RETURN', 'SALE_RETURN', v_return_id,
    jsonb_build_object(
      'return_number', v_return_number,
      'invoice_number', v_sale.invoice_number,
      'total_refund', v_total_refund,
      'refund_mode', v_effective_refund_mode,
      'status', CASE WHEN v_all_items_returned THEN 'returned' ELSE 'partially_returned' END
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'invoice_number', v_sale.invoice_number,
    'subtotal', v_total_subtotal,
    'tax_amount', v_total_tax,
    'total_amount', v_total_refund,
    'refund_mode', v_effective_refund_mode,
    'sale_status', CASE WHEN v_all_items_returned THEN 'returned' ELSE 'partially_returned' END
  );
END;
$$ LANGUAGE plpgsql;

-- 8. Atomic RPC: cancel_sale
CREATE OR REPLACE FUNCTION cancel_sale(
  p_shop_id UUID,
  p_sale_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Sale Cancelled'
) RETURNS JSONB AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_sib RECORD;
  v_already_ret_batch INTEGER;
  v_unreturned_batch INTEGER;
  v_already_ret_item INTEGER;
  v_unreturned_item INTEGER;
  v_pay RECORD;
  v_total_paid_on_sale DECIMAL(14,2) := 0;
  v_total_refunded_on_sale DECIMAL(14,2) := 0;
  v_already_returned_total DECIMAL(14,2) := 0;
  v_unreturned_sale_value DECIMAL(14,2) := 0;
  v_due_on_sale DECIMAL(14,2) := 0;
  v_new_cust_balance DECIMAL(14,2);
BEGIN
  -- 1. Lock Sale Row
  SELECT * INTO v_sale 
  FROM sales 
  WHERE id = p_sale_id AND shop_id = p_shop_id 
  FOR UPDATE;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale % not found in shop %', p_sale_id, p_shop_id;
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Sale % is already cancelled', p_sale_id;
  END IF;

  -- 2. Reverse Stock for All Items/Batches (Excluding any already returned units)
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    IF EXISTS (SELECT 1 FROM sale_item_batches WHERE sale_item_id = v_item.id) THEN
      FOR v_sib IN 
        SELECT id, batch_id, quantity 
        FROM sale_item_batches 
        WHERE sale_item_id = v_item.id 
        ORDER BY created_at ASC
        FOR UPDATE
      LOOP
        SELECT COALESCE(SUM(quantity), 0) INTO v_already_ret_batch
        FROM sale_return_item_batches
        WHERE sale_item_batch_id = v_sib.id;

        v_unreturned_batch := v_sib.quantity - v_already_ret_batch;

        IF v_unreturned_batch > 0 THEN
          PERFORM process_stock_movement(
            p_shop_id, v_item.product_id, v_sib.batch_id, 'SALE_REVERSAL',
            v_unreturned_batch, 'Sale Cancellation Reversal: ' || p_reason,
            'SALE_REVERSAL', p_sale_id, p_user_id
          );
        END IF;
      END LOOP;
    ELSE
      -- Non-batch tracked item
      v_already_ret_item := COALESCE(v_item.returned_quantity, 0);
      v_unreturned_item := v_item.quantity - v_already_ret_item;

      IF v_unreturned_item > 0 THEN
        PERFORM process_stock_movement(
          p_shop_id, v_item.product_id, v_item.batch_id, 'SALE_REVERSAL',
          v_unreturned_item, 'Sale Cancellation Reversal: ' || p_reason,
          'SALE_REVERSAL', p_sale_id, p_user_id
        );
      END IF;
    END IF;
  END LOOP;

  -- 3. Calculate Financial Positions for Reversal
  SELECT COALESCE(SUM(total_amount), 0) INTO v_already_returned_total
  FROM sale_returns
  WHERE sale_id = p_sale_id AND shop_id = p_shop_id;

  v_unreturned_sale_value := GREATEST(0, v_sale.total_amount - v_already_returned_total);

  -- Sum payments made for this sale
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_on_sale
  FROM payments
  WHERE reference_id = p_sale_id AND payment_type = 'SALE' AND shop_id = p_shop_id;

  -- Sum prior refunds made for this sale
  SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded_on_sale
  FROM payments
  WHERE (reference_id = p_sale_id OR reference_id IN (SELECT id FROM sale_returns WHERE sale_id = p_sale_id))
    AND payment_type = 'REFUND' AND shop_id = p_shop_id;

  -- Outstanding due specifically created by this sale that remains unpaid
  v_due_on_sale := GREATEST(0, v_unreturned_sale_value - GREATEST(0, v_total_paid_on_sale - v_total_refunded_on_sale));

  -- 4. Reverse Customer Ledger & Customer Totals
  IF v_sale.customer_id IS NOT NULL THEN
    -- If there was remaining unpaid outstanding from this bill, reduce customer outstanding
    IF v_due_on_sale > 0 THEN
      UPDATE customers 
      SET outstanding = GREATEST(0, outstanding - v_due_on_sale),
          total_purchases = GREATEST(0, total_purchases - v_unreturned_sale_value)
      WHERE id = v_sale.customer_id
      RETURNING outstanding INTO v_new_cust_balance;

      -- Insert Reversal entry in customer_ledger
      INSERT INTO customer_ledger (
        shop_id, customer_id, date, description, reference_type, reference_id,
        debit, credit, balance, notes, created_by
      ) VALUES (
        p_shop_id, v_sale.customer_id, NOW(),
        'Bill Cancelled - #' || v_sale.invoice_number,
        'ADJUSTMENT', p_sale_id,
        0, v_due_on_sale, v_new_cust_balance, p_reason, p_user_id
      );
    ELSE
      UPDATE customers 
      SET total_purchases = GREATEST(0, total_purchases - v_unreturned_sale_value)
      WHERE id = v_sale.customer_id;
    END IF;

    -- Adjust total_paid on customer if payments were made
    IF (v_total_paid_on_sale - v_total_refunded_on_sale) > 0 THEN
      UPDATE customers 
      SET total_paid = GREATEST(0, total_paid - (v_total_paid_on_sale - v_total_refunded_on_sale))
      WHERE id = v_sale.customer_id;
    END IF;
  END IF;

  -- 5. Reverse Payments (Insert REFUND entries for each original payment made on this bill)
  FOR v_pay IN 
    SELECT * FROM payments 
    WHERE reference_id = p_sale_id AND payment_type = 'SALE' AND shop_id = p_shop_id
  LOOP
    INSERT INTO payments (
      shop_id, payment_type, reference_type, reference_id, customer_id,
      payment_method, amount, payment_date, notes, created_by
    ) VALUES (
      p_shop_id, 'REFUND', 'SALE_CANCEL', p_sale_id, v_sale.customer_id,
      v_pay.payment_method, v_pay.amount, NOW(),
      'Reversal for Cancelled Bill #' || v_sale.invoice_number || ' (' || v_pay.payment_method || ')',
      p_user_id
    );
  END LOOP;

  -- 6. Update Sale Status to cancelled
  UPDATE sales 
  SET status = 'cancelled', 
      payment_status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_sale_id;

  -- 7. Audit Log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (
    p_shop_id, p_user_id, 'CANCEL_SALE', 'SALE', p_sale_id,
    jsonb_build_object('invoice_number', v_sale.invoice_number, 'reason', p_reason, 'status', 'cancelled')
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'invoice_number', v_sale.invoice_number,
    'status', 'cancelled'
  );
END;
$$ LANGUAGE plpgsql;

-- 10. Grant RPC permissions
GRANT EXECUTE ON FUNCTION generate_return_number(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_sale_return(UUID, UUID, JSONB, UUID, VARCHAR, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cancel_sale(UUID, UUID, UUID, TEXT) TO authenticated, service_role;

-- 11. Refresh PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

