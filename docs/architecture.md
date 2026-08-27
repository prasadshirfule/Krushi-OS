# 🏛️ KRUSHI OS — System Architecture Documentation

This document outlines the complete architectural design of **KRUSHI OS**, an agricultural retail ERP and Point of Sale (POS) platform built for high reliability, fast offline-capable counter operations, strict multi-tenancy isolation, and comprehensive financial integrity.

---

## 1. System Overview

KRUSHI OS is built as a unified full-stack web application leveraging Next.js 16 (App Router), React 19, TypeScript, and Supabase (PostgreSQL 15, Auth, Storage, Row-Level Security).

```
                      +------------------------------------------+
                      |         Web Client / POS Terminal        |
                      |  (Desktop Browser, Tablet, Touch POS)    |
                      +--------------------+---------------------+
                                           |
                                   HTTPS / WSS
                                           |
                                           v
+-----------------------------------------------------------------------------------+
| Next.js 16 Application Server (Vercel Edge / Node.js Runtime)                     |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Edge Middleware (Session Refresh, Auth Boundary Protection)                 |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|        +-------------------------------+-------------------------------+          |
|        |                                                               |          |
|        v                                                               v          |
|  +---------------------------+                               +-----------------+  |
|  | Server Components (RSC)   |                               | Server Actions  |  |
|  | (Page & Data Hydration)   |                               | ('use server')  |  |
|  +-------------+-------------+                               +--------+--------+  |
|                |                                                      |           |
|                +-----------------------+------------------------------+           |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  | Zod Validation & RBAC Authorization Layer (lib/permissions.ts)               |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  | Domain Service Layer (services/*.service.ts)                                |  |
|  | (Sales, Inventory, Customers, Purchases, Expenses, Reports, Settings)      |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  | Supabase SSR Client (@supabase/ssr)                                         |  |
|  +-------------------------------------+---------------------------------------+  |
+----------------------------------------|------------------------------------------+
                                         |
                       PostgreSQL wire protocol (SSL)
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| Supabase Cloud Platform (PostgreSQL 15 + pg_crypto)                               |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Multi-Tenant Row Level Security (RLS Engine: get_user_shop_id())            |  |
|  +-----------------------------------------------------------------------------+  |
|  | PostgreSQL Database Schema (24 Tables, Foreign Keys, Triggers, Indexes)     |  |
|  +-----------------------------------------------------------------------------+  |
|  | Stored Procedures (generate_invoice_number, get_expiry_status)              |  |
|  +-----------------------------------------------------------------------------+  |
|  | Supabase Storage (Shop Logos, Expense Receipts)                             |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Frontend Architecture

### 2.1 Next.js 16 App Router & Rendering Model
KRUSHI OS utilizes the Next.js App Router with React Server Components (RSC) as the default execution model. 

- **Server Components (Default)**: Fetch initial shop data, render static layout structures, execute security assertions, and hydrate the initial state with zero JavaScript footprint sent to the browser.
- **Client Components (`'use client'`)**: Isolated strictly to interactive leaves where client-side state, DOM event listeners, camera/barcode hardware integration, keyboard hooks, or modal animations are required (e.g., POS billing grid, autocomplete dialogs, date pickers).

### 2.2 Component Hierarchy & Structure

```
app/layout.tsx (Root HTML, Fonts, Theme Provider, Toast Provider)
└── app/(dashboard)/layout.tsx (Auth Guard, Navigation Sidebar, Header, Breadcrumbs)
    ├── app/(dashboard)/dashboard/page.tsx (KPI Cards, Recharts Sales Chart, Expiry Alert Feed)
    ├── app/(dashboard)/billing/page.tsx (Interactive POS Terminal)
    │   ├── components/billing/product-search-bar.tsx (Debounced F4 Search & Barcode Listener)
    │   ├── components/billing/cart-table.tsx (Live Editable Item Table & Expiry Selectors)
    │   ├── components/billing/bill-summary.tsx (Subtotal, GST, Round-off, Discount)
    │   └── components/billing/payment-dialog.tsx (Multi-method Split Payment Modal)
    ├── app/(dashboard)/inventory/page.tsx (Stock Ledger, Expiry Matrix, Batch Adjustment)
    ├── app/(dashboard)/customers/page.tsx (Khata Directory & Farmer Credit Balances)
    │   └── app/(dashboard)/customers/[id]/page.tsx (Farmer Ledger History & PDF Statement)
    └── app/(dashboard)/reports/page.tsx (Financial, Tax, Sales, and Profit Reports)
