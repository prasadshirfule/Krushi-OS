/**
 * KRUSHI OS — Purchase Bill & Invoice Parser Engine
 * 
 * Extracts structured purchase information from:
 * 1. QR Payloads (e-Invoice QR, GST JSON, key-value, structured text)
 * 2. OCR Raw Text (Supplier bills, Tax Invoices, cash memos, wholesale challans)
 * 
 * Provides conservative product matching against the existing shop catalog.
 * NEVER auto-saves to database. Output is strictly for user review & editing.
 */

export interface ExtractedPurchaseItem {
  rawName: string;
  matchedProductId?: string;
  matchedProductName?: string;
  isMatched: boolean;
  sku?: string;
  unit: string;
  batchNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
  gstRate: number;
  hsnCode?: string;
  lineTotal?: number;
}

export interface ExtractedSupplier {
  id?: string;
  name: string;
  company?: string;
  gstin?: string;
  phone?: string;
  address?: string;
  isMatched: boolean;
}

export interface PurchaseDraftResult {
  source: 'qr' | 'ocr' | 'hybrid';
  rawQrPayload?: string;
  rawOcrText?: string;
  supplier?: ExtractedSupplier;
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax?: number;
  grandTotal?: number;
  items: ExtractedPurchaseItem[];
  uncertainFields: string[];
}

// ─────────────────────────────────────────────────────────
// 1. QR INVOICE PARSER
// ─────────────────────────────────────────────────────────

/**
 * Attempts to parse an invoice QR payload (GST e-Invoice, JSON, or key-value).
 */
export function parseInvoiceQrPayload(qrText: string): Partial<PurchaseDraftResult> | null {
  if (!qrText || !qrText.trim()) return null;
  const raw = qrText.trim();

  // A. JSON QR payload
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      return parseJsonInvoiceQr(parsed, raw);
    } catch {
      // Fall through to other formats
    }
  }

  // B. GST e-Invoice JWT / Signed QR
  // Format: header.payload.signature where payload is base64 encoded JSON
  if (raw.split('.').length === 3 && (raw.startsWith('eyJ') || raw.includes('.'))) {
    try {
      const parts = raw.split('.');
      const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const parsed = JSON.parse(payloadJson);
      return parseGstEInvoicePayload(parsed, raw);
    } catch {
      // Fall through
    }
  }

  // C. URL-based Invoice QR
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const params = url.searchParams;
      let supplierName = params.get('supplier') || params.get('seller') || '';
      let gstin = params.get('gstin') || params.get('seller') || params.get('sellerGstin') || '';
      if (/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/i.test(gstin)) {
        gstin = gstin.toUpperCase();
      }
      const invoiceNo = params.get('inv') || params.get('invoice') || params.get('docNo') || params.get('bill') || '';
      const invoiceDate = normalizeDateString(params.get('date') || params.get('docDate') || params.get('dt') || '');
      const tot = parseFloat(params.get('tot') || params.get('total') || params.get('amount') || '0');

      return {
        source: 'qr',
        rawQrPayload: raw,
        supplier: supplierName || gstin ? {
          name: supplierName || (gstin ? `Supplier (${gstin})` : 'Supplier'),
          gstin: gstin || undefined,
          isMatched: false,
        } : undefined,
        invoiceNumber: invoiceNo || undefined,
        invoiceDate: invoiceDate || undefined,
        grandTotal: tot > 0 ? tot : undefined,
        items: [],
        uncertainFields: [],
      };
    } catch {
      // Fall through
    }
  }

  // D. Key-Value Multi-line / Delimited Invoice QR
  // e.g. INV: INV-01\nDATE: 2026-09-17\nSELLER: ABC AGRO\nGSTIN: 27...
  if (
    /(\bINV(?:OICE)?\b|\bGSTIN\b|\bSELLER\b|\bSUPPLIER\b|\bTOTAL\b|\bDOC\b)/i.test(raw) &&
    (raw.includes('\n') || raw.includes('|') || raw.includes(';') || raw.includes(',') || raw.includes(':'))
  ) {
    return parseKeyValueInvoiceQr(raw);
  }

  return null;
}

