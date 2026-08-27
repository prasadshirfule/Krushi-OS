# 🔌 KRUSHI OS — API & Server Actions Reference

This document provides a comprehensive technical specification for all Next.js Server Actions and REST API Route Handlers in **KRUSHI OS**.

---

## 1. Overview & Conventions

KRUSHI OS uses **Next.js Server Actions** (`'use server'`) as its primary RPC backend. Every server action enforces:
1. **User Authentication**: Validates session via `@supabase/ssr` cookies.
2. **Permission Guard**: Validates that the user's role has the required permission string.
3. **Data Validation**: Parses and sanitizes input payloads using **Zod** schemas.
4. **Standard Envelope**: Returns a strongly typed `ActionResult<T>` response.

```typescript
export type ActionResult<T = any> = 
  | { success: true; data: T }
  | { success: false; error: string };
```

---

## 2. Server Actions Reference

### 2.1 Sales & POS Actions (`actions/sales.ts`)

#### `completeSaleAction(data: any): Promise<ActionResult<SaleRecord>>`
Processes a POS sale transaction, decrements stock across selected batches, generates an invoice number, records multi-split payments, and updates the customer credit ledger.
- **Permission Required**: `sales.create`
- **Validation Schema**: `saleSchema`
- **Payload**:
  ```typescript
  {
    customer_id?: string | null,
    items: Array<{
      product_id: string,
      batch_id: string,
      quantity: number,
      unit_price: number,
      discount_percent: number,
      gst_rate: number
    }>,
    payments: Array<{
      method: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT',
      amount: number
    }>,
    notes?: string | null,
    idempotency_key: string
  }
  ```
- **Revalidated Paths**: `/sales`, `/inventory`

#### `getSalesAction(params: any): Promise<ActionResult<PaginatedSales>>`
Retrieves a paginated list of sales with optional date range, search query, or status filters.
- **Permission Required**: `sales.view`

#### `getSaleAction(id: string): Promise<ActionResult<SaleWithItems>>`
Fetches a single sale by UUID, including all line items, customer details, and payment splits.
- **Permission Required**: `sales.view`

#### `cancelSaleAction(id: string, reason: string): Promise<ActionResult<any>>`
Cancels an existing completed sale, restores inventory to batches, and cancels ledger entries.
- **Permission Required**: `sales.cancel`
- **Revalidated Paths**: `/sales`, `/sales/[id]`, `/inventory`

#### `returnSaleAction(id: string, items: Array<{ saleItemId: string, quantity: number, reason: string }>): Promise<ActionResult<any>>`
Processes a partial or full sales return / credit note, restoring returned quantities to inventory.
- **Permission Required**: `sales.return`
- **Revalidated Paths**: `/sales`, `/sales/[id]`, `/inventory`

#### `getTodaySalesAction(): Promise<ActionResult<SalesSummary>>`
Retrieves today's aggregated sales revenue, transaction count, and payment breakdown.
- **Permission Required**: `sales.view`

---

### 2.2 Product Catalog Actions (`actions/products.ts`)

#### `getProductsAction(params: any): Promise<ActionResult<PaginatedProducts>>`
Fetches product catalog with search, category filtering, brand filtering, and pagination.
- **Permission Required**: `products.view`

#### `getProductAction(id: string): Promise<ActionResult<ProductDetail>>`
Retrieves complete product metadata, brand info, active batches, and current stock level.
- **Permission Required**: `products.view`

#### `createProductAction(formData: ProductFormData): Promise<ActionResult<Product>>`
Creates a new SKU in the product catalog.
- **Permission Required**: `products.create`
- **Validation Schema**: `productSchema`
- **Payload**:
  ```typescript
  {
    name: string,
    category_id: string,
    brand_id?: string | null,
    description?: string | null,
    sku?: string | null,
    barcode?: string | null,
    purchase_price: number,
    selling_price: number,
    wholesale_price?: number | null,
    gst_rate: number,
    hsn_code?: string | null,
    unit: 'Piece' | 'Bottle' | 'Bag' | 'Box' | 'Packet' | 'Kg' | 'Gram' | 'Litre' | 'Millilitre',
    min_stock: number,
    max_stock: number
  }
  ```
- **Revalidated Paths**: `/products`

