import type { jsPDF } from 'jspdf';
import { ShopDetails, formatShopAddress } from '@/lib/shop-details';
import { formatProductNameWithSize } from '@/lib/validations';

export interface ReportFilterMeta {
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales';
  title: string;
  dateRange?: string;
  periodLabel?: string;
  statusFilter?: string;
  searchQuery?: string;
  generatedAt?: string;
  productInfo?: {
    id: string;
    name: string;
    sku?: string;
    pack_size?: string;
    unit?: string;
  };
}

/**
 * Format currency value for on-screen / HTML print (with ₹ symbol).
 */
export function formatCurrencyValue(num: number | string | undefined | null): string {
  const val = Number(num) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Format number for PDF tables without Unicode currency symbols to prevent
 * standard jsPDF font encoding corruption (e.g. preventing '¹' superscript artifacts).
 */
export function formatPDFNumber(num: number | string | undefined | null): string {
  const val = Number(num) || 0;
  return val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format currency with 'Rs.' prefix for PDF summary cards and labels.
 */
export function formatPDFCurrency(num: number | string | undefined | null): string {
  return `Rs. ${formatPDFNumber(num)}`;
}

/**
 * Format standard uppercase payment mode display (CASH, UPI, CARD, BANK TRANSFER, CREDIT, PARTIAL, N/A).
 */
export function formatPaymentDisplay(val: any): string {
  if (!val) return 'N/A';
  const str = String(val).trim();
  if (!str) return 'N/A';

  const clean = str.toUpperCase().replace(/[-_]/g, ' ').trim();
  if (clean === 'CASH') return 'CASH';
  if (clean === 'UPI') return 'UPI';
  if (clean === 'CARD' || clean === 'DEBIT CARD' || clean === 'CREDIT CARD') return 'CARD';
  if (clean === 'BANK TRANSFER' || clean === 'BANK' || clean === 'NET BANKING' || clean === 'NEFT' || clean === 'RTGS' || clean === 'IMPS' || clean === 'CHEQUE') return 'BANK TRANSFER';
  if (clean === 'CREDIT' || clean === 'UDHAAR' || clean === 'DUE' || clean === 'UNPAID') return 'CREDIT';
  if (clean === 'PARTIAL' || clean === 'PARTIAL PAYMENT' || clean === 'SPLIT') return 'PARTIAL';
  if (clean === 'PAID' || clean === 'COMPLETED') return 'CASH';
  return clean || 'N/A';
}

/**
 * Extract and resolve the exact payment method to display from a sale or sale item object.
 */
export function getSalePaymentMethodDisplay(sale: any): string {
  if (!sale) return 'N/A';

  // 1. Check direct payment_mode or payment_method if already resolved
  if (sale.payment_mode && sale.payment_mode !== 'N/A') {
    return formatPaymentDisplay(sale.payment_mode);
  }
  if (sale.payment_method && sale.payment_method !== 'N/A') {
    return formatPaymentDisplay(sale.payment_method);
  }

  // 2. Check sale.payments array
  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    const positivePayments = sale.payments.filter((p: any) => Number(p.amount || 0) > 0);
    const target = positivePayments.length > 0 ? positivePayments : sale.payments;
    const methods = new Set(
      target.map((p: any) =>
        String(p.payment_method || p.method || '').toUpperCase().replace(/[-_]/g, ' ').trim()
      ).filter(Boolean)
    );
    const nonCredit = Array.from(methods).filter(m => m !== 'CREDIT');
    if (nonCredit.length > 1 || (nonCredit.length >= 1 && methods.has('CREDIT'))) {
      return 'PARTIAL';
    }
    if (methods.size === 1) {
      return formatPaymentDisplay(Array.from(methods)[0]);
    }
  }

  // 3. Check partial_payment object
  let partialObj = sale.partial_payment || sale.partialPayment || null;
  if (!partialObj && sale.notes && typeof sale.notes === 'string') {
    try {
      const trimmed = sale.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.partialPayment) partialObj = parsed.partialPayment;
      }
    } catch {}
  }
  if (partialObj) {
    const totalPaid = Number(partialObj.total_paid ?? partialObj.totalPaid ?? 0);
    const rem = Number(partialObj.remaining ?? 0);
    if (totalPaid > 0 && rem > 0) {
      return 'PARTIAL';
    }
  }

  // 4. Check payment_status
  if (sale.payment_status) {
    const status = String(sale.payment_status).toUpperCase().trim();
    if (status === 'PARTIAL') return 'PARTIAL';
    if (status === 'CREDIT' || status === 'UNPAID') return 'CREDIT';
  }

  return 'N/A';
}

export function formatDateValue(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return String(dateStr);
  }
}

