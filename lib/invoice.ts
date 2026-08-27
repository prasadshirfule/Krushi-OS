import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { formatCurrency, formatDate, numberToWords } from './utils'
import type { SaleWithItems } from '@/types/sales'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

export function generateInvoicePDF(sale: SaleWithItems, settings: any) {
  const doc = new jsPDF()

  const primaryColor = [22, 163, 74] // Green
  const textColor = [50, 50, 50]
  const lightGray = [240, 240, 240]

  const shopName = settings.shopName || settings.shop_name || 'KRUSHI OS SEVA KENDRA'
  const address1 = settings.addressLine1 || settings.shop_address || 'Main Market Road'
  const address2 = settings.addressLine2 || ''
  const phone = settings.phone || settings.shop_phone || ''
  const email = settings.email || settings.shop_email || ''
  const gstNo = settings.gstNumber || settings.shop_gst || ''

  const invNo = sale.invoice_number || sale.invoiceNumber || sale.id || ''
  const dateStr = sale.sale_date || sale.created_at || sale.createdAt || new Date().toISOString()
  const grandTotal = sale.grand_total ?? sale.totalAmount ?? 0
  const subTotal = sale.subtotal || grandTotal
  const discountTotal = sale.total_discount ?? sale.discountAmount ?? 0
  const taxTotal = sale.total_tax ?? 0

  // Header
  doc.setFontSize(22)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text(shopName, 105, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text(address1, 105, 28, { align: 'center' })
  if (address2) {
    doc.text(address2, 105, 34, { align: 'center' })
  }
  doc.text(`Phone: ${phone} ${email ? `| Email: ${email}` : ''}`, 105, 40, { align: 'center' })
  if (gstNo) {
    doc.text(`GSTIN: ${gstNo}`, 105, 46, { align: 'center' })
  }

  // Invoice Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', 105, 58, { align: 'center' })
  doc.setFont('helvetica', 'normal')

  // Info Section
  doc.setFontSize(10)
  
  // Left side - Invoice Info
  doc.text('Invoice No:', 14, 70)
  doc.text(invNo, 45, 70)
  
  doc.text('Date:', 14, 76)
  doc.text(formatDate(dateStr), 45, 76)
  
  doc.text('Status:', 14, 82)
  doc.text(sale.status || 'COMPLETED', 45, 82)

  // Right side - Customer Info
  const rightColX = 120
  const customerMobile = (sale.customer as any)?.mobile || (sale.customer as any)?.phone || ''
  doc.text('Billed To:', rightColX, 70)
  doc.text(sale.customer?.name || 'Walk-in Customer', rightColX + 25, 70)
  
  if (customerMobile) {
    doc.text('Mobile:', rightColX, 76)
    doc.text(customerMobile, rightColX + 25, 76)
  }
  
  if (sale.customer?.address) {
    doc.text('Address:', rightColX, 82)
    doc.text(sale.customer.address, rightColX + 25, 82)
  }

  // Table
  const tableData = (sale.items || []).map((item: any, index: number) => {
    const product = item.product || {}
    const qty = item.quantity || 1
    const rate = item.selling_price ?? item.unitPrice ?? item.rate ?? 0
    const disc = item.discount_percent ?? item.discountPercent ?? item.discount ?? 0
    const total = item.total_amount ?? item.totalAmount ?? (qty * rate)
    const hsn = product.hsn_code || product.hsnCode || '-'

    return [
      index + 1,
      product.name || item.product_name || 'Unknown Item',
      hsn,
      `${qty} ${product.unit || 'pcs'}`,
      rate.toFixed(2),
      `${disc}%`,
      total.toFixed(2)
    ]
  })

  doc.autoTable({
    startY: 95,
    head: [['Sr', 'Product Name', 'HSN', 'Qty', 'Rate', 'Disc%', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: lightGray, textColor: 0, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    }
  })

  // @ts-ignore
  const finalY = doc.lastAutoTable?.finalY || 150

  // Totals Section
  const totalsX = 140
  const totalsY = finalY + 10

  doc.text('Subtotal:', totalsX, totalsY)
  doc.text(formatCurrency(subTotal), 195, totalsY, { align: 'right' })

  if (discountTotal > 0) {
    doc.text('Discount:', totalsX, totalsY + 6)
    doc.text(`- ${formatCurrency(discountTotal)}`, 195, totalsY + 6, { align: 'right' })
  }

  if (taxTotal > 0) {
    doc.text('Tax:', totalsX, totalsY + 12)
    doc.text(formatCurrency(taxTotal), 195, totalsY + 12, { align: 'right' })
  }

  doc.setFont('helvetica', 'bold')
  doc.text('Grand Total:', totalsX, totalsY + 22)
  doc.text(formatCurrency(grandTotal), 195, totalsY + 22, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  // Amount in words
  doc.setFont('helvetica', 'bold')
  doc.text('Amount in words:', 14, totalsY)
  doc.setFont('helvetica', 'italic')
  doc.text(numberToWords(grandTotal), 14, totalsY + 6)
  doc.setFont('helvetica', 'normal')

  // Terms and Footer
  const footerY = 250
  
  if (settings.termsAndConditions || settings.invoice_terms) {
    const terms = settings.termsAndConditions || settings.invoice_terms
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions:', 14, footerY - 15)
    doc.setFont('helvetica', 'normal')
    
    const splitTerms = doc.splitTextToSize(terms, 100)
    doc.text(splitTerms, 14, footerY - 10)
  }

  doc.setFontSize(10)
  doc.text('Thank you for your business!', 14, footerY + 20)

  doc.text('Authorized Signatory', 195, footerY + 20, { align: 'right' })
  doc.setFontSize(8)
  doc.text(`For ${shopName}`, 195, footerY + 25, { align: 'right' })

  return doc
}
