import { z } from 'zod';

const phoneRegex = /^[6-9]\d{9}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
  shopName: z.string().min(2),
  phone: z.string().regex(phoneRegex, 'Invalid Indian mobile number format').optional().or(z.literal('')),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
});

export const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  manufacturer: z.string().optional().nullable(),
});

export const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  category_id: z.string().min(1, 'Category is required'),
  brand_id: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  purchase_price: z.coerce.number().min(0, 'Purchase price cannot be negative'),
  selling_price: z.coerce.number().min(0, 'Selling price cannot be negative'),
  wholesale_price: z.coerce.number().min(0).optional().nullable(),
  gst_rate: z.coerce.number().min(0).max(100),
  hsn_code: z.string().optional().nullable(),
  unit: z.string().min(1, 'Unit is required'),
  min_stock: z.coerce.number().int().min(0),
  max_stock: z.coerce.number().int().min(0).optional().nullable(),
  opening_stock: z.coerce.number().int().min(0).optional().nullable(),
  batch_tracking: z.boolean().optional().default(false),
  expiry_tracking: z.boolean().optional().default(false),
  batch_number: z.string().optional().nullable(),
  mfd_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  product_type: z.string().optional().nullable(),
  active_ingredient: z.string().optional().nullable(),
  formulation: z.string().optional().nullable(),
  crop: z.string().optional().nullable(),
  target_pest: z.string().optional().nullable(),
  pack_size: z.string().optional().nullable(),
  licence_number: z.string().optional().nullable(),
});

export const batchSchema = z.object({
  product_id: z.string().uuid(),
  batch_number: z.string().min(1),
  manufacturing_date: z.date().optional().nullable(),
  expiry_date: z.date(),
  purchase_price: z.number().min(0),
  selling_price: z.number().min(0),
  quantity_received: z.number().int().min(1),
  supplier_id: z.string().uuid().optional().nullable(),
});

export const customerSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().regex(phoneRegex, 'Invalid Indian mobile number format').optional().nullable(),
  village: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  farm_size: z.string().optional().nullable(),
  crops: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const supplierSchema = z.object({
  name: z.string().min(2),
  company: z.string().optional().nullable(),
  mobile: z.string().regex(phoneRegex, 'Invalid Indian mobile number format').optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  gst_number: z.string().regex(gstRegex, 'Invalid GSTIN format').optional().nullable(),
});

export const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  batch_number: z.string(),
  manufacturing_date: z.date().optional().nullable(),
  expiry_date: z.date(),
  quantity: z.number().int().min(1),
  purchase_price: z.number().min(0),
  gst_rate: z.number().min(0),
});

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid(),
  invoice_number: z.string().optional().nullable(),
  purchase_date: z.date(),
  items: z.array(purchaseItemSchema).min(1),
  notes: z.string().optional().nullable(),
});

export const paymentSplitSchema = z.object({
  method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT']),
  amount: z.number().min(0.01),
});

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  batch_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100),
  gst_rate: z.number().min(0),
});

export const saleSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(paymentSplitSchema).min(1),
  notes: z.string().optional().nullable(),
  idempotency_key: z.string(),
});

export const expenseSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  date: z.date(),
  amount: z.number().min(0.01),
  description: z.string().min(2),
  payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER']),
  receipt_url: z.string().url().optional().nullable(),
});

export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid(),
  batch_id: z.string().uuid().optional().nullable(),
  adjustment_type: z.enum(['ADJUSTMENT', 'DAMAGED', 'EXPIRED']),
  quantity_change: z.number().int().refine(val => val !== 0, { message: 'Cannot be zero' }),
  reason: z.string().min(2),
});

export const settingsSchema = z.object({
  shop_name: z.string().min(2),
  shop_address: z.string().min(2),
  shop_phone: z.string(),
  shop_email: z.string().email().optional().nullable(),
  shop_gst: z.string().regex(gstRegex, 'Invalid GSTIN format').optional().nullable(),
  shop_license: z.string().optional().nullable(),
  invoice_prefix: z.string().min(2).max(5),
  invoice_terms: z.string().optional().nullable(),
  invoice_footer: z.string().optional().nullable(),
  default_gst_rate: z.number().min(0).max(100),
});

export const employeeSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().regex(phoneRegex, 'Invalid Indian mobile number format').optional().nullable(),
  role_id: z.string().uuid(),
  is_active: z.boolean(),
});

export const paymentCollectionSchema = z.object({
  customer_id: z.string().uuid(),
  amount: z.number().min(0.01),
  payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER']),
  notes: z.string().optional().nullable(),
});

export const supplierPaymentSchema = z.object({
  supplier_id: z.string().uuid(),
  amount: z.number().min(0.01),
  payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER']),
  notes: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type PaymentSplitInput = z.infer<typeof paymentSplitSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type PaymentCollectionInput = z.infer<typeof paymentCollectionSchema>;
export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BrandInput = z.infer<typeof brandSchema>;

// Aliases for compatibility
export type ProductFormData = ProductInput;
export type BatchFormData = BatchInput;
export type CategoryFormData = CategoryInput;
export type BrandFormData = BrandInput;
export type StockAdjustmentFormData = StockAdjustmentInput;