/**
 * Parses a QR code payload from a purchase bill and returns a full PurchaseDraftResult.
 */
export function parsePurchaseBillQr(qrText: string): PurchaseDraftResult {
  const parsed = parseInvoiceQrPayload(qrText);
  if (!parsed) {
    return {
      source: 'qr',
      rawQrPayload: qrText,
      items: [],
      uncertainFields: ['unrecognized_qr_payload'],
    };
  }

  const uncertainFields = [...(parsed.uncertainFields || [])];
  if (!parsed.supplier?.name && !parsed.supplier?.gstin) {
    uncertainFields.push('supplier_not_found');
  }
  if (!parsed.invoiceNumber) {
    uncertainFields.push('invoice_number_not_found');
  }

  return {
    source: 'qr',
    rawQrPayload: qrText,
    supplier: parsed.supplier,
    invoiceNumber: parsed.invoiceNumber,
    invoiceDate: parsed.invoiceDate,
    subtotal: parsed.subtotal,
    cgst: parsed.cgst,
    sgst: parsed.sgst,
    igst: parsed.igst,
    totalTax: parsed.totalTax,
    grandTotal: parsed.grandTotal,
    items: parsed.items || [],
    uncertainFields,
  };
}

function parseJsonInvoiceQr(json: any, raw: string): Partial<PurchaseDraftResult> {
  const supplierName = String(json.supplier || json.seller || json.vendor || json.supplierName || json.SellerGstin || '').trim();
  const gstin = String(json.gstin || json.gstNumber || json.SellerGstin || '').trim();
  const invoiceNo = String(json.invoiceNumber || json.invoiceNo || json.billNo || json.DocNo || '').trim();
  const invoiceDate = normalizeDateString(String(json.invoiceDate || json.date || json.DocDate || ''));

  const rawItems = Array.isArray(json.items) ? json.items : (Array.isArray(json.ItemList) ? json.ItemList : (Array.isArray(json.itemList) ? json.itemList : []));
  const items: ExtractedPurchaseItem[] = rawItems.map((it: any) => {
    const name = String(it.name || it.productName || it.item || it.PrdDesc || it.description || 'Item').trim();
    const qty = Math.max(1, Number(it.quantity ?? it.qty ?? it.Qty ?? 1));
    const rate = Math.max(0, Number(it.rate ?? it.price ?? it.purchasePrice ?? it.UnitPrice ?? it.unitPrice ?? 0));
    const gst = Number(it.gst ?? it.gstRate ?? it.GstRt ?? it.gstRt ?? 0);
    const batch = String(it.batch ?? it.batchNumber ?? it.BatchNo ?? it.Batch ?? '').trim().toUpperCase() || undefined;
    const exp = normalizeDateString(String(it.expiry ?? it.expiryDate ?? it.ExpDate ?? it.expDate ?? ''));
    const hsn = String(it.hsn ?? it.hsnCode ?? it.HsnCd ?? it.hsnCd ?? '').trim() || undefined;
    const unit = String(it.unit ?? it.Unit ?? determineUnitFromName(name));

    return {
      rawName: name,
      isMatched: false,
      unit,
      batchNumber: batch,
      expiryDate: exp || undefined,
      quantity: qty,
      purchasePrice: rate,
      gstRate: gst,
      hsnCode: hsn,
      lineTotal: Number(it.TotAmt ?? it.total ?? (qty * rate * (1 + gst / 100))),
    };
  });

  const total = Number(json.total || json.grandTotal || json.TotInvVal || 0);
  const subtotal = Number(json.subtotal || json.taxableAmount || json.TotTaxVal || 0);

  return {
    source: 'qr',
    rawQrPayload: raw,
    supplier: supplierName || gstin ? {
      name: supplierName || (gstin ? `Supplier (${gstin})` : 'Supplier'),
      gstin: gstin || undefined,
      isMatched: false,
    } : undefined,
    invoiceNumber: invoiceNo || undefined,
    invoiceDate: invoiceDate || undefined,
    subtotal: subtotal > 0 ? subtotal : undefined,
    grandTotal: total > 0 ? total : undefined,
    items,
    uncertainFields: [],
  };
}

