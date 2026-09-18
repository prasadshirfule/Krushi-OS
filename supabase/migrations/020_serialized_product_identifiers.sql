-- Migration 020: Support Serialized Product QR Matching
-- Adds stable_product_key, batch_number, serial_number to product_identifiers

ALTER TABLE product_identifiers 
  ADD COLUMN IF NOT EXISTS stable_product_key VARCHAR,
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR,
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR;

CREATE INDEX IF NOT EXISTS idx_product_identifiers_stable_key 
  ON product_identifiers(shop_id, stable_product_key);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_batch 
  ON product_identifiers(shop_id, batch_number);