```

### 2.3 UI & Styling System
- **Tailwind CSS v4**: Utility-first CSS using CSS variables for high-contrast agricultural green styling (`#16a34a`).
- **shadcn/ui & Radix UI**: Headless, accessible primitives (Dialog, Popover, Dropdown Menu, Select, Tabs, Tooltip, Alert Dialog).
- **Design Tokens**: Standardized corner radius (`rounded-lg`), subtle card shadows (`shadow-sm`), and distinct semantic status colors:
  - 🟢 Success / Normal: `text-green-600`, `bg-green-50`
  - 🟡 Warning: `text-amber-600`, `bg-amber-50`
  - 🔴 Destructive / Expired: `text-red-600`, `bg-red-50`
  - 🔵 Primary Brand: `text-emerald-600`, `bg-emerald-600`

---

## 3. Backend & Application Layer

### 3.1 Server Actions (`actions/`)
All mutations and administrative queries are executed via Next.js **Server Actions** declared with `'use server'`. Every server action follows a 4-step pipeline:

```
[Incoming Request Payload]
           │
           ▼
1. Authentication Verification: (Check Supabase Auth Session Cookie)
           │
           ▼
2. RBAC Permission Check: (Validate user role against required permission, e.g. 'sales.create')
           │
           ▼
3. Input Validation: (Zod schema validation with strict typing)
           │
           ▼
4. Service Layer Execution: (Call domain service inside transaction scope)
           │
           ▼
5. Cache Revalidation: (revalidatePath('/route') to sync RSC data)
           │
           ▼
[Return ActionResult<T> Envelope]
```

#### Standard Result Envelope
```typescript
export type ActionResult<T = any> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

### 3.2 Service Layer Pattern (`services/`)
Business logic is decoupled from HTTP transport and Next.js request contexts by maintaining dedicated service modules:
- `sales.service.ts`: POS checkout, invoice sequence allocation, stock deduction, profit calculation, ledger posting.
- `inventory.service.ts`: Stock inwarding, batch management, inventory adjustments, FEFO expiry tracking.
- `customers.service.ts`: Customer directory, khata credit balance calculation, payment collection.
- `purchases.service.ts`: Supplier purchase inward, batch creation, cost adjustment, supplier ledger debit/credit.
- `suppliers.service.ts`: Supplier profiles and payment reconciliation.
- `payments.service.ts`: Multi-mode payment recording.
- `dashboard.service.ts`: Aggregation queries for sales velocity, profit margins, and inventory health.

### 3.3 Financial & Calculation Engine (`lib/calculations.ts`)
Financial arithmetic is centralized in `lib/calculations.ts` to ensure consistency between client UI previews and server-side persistence:
- **Exclusive GST Calculation**: `Tax = (Taxable Amount × GST Rate) / 100` (split equally into 50% CGST + 50% SGST or 100% IGST).
- **Item Subtotal**: `Subtotal = Quantity × Unit Rate`
- **Item Discount**: `Discount Amount = (Subtotal × Discount %) / 100`
- **Bill Grand Total**: `Grand Total = Σ(Taxable Amount + Tax Amount)`
- **Mathematical Round-off**: `Payable Amount = Math.round(Grand Total)`
- **Gross Profit**: `Gross Profit = Total Revenue - (Cost Price × Quantity)`

---

## 4. Database Architecture & Multi-Tenancy

### 4.1 Multi-Tenant Isolation
KRUSHI OS enforces database-level multi-tenancy using PostgreSQL **Row Level Security (RLS)**. Every tenant is represented by a record in the `shops` table.

```sql
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  SELECT shop_id INTO v_shop_id
  FROM public.users
  WHERE id = auth.uid();
  RETURN v_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

All 24 business tables include a foreign key `shop_id REFERENCES shops(id) ON DELETE CASCADE`. Every query executed by the Supabase client automatically applies:
```sql
CREATE POLICY "Users can view records in their shop" 
ON <table_name> FOR SELECT 
USING (shop_id = get_user_shop_id());
```

Child item tables without a direct `shop_id` (such as `sale_items` and `purchase_items`) inherit multi-tenancy security via subqueries on their parent header tables:
```sql
CREATE POLICY "Users can view sale_items via sale"
ON sale_items FOR ALL
USING (
  sale_id IN (SELECT id FROM sales WHERE shop_id = get_user_shop_id())
);
```

