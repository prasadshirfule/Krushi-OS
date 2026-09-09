export type ID = string;
export type DateString = string;

export interface BaseEntity {
  id: ID;
  created_at: DateString;
  updated_at: DateString;
}

export interface Shop extends BaseEntity {
  name: string;
  address?: string;
  phone?: string;
  gst_number?: string;
  email?: string;
  logo_url?: string;
}

export interface User extends BaseEntity {
  email: string;
  shop_id: ID;
  is_active: boolean;
}

export interface Role extends BaseEntity {
  name: string;
  description?: string;
}

export interface Employee extends BaseEntity {
  user_id: ID;
  shop_id: ID;
  role_id: ID;
  first_name: string;
  last_name: string;
  phone?: string;
  salary?: number;
}

export interface Category extends BaseEntity {
  name: string;
  description?: string;
  shop_id: ID;
}

export interface Brand extends BaseEntity {
  name: string;
  description?: string;
  shop_id: ID;
}

export interface Product extends BaseEntity {
  name: string;
  category_id: ID;
  brand_id?: ID | null;
  shop_id: ID;
  hsn_code?: string | null;
  unit: string;
  pack_size?: string | null;
  product_size_value?: number | null;
  product_size_unit?: string | null;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  purchase_price?: number;
  selling_price?: number;
  wholesale_price?: number;
  gst_rate: number;
  min_stock?: number;
  max_stock?: number;
  current_stock?: number;
  stock_quantity?: number;
  min_stock_alert?: number;
  is_active: boolean;
}

export interface ProductBatch extends BaseEntity {
  product_id: ID;
  shop_id: ID;
  batch_number: string;
  mfg_date?: DateString;
  exp_date?: DateString;
  expiry_date?: DateString;
  purchase_price: number;
  mrp?: number;
  selling_price: number;
  stock_quantity?: number;
  quantity_available?: number;
  quantity_received?: number;
  supplier_id?: ID;
}

export const StockTransactionType = {
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  RETURN_IN: 'RETURN_IN',
  ADJUSTMENT: 'ADJUSTMENT',
  DAMAGED: 'DAMAGED',
  EXPIRED: 'EXPIRED',
} as const;

export type StockTransactionTypeEnum = typeof StockTransactionType[keyof typeof StockTransactionType];

export interface Inventory extends BaseEntity {
  product_id: ID;
  shop_id: ID;
  total_stock: number;
}

export interface StockTransaction extends BaseEntity {
  product_id: ID;
  batch_id?: ID;
  shop_id: ID;
  transaction_type: StockTransactionTypeEnum;
  quantity: number;
  reference_id?: ID; // Sale ID, Purchase ID, etc.
  notes?: string;
  user_id: ID;
}

export interface Customer extends BaseEntity {
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address?: string;
  village?: string;
  gst_number?: string;
  shop_id: ID;
  customer_account_id?: ID | null;
}

