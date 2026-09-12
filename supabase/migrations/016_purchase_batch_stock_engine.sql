-- Migration 016: Robust Purchase, Batch Inventory & Idempotency Engine
-- Ensures existing products & batches are safely updated without duplication
-- Corrects quantity_received and quantity_available calculations under constraints

-- 1. Add backward-compatible columns to purchases and purchase_items if not already present
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_idempotency_key ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS product_name VARCHAR;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2);

-- 2. Drop existing process_purchase signatures to avoid PostgREST RPC overload ambiguities
DROP FUNCTION IF EXISTS process_purchase(UUID, UUID, UUID, VARCHAR, TIMESTAMPTZ, JSONB, TEXT);
DROP FUNCTION IF EXISTS process_purchase(UUID, UUID, UUID, VARCHAR, TIMESTAMPTZ, JSONB, TEXT, DECIMAL);
DROP FUNCTION IF EXISTS process_purchase(UUID, UUID, UUID, VARCHAR, TIMESTAMPTZ, JSONB, TEXT, DECIMAL, VARCHAR);

-- 3. Stored Procedure: process_purchase
CREATE OR REPLACE FUNCTION process_purchase(
  p_shop_id UUID,
  p_user_id UUID,
  p_supplier_id UUID,
  p_invoice_number VARCHAR,
  p_purchase_date TIMESTAMPTZ,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_paid_amount DECIMAL(14,2) DEFAULT 0,
  p_idempotency_key VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_existing_id UUID;
  v_purchase_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_batch_id UUID;
  v_qty INTEGER;
  v_unit_price DECIMAL(12,2);
  v_selling_price DECIMAL(12,2);
  v_batch_no VARCHAR;
  v_mfd DATE;
  v_exp DATE;
  v_gst_rate DECIMAL(4,2);
  v_gst_amount DECIMAL(12,2);
  v_item_subtotal DECIMAL(12,2);
  v_item_total DECIMAL(12,2);
  v_subtotal DECIMAL(14,2) := 0;
  v_total_tax DECIMAL(12,2) := 0;
  v_grand_total DECIMAL(14,2) := 0;
  v_prod_name VARCHAR;
  v_new_supp_bal DECIMAL(14,2);
  v_paid_amt DECIMAL(14,2);
BEGIN
  -- 1. Idempotency Check: Idempotency Key
  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) != '' THEN
    SELECT id INTO v_existing_id FROM purchases
    WHERE shop_id = p_shop_id AND idempotency_key = trim(p_idempotency_key);

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_existing_id,
        'duplicate', true,
        'message', 'Purchase already processed with this idempotency key'
      );
    END IF;
  END IF;

  -- 2. Secondary Idempotency Check: Same Supplier + Invoice Number (if invoice number given)
  IF p_invoice_number IS NOT NULL AND trim(p_invoice_number) != '' AND p_supplier_id IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM purchases
    WHERE shop_id = p_shop_id 
      AND supplier_id = p_supplier_id 
      AND invoice_number = trim(p_invoice_number)
      AND status = 'completed';

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_existing_id,
        'duplicate', true,
        'message', 'Purchase invoice already exists for this supplier'
      );
    END IF;
  END IF;

  v_paid_amt := COALESCE(p_paid_amount, 0);

  -- 3. Create Purchase Invoice Header
  INSERT INTO purchases (
    shop_id, supplier_id, invoice_number, purchase_date, subtotal, tax_amount,
    total_amount, paid_amount, status, notes, idempotency_key, created_by
  ) VALUES (
    p_shop_id, p_supplier_id, trim(p_invoice_number), p_purchase_date, 0, 0,
    0, v_paid_amt, 'completed', p_notes, p_idempotency_key, p_user_id
  ) RETURNING id INTO v_purchase_id;

  -- 4. Process Each Purchase Item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := COALESCE((v_item->>'unit_price')::DECIMAL, (v_item->>'purchase_price')::DECIMAL, 0);
    v_selling_price := NULL;
    IF v_item->>'selling_price' IS NOT NULL AND (v_item->>'selling_price') != '' THEN
      v_selling_price := (v_item->>'selling_price')::DECIMAL;
    END IF;

    v_batch_no := trim(COALESCE(v_item->>'batch_number', v_item->>'batch_no', ''));
    IF v_batch_no = '' THEN
      v_batch_no := NULL;
    END IF;

    v_mfd := NULL;
    IF v_item->>'manufacturing_date' IS NOT NULL AND (v_item->>'manufacturing_date') != '' THEN
      v_mfd := (v_item->>'manufacturing_date')::DATE;
    ELSIF v_item->>'mfd_date' IS NOT NULL AND (v_item->>'mfd_date') != '' THEN
      v_mfd := (v_item->>'mfd_date')::DATE;
    END IF;

    v_exp := NULL;
    IF v_item->>'expiry_date' IS NOT NULL AND (v_item->>'expiry_date') != '' THEN
      v_exp := (v_item->>'expiry_date')::DATE;
    ELSIF v_item->>'exp_date' IS NOT NULL AND (v_item->>'exp_date') != '' THEN
      v_exp := (v_item->>'exp_date')::DATE;
    END IF;

    -- Validate or default expiry date for batches (if batch number is provided but expiry is missing)
    IF v_batch_no IS NOT NULL AND v_exp IS NULL THEN
      -- Default to 2 years from purchase date if not specified
      v_exp := (p_purchase_date + INTERVAL '2 years')::DATE;
    END IF;

    v_gst_rate := COALESCE((v_item->>'gst_rate')::DECIMAL, 0);
    v_item_subtotal := v_qty * v_unit_price;
    v_gst_amount := ROUND((v_item_subtotal * (v_gst_rate / 100.0))::numeric, 2);
    v_item_total := v_item_subtotal + v_gst_amount;

    v_subtotal := v_subtotal + v_item_subtotal;
    v_total_tax := v_total_tax + v_gst_amount;
    v_grand_total := v_grand_total + v_item_total;

    -- Look up product name
    SELECT name INTO v_prod_name FROM products WHERE id = v_product_id AND shop_id = p_shop_id;
    IF v_prod_name IS NULL THEN
      v_prod_name := COALESCE(v_item->>'product_name', 'Product');
    END IF;

    -- 4a. Batch Resolution: Existing batch vs New batch
    v_batch_id := NULL;
    IF v_item->>'batch_id' IS NOT NULL AND (v_item->>'batch_id') != '' THEN
      v_batch_id := (v_item->>'batch_id')::UUID;
    END IF;

    IF v_batch_id IS NOT NULL THEN
      -- User explicitly selected an existing batch: increment quantity_received
      UPDATE product_batches
      SET quantity_received = quantity_received + v_qty,
          purchase_price = COALESCE(v_unit_price, purchase_price),
          selling_price = COALESCE(v_selling_price, selling_price),
          expiry_date = COALESCE(v_exp, expiry_date),
          manufacturing_date = COALESCE(v_mfd, manufacturing_date),
          updated_at = NOW()
      WHERE id = v_batch_id AND shop_id = p_shop_id AND product_id = v_product_id;
    ELSIF v_batch_no IS NOT NULL THEN
      -- Check if a batch with this batch_number already exists for this product
      SELECT id INTO v_batch_id FROM product_batches
      WHERE shop_id = p_shop_id AND product_id = v_product_id AND batch_number = v_batch_no
      LIMIT 1;

      IF v_batch_id IS NOT NULL THEN
        -- Existing batch found: increment quantity_received
        UPDATE product_batches
        SET quantity_received = quantity_received + v_qty,
            purchase_price = COALESCE(v_unit_price, purchase_price),
            selling_price = COALESCE(v_selling_price, selling_price),
            expiry_date = COALESCE(v_exp, expiry_date),
            manufacturing_date = COALESCE(v_mfd, manufacturing_date),
            updated_at = NOW()
        WHERE id = v_batch_id;
      ELSE
        -- Create new batch record with quantity_received = v_qty, quantity_available = 0
        -- (process_stock_movement will atomically add v_qty to quantity_available)
        INSERT INTO product_batches (
          shop_id, product_id, batch_number, manufacturing_date, expiry_date,
          purchase_price, selling_price, quantity_received, quantity_available,
          supplier_id, is_active
        ) VALUES (
          p_shop_id, v_product_id, v_batch_no, v_mfd, v_exp,
          v_unit_price, v_selling_price, v_qty, 0,
          p_supplier_id, true
        ) RETURNING id INTO v_batch_id;
      END IF;
    END IF;

    -- 4b. Insert Purchase Line Item with Historical Snapshots
    INSERT INTO purchase_items (
      purchase_id, product_id, batch_id, product_name, batch_number, expiry_date,
      quantity, purchase_price, selling_price, gst_rate, gst_amount, total_amount
    ) VALUES (
      v_purchase_id, v_product_id, v_batch_id, v_prod_name, v_batch_no, v_exp,
      v_qty, v_unit_price, v_selling_price, v_gst_rate, v_gst_amount, v_item_total
    );

    -- 4c. Update Product Master Price (reflect latest inward rate & MRP)
    UPDATE products
    SET purchase_price = v_unit_price,
        selling_price = CASE WHEN v_selling_price IS NOT NULL AND v_selling_price > 0 THEN v_selling_price ELSE selling_price END,
        updated_at = NOW()
    WHERE id = v_product_id AND shop_id = p_shop_id;

    -- 4d. Increase Stock via Central Movement Engine
    PERFORM process_stock_movement(
      p_shop_id, v_product_id, v_batch_id, 'PURCHASE_IN',
      v_qty, 'Purchase Invoice #' || COALESCE(p_invoice_number, 'N/A'), 'PURCHASE', v_purchase_id, p_user_id
    );
  END LOOP;

  -- 5. Update Purchase Header Final Totals
  UPDATE purchases
  SET subtotal = v_subtotal,
      tax_amount = v_total_tax,
      total_amount = v_grand_total,
      updated_at = NOW()
  WHERE id = v_purchase_id;

  -- 6. Update Supplier Financials & Ledger
  IF p_supplier_id IS NOT NULL THEN
    UPDATE suppliers
    SET total_purchases = total_purchases + v_grand_total,
        total_paid = total_paid + v_paid_amt,
        outstanding = outstanding + (v_grand_total - v_paid_amt),
        updated_at = NOW()
    WHERE id = p_supplier_id
    RETURNING outstanding INTO v_new_supp_bal;

    INSERT INTO supplier_ledger (
      shop_id, supplier_id, description, reference_type, reference_id,
      credit, debit, balance, notes, created_by
    ) VALUES (
      p_shop_id, p_supplier_id, 'Purchase Invoice #' || COALESCE(p_invoice_number, 'N/A'), 'PURCHASE', v_purchase_id,
      v_grand_total, v_paid_amt, v_new_supp_bal, p_notes, p_user_id
    );
  END IF;

  -- 7. Record Payment Entry if Upfront Payment Made
  IF v_paid_amt > 0 THEN
    INSERT INTO payments (
      shop_id, payment_type, reference_type, reference_id, supplier_id,
      payment_method, amount, notes, created_by
    ) VALUES (
      p_shop_id, 'PURCHASE', 'PURCHASE', v_purchase_id, p_supplier_id,
      'BANK_TRANSFER', v_paid_amt, 'Payment for Purchase Invoice #' || COALESCE(p_invoice_number, 'N/A'), p_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'total_amount', v_grand_total,
    'subtotal', v_subtotal,
    'tax_amount', v_total_tax
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION process_purchase(UUID, UUID, UUID, VARCHAR, TIMESTAMPTZ, JSONB, TEXT, DECIMAL, VARCHAR) TO authenticated, service_role;
