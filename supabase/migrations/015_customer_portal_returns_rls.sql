-- Migration 015: Customer Portal Returns & Read Access RLS Policies
-- ADDITIVE ONLY: Enables authenticated customers to view sale returns and return items
-- strictly for sales belonging to their own linked customer records.

-- 1. Customer SELECT policy on sale_returns
DROP POLICY IF EXISTS "Customers can view own sale returns" ON sale_returns;
CREATE POLICY "Customers can view own sale returns"
ON sale_returns FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE customer_account_id = get_customer_account_id()
  )
  OR
  sale_id IN (
    SELECT s.id FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE c.customer_account_id = get_customer_account_id()
  )
);

-- 2. Customer SELECT policy on sale_return_items
DROP POLICY IF EXISTS "Customers can view own sale return items" ON sale_return_items;
CREATE POLICY "Customers can view own sale return items"
ON sale_return_items FOR SELECT
USING (
  sale_return_id IN (
    SELECT sr.id FROM sale_returns sr
    JOIN sales s ON s.id = sr.sale_id
    JOIN customers c ON c.id = s.customer_id
    WHERE c.customer_account_id = get_customer_account_id()
  )
);