function parseGstEInvoicePayload(data: any, raw: string): Partial<PurchaseDraftResult> {
  const sellerGstin = data.SellerGstin || data.sellerGstin || '';
  const docNo = data.DocNo || data.docNo || '';
  const docDate = normalizeDateString(data.DocDate || data.docDate || '');
  const totalVal = Number(data.TotInvVal || data.totInvVal || 0);
  const itemCnt = Number(data.ItemCnt || data.itemCnt || 1);
  const mainHsn = String(data.MainHsnCode || data.mainHsnCode || '');

  const items: ExtractedPurchaseItem[] = [];
  if (Array.isArray(data.ItemList) && data.ItemList.length > 0) {
    for (const it of data.ItemList) {
      const name = String(it.PrdDesc || it.name || 'ITEM').trim();
      const qty = Math.max(1, Number(it.Qty ?? it.quantity ?? 1));
      const rate = Math.max(0, Number(it.UnitPrice ?? it.rate ?? 0));
      const gst = Number(it.GstRt ?? it.gstRate ?? 0);
      const batch = String(it.Batch ?? it.batchNumber ?? it.BatchNo ?? '').trim().toUpperCase() || undefined;
      const exp = normalizeDateString(String(it.ExpDate ?? it.expiryDate ?? ''));

      items.push({
        rawName: name,
        isMatched: false,
        unit: String(it.Unit || determineUnitFromName(name)),
        batchNumber: batch,
        expiryDate: exp || undefined,
        quantity: qty,
        purchasePrice: rate,
        gstRate: gst,
        hsnCode: String(it.HsnCd || mainHsn || ''),
        lineTotal: Number(it.TotAmt || (qty * rate * (1 + gst / 100))),
      });
    }
  }

  return {
    source: 'qr',
    rawQrPayload: raw,
    supplier: sellerGstin ? {
      name: `Supplier (${sellerGstin})`,
      gstin: sellerGstin,
      isMatched: false,
    } : undefined,
    invoiceNumber: docNo || undefined,
    invoiceDate: docDate || undefined,
    grandTotal: totalVal > 0 ? totalVal : undefined,
    items,
    uncertainFields: items.length === 0 ? ['items'] : [],
  };
}

