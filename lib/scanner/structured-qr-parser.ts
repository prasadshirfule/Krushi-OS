import { ProductScanResult } from './types';
import { parseProductSize, formatToDDMMYYYY, formatDDMMYYYYtoDB, validateExpiryDate } from '@/lib/validations';

/**
 * Sanitizes a string input safely, removing dangerous HTML/script tags and control characters.
 */
function sanitizeString(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Strip potential HTML tags and control characters
  return str.replace(/<[^>]*>?/gm, '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

/**
 * Normalizes date to UI display (DD/MM/YYYY) and DB storage (YYYY-MM-DD)
 */
function normalizeStructuredDate(val: any): { uiDate: string; dbDate: string } | null {
  if (!val) return null;
  const str = sanitizeString(val);
  if (!str) return null;

  // Handle DD/MM/YYYY
  if (/^(\d{2})\/(\d{2})\/(\d{4})$/.test(str)) {
    const dbDate = formatDDMMYYYYtoDB(str);
    if (dbDate) {
      return { uiDate: str, dbDate };
    }
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const uiDate = formatToDDMMYYYY(str);
    if (uiDate) {
      return { uiDate, dbDate: str };
    }
  }

  // Handle YYMMDD
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
        const pad = (n: number) => String(n).padStart(2, '0');
        return {
          uiDate: `${pad(dd)}/${pad(mm)}/${year}`,
          dbDate: `${year}-${pad(mm)}-${pad(dd)}`,
        };
      }
    }
  }

  // Try standard Date parsing as fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const uiDate = formatToDDMMYYYY(parsed);
    const dbDate = parsed.toISOString().split('T')[0];
    return { uiDate, dbDate };
  }

  return null;
}

/**
 * Attempts to parse JSON formatted structured QR content.
 */
function parseJsonQr(raw: string): Partial<ProductScanResult> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  // Case-insensitive key lookup helper
  const getField = (...keys: string[]): any => {
    for (const k of keys) {
      for (const objKey of Object.keys(parsed)) {
        if (objKey.toLowerCase() === k.toLowerCase()) {
          return parsed[objKey];
        }
      }
    }
    return undefined;
  };

  const gtin = sanitizeString(getField('gtin', 'gtin14', 'barcode', 'code', 'product_code'));
  const productName = sanitizeString(getField('productName', 'name', 'product_name', 'product', 'title'));
  const manufacturer = sanitizeString(getField('manufacturer', 'brand', 'company', 'brand_name', 'mfg'));
  const batchNumber = sanitizeString(getField('batch', 'batchNumber', 'batch_number', 'lot', 'lot_number', 'batch_no'));
  
  const rawExpiry = getField('expiry', 'expiryDate', 'expiry_date', 'exp', 'exp_date', 'val');
  const dateObj = normalizeStructuredDate(rawExpiry);
  
  const rawMfg = getField('manufacturingDate', 'manufacturing_date', 'mfgDate', 'mfd', 'mfg_date');
  const mfgDateObj = normalizeStructuredDate(rawMfg);

  const hsnCode = sanitizeString(getField('hsn', 'hsnCode', 'hsn_code'));
  
  const rawGst = getField('gst', 'gstRate', 'gst_rate', 'tax');
  const gstRate = rawGst !== undefined && rawGst !== '' && !isNaN(Number(rawGst)) ? Number(rawGst) : undefined;

  const rawSize = getField('size', 'packSize', 'pack_size', 'volume', 'weight');
  let sizeStr = sanitizeString(rawSize);
  let sizeVal: number | null = null;
  let sizeUnit: string | null = null;

  if (sizeStr) {
    const parsedSize = parseProductSize(sizeStr);
    sizeVal = parsedSize.sizeValue;
    sizeUnit = parsedSize.sizeUnit;
  }

  const rawQty = getField('quantity', 'qty', 'count', 'pieces');
  const quantity = rawQty !== undefined && rawQty !== '' && !isNaN(Number(rawQty)) ? Number(rawQty) : undefined;

  const rawPurchase = getField('purchasePrice', 'purchase_price', 'cost');
  const purchasePrice = rawPurchase !== undefined && rawPurchase !== '' && !isNaN(Number(rawPurchase)) ? Number(rawPurchase) : undefined;

  const rawSelling = getField('sellingPrice', 'selling_price', 'price', 'mrp');
  const sellingPrice = rawSelling !== undefined && rawSelling !== '' && !isNaN(Number(rawSelling)) ? Number(rawSelling) : undefined;

  const hasAnyProductData = Boolean(
    gtin || productName || manufacturer || batchNumber || dateObj || hsnCode || gstRate !== undefined || sizeStr
  );

  if (!hasAnyProductData) {
    return null;
  }

  return {
    gtin: gtin || undefined,
    barcode: gtin || undefined,
    productName: productName || undefined,
    manufacturer: manufacturer || undefined,
    batchNumber: batchNumber || undefined,
    expiryDate: dateObj?.uiDate || undefined,
    expiryDateDB: dateObj?.dbDate || undefined,
    manufacturingDate: mfgDateObj?.uiDate || mfgDateObj?.dbDate || undefined,
    hsnCode: hsnCode || undefined,
    gstRate,
    size: sizeStr || undefined,
    sizeValue: sizeVal ?? undefined,
    sizeUnit: sizeUnit || undefined,
    quantity,
    purchasePrice,
    sellingPrice,
  };
}

