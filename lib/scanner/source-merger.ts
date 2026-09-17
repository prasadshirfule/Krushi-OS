import { ProductScanResult, ScannerSource, FieldConflictRecord } from './types';

// Priority ranks (higher number = higher priority for that specific field)
type PriorityMap = Record<ScannerSource, number>;

const DEFAULT_PRIORITY: PriorityMap = {
  gs1: 40,
  manufacturer_url: 35,
  structured_qr: 30,
  database: 25,
  ocr: 20,
  barcode: 15,
  combined: 10,
  unknown: 0,
};

const FIELD_PRIORITY_OVERRIDES: Record<string, PriorityMap> = {
  // GTIN / Barcode: GS1 > Barcode > Database
  gtin: { gs1: 50, barcode: 40, database: 30, structured_qr: 25, manufacturer_url: 20, ocr: 10, combined: 5, unknown: 0 },
  barcode: { gs1: 50, barcode: 40, database: 30, structured_qr: 25, manufacturer_url: 20, ocr: 10, combined: 5, unknown: 0 },

  // Traceability: GS1 > Manufacturer Page > OCR > Database
  batchNumber: { gs1: 50, manufacturer_url: 45, ocr: 40, structured_qr: 35, database: 20, barcode: 0, combined: 5, unknown: 0 },
  serialNumber: { gs1: 50, manufacturer_url: 45, ocr: 40, structured_qr: 35, database: 20, barcode: 0, combined: 5, unknown: 0 },
  manufacturingDate: { gs1: 50, manufacturer_url: 45, ocr: 40, structured_qr: 35, database: 20, barcode: 0, combined: 5, unknown: 0 },
  expiryDate: { gs1: 50, manufacturer_url: 45, ocr: 40, structured_qr: 35, database: 20, barcode: 0, combined: 5, unknown: 0 },
  expiryDateDB: { gs1: 50, manufacturer_url: 45, ocr: 40, structured_qr: 35, database: 20, barcode: 0, combined: 5, unknown: 0 },

  // Product Identity: Manufacturer Page > Database > OCR
  productName: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
  brand: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },

  // Manufacturer: Trusted Manufacturer Page > Database > OCR
  manufacturer: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },

  // Composition / Active Ingredients: Trusted Manufacturer Page > Database > OCR
  composition: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },

  // Packaging: Manufacturer Page > Database > OCR
  packSize: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
  sizeValue: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
  sizeUnit: { manufacturer_url: 50, database: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },

  // Category: Database > Manufacturer Page > OCR
  category: { database: 50, manufacturer_url: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
  categoryId: { database: 50, manufacturer_url: 40, ocr: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },

  // Regulatory: Explicit Structured / Database > Manufacturer > OCR
  hsnCode: { database: 50, manufacturer_url: 40, ocr: 30, structured_qr: 20, gs1: 0, barcode: 0, combined: 5, unknown: 0 },
  gstRate: { database: 50, manufacturer_url: 40, ocr: 30, structured_qr: 20, gs1: 0, barcode: 0, combined: 5, unknown: 0 },

  // Commercial: Current Package / Manufacturer > OCR
  mrp: { manufacturer_url: 50, ocr: 40, database: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
  unitSalePrice: { manufacturer_url: 50, ocr: 40, database: 30, structured_qr: 20, gs1: 10, barcode: 0, combined: 5, unknown: 0 },
};

const FIELD_LABELS: Record<string, string> = {
  gtin: 'GTIN',
  barcode: 'Barcode',
  productName: 'Product Name',
  brand: 'Brand',
  manufacturer: 'Manufacturer',
  packSize: 'Pack Size',
  sizeValue: 'Size Value',
  sizeUnit: 'Size Unit',
  category: 'Category',
  hsnCode: 'HSN Code',
  gstRate: 'GST Rate',
  batchNumber: 'Batch Number',
  serialNumber: 'Serial Number',
  manufacturingDate: 'Manufacturing Date',
  expiryDate: 'Expiry Date',
  mrp: 'MRP',
  unitSalePrice: 'Unit Sale Price',
  composition: 'Composition',
};

function getFieldPriority(fieldName: string, source: ScannerSource): number {
  const map = FIELD_PRIORITY_OVERRIDES[fieldName] || DEFAULT_PRIORITY;
  return map[source] ?? 0;
}

function areValuesEqual(valA: any, valB: any): boolean {
  if (valA === valB) return true;
  if (valA == null && valB == null) return true;
  if (valA == null || valB == null) return false;

  if (typeof valA === 'number' && typeof valB === 'number') {
    return Math.abs(valA - valB) < 0.001;
  }

  const strA = String(valA).trim().toLowerCase().replace(/\s+/g, ' ');
  const strB = String(valB).trim().toLowerCase().replace(/\s+/g, ' ');
  return strA === strB;
}

/**
 * Merges multiple ProductScanResults according to field-specific priorities and tracks conflicts.
 */
export function mergeProductScanResults(sources: ProductScanResult[]): ProductScanResult {
  const validSources = sources.filter(Boolean);
  if (validSources.length === 0) {
    return {
      rawValue: '',
      format: 'UNKNOWN',
      source: 'unknown',
    };
  }

  if (validSources.length === 1) {
    return { ...validSources[0] };
  }

  // Use the primary rawValue and format from the earliest valid scan (usually the physical scan)
  const primary = validSources[0];
  const merged: ProductScanResult = {
    rawValue: primary.rawValue,
    format: primary.format,
    source: 'combined',
    sourceUrl: primary.sourceUrl || validSources.find((s) => s.sourceUrl)?.sourceUrl,
    detectedFields: [],
    confidence: {},
    fieldSources: {},
    conflicts: [],
  };

  const allFieldKeys = new Set<string>();
  validSources.forEach((src) => {
    Object.keys(src).forEach((key) => {
      if (!['rawValue', 'format', 'source', 'detectedFields', 'confidence', 'fieldSources', 'conflicts', 'matchedProduct'].includes(key)) {
        allFieldKeys.add(key);
      }
    });
  });

  const conflicts: FieldConflictRecord[] = [];

  allFieldKeys.forEach((key) => {
    // Collect all candidates for this field
    const candidates: Array<{ source: ScannerSource; value: any; confidence?: number }> = [];

    validSources.forEach((src) => {
      const val = (src as any)[key];
      if (val !== undefined && val !== null && val !== '') {
        const itemSource: ScannerSource = (src.fieldSources && (src.fieldSources as any)[key])
          ? (src.fieldSources as any)[key]
          : src.source;
        candidates.push({
          source: itemSource,
          value: val,
          confidence: src.confidence?.[key],
        });
      }
    });

    if (candidates.length === 0) return;

    // Sort candidates by field-specific priority descending
    candidates.sort((a, b) => {
      const prioA = getFieldPriority(key, a.source);
      const prioB = getFieldPriority(key, b.source);
      if (prioA !== prioB) return prioB - prioA;
      return (b.confidence ?? 0.8) - (a.confidence ?? 0.8);
    });

    const winner = candidates[0];
    (merged as any)[key] = winner.value;
    merged.fieldSources![key] = winner.source;
    merged.confidence![key] = winner.confidence ?? 0.8;
    merged.detectedFields!.push(key);

    // Conflict detection: if another candidate with high priority differs from the winner
    for (let i = 1; i < candidates.length; i++) {
      const runnerUp = candidates[i];
      if (!areValuesEqual(winner.value, runnerUp.value)) {
        // Traceability fields (batch, serial, expiry) with different values must always trigger conflict
        const isCritical = ['batchNumber', 'serialNumber', 'expiryDate', 'mrp', 'hsnCode'].includes(key);
        if (isCritical) {
          conflicts.push({
            field: key,
            label: FIELD_LABELS[key] || key,
            valueA: winner.value,
            sourceA: winner.source,
            valueB: runnerUp.value,
            sourceB: runnerUp.source,
          });
          break;
        }
      }
    }
  });

  // Carry over matchedProduct entity if present
  const matched = validSources.find((s) => s.matchedProduct)?.matchedProduct;
  if (matched) {
    merged.matchedProduct = matched;
    merged.existingProductFound = true;
  }

  // Deduplicate detectedFields
  merged.detectedFields = Array.from(new Set(merged.detectedFields));
  merged.conflicts = conflicts;

  return merged;
}
