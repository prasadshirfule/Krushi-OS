# 🗄️ KRUSHI OS — Database Schema & Data Model Reference

This document provides a comprehensive specification of the PostgreSQL database schema powering **KRUSHI OS**. The database is hosted on **Supabase** (PostgreSQL 15) and utilizes Row Level Security (RLS), custom PL/pgSQL stored procedures, and triggers for automated audit timestamps and invoice generation.

---

## 1. Schema Overview

The database contains **22 core business tables** organized into logical domains:
- **Tenancy & Access**: `shops`, `roles`, `users`
- **Product Catalog**: `categories`, `brands`, `products`, `product_batches`
- **Inventory & Stock**: `stock_transactions`
- **Customers & Khata**: `customers`, `customer_ledger`
- **Suppliers & Inward**: `suppliers`, `supplier_ledger`, `purchases`, `purchase_items`
- **Sales & Point of Sale**: `sales`, `sale_items`, `payments`
- **Operating Expenses**: `expense_categories`, `expenses`
- **System & Administration**: `notifications`, `settings`, `audit_logs`

---

## 2. Table Specifications

### 2.1 `shops`
Stores retail shop identities and tenant configurations.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Unique shop identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Trade name of the agricultural shop |
| `address` | `TEXT` | `NULL` | — | Physical street address |
| `phone` | `VARCHAR` | `NULL` | — | Primary shop contact phone number |
| `email` | `VARCHAR` | `NULL` | — | Official email address |
| `gst_number` | `VARCHAR` | `NULL` | — | 15-digit GSTIN (e.g. 27AADCH4311G1Z1) |
| `license_info` | `TEXT` | `NULL` | — | Pesticide & Seed Dealer license details |
| `logo_url` | `TEXT` | `NULL` | — | Public URL to shop logo in Supabase storage |
| `invoice_prefix`| `VARCHAR` | `NULL` | `'KOS'` | Prefix used for POS invoice numbering |
| `invoice_counter`| `INTEGER` | `NULL` | `0` | Atomic sequence counter for invoices |
| `terms_and_conditions` | `TEXT` | `NULL` | — | Default invoice footer terms |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Record last update timestamp (Trigger) |

---

