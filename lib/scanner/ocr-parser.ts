import { ProductScanResult } from './types';
import { normalizeProductSize, isFormulationConcentration } from './size-normalizer';

// Known agricultural chemical formulations
const FORMULATION_TYPES = ['WG', 'WP', 'EC', 'SC', 'SL', 'SP', 'FS', 'CS', 'GR', 'SG', 'OD', 'EW', 'ME', 'ZC', 'DF', 'WDG', 'WS', 'AS', 'ULV', 'FL', 'DP'];

// Known prominent agricultural manufacturers in India
const KNOWN_MANUFACTURERS = [
  'Syngenta',
  'Bayer',
  'UPL',
  'Corteva',
  'BASF',
  'FMC',
  'Adama',
  'PI Industries',
  'Dhanuka',
  'Rallis',
  'IFFCO',
  'Coromandel',
  'Tata Chemicals',
  'Godrej Agrovet',
  'Indofil',
  'Gharda',
  'Sumitomo',
  'Excel Crop Care',
  'Nagarjuna',
  'Crystal Crop',
  'Mahyco',
  'Kaveri Seeds',
  'Rasi Seeds',
  'Ankur Seeds',
  'Nuziveedu Seeds',
];

/**
 * Parses month names (JAN, FEB, MAR...) or numeric date strings into DD/MM/YYYY and YYYY-MM-DD.
 */
function parseDateString(raw: string): { uiDate: string; isoDate: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Pattern 1: 29 JAN 2026 or 29-JAN-2026 or 29/JAN/2026
  const textMonthMatch = trimmed.match(/^(\d{1,2})[\s\-\/\.](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s\-\/\.](\d{4}|\d{2})$/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthStr = textMonthMatch[2].toUpperCase().slice(0, 3);
    const monthIdx = monthNames.indexOf(monthStr);
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year += 2000;

    if (monthIdx !== -1 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const mm = pad(monthIdx + 1);
      const dd = pad(day);
      return {
        uiDate: `${dd}/${mm}/${year}`,
        isoDate: `${year}-${mm}-${dd}`,
      };
    }
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY
  const numMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})$/);
  if (numMatch) {
    const day = parseInt(numMatch[1], 10);
    const month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const mm = pad(month);
      const dd = pad(day);
      return {
        uiDate: `${dd}/${mm}/${year}`,
        isoDate: `${year}-${mm}-${dd}`,
      };
    }
  }

  // Pattern 3: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const mm = pad(month);
      const dd = pad(day);
      return {
        uiDate: `${dd}/${mm}/${year}`,
        isoDate: `${year}-${mm}-${dd}`,
      };
    }
  }

  return null;
}

/**
 * Extracts structured product fields from raw OCR recognized text.
 */
