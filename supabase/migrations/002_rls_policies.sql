-- 1. Helper Function
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- We assume users table has id matching auth.uid()
  SELECT shop_id INTO v_shop_id
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies

-- shops
CREATE POLICY "Users can view their own shop" 
ON shops FOR SELECT 
USING (id = get_user_shop_id());

CREATE POLICY "Users can update their own shop" 
ON shops FOR UPDATE 
USING (id = get_user_shop_id());

-- roles
CREATE POLICY "Anyone can view roles" 
ON roles FOR SELECT 
USING (true);

-- users
CREATE POLICY "Users can view users in same shop" 
ON users FOR SELECT 
USING (shop_id = get_user_shop_id());

-- Create a generic policy generator for all shop-based tables
DO $$
DECLARE
  t_name text;
BEGIN
  FOR t_name IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'shop_id' AND table_schema = 'public' AND table_name != 'shops' AND table_name != 'users'
  LOOP
    EXECUTE format('
      CREATE POLICY "Users can view %I in their shop" ON %I FOR SELECT USING (shop_id = get_user_shop_id());
      CREATE POLICY "Users can insert %I in their shop" ON %I FOR INSERT WITH CHECK (shop_id = get_user_shop_id());
      CREATE POLICY "Users can update %I in their shop" ON %I FOR UPDATE USING (shop_id = get_user_shop_id());
      CREATE POLICY "Users can delete %I in their shop" ON %I FOR DELETE USING (shop_id = get_user_shop_id());
    ', t_name, t_name, t_name, t_name, t_name, t_name, t_name, t_name);
  END LOOP;
END
$$;

-- Policies for tables without shop_id (purchase_items, sale_items)
CREATE POLICY "Users can view purchase_items via purchase"
ON purchase_items FOR ALL
USING (
  purchase_id IN (
    SELECT id FROM purchases WHERE shop_id = get_user_shop_id()
  )
);

CREATE POLICY "Users can view sale_items via sale"
ON sale_items FOR ALL
USING (
  sale_id IN (
    SELECT id FROM sales WHERE shop_id = get_user_shop_id()
  )
);
