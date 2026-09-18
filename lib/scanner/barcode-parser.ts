import { ProductScanResult } from './types';
import { isGS1Barcode, parseGS1Barcode, normalizeGTIN } from './gs1-parser';
import { isGS1Url, parseGS1Url } from './url-gs1-parser';
import { parseManufacturerQr } from './manufacturer-qr-parser';
import { parseStructuredQR } from './structured-qr-parser';

/**
 * Normalizes and parses any scanned barcode, GS1 string, manufacturer URL, or QR code.
 *
 * Priority:
 * 1. Manufacturer URL with GS1 Digital Link / Application Identifiers (e.g. Syngenta /01/.../10/.../21/... URLs)
 * 2. Standard GS1 Application Identifiers (Bracketed, Raw element string, FNC1)
 * 3. Generic Manufacturer / Hybrid Structured QR (e.g. URL + No/MFG/EXP/UID labels, query params)
 * 4. Structured JSON / Key-Value QR
 * 5. Standard 1D/2D Barcode (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, DataMatrix, etc.)
 */
export function parseScannedBarcode(rawValue: string, format = 'UNKNOWN'): ProductScanResult {
  const trimmed = (rawValue || '').trim();

  if (!trimmed) {
    return {
      rawValue: '',
      format,
      source: 'unknown',
    };
  }

  // 1. Check for Manufacturer URL GS1 Digital Link format
  if (isGS1Url(trimmed)) {
    const urlGs1 = parseGS1Url(trimmed);
    if (urlGs1) {
      return {
        ...urlGs1,
        format: format !== 'UNKNOWN' ? format : 'QR_CODE',
      };
    }
  }

  // 2. Check for Standard GS1 Barcode
  if (isGS1Barcode(trimmed)) {
    const gs1 = parseGS1Barcode(trimmed);
    if (gs1 && (gs1.gtin || gs1.batchNumber || gs1.expiryDate || gs1.serialNumber)) {
      const detectedFields: string[] = [];
      const fieldSources: Record<string, 'gs1'> = {};

      if (gs1.gtin) {
        detectedFields.push('gtin', 'barcode');
        fieldSources['gtin'] = 'gs1';
        fieldSources['barcode'] = 'gs1';
      }
      if (gs1.batchNumber) {
        detectedFields.push('batchNumber');
        fieldSources['batchNumber'] = 'gs1';
      }
      if (gs1.serialNumber) {
        detectedFields.push('serialNumber');
        fieldSources['serialNumber'] = 'gs1';
      }
      if (gs1.productionDate) {
        detectedFields.push('manufacturingDate');
        fieldSources['manufacturingDate'] = 'gs1';
      }
      if (gs1.expiryDate) {
        detectedFields.push('expiryDate', 'expiryDateDB');
        fieldSources['expiryDate'] = 'gs1';
        fieldSources['expiryDateDB'] = 'gs1';
      }
      if (gs1.quantity) {
        detectedFields.push('quantity');
        fieldSources['quantity'] = 'gs1';
      }

      return {
        rawValue: trimmed,
        format,
        gtin: gs1.gtin,
        barcode: gs1.gtin,
        stableProductKey: gs1.gtin ? `gtin:${normalizeGTIN(gs1.gtin)}` : undefined,
        batchNumber: gs1.batchNumber,
        serialNumber: gs1.serialNumber,
        manufacturingDate: gs1.productionDate,
        expiryDate: gs1.expiryDate,
        expiryDateDB: gs1.expiryDateDB,
        quantity: gs1.quantity,
        source: 'gs1',
        detectedFields,
        fieldSources,
      };
    }
  }

  // 3. Check for Generic Manufacturer QR (URL + labels, query params, multi-line key-values)
  const mfgQr = parseManufacturerQr(trimmed, format);
  if (mfgQr) {
    if (mfgQr.gtin && !mfgQr.stableProductKey) {
      mfgQr.stableProductKey = `gtin:${normalizeGTIN(mfgQr.gtin)}`;
    }
    return mfgQr;
  }

  // 4. Check for Structured JSON QR fallback
  const structured = parseStructuredQR(trimmed);
  if (structured) {
    const detectedFields: string[] = [];
    const fieldSources: Record<string, 'structured_qr'> = {};

    Object.keys(structured).forEach((key) => {
      if (['rawValue', 'format', 'source'].includes(key)) return;
      if ((structured as any)[key] !== undefined && (structured as any)[key] !== null) {
        detectedFields.push(key);
        fieldSources[key] = 'structured_qr';
      }
    });

    const structuredGtin = structured.gtin;

    return {
      rawValue: trimmed,
      format,
      gtin: structuredGtin,
      barcode: structured.barcode || structuredGtin,
      stableProductKey: structuredGtin ? `gtin:${normalizeGTIN(structuredGtin)}` : undefined,
      productName: structured.productName,
      manufacturer: structured.manufacturer,
      brand: structured.brand || structured.manufacturer,
      size: structured.size,
      sizeValue: structured.sizeValue,
      sizeUnit: structured.sizeUnit,
      packSize: structured.packSize || structured.size,
      hsnCode: structured.hsnCode,
      gstRate: structured.gstRate,
      batchNumber: structured.batchNumber,
      manufacturingDate: structured.manufacturingDate,
      expiryDate: structured.expiryDate,
      expiryDateDB: structured.expiryDateDB,
      quantity: structured.quantity,
      purchasePrice: structured.purchasePrice,
      sellingPrice: structured.sellingPrice,
      source: 'structured_qr',
      detectedFields,
      fieldSources,
    };
  }

  // 5. Standard Barcode (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, etc.)
  const cleanBarcode = trimmed.replace(/[\r\n\t]/g, '').trim();
  const isNumericOnly = /^\d+$/.test(cleanBarcode);
  const normalizedGtin = isNumericOnly ? normalizeGTIN(cleanBarcode) : undefined;
  const isUrl = /^https?:\/\//i.test(cleanBarcode);

  const detectedFields: string[] = [];
  const fieldSources: Record<string, any> = {};

  if (!isUrl) {
    detectedFields.push('barcode');
    fieldSources['barcode'] = 'barcode';
    if (normalizedGtin) {
      detectedFields.push('gtin');
      fieldSources['gtin'] = 'barcode';
    }
  }

  return {
    rawValue: trimmed,
    format,
    barcode: !isUrl ? cleanBarcode : undefined,
    gtin: normalizedGtin,
    stableProductKey: normalizedGtin ? `gtin:${normalizedGtin}` : undefined,
    sourceUrl: isUrl ? cleanBarcode : undefined,
    source: !isUrl ? 'barcode' : 'unknown',
    detectedFields,
    fieldSources,
  };
}