#### `updateProductAction(id: string, formData: Partial<ProductFormData>): Promise<ActionResult<Product>>`
Updates SKU attributes, pricing, or stock thresholds.
- **Permission Required**: `products.edit`
- **Revalidated Paths**: `/products`, `/products/[id]`

#### `deleteProductAction(id: string): Promise<ActionResult<any>>`
Soft-deletes or deactivates a product.
- **Permission Required**: `products.delete`
- **Revalidated Paths**: `/products`

#### `searchProductsAction(query: string): Promise<ActionResult<ProductSearchItem[]>>`
Autocomplete product search by title, barcode, or SKU for POS terminal.
- **Permission Required**: `products.view`

#### `getProductByBarcodeAction(barcode: string): Promise<ActionResult<Product>>`
Instant barcode lookup for hardware scanner integration.
- **Permission Required**: `products.view`

#### `getCategoriesAction(): Promise<ActionResult<Category[]>>`
Fetches all product categories for the current shop.
- **Permission Required**: `products.view`

#### `createCategoryAction(data: { name: string, description?: string }): Promise<ActionResult<Category>>`
Creates a new category.
- **Permission Required**: `products.create`
- **Revalidated Paths**: `/products/categories`, `/categories`

#### `updateCategoryAction(id: string, data: { name: string, description?: string }): Promise<ActionResult<Category>>`
Updates an existing category name or description.
- **Permission Required**: `products.edit`

#### `getBrandsAction(): Promise<ActionResult<Brand[]>>`
Fetches all brands / manufacturers registered under the shop.
- **Permission Required**: `products.view`

#### `createBrandAction(data: { name: string, manufacturer?: string }): Promise<ActionResult<Brand>>`
Creates a new brand.
- **Permission Required**: `products.create`

---

### 2.3 Inventory & Batch Actions (`actions/inventory.ts`)

#### `getInventoryAction(params: { search?: string, category?: string, expiryStatus?: string, page?: number, limit?: number }): Promise<ActionResult<PaginatedInventory>>`
Returns real-time inventory matrix with batch-level breakdown and expiry status flags.
- **Permission Required**: `inventory.view`

#### `getBatchesAction(productId: string): Promise<ActionResult<ProductBatch[]>>`
Returns all active physical batches for a specific product SKU.
- **Permission Required**: `inventory.view`

#### `createBatchAction(data: BatchFormData): Promise<ActionResult<ProductBatch>>`
Manually adds a new batch to a product.
- **Permission Required**: `inventory.adjust`
- **Validation Schema**: `batchSchema`
- **Revalidated Paths**: `/inventory/products/[productId]`

#### `adjustStockAction(data: StockAdjustmentFormData): Promise<ActionResult<any>>`
Adjusts inventory count with audit reason (Damage, Breakage, Expiry write-off, Manual count).
- **Permission Required**: `inventory.adjust`
- **Validation Schema**: `stockAdjustmentSchema`
- **Payload**:
  ```typescript
  {
    product_id: string,
    batch_id?: string | null,
    adjustment_type: 'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED',
    quantity_change: number, // positive or negative
    reason: string
  }
  ```
- **Revalidated Paths**: `/inventory`, `/inventory/products/[productId]`

#### `getStockTransactionsAction(params: { productId?: string, type?: string, page?: number, limit?: number }): Promise<ActionResult<StockTransaction[]>>`
Retrieves physical stock audit log trail.
- **Permission Required**: `inventory.view`

#### `getExpiringProductsAction(daysThreshold?: number): Promise<ActionResult<BatchAlert[]>>`
Fetches batches nearing expiry within the threshold (default: 30 days).
- **Permission Required**: `inventory.view`

#### `getExpiredProductsAction(): Promise<ActionResult<BatchAlert[]>>`
Fetches batches that have exceeded their expiry date.
- **Permission Required**: `inventory.view`

---

### 2.4 Customer & Khata Actions (`actions/customers.ts`)

#### `getCustomersAction(params: any): Promise<ActionResult<PaginatedCustomers>>`
Returns farmer directory with outstanding credit balances.
- **Permission Required**: `customers.view`

#### `getCustomerAction(id: string): Promise<ActionResult<CustomerDetail>>`
Returns complete customer profile and lifetime statistics.
- **Permission Required**: `customers.view`