export function getReportFilename(reportType: string, extension: 'xlsx' | 'pdf', extraName?: string): string {
  const today = new Date().toISOString().split('T')[0];
  const typeMap: Record<string, string> = {
    sales: 'Sales',
    inventory: 'Inventory',
    financial: 'Financial',
    customer: 'Customer',
    supplier: 'Supplier',
    product_sales: 'Product_Sales'
  };
  const label = typeMap[reportType.toLowerCase()] || 'Report';
  const cleanExtra = extraName ? `_${extraName.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
  return `KrushiOS_${label}${cleanExtra}_Report_${today}.${extension}`;
}

function renderAutoTable(doc: any, options: any, autoTableFn?: any) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
  } else if (typeof autoTableFn === 'function') {
    autoTableFn(doc, options);
  } else if (typeof autoTableFn?.default === 'function') {
    autoTableFn.default(doc, options);
  }
}

/* ==========================================================================
   1. EXCEL EXPORT ENGINE (.xlsx)
   ========================================================================== */

export async function exportReportToExcel(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  const createMetaRows = (reportTitle: string) => [
    ['KRUSHI OS - AGRIBUSINESS MANAGEMENT SYSTEM'],
    [shop.shopName ? shop.shopName.toUpperCase() : 'STORE REPORT'],
    [shopAddr ? `Address: ${shopAddr}` : ''],
    [shop.contact1 ? `Phone: ${shop.contact1}` : ''],
    [shop.gstNumber ? `GSTIN: ${shop.gstNumber}` : ''],
    [''],
    [`REPORT: ${reportTitle.toUpperCase()}`],
    [`Period / Filter: ${meta.dateRange || meta.periodLabel || 'All Records'}`],
    [`Generated On: ${dateStr}`],
    ['--------------------------------------------------------------------------------'],
    ['']
  ].filter(r => r[0] !== '');

  if (reportType === 'sales') {
    const sales = data?.sales || [];
    const totalRev = Number(data?.totalRevenue || 0);
    const totalBills = Number(data?.totalCount || sales.length || 0);
    const totalTax = Number(data?.totalTax || 0);
    const totalProfit = Number(data?.totalProfit || 0);
    const avgBill = totalBills > 0 ? totalRev / totalBills : 0;

    const summaryRows = [
      ...createMetaRows('Sales Report Summary'),
      ['KEY PERFORMANCE INDICATORS', ''],
      ['Metric', 'Value'],
      ['Total Sales (Invoices)', totalBills],
      ['Total Sales Revenue (₹)', totalRev],
      ['Total GST / Tax (₹)', totalTax],
      ['Total Net Profit (₹)', totalProfit],
      ['Average Bill Value (₹)', avgBill],
      [''],
      ['Note:', 'All values are calculated from completed sales transactions matching the selected filters.']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const detailHeaders = [
      'Invoice Number', 'Date', 'Customer Name', 'Customer Mobile', 'Customer Village',
      'Subtotal (₹)', 'Discount (₹)', 'GST / Tax (₹)', 'Total Amount (₹)', 'Profit (₹)',
      'Payment Method', 'Status'
    ];

    const detailRows = sales.map((s: any) => [
      s.invoice_number || s.id || '-',
      formatDateValue(s.sale_date || s.created_at),
      s.customer?.name || 'Walk-in Customer',
      s.customer?.mobile || '-',
      s.customer?.village || '-',
      Number(s.subtotal || 0),
      Number(s.discount_amount || 0),
      Number(s.tax_amount || 0),
      Number(s.total_amount || 0),
      Number(s.profit_amount || 0),
      getSalePaymentMethodDisplay(s),
      (s.status || 'COMPLETED').toUpperCase()
    ]);

    const wsDetails = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Sales Transactions Details'),
      detailHeaders,
      ...detailRows
    ]);
    wsDetails['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Sales Details');
  } 
  else if (reportType === 'inventory') {
    const products = data?.products || [];
    const totalVal = Number(data?.totalValue || 0);
    const lowStock = products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
    const lowStockCount = Number(data?.lowStockCount ?? lowStock.length);

    const summaryRows = [
      ...createMetaRows('Inventory Valuation & Stock Summary'),
      ['INVENTORY METRICS', ''],
      ['Metric', 'Value'],
      ['Total Unique Products', products.length],
      ['Total Inventory Valuation (₹)', totalVal],
      ['Low Stock Products Count', lowStockCount],
      ['Healthy Stock Products Count', products.length - lowStockCount]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const invHeaders = [
      'Product Name', 'SKU / Code', 'Category', 'Current Stock', 'Unit',
      'Purchase Cost (₹)', 'Selling Price (₹)', 'Inventory Value (₹)', 'Min Stock Level', 'Stock Status'
    ];

    const mapProductRow = (p: any) => {
      const stock = Number(p.current_stock || 0);
      const cost = Number(p.purchase_price || 0);
      const minStock = Number(p.min_stock || 5);
      const isLow = stock <= minStock;
      const formattedName = formatProductNameWithSize(p.name, p.pack_size, p.unit);
      return [
        formattedName || p.name || 'Unnamed Product',
        p.sku || '-',
        p.category?.name || '-',
        stock,
        p.unit || 'Piece',
        cost,
        Number(p.selling_price || 0),
        stock * cost,
        minStock,
        isLow ? 'LOW STOCK' : 'IN STOCK'
      ];
    };

    const currentRows = products.map(mapProductRow);
    const wsCurrent = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Current Inventory Stock'),
      invHeaders,
      ...currentRows
    ]);
    wsCurrent['!cols'] = [
      { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 10 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCurrent, 'Current Stock');
  }
  else if (reportType === 'financial') {
    const rev = Number(data?.revenue || 0);
    const exp = Number(data?.totalExpenses || 0);
    const gross = Number(data?.grossProfit || 0);
    const net = Number(data?.netProfit || 0);
    const salesCount = Number(data?.salesCount || 0);

    const summaryRows = [
      ...createMetaRows('Financial Performance & P&L Statement'),
      ['FINANCIAL SUMMARY', ''],
      ['Key Performance Indicator', 'Amount (₹) / Ratio'],
      ['Gross Sales Revenue (₹)', rev],
      ['Cost of Goods Sold / Margin Deductions (₹)', rev - gross],
      ['Gross Operating Profit (₹)', gross],
      ['Total Operating Expenses (₹)', exp],
      ['Net Operating Profit / Loss (₹)', net],
      ['Total Completed Sales Invoices', salesCount]
    ];
    const wsFinSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsFinSummary['!cols'] = [{ wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsFinSummary, 'P&L Summary');
  }
  else if (reportType === 'customer') {
    const customers = data?.customers || (Array.isArray(data) ? data : []);
    const custHeaders = ['Customer Name', 'Mobile Number', 'Village / City', 'Address', 'Total Purchases (₹)', 'Total Paid (₹)', 'Outstanding Balance (₹)'];
    const custRows = customers.map((c: any) => [
      c.name || 'Unnamed',
      c.mobile || '-',
      c.village || '-',
      c.address || '-',
      Number(c.total_purchases || 0),
      Number(c.total_paid || 0),
      Number(c.outstanding || 0)
    ]);
    const wsCustomers = XLSX.utils.aoa_to_sheet([...createMetaRows('Customer Accounts Report'), custHeaders, ...custRows]);
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customer Ledger');
  }
  else if (reportType === 'supplier') {
    const suppliers = data?.suppliers || (Array.isArray(data) ? data : []);
    const suppHeaders = ['Supplier Name', 'Company', 'Mobile Number', 'Email', 'GSTIN', 'Total Purchases (₹)', 'Total Paid (₹)', 'Outstanding Payable (₹)'];
    const suppRows = suppliers.map((s: any) => [
      s.name || 'Unnamed',
      s.company || '-',
      s.mobile || '-',
      s.email || '-',
      s.gst_number || '-',
      Number(s.total_purchases || 0),
      Number(s.total_paid || 0),
      Number(s.outstanding || 0)
    ]);
    const wsSuppliers = XLSX.utils.aoa_to_sheet([...createMetaRows('Supplier Accounts Report'), suppHeaders, ...suppRows]);
    XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Supplier Ledger');
  }
  else if (reportType === 'product_sales') {
    const items = data?.items || [];
    const totalQty = Number(data?.totalQuantity || 0);
    const totalSales = Number(data?.totalSales || 0);
    const totalGST = Number(data?.totalGST || 0);
    const totalInvoices = Number(data?.totalInvoices || 0);

    const pName = meta.productInfo ? formatProductNameWithSize(meta.productInfo.name, meta.productInfo.pack_size, meta.productInfo.unit) : 'Product';
    const summaryRows = [
      ...createMetaRows(`Product Sales Report - ${pName}`),
      ['PRODUCT SALES METRICS', ''],
      ['Metric', 'Value'],
      ['Product Name', pName],
      ['Product SKU', meta.productInfo?.sku || '-'],
      ['Total Quantity Sold', totalQty],
      ['Total Sales Revenue (₹)', totalSales],
      ['Total GST Collected (₹)', totalGST],
      ['Number of Invoices', totalInvoices]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 32 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const detailHeaders = [
      'Invoice #', 'Date', 'Customer Name', 'Customer Mobile', 'Customer Village',
      'Quantity Sold', 'Selling Price (₹)', 'GST Rate (%)', 'GST Amount (₹)', 'Total Amount (₹)', 'Payment Status'
    ];

    const detailRows = items.map((it: any) => [
      it.invoice_number || '-',
      formatDateValue(it.sale_date),
      it.customer_name || 'Walk-in Customer',
      it.customer_mobile || '-',
      it.customer_village || '-',
      Number(it.quantity || 0),
      Number(it.unit_price || 0),
      Number(it.gst_rate || 0),
      Number(it.gst_amount || 0),
      Number(it.total_amount || 0),
      (it.payment_status || 'PAID').toUpperCase()
    ]);

    const wsDetails = XLSX.utils.aoa_to_sheet([
      ...createMetaRows(`Product Sales Transactions - ${pName}`),
      detailHeaders,
      ...detailRows
    ]);
    wsDetails['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Product Sales');
  }

  const filename = getReportFilename(reportType, 'xlsx', meta.productInfo?.name);
  XLSX.writeFile(wb, filename);
}

/* ==========================================================================
   2. PDF EXPORT ENGINE (Clean A4 Document - Free of Unicode corruptions)
   ========================================================================== */

export async function exportReportToPDF(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTableFn = autoTableModule.default || autoTableModule;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  let currentY = 14;

  // Header Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(22, 101, 52); // Krushi green
  const shopTitle = (shop.shopName || 'KRUSHI OS STORE').toUpperCase();
  doc.text(shopTitle, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const subHeaderLines: string[] = [];
  if (shop.ownerName) subHeaderLines.push(`Prop: ${shop.ownerName}`);
  if (shopAddr) subHeaderLines.push(shopAddr);
  if (shop.contact1) subHeaderLines.push(`Phone: ${shop.contact1}`);
  if (shop.gstNumber) subHeaderLines.push(`GSTIN: ${shop.gstNumber}`);
  if (shop.licenseNumber) subHeaderLines.push(`Lic: ${shop.licenseNumber}`);

  if (subHeaderLines.length > 0) {
    const line1 = subHeaderLines.slice(0, 2).join(' | ');
    doc.text(line1, pageWidth / 2, currentY, { align: 'center' });
    currentY += 3.5;
    if (subHeaderLines.length > 2) {
      const line2 = subHeaderLines.slice(2).join(' | ');
      doc.text(line2, pageWidth / 2, currentY, { align: 'center' });
      currentY += 3.5;
    }
  }

  // Divider Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 4.5;

  // Report Title & Filter Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(meta.title.toUpperCase(), 14, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, currentY, { align: 'right' });
  currentY += 4;

  const filterParts: string[] = [];
  if (meta.productInfo) {
    const pName = formatProductNameWithSize(meta.productInfo.name, meta.productInfo.pack_size, meta.productInfo.unit);
    filterParts.push(`Product: ${pName}`);
    if (meta.productInfo.sku) filterParts.push(`SKU: ${meta.productInfo.sku}`);
  }
  if (meta.dateRange || meta.periodLabel) filterParts.push(`Period: ${meta.dateRange || meta.periodLabel}`);
  if (meta.statusFilter) filterParts.push(`Status: ${meta.statusFilter}`);
  if (meta.searchQuery) filterParts.push(`Search: "${meta.searchQuery}"`);

  if (filterParts.length > 0) {
    doc.text(filterParts.join('  •  '), 14, currentY);
    currentY += 4.5;
  } else {
    currentY += 2;
  }

  // Running Footer Function
  const attachFooters = (docInstance: jsPDF) => {
    // @ts-ignore
    const totalPages = docInstance.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      docInstance.setPage(i);
      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(7.5);
      docInstance.setTextColor(148, 163, 184);
      
      docInstance.setDrawColor(226, 232, 240);
      docInstance.setLineWidth(0.3);
      docInstance.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

      docInstance.text('Krushi OS | Computer Generated Report', 14, pageHeight - 6);
      docInstance.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
    }
  };

  // KPI Summary Cards
  const drawSummarySection = (items: { label: string; value: string; color?: [number, number, number] }[]) => {
    const totalAvailableWidth = pageWidth - 28; // 182mm
    const gap = 2.5;
    const cardWidth = (totalAvailableWidth - (items.length - 1) * gap) / items.length;
    const cardHeight = 12;

    items.forEach((item, idx) => {
      const x = 14 + idx * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, x + 2.5, currentY + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      if (item.color) {
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(item.value, x + 2.5, currentY + 9.5);
    });

    currentY += cardHeight + 4.5;
  };

  if (reportType === 'sales') {
    const sales = data?.sales || [];
    const totalRev = Number(data?.totalRevenue || 0);
    const totalBills = Number(data?.totalCount || sales.length || 0);
    const totalTax = Number(data?.totalTax || 0);
    const totalProfit = Number(data?.totalProfit || 0);
    const avgBill = totalBills > 0 ? totalRev / totalBills : 0;

    drawSummarySection([
      { label: 'TOTAL BILLS', value: String(totalBills) },
      { label: 'TOTAL REVENUE', value: formatPDFCurrency(totalRev), color: [22, 163, 74] },
      { label: 'TOTAL GST', value: formatPDFCurrency(totalTax) },
      { label: 'TOTAL PROFIT', value: formatPDFCurrency(totalProfit), color: [15, 118, 110] },
      { label: 'AVG BILL VALUE', value: formatPDFCurrency(avgBill) }
    ]);

    // Available width = 182mm
    // 24 + 18 + 48 + 14 + 24 + 20 + 20 + 14 = 182mm
    const tableHeaders = [
      { content: 'Invoice #', styles: { halign: 'left' } },
      { content: 'Date', styles: { halign: 'center' } },
      { content: 'Customer', styles: { halign: 'left' } },
      { content: 'Items', styles: { halign: 'center' } },
      { content: 'Total (Rs.)', styles: { halign: 'right' } },
      { content: 'GST (Rs.)', styles: { halign: 'right' } },
      { content: 'Profit (Rs.)', styles: { halign: 'right' } },
      { content: 'Payment', styles: { halign: 'center' } }
    ];
    const tableBody = sales.map((s: any) => {
      const itemsCount = (s.sale_items || []).length;
      return [
        s.invoice_number || '-',
        formatDateValue(s.sale_date),
        s.customer?.name || 'Walk-in Customer',
        itemsCount > 0 ? String(itemsCount) : '-',
        formatPDFNumber(s.total_amount),
        formatPDFNumber(s.tax_amount),
        formatPDFNumber(s.profit_amount),
        getSalePaymentMethodDisplay(s)
      ];
    });

    if (sales.length === 0) {
      tableBody.push(['No sales found for the selected period.', '', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 38, halign: 'left' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 26, halign: 'center' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });
  }
  else if (reportType === 'inventory') {
    const products = data?.products || [];
    const totalVal = Number(data?.totalValue || 0);
    const lowStock = products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
    const lowStockCount = Number(data?.lowStockCount ?? lowStock.length);

    drawSummarySection([
      { label: 'TOTAL PRODUCTS', value: String(products.length) },
      { label: 'TOTAL VALUATION', value: formatPDFCurrency(totalVal), color: [22, 163, 74] },
      { label: 'LOW STOCK ITEMS', value: String(lowStockCount), color: [220, 38, 38] },
      { label: 'HEALTHY STOCK', value: String(products.length - lowStockCount) }
    ]);

    // Available width = 182mm
    // 50 + 22 + 26 + 22 + 20 + 20 + 22 = 182mm
    const tableHeaders = [
      { content: 'Product Name', styles: { halign: 'left' } },
      { content: 'SKU', styles: { halign: 'left' } },
      { content: 'Category', styles: { halign: 'left' } },
      { content: 'Stock Level', styles: { halign: 'center' } },
      { content: 'Cost (Rs.)', styles: { halign: 'right' } },
      { content: 'Price (Rs.)', styles: { halign: 'right' } },
      { content: 'Value (Rs.)', styles: { halign: 'right' } }
    ];
    const tableBody = products.map((p: any) => {
      const stock = Number(p.current_stock || 0);
      const cost = Number(p.purchase_price || 0);
      const isLow = stock <= Number(p.min_stock || 5);
      const formattedName = formatProductNameWithSize(p.name, p.pack_size, p.unit);
      return [
        formattedName || p.name || 'Unnamed',
        p.sku || '-',
        p.category?.name || '-',
        `${stock} ${p.unit || 'Piece'}${isLow ? ' (Low)' : ''}`,
        formatPDFNumber(cost),
        formatPDFNumber(p.selling_price),
        formatPDFNumber(stock * cost)
      ];
    });

    if (products.length === 0) {
      tableBody.push(['No inventory records found.', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'left' },
        2: { cellWidth: 26, halign: 'left' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });
  }
  else if (reportType === 'financial') {
    const rev = Number(data?.revenue || 0);
    const exp = Number(data?.totalExpenses || 0);
    const gross = Number(data?.grossProfit || 0);
    const net = Number(data?.netProfit || 0);
    const salesCount = Number(data?.salesCount || 0);

    drawSummarySection([
      { label: 'TOTAL REVENUE', value: formatPDFCurrency(rev), color: [22, 163, 74] },
      { label: 'GROSS PROFIT', value: formatPDFCurrency(gross), color: [15, 118, 110] },
      { label: 'OPERATING EXPENSES', value: formatPDFCurrency(exp), color: [220, 38, 38] },
      { label: 'NET PROFIT', value: formatPDFCurrency(net), color: net >= 0 ? [37, 99, 235] : [220, 38, 38] }
    ]);

    const grossMargin = rev > 0 ? ((gross / rev) * 100).toFixed(2) + '%' : '0.00%';
    const netMargin = rev > 0 ? ((net / rev) * 100).toFixed(2) + '%' : '0.00%';

    const finRows = [
      ['Total Completed Sales Invoices', String(salesCount)],
      ['Gross Sales Revenue', formatPDFCurrency(rev)],
      ['Cost of Goods / Direct Deductions', formatPDFCurrency(rev - gross)],
      ['Gross Operating Profit', formatPDFCurrency(gross)],
      ['Gross Profit Margin Ratio', grossMargin],
      ['Total Operating Expenses', formatPDFCurrency(exp)],
      ['Net Operating Profit / Loss', formatPDFCurrency(net)],
      ['Net Profit Margin Ratio', netMargin]
    ];

    renderAutoTable(doc, {
      startY: currentY,
      head: [[
        { content: 'Financial Performance Metric / Statement Item', styles: { halign: 'left' } },
        { content: 'Amount / Ratio', styles: { halign: 'right' } }
      ]],
      body: finRows,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 120, halign: 'left' },
        1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });

    // If expenses exist, add expenses breakdown
    const expenses = data?.expenses || [];
    if (expenses.length > 0) {
      // @ts-ignore
      let lastY = doc.lastAutoTable?.finalY || currentY + 50;
      if (lastY > pageHeight - 40) {
        doc.addPage();
        lastY = 20;
      } else {
        lastY += 7;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Itemized Operating Expenses Breakdown', 14, lastY);
      lastY += 3;

      const expBody = expenses.map((e: any) => [
        formatDateValue(e.date),
        e.category?.name || 'General',
        e.description || '-',
        formatPaymentDisplay(e.payment_method || 'CASH'),
        formatPDFNumber(e.amount)
      ]);

      renderAutoTable(doc, {
        startY: lastY,
        head: [[
          { content: 'Date', styles: { halign: 'center' } },
          { content: 'Category', styles: { halign: 'left' } },
          { content: 'Description', styles: { halign: 'left' } },
          { content: 'Payment Mode', styles: { halign: 'center' } },
          { content: 'Amount (Rs.)', styles: { halign: 'right' } }
        ]],
        body: expBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 32, halign: 'left' },
          2: { cellWidth: 72, halign: 'left' },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14, bottom: 15 }
      });
    }
  }
  else if (reportType === 'customer') {
    const customers = data?.customers || (Array.isArray(data) ? data : []);
    const totalPurchases = customers.reduce((acc: number, c: any) => acc + Number(c.total_purchases || 0), 0);
    const totalPaid = customers.reduce((acc: number, c: any) => acc + Number(c.total_paid || 0), 0);
    const totalOutstanding = customers.reduce((acc: number, c: any) => acc + Number(c.outstanding || 0), 0);
    const dueCount = customers.filter((c: any) => Number(c.outstanding || 0) > 0).length;

    drawSummarySection([
      { label: 'TOTAL CUSTOMERS', value: String(customers.length) },
      { label: 'TOTAL PURCHASES', value: formatPDFCurrency(totalPurchases), color: [22, 163, 74] },
      { label: 'TOTAL PAID', value: formatPDFCurrency(totalPaid) },
      { label: 'OUTSTANDING DUES', value: formatPDFCurrency(totalOutstanding), color: totalOutstanding > 0 ? [220, 38, 38] : [22, 163, 74] },
      { label: 'DUE ACCOUNTS', value: String(dueCount) }
    ]);

    // Available width = 182mm
    // 42 + 24 + 32 + 28 + 28 + 28 = 182mm
    const tableHeaders = [
      { content: 'Customer Name', styles: { halign: 'left' } },
      { content: 'Mobile', styles: { halign: 'center' } },
      { content: 'Village', styles: { halign: 'left' } },
      { content: 'Purchases (Rs.)', styles: { halign: 'right' } },
      { content: 'Paid (Rs.)', styles: { halign: 'right' } },
      { content: 'Outstanding (Rs.)', styles: { halign: 'right' } }
    ];
    const tableBody = customers.map((c: any) => [
      c.name || 'Unnamed',
      c.mobile || '-',
      c.village || '-',
      formatPDFNumber(c.total_purchases),
      formatPDFNumber(c.total_paid),
      formatPDFNumber(c.outstanding)
    ]);

    if (customers.length === 0) {
      tableBody.push(['No customer records found.', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });
  }
  else if (reportType === 'supplier') {
    const suppliers = data?.suppliers || (Array.isArray(data) ? data : []);
    const totalPurchases = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_purchases || 0), 0);
    const totalPaid = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_paid || 0), 0);
    const totalOutstanding = suppliers.reduce((acc: number, s: any) => acc + Number(s.outstanding || 0), 0);
    const payableCount = suppliers.filter((s: any) => Number(s.outstanding || 0) > 0).length;

    drawSummarySection([
      { label: 'TOTAL SUPPLIERS', value: String(suppliers.length) },
      { label: 'TOTAL PURCHASES', value: formatPDFCurrency(totalPurchases), color: [22, 163, 74] },
      { label: 'TOTAL PAID', value: formatPDFCurrency(totalPaid) },
      { label: 'OUTSTANDING PAYABLE', value: formatPDFCurrency(totalOutstanding), color: totalOutstanding > 0 ? [220, 38, 38] : [22, 163, 74] },
      { label: 'PENDING ACCOUNTS', value: String(payableCount) }
    ]);

    // Available width = 182mm
    // 36 + 30 + 24 + 28 + 22 + 20 + 22 = 182mm
    const tableHeaders = [
      { content: 'Supplier Name', styles: { halign: 'left' } },
      { content: 'Company', styles: { halign: 'left' } },
      { content: 'Mobile', styles: { halign: 'center' } },
      { content: 'GSTIN', styles: { halign: 'center' } },
      { content: 'Purchases (Rs.)', styles: { halign: 'right' } },
      { content: 'Paid (Rs.)', styles: { halign: 'right' } },
      { content: 'Payable (Rs.)', styles: { halign: 'right' } }
    ];
    const tableBody = suppliers.map((s: any) => [
      s.name || 'Unnamed',
      s.company || '-',
      s.mobile || '-',
      s.gst_number || '-',
      formatPDFNumber(s.total_purchases),
      formatPDFNumber(s.total_paid),
      formatPDFNumber(s.outstanding)
    ]);

    if (suppliers.length === 0) {
      tableBody.push(['No supplier records found.', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 36, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 30, halign: 'left' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });
  }
  else if (reportType === 'product_sales') {
    const items = data?.items || [];
    const totalQty = Number(data?.totalQuantity || 0);
    const totalSales = Number(data?.totalSales || 0);
    const totalGST = Number(data?.totalGST || 0);
    const totalInvoices = Number(data?.totalInvoices || 0);

    drawSummarySection([
      { label: 'TOTAL QUANTITY SOLD', value: String(totalQty) },
      { label: 'TOTAL SALES REVENUE', value: formatPDFCurrency(totalSales), color: [22, 163, 74] },
      { label: 'TOTAL GST COLLECTED', value: formatPDFCurrency(totalGST) },
      { label: 'NUMBER OF INVOICES', value: String(totalInvoices) }
    ]);

    // Available width = 182mm
    // 26 + 20 + 40 + 14 + 20 + 18 + 20 + 24 = 182mm
    const tableHeaders = [
      { content: 'Invoice #', styles: { halign: 'left' } },
      { content: 'Date', styles: { halign: 'center' } },
      { content: 'Customer', styles: { halign: 'left' } },
      { content: 'Qty', styles: { halign: 'center' } },
      { content: 'Price (Rs.)', styles: { halign: 'right' } },
      { content: 'GST (Rs.)', styles: { halign: 'right' } },
      { content: 'Total (Rs.)', styles: { halign: 'right' } },
      { content: 'Payment', styles: { halign: 'center' } }
    ];
    const tableBody = items.map((it: any) => [
      it.invoice_number || '-',
      formatDateValue(it.sale_date),
      it.customer_name || 'Walk-in Customer',
      String(it.quantity || 1),
      formatPDFNumber(it.unit_price),
      formatPDFNumber(it.gst_amount),
      formatPDFNumber(it.total_amount),
      getSalePaymentMethodDisplay(it)
    ]);

    if (items.length === 0) {
      tableBody.push(['No sales records found for this product.', '', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 40, halign: 'left' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 24, halign: 'center' }
      },
      margin: { left: 14, right: 14, bottom: 15 }
    });
  }

  attachFooters(doc);
  const filename = getReportFilename(reportType, 'pdf', meta.productInfo?.name);
  doc.save(filename);
}

/* ==========================================================================
   3. DEDICATED A4 REPORT PRINT ENGINE
   ========================================================================== */

export function printReportDocument(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  let summaryCardsHtml = '';
  let tableHeadersHtml = '';
  let tableRowsHtml = '';

  if (reportType === 'sales') {
    const sales = data?.sales || [];
    const totalRev = Number(data?.totalRevenue || 0);
    const totalBills = Number(data?.totalCount || sales.length || 0);
    const totalTax = Number(data?.totalTax || 0);
    const totalProfit = Number(data?.totalProfit || 0);
    const avgBill = totalBills > 0 ? totalRev / totalBills : 0;

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL BILLS</div><div class="card-val">${totalBills}</div></div>
        <div class="card"><div class="card-label">TOTAL REVENUE</div><div class="card-val text-green">${formatCurrencyValue(totalRev)}</div></div>
        <div class="card"><div class="card-label">TOTAL GST</div><div class="card-val">${formatCurrencyValue(totalTax)}</div></div>
        <div class="card"><div class="card-label">TOTAL PROFIT</div><div class="card-val text-emerald">${formatCurrencyValue(totalProfit)}</div></div>
        <div class="card"><div class="card-label">AVG BILL VALUE</div><div class="card-val">${formatCurrencyValue(avgBill)}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 14%; text-align: left;">Invoice #</th>
        <th style="width: 11%; text-align: center;">Date</th>
        <th style="width: 21%; text-align: left;">Customer</th>
        <th style="width: 7%; text-align: center;">Items</th>
        <th style="width: 13%; text-align: right;">Total</th>
        <th style="width: 10%; text-align: right;">GST</th>
        <th style="width: 10%; text-align: right;">Profit</th>
        <th style="width: 14%; text-align: center;">Payment</th>
      </tr>
    `;

    tableRowsHtml = sales.length > 0 
      ? sales.map((s: any) => `
        <tr>
          <td style="text-align: left;"><strong>${s.invoice_number || '-'}</strong></td>
          <td style="text-align: center;">${formatDateValue(s.sale_date)}</td>
          <td style="text-align: left;">${s.customer?.name || 'Walk-in'}${s.customer?.mobile ? `<br><small style="color: #64748b;">${s.customer.mobile}</small>` : ''}</td>
          <td style="text-align: center;">${(s.sale_items || []).length}</td>
          <td style="text-align: right;"><strong>${formatCurrencyValue(s.total_amount)}</strong></td>
          <td style="text-align: right;">${formatCurrencyValue(s.tax_amount)}</td>
          <td style="text-align: right; color: #0f766e;">${formatCurrencyValue(s.profit_amount)}</td>
          <td style="text-align: center;"><span class="badge">${getSalePaymentMethodDisplay(s)}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="8" class="text-center empty-cell">No sales records found for the selected period.</td></tr>`;
  }
  else if (reportType === 'inventory') {
    const products = data?.products || [];
    const totalVal = Number(data?.totalValue || 0);
    const lowStock = products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
    const lowStockCount = Number(data?.lowStockCount ?? lowStock.length);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL PRODUCTS</div><div class="card-val">${products.length}</div></div>
        <div class="card"><div class="card-label">TOTAL VALUATION</div><div class="card-val text-green">${formatCurrencyValue(totalVal)}</div></div>
        <div class="card"><div class="card-label">LOW STOCK ITEMS</div><div class="card-val text-red">${lowStockCount}</div></div>
        <div class="card"><div class="card-label">HEALTHY STOCK</div><div class="card-val">${products.length - lowStockCount}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 25%;">Product Name</th>
        <th style="width: 12%;">SKU</th>
        <th style="width: 15%;">Category</th>
        <th style="width: 12%; text-align: center;">Stock</th>
        <th style="width: 11%; text-align: right;">Cost</th>
        <th style="width: 11%; text-align: right;">Price</th>
        <th style="width: 14%; text-align: right;">Value</th>
      </tr>
    `;

    tableRowsHtml = products.length > 0
      ? products.map((p: any) => {
        const stock = Number(p.current_stock || 0);
        const cost = Number(p.purchase_price || 0);
        const isLow = stock <= Number(p.min_stock || 5);
        const formattedName = formatProductNameWithSize(p.name, p.pack_size, p.unit);
        return `
          <tr>
            <td><strong>${formattedName || p.name || 'Unnamed'}</strong></td>
            <td>${p.sku || '-'}</td>
            <td>${p.category?.name || '-'}</td>
            <td style="text-align: center;"><strong>${stock} ${p.unit || 'Piece'}</strong>${isLow ? ' <span style="color: #dc2626; font-size: 8px;">(Low)</span>' : ''}</td>
            <td style="text-align: right;">${formatCurrencyValue(cost)}</td>
            <td style="text-align: right;">${formatCurrencyValue(p.selling_price)}</td>
            <td style="text-align: right;"><strong>${formatCurrencyValue(stock * cost)}</strong></td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="7" class="text-center empty-cell">No inventory records found.</td></tr>`;
  }
  else if (reportType === 'financial') {
    const rev = Number(data?.revenue || 0);
    const exp = Number(data?.totalExpenses || 0);
    const gross = Number(data?.grossProfit || 0);
    const net = Number(data?.netProfit || 0);
    const salesCount = Number(data?.salesCount || 0);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL REVENUE</div><div class="card-val text-green">${formatCurrencyValue(rev)}</div></div>
        <div class="card"><div class="card-label">GROSS PROFIT</div><div class="card-val text-emerald">${formatCurrencyValue(gross)}</div></div>
        <div class="card"><div class="card-label">OPERATING EXPENSES</div><div class="card-val text-red">${formatCurrencyValue(exp)}</div></div>
        <div class="card"><div class="card-label">NET PROFIT</div><div class="card-val" style="color: ${net >= 0 ? '#2563eb' : '#dc2626'};">${formatCurrencyValue(net)}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 60%;">Financial Breakdown Item</th>
        <th style="width: 40%; text-align: right;">Amount / Ratio</th>
      </tr>
    `;

    tableRowsHtml = `
      <tr><td>Total Completed Sales Invoices</td><td style="text-align: right;"><strong>${salesCount}</strong></td></tr>
      <tr><td>Gross Sales Revenue</td><td style="text-align: right;"><strong>${formatCurrencyValue(rev)}</strong></td></tr>
      <tr><td>Cost of Goods Sold / Direct Deductions</td><td style="text-align: right;">${formatCurrencyValue(rev - gross)}</td></tr>
      <tr><td>Gross Operating Profit</td><td style="text-align: right; color: #0f766e;"><strong>${formatCurrencyValue(gross)}</strong></td></tr>
      <tr><td>Total Operating Expenses</td><td style="text-align: right; color: #dc2626;"><strong>${formatCurrencyValue(exp)}</strong></td></tr>
      <tr style="background-color: #f0fdf4;"><td><strong>Net Operating Profit / Loss</strong></td><td style="text-align: right; color: #166534;"><strong>${formatCurrencyValue(net)}</strong></td></tr>
    `;
  }
  else if (reportType === 'customer') {
    const customers = data?.customers || (Array.isArray(data) ? data : []);
    const totalPurchases = customers.reduce((acc: number, c: any) => acc + Number(c.total_purchases || 0), 0);
    const totalPaid = customers.reduce((acc: number, c: any) => acc + Number(c.total_paid || 0), 0);
    const totalOutstanding = customers.reduce((acc: number, c: any) => acc + Number(c.outstanding || 0), 0);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL CUSTOMERS</div><div class="card-val">${customers.length}</div></div>
        <div class="card"><div class="card-label">TOTAL PURCHASES</div><div class="card-val text-green">${formatCurrencyValue(totalPurchases)}</div></div>
        <div class="card"><div class="card-label">TOTAL PAID</div><div class="card-val">${formatCurrencyValue(totalPaid)}</div></div>
        <div class="card"><div class="card-label">OUTSTANDING DUES</div><div class="card-val text-red">${formatCurrencyValue(totalOutstanding)}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 25%;">Customer Name</th>
        <th style="width: 15%;">Mobile</th>
        <th style="width: 18%;">Village</th>
        <th style="width: 14%; text-align: right;">Purchases</th>
        <th style="width: 14%; text-align: right;">Paid</th>
        <th style="width: 14%; text-align: right;">Outstanding</th>
      </tr>
    `;

    tableRowsHtml = customers.length > 0
      ? customers.map((c: any) => {
        const out = Number(c.outstanding || 0);
        return `
          <tr>
            <td><strong>${c.name || 'Unnamed'}</strong></td>
            <td>${c.mobile || '-'}</td>
            <td>${c.village || '-'}</td>
            <td style="text-align: right;">${formatCurrencyValue(c.total_purchases)}</td>
            <td style="text-align: right;">${formatCurrencyValue(c.total_paid)}</td>
            <td style="text-align: right; ${out > 0 ? 'color: #dc2626; font-weight: bold;' : ''}">${formatCurrencyValue(out)}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="6" class="text-center empty-cell">No customer records found.</td></tr>`;
  }
  else if (reportType === 'supplier') {
    const suppliers = data?.suppliers || (Array.isArray(data) ? data : []);
    const totalPurchases = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_purchases || 0), 0);
    const totalPaid = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_paid || 0), 0);
    const totalOutstanding = suppliers.reduce((acc: number, s: any) => acc + Number(s.outstanding || 0), 0);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL SUPPLIERS</div><div class="card-val">${suppliers.length}</div></div>
        <div class="card"><div class="card-label">TOTAL PURCHASES</div><div class="card-val text-green">${formatCurrencyValue(totalPurchases)}</div></div>
        <div class="card"><div class="card-label">TOTAL PAID</div><div class="card-val">${formatCurrencyValue(totalPaid)}</div></div>
        <div class="card"><div class="card-label">OUTSTANDING PAYABLE</div><div class="card-val text-red">${formatCurrencyValue(totalOutstanding)}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 20%;">Supplier Name</th>
        <th style="width: 18%;">Company</th>
        <th style="width: 14%;">Mobile</th>
        <th style="width: 16%;">GSTIN</th>
        <th style="width: 11%; text-align: right;">Purchases</th>
        <th style="width: 10%; text-align: right;">Paid</th>
        <th style="width: 11%; text-align: right;">Payable</th>
      </tr>
    `;

    tableRowsHtml = suppliers.length > 0
      ? suppliers.map((s: any) => {
        const out = Number(s.outstanding || 0);
        return `
          <tr>
            <td><strong>${s.name || 'Unnamed'}</strong></td>
            <td>${s.company || '-'}</td>
            <td>${s.mobile || '-'}</td>
            <td>${s.gst_number || '-'}</td>
            <td style="text-align: right;">${formatCurrencyValue(s.total_purchases)}</td>
            <td style="text-align: right;">${formatCurrencyValue(s.total_paid)}</td>
            <td style="text-align: right; ${out > 0 ? 'color: #dc2626; font-weight: bold;' : ''}">${formatCurrencyValue(out)}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="7" class="text-center empty-cell">No supplier records found.</td></tr>`;
  }
  else if (reportType === 'product_sales') {
    const items = data?.items || [];
    const totalQty = Number(data?.totalQuantity || 0);
    const totalSales = Number(data?.totalSales || 0);
    const totalGST = Number(data?.totalGST || 0);
    const totalInvoices = Number(data?.totalInvoices || 0);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card"><div class="card-label">TOTAL QUANTITY SOLD</div><div class="card-val">${totalQty}</div></div>
        <div class="card"><div class="card-label">TOTAL SALES REVENUE</div><div class="card-val text-green">${formatCurrencyValue(totalSales)}</div></div>
        <div class="card"><div class="card-label">TOTAL GST COLLECTED</div><div class="card-val">${formatCurrencyValue(totalGST)}</div></div>
        <div class="card"><div class="card-label">NUMBER OF INVOICES</div><div class="card-val">${totalInvoices}</div></div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 14%; text-align: left;">Invoice #</th>
        <th style="width: 11%; text-align: center;">Date</th>
        <th style="width: 22%; text-align: left;">Customer</th>
        <th style="width: 8%; text-align: center;">Qty</th>
        <th style="width: 11%; text-align: right;">Price</th>
        <th style="width: 10%; text-align: right;">GST</th>
        <th style="width: 11%; text-align: right;">Total</th>
        <th style="width: 13%; text-align: center;">Payment</th>
      </tr>
    `;

    tableRowsHtml = items.length > 0
      ? items.map((it: any) => `
        <tr>
          <td style="text-align: left;"><strong>${it.invoice_number || '-'}</strong></td>
          <td style="text-align: center;">${formatDateValue(it.sale_date)}</td>
          <td style="text-align: left;">${it.customer_name || 'Walk-in Customer'}${it.customer_mobile && it.customer_mobile !== '-' ? `<br><small style="color: #64748b;">${it.customer_mobile}</small>` : ''}</td>
          <td style="text-align: center;"><strong>${it.quantity}</strong></td>
          <td style="text-align: right;">${formatCurrencyValue(it.unit_price)}</td>
          <td style="text-align: right;">${formatCurrencyValue(it.gst_amount)}</td>
          <td style="text-align: right;"><strong>${formatCurrencyValue(it.total_amount)}</strong></td>
          <td style="text-align: center;"><span class="badge">${getSalePaymentMethodDisplay(it)}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="8" class="text-center empty-cell">No sales records found for this product.</td></tr>`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${meta.title} - ${shop.shopName || 'Krushi OS'}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #ffffff; font-size: 11px; line-height: 1.4; padding: 8px; }
        .header { text-align: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; }
        .shop-name { font-size: 18px; font-weight: 800; color: #166534; letter-spacing: 0.5px; text-transform: uppercase; }
        .shop-sub { font-size: 9.5px; color: #475569; margin-top: 2px; }
        .report-title-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
        .report-meta { font-size: 9px; color: #64748b; text-align: right; }
        .summary-grid { display: flex; gap: 8px; margin-bottom: 14px; }
        .card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
        .card-label { font-size: 8px; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .card-val { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
        .text-green { color: #16a34a !important; }
        .text-emerald { color: #0d9488 !important; }
        .text-red { color: #dc2626 !important; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        th { background-color: #166534; color: #ffffff; font-size: 9px; font-weight: 700; text-align: left; padding: 5px 6px; border: 1px solid #14532d; }
        td { font-size: 9.5px; padding: 5px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
        tbody tr:nth-child(even) { background-color: #f8fafc; }
        .empty-cell { text-align: center; padding: 20px; color: #94a3b8; font-style: italic; }
        .badge { display: inline-block; padding: 2px 5px; font-size: 7.5px; font-weight: 700; border-radius: 3px; background: #e2e8f0; color: #334155; }
        .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="shop-name">${shop.shopName ? shop.shopName.toUpperCase() : 'KRUSHI OS STORE'}</div>
        <div class="shop-sub">
          ${[
            shop.ownerName ? `Prop: ${shop.ownerName}` : '',
            shopAddr || '',
            shop.contact1 ? `Phone: ${shop.contact1}` : '',
            shop.gstNumber ? `GSTIN: ${shop.gstNumber}` : '',
            shop.licenseNumber ? `License: ${shop.licenseNumber}` : ''
          ].filter(Boolean).join(' | ')}
        </div>
      </div>

      <div class="report-title-bar">
        <div>
          <div class="report-title">${meta.title}</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
            ${[
              meta.productInfo ? `Product: ${formatProductNameWithSize(meta.productInfo.name, meta.productInfo.pack_size, meta.productInfo.unit)}` : '',
              meta.productInfo?.sku ? `SKU: ${meta.productInfo.sku}` : '',
              meta.dateRange || meta.periodLabel ? `Period: ${meta.dateRange || meta.periodLabel}` : '',
              meta.statusFilter ? `Status: ${meta.statusFilter}` : '',
              meta.searchQuery ? `Search: "${meta.searchQuery}"` : ''
            ].filter(Boolean).join(' &bull; ')}
          </div>
        </div>
        <div class="report-meta">
          <div>Generated: ${dateStr}</div>
          <div>Authorized Krushi OS Report</div>
        </div>
      </div>

      ${summaryCardsHtml}

      <table>
        <thead>
          ${tableHeadersHtml}
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>Krushi OS &bull; Computer Generated Agribusiness Report</div>
        <div>Page 1</div>
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const docIframe = iframe.contentWindow?.document;
  if (!docIframe) {
    window.print();
    return;
  }

  docIframe.open();
  docIframe.write(htmlContent);
  docIframe.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }, 250);
  };
}
