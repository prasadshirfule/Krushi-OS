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