#### `createCustomerAction(data: any): Promise<ActionResult<Customer>>`
Registers a new farmer customer.
- **Permission Required**: `customers.create`
- **Validation Schema**: `customerSchema`
- **Payload**:
  ```typescript
  {
    name: string,
    mobile?: string | null,
    village?: string | null,
    address?: string | null,
    farm_size?: string | null,
    crops?: string | null,
    notes?: string | null
  }
  ```
- **Revalidated Paths**: `/customers`

#### `updateCustomerAction(id: string, data: any): Promise<ActionResult<Customer>>`
Updates customer details or farm metadata.
- **Permission Required**: `customers.edit`
- **Revalidated Paths**: `/customers`, `/customers/[id]`

#### `searchCustomersAction(query: string): Promise<ActionResult<Customer[]>>`
Autocomplete customer lookup by name, mobile, or village for POS billing.
- **Permission Required**: `customers.view`

#### `getCustomerLedgerAction(customerId: string, params: any): Promise<ActionResult<LedgerEntry[]>>`
Fetches debit/credit journal entries for a farmer's khata book.
- **Permission Required**: `customers.view`

#### `collectPaymentAction(data: { customerId: string, amount: number, paymentMethod: string, notes?: string }): Promise<ActionResult<PaymentReceipt>>`
Records a repayment against a farmer's outstanding balance and updates ledger.
- **Permission Required**: `customers.edit`
- **Validation Schema**: `paymentCollectionSchema`
- **Revalidated Paths**: `/customers`, `/customers/[customerId]`

---

### 2.5 Supplier & Purchase Actions (`actions/suppliers.ts` & `actions/purchases.ts`)

#### `getPurchasesAction(params: any): Promise<ActionResult<PaginatedPurchases>>`
Fetches list of inward purchase invoices.
- **Permission Required**: `purchases.view`

#### `getPurchaseAction(id: string): Promise<ActionResult<PurchaseDetail>>`
Fetches inward purchase invoice with line items, received batches, and tax breakdown.
- **Permission Required**: `purchases.view`

#### `completePurchaseAction(data: any): Promise<ActionResult<Purchase>>`
Records an inward supplier invoice, creates/updates batches, increases stock, and updates supplier ledger.
- **Permission Required**: `purchases.create`
- **Validation Schema**: `purchaseSchema`
- **Revalidated Paths**: `/purchases`, `/inventory`

#### `getSuppliersAction(params: any): Promise<ActionResult<PaginatedSuppliers>>`
Returns supplier vendor list and outstanding payables.
- **Permission Required**: `suppliers.view`

#### `createSupplierAction(data: any): Promise<ActionResult<Supplier>>`
Creates a supplier profile.
- **Permission Required**: `suppliers.create`
- **Validation Schema**: `supplierSchema`

#### `makeSupplierPaymentAction(data: { supplierId: string, amount: number, paymentMethod: string, notes?: string }): Promise<ActionResult<any>>`
Records a payout to a supplier and credits their ledger.
- **Permission Required**: `suppliers.edit`
- **Validation Schema**: `supplierPaymentSchema`
- **Revalidated Paths**: `/suppliers`, `/suppliers/[supplierId]`

---

### 2.6 Expense Actions (`actions/expenses.ts`)

#### `getExpensesAction(params: any): Promise<ActionResult<PaginatedExpenses>>`
Retrieves filtered operating expenses.
- **Permission Required**: `expenses.view`

#### `createExpenseAction(data: any): Promise<ActionResult<Expense>>`
Logs a new shop operating expense.
- **Permission Required**: `expenses.create`
- **Validation Schema**: `expenseSchema`
- **Revalidated Paths**: `/expenses`

#### `deleteExpenseAction(id: string): Promise<ActionResult<any>>`
Deletes an expense entry.
- **Permission Required**: `expenses.delete`
- **Revalidated Paths**: `/expenses`

#### `getExpenseCategoriesAction(): Promise<ActionResult<ExpenseCategory[]>>`
Returns available expense classifications (Rent, Electricity, Salary, etc.).
- **Permission Required**: `expenses.view`

---

### 2.7 Employee & Staff Actions (`actions/employees.ts`)

