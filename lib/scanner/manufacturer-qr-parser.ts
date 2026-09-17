import { ProductScanResult } from './types';
import { parseProductSize, formatToDDMMYYYY, formatDDMMYYYYtoDB } from '@/lib/validations';

/**
 * Sanitizes a string input safely, removing dangerous HTML/script tags and control characters.
 */
function sanitizeString(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  return str.replace(/<[^>]*>?/gm, '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

/**
 * Robust date parser supporting DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, YYYY/MM/DD, and YYMMDD.
 * Converts to UI display format (DD/MM/YYYY) and DB storage format (YYYY-MM-DD).
 * Never swaps day and month.
 */
export function normalizeManufacturerDate(val: any): { uiDate: string; dbDate: string; rawDate: string } | null {
  if (!val) return null;
  const str = sanitizeString(val);
  if (!str) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  // 1. Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (day <= daysInMonth[month - 1]) {
        return {
          uiDate: `${pad(day)}/${pad(month)}/${year}`,
          dbDate: `${year}-${pad(month)}-${pad(day)}`,
          rawDate: str,
        };
      }
    }
  }

  // 2. Handle YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (day <= daysInMonth[month - 1]) {
        return {
          uiDate: `${pad(day)}/${pad(month)}/${year}`,
          dbDate: `${year}-${pad(month)}-${pad(day)}`,
          rawDate: str,
        };
      }
    }
  }

  // 3. Handle YYMMDD (GS1 compact format)
  if (/^\d{6}$/.test(str)) {
    const yy = parseInt(str.slice(0, 2), 10);
    const mm = parseInt(str.slice(2, 4), 10);
    let dd = parseInt(str.slice(4, 6), 10);
    if (mm >= 1 && mm <= 12) {
      const year = yy >= 51 ? 1900 + yy : 2000 + yy;
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const maxDay = daysInMonth[mm - 1];
      if (dd === 0) dd = maxDay;
      if (dd >= 1 && dd <= maxDay) {
        return {
          uiDate: `${pad(dd)}/${pad(mm)}/${year}`,
          dbDate: `${year}-${pad(mm)}-${pad(dd)}`,
          rawDate: str,
        };
      }
    }
  }

  return null;
}

/**
 * Normalizes label key strings for resilient matching across diverse manufacturer formats.
 */
function normalizeLabelKey(rawKey: string): string {
  return rawKey
    .trim()
    .toLowerCase()
    .replace(/[._\-:\s]/g, '');
}

/**
 * Categorizes a normalized label into a canonical product field name.
 */
function mapLabelToField(normalizedKey: string): string | null {
  // Batch
  if (['no', 'batch', 'batchno', 'batchnumber', 'lot', 'lotno', 'lotnumber', 'bno', 'b', 'batchid'].includes(normalizedKey)) {
    return 'batchNumber';
  }

  // Serial / UID
  if (['uid', 'uidno', 'serial', 'serialno', 'serialnumber', 'sno', 'uniqueid', 'uniqueidentifier', 'sn'].includes(normalizedKey)) {
    return 'serialNumber';
  }

  // Manufacturing Date
  if (['mfg', 'mfd', 'mfgdate', 'mfddate', 'manufacturingdate', 'dateofmanufacture', 'dom', 'proddate', 'productiondate'].includes(normalizedKey)) {
    return 'manufacturingDate';
  }

  // Expiry Date
  if (['exp', 'expdate', 'expiry', 'expirydate', 'usebefore', 'bestbefore', 'doe', 'validtill', 'validupto', 'val'].includes(normalizedKey)) {
    return 'expiryDate';
  }

  // Product Name
  if (['product', 'productname', 'item', 'itemname', 'tradename', 'pname', 'material', 'materialname'].includes(normalizedKey)) {
    return 'productName';
  }

  // Manufacturer / Brand
  if (['manufacturer', 'maker', 'company', 'brand', 'brandname', 'registrant', 'mktby', 'mfdby', 'mfgby', 'marketedby'].includes(normalizedKey)) {
    return 'manufacturer';
  }

  // Pack Size
  if (['size', 'pack', 'packsize', 'netcontent', 'netcontents', 'netwt', 'netweight', 'volume', 'pkgsize'].includes(normalizedKey)) {
    return 'packSize';
  }

  // MRP
  if (['mrp', 'maxretailprice', 'price', 'rate'].includes(normalizedKey)) {
    return 'mrp';
  }

  // HSN Code
  if (['hsn', 'hsncode', 'tariff'].includes(normalizedKey)) {
    return 'hsnCode';
  }

  // GST Rate
  if (['gst', 'gstrate', 'tax', 'taxrate'].includes(normalizedKey)) {
    return 'gstRate';
  }

  // GTIN / Barcode
  if (['gtin', 'ean', 'ean13', 'ean8', 'upc', 'upca', 'barcode', 'itemcode', 'sku'].includes(normalizedKey)) {
    return 'gtin';
  }

  return null;
}

