import { GS1ParsedData } from './types';

/**
 * GS1 Application Identifier (AI) Definitions
 * Format:
 *  - length: fixed length (number) or undefined if variable
 *  - maxLength: maximum length for variable-length fields
 *  - isDate: whether the format is YYMMDD
 */
interface GS1AIDefinition {
  ai: string;
  title: string;
  length?: number; // Fixed length if defined
  maxLength?: number; // Max length if variable
  isVariable: boolean;
  isDate?: boolean;
}

const GS1_AI_MAP: Record<string, GS1AIDefinition> = {
  '01': { ai: '01', title: 'GTIN', length: 14, isVariable: false },
  '02': { ai: '02', title: 'Content GTIN', length: 14, isVariable: false },
  '10': { ai: '10', title: 'Batch/Lot', maxLength: 20, isVariable: true },
  '11': { ai: '11', title: 'Production Date', length: 6, isVariable: false, isDate: true },
  '12': { ai: '12', title: 'Due Date', length: 6, isVariable: false, isDate: true },
  '13': { ai: '13', title: 'Packaging Date', length: 6, isVariable: false, isDate: true },
  '15': { ai: '15', title: 'Best Before Date', length: 6, isVariable: false, isDate: true },
  '17': { ai: '17', title: 'Expiry Date', length: 6, isVariable: false, isDate: true },
  '21': { ai: '21', title: 'Serial Number', maxLength: 20, isVariable: true },
  '30': { ai: '30', title: 'Variable Count', maxLength: 8, isVariable: true },
  '240': { ai: '240', title: 'Additional Product ID', maxLength: 30, isVariable: true },
  '241': { ai: '241', title: 'Customer Part Number', maxLength: 30, isVariable: true },
};

/**
 * Parses GS1 YYMMDD date format into ISO (YYYY-MM-DD) and UI (DD/MM/YYYY) formats.
 * According to the GS1 standard:
 * - Century rule: YY 51-99 -> 19YY, YY 00-50 -> 20YY
 * - Day '00' rule: When DD = '00', it represents the LAST DAY of the specified month.
 */
