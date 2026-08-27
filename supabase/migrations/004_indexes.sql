-- PostgreSQL Composite Indexes for KRUSHI OS Performance Optimization

-- 1. Sales indexes for Dashboard, Reports, and Sales History
CREATE INDEX IF NOT EXISTS idx_sales_shop_status_date ON sales(shop_id, status, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shop_created ON sales(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(shop_id, customer_id);

-- 2. Sale Items indexes for Invoice rendering and Top Products ranking
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_prod ON sale_items(sale_id, product_id);

-- 3. Product Batches indexes for Low Stock & Expiring Batches
CREATE INDEX IF NOT EXISTS idx_batches_shop_qty_exp ON product_batches(shop_id, quantity_available, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(shop_id, product_id);

-- 4. Payments indexes for Payments Log
CREATE INDEX IF NOT EXISTS idx_payments_shop_created ON payments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(shop_id, supplier_id);

-- 5. Customer & Supplier Ledger indexes
CREATE INDEX IF NOT EXISTS idx_customer_ledger_cust ON customer_ledger(shop_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supp ON supplier_ledger(shop_id, supplier_id, created_at DESC);

-- 6. Stock Transactions & Audit Logs
CREATE INDEX IF NOT EXISTS idx_stock_trans_prod ON stock_transactions(shop_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop ON audit_logs(shop_id, created_at DESC);
