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

/**
 * Strict calendar date validation for DD/MM/YYYY.
 * Validates real calendar dates (handles leap years, exact days per month, rejects 31/02/2027, 99/99/9999, etc.)
 */
export function isValidDDMMYYYY(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const d = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  if (m < 1 || m > 12 || y < 1900 || y > 2100) return false;
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d >= 1 && d <= daysInMonth[m - 1];
}

/**
 * Validates date in DD/MM/YYYY or YYYY-MM-DD.
 */
export function validateExpiryDate(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (m < 1 || m > 12 || y < 1900 || y > 2100) return false;
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d >= 1 && d <= daysInMonth[m - 1];
  }
  return isValidDDMMYYYY(trimmed);
}

/**
 * Converts DD/MM/YYYY -> YYYY-MM-DD for database storage.
 */
export function formatDDMMYYYYtoDB(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return trimmed;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

/**
 * Converts YYYY-MM-DD or ISO string -> DD/MM/YYYY for UI display.
 */
export function formatToDDMMYYYY(val: string | Date | null | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) return trimmed;
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d}/${m}/${y}`;
    }
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Parses numeric size, size unit, and packaging from pack_size and/or unit strings.
 */
export function parseProductSize(packSize?: string | null, unitStr?: string | null): {
  sizeValue: number | null;
  sizeUnit: string;
  packaging: string;
} {
  let sizeValue: number | null = null;
  let sizeUnit = 'KG';
  let packaging = 'Bag';

  const combined = `${packSize || ''} ${unitStr || ''}`.trim();
  if (!combined) {
    return { sizeValue: null, sizeUnit: 'KG', packaging: 'Bag' };
  }

  // Detect physical packaging
  if (/bottle/i.test(combined)) packaging = 'Bottle';
  else if (/packet|pkt/i.test(combined)) packaging = 'Packet';
  else if (/bag/i.test(combined)) packaging = 'Bag';
  else if (/box/i.test(combined)) packaging = 'Box';
  else if (/container/i.test(combined)) packaging = 'Container';
  else if (/can/i.test(combined)) packaging = 'Can';
  else if (/drum/i.test(combined)) packaging = 'Drum';
  else if (/piece|pc/i.test(combined)) packaging = 'Piece';
  else if (unitStr && ['Bag', 'Bottle', 'Packet', 'Box', 'Container', 'Piece', 'Can', 'Drum'].includes(unitStr)) {
    packaging = unitStr;
  }

  // Detect size value and unit (e.g. 45 KG, 100 ML, 475 G, 1 LTR, 45kg, 100ml, 475g, 1L)
  const match = combined.match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|ml|ltr|litre|l|mg|q|quintal|tonne|t)\b/i);
  if (match) {
    sizeValue = parseFloat(match[1]);
    const u = match[2].toUpperCase();
    if (u === 'KG') sizeUnit = 'KG';
    else if (u === 'G' || u === 'GM' || u === 'GRAM') sizeUnit = 'G';
    else if (u === 'ML') sizeUnit = 'ML';
    else if (u === 'LTR' || u === 'LITRE' || u === 'L') sizeUnit = 'LTR';
    else if (u === 'MG') sizeUnit = 'MG';
    else if (u === 'Q' || u === 'QUINTAL') sizeUnit = 'Q';
    else if (u === 'TONNE' || u === 'T') sizeUnit = 'TONNE';
  }

  return { sizeValue, sizeUnit, packaging };
}

/**
 * Formats a clean, readable Product Size descriptor for shopkeepers (e.g., "45 KG", "100 ML").
 * Does NOT append packaging type (Bag, Bottle, etc.).
 */
export function formatProductPackDisplay(prod: {
  pack_size?: string | null;
  unit?: string | null;
  product_size_value?: number | null;
  product_size_unit?: string | null;
}): string {
  if (prod.product_size_value) {
    return `${prod.product_size_value} ${prod.product_size_unit || 'KG'}`;
  }
  if (prod.pack_size) {
    const parsed = parseProductSize(prod.pack_size, prod.unit);
    if (parsed.sizeValue && parsed.sizeUnit) {
      return `${parsed.sizeValue} ${parsed.sizeUnit}`;
    }
    return prod.pack_size;
  }
  if (prod.unit) {
    const parsed = parseProductSize(null, prod.unit);
    if (parsed.sizeValue && parsed.sizeUnit) {
      return `${parsed.sizeValue} ${parsed.sizeUnit}`;
    }
  }
  return '';
}

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
  unit: z.string().optional().default('Piece'),
  product_size_value: z.coerce.number().min(0).optional().nullable(),
  product_size_unit: z.string().optional().nullable(),
  pack_size: z.string().optional().nullable(),
  min_stock: z.coerce.number().min(0).optional().nullable().default(5),
  max_stock: z.coerce.number().min(0).optional().nullable(),
  opening_stock: z.coerce.number({ invalid_type_error: 'Quantity is required' }).min(0.01, 'Quantity must be greater than 0'),
  batch_tracking: z.boolean().optional().default(true),
  expiry_tracking: z.boolean().optional().default(true),
  batch_number: z.string({ required_error: 'Batch number is required.' }).trim().min(1, 'Batch number is required.'),
  mfd_date: z.string().optional().nullable(),
  expiry_date: z.string({ required_error: 'Expiry date is required.' })
    .trim()
    .min(1, 'Expiry date is required.')
    .refine(validateExpiryDate, {
      message: 'Invalid expiry date. Use format DD/MM/YYYY',
    }),
  product_type: z.string().optional().nullable(),
  active_ingredient: z.string().optional().nullable(),
  formulation: z.string().optional().nullable(),
  crop: z.string().optional().nullable(),
  target_pest: z.string().optional().nullable(),
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
  name: z.string().min(1, 'Customer name is required'),
  mobile: z.string().min(1, 'Mobile number is required').regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  aadhaar: z.string().min(1, 'Aadhaar number is required').regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  phone: z.string().regex(phoneRegex, 'Invalid Indian mobile number format').optional().nullable().or(z.literal('')),
  village: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  farm_size: z.string().optional().nullable().or(z.literal('')),
  farmSize: z.string().optional().nullable().or(z.literal('')),
  crops: z.string().optional().nullable().or(z.literal('')),
  notes: z.string().optional().nullable().or(z.literal('')),
  credit_limit: z.number().optional().nullable(),
  outstanding: z.number().optional().nullable(),
  previous_udhari: z.number().min(0, 'Previous Udhari cannot be negative').optional().nullable(),
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