function parseKeyValueInvoiceQr(raw: string): Partial<PurchaseDraftResult> {
  const lines = raw.split(/[\r\n;,|]+/).map(l => l.trim()).filter(Boolean);
  let supplierName = '';
  let gstin = '';
  let invoiceNo = '';
  let invoiceDate = '';
  let grandTotal = 0;
  const items: ExtractedPurchaseItem[] = [];

  for (const line of lines) {
    const kv = line.split(/[:=](.*)/);
    if (kv.length >= 2) {
      const k = kv[0].trim().toUpperCase();
      const v = kv[1].trim();

      if (k.includes('GSTIN') || k === 'GST') {
        gstin = v;
      } else if (k.includes('SUPPLIER') || k.includes('SELLER') || k.includes('VENDOR') || k.includes('M/S')) {
        supplierName = v;
      } else if (k.includes('TOTAL') || k.includes('TOTINVVAL') || k.includes('TOT') || k.includes('AMT') || k.includes('VAL')) {
        const num = parseFloat(v.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) grandTotal = num;
      } else if (k === 'DOCNO' || k === 'INVOICENO' || k === 'INVNO' || k === 'BILLNO' || k === 'INVOICE' || k === 'BILL' || k === 'DOC_NO') {
        invoiceNo = v;
      } else if (k.includes('DATE') || k.includes('DT')) {
        invoiceDate = normalizeDateString(v);
      } else if (k.includes('ITEM') || k.includes('PRD')) {
        // e.g. ITEM: UREA|BATCH123|2028-01-01|10|250|5%
        const parts = v.split(/[,|/]/).map(p => p.trim());
        if (parts.length > 0 && parts[0]) {
          const name = parts[0];
          const batch = parts[1] || undefined;
          const exp = parts[2] ? normalizeDateString(parts[2]) : undefined;
          const qty = parts[3] ? Math.max(1, Number(parts[3]) || 1) : 1;
          const rate = parts[4] ? Math.max(0, Number(parts[4]) || 0) : 0;
          const gst = parts[5] ? parseFloat(parts[5].replace('%', '')) || 0 : 0;

          items.push({
            rawName: name,
            isMatched: false,
            unit: 'Piece',
            batchNumber: batch,
            expiryDate: exp,
            quantity: qty,
            purchasePrice: rate,
            gstRate: gst,
            lineTotal: qty * rate * (1 + gst / 100),
          });
        }
      }
    }
  }

  return {
    source: 'qr',
    rawQrPayload: raw,
    supplier: supplierName || gstin ? {
      name: supplierName || (gstin ? `Supplier (${gstin})` : 'Supplier'),
      gstin: gstin || undefined,
      isMatched: false,
    } : undefined,
    invoiceNumber: invoiceNo || undefined,
    invoiceDate: invoiceDate || undefined,
    grandTotal: grandTotal > 0 ? grandTotal : undefined,
    items,
    uncertainFields: [],
  };
}

// ─────────────────────────────────────────────────────────
// 2. OCR RAW TEXT PARSER FOR SUPPLIER BILLS
// ─────────────────────────────────────────────────────────

/**
 * Parses OCR raw text from a photographed or scanned supplier invoice.
 */
