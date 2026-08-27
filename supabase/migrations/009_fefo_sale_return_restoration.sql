-- Migration 009: FEFO Multi-Batch Sale Return Restoration & Traceability

-- 1. Create Persistent Return Allocation Table
CREATE TABLE IF NOT EXISTS sale_return_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  sale_item_batch_id UUID NOT NULL REFERENCES sale_item_batches(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foreign keys and indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_sale_return_item_batches_item ON sale_return_item_batches(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_return_item_batches_sib ON sale_return_item_batches(sale_item_batch_id);

-- 2. Update process_sale_return RPC with Multi-Batch Restoration & Validation
CREATE OR REPLACE FUNCTION process_sale_return(
  p_shop_id UUID,
  p_sale_id UUID,
  p_items JSONB, -- Array of { saleItemId: UUID, quantity: INTEGER, reason: TEXT }
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_sale_item_id UUID;
  v_ret_qty INTEGER;
  v_qty_to_restore INTEGER;
  v_reason TEXT;
  v_product_id UUID;
  v_unit_price DECIMAL(12,2);
  v_total_refund DECIMAL(14,2) := 0;
  v_cust_id UUID;
  v_new_bal DECIMAL(14,2);
  v_sib RECORD;
  v_already_returned INTEGER;
  v_batch_returnable INTEGER;
  v_restore_chunk INTEGER;
  v_total_item_sold INTEGER;
  v_total_item_returned INTEGER;
BEGIN
  SELECT customer_id INTO v_cust_id FROM sales WHERE id = p_sale_id AND shop_id = p_shop_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := (v_item->>'saleItemId')::UUID;
    v_ret_qty := (v_item->>'quantity')::INTEGER;
    v_reason := COALESCE(v_item->>'reason', 'Customer Return');

    IF v_ret_qty <= 0 THEN
      RAISE EXCEPTION 'Return quantity must be greater than zero';
    END IF;

    SELECT product_id, unit_price, quantity INTO v_product_id, v_unit_price, v_total_item_sold
    FROM sale_items WHERE id = v_sale_item_id AND sale_id = p_sale_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Sale item % not found for sale %', v_sale_item_id, p_sale_id;
    END IF;

    -- Calculate total already returned for this sale_item
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_item_returned
    FROM sale_return_item_batches WHERE sale_item_id = v_sale_item_id;

    IF (v_total_item_returned + v_ret_qty) > v_total_item_sold THEN
      RAISE EXCEPTION 'Cannot return % units. Maximum returnable remaining is % units (Sold: %, Already Returned: %)',
        v_ret_qty, (v_total_item_sold - v_total_item_returned), v_total_item_sold, v_total_item_returned;
    END IF;

    v_qty_to_restore := v_ret_qty;

    -- Check if FEFO sale_item_batches allocations exist for this sale item
    IF EXISTS (SELECT 1 FROM sale_item_batches WHERE sale_item_id = v_sale_item_id) THEN
      -- Loop through original batch allocations in deterministic created_at ASC order
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

        -- Calculate how many units were already returned from this specific batch allocation
        SELECT COALESCE(SUM(quantity), 0) INTO v_already_returned
        FROM sale_return_item_batches
        WHERE sale_item_batch_id = v_sib.id;

        v_batch_returnable := v_sib.quantity - v_already_returned;

        IF v_batch_returnable > 0 THEN
          v_restore_chunk := LEAST(v_batch_returnable, v_qty_to_restore);

          -- Increase stock for this specific batch via Central Stock Engine
          PERFORM process_stock_movement(
            p_shop_id, v_product_id, v_sib.batch_id, 'SALE_RETURN',
            v_restore_chunk, v_reason, 'SALE_RETURN', p_sale_id, p_user_id
          );

          -- Persist return allocation record
          INSERT INTO sale_return_item_batches (
            shop_id, sale_id, sale_item_id, sale_item_batch_id, batch_id, quantity
          ) VALUES (
            p_shop_id, p_sale_id, v_sale_item_id, v_sib.id, v_sib.batch_id, v_restore_chunk
          );

          v_qty_to_restore := v_qty_to_restore - v_restore_chunk;
        END IF;
      END LOOP;

      IF v_qty_to_restore > 0 THEN
        RAISE EXCEPTION 'Could not restore return quantity across original batch allocations (Unallocated: %)', v_qty_to_restore;
      END IF;

    ELSE
      -- Normal / non-batch-tracked sale item return
      PERFORM process_stock_movement(
        p_shop_id, v_product_id, NULL, 'SALE_RETURN',
        v_ret_qty, v_reason, 'SALE_RETURN', p_sale_id, p_user_id
      );
    END IF;

    v_total_refund := v_total_refund + (v_ret_qty * v_unit_price);
  END LOOP;

  -- Update Customer Outstanding & Ledger if applicable
  IF v_cust_id IS NOT NULL AND v_total_refund > 0 THEN
    UPDATE customers SET outstanding = GREATEST(0, outstanding - v_total_refund)
    WHERE id = v_cust_id RETURNING outstanding INTO v_new_bal;

    INSERT INTO customer_ledger (
      shop_id, customer_id, description, reference_type, reference_id,
      debit, credit, balance, notes, created_by
    ) VALUES (
      p_shop_id, v_cust_id, 'Sale Return Refund', 'SALE_RETURN', p_sale_id,
      0, v_total_refund, v_new_bal, 'Returned Items Refund', p_user_id
    );
  END IF;

  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'PROCESS_SALE_RETURN', 'SALE', p_sale_id, jsonb_build_object('refund_amount', v_total_refund));

  RETURN jsonb_build_object('success', true, 'refund_amount', v_total_refund);
END;
$$ LANGUAGE plpgsql;
