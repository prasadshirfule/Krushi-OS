import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatCurrency, numberToWords } from './utils';
import { 
  ShopDetails, 
  DEFAULT_SHOP_DETAILS, 
  getSavedShopDetails, 
  formatShopAddress 
} from './shop-details';
import { formatProductNameWithSize } from './validations';
import { buildUpiUri } from './upi';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export function formatInvoiceExpiry(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '-';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '-';

  // Already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // If in YYYY-MM-DD or ISO format (e.g. 2028-12-31 or 2028-12-31T00:00:00.000Z)
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

export function generateInvoicePDF(sale: any, customSettings?: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const s = sale || {};
  const marginX = 8;
  const contentWidth = 194;
  const startTopY = 8;
  let currentY = startTopY;

  // Resolve shop details from storage / props
  const baseShop = getSavedShopDetails();
  const shop: ShopDetails = {
    ...baseShop,
    ...(customSettings || {}),
  };

  const dynamicAddress = formatShopAddress(shop);

  // ─── 1. SHOP HEADER ───
  currentY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(shop.shopName || 'KRUSHI SEVA KENDRA', marginX + 4, currentY + 2);

  // License and TAX INVOICE Badge on top right
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (shop.licenseNumber) {
    doc.text(`Lic No: ${shop.licenseNumber}`, marginX + contentWidth - 4, currentY - 1, { align: 'right' });
  }
  if (shop.registrationNumber) {
    doc.text(`Reg No: ${shop.registrationNumber}`, marginX + contentWidth - 4, currentY + 2.5, { align: 'right' });
  }

  // Tax Invoice Badge
  doc.setFillColor(0, 0, 0);
  doc.rect(marginX + contentWidth - 36, currentY + 5, 32, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', marginX + contentWidth - 20, currentY + 9, { align: 'center' });

  // Shop Address & Contacts
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  if (dynamicAddress) {
    const addressLines = doc.splitTextToSize(dynamicAddress, contentWidth - 45);
    doc.text(addressLines, marginX + 4, currentY);
    currentY += (addressLines.length - 1) * 3.5;
  }

  currentY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const contactParts: string[] = [];
  if (shop.ownerName) contactParts.push(`Pro: ${shop.ownerName}`);
  if (shop.contact1) contactParts.push(`Mob: ${shop.contact1}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('   |   '), marginX + 4, currentY);
  }

  currentY += 4;
  if (shop.gstNumber) {
    doc.text(`GSTIN: ${shop.gstNumber}`, marginX + 4, currentY);
  }

  // Divider Line
  currentY += 3.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  // ─── 2. CUSTOMER & BILL INFO ───
  const customerName = (s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || 'WALK-IN CUSTOMER').toUpperCase();
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || '';
  const customerAddress = [
    s.customer?.village || s.customer?.address || s.customer_village || s.customer_address || '',
    s.customer?.district || '',
    s.customer?.state || ''
  ].filter(Boolean).join(', ');
  const customerGstin = s.customer?.gstin || s.customer?.gst_number || '';
  const customerMobile = customerPhone;

  // Invoice identifiers & metadata
  const invNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : 'KOS-2026-001');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const isUpi = (s.payment_method || s.payment_mode || s.paymentMethod || s.payments?.[0]?.method || '').toUpperCase() === 'UPI';
  const paymentBadge = isCredit ? '[R] Credit Bill' : (isUpi ? '[R] UPI Bill' : '[R] Cash Bill');
  const paymentMode = isUpi ? 'UPI' : (isCredit ? 'Credit' : (s.payment_method || s.payment_mode || s.paymentMethod || 'Cash'));

  const midX = marginX + 104;
  const section2TopY = currentY;
  const infoStartY = currentY + 3.5;

  // Left Column: Customer details (max width: 94mm)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('CUSTOMER DETAILS:', marginX + 4, infoStartY);

  let leftY = infoStartY + 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const nameLines = doc.splitTextToSize(`Name: ${customerName}`, 92);
  doc.text(nameLines, marginX + 4, leftY);
  leftY += nameLines.length * 3.5;

  doc.setFont('helvetica', 'normal');
  if (customerAddress) {
    const addrLines = doc.splitTextToSize(`Address: ${customerAddress}`, 92);
    doc.text(addrLines, marginX + 4, leftY);
    leftY += addrLines.length * 3.5;
  }
  const custContactLine = [customerMobile ? `Mob: ${customerMobile}` : '', customerGstin ? `GSTIN: ${customerGstin}` : ''].filter(Boolean).join('   |   ');
  if (custContactLine) {
    const contactLines = doc.splitTextToSize(custContactLine, 92);
    doc.text(contactLines, marginX + 4, leftY);
    leftY += contactLines.length * 3.5;
  }

  // Right Column: Bill details (max width: 84mm)
  let rightY = infoStartY;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('INVOICE DETAILS:', midX, rightY);
  rightY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Bill No: ${invNo}   (${paymentBadge})`, midX, rightY);
  rightY += 3.6;
  doc.text(`Date: ${formattedDate} (${formattedTime})`, midX, rightY);
  rightY += 3.6;
  const payInfo = `Payment: ${paymentMode}${isUpi && shop.upiId ? ` (${shop.upiId})` : ''}   |   Place: ${shop.district || 'Maharashtra'}`;
  const payLines = doc.splitTextToSize(payInfo, 82);
  doc.text(payLines, midX, rightY);
  rightY += payLines.length * 3.6;

  const section2Height = Math.max(18, (leftY - section2TopY), (rightY - section2TopY)) + 2;

  // Vertical line separating customer and bill details
  doc.line(midX - 3, section2TopY, midX - 3, section2TopY + section2Height);

  // Divider Line
  currentY = section2TopY + section2Height;
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  // ─── 3. PRODUCT TABLE ───
  const rawItems = s.items || s.sale_items || [];
  let tableRows: any[] = [];
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let grandTotal = 0;

  if (rawItems.length > 0) {
    tableRows = rawItems.map((item: any, idx: number) => {
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

      // Exact reverse GST math
      const taxable = Math.round((lineTotal / (1 + gst / 100)) * 100) / 100;
      const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;
      const rateWithGst = unitPrice;

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      grandTotal += lineTotal;

      const rawBatch = item.batch_number || item.batch?.batch_number || item.item_batches?.[0]?.batch?.batch_number || p.batches?.[0]?.batch_number || p.batch_number || '';
      const batch = (rawBatch && rawBatch !== 'null' && rawBatch !== 'undefined' && String(rawBatch).trim() !== '-')
        ? String(rawBatch).trim()
        : '-';

      const rawExpiry = item.expiry_date || item.batch?.expiry_date || item.item_batches?.[0]?.batch?.expiry_date || p.batches?.[0]?.expiry_date || p.expiry_date || '';
      const expiry = formatInvoiceExpiry(rawExpiry);

      const mfg = (item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '-').toUpperCase();
      const prodRawName = item.product_name || item.name || p.name || `Item ${idx + 1}`;
      const packSize = item.pack_size || p.pack_size || ((item.product_size_value || p.product_size_value) ? `${item.product_size_value || p.product_size_value} ${item.product_size_unit || p.product_size_unit || 'KG'}` : '');
      const unit = item.unit || p.unit || '';
      const prodName = formatProductNameWithSize(prodRawName, packSize, unit);

      return [
        idx + 1,
        prodName,
        mfg || '-',
        batch,
        expiry,
        qty,
        rateWithGst.toFixed(2),
        `${gst}%`,
        rateWithGst.toFixed(2),
        lineTotal.toFixed(2),
      ];
    });
  }

  // Adjust grandTotal by additions and deductions
  const adjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  const totalAdditions = adjustments.filter(a => a.type === 'ADD').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments.filter(a => a.type === 'DEDUCT').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  grandTotal = Math.max(0, grandTotal + totalAdditions - totalDeductions);

  // Minor visual padding only if very few items (1 or 2 items)
  if (tableRows.length > 0 && tableRows.length < 3) {
    while (tableRows.length < 3) {
      tableRows.push(['', '', '', '', '', '', '', '', '', '']);
    }
  }

  doc.autoTable({
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [['Sr.', 'Product Details', 'Manufacturer', 'BATCH', 'EXPIRY', 'Qty', 'Rate', 'GST %', 'Rate (With GST)', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      fontSize: 8,
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 48, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right', cellWidth: 22 },
      9: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 40;

  // ─── 4. SUMMARY, OWNER BANK DETAILS & TAX BREAKDOWN ───
  const summaryLeftWidth = 114;
  const summaryRightWidth = contentWidth - summaryLeftWidth; // 80mm

  const rows: Array<{ label: string; val: string; isBold?: boolean; isHighlight?: boolean }> = [
    { label: 'Taxable Amount:', val: `Rs. ${totalTaxable.toFixed(2)}` },
    { label: 'CGST Amount:', val: `Rs. ${totalCgst.toFixed(2)}` },
    { label: 'SGST Amount:', val: `Rs. ${totalSgst.toFixed(2)}` },
  ];

  adjustments.forEach((adj: any) => {
    const isAdd = adj.type === 'ADD';
    rows.push({
      label: `${adj.reason || 'Adj'} (${isAdd ? '+' : '-'}):`,
      val: `${isAdd ? 'Rs.' : '-Rs.'} ${Number(adj.amount || 0).toFixed(2)}`,
    });
  });

  rows.push(
    { label: 'NET TOTAL:', val: `Rs. ${grandTotal.toFixed(2)}`, isBold: true, isHighlight: true },
    { label: 'Amount Paid:', val: `Rs. ${(s.paid_amount ?? grandTotal).toFixed(2)}` },
    { label: 'Balance / Udhari:', val: `Rs. ${(isCredit ? Math.max(0, grandTotal - (s.paid_amount || 0)) : 0).toFixed(2)}`, isBold: true },
  );

  const rowHeight = 5.8;
  const summaryHeight = Math.max(42, rows.length * rowHeight);

  // Left Box: Words, Bank Details, Terms
  doc.rect(marginX, finalY, summaryLeftWidth, summaryHeight);
  // Right Box: Financials
  doc.rect(marginX + summaryLeftWidth, finalY, summaryRightWidth, summaryHeight);

  // Left Content:
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', marginX + 3, finalY + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  const amountWords = `${numberToWords(grandTotal)} Rupees Only`;
  const splitWords = doc.splitTextToSize(amountWords, summaryLeftWidth - 6);
  doc.text(splitWords.slice(0, 2), marginX + 3, finalY + 8);

  // OWNER BANK DETAILS SECTION
  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BANK DETAILS', marginX + 3, finalY + 15);
  doc.line(marginX + 3, finalY + 16.5, marginX + summaryLeftWidth - 6, finalY + 16.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('A/C Holder:', marginX + 3, finalY + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.accountName || shop.ownerName || '-', marginX + 22, finalY + 20.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Bank:', marginX + 62, finalY + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.bankName || '-', marginX + 72, finalY + 20.5);

  doc.setFont('helvetica', 'bold');
  doc.text('A/C No.:', marginX + 3, finalY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.accountNumber || '-', marginX + 22, finalY + 25);

  doc.setFont('helvetica', 'bold');
  doc.text('IFSC:', marginX + 62, finalY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.ifsc || '-', marginX + 72, finalY + 25);

  if (shop.branch || shop.accountType) {
    if (shop.branch) {
      doc.setFont('helvetica', 'bold');
      doc.text('Branch:', marginX + 3, finalY + 29.5);
      doc.setFont('helvetica', 'normal');
      doc.text(shop.branch, marginX + 22, finalY + 29.5);
    }
    if (shop.accountType) {
      doc.setFont('helvetica', 'bold');
      doc.text('A/C Type:', marginX + 62, finalY + 29.5);
      doc.setFont('helvetica', 'normal');
      doc.text(shop.accountType, marginX + 76, finalY + 29.5);
    }
  }

  // Terms & Conditions at bottom left
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', marginX + 3, finalY + 34);
  doc.setFont('helvetica', 'normal');
  const termsText = shop.invoiceTerms || '1. Goods once sold will not be accepted back.\n2. Interest @ 18% p.a. charged if payment not made on time.\n3. Subject to local jurisdiction only.';
  const splitTerms = doc.splitTextToSize(termsText, summaryLeftWidth - 6);
  doc.text(splitTerms.slice(0, 2), marginX + 3, finalY + 37);

  // Right Content (Bordered Tax Calculation lines):
  const rightX = marginX + summaryLeftWidth;
  const actualRowH = summaryHeight / rows.length;

  rows.forEach((row, i) => {
    const lineY = finalY + (i * actualRowH);
    if (row.isHighlight) {
      doc.setFillColor(240, 240, 240);
      doc.rect(rightX, lineY, summaryRightWidth, actualRowH, 'F');
    }
    doc.line(rightX, lineY + actualRowH, rightX + summaryRightWidth, lineY + actualRowH);

    doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
    doc.setFontSize(row.isHighlight ? 8.5 : 7.5);
    const textOffsetY = actualRowH * 0.68;
    doc.text(row.label, rightX + 2.5, lineY + textOffsetY);
    doc.text(row.val, rightX + summaryRightWidth - 2.5, lineY + textOffsetY, { align: 'right' });
  });

  // ─── 5. SIGNATURE BLOCK ───
  const signY = finalY + summaryHeight;
  const signHeight = 20;
  doc.rect(marginX, signY, contentWidth, signHeight);

  if (isUpi && shop.upiId && grandTotal > 0) {
    try {
      const upiUri = buildUpiUri(shop.upiId, shop.shopName, grandTotal);
      const qr = QRCode.create(upiUri, { errorCorrectionLevel: 'M' });
      const qrSizeMm = 13;
      const qrX = marginX + (contentWidth / 2) - (qrSizeMm / 2);
      const qrY = signY + 1.5;
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
      doc.setTextColor(0, 0, 0);
      doc.text(`UPI: ${shop.upiId}`, qrX + qrSizeMm / 2, qrY + qrSizeMm + 2.5, { align: 'center' });
    } catch (err) {
      console.warn('PDF QR generation error:', err);
    }
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Customer Signature', marginX + 25, signY + signHeight - 3, { align: 'center' });
  doc.line(marginX + 10, signY + signHeight - 6, marginX + 40, signY + signHeight - 6);

  doc.text(shop.authorizedSignatory || `For ${shop.shopName || 'Krushi Seva Kendra'}`, marginX + contentWidth - 35, signY + 5.5, { align: 'center' });
  doc.text('Authorized Signatory', marginX + contentWidth - 35, signY + signHeight - 3, { align: 'center' });
  doc.line(marginX + contentWidth - 55, signY + signHeight - 6, marginX + contentWidth - 15, signY + signHeight - 6);

  // ─── 6. BORDERED FOOTER ───
  const footerY = signY + signHeight;
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, footerY, contentWidth, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text('This Is Computer Generated Tax Invoice', marginX + 4, footerY + 4.2);
  doc.text(`Subject To ${shop.district ? `${shop.district} ` : ''}Jurisdiction`, marginX + (contentWidth / 2), footerY + 4.2, { align: 'center' });
  doc.text('Page 1 of 1', marginX + contentWidth - 4, footerY + 4.2, { align: 'right' });

  // ─── 7. DYNAMIC OUTER BOUNDING FRAME ───
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, startTopY, contentWidth, (footerY + 6.5) - startTopY);

  return doc;
}
