-- Migration 018: Product Identifiers Table for Multi-Barcode/QR Registration & Exact Billing Lookup

CREATE TABLE IF NOT EXISTS product_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  identifier_type VARCHAR NOT NULL DEFAULT 'barcode', -- 'barcode', 'gtin', 'qr', 'other'
  raw_value TEXT NOT NULL,
  normalized_value VARCHAR,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, raw_value)
);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_shop_product ON product_identifiers(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_raw ON product_identifiers(shop_id, raw_value);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_normalized ON product_identifiers(shop_id, normalized_value);

-- Enable RLS
ALTER TABLE product_identifiers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Shop isolation
CREATE POLICY "Users can manage product identifiers in their shop"
ON product_identifiers FOR ALL
USING (
  shop_id = get_user_shop_id()
)
WITH CHECK (
  shop_id = get_user_shop_id()
);