export function parsePurchaseBillOcrText(rawText: string): PurchaseDraftResult {
  const lines = rawText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const uncertainFields: string[] = [];

  // A. Extract GSTIN
  const gstinRegex = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/gi;
  const gstinMatches = rawText.match(gstinRegex);
  const supplierGstin = gstinMatches && gstinMatches.length > 0 ? gstinMatches[0].toUpperCase() : undefined;

  // B. Extract Supplier Name (First few lines, skipping generic headers like "TAX INVOICE")
  let supplierName = '';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (
      upper.includes('TAX INVOICE') ||
      upper.includes('INVOICE') ||
      upper.includes('ORIGINAL FOR RECIPIENT') ||
      upper.includes('DUPLICATE') ||
      upper.includes('BILL OF SUPPLY') ||
      upper.includes('CASH MEMO') ||
      /^GSTIN/i.test(line)
    ) {
      continue;
    }
    // Found plausible supplier line
    supplierName = line.replace(/^(M\/S\.?|FROM\s*:?|SUPPLIER\s*:?|SELLER\s*:?)\s*/i, '').trim();
    if (supplierName.length >= 3) {
      break;
    }
  }

  // C. Extract Invoice Number
  let invoiceNumber: string | undefined;
  const invPatterns = [
    /(?:INVOICE\s*(?:NO\.?|NUMBER|#)?|BILL\s*(?:NO\.?|NUMBER|#)?|DOC\s*(?:NO\.?|NUMBER|#)?|INV\s*(?:NO\.?|NUMBER|#)?)\s*[:.-]?\s*([A-Z0-9\/-]{2,25})/i,
    /\b(?:INV|BILL|DOC)[\s:.-]+([A-Z0-9\/-]{3,25})/i,
  ];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'TAX INVOICE' || upper === 'INVOICE' || upper === 'BILL OF SUPPLY') continue;
    for (const pat of invPatterns) {
      const match = line.match(pat);
      if (match && match[1]) {
        const candidate = match[1].trim().toUpperCase();
        if (!/^(DATE|DT|GSTIN|TOTAL|TAX|SUPPLY|ORIGINAL|CASH|MEMO|NO|NUMBER)$/i.test(candidate)) {
          invoiceNumber = candidate;
          break;
        }
      }
    }
    if (invoiceNumber) break;
  }

  // D. Extract Invoice Date
  let invoiceDate: string | undefined;
  const dateRegex = /(?:DATE|DT|INVOICE\s*DATE)[\s:.-]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})/i;
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match && match[1]) {
      invoiceDate = normalizeDateString(match[1]);
      break;
    }
  }
  if (!invoiceDate) {
    // Look for standalone date pattern in top 10 lines
    const anyDateRegex = /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})\b/;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const match = lines[i].match(anyDateRegex);
      if (match && match[1]) {
        invoiceDate = normalizeDateString(match[1]);
        break;
      }
    }
  }

  // E. Extract Totals & Taxes
  let subtotal: number | undefined;
  let cgst: number | undefined;
  let sgst: number | undefined;
  let igst: number | undefined;
  let totalTax: number | undefined;
  let grandTotal: number | undefined;

  for (const line of lines) {
    const upper = line.toUpperCase();
    const numbers = line.match(/\d+(?:,\d{3})*(?:\.\d{2})?/g);
    if (!numbers || numbers.length === 0) continue;
    const lastNum = parseFloat(numbers[numbers.length - 1].replace(/,/g, ''));

    if (isNaN(lastNum) || lastNum <= 0) continue;

    if (upper.includes('GRAND TOTAL') || upper.includes('TOTAL AMOUNT') || upper.includes('NET AMOUNT') || upper.includes('TOTAL PAYABLE')) {
      if (!grandTotal || lastNum > grandTotal) {
        grandTotal = lastNum;
      }
    } else if (upper.includes('SUBTOTAL') || upper.includes('TAXABLE AMOUNT') || upper.includes('TAXABLE VALUE') || upper.includes('TOTAL TAXABLE')) {
      if (!subtotal) subtotal = lastNum;
    } else if (upper.includes('CGST')) {
      if (!cgst) cgst = lastNum;
    } else if (upper.includes('SGST')) {
      if (!sgst) sgst = lastNum;
    } else if (upper.includes('IGST')) {
      if (!igst) igst = lastNum;
    } else if (upper.includes('TOTAL GST') || upper.includes('TOTAL TAX')) {
      if (!totalTax) totalTax = lastNum;
    }
  }

  if (!totalTax && (cgst !== undefined || sgst !== undefined || igst !== undefined)) {
    totalTax = (cgst || 0) + (sgst || 0) + (igst || 0);
  }

  // F. Extract Items Table Lines
  const items = extractLineItemsFromOcr(lines);

  if (!supplierName) uncertainFields.push('supplier');
  if (!invoiceNumber) uncertainFields.push('invoiceNumber');
  if (!invoiceDate) uncertainFields.push('invoiceDate');
  if (items.length === 0) uncertainFields.push('items');

  return {
    source: 'ocr',
    rawOcrText: rawText,
    supplier: supplierName || supplierGstin ? {
      name: supplierName || (supplierGstin ? `Supplier (${supplierGstin})` : 'Supplier'),
      gstin: supplierGstin,
      isMatched: false,
    } : undefined,
    invoiceNumber,
    invoiceDate,
    subtotal,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    items,
    uncertainFields,
  };
}

/**
 * Alias for parsePurchaseBillOcrText
 */
export const parsePurchaseBillOcr = parsePurchaseBillOcrText;

/**
 * Extracts line items from OCR table lines using pattern matching.
 */
