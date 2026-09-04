export const PRODUCT_SIZE_UNITS = [
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'G', label: 'Gram (g)' },
  { value: 'ML', label: 'Millilitre (ml)' },
  { value: 'LTR', label: 'Litre (L)' },
  { value: 'MG', label: 'Milligram (mg)' },
  { value: 'Q', label: 'Quintal (q)' },
  { value: 'TONNE', label: 'Tonne (t)' },
] as const;

export const PACKAGING_TYPES = [
  { value: 'Bag', label: 'Bag' },
  { value: 'Bottle', label: 'Bottle' },
  { value: 'Packet', label: 'Packet' },
  { value: 'Box', label: 'Box' },
  { value: 'Container', label: 'Container' },
  { value: 'Piece', label: 'Piece' },
  { value: 'Can', label: 'Can' },
  { value: 'Drum', label: 'Drum' },
] as const;

export const PRODUCT_UNITS = [
  ...PACKAGING_TYPES,
  ...PRODUCT_SIZE_UNITS,
] as const;


export const PRODUCT_CATEGORIES = [
  'Seeds',
  'Fertilizers',
  'Insecticides',
  'Fungicides',
  'Herbicides',
  'Growth Promoters',
  'Bio Products',
  'Equipment',
  'Other',
] as const;

export const AGRICULTURAL_TYPES = [
  'Fertilizer',
  'Pesticide',
  'Insecticide',
  'Fungicide',
  'Herbicide',
  'Seed',
  'Bio Product',
  'Growth Promoter',
  'Equipment',
  'Other',
] as const;

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'] as const;

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Salary',
  'Transport',
  'Internet',
  'Maintenance',
  'Marketing',
  'Other',
] as const;

export const ROLES = ['Admin', 'Manager', 'Cashier', 'Sales Staff'] as const;

export const EXPIRY_THRESHOLDS = {
  normal: 90,
  warning: 30,
  urgent: 7,
} as const;

export const INVOICE_PREFIX = 'KOS';
export const APP_NAME = 'KRUSHI OS';
export const ITEMS_PER_PAGE = 20;

export const KEYBOARD_SHORTCUTS = {
  newBill: 'F2',
  productSearch: 'F4',
  payment: 'F8',
  print: 'ctrl+p',
  globalSearch: 'ctrl+k',
} as const;
