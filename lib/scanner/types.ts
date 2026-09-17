export type ScannerSource = 
  | 'gs1' 
  | 'structured_qr' 
  | 'manufacturer_url' 
  | 'barcode' 
  | 'database' 
  | 'ocr' 
  | 'combined' 
  | 'unknown';

export interface FieldConflictRecord {
  field: string;
  label: string;
  sourceA: string;
  valueA: any;
  sourceB: string;
  valueB: any;
}

export interface ProductScanResult {
  rawValue: string;
  format: string;

  source: ScannerSource;

  // Identification
  gtin?: string;
  barcode?: string;
  productCode?: string;
  sku?: string;

  // Product identity
  productName?: string;
  brand?: string;
  manufacturer?: string;
  productDescription?: string;
  composition?: string;
  activeIngredients?: string[];
  formulation?: string;

  // Packaging
  sizeValue?: number;
  sizeUnit?: string;
  packSize?: string;
  packaging?: string;
  size?: string;

  // Classification
  category?: string;
  categoryId?: string;
  hsnCode?: string;
  gstRate?: number;

  // Traceability
  batchNumber?: string;
  serialNumber?: string;
  manufacturingDate?: string; // YYYY-MM-DD or DD/MM/YYYY
  expiryDate?: string; // DD/MM/YYYY for UI display
  expiryDateDB?: string; // YYYY-MM-DD for database

  // Commercial
  mrp?: number;
  unitSalePrice?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  quantity?: number;

  // Regulatory & Origin
  registrationNumber?: string;
  manufacturingLicenceNumber?: string;
  countryOfOrigin?: string;

  // Provenance & Confidence
  detectedFields?: string[];
  confidence?: Record<string, number>;
  fieldSources?: Record<string, ScannerSource | 'user'>;
  conflicts?: FieldConflictRecord[];

  // URL information
  sourceUrl?: string;

  // KRUSHI OS Match information
  matchedProductId?: string;
  matchedExistingProduct?: boolean;
  existingProductFound?: boolean;
  matchedProduct?: any;
}

export interface GS1ParsedData {
  gtin?: string;
  batchNumber?: string;
  serialNumber?: string;
  productionDate?: string; // YYYY-MM-DD
  expiryDate?: string; // DD/MM/YYYY
  expiryDateDB?: string; // YYYY-MM-DD
  quantity?: number;
  rawPairs: Array<{ ai: string; title: string; rawValue: string; value: any }>;
}

export interface ScannerPermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited';
}

export type ScanConflictField = 
  | 'name' 
  | 'brand_id' 
  | 'category_id'
  | 'hsn_code' 
  | 'gst_rate' 
  | 'product_size_value' 
  | 'product_size_unit' 
  | 'batch_number' 
  | 'expiry_date' 
  | 'mfd_date'
  | 'barcode'
  | 'purchase_price'
  | 'selling_price'
  | 'mrp';

export interface FieldConflict {
  fieldName: ScanConflictField;
  label: string;
  currentValue: any;
  detectedValue: any;
  source?: string;
}