/**
 * Extracts structured fields from query parameters of a URL (e.g. ?batch=...&mfg=...&exp=...&uid=...).
 */
function extractFromQueryParams(urlStr: string, fieldsMap: Map<string, string>): void {
  try {
    const parsedUrl = new URL(urlStr);
    parsedUrl.searchParams.forEach((val, key) => {
      const mapped = mapLabelToField(normalizeLabelKey(key));
      if (mapped && val && !fieldsMap.has(mapped)) {
        fieldsMap.set(mapped, sanitizeString(val));
      }
    });
  } catch {
    // Non-URL or malformed query string
  }
}

/**
 * Generic Manufacturer QR Parser
 * Extracts structured fields directly from raw payload without hardcoded vendor rules.
 */
export function parseManufacturerQr(rawValue: string, format = 'QR_CODE'): ProductScanResult | null {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const rawFieldsMap = new Map<string, string>();
  let detectedUrl: string | undefined;

  // 1. Check for embedded URL
  const urlRegex = /(https?:\/\/[^\s\r\n|;,]+)/i;
  const urlMatch = trimmed.match(urlRegex);
  if (urlMatch) {
    detectedUrl = urlMatch[1];
    extractFromQueryParams(detectedUrl, rawFieldsMap);
  }

  // 2. Tokenize / split into lines or delimited segments
  // Split on newlines, pipes, semicolons, or commas (when separating key-value pairs)
  const lines = trimmed
    .split(/[\r\n|;]+/)
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Skip bare URL lines if already captured
    if (detectedUrl && line === detectedUrl) {
      continue;
    }

    // Handle "URL:https://..."
    if (/^url\s*[:=]\s*(https?:\/\/.+)/i.test(line)) {
      const uMatch = line.match(/^url\s*[:=]\s*(https?:\/\/.+)/i);
      if (uMatch && !detectedUrl) {
        detectedUrl = uMatch[1].trim();
        extractFromQueryParams(detectedUrl, rawFieldsMap);
      }
      continue;
    }

    // Try splitting multiple key-value pairs on a single line (e.g. "No:BAT123 MFG:18-01-2025 EXP:17-01-2027")
    // Match pattern: Label:Value or Label=Value
    const pairRegex = /([A-Za-z0-9._\s]+)\s*[:=]\s*([^\r\n|;:]+?)(?=\s+[A-Za-z0-9._\s]+[:=]|$)/g;
    let match: RegExpExecArray | null;
    let matchedPairsInLine = 0;

    while ((match = pairRegex.exec(line)) !== null) {
      const rawKey = match[1].trim();
      const rawVal = match[2].trim();
      const mapped = mapLabelToField(normalizeLabelKey(rawKey));

      if (mapped && rawVal) {
        matchedPairsInLine++;
        if (!rawFieldsMap.has(mapped)) {
          rawFieldsMap.set(mapped, sanitizeString(rawVal));
        }
      }
    }

    // If regex didn't find multiple pairs, test standard single line key-value
    if (matchedPairsInLine === 0) {
      const singleMatch = line.match(/^([A-Za-z0-9._\s]+)\s*[:=]\s*(.+)$/);
      if (singleMatch) {
        const rawKey = singleMatch[1].trim();
        const rawVal = singleMatch[2].trim();
        const mapped = mapLabelToField(normalizeLabelKey(rawKey));
        if (mapped && rawVal && !rawFieldsMap.has(mapped)) {
          rawFieldsMap.set(mapped, sanitizeString(rawVal));
        }
      }
    }
  }

  // 3. Check URL path for stable UID candidate if no explicit UID/serial was labeled
  if (detectedUrl && !rawFieldsMap.has('serialNumber')) {
    try {
      const parsedUrl = new URL(detectedUrl);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // If last segment is a numeric or alphanumeric identifier (e.g. 9183277589941951), record as UID candidate
        if (/^[A-Za-z0-9]{8,32}$/.test(lastSegment)) {
          rawFieldsMap.set('serialNumber', lastSegment);
        }
      }
    } catch {}
  }

  // 4. Validate if any meaningful structured product fields were discovered
  if (rawFieldsMap.size === 0) {
    return null;
  }

  // 5. Construct normalized ProductScanResult
  const detectedFields: string[] = [];
  const fieldSources: Record<string, 'structured_qr'> = {};

  const recordField = (field: string) => {
    detectedFields.push(field);
    fieldSources[field] = 'structured_qr';
  };

  const batchNumber = rawFieldsMap.get('batchNumber');
  if (batchNumber) recordField('batchNumber');

  const serialNumber = rawFieldsMap.get('serialNumber');
  if (serialNumber) recordField('serialNumber');

  // Parse manufacturing date
  let manufacturingDate: string | undefined;
  const rawMfg = rawFieldsMap.get('manufacturingDate');
  if (rawMfg) {
    const mfgParsed = normalizeManufacturerDate(rawMfg);
    if (mfgParsed) {
      manufacturingDate = mfgParsed.dbDate; // YYYY-MM-DD
      recordField('manufacturingDate');
    } else {
      manufacturingDate = rawMfg;
      recordField('manufacturingDate');
    }
  }

  // Parse expiry date
  let expiryDate: string | undefined;
  let expiryDateDB: string | undefined;
  const rawExp = rawFieldsMap.get('expiryDate');
  if (rawExp) {
    const expParsed = normalizeManufacturerDate(rawExp);
    if (expParsed) {
      expiryDate = expParsed.uiDate; // DD/MM/YYYY
      expiryDateDB = expParsed.dbDate; // YYYY-MM-DD
      recordField('expiryDate');
      recordField('expiryDateDB');
    } else {
      expiryDate = rawExp;
      recordField('expiryDate');
    }
  }

  const productName = rawFieldsMap.get('productName');
  if (productName) recordField('productName');

  const manufacturer = rawFieldsMap.get('manufacturer');
  if (manufacturer) recordField('manufacturer');

  const gtin = rawFieldsMap.get('gtin');
  if (gtin) {
    recordField('gtin');
    recordField('barcode');
  }

  const rawSize = rawFieldsMap.get('packSize');
  let sizeVal: number | undefined;
  let sizeUnit: string | undefined;
  let packSize: string | undefined;
  if (rawSize) {
    const parsedSize = parseProductSize(rawSize);
    sizeVal = parsedSize.sizeValue ?? undefined;
    sizeUnit = parsedSize.sizeUnit ?? undefined;
    packSize = rawSize;
    recordField('packSize');
    if (sizeVal !== undefined) recordField('sizeValue');
    if (sizeUnit) recordField('sizeUnit');
  }

  const rawMrp = rawFieldsMap.get('mrp');
  const mrp = rawMrp && !isNaN(Number(rawMrp.replace(/[^0-9.]/g, '')))
    ? Number(rawMrp.replace(/[^0-9.]/g, ''))
    : undefined;
  if (mrp !== undefined) recordField('mrp');

  const hsnCode = rawFieldsMap.get('hsnCode');
  if (hsnCode) recordField('hsnCode');

  const rawGst = rawFieldsMap.get('gstRate');
  const gstRate = rawGst && !isNaN(Number(rawGst.replace(/[^0-9.]/g, '')))
    ? Number(rawGst.replace(/[^0-9.]/g, ''))
    : undefined;
  if (gstRate !== undefined) recordField('gstRate');

  return {
    rawValue: trimmed,
    format: format !== 'UNKNOWN' ? format : 'QR_CODE',
    source: 'structured_qr',
    sourceUrl: detectedUrl,
    gtin,
    barcode: gtin,
    productName,
    manufacturer,
    brand: manufacturer,
    batchNumber,
    serialNumber,
    manufacturingDate,
    expiryDate,
    expiryDateDB,
    packSize,
    sizeValue: sizeVal,
    sizeUnit,
    mrp,
    hsnCode,
    gstRate,
    detectedFields,
    fieldSources,
  };
}