export function parseProductLabelOcr(rawText: string): ProductScanResult {
  const result: ProductScanResult = {
    rawValue: rawText || '',
    format: 'OCR_LABEL',
    source: 'ocr',
    detectedFields: [],
    confidence: {},
    fieldSources: {},
  };

  if (!rawText || typeof rawText !== 'string') {
    return result;
  }

  const detectedFields: string[] = [];
  const confidence: Record<string, number> = {};
  const fieldSources: Record<string, 'ocr'> = {};

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fullText = lines.join(' ');

  // 1. MRP Extraction (e.g., "Maximum Retail Price Rs. 1569.00", "MRP ₹1569.00", "M.R.P. : 1569.00")
  const mrpMatch = fullText.match(/(?:maximum\s*retail\s*price|m\.?r\.?p\.?)\s*(?:incl\.?\s*of\s*all\s*taxes)?\s*[:=-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
  if (mrpMatch) {
    const mrpVal = parseFloat(mrpMatch[1].replace(/,/g, ''));
    if (!isNaN(mrpVal) && mrpVal > 0) {
      result.mrp = mrpVal;
      detectedFields.push('mrp');
      confidence['mrp'] = 0.95;
      fieldSources['mrp'] = 'ocr';
    }
  }

  // 2. Unit Sale Price Extraction (e.g., "Unit Sale Price per g Rs. 26.15/g", "Unit Sale Price ₹26.15/g")
  const uspMatch = fullText.match(/unit\s*sale\s*price(?:\s*per\s*[a-z]+)?\s*[:=-]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)(?:g|gm|kg|ml|l|ltr|pc|tablet|unit)/i);
  if (uspMatch) {
    const uspVal = parseFloat(uspMatch[1].replace(/,/g, ''));
    if (!isNaN(uspVal) && uspVal > 0) {
      result.unitSalePrice = uspVal;
      detectedFields.push('unitSalePrice');
      confidence['unitSalePrice'] = 0.9;
      fieldSources['unitSalePrice'] = 'ocr';
    }
  }

  // 3. Batch / Lot Number Extraction (e.g., "Batch No. SPL6A20014", "B.No. SPL6A20014", "Lot No: 12345")
  const batchMatch = fullText.match(/(?:batch\s*(?:no\.?|number|#)?|b\.?\s*no\.?|lot\s*(?:no\.?|number)?)\s*[:=-]?\s*([A-Za-z0-9\-_]{4,25})/i);
  if (batchMatch) {
    const bVal = batchMatch[1].trim();
    // Exclude if it looks like a date or common keyword
    if (!/^(date|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{2}\/\d{2})/i.test(bVal)) {
      result.batchNumber = bVal;
      detectedFields.push('batchNumber');
      confidence['batchNumber'] = 0.9;
      fieldSources['batchNumber'] = 'ocr';
    }
  }

  // 4. Manufacturing Date Extraction (e.g., "Mfg. Date 29 JAN 2026", "Date of Mfg: 27/07/2025", "MFD: 2025-07-27")
  const mfgMatch = fullText.match(/(?:mfg\.?\s*date|mfd\.?|date\s*of\s*mfg\.?|manufacturing\s*date)\s*[:=-]?\s*(\d{1,2}[\s\-\/\.][A-Za-z]{3,9}[\s\-\/\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
  if (mfgMatch) {
    const parsed = parseDateString(mfgMatch[1]);
    if (parsed) {
      result.manufacturingDate = parsed.isoDate;
      detectedFields.push('manufacturingDate');
      confidence['manufacturingDate'] = 0.9;
      fieldSources['manufacturingDate'] = 'ocr';
    }
  }

  // 5. Expiry Date Extraction (e.g., "Expiry Date 28 JAN 2028", "Exp Date: 26/07/2027", "Best Before: 28 JAN 2028")
  const expMatch = fullText.match(/(?:expiry\s*date|exp\.?\s*date|use\s*before|best\s*before|expiration\s*date)\s*[:=-]?\s*(\d{1,2}[\s\-\/\.][A-Za-z]{3,9}[\s\-\/\.]\d{2,4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
  if (expMatch) {
    const parsed = parseDateString(expMatch[1]);
    if (parsed) {
      result.expiryDate = parsed.uiDate;
      result.expiryDateDB = parsed.isoDate;
      detectedFields.push('expiryDate', 'expiryDateDB');
      confidence['expiryDate'] = 0.9;
      confidence['expiryDateDB'] = 0.9;
      fieldSources['expiryDate'] = 'ocr';
      fieldSources['expiryDateDB'] = 'ocr';
    }
  }

  // 6. Pack Size Extraction (e.g. "60 g", "1 kg", "500 ml", "Net Content: 60 g")
  // Search line by line to avoid confusing with formulation lines
  for (const line of lines) {
    if (!isFormulationConcentration(line)) {
      const parsedSize = normalizeProductSize(line);
      if (parsedSize) {
        result.sizeValue = parsedSize.sizeValue;
        result.sizeUnit = parsedSize.sizeUnit;
        result.packSize = parsedSize.packSize;
        result.size = parsedSize.packSize;
        detectedFields.push('sizeValue', 'sizeUnit', 'packSize');
        confidence['packSize'] = 0.9;
        fieldSources['packSize'] = 'ocr';
        fieldSources['sizeValue'] = 'ocr';
        fieldSources['sizeUnit'] = 'ocr';
        break;
      }
    }
  }

  // 7. Composition & Active Ingredients Extraction
  // Look for lines containing active ingredient patterns (e.g. "Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG")
  const compositionLines: string[] = [];
  const activeIngredients: string[] = [];

  for (const line of lines) {
    if (isFormulationConcentration(line)) {
      compositionLines.push(line);

      // Split multiple ingredients separated by '+' or ',' or 'and'
      const parts = line.split(/\s*(?:\+|\band\b)\s*/i);
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart && isFormulationConcentration(trimmedPart)) {
          activeIngredients.push(trimmedPart);
        }
      }
    }
  }

  if (compositionLines.length > 0) {
    result.composition = compositionLines.join(' ');
    detectedFields.push('composition');
    confidence['composition'] = 0.85;
    fieldSources['composition'] = 'ocr';
  }

  if (activeIngredients.length > 0) {
    result.activeIngredients = activeIngredients;
    detectedFields.push('activeIngredients');
    confidence['activeIngredients'] = 0.85;
  }

  // Detect Formulation (WG, EC, SC, SL, WP...)
  for (const formType of FORMULATION_TYPES) {
    const formRegex = new RegExp(`\\b${formType}\\b`, 'i');
    if (result.composition && formRegex.test(result.composition)) {
      result.formulation = formType;
      detectedFields.push('formulation');
      confidence['formulation'] = 0.85;
      break;
    }
  }

  // 8. Manufacturer Extraction
  // Priority A: Explicit "Manufactured by:", "Mfd by:"
  const mfgExplicitMatch = fullText.match(/(?:manufactured\s*by|mfd\s*by|marketed\s*by)\s*[:=-]?\s*([A-Za-z0-9\s,\.\-&]{3,40})/i);
  if (mfgExplicitMatch) {
    const mfgName = mfgExplicitMatch[1].trim().replace(/\s+(?:pvt\.?|ltd\.?|limited|india).*$/i, '');
    result.manufacturer = mfgName;
    detectedFields.push('manufacturer');
    confidence['manufacturer'] = 0.9;
    fieldSources['manufacturer'] = 'ocr';
  } else {
    // Priority B: Known Indian agricultural manufacturers in text
    for (const knownMfg of KNOWN_MANUFACTURERS) {
      const mfgRegex = new RegExp(`\\b${knownMfg}\\b`, 'i');
      if (mfgRegex.test(fullText)) {
        result.manufacturer = knownMfg;
        detectedFields.push('manufacturer');
        confidence['manufacturer'] = 0.85;
        fieldSources['manufacturer'] = 'ocr';
        break;
      }
    }
  }

  // 9. Product Name / Brand Extraction
  // Look for the primary brand name. Usually the first short non-numeric line that isn't a date/batch/manufacturer.
  for (const line of lines) {
    // Skip if line contains numbers, formulations, known manufacturers, or dates
    if (
      line.length >= 2 &&
      line.length <= 40 &&
      !isFormulationConcentration(line) &&
      !/^(mrp|maximum|rs\.?|₹|batch|mfg|exp|date|use|best|hsn|gst|net|lic|reg|pack|unit)/i.test(line) &&
      !KNOWN_MANUFACTURERS.some((m) => new RegExp(`^${m}$`, 'i').test(line))
    ) {
      result.productName = line;
      result.brand = line;
      detectedFields.push('productName', 'brand');
      confidence['productName'] = 0.8;
      confidence['brand'] = 0.8;
      fieldSources['productName'] = 'ocr';
      fieldSources['brand'] = 'ocr';
      break;
    }
  }

  // 10. HSN Extraction (ONLY if explicitly labeled)
  const hsnMatch = fullText.match(/(?:hsn\s*(?:code)?|h\.s\.n\.?)\s*[:=-]?\s*(\d{4,8})/i);
  if (hsnMatch) {
    result.hsnCode = hsnMatch[1].trim();
    detectedFields.push('hsnCode');
    confidence['hsnCode'] = 0.9;
    fieldSources['hsnCode'] = 'ocr';
  }

  // 11. GST Extraction (ONLY if explicitly labeled)
  const gstMatch = fullText.match(/(?:gst\s*(?:rate)?|g\.s\.t\.?)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (gstMatch) {
    const gstVal = parseFloat(gstMatch[1]);
    if (!isNaN(gstVal) && gstVal >= 0 && gstVal <= 28) {
      result.gstRate = gstVal;
      detectedFields.push('gstRate');
      confidence['gstRate'] = 0.9;
      fieldSources['gstRate'] = 'ocr';
    }
  }

  // 12. Registration Number & Licence Number
  const regMatch = fullText.match(/(?:cib&rc\s*reg\.?\s*no\.?|regn?\.?\s*no\.?|registration\s*no\.?)\s*[:=-]?\s*([A-Za-z0-9\/\-_()]{4,35})/i);
  if (regMatch) {
    result.registrationNumber = regMatch[1].trim();
    detectedFields.push('registrationNumber');
    confidence['registrationNumber'] = 0.9;
    fieldSources['registrationNumber'] = 'ocr';
  }

  const licMatch = fullText.match(/(?:mfg\.?\s*lic\.?\s*no\.?|licence\s*no\.?|lic\.?\s*no\.?)\s*[:=-]?\s*([A-Za-z0-9\/\-_()]{4,35})/i);
  if (licMatch) {
    result.manufacturingLicenceNumber = licMatch[1].trim();
    detectedFields.push('manufacturingLicenceNumber');
    confidence['manufacturingLicenceNumber'] = 0.9;
    fieldSources['manufacturingLicenceNumber'] = 'ocr';
  }

  // 13. Country of Origin
  const originMatch = fullText.match(/(?:country\s*of\s*origin|made\s*in)\s*[:=-]?\s*([A-Za-z\s]{3,20})/i);
  if (originMatch) {
    result.countryOfOrigin = originMatch[1].trim();
    detectedFields.push('countryOfOrigin');
    confidence['countryOfOrigin'] = 0.95;
  }

  result.detectedFields = Array.from(new Set(detectedFields));
  result.confidence = confidence;
  result.fieldSources = fieldSources;

  return result;
}
