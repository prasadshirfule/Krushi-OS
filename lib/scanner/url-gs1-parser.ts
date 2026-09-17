import { ProductScanResult } from './types';
import { normalizeGTIN, parseGS1Date } from './gs1-parser';

/**
 * Recognizes and parses GS1 Application Identifiers embedded in URLs / GS1 Digital Link formats.
 *
 * Examples:
 * - https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128
 * - https://syngenta.co.in/gpd/01/08904232810364/10/SPL5G20100/21/183QBVEU1Y?11=250727&17=270726
 * - https://example.org/01/08901234567890/10/LOT42/21/SERIAL1?11=260101&17=280101
 * - https://id.gs1.org/01/08901234567890/10/LOT123?17=280630
 */
export function isGS1Url(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;

  // Check if URL contains GS1 AI path markers (/01/, /10/, /21/) or query params (?11=, &17=, ?01=)
  const hasAiInPath = /\/(01|02|10|21)\/[^/?#]+/i.test(trimmed);
  const hasAiInQuery = /[?&](01|02|10|11|15|17|21|30)=[^&#]+/i.test(trimmed);

  return hasAiInPath || hasAiInQuery;
}

export function parseGS1Url(rawUrl: string): ProductScanResult | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  let urlObj: URL;
  try {
    urlObj = new URL(trimmed);
  } catch {
    return null;
  }

  // Only allow http / https
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return null;
  }

  const detectedFields: string[] = [];
  const fieldSources: Record<string, 'gs1'> = {};

  let gtin: string | undefined;
  let batchNumber: string | undefined;
  let serialNumber: string | undefined;
  let manufacturingDate: string | undefined;
  let expiryDate: string | undefined;
  let expiryDateDB: string | undefined;
  let quantity: number | undefined;

  // 1. Parse Path Segments
  // Standard GS1 Digital Link path structure: .../AI/Value/AI/Value...
  // Example path: /gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX
  const pathSegments = urlObj.pathname.split('/').filter(Boolean);
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    const nextVal = pathSegments[i + 1] ? decodeURIComponent(pathSegments[i + 1]).trim() : '';

    if (segment === '01' || segment === '02') {
      if (nextVal && /^\d{8,14}$/.test(nextVal)) {
        gtin = normalizeGTIN(nextVal);
        detectedFields.push('gtin', 'barcode');
        fieldSources['gtin'] = 'gs1';
        fieldSources['barcode'] = 'gs1';
        i++; // skip nextVal
      }
    } else if (segment === '10') {
      if (nextVal) {
        batchNumber = nextVal;
        detectedFields.push('batchNumber');
        fieldSources['batchNumber'] = 'gs1';
        i++;
      }
    } else if (segment === '21') {
      if (nextVal) {
        serialNumber = nextVal;
        detectedFields.push('serialNumber');
        fieldSources['serialNumber'] = 'gs1';
        i++;
      }
    } else if (segment === '11') {
      if (nextVal) {
        const parsed = parseGS1Date(nextVal);
        if (parsed) {
          manufacturingDate = parsed.isoDate;
          detectedFields.push('manufacturingDate');
          fieldSources['manufacturingDate'] = 'gs1';
        }
        i++;
      }
    } else if (segment === '17' || segment === '15') {
      if (nextVal) {
        const parsed = parseGS1Date(nextVal);
        if (parsed) {
          expiryDate = parsed.uiDate;
          expiryDateDB = parsed.isoDate;
          detectedFields.push('expiryDate', 'expiryDateDB');
          fieldSources['expiryDate'] = 'gs1';
          fieldSources['expiryDateDB'] = 'gs1';
        }
        i++;
      }
    } else if (segment === '30') {
      if (nextVal) {
        const q = parseInt(nextVal, 10);
        if (!isNaN(q) && q > 0) {
          quantity = q;
          detectedFields.push('quantity');
          fieldSources['quantity'] = 'gs1';
        }
        i++;
      }
    }
  }

  // 2. Parse Query Parameters
  // Example: ?11=260129&17=280128 or ?01=...&10=...
  urlObj.searchParams.forEach((value, key) => {
    const cleanKey = key.trim();
    const cleanVal = decodeURIComponent(value).trim();
    if (!cleanVal) return;

    if ((cleanKey === '01' || cleanKey === '02' || cleanKey === 'gtin') && !gtin) {
      if (/^\d{8,14}$/.test(cleanVal)) {
        gtin = normalizeGTIN(cleanVal);
        detectedFields.push('gtin', 'barcode');
        fieldSources['gtin'] = 'gs1';
        fieldSources['barcode'] = 'gs1';
      }
    } else if ((cleanKey === '10' || cleanKey === 'batch' || cleanKey === 'lot') && !batchNumber) {
      batchNumber = cleanVal;
      detectedFields.push('batchNumber');
      fieldSources['batchNumber'] = 'gs1';
    } else if ((cleanKey === '21' || cleanKey === 'serial' || cleanKey === 'sn') && !serialNumber) {
      serialNumber = cleanVal;
      detectedFields.push('serialNumber');
      fieldSources['serialNumber'] = 'gs1';
    } else if ((cleanKey === '11' || cleanKey === 'mfd' || cleanKey === 'mfgDate') && !manufacturingDate) {
      const parsed = parseGS1Date(cleanVal);
      if (parsed) {
        manufacturingDate = parsed.isoDate;
        detectedFields.push('manufacturingDate');
        fieldSources['manufacturingDate'] = 'gs1';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanVal)) {
        manufacturingDate = cleanVal;
        detectedFields.push('manufacturingDate');
        fieldSources['manufacturingDate'] = 'gs1';
      }
    } else if ((cleanKey === '17' || cleanKey === '15' || cleanKey === 'exp' || cleanKey === 'expiryDate') && !expiryDate) {
      const parsed = parseGS1Date(cleanVal);
      if (parsed) {
        expiryDate = parsed.uiDate;
        expiryDateDB = parsed.isoDate;
        detectedFields.push('expiryDate', 'expiryDateDB');
        fieldSources['expiryDate'] = 'gs1';
        fieldSources['expiryDateDB'] = 'gs1';
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanVal)) {
        const [y, m, d] = cleanVal.split('-');
        expiryDate = `${d}/${m}/${y}`;
        expiryDateDB = cleanVal;
        detectedFields.push('expiryDate', 'expiryDateDB');
        fieldSources['expiryDate'] = 'gs1';
        fieldSources['expiryDateDB'] = 'gs1';
      }
    } else if (cleanKey === '30' && !quantity) {
      const q = parseInt(cleanVal, 10);
      if (!isNaN(q) && q > 0) {
        quantity = q;
        detectedFields.push('quantity');
        fieldSources['quantity'] = 'gs1';
      }
    }
  });

  // Only consider valid if at least one meaningful GS1 identifier was extracted
  if (!gtin && !batchNumber && !serialNumber && !expiryDate) {
    return null;
  }

  return {
    rawValue: trimmed,
    format: 'QR_CODE',
    source: 'gs1',
    sourceUrl: trimmed,
    gtin,
    barcode: gtin,
    batchNumber,
    serialNumber,
    manufacturingDate,
    expiryDate,
    expiryDateDB,
    quantity,
    detectedFields: Array.from(new Set(detectedFields)),
    fieldSources,
  };
}