#### `getEmployeesAction(params: any): Promise<ActionResult<Employee[]>>`
Lists all shop staff members and their assigned roles.
- **Permission Required**: `employees.view`

#### `createEmployeeAction(data: any): Promise<ActionResult<Employee>>`
Creates a new staff member profile.
- **Permission Required**: `employees.create`
- **Validation Schema**: `employeeSchema`
- **Revalidated Paths**: `/employees`

#### `toggleEmployeeStatusAction(id: string): Promise<ActionResult<any>>`
Activates or deactivates an employee account.
- **Permission Required**: `employees.edit`
- **Revalidated Paths**: `/employees`

#### `getRolesAction(): Promise<ActionResult<Role[]>>`
Fetches available system roles (Admin, Manager, Cashier, Sales Staff).
- **Permission Required**: `employees.view`

---

### 2.8 Reports & Analytics Actions (`actions/reports.ts`)

#### `getSalesReportAction(params: { period: string, dateFrom?: string, dateTo?: string, groupBy?: string }): Promise<ActionResult<SalesReportData>>`
Returns aggregated sales volume, revenue, profit, and tax collection.
- **Permission Required**: `reports.view`

#### `getInventoryReportAction(params: { type: 'current' | 'low' | 'expired' | 'expiring' }): Promise<ActionResult<InventoryReportData>>`
Returns total inventory valuation, fast-moving items, and at-risk stock.
- **Permission Required**: `reports.view`

#### `getFinancialReportAction(params: { dateFrom?: string, dateTo?: string }): Promise<ActionResult<FinancialReportData>>`
Generates profit & loss statement summary (Gross Sales, Cost of Goods Sold, Gross Margin, Operating Expenses, Net Profit).
- **Permission Required**: `reports.view`

#### `exportReportAction(params: { type: string, format: 'csv' | 'excel' | 'pdf', [key: string]: any }): Promise<ActionResult<{ url?: string, data?: any }>>`
Triggers formatted data export for offline filing.
- **Permission Required**: `reports.export`

---

### 2.9 Settings & Notifications Actions (`actions/settings.ts` & `actions/notifications.ts`)

#### `getSettingsAction(): Promise<ActionResult<ShopSettings>>`
Retrieves shop configuration, GSTIN, and printer preferences.
- **Permission Required**: `settings.view`

#### `updateSettingsAction(data: any): Promise<ActionResult<ShopSettings>>`
Updates shop profile, invoice prefix, terms & conditions, and default GST rates.
- **Permission Required**: `settings.edit`
- **Validation Schema**: `settingsSchema`
- **Revalidated Paths**: `/settings`

#### `uploadLogoAction(formData: FormData): Promise<ActionResult<string>>`
Uploads shop logo to Supabase Storage and returns public URL.
- **Permission Required**: `settings.edit`

#### `getNotificationsAction(params: { unreadOnly?: boolean, page?: number, limit?: number }): Promise<ActionResult<Notification[]>>`
Fetches system alerts and expiry notifications.
- **Permission Required**: Authenticated User

#### `markNotificationReadAction(id: string): Promise<ActionResult<any>>`
Marks an alert as read.
- **Permission Required**: Authenticated User

#### `getUnreadCountAction(): Promise<ActionResult<number>>`
Returns count of unread notifications for badge counter.
- **Permission Required**: Authenticated User

---

## 3. REST API Route Handlers Reference

### `GET /api/print/invoice/[id]`
Generates formatted printable invoices or downloadable binary PDF documents for POS transactions.

- **URL Parameters**:
  - `id` (UUID, required): The unique identifier of the sale record.
- **Query Parameters**:
  - `format` (`json` | `pdf`, optional, default: `json`):
    - `format=json`: Returns the sale object with items and shop metadata.
    - `format=pdf`: Returns a binary PDF stream with `Content-Disposition: attachment; filename="Invoice-KOS-000102.pdf"`.
- **Headers Required**:
  - Cookie session containing authenticated user token.
- **Responses**:
  - `200 OK`: Binary PDF stream or JSON document.
  - `401 Unauthorized`: Session cookie missing or invalid.
  - `404 Not Found`: Sale ID does not exist in the caller's shop.
  - `500 Internal Server Error`: PDF compilation failure.
