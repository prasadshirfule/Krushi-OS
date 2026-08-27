-- Migration 008: Batch Allocation Traceability, Returns, Cancel Sale & Centralized Stock Movements

-- 1. Create sale_item_batches Table for FEFO Batch Traceability
CREATE TABLE IF NOT EXISTS sale_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES product_batches(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Central Stock Movement Function with Transaction Direction Validation
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

  -- Validate Transaction Direction vs Type
  IF p_transaction_type IN ('OPENING_STOCK', 'PURCHASE_IN', 'SALE_RETURN', 'RETURN_IN', 'SALE_REVERSAL', 'ADJUSTMENT_IN') AND p_quantity_change <= 0 THEN
    RAISE EXCEPTION 'Transaction type "%" requires a positive quantity change (+)', p_transaction_type;
  END IF;

  IF p_transaction_type IN ('SALE_OUT', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED') AND p_quantity_change >= 0 THEN
    RAISE EXCEPTION 'Transaction type "%" requires a negative quantity change (-)', p_transaction_type;
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

-- 3. FEFO Multi-Batch Allocation & Traceability Persistence Function
CREATE OR REPLACE FUNCTION process_fefo_sale_deduction(
  p_shop_id UUID,
  p_product_id UUID,
  p_requested_qty INTEGER,
  p_sale_id UUID,
  p_sale_item_id UUID,
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

  -- Query valid non-expired batches OR batches with NULL expiry dates
  FOR v_batch IN 
    SELECT id, batch_number, quantity_available, expiry_date
    FROM product_batches
    WHERE shop_id = p_shop_id 
      AND product_id = p_product_id 
      AND quantity_available > 0
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      AND is_active = true
    ORDER BY COALESCE(expiry_date, '9999-12-31'::DATE) ASC, created_at ASC
    FOR UPDATE
  LOOP
    IF v_qty_needed <= 0 THEN
      EXIT;
    END IF;

    v_deduct := LEAST(v_batch.quantity_available, v_qty_needed);
    
    PERFORM process_stock_movement(
      p_shop_id, p_product_id, v_batch.id, 'SALE_OUT',
      -v_deduct, 'FEFO Multi-Batch Sale Deduction', 'SALE', p_sale_id, p_user_id
    );

    -- Traceability persistence
    INSERT INTO sale_item_batches (sale_id, sale_item_id, batch_id, quantity)
    VALUES (p_sale_id, p_sale_item_id, v_batch.id, v_deduct);

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

-- 4. Update create_product_with_stock to route opening stock via process_stock_movement
CREATE OR REPLACE FUNCTION create_product_with_stock(
  p_shop_id UUID,
  p_user_id UUID,
  p_category_id UUID,
  p_name VARCHAR,
  p_selling_price DECIMAL,
  p_unit VARCHAR,
  p_brand_id UUID DEFAULT NULL,
  p_sku VARCHAR DEFAULT NULL,
  p_barcode VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_purchase_price DECIMAL DEFAULT 0,
  p_wholesale_price DECIMAL DEFAULT 0,
  p_gst_rate DECIMAL DEFAULT 0,
  p_hsn_code VARCHAR DEFAULT NULL,
  p_min_stock INTEGER DEFAULT 0,
  p_opening_stock INTEGER DEFAULT 0,
  p_batch_tracking BOOLEAN DEFAULT false,
  p_expiry_tracking BOOLEAN DEFAULT false,
  p_batch_number VARCHAR DEFAULT NULL,
  p_mfd_date DATE DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_product_type VARCHAR DEFAULT NULL,
  p_active_ingredient VARCHAR DEFAULT NULL,
  p_formulation VARCHAR DEFAULT NULL,
  p_crop VARCHAR DEFAULT NULL,
  p_target_pest VARCHAR DEFAULT NULL,
  p_pack_size VARCHAR DEFAULT NULL,
  p_licence_number VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_product_id UUID;
  v_batch_id UUID := NULL;
  v_stock INTEGER := COALESCE(p_opening_stock, 0);
BEGIN
  -- Validations
  IF p_opening_stock < 0 THEN
    RAISE EXCEPTION 'Opening stock cannot be negative';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Product name must be at least 2 characters';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_category_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Category not found or does not belong to this shop';
  END IF;

  IF p_brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brands WHERE id = p_brand_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Brand not found or does not belong to this shop';
  END IF;

  IF p_sku IS NOT NULL AND trim(p_sku) != '' THEN
    IF EXISTS (SELECT 1 FROM products WHERE shop_id = p_shop_id AND sku = trim(p_sku) AND is_active = true) THEN
      RAISE EXCEPTION 'Product with SKU "%" already exists in this shop', p_sku;
    END IF;
  END IF;

  IF p_barcode IS NOT NULL AND trim(p_barcode) != '' THEN
    IF EXISTS (SELECT 1 FROM products WHERE shop_id = p_shop_id AND barcode = trim(p_barcode) AND is_active = true) THEN
      RAISE EXCEPTION 'Product with Barcode "%" already exists in this shop', p_barcode;
    END IF;
  END IF;

  -- Insert Product with initial current_stock = 0
  INSERT INTO products (
    shop_id, category_id, brand_id, name, description, sku, barcode,
    purchase_price, selling_price, wholesale_price, gst_rate, hsn_code,
    unit, min_stock, current_stock, is_active,
    product_type, active_ingredient, formulation, crop, target_pest, pack_size, licence_number,
    batch_tracking, expiry_tracking
  ) VALUES (
    p_shop_id, p_category_id, p_brand_id, trim(p_name), p_description, NULLIF(trim(p_sku), ''), NULLIF(trim(p_barcode), ''),
    COALESCE(p_purchase_price, 0), COALESCE(p_selling_price, 0), COALESCE(p_wholesale_price, 0),
    COALESCE(p_gst_rate, 0), p_hsn_code, COALESCE(p_unit, 'Piece'), COALESCE(p_min_stock, 0), 0, true,
    p_product_type, p_active_ingredient, p_formulation, p_crop, p_target_pest, p_pack_size, p_licence_number,
    COALESCE(p_batch_tracking, false), COALESCE(p_expiry_tracking, false)
  ) RETURNING id INTO v_product_id;

  -- Create batch shell if batch tracked
  IF p_batch_tracking = true AND v_stock > 0 THEN
    IF p_batch_number IS NULL OR trim(p_batch_number) = '' THEN
      RAISE EXCEPTION 'Batch number is required for batch-tracked products with opening stock';
    END IF;

    IF p_expiry_tracking = true AND p_expiry_date IS NULL THEN
      RAISE EXCEPTION 'Expiry date is required when expiry tracking is enabled';
    END IF;

    INSERT INTO product_batches (
      shop_id, product_id, batch_number, manufacturing_date, expiry_date,
      purchase_price, selling_price, quantity_received, quantity_available, is_active
    ) VALUES (
      p_shop_id, v_product_id, trim(p_batch_number), p_mfd_date, p_expiry_date,
      p_purchase_price, p_selling_price, v_stock, 0, true
    ) RETURNING id INTO v_batch_id;
  END IF;

  -- Route Opening Stock through Central Stock Engine
  IF v_stock > 0 THEN
    PERFORM process_stock_movement(
      p_shop_id, v_product_id, v_batch_id, 'OPENING_STOCK',
      v_stock, 'Opening Stock Initialization', 'OPENING_STOCK', v_product_id, p_user_id
    );
  END IF;

  -- Audit Log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'CREATE_PRODUCT', 'PRODUCT', v_product_id, jsonb_build_object('name', p_name, 'opening_stock', v_stock));

  RETURN jsonb_build_object(
    'success', true,
    'id', v_product_id,
    'product_id', v_product_id,
    'batch_id', v_batch_id,
    'stock', v_stock
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Implement adjust_stock RPC via Central Stock Engine
CREATE OR REPLACE FUNCTION adjust_stock(
  p_shop_id UUID,
  p_product_id UUID,
  p_batch_id UUID DEFAULT NULL,
  p_type VARCHAR DEFAULT 'ADJUSTMENT',
  p_quantity INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT 'Manual Inventory Adjustment',
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_trans_type VARCHAR;
  v_qty_change INTEGER;
BEGIN
  IF p_quantity = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity cannot be zero';
  END IF;

  IF p_type IN ('ADD', 'ADJUSTMENT_IN', 'FOUND') THEN
    v_trans_type := 'ADJUSTMENT_IN';
    v_qty_change := ABS(p_quantity);
  ELSIF p_type IN ('DAMAGED', 'EXPIRED') THEN
    v_trans_type := p_type;
    v_qty_change := -ABS(p_quantity);
  ELSE
    v_trans_type := 'ADJUSTMENT_OUT';
    v_qty_change := -ABS(p_quantity);
  END IF;

  RETURN process_stock_movement(
    p_shop_id, p_product_id, p_batch_id, v_trans_type,
    v_qty_change, p_reason, 'ADJUSTMENT', p_product_id, p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Implement process_sale_return RPC
CREATE OR REPLACE FUNCTION process_sale_return(
  p_shop_id UUID,
  p_sale_id UUID,
  p_items JSONB,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_sale_item_id UUID;
  v_ret_qty INTEGER;
  v_reason TEXT;
  v_product_id UUID;
  v_batch_id UUID;
  v_unit_price DECIMAL(12,2);
  v_total_refund DECIMAL(14,2) := 0;
  v_cust_id UUID;
  v_new_bal DECIMAL(14,2);
BEGIN
  SELECT customer_id INTO v_cust_id FROM sales WHERE id = p_sale_id AND shop_id = p_shop_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_sale_item_id := (v_item->>'saleItemId')::UUID;
    v_ret_qty := (v_item->>'quantity')::INTEGER;
    v_reason := COALESCE(v_item->>'reason', 'Customer Return');

    SELECT product_id, batch_id, unit_price INTO v_product_id, v_batch_id, v_unit_price
    FROM sale_items WHERE id = v_sale_item_id AND sale_id = p_sale_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Sale item % not found for sale %', v_sale_item_id, p_sale_id;
    END IF;

    -- Increase stock via Central Stock Engine
    PERFORM process_stock_movement(
      p_shop_id, v_product_id, v_batch_id, 'SALE_RETURN',
      v_ret_qty, v_reason, 'SALE_RETURN', p_sale_id, p_user_id
    );

    v_total_refund := v_total_refund + (v_ret_qty * v_unit_price);
  END LOOP;

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

-- 7. Implement cancel_sale RPC
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
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND shop_id = p_shop_id FOR UPDATE;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale % not found in shop %', p_sale_id, p_shop_id;
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Sale % is already cancelled', p_sale_id;
  END IF;

  -- Reverse stock for all items
  FOR v_item IN SELECT * FROM sale_items WHERE sale_id = p_sale_id LOOP
    IF EXISTS (SELECT 1 FROM sale_item_batches WHERE sale_item_id = v_item.id) THEN
      FOR v_sib IN SELECT * FROM sale_item_batches WHERE sale_item_id = v_item.id LOOP
        PERFORM process_stock_movement(
          p_shop_id, v_item.product_id, v_sib.batch_id, 'SALE_REVERSAL',
          v_sib.quantity, 'Sale Cancellation Reversal: ' || p_reason, 'SALE_REVERSAL', p_sale_id, p_user_id
        );
      END LOOP;
    ELSE
      PERFORM process_stock_movement(
        p_shop_id, v_item.product_id, v_item.batch_id, 'SALE_REVERSAL',
        v_item.quantity, 'Sale Cancellation Reversal: ' || p_reason, 'SALE_REVERSAL', p_sale_id, p_user_id
      );
    END IF;
  END LOOP;

  UPDATE sales SET status = 'cancelled' WHERE id = p_sale_id;

  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'CANCEL_SALE', 'SALE', p_sale_id, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'sale_id', p_sale_id, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql;

-- 8. Implement process_purchase RPC
CREATE OR REPLACE FUNCTION process_purchase(
  p_shop_id UUID,
  p_user_id UUID,
  p_supplier_id UUID,
  p_invoice_number VARCHAR,
  p_purchase_date TIMESTAMPTZ,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_batch_id UUID;
  v_qty INTEGER;
  v_unit_price DECIMAL(12,2);
  v_batch_no VARCHAR;
  v_mfd DATE;
  v_exp DATE;
  v_grand_total DECIMAL(14,2) := 0;
  v_item_total DECIMAL(12,2);
  v_new_supp_bal DECIMAL(14,2);
BEGIN
  INSERT INTO purchases (
    shop_id, supplier_id, invoice_number, purchase_date, total_amount, status, created_by
  ) VALUES (
    p_shop_id, p_supplier_id, p_invoice_number, p_purchase_date, 0, 'completed', p_user_id
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::DECIMAL;
    v_batch_no := v_item->>'batch_number';
    v_mfd := (v_item->>'mfd_date')::DATE;
    v_exp := (v_item->>'expiry_date')::DATE;

    v_item_total := v_qty * v_unit_price;
    v_grand_total := v_grand_total + v_item_total;

    v_batch_id := NULL;

    IF v_batch_no IS NOT NULL AND trim(v_batch_no) != '' THEN
      SELECT id INTO v_batch_id FROM product_batches
      WHERE shop_id = p_shop_id AND product_id = v_product_id AND batch_number = trim(v_batch_no);

      IF v_batch_id IS NULL THEN
        INSERT INTO product_batches (
          shop_id, product_id, batch_number, manufacturing_date, expiry_date,
          purchase_price, quantity_received, quantity_available, is_active
        ) VALUES (
          p_shop_id, v_product_id, trim(v_batch_no), v_mfd, v_exp,
          v_unit_price, v_qty, 0, true
        ) RETURNING id INTO v_batch_id;
      END IF;
    END IF;

    INSERT INTO purchase_items (
      purchase_id, product_id, batch_id, quantity, unit_price, total_amount
    ) VALUES (
      v_purchase_id, v_product_id, v_batch_id, v_qty, v_unit_price, v_item_total
    );

    -- Increase Stock via Central Engine
    PERFORM process_stock_movement(
      p_shop_id, v_product_id, v_batch_id, 'PURCHASE_IN',
      v_qty, 'Purchase Invoice #' || p_invoice_number, 'PURCHASE', v_purchase_id, p_user_id
    );
  END LOOP;

  UPDATE purchases SET total_amount = v_grand_total WHERE id = v_purchase_id;

  IF p_supplier_id IS NOT NULL THEN
    UPDATE suppliers SET total_purchases = total_purchases + v_grand_total,
                         outstanding = outstanding + v_grand_total
    WHERE id = p_supplier_id RETURNING outstanding INTO v_new_supp_bal;

    INSERT INTO supplier_ledger (
      shop_id, supplier_id, description, reference_type, reference_id,
      credit, debit, balance, notes, created_by
    ) VALUES (
      p_shop_id, p_supplier_id, 'Purchase Invoice #' || p_invoice_number, 'PURCHASE', v_purchase_id,
      v_grand_total, 0, v_new_supp_bal, p_notes, p_user_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase_id, 'total_amount', v_grand_total);
END;
$$ LANGUAGE plpgsql;