/**
 * Deterministically extracts ONLY Batch Number and Expiry Date from a scanned QR or barcode payload.
 *
 * Rules:
 * - GS1 AI 10 = Batch/Lot Number
 * - GS1 AI 17 / AI 15 = Expiry Date
 * - Structured manufacturer QR: No / Batch / Lot = Batch Number, EXP / Expiry = Expiry Date
 * - Deterministic parsing only from data explicitly encoded in payload.
 * - No AI, OCR, web scraping, or guessing.
 * - Returns undefined if not explicitly encoded.
 */
export function extractBatchAndExpiryFromIdentifier(rawValue: string): {
  batchNumber?: string;
  expiryDate?: string;
} {
  if (!rawValue || typeof rawValue !== 'string') {
    return {};
  }
  const parsed = parseScannedBarcode(rawValue);
  return {
    batchNumber: parsed.batchNumber?.trim() || undefined,
    expiryDate: parsed.expiryDate?.trim() || undefined,
  };
}

export interface ExtractedIdentifierInfo {
  rawValue: string;
  format?: string;
  identifierType: 'barcode' | 'gtin' | 'qr' | 'other';
  normalizedValue: string;
  gtin?: string;
  productCode?: string;
  stableProductKey?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  expiryDateDB?: string | null;
}

/**
 * Extracts complete identifier metadata while strictly enforcing safety rules:
 * - GTIN/EAN/UPC or explicit product code -> safe stableProductKey
 * - Batch/Serial/Dates -> stored in separate fields, stableProductKey = null
 * - Never guesses stableProductKey from arbitrary URL shapes
 */
export function extractStableIdentifierInfo(rawValue: string, format = 'UNKNOWN'): ExtractedIdentifierInfo {
  const clean = (rawValue || '').trim();
  if (!clean) {
    return {
      rawValue: '',
      identifierType: 'other',
      normalizedValue: '',
      stableProductKey: null,
      batchNumber: null,
      serialNumber: null,
      manufacturingDate: null,
      expiryDate: null,
      expiryDateDB: null,
    };
  }

  const parsed = parseScannedBarcode(clean, format);
  const fmtUpper = String(format || '').toUpperCase();
  const isUrl = /^https?:\/\//i.test(clean) || (clean.includes('/') && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\//.test(clean));
  const isMultiLine = clean.includes('\n') || clean.includes('\r');

  let type: 'barcode' | 'gtin' | 'qr' | 'other' = 'barcode';
  if (isUrl || isMultiLine || fmtUpper.includes('QR') || fmtUpper.includes('AZTEC') || fmtUpper.includes('DATA_MATRIX')) {
    type = 'qr';
  } else if (parsed.gtin || /^\d{8,14}$/.test(clean)) {
    type = 'gtin';
  } else if (fmtUpper !== 'UNKNOWN') {
    type = 'barcode';
  } else {
    type = 'other';
  }

  const normalizedValue = (parsed.gtin || parsed.barcode || clean).trim();

  // Strict safety rule: stableProductKey is ONLY created for proven product identities
  let stableProductKey: string | null = null;
  if (parsed.gtin) {
    stableProductKey = `gtin:${normalizeGTIN(parsed.gtin)}`;
  } else if (parsed.productCode) {
    stableProductKey = `sku:${parsed.productCode.trim().toUpperCase()}`;
  }

  return {
    rawValue: clean,
    format: parsed.format,
    identifierType: type,
    normalizedValue,
    gtin: parsed.gtin,
    productCode: parsed.productCode,
    stableProductKey,
    batchNumber: parsed.batchNumber?.trim() || null,
    serialNumber: parsed.serialNumber?.trim() || null,
    manufacturingDate: parsed.manufacturingDate?.trim() || null,
    expiryDate: parsed.expiryDate?.trim() || null,
    expiryDateDB: parsed.expiryDateDB?.trim() || null,
  };
}