export const LedgerTransactionType = {
  SALE: 'SALE',
  PAYMENT: 'PAYMENT',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type LedgerTransactionTypeEnum = typeof LedgerTransactionType[keyof typeof LedgerTransactionType];

export interface CustomerLedger extends BaseEntity {
  customer_id: ID;
  shop_id: ID;
  transaction_type: LedgerTransactionTypeEnum;
  amount: number;
  reference_id?: ID;
  notes?: string;
}

export interface Supplier extends BaseEntity {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gst_number?: string;
  shop_id: ID;
}

export interface SupplierLedger extends BaseEntity {
  supplier_id: ID;
  shop_id: ID;
  transaction_type: LedgerTransactionTypeEnum;
  amount: number;
  reference_id?: ID;
  notes?: string;
}

export interface Purchase extends BaseEntity {
  supplier_id: ID;
  shop_id: ID;
  invoice_number?: string;
  purchase_date: DateString;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  notes?: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface PurchaseItem extends BaseEntity {
  purchase_id: ID;
  product_id: ID;
  batch_id?: ID;
  quantity: number;
  purchase_price: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

/** Database sale lifecycle statuses (lowercase) plus legacy display variants. */
export type SaleStatus =
  | 'completed'
  | 'partially_returned'
  | 'returned'
  | 'cancelled'
  | 'COMPLETED'
  | 'PARTIALLY RETURNED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PENDING';

export interface Sale extends BaseEntity {
  customer_id?: ID;
  shop_id: ID;
  invoice_number: string;
  sale_date: DateString;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  round_off: number;
  grand_total: number;
  status: SaleStatus;
  payment_status?: string;
  user_id: ID;
}

export interface SaleItem extends BaseEntity {
  sale_id: ID;
  product_id: ID;
  batch_id?: ID;
  quantity: number;
  /** Cumulative quantity already returned for this line (DB column). */
  returned_quantity?: number;
  selling_price: number;
  mrp: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

export type SaleReturnRefundMode =
  | 'CREDIT_ADJUSTMENT'
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CARD';

export interface SaleReturn extends BaseEntity {
  shop_id: ID;
  sale_id: ID;
  return_number: string;
  customer_id?: ID;
  return_date?: DateString;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  refund_mode: SaleReturnRefundMode;
  reason?: string;
  notes?: string;
  created_by?: ID;
}

export interface SaleReturnItem extends BaseEntity {
  shop_id: ID;
  sale_return_id: ID;
  sale_item_id: ID;
  product_id: ID;
  batch_id?: ID;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  discount_amount?: number;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  tax_amount?: number;
  total_amount: number;
  reason?: string;
}

export const PaymentMethod = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CREDIT: 'CREDIT',
} as const;

export type PaymentMethodEnum = typeof PaymentMethod[keyof typeof PaymentMethod];

export interface Payment extends BaseEntity {
  reference_type: 'SALE' | 'PURCHASE' | 'CUSTOMER_LEDGER' | 'SUPPLIER_LEDGER';
  reference_id: ID;
  shop_id: ID;
  amount: number;
  payment_method: PaymentMethodEnum;
  transaction_reference?: string; // e.g. UPI ID
  payment_date: DateString;
}

export interface ExpenseCategory extends BaseEntity {
  name: string;
  shop_id: ID;
}

export interface Expense extends BaseEntity {
  category_id: ID;
  shop_id: ID;
  amount: number;
  expense_date: DateString;
  payment_method: PaymentMethodEnum;
  description?: string;
  user_id: ID;
}

export const NotificationType = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;

export type NotificationTypeEnum = typeof NotificationType[keyof typeof NotificationType];

export interface Notification extends BaseEntity {
  shop_id: ID;
  type: NotificationTypeEnum;
  title: string;
  message: string;
  is_read: boolean;
  user_id?: ID; // if targetting specific user
}

export interface Settings extends BaseEntity {
  shop_id: ID;
  key: string;
  value: string; // JSON string depending on the setting
}

export interface AuditLog extends BaseEntity {
  shop_id: ID;
  user_id: ID;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: string;
  new_data?: string;
  ip_address?: string;
}

export interface CustomerAccount extends BaseEntity {
  auth_user_id: ID;
  mobile: string;
  name: string;
  email?: string | null;
  village?: string | null;
}

export const CustomerNotificationType = {
  NEW_BILL: 'NEW_BILL',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  OUTSTANDING_REMINDER: 'OUTSTANDING_REMINDER',
  SALE_RETURN: 'SALE_RETURN',
  INFO: 'INFO',
} as const;

export type CustomerNotificationTypeEnum = typeof CustomerNotificationType[keyof typeof CustomerNotificationType];

export interface CustomerNotification extends BaseEntity {
  customer_account_id: ID;
  shop_id: ID;
  sale_id?: ID | null;
  type: CustomerNotificationTypeEnum;
  title: string;
  message: string;
  is_read: boolean;
}

