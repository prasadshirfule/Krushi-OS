import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { numberToWords } from './utils';
import { 
  ShopDetails, 
  DEFAULT_SHOP_DETAILS, 
  getSavedShopDetails, 
  formatShopAddress 
} from './shop-details';
import { formatProductNameWithSize } from './validations';
import { buildUpiUri } from './upi';

/**
 * Formats a monetary number into standard Indian numbering with comma thousands separators and 2 decimal places.
 * Example: 2566.1 -> "2,566.10", 3032 -> "3,032.00", 0 -> "0.00"
 */
export function formatInvoiceNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = Number(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a monetary number with the ₹ symbol and comma thousands separators.
 * Example: 2566.1 -> "₹ 2,566.10", 230.95 -> "₹ 230.95", 3032 -> "₹ 3,032.00"
 */
export function formatInvoiceAmount(val: number | string | null | undefined): string {
  return `₹ ${formatInvoiceNumber(val)}`;
}

/**
 * Formats a GST rate into a clean percentage string.
 * Examples: 0 -> "0%", 5 -> "5%", 18 -> "18%", 0.05 -> "5%"
 */
export function formatGstPercent(rate?: number | null): string {
  if (rate === undefined || rate === null || isNaN(Number(rate))) {
    return '0%';
  }
  let num = Number(rate);
  // If decimal fraction representation like 0.05 or 0.18 is passed
  if (num > 0 && num < 1) {
    num = Math.round(num * 10000) / 100;
  }
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted}%`;
}

/**
 * Draws a sharp, vector-quality Indian Rupee symbol (₹) in jsPDF at baseline (x, y).
 * Sized and weighted to visually match adjacent capital letters/numbers at fontSizePt.
 * Avoids character-encoding corruption (e.g. stray '1' or spaced-out UTF-16 glyphs in standard PDF fonts).
 * @param doc jsPDF instance
 * @param x Left X coordinate in mm
 * @param y Baseline Y coordinate in mm
 * @param fontSizePt Font size in points
 * @returns Width of the drawn symbol in mm
 */
export function drawRupeeSymbol(
  doc: jsPDF,
  x: number,
  y: number,
  fontSizePt: number
): number {
  // Cap height in mm for Helvetica at fontSizePt (Cap Height ~= 0.72 * fontSize in pt * 0.352778 mm/pt)
  const capHeight = fontSizePt * 0.352778 * 0.72;
  const w = capHeight * 0.65;
  const lw = Math.max(0.20, capHeight * 0.12);

  const topY = y - capHeight;
  const bar2Y = topY + (capHeight * 0.32);
  const midY = topY + (capHeight * 0.55);
  const botY = y;

  const stemX = x + (w * 0.22);
  const rightX = x + (w * 0.85);

  doc.saveGraphicsState();
  doc.setLineWidth(lw);
  doc.setDrawColor(0, 0, 0);
  doc.setLineCap('square');
  doc.setLineJoin('round');

  // 1. Top horizontal bar (Shirorekha)
  doc.line(x, topY, x + w, topY);

  // 2. Second horizontal bar (slightly shorter)
  doc.line(x, bar2Y, x + (w * 0.75), bar2Y);

  // 3. Upper 'R' loop - smooth cubic bezier curve from (stemX, topY) to (stemX, midY)
  if (typeof (doc as any).curveTo === 'function' && typeof (doc as any).moveTo === 'function') {
    (doc as any).moveTo(stemX, topY);
    (doc as any).curveTo(stemX + (w * 0.85), topY, stemX + (w * 0.85), midY, stemX, midY);
    (doc as any).stroke();
  } else {
    const cp1x = w * 0.85;
    const cp1y = 0;
    const cp2x = w * 0.85;
    const cp2y = midY - topY;
    const endX = 0;
    const endY = midY - topY;
    doc.lines([[cp1x, cp1y, cp2x, cp2y, endX, endY]], stemX, topY, [1, 1], 'S');
  }

  // 4. Diagonal leg from junction (stemX, midY) down-right to (rightX, botY)
  doc.line(stemX, midY, rightX, botY);

  doc.restoreGraphicsState();

  return w;
}

/**
 * Renders a currency value (₹ + formatted number) right-aligned at targetRightX inside its cell.
 * Keeps entire value on one line, with zero digit splitting and zero boundary overflow.
 */
export function renderRightAlignedCurrency(
  doc: jsPDF,
  amount: number | string | null | undefined,
  targetRightX: number,
  baselineY: number,
  fontSizePt: number = 8.0,
  fontStyle: 'normal' | 'bold' = 'bold'
): { startX: number; endX: number } {
  const numStr = formatInvoiceNumber(amount);
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSizePt);
  doc.setTextColor(0, 0, 0);

  const numWidth = doc.getTextWidth(numStr);
  const capHeight = fontSizePt * 0.352778 * 0.72;
  const symbolWidth = capHeight * 0.72;
  const symbolGap = Math.max(0.5, capHeight * 0.25);

  const numStartX = targetRightX - numWidth;
  const symbolStartX = numStartX - symbolWidth - symbolGap;

  // Draw Rupee vector symbol at matched height
  drawRupeeSymbol(doc, symbolStartX, baselineY, fontSizePt);

  // Draw clean ASCII number string
  doc.text(numStr, targetRightX, baselineY, { align: 'right' });

  return { startX: symbolStartX, endX: targetRightX };
}

/**
 * Renders a currency value (₹ + formatted number) centered at centerX.
 */
export function renderCenteredCurrency(
  doc: jsPDF,
  amount: number | string | null | undefined,
  centerX: number,
  baselineY: number,
  fontSizePt: number = 7.0,
  fontStyle: 'normal' | 'bold' = 'bold'
): void {
  const numStr = formatInvoiceNumber(amount);
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSizePt);
  doc.setTextColor(0, 0, 0);

  const numWidth = doc.getTextWidth(numStr);
  const capHeight = fontSizePt * 0.352778 * 0.72;
  const symbolWidth = capHeight * 0.72;
  const symbolGap = Math.max(0.4, capHeight * 0.20);
  const totalWidth = symbolWidth + symbolGap + numWidth;

  const symbolStartX = centerX - (totalWidth / 2);
  const numStartX = symbolStartX + symbolWidth + symbolGap;

  drawRupeeSymbol(doc, symbolStartX, baselineY, fontSizePt);
  doc.text(numStr, numStartX, baselineY);
}

/**
 * Renders the adjustments text cleanly without Unicode artifacts or stray characters.
 * Example: "Hamali (+ ₹ 134.00)  |  Discount (- ₹ 50.00)"
 */
export function renderAdjustmentsText(
  doc: jsPDF,
  adjustments: any[],
  startX: number,
  baselineY: number,
  fontSizePt: number = 7.5
): void {
  let currX = startX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizePt);
  doc.setTextColor(0, 0, 0);

  adjustments.forEach((adj: any, idx: number) => {
    const reason = adj.reason || 'Adj';
    const sign = adj.type === 'ADD' ? '+' : '-';
    const amtStr = formatInvoiceNumber(adj.amount);

    const prefix = `${reason} (${sign} `;
    doc.text(prefix, currX, baselineY);
    currX += doc.getTextWidth(prefix);

    const rupeeW = drawRupeeSymbol(doc, currX, baselineY, fontSizePt);
    currX += rupeeW + 0.6;

    const suffix = `${amtStr})${idx < adjustments.length - 1 ? '  |  ' : ''}`;
    doc.text(suffix, currX, baselineY);
    currX += doc.getTextWidth(suffix);
  });
}

export function formatInvoiceExpiry(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '-';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '-';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    if (year > 1900 && year < 3000) {
      return `${day}/${month}/${year}`;
    }
  }

  return trimmed;
}

export function generateInvoicePDF(sale: any, customSettings?: any): jsPDF {
  // A5 Landscape geometry (210mm × 148mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5',
  });

  const s = sale || {};
  const hasRealSale = Boolean(
    s.id || s.invoice_number || (s.items && s.items.length > 0) || (s.sale_items && s.sale_items.length > 0)
  );

  // Document boundaries (204mm × 142mm inner canvas with 3mm margin)
  const marginX = 3;
  const marginY = 3;
  const width = 204;
  const height = 142;
  const rightX = marginX + width; // 207mm
  const bottomY = marginY + height; // 145mm

  // Resolve shop details (handling camelCase and snake_case properties)
  const baseShop = getSavedShopDetails();
  const rawShop = customSettings || {};
  const shop: ShopDetails = {
    ...baseShop,
    shopName: rawShop.shopName || rawShop.shop_name || baseShop.shopName || 'MAULI KRUSHI SEVA KENDRA',
    ownerName: rawShop.ownerName || rawShop.owner_name || baseShop.ownerName || '',
    address: rawShop.address || rawShop.shop_address || baseShop.address || '',
    village: rawShop.village || baseShop.village || '',
    taluka: rawShop.taluka || baseShop.taluka || '',
    district: rawShop.district || baseShop.district || '',
    state: rawShop.state || baseShop.state || '',
    pincode: rawShop.pincode || baseShop.pincode || '',
    contact1: rawShop.contact1 || rawShop.shop_phone || baseShop.contact1 || '',
    contact2: rawShop.contact2 || baseShop.contact2 || '',
    email: rawShop.email || rawShop.shop_email || baseShop.email || '',
    gstNumber: rawShop.gstNumber || rawShop.gstin || baseShop.gstNumber || '',
    licenseNumber: rawShop.licenseNumber || rawShop.license || baseShop.licenseNumber || '',
    registrationNumber: rawShop.registrationNumber || rawShop.fssai || rawShop.reg_no || baseShop.registrationNumber || '',
    invoiceTerms: rawShop.invoiceTerms || rawShop.terms || baseShop.invoiceTerms || '',
    authorizedSignatory: rawShop.authorizedSignatory || rawShop.authorized_signatory || baseShop.authorizedSignatory || '',
    logoBase64: rawShop.logoBase64 || rawShop.logo_base64 || baseShop.logoBase64 || '',
    upiId: rawShop.upiId || rawShop.upi_id || baseShop.upiId || '',
    bankName: rawShop.bankName || rawShop.bank_name || baseShop.bankName || '',
    accountName: rawShop.accountName || rawShop.account_name || baseShop.accountName || '',
    accountNumber: rawShop.accountNumber || rawShop.account_number || baseShop.accountNumber || '',
    ifsc: rawShop.ifsc || baseShop.ifsc || '',
    branch: rawShop.branch || baseShop.branch || '',
    accountType: rawShop.accountType || rawShop.account_type || baseShop.accountType || '',
  };

  const dynamicShopAddress = formatShopAddress(shop) || shop.address || '';

  // Document type handling (Sale vs Return)
  const isReturnDoc = Boolean(
    s.return_number || s.returnNumber || s.is_return || s.document_type === 'SALE_RETURN' || s.documentType === 'SALE_RETURN'
  );
  const returnNumber = s.return_number || s.returnNumber || '';
  const invoiceNo = isReturnDoc
    ? returnNumber
    : (s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : 'KOS-2026-001'));

  // Customer details
  const customerName = (
    s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || (hasRealSale ? 'WALK-IN CUSTOMER' : 'DEMO CUSTOMER')
  ).toUpperCase();
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || (hasRealSale ? '' : '9876543210');
  const customerAddress = [
    s.customer?.village || s.customer?.address || s.customer_village || s.customer_address || (!hasRealSale ? 'Demo Address' : ''),
    s.customer?.district || (!hasRealSale ? 'Demo District' : ''),
    s.customer?.state || (!hasRealSale ? 'Demo State' : '')
  ].filter(Boolean).join(', ');

  // Date & Time formatting
  const dateObj = s.return_date || s.sale_date || s.created_at ? new Date(s.return_date || s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Payment Mode and Badges
  const refundModeMap: Record<string, string> = {
    'CREDIT_ADJUSTMENT': 'Customer Balance Adjustment',
    'CASH': 'Cash Refund',
    'UPI': 'UPI Refund',
    'BANK_TRANSFER': 'Bank Transfer',
    'CARD': 'Card Refund',
  };
  const rawRefundMode = s.refund_mode || s.refundMode || '';
  const displayRefundMode = refundModeMap[rawRefundMode] || rawRefundMode || 'Credit Note';

  const rawPaymentMethod = (s.payment_method || s.payment_mode || s.paymentMethod || s.payments?.[0]?.method || 'CASH').toString().toUpperCase();
  const isCredit = rawPaymentMethod === 'CREDIT';
  const isUpi = rawPaymentMethod === 'UPI';
  const isPartial = rawPaymentMethod.includes('PARTIAL') || (Array.isArray(s.payments) && s.payments.length > 1) || Boolean(s.partial_payment);
  const paymentBadge = isReturnDoc
    ? `[R] ${displayRefundMode}`
    : (isPartial ? '[R] Partial Bill' : (isCredit ? '[R] Credit Bill' : (isUpi ? '[R] UPI Bill' : '[R] Cash Bill')));
  const paymentMode = isReturnDoc
    ? displayRefundMode.toUpperCase()
    : (isPartial ? 'PARTIAL' : (isUpi ? 'UPI' : (isCredit ? 'CREDIT' : (rawPaymentMethod === 'BANK_TRANSFER' ? 'BANK TRANSFER' : rawPaymentMethod))));

  // Items processing
  const rawItems = s.items || s.sale_items || [];
  let items: any[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Math.max(1, Number(item.quantity || 1));
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      const unitPrice = Number(item.unit_price ?? item.selling_price ?? item.rate ?? (item.total_amount && qty ? item.total_amount / qty : 0));
      const discAmt = Number(
        item.discount_amount !== undefined 
          ? item.discount_amount 
          : (item.discount !== undefined ? item.discount : (item.discount_percent ? (qty * unitPrice * item.discount_percent / 100) : 0))
      );
      const lineTotal = Math.max(0, (qty * unitPrice) - discAmt);
      
      const taxable = Math.round((lineTotal / (1 + gst / 100)) * 100) / 100;
      const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;

      let prodRawName = item.product_name || item.name;
      if (!prodRawName || prodRawName === 'Product') prodRawName = p.name;
      if (!prodRawName) prodRawName = `ITEM ${idx + 1}`;

      const packSize = item.pack_size || p.pack_size || ((item.product_size_value || p.product_size_value) ? `${item.product_size_value || p.product_size_value} ${item.product_size_unit || p.product_size_unit || 'KG'}` : '');
      const unit = item.unit || p.unit || '';
      const prodName = formatProductNameWithSize(prodRawName, packSize, unit);

      let mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      const manufacturer = (mfg && mfg !== 'null' && mfg !== 'undefined' && String(mfg).trim() !== '-')
        ? String(mfg).trim().toUpperCase()
        : '-';

      const rawBatch = item.batch_number || item.batch?.batch_number || item.item_batches?.[0]?.batch?.batch_number || p.batches?.[0]?.batch_number || p.batch_number || '';
      const batch = (rawBatch && rawBatch !== 'null' && rawBatch !== 'undefined' && String(rawBatch).trim() !== '-')
        ? String(rawBatch).trim()
        : '-';

      const rawExpiry = item.expiry_date || item.batch?.expiry_date || item.item_batches?.[0]?.batch?.expiry_date || p.batches?.[0]?.expiry_date || p.expiry_date || '';
      const expiry = formatInvoiceExpiry(rawExpiry);

      return {
        id: item.id || `item-${idx}`,
        name: prodName,
        manufacturer: manufacturer,
        batch: batch,
        expiry: expiry,
        quantity: qty,
        rate: unitPrice,
        gstRate: gst,
        rateWithGst: unitPrice,
        taxableAmount: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        total: lineTotal,
      };
    });
  } else {
    items = [
      {
        id: 'default-item-1',
        name: 'STUNNER GOLD 50KG',
        manufacturer: 'PROGENE',
        batch: 'BAC2245',
        expiry: '10/07/2028',
        quantity: 1,
        rate: 295,
        gstRate: 18,
        rateWithGst: 295,
        taxableAmount: 250,
        cgstAmount: 22.5,
        sgstAmount: 22.5,
        total: 295,
      }
    ];
  }

  // Totals & Adjustments
  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  let rawAdjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  let parsedMetadata: any = {};
  if (s.notes && typeof s.notes === 'string') {
    try {
      const trimmed = s.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsedMetadata = JSON.parse(trimmed);
        if (Array.isArray(parsedMetadata.adjustments)) rawAdjustments = parsedMetadata.adjustments;
      } else if (trimmed.includes('__ADJUSTMENTS__:')) {
        const parts = trimmed.split('__ADJUSTMENTS__:');
        const parsed = JSON.parse(parts[1]);
        if (Array.isArray(parsed)) rawAdjustments = parsed;
      }
    } catch {}
  }
  const adjustments = rawAdjustments;
  const totalAdditions = adjustments.filter(a => a.type === 'ADD').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments.filter(a => a.type === 'DEDUCT').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const netTotal = Math.max(0, productsTotal + totalAdditions - totalDeductions);

  // Partial payment breakdown
  let partialCash = 0;
  let partialUpi = 0;
  let partialBank = 0;
  let partialPaidTotal = 0;
  if (isPartial) {
    if (s.partial_payment) {
      partialCash = Number(s.partial_payment.cash || 0);
      partialUpi = Number(s.partial_payment.upi || 0);
      partialBank = Number(s.partial_payment.bank_transfer || s.partial_payment.bankTransfer || 0);
      partialPaidTotal = Number(s.partial_payment.total_paid || s.partial_payment.totalPaid || (partialCash + partialUpi + partialBank));
    } else if (parsedMetadata.partialPayment) {
      const pp = parsedMetadata.partialPayment;
      partialCash = Number(pp.cash || 0);
      partialUpi = Number(pp.upi || 0);
      partialBank = Number(pp.bank_transfer || pp.bankTransfer || 0);
      partialPaidTotal = Number(pp.total_paid || pp.totalPaid || (partialCash + partialUpi + partialBank));
    } else if (Array.isArray(s.payments) && s.payments.length > 0) {
      for (const p of s.payments) {
        const m = String(p.method).toUpperCase();
        const amt = Number(p.amount || 0);
        if (m === 'CASH') partialCash += amt;
        else if (m === 'UPI') partialUpi += amt;
        else if (m === 'BANK_TRANSFER' || m === 'BANK TRANSFER') partialBank += amt;
      }
      partialPaidTotal = partialCash + partialUpi + partialBank;
    }
  }

  const upiQrAmount = isPartial ? partialUpi : (isUpi ? netTotal : 0);
  const cleanWords = numberToWords(netTotal);

  // Customer Ledger Calculation
  const amountPaid = isPartial 
    ? partialPaidTotal 
    : (s.paid_amount !== undefined ? Number(s.paid_amount) : (isCredit ? 0 : netTotal));
  
  // Current Credit/Outstanding portion of THIS invoice
  const crInvoice = Math.max(0, netTotal - amountPaid);

  // Opening Balance: Customer's outstanding balance BEFORE this invoice
  let openingBal = 0;
  if (s.customer?.previous_outstanding !== undefined && s.customer?.previous_outstanding !== null) {
    openingBal = Number(s.customer.previous_outstanding);
  } else if (s.customer?.previous_balance !== undefined && s.customer?.previous_balance !== null) {
    openingBal = Number(s.customer.previous_balance);
  } else if (s.customer?.opening_balance !== undefined && s.customer?.opening_balance !== null) {
    openingBal = Number(s.customer.opening_balance);
  } else if (s.customer?.previous_udhari !== undefined && s.customer?.previous_udhari !== null) {
    openingBal = Number(s.customer.previous_udhari);
  } else if (s.previous_outstanding !== undefined && s.previous_outstanding !== null) {
    openingBal = Number(s.previous_outstanding);
  } else if (s.previous_balance !== undefined && s.previous_balance !== null) {
    openingBal = Number(s.previous_balance);
  } else if (s.opening_balance !== undefined && s.opening_balance !== null) {
    openingBal = Number(s.opening_balance);
  } else if (s.customer?.outstanding !== undefined && s.customer?.outstanding !== null) {
    const rawOutstanding = Number(s.customer.outstanding || 0);
    openingBal = rawOutstanding >= crInvoice ? (rawOutstanding - crInvoice) : rawOutstanding;
  } else if (s.customer?.outstanding_balance !== undefined && s.customer?.outstanding_balance !== null) {
    const rawOutstanding = Number(s.customer.outstanding_balance || 0);
    openingBal = rawOutstanding >= crInvoice ? (rawOutstanding - crInvoice) : rawOutstanding;
  }

  // Closing Balance = Opening Balance + Current Credit Amount
  const closingBalance = openingBal + crInvoice;

  // Exact Canonical Section Heights (totals 142mm)
  const H_HEADER = 19;
  const H_CUSTOMER = 14;
  const H_TBL_HEAD = 9;
  const H_BOTTOM = 28.5;
  const H_FOOTER = 4.5;
  const cleanTerms = (shop.invoiceTerms || '').trim();
  const hasTerms = cleanTerms.length > 0;
  const H_TERMS = hasTerms ? 11.5 : 0;
  const hasAdjustments = adjustments.length > 0;
  const currentHTotals = hasAdjustments ? 11.5 : 7.5;
  const currentHTblBody = height - H_HEADER - H_CUSTOMER - H_TBL_HEAD - currentHTotals - H_BOTTOM - H_TERMS - H_FOOTER;

  // ─── 0. OUTER BORDER (0.5mm) ───
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(marginX, marginY, width, height);

  // ─── WATERMARK (CENTERED AT OPACITY 0.12) ───
  if (shop.logoBase64) {
    try {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
      const wmSize = 70;
      doc.addImage(shop.logoBase64, 'PNG', marginX + (width - wmSize) / 2, marginY + (height - wmSize) / 2, wmSize, wmSize);
      doc.restoreGraphicsState();
    } catch {
      // Ignore if graphics state not available
    }
  }

  // ════════════════════════════════════════════════════════
  // 1. HEADER SECTION (19mm, y = 3 to 22)
  // ════════════════════════════════════════════════════════
  const headerBottomY = marginY + H_HEADER; // 22mm
  doc.setLineWidth(0.45);
  doc.line(marginX, headerBottomY, rightX, headerBottomY);

  // 1A. Logo on left (x = 4.5 to 22.5)
  if (shop.logoBase64) {
    try {
      doc.addImage(shop.logoBase64, 'PNG', marginX + 1.5, marginY + 1.5, 16, 16);
    } catch {
      doc.setLineWidth(0.3);
      doc.rect(marginX + 1.5, marginY + 1.5, 16, 16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('LOGO', marginX + 9.5, marginY + 10.5, { align: 'center' });
    }
  } else {
    doc.setLineWidth(0.3);
    doc.rect(marginX + 1.5, marginY + 1.5, 16, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('LOGO', marginX + 9.5, marginY + 10.5, { align: 'center' });
  }

  // 1B. Shop Details in Center (centered around x = 86)
  const shopCenterX = 86;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text((shop.shopName || 'KRUSHI SEVA KENDRA').toUpperCase(), shopCenterX, marginY + 5.5, { align: 'center' });

  if (dynamicShopAddress) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const splitAddr = doc.splitTextToSize(dynamicShopAddress, 105);
    doc.text(splitAddr[0] || dynamicShopAddress, shopCenterX, marginY + 9.8, { align: 'center' });
  }

  const contactItems: string[] = [];
  if (shop.ownerName) contactItems.push(`Pro: ${shop.ownerName}`);
  if (shop.contact1) contactItems.push(`Mob: ${shop.contact1}`);
  if (contactItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(contactItems.join('      '), shopCenterX, marginY + 14.5, { align: 'center' });
  }

  // 1C. GSTIN / LIC NO / REG NO Table on right (52mm × 17.5mm, x = 153.5 to 205.5, y = 3.75 to 21.25)
  const gstBoxX = 153.5;
  const gstBoxY = marginY + 0.75;
  const gstBoxW = 52;
  const gstBoxH = 17.5;
  const gstRowH = gstBoxH / 3;

  doc.setLineWidth(0.45);
  doc.rect(gstBoxX, gstBoxY, gstBoxW, gstBoxH);
  doc.setLineWidth(0.35);
  doc.line(gstBoxX, gstBoxY + gstRowH, gstBoxX + gstBoxW, gstBoxY + gstRowH);
  doc.line(gstBoxX, gstBoxY + gstRowH * 2, gstBoxX + gstBoxW, gstBoxY + gstRowH * 2);

  // Row 1: GSTIN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('GSTIN:', gstBoxX + 2, gstBoxY + 4.1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(shop.gstNumber || '-', gstBoxX + 16, gstBoxY + 4.1);

  // Row 2: LIC NO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('LIC NO:', gstBoxX + 2, gstBoxY + gstRowH + 4.1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(shop.licenseNumber || '-', gstBoxX + 16, gstBoxY + gstRowH + 4.1);

  // Row 3: REG NO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('REG NO:', gstBoxX + 2, gstBoxY + gstRowH * 2 + 4.1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(shop.registrationNumber || '-', gstBoxX + 16, gstBoxY + gstRowH * 2 + 4.1);

  // ════════════════════════════════════════════════════════
  // 2. CUSTOMER & BILL INFO (14mm, y = 22 to 36)
  // ════════════════════════════════════════════════════════
  const custStartY = headerBottomY; // 22mm
  const custEndY = custStartY + H_CUSTOMER; // 36mm
  const custSplitX = marginX + (width * 0.60); // 125.4mm

  doc.setLineWidth(0.45);
  doc.line(marginX, custEndY, rightX, custEndY);
  doc.line(custSplitX, custStartY, custSplitX, custEndY);

  // 2A. Customer Info (Left 60%)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('Name', marginX + 2, custStartY + 4.2);
  doc.text(':', marginX + 17, custStartY + 4.2);
  doc.setFontSize(8.8);
  const nameTrunc = doc.splitTextToSize(customerName, 98);
  doc.text(nameTrunc[0] || customerName, marginX + 20, custStartY + 4.2);

  doc.setFontSize(7.8);
  doc.text('Address', marginX + 2, custStartY + 8.2);
  doc.text(':', marginX + 17, custStartY + 8.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const addrTrunc = doc.splitTextToSize(customerAddress || '-', 98);
  doc.text(addrTrunc[0] || '-', marginX + 20, custStartY + 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('Mob', marginX + 2, custStartY + 12.2);
  doc.text(':', marginX + 17, custStartY + 12.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(customerPhone || '-', marginX + 20, custStartY + 12.2);

  // 2B. Bill Info (Right 40%)
  // Payment Badge box on top right
  doc.setLineWidth(0.35);
  doc.rect(rightX - 32, custStartY + 1, 30, 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(paymentBadge, rightX - 17, custStartY + 3.8, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text(isReturnDoc ? 'Return No' : 'Bill No', custSplitX + 2, custStartY + 4.5);
  doc.text(':', custSplitX + 18, custStartY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(invoiceNo, custSplitX + 21, custStartY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('Date', custSplitX + 2, custStartY + 8.5);
  doc.text(':', custSplitX + 18, custStartY + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`${formattedDate} (${formattedTime})`, custSplitX + 21, custStartY + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text(isReturnDoc ? 'Refund' : 'Payment', custSplitX + 2, custStartY + 12.5);
  doc.text(':', custSplitX + 18, custStartY + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const payStr = paymentMode + (isUpi && shop.upiId ? ` (${shop.upiId})` : '');
  doc.text(payStr, custSplitX + 21, custStartY + 12.5);

  // ════════════════════════════════════════════════════════
  // 3. PRODUCT TABLE (Table Header 9mm + Dynamic Body)
  // ════════════════════════════════════════════════════════
  const tblHeadStartY = custEndY; // 36mm
  const tblHeadEndY = tblHeadStartY + H_TBL_HEAD; // 45mm
  const tblBodyStartY = tblHeadEndY; // 45mm
  const tblBodyEndY = tblBodyStartY + currentHTblBody;

  // Column X definitions (total width 204mm)
  // Widths: [9.2, 47.0, 22.4, 16.3, 19.4, 12.2, 16.3, 13.3, 24.5, 23.4]
  const colX = [3, 12.2, 59.2, 81.6, 97.9, 117.3, 129.5, 145.8, 159.1, 183.6, 207];

  // Table header dividers & text
  doc.setLineWidth(0.45);
  doc.line(marginX, tblHeadEndY, rightX, tblHeadEndY);
  for (let c = 1; c < colX.length - 1; c++) {
    doc.setLineWidth(0.35);
    doc.line(colX[c], tblHeadStartY, colX[c], tblHeadEndY);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Sr.', 7.6, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('Product Details', 35.7, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('MANUFACTURER', 70.4, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('BATCH', 89.75, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('EXPIRY', 107.6, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('Qty', 123.4, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('Rate', 137.65, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('GST %', 152.45, tblHeadStartY + 5.5, { align: 'center' });
  doc.text('Rate', 171.35, tblHeadStartY + 3.8, { align: 'center' });
  doc.text('(With GST)', 171.35, tblHeadStartY + 7.2, { align: 'center' });
  doc.text('Total', 195.3, tblHeadStartY + 5.5, { align: 'center' });

  // Table body rows
  const maxRowsInBody = Math.max(1, Math.floor(currentHTblBody / 7.2));
  const rowHeightMm = currentHTblBody / maxRowsInBody;
  const displayItems = items.slice(0, maxRowsInBody);

  for (let r = 0; r < maxRowsInBody; r++) {
    const rowY = tblBodyStartY + r * rowHeightMm;
    const item = displayItems[r];

    // Horizontal divider for row
    if (r < maxRowsInBody) {
      doc.setLineWidth(0.35);
      doc.line(marginX, rowY + rowHeightMm, rightX, rowY + rowHeightMm);
    }

    if (item) {
      const textBaselineY = rowY + (rowHeightMm / 2) + 1.2;

      // Col 0: Sr.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(String(r + 1), 7.6, textBaselineY, { align: 'center' });

      // Col 1: Product Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const pNameSplit = doc.splitTextToSize(item.name.toUpperCase(), 45);
      doc.text(pNameSplit[0] || item.name.toUpperCase(), 13.5, textBaselineY);

      // Col 2: Manufacturer
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      const mfgSplit = doc.splitTextToSize(item.manufacturer || '-', 21);
      doc.text(mfgSplit[0] || item.manufacturer || '-', 70.4, textBaselineY, { align: 'center' });

      // Col 3: Batch
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(item.batch || '-', 89.75, textBaselineY, { align: 'center' });

      // Col 4: Expiry
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(item.expiry || '-', 107.6, textBaselineY, { align: 'center' });

      // Col 5: Qty
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const qtyStr = typeof item.quantity === 'number' ? (Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(1)) : String(item.quantity);
      doc.text(qtyStr, 123.4, textBaselineY, { align: 'center' });

      // Col 6: Rate
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(formatInvoiceNumber(item.rate), 144.5, textBaselineY, { align: 'right' });

      // Col 7: GST %
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(formatGstPercent(item.gstRate), 152.45, textBaselineY, { align: 'center' });

      // Col 8: Rate (With GST)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(formatInvoiceNumber(item.rateWithGst), 182.0, textBaselineY, { align: 'right' });

      // Col 9: Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(formatInvoiceNumber(item.total), 205.5, textBaselineY, { align: 'right' });
    }
  }

  // Draw vertical dividers for entire body height
  for (let c = 1; c < colX.length - 1; c++) {
    doc.setLineWidth(0.35);
    doc.line(colX[c], tblBodyStartY, colX[c], tblBodyEndY);
  }

  // ════════════════════════════════════════════════════════
  // 4. TOTALS & ADJUSTMENTS (7.5mm or 11.5mm)
  // ════════════════════════════════════════════════════════
  const totalsStartY = tblBodyEndY;
  const totalsEndY = totalsStartY + currentHTotals;

  doc.setLineWidth(0.45);
  doc.line(marginX, totalsEndY, rightX, totalsEndY);

  if (!hasAdjustments) {
    // 4 Columns: Taxable (40.8mm) | CGST (28.56mm) | SGST (55.08mm) | Net Total (79.56mm)
    const tX1 = marginX + 40.8; // 43.8
    const tX2 = tX1 + 28.56;   // 72.36
    const tX3 = tX2 + 55.08;   // 127.44

    doc.setLineWidth(0.35);
    doc.line(tX1, totalsStartY, tX1, totalsEndY);
    doc.line(tX2, totalsStartY, tX2, totalsEndY);
    doc.line(tX3, totalsStartY, tX3, totalsEndY);

    const textTotalsY = totalsStartY + 4.8;
    
    // Taxable
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TAXABLE', marginX + 2, textTotalsY);
    renderRightAlignedCurrency(doc, taxableTotal, tX1 - 2, textTotalsY, 8.0, 'bold');

    // CGST
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('CGST', tX1 + 2, textTotalsY);
    renderRightAlignedCurrency(doc, cgstTotal, tX2 - 2, textTotalsY, 8.0, 'bold');

    // SGST
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('SGST', tX2 + 2, textTotalsY);
    renderRightAlignedCurrency(doc, sgstTotal, tX3 - 2, textTotalsY, 8.0, 'bold');

    // Net Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('NET TOTAL', tX3 + 2.5, textTotalsY);
    renderRightAlignedCurrency(doc, netTotal, rightX - 2.5, textTotalsY + 0.3, 11.5, 'bold');
  } else {
    // With Adjustments: Left 61% (124.44mm) divided in 2 sub-rows, Right 39% (79.56mm) Net Total
    const adjSplitX = marginX + (width * 0.61); // 127.44mm
    const adjSubRowY = totalsStartY + 5.5;

    doc.setLineWidth(0.35);
    doc.line(adjSplitX, totalsStartY, adjSplitX, totalsEndY);
    doc.line(marginX, adjSubRowY, adjSplitX, adjSubRowY);

    const subColW = (adjSplitX - marginX) / 3;
    doc.line(marginX + subColW, totalsStartY, marginX + subColW, adjSubRowY);
    doc.line(marginX + subColW * 2, totalsStartY, marginX + subColW * 2, adjSubRowY);

    // Sub-row 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TAXABLE', marginX + 2, totalsStartY + 3.8);
    renderRightAlignedCurrency(doc, taxableTotal, marginX + subColW - 2, totalsStartY + 3.8, 7.8, 'bold');

    doc.setFont('helvetica', 'bold');
    doc.text('CGST', marginX + subColW + 2, totalsStartY + 3.8);
    renderRightAlignedCurrency(doc, cgstTotal, marginX + subColW * 2 - 2, totalsStartY + 3.8, 7.8, 'bold');

    doc.setFont('helvetica', 'bold');
    doc.text('SGST', marginX + subColW * 2 + 2, totalsStartY + 3.8);
    renderRightAlignedCurrency(doc, sgstTotal, adjSplitX - 2, totalsStartY + 3.8, 7.8, 'bold');

    // Sub-row 2: Adjustments text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Adjustments:', marginX + 2, totalsStartY + 9.2);

    renderAdjustmentsText(doc, adjustments, marginX + 22, totalsStartY + 9.2, 7.5);

    // Right: Net Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('NET TOTAL', adjSplitX + 2.5, totalsStartY + 5);
    doc.setFontSize(6.5);
    doc.text('(Incl. Adjustments)', adjSplitX + 2.5, totalsStartY + 8.5);
    renderRightAlignedCurrency(doc, netTotal, rightX - 2.5, totalsStartY + 6.5, 11.5, 'bold');
  }

  // ════════════════════════════════════════════════════════
  // 5. BOTTOM SECTION (28.5mm, Bank Details | Ledger | Signatures)
  // ════════════════════════════════════════════════════════
  const bottomStartY = totalsEndY;
  const bottomEndY = bottomStartY + H_BOTTOM;

  doc.setLineWidth(0.45);
  doc.line(marginX, bottomEndY, rightX, bottomEndY);

  const bCol1 = marginX + (width * 0.33); // 70.32mm
  const bCol2 = marginX + (width * 0.61); // 127.44mm

  doc.setLineWidth(0.35);
  doc.line(bCol1, bottomStartY, bCol1, bottomEndY);
  doc.line(bCol2, bottomStartY, bCol2, bottomEndY);

  // 5A. Bank Details (Left 33%, x = 3 to 70.32)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Bank details', marginX + 2, bottomStartY + 4.2);

  const bRowH = 4.6;
  const bTextY = bottomStartY + 8.5;
  doc.setFontSize(7.5);

  doc.text('Bank Name', marginX + 2, bTextY);
  doc.text(':', marginX + 18, bTextY);
  doc.text(shop.bankName || '-', marginX + 21, bTextY);

  doc.text('A/C No', marginX + 2, bTextY + bRowH);
  doc.text(':', marginX + 18, bTextY + bRowH);
  doc.setFont('helvetica', 'bold');
  doc.text(shop.accountNumber || '-', marginX + 21, bTextY + bRowH);

  doc.text('IFSC Code', marginX + 2, bTextY + bRowH * 2);
  doc.text(':', marginX + 18, bTextY + bRowH * 2);
  doc.setFont('helvetica', 'bold');
  doc.text(shop.ifsc || '-', marginX + 21, bTextY + bRowH * 2);

  doc.text('Branch', marginX + 2, bTextY + bRowH * 3);
  doc.text(':', marginX + 18, bTextY + bRowH * 3);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.branch || '-', marginX + 21, bTextY + bRowH * 3);

  doc.setFont('helvetica', 'bold');
  doc.text('A/C Type', marginX + 2, bTextY + bRowH * 4);
  doc.text(':', marginX + 18, bTextY + bRowH * 4);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.accountType || '-', marginX + 21, bTextY + bRowH * 4);

  // 5B. Amount in Words + Ledger (Middle 28%, x = 70.32 to 127.44)
  const ledgerSplitY = bottomStartY + (H_BOTTOM / 2);
  doc.setLineWidth(0.35);
  doc.line(bCol1, ledgerSplitY, bCol2, ledgerSplitY);

  // Top: Amount in words
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('Amount in words', bCol1 + 2, bottomStartY + 4.2);
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7);
  const wordsStr = `${cleanWords} Rupees Only`;
  const splitWords = doc.splitTextToSize(wordsStr, 53);
  doc.text(splitWords.slice(0, 2), bCol1 + 2, bottomStartY + 8.2);

  // Bottom: Ledger summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Opening Bal', bCol1 + 2, ledgerSplitY + 4.2);
  doc.text(':', bCol1 + 22, ledgerSplitY + 4.2);
  renderRightAlignedCurrency(doc, openingBal, bCol2 - 2, ledgerSplitY + 4.2, 7.5, 'bold');

  doc.setFont('helvetica', 'bold');
  doc.text('Cr Invoice', bCol1 + 2, ledgerSplitY + 8.4);
  doc.text(':', bCol1 + 22, ledgerSplitY + 8.4);
  renderRightAlignedCurrency(doc, crInvoice, bCol2 - 2, ledgerSplitY + 8.4, 7.5, 'bold');

  doc.setFont('helvetica', 'bold');
  doc.text('Closing balance', bCol1 + 2, ledgerSplitY + 12.6);
  doc.text(':', bCol1 + 22, ledgerSplitY + 12.6);
  renderRightAlignedCurrency(doc, closingBalance, bCol2 - 2, ledgerSplitY + 12.6, 7.5, 'bold');

  // 5C & 5D. Signatures & UPI QR (Right 39%, x = 127.44 to 207)
  if (upiQrAmount > 0 && shop.upiId) {
    try {
      const upiUri = buildUpiUri(shop.upiId, shop.shopName, upiQrAmount);
      const qr = QRCode.create(upiUri, { errorCorrectionLevel: 'M' });
      const qrSizeMm = 15;
      const qrX = bCol2 + 3;
      const qrY = bottomStartY + 1.5;
      const moduleCount = qr.modules.size;
      const moduleSize = qrSizeMm / moduleCount;

      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.modules.get(r, c)) {
            doc.rect(qrX + c * moduleSize, qrY + r * moduleSize, moduleSize, moduleSize, 'F');
          }
        }
      }

      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(`UPI: ${shop.upiId}`, qrX + qrSizeMm / 2, qrY + qrSizeMm + 3, { align: 'center' });
      
      // UPI Amount
      renderCenteredCurrency(doc, upiQrAmount, qrX + qrSizeMm / 2, qrY + qrSizeMm + 6.2, 6.8, 'bold');
      
      if (isPartial) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.text('(UPI Portion)', qrX + qrSizeMm / 2, qrY + qrSizeMm + 8.8, { align: 'center' });
      }
    } catch (err) {
      console.warn('PDF QR generation error:', err);
    }

    // Signatures with QR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text((shop.authorizedSignatory || shop.shopName || '').toUpperCase(), rightX - 2, bottomStartY + 4.5, { align: 'right' });

    doc.setFontSize(7.5);
    doc.text('Customer sign', bCol2 + 24, bottomEndY - 2.5);
    doc.text('Authorized Sign', rightX - 2, bottomEndY - 2.5, { align: 'right' });
  } else {
    // Signatures without QR
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text((shop.authorizedSignatory || shop.shopName || '').toUpperCase(), rightX - 2.5, bottomStartY + 5.5, { align: 'right' });

    doc.setFontSize(8);
    doc.text('Customer sign', bCol2 + 4, bottomEndY - 2.5);
    doc.text('Authorized Sign', rightX - 2.5, bottomEndY - 2.5, { align: 'right' });
  }

  // ════════════════════════════════════════════════════════
  // 6. TERMS & CONDITIONS (11.5mm if configured)
  // ════════════════════════════════════════════════════════
  let currentFooterTopY = bottomEndY;
  if (hasTerms) {
    const termsStartY = bottomEndY;
    const termsEndY = termsStartY + H_TERMS;
    currentFooterTopY = termsEndY;

    doc.setLineWidth(0.45);
    doc.line(marginX, termsEndY, rightX, termsEndY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TERMS & CONDITIONS:', marginX + 2, termsStartY + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const splitTerms = doc.splitTextToSize(cleanTerms, 198);
    doc.text(splitTerms.slice(0, 3), marginX + 2, termsStartY + 6.8);
  }

  // ════════════════════════════════════════════════════════
  // 7. FOOTER (4.5mm)
  // ════════════════════════════════════════════════════════
  const footerTextY = bottomY - 1.4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(0, 0, 0);

  const docTitle = isReturnDoc ? 'SALES RETURN / CREDIT NOTE' : 'TAX INVOICE';
  doc.text(`THIS IS COMPUTER GENERATED ${docTitle}`, marginX + 2, footerTextY);

  const jurisdiction = shop.district ? shop.district.toUpperCase() : (shop.state ? shop.state.toUpperCase() : 'LOCAL');
  doc.text(`SUBJECT TO ${jurisdiction} JURISDICTION`, marginX + (width / 2), footerTextY, { align: 'center' });

  doc.text('PAGE 1 OF 1', rightX - 2, footerTextY, { align: 'right' });

  return doc;
}