function extractLineItemsFromOcr(lines: string[]): ExtractedPurchaseItem[] {
  const items: ExtractedPurchaseItem[] = [];
  const knownIgnored = [
    'SUBTOTAL', 'TOTAL', 'GRAND TOTAL', 'CGST', 'SGST', 'IGST', 'GST', 'ROUND OFF',
    'TAXABLE', 'TERMS', 'CONDITIONS', 'SIGNATURE', 'BANK DETAILS', 'E. & O.E.',
    'INVOICE', 'BILL NO', 'DOC NO', 'DATE', 'GSTIN', 'SUPPLIER', 'TAX INVOICE',
    'SR.', 'ITEM DESCRIPTION', 'QTY', 'RATE', 'AMOUNT', 'DESCRIPTION', 'PHONE',
    'SHOP NO', 'MARKET YARD', 'PLOT NO', 'ROAD', 'STREET', 'ADDRESS', 'PIN -', 'PINCODE'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    // Skip summary / metadata / address lines
    if (
      knownIgnored.some(w => upper.startsWith(w) || upper.includes('TOTAL AMOUNT') || upper.startsWith('BILL NO') || upper.startsWith('INVOICE NO') || upper.startsWith('DATE:') || upper.startsWith('GSTIN:') || upper.startsWith('PHONE:') || upper.includes('MARKET YARD') || upper.includes('SHOP NO'))
    ) {
      continue;
    }

    // A. Pipe-separated table lines: e.g. "Cotton Seeds Hybrid BG-II | 50 | 850 | 5%"
    if (line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3 && !parts[0].toUpperCase().includes('ITEM') && !parts[0].toUpperCase().includes('DESC')) {
        const rawName = parts[0].replace(/^\d+\.?\s*/, '').trim();
        const qty = parseFloat(parts[1]) || 1;
        const rate = parseFloat(parts[2]) || 0;
        const gstMatch = parts[3]?.match(/\b(0|5|12|18|28)\b/);
        const gst = gstMatch ? Number(gstMatch[1]) : 5;
        items.push({
          rawName,
          isMatched: false,
          unit: determineUnitFromName(rawName),
          quantity: qty,
          purchasePrice: rate,
          gstRate: gst,
          lineTotal: qty * rate * (1 + gst / 100),
        });
        continue;
      }
    }

    // B. Continuation line with Batch / Expiry for previous item: e.g. "Batch: CP-882 Expiry: 08/2028"
    if (/^\s*(?:Batch|Lot|Exp|Mfg)/i.test(line) && items.length > 0) {
      const lastItem = items[items.length - 1];
      const bMatch = line.match(/(?:BATCH|LOT|B\.NO)[\s#:.-]*([A-Z0-9-]+)/i);
      const eMatch = line.match(/(?:EXP(?:IRY)?|EXP\.?\s*DATE)[\s:.-]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{1,2}[\/\.-]\d{2,4})/i);
      if (bMatch) lastItem.batchNumber = bMatch[1].toUpperCase();
      if (eMatch) lastItem.expiryDate = normalizeDateString(eMatch[1]);
      continue;
    }

    // C. Standard OCR line item: e.g. "1. Chlorpyrifos 20% EC 1Ltr 380891 10 450 18% 4500.00"
    const matchTable = line.match(/^\s*(?:\d+[\.)]\s*)?([A-Za-z][A-Za-z0-9\s%.+()\/&-]+?)\s+(?:(\d{4,8})\s+)?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+(\d+)%)?(?:\s+\d+(?:\.\d+)?)?\s*$/);
    if (matchTable) {
      const rawName = matchTable[1].trim();
      const hsn = matchTable[2];
      const qty = parseFloat(matchTable[3]) || 1;
      const rate = parseFloat(matchTable[4]) || 0;
      const gst = matchTable[5] ? parseFloat(matchTable[5]) : 5;
      items.push({
        rawName,
        isMatched: false,
        unit: determineUnitFromName(rawName),
        quantity: qty,
        purchasePrice: rate,
        gstRate: gst,
        hsnCode: hsn,
        lineTotal: qty * rate * (1 + gst / 100),
      });
      continue;
    }

    // D. Generic fallback line with item + numbers
    const numbers = line.match(/\b\d+(?:\.\d+)?\b/g);
    if (!numbers || numbers.length < 2) continue;

    const batchMatch = line.match(/(?:BATCH|LOT|B\.NO)[\s#:.-]*([A-Z0-9-]+)/i);
    const expMatch = line.match(/(?:EXP(?:IRY)?|EXP\.?\s*DATE)[\s:.-]*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{1,2}[\/\.-]\d{2,4})/i);
    const hsnMatch = line.match(/(?:HSN|SAC)[\s:.-]*(\d{4,8})/i);

    let cleanName = line
      .replace(/^\d+[\.)]\s*/, '')
      .replace(/(?:BATCH|LOT|B\.NO)[\s#:.-]*[A-Z0-9-]+/gi, '')
      .replace(/(?:EXP(?:IRY)?|EXP\.?\s*DATE)[\s:.-]*[\d\/\.-]+/gi, '')
      .replace(/(?:HSN|SAC)[\s:.-]*\d+/gi, '')
      .replace(/(?:QTY|QUANTITY|RATE|PRICE|MRP|GST|AMT|AMOUNT)[\s:.-]*/gi, '')
      .trim();

    if (cleanName.length < 3) continue;

    let qty = 1;
    let rate = 0;
    let gst = 5;

    const parsedNums = numbers.map(Number).filter(n => !isNaN(n) && n > 0);
    if (parsedNums.length >= 2) {
      const possibleQty = parsedNums.find(n => Number.isInteger(n) && n >= 1 && n <= 10000);
      const possibleRate = parsedNums.find(n => n >= 10 && n !== possibleQty);
      if (possibleQty) qty = possibleQty;
      if (possibleRate) rate = possibleRate;
    } else if (parsedNums.length === 1) {
      rate = parsedNums[0];
    }

    const gstMatch = line.match(/\b(0|5|12|18|28)\s*%/);
    if (gstMatch) {
      gst = Number(gstMatch[1]);
    }

    items.push({
      rawName: cleanName,
      isMatched: false,
      unit: determineUnitFromName(line),
      batchNumber: batchMatch ? batchMatch[1].toUpperCase() : undefined,
      expiryDate: expMatch ? normalizeDateString(expMatch[1]) : undefined,
      quantity: qty,
      purchasePrice: rate,
      gstRate: gst,
      hsnCode: hsnMatch ? hsnMatch[1] : undefined,
      lineTotal: qty * rate * (1 + gst / 100),
    });
  }

  return items;
}

