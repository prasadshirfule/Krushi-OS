import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, formatDate, numberToWords } from './utils';
import { formatProductPackDisplay } from './validations';
import type { SaleWithItems } from '@/types/sales';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export function generateInvoicePDF(sale: SaleWithItems, settings: any) {
  const doc = new jsPDF();

  const primaryColor = [22, 163, 74]; // Green
  const textColor = [50, 50, 50];
  const lightGray = [240, 240, 240];

  // Shop Settings
  const shopName = settings.shopName || 'KRUSHI OS SEVA KENDRA';
  const ownerName = settings.ownerName || '';
  const address = settings.address || '';
  const village = settings.village || '';
  const district = settings.district || '';
  const state = settings.state || '';
  const pincode = settings.pincode || '';
  const phone1 = settings.contact1 || '';
  const phone2 = settings.contact2 || '';
  const email = settings.email || '';
  const gstNo = settings.gstNumber || '';
  const licenseNo = settings.licenseNumber || '';
  const registrationNo = settings.registrationNumber || '';
  const logoBase64 = settings.logoBase64 || null;

  let currentY = 15;

  // Header Left (Logo)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', 14, currentY, 30, 30);
    } catch (e) {
      console.warn('Could not add logo', e);
    }
  }

  // Header Center (Shop Name & Details)
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(shopName, 105, currentY + 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  let addressLine = [address, village, district, state, pincode].filter(Boolean).join(', ');
  if (addressLine) {
    doc.text(addressLine, 105, currentY + 16, { align: 'center' });
  }
  
  let contactLine = [];
  if (phone1) contactLine.push(`Ph: ${phone1}`);
  if (phone2) contactLine.push(`Alt: ${phone2}`);
  if (email) contactLine.push(`Email: ${email}`);
  if (contactLine.length > 0) {
    doc.text(contactLine.join(' | '), 105, currentY + 22, { align: 'center' });
  }

  let taxLine = [];
  if (gstNo) taxLine.push(`GSTIN: ${gstNo}`);
  if (licenseNo) taxLine.push(`Licence No: ${licenseNo}`);
  if (registrationNo) taxLine.push(`Reg No: ${registrationNo}`);
  if (taxLine.length > 0) {
    doc.text(taxLine.join(' | '), 105, currentY + 28, { align: 'center' });
  }

  if (ownerName) {
    doc.text(`Owner: ${ownerName}`, 105, currentY + 34, { align: 'center' });
  }

  // Invoice Title
  currentY += 45;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 105, currentY, { align: 'center' });
  
  doc.line(14, currentY + 2, 195, currentY + 2); // Horizontal line

  // Info Section
  currentY += 10;
  doc.setFontSize(10);
  
  // Left side - Invoice Info
  const s = sale as any;
  const invNo = s.invoice_number || s.invoiceNumber || s.id || '';
  const saleDate = new Date(s.sale_date || s.created_at || new Date());
  
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice No:', 14, currentY);
  doc.text('Date:', 14, currentY + 6);
  doc.text('Time:', 14, currentY + 12);
  doc.text('Payment Mode:', 14, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.text(invNo, 45, currentY);
  doc.text(saleDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 45, currentY + 6);
  doc.text(saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 45, currentY + 12);
  doc.text(s.payment_method || s.payment_mode || s.paymentMethod || 'Cash', 45, currentY + 18);

  // Right side - Customer Info
  const rightColX = 120;
  const custName = s.customer_name || s.customer?.name || 'Walk-in Customer';
  const custMobile = s.customer_phone || s.customer?.mobile || s.customer?.phone || '';
  const custVillage = s.customer?.village || s.customer?.address || '';
  const custAadhaar = s.customer?.aadhaar || '';

  doc.setFont('helvetica', 'bold');
  doc.text('Billed To:', rightColX, currentY);
  doc.text('Mobile:', rightColX, currentY + 6);
  if (custVillage) doc.text('Village:', rightColX, currentY + 12);
  if (custAadhaar) doc.text('Aadhaar:', rightColX, custVillage ? currentY + 18 : currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(custName, rightColX + 22, currentY);
  doc.text(custMobile || 'N/A', rightColX + 22, currentY + 6);
  if (custVillage) doc.text(custVillage, rightColX + 22, currentY + 12);
  if (custAadhaar) {
    const masked = `XXXX XXXX ${custAadhaar.slice(-4)}`;
    doc.text(masked, rightColX + 22, custVillage ? currentY + 18 : currentY + 12);
  }

  // Table
  currentY += 28;
  const tableData = (s.items || s.sale_items || []).map((item: any, index: number) => {
    const product = item.product || {};
    const qty = item.quantity || 1;
    const rate = item.selling_price ?? item.unitPrice ?? item.unit_price ?? item.rate ?? 0;
    const gstRate = item.gst_rate ?? item.gstRate ?? item.gst ?? 0;
    const total = item.total_amount ?? item.totalAmount ?? (qty * rate);
    const hsn = product.hsn_code || product.hsnCode || item.hsn_code || '-';
    const batch = item.batch_number || product.batch_number || '-';
    let expiry = item.expiry_date || product.expiry_date || '-';
    if (expiry !== '-' && expiry.includes('T')) {
        const ed = new Date(expiry);
        expiry = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
    }

    const pack = formatProductPackDisplay(product);
    const displayName = (product.name || item.product_name || 'Unknown Item');

    return [
      index + 1,
      displayName,
      hsn,
      batch,
      expiry,
      `${qty}`,
      pack || '-',
      rate.toFixed(2),
      `${gstRate}%`,
      total.toFixed(2)
    ];
  });

  doc.autoTable({
    startY: currentY,
    head: [['Sr.', 'Product Name', 'HSN', 'Batch', 'Expiry', 'Qty', 'Size', 'Rate', 'GST', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: lightGray, textColor: 0, fontStyle: 'bold' },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right', fontStyle: 'bold' },
    }
  });

  // @ts-ignore
  const finalY = doc.lastAutoTable?.finalY || currentY + 40;
  
  // Billing Summary Section
  const totalsX = 135;
  const totalsValueX = 195;
  let summaryY = finalY + 8;

  const grandTotal = s.grand_total ?? s.grandTotal ?? s.totalAmount ?? 0;
  const subTotal = s.subtotal ?? grandTotal;
  const discountTotal = s.total_discount ?? s.discount_amount ?? s.discountAmount ?? 0;
  const taxTotal = s.total_tax ?? s.tax_amount ?? s.taxAmount ?? 0;
  const cgstTotal = s.cgst_total ?? s.cgstTotal ?? (taxTotal / 2);
  const sgstTotal = s.sgst_total ?? s.sgstTotal ?? (taxTotal / 2);
  const roundOff = s.round_off ?? s.roundOff ?? 0;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Subtotal:', totalsX, summaryY);
  doc.text(formatCurrency(subTotal), totalsValueX, summaryY, { align: 'right' });
  summaryY += 5;

  if (discountTotal > 0) {
    doc.text('Discount:', totalsX, summaryY);
    doc.text(`- ${formatCurrency(discountTotal)}`, totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;
  }

  if (taxTotal > 0) {
    doc.text(`CGST:`, totalsX, summaryY);
    doc.text(formatCurrency(cgstTotal), totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;
    
    doc.text(`SGST:`, totalsX, summaryY);
    doc.text(formatCurrency(sgstTotal), totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;
  }

  if (roundOff !== 0) {
    doc.text('Round Off:', totalsX, summaryY);
    doc.text(formatCurrency(roundOff), totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Net Total:', totalsX, summaryY);
  doc.text(formatCurrency(grandTotal), totalsValueX, summaryY, { align: 'right' });
  summaryY += 8;

  // Payments and Udhari
  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  let amountPaid = s.paid_amount ?? s.paidAmount ?? (isCredit ? 0 : grandTotal);
  let currentUdhari = 0;
  
  if (isCredit) {
    currentUdhari = Math.max(0, grandTotal - amountPaid);
  }

  doc.text('Amount Paid:', totalsX, summaryY);
  doc.text(formatCurrency(amountPaid), totalsValueX, summaryY, { align: 'right' });
  summaryY += 5;

  if (isCredit) {
    doc.text('Current Udhari:', totalsX, summaryY);
    doc.text(formatCurrency(currentUdhari), totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;

    // We can show Previous/Closing Udhari if we know the customer's full outstanding
    // In demo store, we update the customer, but we need the exact value.
    // If the customer object has outstanding_balance before the sale, we can use it.
    const customer = sale.customer as any;
    const customerOutstandingNow = customer?.outstanding ?? customer?.outstanding_balance ?? 0;
    
    // Attempt to calculate previous udhari
    const previousUdhari = Math.max(0, customerOutstandingNow - currentUdhari);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Previous Udhari:', totalsX, summaryY);
    doc.text(formatCurrency(previousUdhari), totalsValueX, summaryY, { align: 'right' });
    summaryY += 5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red for closing udhari
    doc.text('Closing Udhari:', totalsX, summaryY);
    doc.text(formatCurrency(customerOutstandingNow), totalsValueX, summaryY, { align: 'right' }); 
    doc.setTextColor(textColor[0], textColor[1], textColor[2]); // reset
    summaryY += 5;
  }
  doc.setFont('helvetica', 'normal');

  // Amount in words
  let wordsY = finalY + 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in words:', 14, wordsY);
  doc.setFont('helvetica', 'italic');
  doc.text(numberToWords(grandTotal), 14, wordsY + 5);
  doc.setFont('helvetica', 'normal');

  // Terms and Footer
  const footerY = 250;
  
  const termsText = settings.invoiceTerms || settings.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.';
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions:', 14, footerY - 5);
  doc.setFont('helvetica', 'normal');
  
  const splitTerms = doc.splitTextToSize(termsText, 100);
  doc.text(splitTerms, 14, footerY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for your business!', 14, footerY + 25);

  doc.setFont('helvetica', 'bold');
  doc.text(settings.authorizedSignatory || `For ${shopName}`, 195, footerY + 18, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signatory', 195, footerY + 25, { align: 'right' });

  return doc;
}