### 4.2 Stored Procedures & Atomic Sequences
- **`generate_invoice_number(p_shop_id UUID)`**: Uses PostgreSQL row-level locking (`FOR UPDATE`) on the `shops` table to increment `invoice_counter` and format zero-padded invoice numbers (e.g. `KOS-000104`), guaranteeing zero race conditions even under concurrent counter checkouts.
- **`get_expiry_status(expiry_date DATE)`**: Returns `EXPIRED`, `URGENT`, `WARNING`, `EXPIRING_SOON`, or `NORMAL`.

---

## 5. Authentication & Authorization (RBAC)

### 5.1 Supabase SSR Authentication
Authentication uses `@supabase/ssr` with HTTP-only, SameSite cookies. The authentication state is maintained seamlessly across client components, Server Actions, API route handlers, and edge middleware.

```
Client Browser                  Next.js Edge Middleware              Supabase Auth
     │                                    │                                 │
     ├── 1. Request Protected Route ────>│                                 │
     │                                    ├── 2. Extract Auth Cookie ──────>│
     │                                    │                                 ├── 3. Validate JWT
     │                                    │<── 4. Return Session ───────────┤
     │<── 5. Rewrite / Render Page ───────┤
```

### 5.2 Role-Based Access Control Matrix

The system includes 4 distinct roles and 27 granular permissions:

| Permission Area | Permission Key | Admin | Manager | Cashier | Sales Staff |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Products** | `products.view` | ✅ | ✅ | ✅ | ✅ |
| | `products.create` | ✅ | ✅ | ❌ | ❌ |
| | `products.edit` | ✅ | ✅ | ❌ | ❌ |
| | `products.delete` | ✅ | ✅ | ❌ | ❌ |
| **Sales** | `sales.view` | ✅ | ✅ | ✅ | ✅ |
| | `sales.create` | ✅ | ✅ | ✅ | ❌ |
| | `sales.cancel` | ✅ | ✅ | ❌ | ❌ |
| | `sales.return` | ✅ | ✅ | ❌ | ❌ |
| **Inventory** | `inventory.view` | ✅ | ✅ | ✅ | ❌ |
| | `inventory.adjust` | ✅ | ✅ | ❌ | ❌ |
| **Purchases** | `purchases.view` | ✅ | ✅ | ❌ | ❌ |
| | `purchases.create` | ✅ | ✅ | ❌ | ❌ |
| **Customers** | `customers.view` | ✅ | ✅ | ✅ | ✅ |
| | `customers.create` | ✅ | ✅ | ✅ | ✅ |
| | `customers.edit` | ✅ | ✅ | ❌ | ❌ |
| **Suppliers** | `suppliers.view` | ✅ | ✅ | ❌ | ❌ |
| | `suppliers.create` | ✅ | ✅ | ❌ | ❌ |
| **Expenses** | `expenses.view` | ✅ | ✅ | ❌ | ❌ |
| | `expenses.create` | ✅ | ✅ | ❌ | ❌ |
| **Reports** | `reports.view` | ✅ | ✅ | ❌ | ❌ |
| | `reports.export` | ✅ | ✅ | ❌ | ❌ |
| **Employees** | `employees.view` | ✅ | ✅ | ❌ | ❌ |
| | `employees.manage` | ✅ | ❌ | ❌ | ❌ |
| **Settings** | `settings.view` | ✅ | ✅ | ❌ | ❌ |
| | `settings.edit` | ✅ | ❌ | ❌ | ❌ |
| **Audit Logs** | `audit.view` | ✅ | ❌ | ❌ | ❌ |

---

## 6. End-to-End Data Flow Diagrams

### 6.1 Point of Sale (POS) Checkout Flow

