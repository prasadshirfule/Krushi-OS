import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, numberToWords } from './utils';
import { 
  ShopDetails, 
  DEFAULT_SHOP_DETAILS, 
  getSavedShopDetails, 
  formatShopAddress 
} from './shop-details';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
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
  let currentY = 8;

  // Resolve shop details from storage / props
  const baseShop = getSavedShopDetails();
  const shop: ShopDetails = {
    ...baseShop,
    ...(customSettings || {}),
  };

  const dynamicAddress = formatShopAddress(shop);

  // Outer border for the physical tax invoice
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, currentY, contentWidth, 281);

  // ─── 1. SHOP HEADER ───
  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(shop.shopName || 'KRUSHI SEVA KENDRA', marginX + 4, currentY + 2);

  // License and TAX INVOICE Badge on top right
  doc.setFontSize(7.5);
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
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('TAX INVOICE', marginX + contentWidth - 20, currentY + 9, { align: 'center' });

  // Shop Address & Contacts
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  if (dynamicAddress) {
    doc.text(dynamicAddress, marginX + 4, currentY);
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
  currentY += 4;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  // ─── 2. CUSTOMER & BILL INFO ───
  const customerName = s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || 'Walk-in Customer';
  const customerMobile = s.customer?.phone || s.customer?.mobile || s.customer_phone || '';
  const customerAddress = [s.customer?.village || s.customer?.address, s.customer?.district].filter(Boolean).join(', ');
  const customerGstin = s.customer?.gstin || '';

  const invNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : '1');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const paymentBadge = isCredit ? '[R] Credit Bill' : '[R] Cash Bill';
  const paymentMode = s.payment_method || s.payment_mode || s.paymentMethod || 'Cash';

  const midX = marginX + 105;
  const infoStartY = currentY + 4;

  // Left: Customer details
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 70, 70);
  doc.text('CUSTOMER DETAILS:', marginX + 4, infoStartY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Name: ${customerName}`, marginX + 4, infoStartY + 4);
  if (customerAddress) {
    doc.text(`Address: ${customerAddress}`, marginX + 4, infoStartY + 8);
  }
  const custContactLine = [customerMobile ? `Mob: ${customerMobile}` : '', customerGstin ? `GSTIN: ${customerGstin}` : ''].filter(Boolean).join('   |   ');
  if (custContactLine) {
    doc.text(custContactLine, marginX + 4, infoStartY + (customerAddress ? 12 : 8));
  }

  // Right: Bill details
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 70, 70);
  doc.text('INVOICE DETAILS:', midX, infoStartY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Bill No: ${invNo}   (${paymentBadge})`, midX, infoStartY + 4);
  doc.text(`Date: ${formattedDate} (${formattedTime})`, midX, infoStartY + 8);
  doc.text(`Payment: ${paymentMode}   |   Place: ${shop.district || 'Maharashtra'}`, midX, infoStartY + 12);

  // Vertical line separating customer and bill details
  doc.line(midX - 3, currentY, midX - 3, currentY + 18);

  // Divider Line
  currentY += 18;
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
      const qty = Number(item.quantity || 1);
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 0);
      const lineTotal = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * Number(item.unit_price ?? item.selling_price ?? 0)));

      // Exact reverse GST math
      const taxable = Math.round((lineTotal / (1 + gst / 100)) * 100) / 100;
      const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;
      const taxableRate = Math.round((taxable / qty) * 100) / 100;
      const rateWithGst = Math.round((lineTotal / qty) * 100) / 100;

      totalTaxable += taxable;
      totalCgst += cgst;
      totalSgst += sgst;
      grandTotal += lineTotal;

      let expiry = item.expiry_date || item.batch?.expiry_date || p.expiry_date || '-';
      if (expiry.includes('T')) {
        const d = new Date(expiry);
        if (!isNaN(d.getTime())) {
          expiry = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      }

      const mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      const prodName = item.product_name || item.name || p.name || `Item ${idx + 1}`;
      const nameWithMfg = mfg ? `${prodName}\nMfg: ${mfg}` : prodName;

      return [
        idx + 1,
        nameWithMfg,
        item.hsn_code || p.hsn_code || p.hsnCode || '-',
        item.batch_number || item.batch?.batch_number || p.batch_number || '-',
        expiry,
        qty,
        taxableRate.toFixed(2),
        `${gst}%`,
        rateWithGst.toFixed(2),
        lineTotal.toFixed(2),
      ];
    });
  }

  // Pad table rows if few items to maintain realistic physical bill height
  while (tableRows.length < 5) {
    tableRows.push(['', '', '', '', '', '', '', '', '', '']);
  }

  doc.autoTable({
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [['Sr.', 'Product Details', 'HSN', 'BATCH', 'EXPIRY', 'Qty', 'Rate', 'GST %', 'Rate (With GST)', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      fontSize: 7.5,
      halign: 'center',
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 60, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 19, fontStyle: 'bold' },
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;

  // ─── 4. SUMMARY, OWNER BANK DETAILS & TAX BREAKDOWN ───
  const summaryLeftWidth = 115;
  const summaryRightWidth = contentWidth - summaryLeftWidth; // 79mm
  const summaryHeight = 45;

  // Left Box: Words, Bank Details, Terms
  doc.rect(marginX, finalY, summaryLeftWidth, summaryHeight);
  // Right Box: Financials
  doc.rect(marginX + summaryLeftWidth, finalY, summaryRightWidth, summaryHeight);

  // Left Content:
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', marginX + 3, finalY + 5);
  doc.setFont('helvetica', 'italic');
  const amountWords = `${numberToWords(grandTotal)} Rupees Only`;
  const splitWords = doc.splitTextToSize(amountWords, summaryLeftWidth - 6);
  doc.text(splitWords, marginX + 3, finalY + 9);

  // OWNER BANK DETAILS SECTION (Replaced QR code as requested)
  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BANK DETAILS', marginX + 3, finalY + 16);
  doc.line(marginX + 3, finalY + 17.5, marginX + summaryLeftWidth - 6, finalY + 17.5);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.text('A/C Holder:', marginX + 3, finalY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.accountName || shop.ownerName || '-', marginX + 22, finalY + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('Bank:', marginX + 65, finalY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.bankName || '-', marginX + 76, finalY + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('A/C No.:', marginX + 3, finalY + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.accountNumber || '-', marginX + 22, finalY + 27);

  doc.setFont('helvetica', 'bold');
  doc.text('IFSC:', marginX + 65, finalY + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.ifsc || '-', marginX + 76, finalY + 27);

  if (shop.branch || shop.accountType) {
    if (shop.branch) {
      doc.setFont('helvetica', 'bold');
      doc.text('Branch:', marginX + 3, finalY + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(shop.branch, marginX + 22, finalY + 32);
    }
    if (shop.accountType) {
      doc.setFont('helvetica', 'bold');
      doc.text('A/C Type:', marginX + 65, finalY + 32);
      doc.setFont('helvetica', 'normal');
      doc.text(shop.accountType, marginX + 78, finalY + 32);
    }
  }

  // Terms & Conditions at bottom left
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', marginX + 3, finalY + 36);
  doc.setFont('helvetica', 'normal');
  doc.text(shop.invoiceTerms || '1. Goods once sold will not be accepted back.\n2. Interest @ 18% p.a. charged if payment not made on time.\n3. Subject to local jurisdiction only.', marginX + 3, finalY + 39);

  // Right Content (Bordered Tax Calculation lines):
  const rightX = marginX + summaryLeftWidth;
  let lineY = finalY;
  const rightRowHeight = 7.5;

  const rows = [
    { label: 'Taxable Amount:', val: `Rs. ${totalTaxable.toFixed(2)}` },
    { label: 'CGST Amount:', val: `Rs. ${totalCgst.toFixed(2)}` },
    { label: 'SGST Amount:', val: `Rs. ${totalSgst.toFixed(2)}` },
    { label: 'NET TOTAL:', val: `Rs. ${grandTotal.toFixed(2)}`, isBold: true, isHighlight: true },
    { label: 'Amount Paid:', val: `Rs. ${(s.paid_amount ?? grandTotal).toFixed(2)}` },
    { label: 'Balance / Udhari:', val: `Rs. ${(isCredit ? Math.max(0, grandTotal - (s.paid_amount || 0)) : 0).toFixed(2)}`, isBold: true },
  ];

  rows.forEach((row, i) => {
    lineY = finalY + (i * rightRowHeight);
    if (row.isHighlight) {
      doc.setFillColor(240, 240, 240);
      doc.rect(rightX, lineY, summaryRightWidth, rightRowHeight, 'F');
    }
    doc.line(rightX, lineY + rightRowHeight, rightX + summaryRightWidth, lineY + rightRowHeight);

    doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
    doc.setFontSize(row.isHighlight ? 8.5 : 7.5);
    doc.text(row.label, rightX + 3, lineY + 5);
    doc.text(row.val, rightX + summaryRightWidth - 3, lineY + 5, { align: 'right' });
  });

  // ─── 5. SIGNATURE BLOCK ───
  const signY = finalY + summaryHeight;
  const signHeight = 22;
  doc.rect(marginX, signY, contentWidth, signHeight);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Signature', marginX + 25, signY + signHeight - 3, { align: 'center' });
  doc.line(marginX + 10, signY + signHeight - 6, marginX + 40, signY + signHeight - 6);

  doc.text(shop.authorizedSignatory || `For ${shop.shopName || 'Krushi Seva Kendra'}`, marginX + contentWidth - 35, signY + 6, { align: 'center' });
  doc.text('Authorized Signatory', marginX + contentWidth - 35, signY + signHeight - 3, { align: 'center' });
  doc.line(marginX + contentWidth - 55, signY + signHeight - 6, marginX + contentWidth - 15, signY + signHeight - 6);

  // ─── 6. BORDERED FOOTER ───
  const footerY = signY + signHeight;
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, footerY, contentWidth, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text('This Is Computer Generated Tax Invoice', marginX + 4, footerY + 4.5);
  doc.text(`Subject To ${shop.district ? `${shop.district} ` : ''}Jurisdiction`, marginX + (contentWidth / 2), footerY + 4.5, { align: 'center' });
  doc.text('Page 1 of 1', marginX + contentWidth - 4, footerY + 4.5, { align: 'right' });

  return doc;
}
