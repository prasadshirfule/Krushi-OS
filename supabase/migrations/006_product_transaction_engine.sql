-- Migration 006: Product Transaction Engine & Atomic Product Creation

-- 1. Update stock_transactions CHECK constraint to include 'OPENING_STOCK'
ALTER TABLE stock_transactions DROP CONSTRAINT IF EXISTS stock_transactions_transaction_type_check;

ALTER TABLE stock_transactions ADD CONSTRAINT stock_transactions_transaction_type_check
CHECK (transaction_type IN ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED', 'OPENING_STOCK'));

-- 2. Partial unique index for barcode per shop
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_barcode_unique ON products(shop_id, barcode) WHERE (barcode IS NOT NULL AND barcode != '' AND is_active = true);

-- 3. Atomic Product Creation Function (PL/pgSQL Transaction)
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
  -- 1. Validations
  IF p_opening_stock < 0 THEN
    RAISE EXCEPTION 'Opening stock cannot be negative';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Product name must be at least 2 characters';
  END IF;

  IF p_category_id IS NULL THEN
    RAISE EXCEPTION 'Category ID is required';
  END IF;

  -- Validate Category belongs to shop
  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_category_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Category not found or does not belong to this shop';
  END IF;

  -- Validate Brand belongs to shop if provided
  IF p_brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM brands WHERE id = p_brand_id AND shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'Brand not found or does not belong to this shop';
  END IF;

  -- SKU Uniqueness Check if provided
  IF p_sku IS NOT NULL AND trim(p_sku) != '' THEN
    IF EXISTS (SELECT 1 FROM products WHERE shop_id = p_shop_id AND sku = trim(p_sku) AND is_active = true) THEN
      RAISE EXCEPTION 'Product with SKU "%" already exists in this shop', p_sku;
    END IF;
  END IF;

  -- Barcode Uniqueness Check if provided
  IF p_barcode IS NOT NULL AND trim(p_barcode) != '' THEN
    IF EXISTS (SELECT 1 FROM products WHERE shop_id = p_shop_id AND barcode = trim(p_barcode) AND is_active = true) THEN
      RAISE EXCEPTION 'Product with Barcode "%" already exists in this shop', p_barcode;
    END IF;
  END IF;

  -- 2. Insert Product Record
  INSERT INTO products (
    shop_id, category_id, brand_id, name, description, sku, barcode,
    purchase_price, selling_price, wholesale_price, gst_rate, hsn_code,
    unit, min_stock, current_stock, is_active,
    product_type, active_ingredient, formulation, crop, target_pest, pack_size, licence_number,
    batch_tracking, expiry_tracking
  ) VALUES (
    p_shop_id, p_category_id, p_brand_id, trim(p_name), p_description, NULLIF(trim(p_sku), ''), NULLIF(trim(p_barcode), ''),
    COALESCE(p_purchase_price, 0), COALESCE(p_selling_price, 0), COALESCE(p_wholesale_price, 0),
    COALESCE(p_gst_rate, 0), p_hsn_code, COALESCE(p_unit, 'Piece'), COALESCE(p_min_stock, 0), v_stock, true,
    p_product_type, p_active_ingredient, p_formulation, p_crop, p_target_pest, p_pack_size, p_licence_number,
    COALESCE(p_batch_tracking, false), COALESCE(p_expiry_tracking, false)
  ) RETURNING id INTO v_product_id;

  -- 3. Flow B: Batch Tracked Product Opening Stock
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
      p_purchase_price, p_selling_price, v_stock, v_stock, true
    ) RETURNING id INTO v_batch_id;
  END IF;

  -- 4. Record OPENING_STOCK Transaction (Flow A & Flow B)
  IF v_stock > 0 THEN
    INSERT INTO stock_transactions (
      shop_id, product_id, batch_id, transaction_type, previous_quantity,
      quantity_change, new_quantity, reason, created_by
    ) VALUES (
      p_shop_id, v_product_id, v_batch_id, 'OPENING_STOCK', 0,
      v_stock, v_stock, 'Opening Stock Initialization', p_user_id
    );
  END IF;

  -- 5. Create Audit Log
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