/**
 * Attempts to parse Key-Value structured QR content (e.g. key=value or key: value on multiple lines).
 */
function parseKeyValueQr(raw: string): Partial<ProductScanResult> | null {
  const lines = raw.split(/[\r\n;]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return null;
  }

  const map: Record<string, string> = {};
  let validPairsCount = 0;

  for (const line of lines) {
    const match = line.match(/^([^:=]+)[:=](.*)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/[\s_-]/g, '');
      const value = sanitizeString(match[2]);
      if (key && value) {
        map[key] = value;
        validPairsCount++;
      }
    }
  }

  if (validPairsCount < 2) {
    return null;
  }

  const gtin = map['gtin'] || map['barcode'] || map['code'] || map['productcode'];
  const productName = map['product'] || map['productname'] || map['name'] || map['item'];
  const manufacturer = map['manufacturer'] || map['brand'] || map['company'] || map['mfg'];
  const batchNumber = map['batch'] || map['batchno'] || map['batchnumber'] || map['lot'] || map['lotno'];
  
  const rawExpiry = map['expiry'] || map['expirydate'] || map['exp'] || map['expdate'];
  const dateObj = normalizeStructuredDate(rawExpiry);

  const rawMfg = map['mfgdate'] || map['manufacturingdate'] || map['mfd'];
  const mfgDateObj = normalizeStructuredDate(rawMfg);

  const hsnCode = map['hsn'] || map['hsncode'];
  const gstRate = map['gst'] || map['gstrate'] || map['tax'] ? Number(map['gst'] || map['gstrate'] || map['tax']) : undefined;

  const rawSize = map['size'] || map['packsize'] || map['volume'] || map['weight'];
  let sizeVal: number | null = null;
  let sizeUnit: string | null = null;
  if (rawSize) {
    const parsedSize = parseProductSize(rawSize);
    sizeVal = parsedSize.sizeValue;
    sizeUnit = parsedSize.sizeUnit;
  }

  const rawQty = map['qty'] || map['quantity'] || map['count'];
  const quantity = rawQty && !isNaN(Number(rawQty)) ? Number(rawQty) : undefined;

  const hasAnyProductData = Boolean(
    gtin || productName || manufacturer || batchNumber || dateObj || hsnCode || (gstRate !== undefined && !isNaN(gstRate)) || rawSize
  );

  if (!hasAnyProductData) {
    return null;
  }

  return {
    gtin,
    barcode: gtin,
    productName,
    manufacturer,
    batchNumber,
    expiryDate: dateObj?.uiDate,
    expiryDateDB: dateObj?.dbDate,
    manufacturingDate: mfgDateObj?.uiDate || mfgDateObj?.dbDate,
    hsnCode,
    gstRate: gstRate && !isNaN(gstRate) ? gstRate : undefined,
    size: rawSize,
    sizeValue: sizeVal ?? undefined,
    sizeUnit: sizeUnit || undefined,
    quantity,
  };
}

/**
 * Main safe structured QR parser entry point.
 */
export function parseStructuredQR(raw: string): Partial<ProductScanResult> | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Try JSON parser first
  const jsonResult = parseJsonQr(trimmed);
  if (jsonResult) {
    return jsonResult;
  }

  // Try Key-Value parser
  return parseKeyValueQr(trimmed);
}