```
[Cashier Terminal]
        │
        ├── 1. Scans Barcode / Inputs SKU
        ├── 2. Selects Batch (FEFO recommendation)
        ├── 3. Inputs Customer (Optional: Farmer Khata link)
        ├── 4. Selects Payment Split (e.g. ₹1,000 Cash + ₹500 Khata Credit)
        ├── 5. Submits Sale (F8 Shortcut)
        │
        ▼
[Next.js Server Action: completeSaleAction()]
        │
        ├── 6. Validates Session & 'sales.create' Permission
        ├── 7. Validates saleSchema with Zod (Item array, positive quantities, valid batch UUIDs)
        │
        ▼
[Domain Service: salesService.completeSale()]
        │
        ├── 8. Checks Batch Availability & Expiry Status in DB
        ├── 9. Locks shop row & generates Invoice Number: generate_invoice_number()
        ├── 10. Inserts Header into `sales` table
        ├── 11. Inserts line items into `sale_items` table
        ├── 12. Decrements `quantity_available` in `product_batches`
        ├── 13. Decrements `current_stock` in `products`
        ├── 14. Logs entry in `stock_transactions` ('SALE_OUT')
        ├── 15. If Khata Credit > 0:
        │       ├── Updates `customers.outstanding` (+credit amount)
        │       └── Inserts debit row in `customer_ledger`
        ├── 16. Inserts payment records into `payments` table
        └── 17. Inserts record into `audit_logs`
        │
        ▼
[Client Response & Auto-Print]
        │
        ├── 18. Receives { success: true, data: saleRecord }
        ├── 19. Pops Print Dialog (A4 PDF or Thermal ESC/POS Slip)
        └── 20. Resets POS Cart for Next Transaction (< 300ms total latency)
```

### 6.2 Purchase Inward & Batch Registration Flow

```
[Supplier Invoice]
        │
        ▼
[Manager enters purchase form (Supplier, Invoice #, Items, Batches, Expiries, Buy Price)]
        │
        ▼
[Next.js Server Action: completePurchaseAction()]
        │
        ├── Validates 'purchases.create' permission
        ├── Validates purchaseSchema with Zod
        │
        ▼
[Domain Service: purchasesService.completePurchase()]
        │
        ├── 1. Inserts record into `purchases` table
        ├── 2. For each line item:
        │       ├── Inserts or updates `product_batches` (stores batch_number, expiry_date, quantity)
        │       ├── Updates `products.purchase_price` and increments `products.current_stock`
        │       ├── Inserts row into `purchase_items`
        │       └── Logs `stock_transactions` ('PURCHASE_IN')
        ├── 3. If credit purchase:
        │       ├── Updates `suppliers.outstanding` balance
        │       └── Inserts credit record into `supplier_ledger`
        └── 4. Revalidates paths: `/purchases`, `/inventory`, `/products`
```

---

## 7. Key Architectural Decisions & Tradeoffs

| Decision | Rationale | Tradeoff |
| :--- | :--- | :--- |
| **Next.js Server Actions over separate REST/Express API** | Eliminates boilerplate API endpoints, provides automatic type safety from DB to UI, handles form states seamlessly, and simplifies deployment to single Vercel bundle. | Tight coupling to Next.js framework; mobile apps would require separate API route handlers or Direct Supabase Client access. |
| **Row Level Security (RLS) Multi-Tenancy** | Guaranteed database-level tenant isolation. Even if application code has a bug or omitted where clause, tenant data cannot leak across shops. | Slightly higher database CPU overhead during complex joins compared to separate schemas. Mitigated with composite indexes on `shop_id`. |
| **FEFO (First-Expiry-First-Out) Batch Accounting** | Vital in the agricultural retail sector where insecticides, fungicides, and bio-fertilizers have rigid shelf lives (12–36 months). Selling expired inventory carries severe regulatory penalties in India. | Requires cashiers or managers to specify batch numbers during billing rather than treating SKUs as fungible counters. |
| **Idempotency Keys on POS Checkout** | Indian rural areas frequently experience fluctuating 4G connectivity. POS bills submit a unique UUID idempotency key to prevent accidental duplicate charges or double stock deductions on network retry. | Small storage overhead in `sales` table (`idempotency_key VARCHAR UNIQUE`). |
| **Client & Server Hybrid PDF Generation** | Rapid POS thermal print preview renders instantly on the client via browser canvas/DOM, while formal A4 downloadable tax invoices can be produced on-demand via the server endpoint (`/api/print/invoice/[id]`). | Maintaining two layout templates (A4 GST format and 80mm/58mm thermal slip). |

---

## 8. Directory Map

```
├── actions/                  # Next.js Server Actions (Mutation & Query endpoints)
├── app/                      # Next.js 16 App Router (Pages, Layouts, API Routes)
├── components/               # React UI Components (shadcn/ui, domain components)
├── hooks/                    # Reusable client hooks (debouncing, hardware listeners)
├── lib/                      # Pure helper libraries (calculations, validations, permissions)
├── services/                 # Business logic & Supabase database integration
├── supabase/                 # Schema migrations, RLS policies, functions, seed data
└── types/                    # Domain TypeScript type definitions
```