function determineUnitFromName(text: string): string {
  const upper = text.toUpperCase();
  if (upper.includes('KG') || upper.includes('KILOGRAM')) return 'KG';
  if (upper.includes('LTR') || upper.includes('LITER') || upper.includes('LITRE') || upper.includes(' LT')) return 'Litre';
  if (upper.includes('ML') || upper.includes('MILLILITER')) return 'ML';
  if (upper.includes('GM') || upper.includes('GRAM') || upper.includes(' GMS')) return 'Gram';
  if (upper.includes('BAG') || upper.includes('BAGS')) return 'Bag';
  if (upper.includes('BOTTLE') || upper.includes('BTL')) return 'Bottle';
  if (upper.includes('BOX') || upper.includes('PACKET') || upper.includes('PKT')) return 'Packet';
  return 'Piece';
}

/**
 * Normalizes date strings (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/YYYY) to YYYY-MM-DD.
 */
export function normalizeDateString(rawDate: string): string {
  if (!rawDate || !rawDate.trim()) return '';
  const clean = rawDate.trim().replace(/\./g, '/').replace(/-/g, '/');

  // YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }

  // MM/YYYY -> set to first day of month
  const my = clean.match(/^(\d{1,2})\/(\d{4})$/);
  if (my) {
    const m = my[1].padStart(2, '0');
    const y = my[2];
    return `${y}-${m}-01`;
  }

  // DD/MM/YY
  const dmy2 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (dmy2) {
    const d = dmy2[1].padStart(2, '0');
    const m = dmy2[2].padStart(2, '0');
    const y = `20${dmy2[3]}`;
    return `${y}-${m}-${d}`;
  }

  return rawDate;
}

