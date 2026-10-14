-- Migration 021: Add MRP and distinct Best-Before date support
-- Preserves backwards compatibility with all existing products, batches, and transactions.

-- 1. Add mrp to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(12,2) DEFAULT NULL CHECK (mrp IS NULL OR mrp >= 0);

-- 2. Add mrp and best_before_date to product_batches table
ALTER TABLE product_batches
  ADD COLUMN IF NOT EXISTS mrp DECIMAL(12,2) DEFAULT NULL CHECK (mrp IS NULL OR mrp >= 0),
  ADD COLUMN IF NOT EXISTS best_before_date DATE DEFAULT NULL;

-- 3. Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_products_mrp ON products(shop_id, mrp);
CREATE INDEX IF NOT EXISTS idx_product_batches_mrp ON product_batches(shop_id, mrp);
CREATE INDEX IF NOT EXISTS idx_product_batches_best_before ON product_batches(shop_id, best_before_date);

-- 4. Update create_product_with_stock to optionally accept and store p_mrp
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
  p_licence_number VARCHAR DEFAULT NULL,
  p_mrp DECIMAL DEFAULT NULL
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

  -- Insert Product with initial current_stock = 0 and optional mrp
  INSERT INTO products (
    shop_id, category_id, brand_id, name, description, sku, barcode,
    purchase_price, selling_price, wholesale_price, mrp, gst_rate, hsn_code,
    unit, min_stock, current_stock, is_active,
    product_type, active_ingredient, formulation, crop, target_pest, pack_size, licence_number,
    batch_tracking, expiry_tracking
  ) VALUES (
    p_shop_id, p_category_id, p_brand_id, trim(p_name), p_description, NULLIF(trim(p_sku), ''), NULLIF(trim(p_barcode), ''),
    COALESCE(p_purchase_price, 0), COALESCE(p_selling_price, 0), COALESCE(p_wholesale_price, 0), p_mrp,
    COALESCE(p_gst_rate, 0), p_hsn_code, COALESCE(p_unit, 'Piece'), COALESCE(p_min_stock, 0), 0, true,
    p_product_type, p_active_ingredient, p_formulation, p_crop, p_target_pest, p_pack_size, p_licence_number,
    COALESCE(p_batch_tracking, false), COALESCE(p_expiry_tracking, false)
  ) RETURNING id INTO v_product_id;

  -- Create batch shell if batch tracked and opening stock exists
  IF p_batch_tracking = true AND v_stock > 0 THEN
    IF p_batch_number IS NULL OR trim(p_batch_number) = '' THEN
      RAISE EXCEPTION 'Batch number is required for batch-tracked products with opening stock';
    END IF;

    IF p_expiry_tracking = true AND p_expiry_date IS NULL THEN
      RAISE EXCEPTION 'Expiry date is required when expiry tracking is enabled';
    END IF;

    INSERT INTO product_batches (
      shop_id, product_id, batch_number, manufacturing_date, expiry_date,
      purchase_price, selling_price, mrp, quantity_received, quantity_available, is_active
    ) VALUES (
      p_shop_id, v_product_id, trim(p_batch_number), p_mfd_date, p_expiry_date,
      p_purchase_price, p_selling_price, p_mrp, v_stock, 0, true
    ) RETURNING id INTO v_batch_id;
  END IF;

  -- Route Opening Stock through Central Stock Engine
  IF v_stock > 0 THEN
    PERFORM process_stock_movement(
      p_shop_id, v_product_id, v_batch_id, 'OPENING_STOCK',
      v_stock, 'Opening Stock Initialization', 'OPENING_STOCK', v_product_id, p_user_id
    );
  END IF;

  -- Create Audit Log
  INSERT INTO audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (p_shop_id, p_user_id, 'CREATE_PRODUCT', 'PRODUCT', v_product_id, jsonb_build_object('name', p_name, 'opening_stock', v_stock, 'mrp', p_mrp));

  RETURN jsonb_build_object(
    'success', true,
    'id', v_product_id,
    'product_id', v_product_id,
    'batch_id', v_batch_id,
    'stock', v_stock
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
