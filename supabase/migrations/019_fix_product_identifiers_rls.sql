-- Migration 019: Fix Product Identifiers RLS Policy

DROP POLICY IF EXISTS "Users can manage product identifiers in their shop" ON product_identifiers;

CREATE POLICY "Users can manage product identifiers in their shop"
ON product_identifiers FOR ALL
USING (
  shop_id = get_user_shop_id()
)
WITH CHECK (
  shop_id = get_user_shop_id()
);
