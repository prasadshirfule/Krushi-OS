-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. shops
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  address TEXT,
  phone VARCHAR,
  email VARCHAR,
  gst_number VARCHAR,
  license_info TEXT,
  logo_url TEXT,
  invoice_prefix VARCHAR DEFAULT 'KOS',
  invoice_counter INTEGER DEFAULT 0,
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_shops_updated_at
BEFORE UPDATE ON shops
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL CHECK (name IN ('Admin', 'Manager', 'Cashier', 'Sales Staff')),
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. users
CREATE TABLE users (
  id UUID PRIMARY KEY, -- references auth.users which might not exist in standard public schema without supabase auth, assuming it will be handled by supabase
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  full_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, name)
);

-- 5. brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  manufacturer VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, name)
);

-- 6. products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  sku VARCHAR,
  barcode VARCHAR,
  image_url TEXT,
  purchase_price DECIMAL(12,2) DEFAULT 0 CHECK(purchase_price >= 0),
  selling_price DECIMAL(12,2) DEFAULT 0 CHECK(selling_price >= 0),
  wholesale_price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(4,2) DEFAULT 0 CHECK(gst_rate >= 0 AND gst_rate <= 100),
  hsn_code VARCHAR,
  unit VARCHAR DEFAULT 'Piece',
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0 CHECK(current_stock >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, sku)
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);

CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. product_batches (supplier_id added later)
CREATE TABLE product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number VARCHAR,
  manufacturing_date DATE,
  expiry_date DATE NOT NULL,
  purchase_price DECIMAL(12,2),
  selling_price DECIMAL(12,2),
  quantity_received INTEGER NOT NULL CHECK (quantity_received >= 0),
  quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0),
  supplier_id UUID, -- Will add FK later
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK(quantity_available <= quantity_received),
  CHECK(expiry_date > manufacturing_date)
);

CREATE TRIGGER set_product_batches_updated_at
BEFORE UPDATE ON product_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  mobile VARCHAR,
  village VARCHAR,
  address TEXT,
  farm_size VARCHAR,
  crops TEXT,
  notes TEXT,
  total_purchases DECIMAL(14,2) DEFAULT 0,
  total_paid DECIMAL(14,2) DEFAULT 0,
  outstanding DECIMAL(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_customers_name ON customers(name);

CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. customer_ledger
CREATE TABLE customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  reference_type VARCHAR CHECK (reference_type IN ('SALE', 'PAYMENT', 'RETURN', 'ADJUSTMENT')),
  reference_id UUID,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  company VARCHAR,
  mobile VARCHAR,
  email VARCHAR,
  address TEXT,
  gst_number VARCHAR,
  total_purchases DECIMAL(14,2) DEFAULT 0,
  total_paid DECIMAL(14,2) DEFAULT 0,
  outstanding DECIMAL(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);

CREATE TRIGGER set_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. supplier_ledger
CREATE TABLE supplier_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  reference_type VARCHAR,
  reference_id UUID,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(14,2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ALTER product_batches
ALTER TABLE product_batches
ADD CONSTRAINT fk_product_batches_supplier
FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- 13. stock_transactions
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED')),
  previous_quantity INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT,
  reference_type VARCHAR,
  reference_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number VARCHAR,
  purchase_date DATE DEFAULT CURRENT_DATE,
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(14,2) DEFAULT 0,
  paid_amount DECIMAL(14,2) DEFAULT 0,
  status VARCHAR DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_purchases_updated_at
BEFORE UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. purchase_items
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_price DECIMAL(12,2) NOT NULL CHECK (purchase_price >= 0),
  gst_rate DECIMAL(4,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number VARCHAR NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(14,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  round_off DECIMAL(4,2) DEFAULT 0,
  total_amount DECIMAL(14,2) DEFAULT 0,
  profit_amount DECIMAL(14,2) DEFAULT 0,
  payment_status VARCHAR DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'credit', 'cancelled')),
  status VARCHAR DEFAULT 'completed' CHECK (status IN ('completed', 'returned', 'partially_returned', 'cancelled')),
  notes TEXT,
  idempotency_key VARCHAR UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, invoice_number)
);

CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);

CREATE TRIGGER set_sales_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 17. sale_items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  product_name VARCHAR NOT NULL,
  batch_number VARCHAR,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(4,2) DEFAULT 0,
  cgst_amount DECIMAL(12,2) DEFAULT 0,
  sgst_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  profit_amount DECIMAL(12,2) DEFAULT 0,
  returned_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  payment_type VARCHAR NOT NULL CHECK (payment_type IN ('SALE', 'PURCHASE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'REFUND')),
  reference_type VARCHAR,
  reference_id UUID,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  payment_method VARCHAR NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT')),
  amount DECIMAL(14,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. expense_categories
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, name)
);

-- 20. expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  date DATE DEFAULT CURRENT_DATE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  payment_method VARCHAR DEFAULT 'CASH',
  receipt_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 21. notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type VARCHAR DEFAULT 'INFO' CHECK (type IN ('CRITICAL', 'WARNING', 'INFO')),
  title VARCHAR NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  entity_type VARCHAR,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_shop_read ON notifications(shop_id, is_read);

-- 22. settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE UNIQUE,
  shop_name VARCHAR,
  shop_address TEXT,
  shop_phone VARCHAR,
  shop_email VARCHAR,
  shop_gst VARCHAR,
  shop_license VARCHAR,
  logo_url TEXT,
  invoice_prefix VARCHAR DEFAULT 'KOS',
  invoice_terms TEXT,
  invoice_footer TEXT,
  print_a4 BOOLEAN DEFAULT true,
  print_80mm BOOLEAN DEFAULT false,
  print_58mm BOOLEAN DEFAULT false,
  default_gst_rate DECIMAL(4,2) DEFAULT 18,
  enable_igst BOOLEAN DEFAULT false,
  currency_symbol VARCHAR DEFAULT '₹',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 23. audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_shop_created ON audit_logs(shop_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
