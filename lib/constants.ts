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


export const DEFAULT_POPULAR_CATEGORIES = [
  { name: 'Seeds', description: 'Hybrid, Research & Certified Agricultural Seeds' },
  { name: 'Fertilizers', description: 'Chemical, Organic & Water Soluble Fertilizers' },
  { name: 'Insecticides', description: 'Crop Protection Insecticides' },
  { name: 'Fungicides', description: 'Systemic & Contact Fungicides' },
  { name: 'Herbicides', description: 'Weedicides & Plant Protection Chemicals' },
  { name: 'Pesticides', description: 'General Agricultural Pest Control' },
  { name: 'Bio Products', description: 'Bio-fertilizers, Bio-pesticides & Organic Inputs' },
  { name: 'Growth Promoters', description: 'Plant Growth Regulators & Micronutrients' },
  { name: 'Agro Tools & Equipment', description: 'Sprayers, Cutters, Nozzles & Implements' },
];

export const DEFAULT_POPULAR_BRANDS = [
  { name: 'Bayer CropScience', manufacturer: 'Bayer India Ltd' },
  { name: 'Syngenta', manufacturer: 'Syngenta India Ltd' },
  { name: 'UPL Limited', manufacturer: 'UPL Limited' },
  { name: 'IFFCO', manufacturer: 'Indian Farmers Fertiliser Cooperative' },
  { name: 'Coromandel', manufacturer: 'Coromandel International Ltd' },
  { name: 'Rallis India', manufacturer: 'Tata Rallis India Ltd' },
  { name: 'Dhanuka', manufacturer: 'Dhanuka Agritech Ltd' },
  { name: 'BASF', manufacturer: 'BASF India Ltd' },
  { name: 'FMC', manufacturer: 'FMC India Pvt Ltd' },
  { name: 'PI Industries', manufacturer: 'PI Industries Ltd' },
  { name: 'Sumitomo Chemical', manufacturer: 'Sumitomo Chemical India Ltd' },
  { name: 'Adama', manufacturer: 'Adama India Pvt Ltd' },
  { name: 'Mahyco', manufacturer: 'Maharashtra Hybrid Seeds Co' },
  { name: 'Kaveri Seeds', manufacturer: 'Kaveri Seed Company Ltd' },
  { name: 'Nuziveedu Seeds', manufacturer: 'Nuziveedu Seeds Ltd' },
];

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

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Partial Payment', 'Bank Transfer', 'Credit'] as const;

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
