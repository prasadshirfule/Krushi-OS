export const PRODUCT_UNITS = [
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'GRAM', label: 'Gram (g)' },
  { value: 'MG', label: 'Milligram (mg)' },
  { value: 'QUINTAL', label: 'Quintal (q)' },
  { value: 'TONNE', label: 'Tonne (t)' },
  { value: 'LITRE', label: 'Litre (L)' },
  { value: 'ML', label: 'Millilitre (ml)' },
  { value: 'PIECE', label: 'Piece (pcs)' },
  { value: 'PACKET', label: 'Packet' },
  { value: 'BAG', label: 'Bag' },
  { value: 'BOTTLE', label: 'Bottle' },
  { value: 'BOX', label: 'Box' },
  { value: 'CONTAINER', label: 'Container' },
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