export function parseGS1Date(yymmdd: string): { isoDate: string; uiDate: string } | null {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) {
    return null;
  }

  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  let dd = parseInt(yymmdd.slice(4, 6), 10);

  if (mm < 1 || mm > 12) {
    return null;
  }

  const year = yy >= 51 ? 1900 + yy : 2000 + yy;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[mm - 1];

  // GS1 standard: Day '00' means the last day of the month
  if (dd === 0) {
    dd = maxDay;
  } else if (dd < 1 || dd > maxDay) {
    return null;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(mm)}-${pad(dd)}`;
  const uiDate = `${pad(dd)}/${pad(mm)}/${year}`;

  return { isoDate, uiDate };
}

/**
 * Cleans GTIN by removing leading filler zeros if appropriate while preserving standard lengths.
 */
export function normalizeGTIN(gtin: string): string {
  return (gtin || '').trim();
}

/**
 * Determines whether raw barcode string is likely a GS1 barcode.
 */
export function isGS1Barcode(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();

  // Format 1: Bracketed format, e.g. (01)08901234567890(10)...
  if (/^\(\d{2,4}\)/.test(trimmed)) {
    return true;
  }

  // Format 2: Starts with AI '01' followed by 14 digits and more data or FNC1
  if (/^01\d{14}/.test(trimmed) && trimmed.length > 14) {
    return true;
  }

  // Format 3: Contains FNC1 character (\x1D or \u001D) with AI prefix
  if (trimmed.includes('\x1D') || trimmed.includes('\u001D')) {
    return true;
  }

  return false;
}

/**
 * Parses bracketed GS1 barcode: e.g. (01)08901234567890(10)BATCH123(17)280630(21)SERIAL456
 */
function parseBracketedGS1(raw: string): GS1ParsedData | null {
  const regex = /\((\d{2,4})\)([^()]+)/g;
  let match: RegExpExecArray | null;
  const rawPairs: Array<{ ai: string; title: string; rawValue: string; value: any }> = [];

  let gtin: string | undefined;
  let batchNumber: string | undefined;
  let serialNumber: string | undefined;
  let productionDate: string | undefined;
  let expiryDate: string | undefined;
  let expiryDateDB: string | undefined;
  let quantity: number | undefined;

  let hasValidAI = false;

  while ((match = regex.exec(raw)) !== null) {
    const ai = match[1];
    const val = match[2].trim();
    const def = GS1_AI_MAP[ai];

    if (def) {
      hasValidAI = true;
      let parsedValue: any = val;

      if (ai === '01' || ai === '02') {
        gtin = normalizeGTIN(val);
        parsedValue = gtin;
      } else if (ai === '10') {
        batchNumber = val;
      } else if (ai === '21') {
        serialNumber = val;
      } else if (ai === '11') {
        const dateParsed = parseGS1Date(val);
        if (dateParsed) {
          productionDate = dateParsed.isoDate;
          parsedValue = dateParsed.isoDate;
        }
      } else if (ai === '17' || ai === '15') {
        const dateParsed = parseGS1Date(val);
        if (dateParsed) {
          expiryDate = dateParsed.uiDate;
          expiryDateDB = dateParsed.isoDate;
          parsedValue = dateParsed.uiDate;
        }
      } else if (ai === '30') {
        const count = parseInt(val, 10);
        if (!isNaN(count)) {
          quantity = count;
          parsedValue = count;
        }
      }

      rawPairs.push({
        ai,
        title: def.title,
        rawValue: val,
        value: parsedValue,
      });
    } else {
      rawPairs.push({
        ai,
        title: `AI(${ai})`,
        rawValue: val,
        value: val,
      });
    }
  }

  if (!hasValidAI) {
    return null;
  }

  return {
    gtin,
    batchNumber,
    serialNumber,
    productionDate,
    expiryDate,
    expiryDateDB,
    quantity,
    rawPairs,
  };
}

/**
 * Parses raw GS1 element string stream without brackets, handling fixed lengths and FNC1 separators.
 * e.g., "010890123456789010BATCH123\x1D17280630\x1D21SERIAL1"
 */
function parseRawGS1Stream(raw: string): GS1ParsedData | null {
  // Strip initial standard prefixes if present (e.g. ]C1, ]e0, ]d2)
  let stream = raw.replace(/^\][a-zA-Z0-9]{2}/, '').trim();

  // Normalize group separator
  const GS = '\x1D';
  stream = stream.replace(/\u001D/g, GS);

  const rawPairs: Array<{ ai: string; title: string; rawValue: string; value: any }> = [];

  let gtin: string | undefined;
  let batchNumber: string | undefined;
  let serialNumber: string | undefined;
  let productionDate: string | undefined;
  let expiryDate: string | undefined;
  let expiryDateDB: string | undefined;
  let quantity: number | undefined;

  let pos = 0;
  let foundAny = false;

  while (pos < stream.length) {
    // Skip any stray GS delimiters
    if (stream[pos] === GS) {
      pos++;
      continue;
    }

    let matchedAI: string | null = null;
    let def: GS1AIDefinition | null = null;

    // Try 3-digit AIs first, then 2-digit
    for (const testAI of ['240', '241', '01', '02', '10', '11', '12', '13', '15', '17', '21', '30']) {
      if (stream.startsWith(testAI, pos)) {
        matchedAI = testAI;
        def = GS1_AI_MAP[testAI];
        break;
      }
    }

    if (!matchedAI || !def) {
      // Cannot match a valid Application Identifier at this position
      break;
    }

    pos += matchedAI.length;
    let val = '';

    if (!def.isVariable && def.length) {
      // Fixed length field
      if (pos + def.length > stream.length) {
        // Not enough characters left for fixed field
        break;
      }
      val = stream.slice(pos, pos + def.length);
      pos += def.length;
    } else {
      // Variable length field: read until next GS or end of string, capped at maxLength
      const maxL = def.maxLength || 30;
      let endPos = pos;
      while (endPos < stream.length && stream[endPos] !== GS && endPos - pos < maxL) {
        endPos++;
      }
      val = stream.slice(pos, endPos);
      pos = endPos;
      if (pos < stream.length && stream[pos] === GS) {
        pos++; // Consume delimiter
      }
    }

    if (val) {
      foundAny = true;
      let parsedValue: any = val;

      if (matchedAI === '01' || matchedAI === '02') {
        gtin = normalizeGTIN(val);
        parsedValue = gtin;
      } else if (matchedAI === '10') {
        batchNumber = val;
      } else if (matchedAI === '21') {
        serialNumber = val;
      } else if (matchedAI === '11') {
        const dateParsed = parseGS1Date(val);
        if (dateParsed) {
          productionDate = dateParsed.isoDate;
          parsedValue = dateParsed.isoDate;
        }
      } else if (matchedAI === '17' || matchedAI === '15') {
        const dateParsed = parseGS1Date(val);
        if (dateParsed) {
          expiryDate = dateParsed.uiDate;
          expiryDateDB = dateParsed.isoDate;
          parsedValue = dateParsed.uiDate;
        }
      } else if (matchedAI === '30') {
        const count = parseInt(val, 10);
        if (!isNaN(count)) {
          quantity = count;
          parsedValue = count;
        }
      }

      rawPairs.push({
        ai: matchedAI,
        title: def.title,
        rawValue: val,
        value: parsedValue,
      });
    }
  }

  if (!foundAny) {
    return null;
  }

  return {
    gtin,
    batchNumber,
    serialNumber,
    productionDate,
    expiryDate,
    expiryDateDB,
    quantity,
    rawPairs,
  };
}

/**
 * Main GS1 Parser entry point.
 * Robustly handles bracketed syntax and raw stream syntax with FNC1 separators.
 */
export function parseGS1Barcode(raw: string): GS1ParsedData | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  if (trimmed.includes('(') && trimmed.includes(')')) {
    const bracketed = parseBracketedGS1(trimmed);
    if (bracketed && (bracketed.gtin || bracketed.batchNumber || bracketed.expiryDate || bracketed.serialNumber)) {
      return bracketed;
    }
  }

  return parseRawGS1Stream(trimmed);
}