### 2.2 `roles`
Defines role definitions and granular JSON permission bundles.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Role unique identifier |
| `name` | `VARCHAR` | `UNIQUE NOT NULL CHECK (name IN ('Admin', 'Manager', 'Cashier', 'Sales Staff'))` | — | Role name |
| `description` | `TEXT` | `NULL` | — | Description of access scope |
| `permissions` | `JSONB` | `NULL` | — | Optional custom JSON permission overrides |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.3 `users`
Represents employees and staff profiles linked to Supabase Auth.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY REFERENCES auth.users(id)` | — | User ID matching Supabase Auth UID |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Associated shop tenant |
| `role_id` | `UUID` | `NOT NULL REFERENCES roles(id) ON DELETE RESTRICT` | — | Assigned user role |
| `full_name` | `VARCHAR` | `NOT NULL` | — | Full name of the employee |
| `email` | `VARCHAR` | `NULL` | — | Employee email address |
| `phone` | `VARCHAR` | `NULL` | — | 10-digit mobile number |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Active status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

---

### 2.4 `categories`
Product classification taxonomy (e.g. Seeds, Fertilizers, Insecticides, Fungicides).

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Category unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Category display name |
| `description` | `TEXT` | `NULL` | — | Optional category notes |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

*Unique Constraint*: `UNIQUE(shop_id, name)`

---

### 2.5 `brands`
Agricultural manufacturers and brand entities (e.g. Bayer, Syngenta, IFFCO, Mahyco).

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Brand unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Brand trade name |
| `manufacturer` | `VARCHAR` | `NULL` | — | Manufacturing company name |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

*Unique Constraint*: `UNIQUE(shop_id, name)`

---

### 2.6 `products`
Master SKU catalog containing tax rules, pricing, and stock bounds.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Product unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `category_id` | `UUID` | `NOT NULL REFERENCES categories(id) ON DELETE RESTRICT` | — | Category relation |
| `brand_id` | `UUID` | `REFERENCES brands(id) ON DELETE SET NULL` | `NULL` | Brand relation |
| `name` | `VARCHAR` | `NOT NULL` | — | Commercial product title |
| `description` | `TEXT` | `NULL` | — | Technical specs, dosage instructions |
| `sku` | `VARCHAR` | `NULL` | — | Internal SKU code |
| `barcode` | `VARCHAR` | `NULL` | — | EAN/UPC scanned barcode |
| `image_url` | `TEXT` | `NULL` | — | Product image URL |
| `purchase_price`| `DECIMAL(12,2)` | `CHECK (purchase_price >= 0)` | `0.00` | Latest purchase rate |
| `selling_price` | `DECIMAL(12,2)` | `CHECK (selling_price >= 0)` | `0.00` | Retail Selling Price (MRP) |
| `wholesale_price`| `DECIMAL(12,2)`| `NULL` | `0.00` | Bulk/wholesale price |
| `gst_rate` | `DECIMAL(4,2)` | `CHECK (gst_rate >= 0 AND gst_rate <= 100)` | `0.00` | Applicable GST percentage (e.g. 5, 12, 18) |
| `hsn_code` | `VARCHAR` | `NULL` | — | 4/6/8-digit GST HSN code |
| `unit` | `VARCHAR` | `NULL` | `'Piece'` | Measuring unit (Kg, Ltr, Bottle, Bag, Piece) |
| `min_stock` | `INTEGER` | `NULL` | `0` | Minimum reorder threshold |
| `max_stock` | `INTEGER` | `NULL` | `0` | Maximum warehouse capacity |
| `current_stock` | `INTEGER` | `CHECK (current_stock >= 0)` | `0` | Aggregated on-hand inventory |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

*Indexes & Constraints*: `UNIQUE(shop_id, sku)`, `idx_products_barcode`, `idx_products_name`.

---

### 2.7 `product_batches`
Physical batch tracking for shelf-life enforcement and FEFO operations.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Batch unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `product_id` | `UUID` | `NOT NULL REFERENCES products(id) ON DELETE CASCADE` | — | Product relation |
| `batch_number` | `VARCHAR` | `NULL` | — | Manufacturer batch / lot number |
| `manufacturing_date` | `DATE` | `NULL` | — | Date of production |
| `expiry_date` | `DATE` | `NOT NULL` | — | Date of product expiration |
| `purchase_price` | `DECIMAL(12,2)` | `NULL` | — | Purchase cost for this batch |
| `selling_price` | `DECIMAL(12,2)` | `NULL` | — | Selling price for this batch |
| `quantity_received` | `INTEGER` | `NOT NULL CHECK (quantity_received >= 0)` | — | Total quantity received in inward |
| `quantity_available`| `INTEGER` | `NOT NULL CHECK (quantity_available >= 0)` | — | Available unallocated stock |
| `supplier_id` | `UUID` | `REFERENCES suppliers(id) ON DELETE SET NULL` | `NULL` | Supplier relation |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Active status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

*Table Constraints*: `CHECK(quantity_available <= quantity_received)`, `CHECK(expiry_date > manufacturing_date)`.

---

### 2.8 `customers`
Farmer and agricultural buyer profiles including crop history and credit status.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Customer unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Farmer / buyer full name |
| `mobile` | `VARCHAR` | `NULL` | — | 10-digit Indian mobile number |
| `village` | `VARCHAR` | `NULL` | — | Village / Taluka name |
| `address` | `TEXT` | `NULL` | — | Full postal address |
| `farm_size` | `VARCHAR` | `NULL` | — | Land size (e.g. 5 Acres, 10 Hectares) |
| `crops` | `TEXT` | `NULL` | — | Cultivated crops (e.g. Sugarcane, Cotton, Soybean) |
| `notes` | `TEXT` | `NULL` | — | Special remarks / credit limit notes |
| `total_purchases` | `DECIMAL(14,2)` | `NULL` | `0.00` | Lifetime gross purchases |
| `total_paid` | `DECIMAL(14,2)` | `NULL` | `0.00` | Lifetime payments collected |
| `outstanding` | `DECIMAL(14,2)` | `NULL` | `0.00` | Current unpaid credit balance (Khata) |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

*Indexes*: `idx_customers_mobile`, `idx_customers_name`.

---

### 2.9 `customer_ledger`
Double-entry bookkeeping journal tracking every farmer debit and credit movement.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Ledger entry unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `customer_id` | `UUID` | `NOT NULL REFERENCES customers(id) ON DELETE CASCADE` | — | Customer relation |
| `date` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Transaction timestamp |
| `description` | `TEXT` | `NULL` | — | Entry description (e.g. Invoice #KOS-000102) |
| `reference_type` | `VARCHAR` | `CHECK (reference_type IN ('SALE', 'PAYMENT', 'RETURN', 'ADJUSTMENT'))` | — | Transaction type |
| `reference_id` | `UUID` | `NULL` | — | Foreign key to `sales.id` or `payments.id` |
| `debit` | `DECIMAL(12,2)` | `NULL` | `0.00` | Amount added to credit debt (Sales) |
| `credit` | `DECIMAL(12,2)` | `NULL` | `0.00` | Amount repaid / settled (Payments) |
| `balance` | `DECIMAL(14,2)` | `NOT NULL` | — | Running cumulative credit balance |
| `notes` | `TEXT` | `NULL` | — | Additional notes |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Staff member who created entry |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.10 `suppliers`
Distributor and wholesale vendor accounts.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Supplier unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Contact person / agent name |
| `company` | `VARCHAR` | `NULL` | — | Distributor agency / company name |
| `mobile` | `VARCHAR` | `NULL` | — | Contact phone number |
| `email` | `VARCHAR` | `NULL` | — | Email address |
| `address` | `TEXT` | `NULL` | — | Physical office / godown address |
| `gst_number` | `VARCHAR` | `NULL` | — | Supplier GSTIN |
| `total_purchases` | `DECIMAL(14,2)` | `NULL` | `0.00` | Lifetime gross purchases |
| `total_paid` | `DECIMAL(14,2)` | `NULL` | `0.00` | Lifetime payments made |
| `outstanding` | `DECIMAL(14,2)` | `NULL` | `0.00` | Current unpaid payable balance |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

---

### 2.11 `supplier_ledger`
Vendor financial ledger tracking purchase credit liabilities and payouts.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Ledger entry unique identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `supplier_id` | `UUID` | `NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE` | — | Supplier relation |
| `date` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Entry timestamp |
| `description` | `TEXT` | `NULL` | — | Description (e.g. Purchase Inv #9012) |
| `reference_type` | `VARCHAR` | `NULL` | — | Reference category ('PURCHASE', 'PAYMENT') |
| `reference_id` | `UUID` | `NULL` | — | Foreign key to purchase or payment record |
| `debit` | `DECIMAL(12,2)` | `NULL` | `0.00` | Payouts made to supplier (reduces balance) |
| `credit` | `DECIMAL(12,2)` | `NULL` | `0.00` | New purchases received (increases balance) |
| `balance` | `DECIMAL(14,2)` | `NOT NULL` | — | Cumulative balance payable |
| `notes` | `TEXT` | `NULL` | — | Notes |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Staff member reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.12 `stock_transactions`
Auditable log of every physical quantity change across the system.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Transaction identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `product_id` | `UUID` | `NOT NULL REFERENCES products(id) ON DELETE CASCADE` | — | Product relation |
| `batch_id` | `UUID` | `REFERENCES product_batches(id) ON DELETE SET NULL` | `NULL` | Associated batch |
| `transaction_type` | `VARCHAR` | `CHECK (transaction_type IN ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED'))` | — | Stock event category |
| `previous_quantity`| `INTEGER` | `NOT NULL` | — | Quantity before movement |
| `quantity_change` | `INTEGER` | `NOT NULL` | — | Delta (positive for inward, negative for outward) |
| `new_quantity` | `INTEGER` | `NOT NULL` | — | Final quantity after movement |
| `reason` | `TEXT` | `NULL` | — | Human-readable explanation |
| `reference_type` | `VARCHAR` | `NULL` | — | Related entity type ('SALE', 'PURCHASE') |
| `reference_id` | `UUID` | `NULL` | — | Related entity UUID |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Staff member reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Transaction timestamp |

---

### 2.13 `purchases`
Inward supplier purchase invoice header.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Purchase invoice identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `supplier_id` | `UUID` | `NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT` | — | Supplier relation |
| `invoice_number` | `VARCHAR` | `NULL` | — | Supplier's physical invoice / bill number |
| `purchase_date` | `DATE` | `NULL` | `CURRENT_DATE` | Date of purchase bill |
| `subtotal` | `DECIMAL(14,2)` | `NULL` | `0.00` | Taxable amount before GST |
| `tax_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Total GST amount |
| `discount_amount`| `DECIMAL(12,2)` | `NULL` | `0.00` | Trade discount applied |
| `total_amount` | `DECIMAL(14,2)` | `NULL` | `0.00` | Net payable bill value |
| `paid_amount` | `DECIMAL(14,2)` | `NULL` | `0.00` | Amount paid upfront |
| `status` | `VARCHAR` | `CHECK (status IN ('draft', 'completed', 'cancelled'))` | `'completed'` | Invoice status |
| `notes` | `TEXT` | `NULL` | — | Inward notes |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Operator reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

---

### 2.14 `purchase_items`
Line items for inward supplier purchases.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Line item identifier |
| `purchase_id` | `UUID` | `NOT NULL REFERENCES purchases(id) ON DELETE CASCADE` | — | Parent purchase bill |
| `product_id` | `UUID` | `NOT NULL REFERENCES products(id) ON DELETE RESTRICT` | — | Product received |
| `batch_id` | `UUID` | `REFERENCES product_batches(id) ON DELETE SET NULL` | `NULL` | Newly created batch record |
| `quantity` | `INTEGER` | `NOT NULL CHECK (quantity > 0)` | — | Units received |
| `purchase_price`| `DECIMAL(12,2)` | `NOT NULL CHECK (purchase_price >= 0)` | — | Unit purchase rate |
| `gst_rate` | `DECIMAL(4,2)` | `NULL` | `0.00` | GST percentage |
| `gst_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Calculated tax for line |
| `total_amount` | `DECIMAL(12,2)` | `NOT NULL` | — | Total line item cost |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.15 `sales`
POS sales invoice header recording counter transactions.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Sale identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `customer_id` | `UUID` | `REFERENCES customers(id) ON DELETE SET NULL` | `NULL` | Linked customer (or walk-in if NULL) |
| `invoice_number` | `VARCHAR` | `NOT NULL` | — | Generated bill number (e.g. KOS-000102) |
| `sale_date` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Bill date & time |
| `subtotal` | `DECIMAL(14,2)` | `NULL` | `0.00` | Gross total before taxes |
| `discount_amount`| `DECIMAL(12,2)` | `NULL` | `0.00` | Discount deducted |
| `tax_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Total GST amount (CGST+SGST or IGST) |
| `round_off` | `DECIMAL(4,2)` | `NULL` | `0.00` | Round off adjustment |
| `total_amount` | `DECIMAL(14,2)` | `NULL` | `0.00` | Net payable amount |
| `profit_amount` | `DECIMAL(14,2)` | `NULL` | `0.00` | Calculated gross profit on sale |
| `payment_status` | `VARCHAR` | `CHECK (payment_status IN ('paid', 'partial', 'credit', 'cancelled'))` | `'paid'` | Payment state |
| `status` | `VARCHAR` | `CHECK (status IN ('completed', 'returned', 'partially_returned', 'cancelled'))` | `'completed'` | Order status |
| `notes` | `TEXT` | `NULL` | — | Sale notes |
| `idempotency_key`| `VARCHAR` | `UNIQUE` | `NULL` | Client-generated UUID preventing duplicate posts |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Cashier reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

*Unique Constraint*: `UNIQUE(shop_id, invoice_number)`. *Indexes*: `idx_sales_sale_date`, `idx_sales_customer_id`.

---

### 2.16 `sale_items`
Line items recorded for each counter sale.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Line item identifier |
| `sale_id` | `UUID` | `NOT NULL REFERENCES sales(id) ON DELETE CASCADE` | — | Parent sale header |
| `product_id` | `UUID` | `NOT NULL REFERENCES products(id) ON DELETE RESTRICT` | — | Product sold |
| `batch_id` | `UUID` | `REFERENCES product_batches(id) ON DELETE SET NULL` | `NULL` | Batch sold |
| `product_name` | `VARCHAR` | `NOT NULL` | — | Snapshot of product title at sale time |
| `batch_number` | `VARCHAR` | `NULL` | — | Snapshot of batch code |
| `quantity` | `INTEGER` | `NOT NULL CHECK (quantity > 0)` | — | Units sold |
| `unit_price` | `DECIMAL(12,2)` | `NOT NULL` | — | Selling price per unit |
| `cost_price` | `DECIMAL(12,2)` | `NULL` | `0.00` | Purchase cost per unit at time of sale |
| `discount_percent`| `DECIMAL(5,2)`| `NULL` | `0.00` | Line item discount % |
| `discount_amount` | `DECIMAL(12,2)`| `NULL` | `0.00` | Line item discount amount |
| `gst_rate` | `DECIMAL(4,2)` | `NULL` | `0.00` | Applicable GST percentage |
| `cgst_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Central GST component |
| `sgst_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | State GST component |
| `tax_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Total tax on line item |
| `total_amount` | `DECIMAL(12,2)` | `NOT NULL` | — | Net line item total |
| `profit_amount` | `DECIMAL(12,2)` | `NULL` | `0.00` | Gross profit realized on line item |
| `returned_quantity`| `INTEGER` | `NULL` | `0` | Units returned via credit note |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.17 `payments`
Unified ledger of money flows (Cash, UPI, Cards, Bank, Credit).

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Payment identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `payment_type` | `VARCHAR` | `CHECK (payment_type IN ('SALE', 'PURCHASE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'REFUND'))` | — | Payment classification |
| `reference_type` | `VARCHAR` | `NULL` | — | Linked entity type ('SALE', 'PURCHASE', 'CUSTOMER') |
| `reference_id` | `UUID` | `NULL` | — | Linked record UUID |
| `payment_method`| `VARCHAR` | `CHECK (payment_method IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'))` | — | Instrument used |
| `amount` | `DECIMAL(14,2)` | `NOT NULL` | — | Payment amount |
| `payment_date` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Timestamp |
| `notes` | `TEXT` | `NULL` | — | Transaction reference / UPI UTR # |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Cashier reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

---

### 2.18 `expense_categories` & 2.19 `expenses`
Operational expenses ledger (Rent, Electricity, Salaries, Transport).

#### `expense_categories`
| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Category identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `name` | `VARCHAR` | `NOT NULL` | — | Expense type name |
| `description` | `TEXT` | `NULL` | — | Category description |
| `is_active` | `BOOLEAN` | `NULL` | `true` | Status toggle |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |

*Unique Constraint*: `UNIQUE(shop_id, name)`.

#### `expenses`
| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Expense identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `category_id` | `UUID` | `REFERENCES expense_categories(id) ON DELETE SET NULL` | `NULL` | Expense category |
| `date` | `DATE` | `NULL` | `CURRENT_DATE` | Incurred date |
| `amount` | `DECIMAL(12,2)` | `NOT NULL CHECK (amount > 0)` | — | Expense value |
| `description` | `TEXT` | `NULL` | — | Reason / payee |
| `payment_method`| `VARCHAR` | `NULL` | `'CASH'` | Payment instrument |
| `receipt_url` | `TEXT` | `NULL` | — | Supabase storage image link |
| `created_by` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Staff reference |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

---

### 2.20 `notifications`
Real-time system warnings for product expiries and low inventory.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Notification identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant identifier |
| `type` | `VARCHAR` | `CHECK (type IN ('CRITICAL', 'WARNING', 'INFO'))` | `'INFO'` | Urgency level |
| `title` | `VARCHAR` | `NOT NULL` | — | Alert headline |
| `message` | `TEXT` | `NULL` | — | Alert detail |
| `is_read` | `BOOLEAN` | `NULL` | `false` | Read status |
| `entity_type` | `VARCHAR` | `NULL` | — | Associated entity ('PRODUCT', 'BATCH') |
| `entity_id` | `UUID` | `NULL` | — | Target entity UUID |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Timestamp |

*Indexes*: `idx_notifications_shop_read(shop_id, is_read)`.

---

### 2.21 `settings`
Tenant-level printer configurations, GST defaults, and branding.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Settings identifier |
| `shop_id` | `UUID` | `NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant reference |
| `shop_name` | `VARCHAR` | `NULL` | — | Registered store name |
| `shop_address` | `TEXT` | `NULL` | — | Store address |
| `shop_phone` | `VARCHAR` | `NULL` | — | Phone number |
| `shop_email` | `VARCHAR` | `NULL` | — | Email address |
| `shop_gst` | `VARCHAR` | `NULL` | — | GSTIN |
| `shop_license` | `VARCHAR` | `NULL` | — | Pesticide & fertilizer license number |
| `logo_url` | `TEXT` | `NULL` | — | Header logo URL |
| `invoice_prefix`| `VARCHAR` | `NULL` | `'KOS'` | Bill prefix |
| `invoice_terms` | `TEXT` | `NULL` | — | Invoice terms & conditions |
| `invoice_footer`| `TEXT` | `NULL` | — | Invoice footer note |
| `print_a4` | `BOOLEAN` | `NULL` | `true` | Enable A4 tax invoice |
| `print_80mm` | `BOOLEAN` | `NULL` | `false` | Enable 80mm thermal slip |
| `print_58mm` | `BOOLEAN` | `NULL` | `false` | Enable 58mm thermal slip |
| `default_gst_rate`| `DECIMAL(4,2)`| `NULL` | `18.00` | Default GST rate |
| `enable_igst` | `BOOLEAN` | `NULL` | `false` | Out-of-state IGST toggle |
| `currency_symbol`| `VARCHAR` | `NULL` | `'₹'` | Currency glyph |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Last update timestamp (Trigger) |

---

### 2.22 `audit_logs`
Tamper-evident log of administrative mutations and critical data diffs.

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | `gen_random_uuid()` | Audit log identifier |
| `shop_id` | `UUID` | `NOT NULL REFERENCES shops(id) ON DELETE CASCADE` | — | Shop tenant reference |
| `user_id` | `UUID` | `REFERENCES users(id) ON DELETE SET NULL` | `NULL` | Operator UUID |
| `action` | `VARCHAR` | `NOT NULL` | — | Operation code ('CREATE', 'UPDATE', 'DELETE', 'ADJUST_STOCK') |
| `entity_type` | `VARCHAR` | `NOT NULL` | — | Target table ('products', 'sales', 'settings') |
| `entity_id` | `UUID` | `NULL` | — | Target record UUID |
| `old_values` | `JSONB` | `NULL` | — | Previous field values JSON |
| `new_values` | `JSONB` | `NULL` | — | Updated field values JSON |
| `ip_address` | `VARCHAR` | `NULL` | — | Client IP address |
| `user_agent` | `TEXT` | `NULL` | — | Client user-agent string |
| `created_at` | `TIMESTAMPTZ` | `NULL` | `NOW()` | Event timestamp |

*Indexes*: `idx_audit_logs_shop_created(shop_id, created_at DESC)`, `idx_audit_logs_entity(entity_type, entity_id)`.

---

## 3. Database Functions & Triggers

### 3.1 `set_updated_at()` Trigger
Automatically updates the `updated_at` column whenever a row is modified across `shops`, `users`, `products`, `product_batches`, `customers`, `suppliers`, `purchases`, `sales`, `expenses`, and `settings`.

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3.2 `generate_invoice_number(p_shop_id UUID)`
Generates race-free, gapless sequential invoice numbers formatted with zero-padding (e.g. `KOS-000042`).

```sql
CREATE OR REPLACE FUNCTION generate_invoice_number(p_shop_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_counter INTEGER;
  v_invoice_number VARCHAR;
BEGIN
  SELECT invoice_prefix, invoice_counter + 1 
  INTO v_prefix, v_counter
  FROM shops
  WHERE id = p_shop_id
  FOR UPDATE;

  v_invoice_number := v_prefix || '-' || LPAD(v_counter::TEXT, 6, '0');

  UPDATE shops
  SET invoice_counter = v_counter
  WHERE id = p_shop_id;

  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;
```

### 3.3 `get_expiry_status(expiry_date DATE)`
Deterministic status classifier based on remaining shelf life:

```sql
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
```

---

## 4. Migration Execution Plan

To set up a fresh database, execute the migration files strictly in this order:

1. **`supabase/migrations/001_initial_schema.sql`**
   - Enables `pgcrypto`
   - Creates `set_updated_at()` trigger function
   - Creates all 22 database tables, unique constraints, and B-tree indexes
2. **`supabase/migrations/002_rls_policies.sql`**
   - Creates helper function `get_user_shop_id()`
   - Enables Row Level Security on all tables
   - Applies tenant isolation policies for all tables
3. **`supabase/migrations/003_functions.sql`**
   - Installs `generate_invoice_number`
   - Installs `get_expiry_status`
4. **`supabase/seed.sql`**
   - Populates initial shop, roles, default categories, agro brands, sample products, batches, and demo customers