// ─────────────────────────────────────────────────────────
// 3. CONSERVATIVE PRODUCT & SUPPLIER MATCHING
// ─────────────────────────────────────────────────────────

/**
 * Enriches the extracted purchase draft by matching against existing shop catalog and suppliers.
 * Never guesses or forces a match.
 */
export function matchDraftAgainstCatalog(
  draft: PurchaseDraftResult,
  catalogProducts: any[],
  suppliers: any[]
): PurchaseDraftResult {
  // A. Match Supplier
  let matchedSupplier = draft.supplier;
  if (matchedSupplier && suppliers && suppliers.length > 0) {
    const draftGstin = (matchedSupplier.gstin || '').trim().toUpperCase();
    const draftName = (matchedSupplier.name || '').trim().toUpperCase();

    // 1. Exact GSTIN match
    let found = draftGstin ? suppliers.find(s => (s.gst_number || s.gstin || '').trim().toUpperCase() === draftGstin) : null;

    // 2. Exact Name match
    if (!found && draftName) {
      found = suppliers.find(s => {
        const sName = (s.name || '').trim().toUpperCase();
        const sCompany = (s.company || '').trim().toUpperCase();
        return sName === draftName || sCompany === draftName;
      });
    }

    if (found) {
      matchedSupplier = {
        id: found.id,
        name: found.name,
        company: found.company,
        gstin: found.gst_number || found.gstin || matchedSupplier.gstin,
        phone: found.phone || matchedSupplier.phone,
        isMatched: true,
      };
    }
  }

  // B. Match Items
  const matchedItems: ExtractedPurchaseItem[] = draft.items.map(item => {
    if (!catalogProducts || catalogProducts.length === 0) {
      return item;
    }

    const rawUpper = item.rawName.trim().toUpperCase();

    // 1. Match by exact barcode or SKU
    let matchedProd = catalogProducts.find(p => {
      const b = (p.barcode || '').trim().toUpperCase();
      const s = (p.sku || '').trim().toUpperCase();
      return (b && b === rawUpper) || (s && s === rawUpper);
    });

    // 2. Match by exact product name
    if (!matchedProd) {
      matchedProd = catalogProducts.find(p => (p.name || '').trim().toUpperCase() === rawUpper);
    }

    // 3. Match by name contains (if strong similarity e.g. name starts with or ends with)
    if (!matchedProd) {
      matchedProd = catalogProducts.find(p => {
        const pName = (p.name || '').trim().toUpperCase();
        return pName.length >= 4 && (pName === rawUpper || rawUpper.includes(pName) || pName.includes(rawUpper));
      });
    }

    if (matchedProd) {
      return {
        ...item,
        matchedProductId: matchedProd.id,
        matchedProductName: matchedProd.name,
        isMatched: true,
        sku: matchedProd.sku,
        unit: matchedProd.unit || item.unit,
        gstRate: matchedProd.gst_rate !== undefined && matchedProd.gst_rate !== null ? Number(matchedProd.gst_rate) : item.gstRate,
        purchasePrice: item.purchasePrice > 0 ? item.purchasePrice : Number(matchedProd.purchase_price || 0),
        sellingPrice: Number(matchedProd.selling_price || 0),
      };
    }

    return item;
  });

  return {
    ...draft,
    supplier: matchedSupplier,
    items: matchedItems,
  };
}
