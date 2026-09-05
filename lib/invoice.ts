import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, numberToWords } from './utils';
import type { SaleWithItems } from '@/types/sales';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// ─── DEMO DETAILS AS SPECIFIED BY USER ───
const DEMO_DETAILS = {
  shopName: 'DEMO KRUSHI SEVA KENDRA',
  address: 'At Demo Village, Demo Taluka, Demo District, Maharashtra',
  ownerName: 'Demo Owner Name',
  mobile: '9876543210',
  gstin: '27DEMO1234D1Z5',
  licenseNo: 'DEMO-LIC-2026-001',
  regNo: 'DEMO-REG-2026-001',
  jurisdiction: 'Demo Jurisdiction',
};

const DEMO_CUSTOMER_DETAILS = {
  name: 'DEMO CUSTOMER NAME',
  address: 'DEMO CUSTOMER ADDRESS, DIST: DEMO',
  mobile: '9876543210',
  gstin: '27DEMOCUST12345',
};

export function generateInvoicePDF(sale: any, _settings?: any) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const s = sale || {};
  const pageWidth = 210;
  const marginX = 8;
  const contentWidth = 194;
  let currentY = 8;

  // Outer border for the physical tax invoice
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(marginX, currentY, contentWidth, 281);

  // ─── 1. SHOP HEADER ───
  currentY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(DEMO_DETAILS.shopName, marginX + 4, currentY + 2);

  // License and TAX INVOICE Badge on top right
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lic No: ${DEMO_DETAILS.licenseNo}`, marginX + contentWidth - 4, currentY - 1, { align: 'right' });
  doc.text(`Reg No: ${DEMO_DETAILS.regNo}`, marginX + contentWidth - 4, currentY + 2.5, { align: 'right' });

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
  doc.text(DEMO_DETAILS.address, marginX + 4, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Pro: ${DEMO_DETAILS.ownerName}   |   Mob: ${DEMO_DETAILS.mobile}`, marginX + 4, currentY);

  currentY += 4;
  doc.text(`GSTIN: ${DEMO_DETAILS.gstin}`, marginX + 4, currentY);

  // Divider Line
  currentY += 4;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  // ─── 2. CUSTOMER & BILL INFO ───
  const customerName = s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || DEMO_CUSTOMER_DETAILS.name;
  const customerMobile = s.customer?.phone || s.customer?.mobile || s.customer_phone || DEMO_CUSTOMER_DETAILS.mobile;
  const customerAddress = [s.customer?.village || s.customer?.address, s.customer?.district].filter(Boolean).join(', ') || DEMO_CUSTOMER_DETAILS.address;
  const customerGstin = s.customer?.gstin || DEMO_CUSTOMER_DETAILS.gstin;

  const invNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : '1');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date(2026, 8, 5, 16, 25);
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
  doc.text(`Address: ${customerAddress}`, marginX + 4, infoStartY + 8);
  doc.text(`Mob: ${customerMobile}   |   GSTIN: ${customerGstin}`, marginX + 4, infoStartY + 12);

  // Right: Bill details
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 70, 70);
  doc.text('INVOICE DETAILS:', midX, infoStartY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Bill No: ${invNo}   (${paymentBadge})`, midX, infoStartY + 4);
  doc.text(`Date: ${formattedDate} (${formattedTime})`, midX, infoStartY + 8);
  doc.text(`Payment: ${paymentMode}   |   State: Maharashtra (27)`, midX, infoStartY + 12);

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
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      const lineTotal = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * Number(item.selling_price || 0)));

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

      let expiry = item.expiry_date || p.expiry_date || '09 Feb 2027';
      if (expiry.includes('T')) {
        const d = new Date(expiry);
        expiry = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }

      const mfg = p.manufacturer || p.brand?.name || 'DEMO AGRO CHEMICALS';
      const prodName = item.product_name || p.name || `DEMO PRODUCT ${idx + 1}`;
      const nameWithMfg = `${prodName}\nMfg: ${mfg}`;

      return [
        idx + 1,
        nameWithMfg,
        item.hsn_code || p.hsn_code || '3808',
        item.batch_number || p.batch_number || `DEMO/${800 + idx}`,
        expiry,
        qty,
        taxableRate.toFixed(2),
        `${gst}%`,
        rateWithGst.toFixed(2),
        lineTotal.toFixed(2),
      ];
    });
  } else {
    // Default 2 realistic demo items requested by user
    tableRows = [
      [
        1,
        'DEMO PESTICIDE 500 ML\nMfg: DEMO AGRO CHEMICALS',
        '3808',
        'DEMO/854',
        '09 Feb 2027',
        2,
        '580.37',
        '12%',
        '650.00',
        '1300.00',
      ],
      [
        2,
        'DEMO FERTILIZER 1 LTR\nMfg: DEMO AGRI PRODUCTS',
        '3808',
        'DEMO/525',
        '02 Apr 2027',
        7,
        '847.46',
        '18%',
        '1000.00',
        '7000.00',
      ],
    ];
    totalTaxable = 7092.91;
    totalCgst = 603.55;
    totalSgst = 603.54;
    grandTotal = 8300.0;
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

  // ─── 4. SUMMARY & TAX BREAKDOWN ───
  const summaryLeftWidth = 115;
  const summaryRightWidth = contentWidth - summaryLeftWidth; // 79mm
  const summaryHeight = 45;

  // Left Box: Words, QR, Terms
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

  // Demo QR Code Box in lower-left
  const qrX = marginX + 4;
  const qrY = finalY + 16;
  doc.setDrawColor(0, 0, 0);
  doc.rect(qrX, qrY, 16, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('QR CODE', qrX + 8, qrY + 8, { align: 'center' });
  doc.text('SCAN TO PAY', qrX + 8, qrY + 11, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Scan to Verify & Pay via UPI', qrX + 19, qrY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('UPI ID: demopay@krushikendra', qrX + 19, qrY + 9);
  doc.text('Instant digital invoice receipt', qrX + 19, qrY + 13);

  // Terms & Conditions at bottom left
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', marginX + 3, finalY + 36);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Goods once sold will not be accepted back or replaced.\n2. Interest @ 18% p.a. charged if payment not made on time.\n3. Subject to Demo Jurisdiction only.', marginX + 3, finalY + 39);

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

  doc.text(`For ${DEMO_DETAILS.shopName}`, marginX + contentWidth - 30, signY + 6, { align: 'center' });
  doc.text('Authorized Signatory', marginX + contentWidth - 30, signY + signHeight - 3, { align: 'center' });
  doc.line(marginX + contentWidth - 50, signY + signHeight - 6, marginX + contentWidth - 10, signY + signHeight - 6);

  // ─── 6. BORDERED FOOTER ───
  const footerY = signY + signHeight;
  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, footerY, contentWidth, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text('This Is Computer Generated Tax Invoice', marginX + 4, footerY + 4.5);
  doc.text(`Subject To ${DEMO_DETAILS.jurisdiction}`, marginX + (contentWidth / 2), footerY + 4.5, { align: 'center' });
  doc.text('Page 1 of 1', marginX + contentWidth - 4, footerY + 4.5, { align: 'right' });

  return doc;
}
