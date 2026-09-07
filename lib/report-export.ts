import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShopDetails, formatShopAddress } from '@/lib/shop-details';

export interface ReportFilterMeta {
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier';
  title: string;
  dateRange?: string;
  periodLabel?: string;
  statusFilter?: string;
  searchQuery?: string;
  generatedAt?: string;
}

// Formatting helpers
export function formatCurrencyValue(num: number | string | undefined | null): string {
  const val = Number(num) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val);
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

export function getReportFilename(reportType: string, extension: 'xlsx' | 'pdf'): string {
  const today = new Date().toISOString().split('T')[0];
  const typeMap: Record<string, string> = {
    sales: 'Sales',
    inventory: 'Inventory',
    financial: 'Financial',
    customer: 'Customer',
    supplier: 'Supplier'
  };
  const label = typeMap[reportType.toLowerCase()] || 'Report';
  return `KrushiOS_${label}_Report_${today}.${extension}`;
}

/* ==========================================================================
   1. EXCEL EXPORT ENGINE (.xlsx)
   ========================================================================== */

export function exportReportToExcel(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const wb = XLSX.utils.book_new();
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  // Common Header Metadata Rows
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

    // Sheet 1: Summary
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

    // Sheet 2: Sales Details
    const detailHeaders = [
      'Invoice Number',
      'Date',
      'Customer Name',
      'Customer Mobile',
      'Customer Village',
      'Subtotal (₹)',
      'Discount (₹)',
      'GST / Tax (₹)',
      'Total Amount (₹)',
      'Profit (₹)',
      'Payment Status',
      'Status'
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
      (s.payment_status || 'PAID').toUpperCase(),
      (s.status || 'COMPLETED').toUpperCase()
    ]);

    const salesSheetData = sales.length > 0 
      ? [
          ...createMetaRows('Sales Transactions Details'),
          detailHeaders,
          ...detailRows,
          [''],
          ['Total', '', '', '', '', '', '', totalTax, totalRev, totalProfit, '', '']
        ]
      : [
          ...createMetaRows('Sales Transactions Details'),
          ['No sales records found for the selected period / filters.']
        ];

    const wsDetails = XLSX.utils.aoa_to_sheet(salesSheetData);
    wsDetails['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Sales Details');

    // Sheet 3: Itemized Product Sales
    const itemHeaders = [
      'Invoice Number',
      'Date',
      'Customer',
      'Product Name',
      'SKU',
      'Quantity',
      'Unit',
      'Unit Price (₹)',
      'GST Rate (%)',
      'Tax Amount (₹)',
      'Total Amount (₹)',
      'Profit (₹)'
    ];

    const itemRows: any[] = [];
    for (const sale of sales) {
      const items = sale.sale_items || [];
      for (const item of items) {
        itemRows.push([
          sale.invoice_number || '-',
          formatDateValue(sale.sale_date),
          sale.customer?.name || 'Walk-in',
          item.product_name || item.product?.name || 'Item',
          item.product?.sku || '-',
          Number(item.quantity || 0),
          item.product?.unit || 'Piece',
          Number(item.unit_price || 0),
          Number(item.gst_rate || 0),
          Number(item.tax_amount || 0),
          Number(item.total_amount || 0),
          Number(item.profit_amount || 0)
        ]);
      }
    }

    const wsItems = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Itemized Product Sales'),
      itemHeaders,
      ...itemRows
    ]);
    wsItems['!cols'] = [
      { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsItems, 'Product-wise Sales');
  } 
  else if (reportType === 'inventory') {
    const products = data?.products || [];
    const totalVal = Number(data?.totalValue || 0);
    const lowStock = products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
    const lowStockCount = Number(data?.lowStockCount ?? lowStock.length);

    // Sheet 1: Summary
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

    // Sheet 2: Current Stock
    const invHeaders = [
      'Product Name',
      'SKU / Code',
      'Category',
      'Current Stock',
      'Unit',
      'Purchase Cost (₹)',
      'Selling Price (₹)',
      'Inventory Value (₹)',
      'Min Stock Level',
      'Stock Status'
    ];

    const mapProductRow = (p: any) => {
      const stock = Number(p.current_stock || 0);
      const cost = Number(p.purchase_price || 0);
      const minStock = Number(p.min_stock || 5);
      const isLow = stock <= minStock;
      return [
        p.name || 'Unnamed Product',
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

    // Sheet 3: Low Stock
    const lowRows = lowStock.map(mapProductRow);
    const wsLow = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Low Stock Reorder Alert'),
      invHeaders,
      ...(lowRows.length > 0 ? lowRows : [['No low stock products found.', '', '', '', '', '', '', '', '', '']])
    ]);
    wsLow['!cols'] = wsCurrent['!cols'];
    XLSX.utils.book_append_sheet(wb, wsLow, 'Low Stock Alert');
  }
  else if (reportType === 'financial') {
    const rev = Number(data?.revenue || 0);
    const exp = Number(data?.totalExpenses || 0);
    const gross = Number(data?.grossProfit || 0);
    const net = Number(data?.netProfit || 0);
    const salesCount = Number(data?.salesCount || 0);
    const grossMargin = rev > 0 ? ((gross / rev) * 100).toFixed(2) + '%' : '0.00%';
    const netMargin = rev > 0 ? ((net / rev) * 100).toFixed(2) + '%' : '0.00%';

    // Sheet 1: Financial Summary
    const summaryRows = [
      ...createMetaRows('Financial Performance & P&L Statement'),
      ['FINANCIAL SUMMARY', ''],
      ['Key Performance Indicator', 'Amount (₹) / Ratio'],
      ['Gross Sales Revenue (₹)', rev],
      ['Cost of Goods Sold / Margin Deductions (₹)', rev - gross],
      ['Gross Operating Profit (₹)', gross],
      ['Gross Profit Margin', grossMargin],
      ['Total Operating Expenses (₹)', exp],
      ['Net Operating Profit / Loss (₹)', net],
      ['Net Profit Margin', netMargin],
      ['Total Completed Sales Invoices', salesCount]
    ];
    const wsFinSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsFinSummary['!cols'] = [{ wch: 40 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsFinSummary, 'P&L Summary');

    // Sheet 2: Operating Expenses
    const expenses = data?.expenses || [];
    const expHeaders = ['Date', 'Expense Category', 'Description', 'Payment Mode', 'Amount (₹)'];
    const expRows = expenses.map((e: any) => [
      formatDateValue(e.date || e.created_at),
      e.category?.name || 'General',
      e.description || '-',
      (e.payment_method || 'CASH').toUpperCase(),
      Number(e.amount || 0)
    ]);

    const wsExpenses = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Itemized Operating Expenses'),
      expHeaders,
      ...(expRows.length > 0 ? expRows : [['No expense records found for the selected period.', '', '', '', '']]),
      [''],
      ['Total Operating Expenses', '', '', '', exp]
    ]);
    wsExpenses['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 35 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Operating Expenses');

    // Sheet 3: Sales Revenue Breakdown
    const sales = data?.sales || [];
    const salesHeaders = ['Invoice Number', 'Date', 'Customer', 'Revenue (₹)', 'Tax (₹)', 'Profit (₹)', 'Payment Status'];
    const salesRows = sales.map((s: any) => [
      s.invoice_number || '-',
      formatDateValue(s.sale_date),
      s.customer?.name || 'Walk-in',
      Number(s.total_amount || 0),
      Number(s.tax_amount || 0),
      Number(s.profit_amount || 0),
      (s.payment_status || 'PAID').toUpperCase()
    ]);
    const wsSalesBreakdown = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Sales Invoices Breakdown'),
      salesHeaders,
      ...(salesRows.length > 0 ? salesRows : [['No sales invoices found for the selected period.', '', '', '', '', '', '']])
    ]);
    wsSalesBreakdown['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSalesBreakdown, 'Sales Breakdown');
  }
  else if (reportType === 'customer') {
    const customers = data?.customers || (Array.isArray(data) ? data : []);
    const totalPurchases = customers.reduce((acc: number, c: any) => acc + Number(c.total_purchases || 0), 0);
    const totalPaid = customers.reduce((acc: number, c: any) => acc + Number(c.total_paid || 0), 0);
    const totalOutstanding = customers.reduce((acc: number, c: any) => acc + Number(c.outstanding || 0), 0);

    const custHeaders = [
      'Customer Name',
      'Mobile Number',
      'Village / City',
      'Address',
      'Total Purchases (₹)',
      'Total Paid (₹)',
      'Outstanding Balance (₹)',
      'Account Status'
    ];

    const custRows = customers.map((c: any) => {
      const out = Number(c.outstanding || 0);
      return [
        c.name || 'Unnamed',
        c.mobile || '-',
        c.village || '-',
        c.address || '-',
        Number(c.total_purchases || 0),
        Number(c.total_paid || 0),
        out,
        out > 0 ? 'OUTSTANDING DUE' : 'CLEAR'
      ];
    });

    const wsCustomers = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Customer Accounts & Ledger Report'),
      ['SUMMARY METRICS', ''],
      ['Total Customer Accounts', customers.length],
      ['Total Lifetime Purchases (₹)', totalPurchases],
      ['Total Lifetime Payments (₹)', totalPaid],
      ['Total Outstanding Dues (₹)', totalOutstanding],
      [''],
      custHeaders,
      ...(custRows.length > 0 ? custRows : [['No customer records found.', '', '', '', '', '', '', '']]),
      [''],
      ['Total', '', '', '', totalPurchases, totalPaid, totalOutstanding, '']
    ]);
    wsCustomers['!cols'] = [
      { wch: 25 }, { wch: 16 }, { wch: 18 }, { wch: 25 },
      { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customer Ledger');
  }
  else if (reportType === 'supplier') {
    const suppliers = data?.suppliers || (Array.isArray(data) ? data : []);
    const totalPurchases = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_purchases || 0), 0);
    const totalPaid = suppliers.reduce((acc: number, s: any) => acc + Number(s.total_paid || 0), 0);
    const totalOutstanding = suppliers.reduce((acc: number, s: any) => acc + Number(s.outstanding || 0), 0);

    const suppHeaders = [
      'Supplier Name',
      'Company / Agency',
      'Mobile Number',
      'Email Address',
      'GSTIN',
      'Total Purchases (₹)',
      'Total Paid (₹)',
      'Outstanding Payable (₹)',
      'Account Status'
    ];

    const suppRows = suppliers.map((s: any) => {
      const out = Number(s.outstanding || 0);
      return [
        s.name || 'Unnamed',
        s.company || '-',
        s.mobile || '-',
        s.email || '-',
        s.gst_number || '-',
        Number(s.total_purchases || 0),
        Number(s.total_paid || 0),
        out,
        out > 0 ? 'PAYABLE PENDING' : 'SETTLED'
      ];
    });

    const wsSuppliers = XLSX.utils.aoa_to_sheet([
      ...createMetaRows('Supplier Accounts & Payables Report'),
      ['SUMMARY METRICS', ''],
      ['Total Supplier Accounts', suppliers.length],
      ['Total Lifetime Purchases (₹)', totalPurchases],
      ['Total Lifetime Payments (₹)', totalPaid],
      ['Total Outstanding Payable (₹)', totalOutstanding],
      [''],
      suppHeaders,
      ...(suppRows.length > 0 ? suppRows : [['No supplier records found.', '', '', '', '', '', '', '', '']]),
      [''],
      ['Total', '', '', '', '', totalPurchases, totalPaid, totalOutstanding, '']
    ]);
    wsSuppliers['!cols'] = [
      { wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 22 }, { wch: 18 },
      { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Supplier Ledger');
  }

  const filename = getReportFilename(reportType, 'xlsx');
  XLSX.writeFile(wb, filename);
}

function renderAutoTable(doc: jsPDF, options: any) {
  if (typeof (doc as any).autoTable === 'function') {
    (doc as any).autoTable(options);
  } else if (typeof autoTable === 'function') {
    (autoTable as any)(doc, options);
  } else if (typeof (autoTable as any)?.default === 'function') {
    (autoTable as any).default(doc, options);
  }
}

/* ==========================================================================
   2. PDF EXPORT ENGINE (A4 Document)
   ========================================================================== */

export function exportReportToPDF(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  let currentY = 15;

  // Header Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(22, 101, 52); // Krushi green #166534
  const shopTitle = (shop.shopName || 'KRUSHI OS STORE').toUpperCase();
  doc.text(shopTitle, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);

  const subHeaderLines: string[] = [];
  if (shop.ownerName) subHeaderLines.push(`Prop: ${shop.ownerName}`);
  if (shopAddr) subHeaderLines.push(shopAddr);
  if (shop.contact1) subHeaderLines.push(`Phone: ${shop.contact1}`);
  if (shop.gstNumber) subHeaderLines.push(`GSTIN: ${shop.gstNumber}`);
  if (shop.licenseNumber) subHeaderLines.push(`Lic: ${shop.licenseNumber}`);

  if (subHeaderLines.length > 0) {
    const line1 = subHeaderLines.slice(0, 2).join(' | ');
    doc.text(line1, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;
    if (subHeaderLines.length > 2) {
      const line2 = subHeaderLines.slice(2).join(' | ');
      doc.text(line2, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    }
  }

  // Divider Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 5;

  // Report Title & Filter Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text(meta.title.toUpperCase(), 14, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${dateStr}`, pageWidth - 14, currentY, { align: 'right' });
  currentY += 4.5;

  if (meta.dateRange || meta.periodLabel || meta.statusFilter || meta.searchQuery) {
    const filterParts: string[] = [];
    if (meta.dateRange || meta.periodLabel) filterParts.push(`Period: ${meta.dateRange || meta.periodLabel}`);
    if (meta.statusFilter) filterParts.push(`Status: ${meta.statusFilter}`);
    if (meta.searchQuery) filterParts.push(`Search: "${meta.searchQuery}"`);

    doc.text(filterParts.join('  •  '), 14, currentY);
    currentY += 5;
  } else {
    currentY += 2;
  }

  // Helper for footer
  const attachFooters = (docInstance: jsPDF) => {
    // @ts-ignore
    const totalPages = docInstance.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      docInstance.setPage(i);
      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(8);
      docInstance.setTextColor(130, 130, 130);
      
      docInstance.setDrawColor(220, 220, 220);
      docInstance.setLineWidth(0.3);
      docInstance.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

      docInstance.text('Krushi OS | Computer Generated Report', 14, pageHeight - 6);
      docInstance.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 6, { align: 'right' });
    }
  };

  // Helper for summary cards / table
  const drawSummarySection = (items: { label: string; value: string; color?: [number, number, number] }[]) => {
    const cardWidth = (pageWidth - 28 - (items.length - 1) * 3) / items.length;
    const cardHeight = 13;

    items.forEach((item, idx) => {
      const x = 14 + idx * (cardWidth + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(item.label, x + 3, currentY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (item.color) {
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(item.value, x + 3, currentY + 10);
    });

    currentY += cardHeight + 5;
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
      { label: 'TOTAL REVENUE', value: formatCurrencyValue(totalRev), color: [22, 163, 74] },
      { label: 'TOTAL GST', value: formatCurrencyValue(totalTax) },
      { label: 'TOTAL PROFIT', value: formatCurrencyValue(totalProfit), color: [15, 118, 110] },
      { label: 'AVG BILL VALUE', value: formatCurrencyValue(avgBill) }
    ]);

    const tableHeaders = ['Invoice #', 'Date', 'Customer', 'Items', 'Total (₹)', 'GST (₹)', 'Profit (₹)', 'Payment'];
    const tableBody = sales.map((s: any) => {
      const itemsCount = (s.sale_items || []).length;
      return [
        s.invoice_number || '-',
        formatDateValue(s.sale_date),
        s.customer?.name || 'Walk-in',
        itemsCount > 0 ? `${itemsCount} item${itemsCount > 1 ? 's' : ''}` : '-',
        formatCurrencyValue(s.total_amount),
        formatCurrencyValue(s.tax_amount),
        formatCurrencyValue(s.profit_amount),
        (s.payment_status || 'PAID').toUpperCase()
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
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 18 },
        2: { cellWidth: 42 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 16, halign: 'center' }
      },
      margin: { left: 14, right: 14, bottom: 16 }
    });
  }
  else if (reportType === 'inventory') {
    const products = data?.products || [];
    const totalVal = Number(data?.totalValue || 0);
    const lowStock = products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
    const lowStockCount = Number(data?.lowStockCount ?? lowStock.length);

    drawSummarySection([
      { label: 'TOTAL PRODUCTS', value: String(products.length) },
      { label: 'TOTAL VALUATION', value: formatCurrencyValue(totalVal), color: [22, 163, 74] },
      { label: 'LOW STOCK ITEMS', value: String(lowStockCount), color: [220, 38, 38] },
      { label: 'HEALTHY STOCK', value: String(products.length - lowStockCount) }
    ]);

    const tableHeaders = ['Product Name', 'SKU', 'Category', 'Stock Level', 'Cost (₹)', 'Price (₹)', 'Value (₹)', 'Status'];
    const tableBody = products.map((p: any) => {
      const stock = Number(p.current_stock || 0);
      const cost = Number(p.purchase_price || 0);
      const isLow = stock <= Number(p.min_stock || 5);
      return [
        p.name || 'Unnamed',
        p.sku || '-',
        p.category?.name || '-',
        `${stock} ${p.unit || 'Piece'}`,
        formatCurrencyValue(cost),
        formatCurrencyValue(p.selling_price),
        formatCurrencyValue(stock * cost),
        isLow ? 'LOW STOCK' : 'IN STOCK'
      ];
    });

    if (products.length === 0) {
      tableBody.push(['No inventory records found.', '', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 20 },
        2: { cellWidth: 26 },
        3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 14, halign: 'center' }
      },
      margin: { left: 14, right: 14, bottom: 16 }
    });
  }
  else if (reportType === 'financial') {
    const rev = Number(data?.revenue || 0);
    const exp = Number(data?.totalExpenses || 0);
    const gross = Number(data?.grossProfit || 0);
    const net = Number(data?.netProfit || 0);
    const salesCount = Number(data?.salesCount || 0);

    drawSummarySection([
      { label: 'TOTAL REVENUE', value: formatCurrencyValue(rev), color: [22, 163, 74] },
      { label: 'GROSS PROFIT', value: formatCurrencyValue(gross), color: [15, 118, 110] },
      { label: 'EXPENSES', value: formatCurrencyValue(exp), color: [220, 38, 38] },
      { label: 'NET PROFIT', value: formatCurrencyValue(net), color: net >= 0 ? [37, 99, 235] : [220, 38, 38] }
    ]);

    // Financial Breakdown Table
    const grossMargin = rev > 0 ? ((gross / rev) * 100).toFixed(2) + '%' : '0.00%';
    const netMargin = rev > 0 ? ((net / rev) * 100).toFixed(2) + '%' : '0.00%';

    const finRows = [
      ['Total Completed Sales Invoices', String(salesCount)],
      ['Gross Sales Revenue', formatCurrencyValue(rev)],
      ['Cost of Goods / Deductions', formatCurrencyValue(rev - gross)],
      ['Gross Operating Profit', formatCurrencyValue(gross)],
      ['Gross Profit Margin Ratio', grossMargin],
      ['Total Operating Expenses', formatCurrencyValue(exp)],
      ['Net Operating Profit / Loss', formatCurrencyValue(net)],
      ['Net Profit Margin Ratio', netMargin]
    ];

    renderAutoTable(doc, {
      startY: currentY,
      head: [['Financial Metric / Breakdown', 'Amount / Percentage']],
      body: finRows,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 16 }
    });

    // If expenses are present, add expenses table
    const expenses = data?.expenses || [];
    if (expenses.length > 0) {
      // @ts-ignore
      let lastY = doc.lastAutoTable?.finalY || currentY + 50;
      if (lastY > pageHeight - 40) {
        doc.addPage();
        lastY = 20;
      } else {
        lastY += 8;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      doc.text('Itemized Operating Expenses', 14, lastY);
      lastY += 3;

      const expBody = expenses.map((e: any) => [
        formatDateValue(e.date),
        e.category?.name || 'General',
        e.description || '-',
        (e.payment_method || 'CASH').toUpperCase(),
        formatCurrencyValue(e.amount)
      ]);

      renderAutoTable(doc, {
        startY: lastY,
        head: [['Date', 'Category', 'Description', 'Payment Mode', 'Amount (₹)']],
        body: expBody,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 32 },
          2: { cellWidth: 70 },
          3: { cellWidth: 26, halign: 'center' },
          4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14, bottom: 16 }
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
      { label: 'TOTAL PURCHASES', value: formatCurrencyValue(totalPurchases), color: [22, 163, 74] },
      { label: 'TOTAL PAID', value: formatCurrencyValue(totalPaid) },
      { label: 'OUTSTANDING DUES', value: formatCurrencyValue(totalOutstanding), color: totalOutstanding > 0 ? [220, 38, 38] : [22, 163, 74] },
      { label: 'DUE ACCOUNTS', value: String(dueCount) }
    ]);

    const tableHeaders = ['Customer Name', 'Mobile', 'Village', 'Total Purchases (₹)', 'Total Paid (₹)', 'Outstanding (₹)'];
    const tableBody = customers.map((c: any) => [
      c.name || 'Unnamed',
      c.mobile || '-',
      c.village || '-',
      formatCurrencyValue(c.total_purchases),
      formatCurrencyValue(c.total_paid),
      formatCurrencyValue(c.outstanding)
    ]);

    if (customers.length === 0) {
      tableBody.push(['No customer records found.', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 26 },
        2: { cellWidth: 32 },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 16 }
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
      { label: 'TOTAL PURCHASES', value: formatCurrencyValue(totalPurchases), color: [22, 163, 74] },
      { label: 'TOTAL PAID', value: formatCurrencyValue(totalPaid) },
      { label: 'OUTSTANDING PAYABLE', value: formatCurrencyValue(totalOutstanding), color: totalOutstanding > 0 ? [220, 38, 38] : [22, 163, 74] },
      { label: 'PENDING ACCOUNTS', value: String(payableCount) }
    ]);

    const tableHeaders = ['Supplier Name', 'Company', 'Mobile', 'GSTIN', 'Purchases (₹)', 'Paid (₹)', 'Payable Due (₹)'];
    const tableBody = suppliers.map((s: any) => [
      s.name || 'Unnamed',
      s.company || '-',
      s.mobile || '-',
      s.gst_number || '-',
      formatCurrencyValue(s.total_purchases),
      formatCurrencyValue(s.total_paid),
      formatCurrencyValue(s.outstanding)
    ]);

    if (suppliers.length === 0) {
      tableBody.push(['No supplier records found.', '', '', '', '', '', '']);
    }

    renderAutoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 34 },
        1: { cellWidth: 32 },
        2: { cellWidth: 22 },
        3: { cellWidth: 26 },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 14, right: 14, bottom: 16 }
    });
  }

  attachFooters(doc);
  const filename = getReportFilename(reportType, 'pdf');
  doc.save(filename);
}

/* ==========================================================================
   3. DEDICATED A4 REPORT PRINT ENGINE
   ========================================================================== */

export function printReportDocument(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
  const dateStr = meta.generatedAt || new Date().toLocaleString('en-IN');
  const shopAddr = formatShopAddress(shop);

  // Generate printable HTML specifically formatted for A4 multi-page report
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
        <div class="card">
          <div class="card-label">TOTAL BILLS</div>
          <div class="card-val">${totalBills}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL REVENUE</div>
          <div class="card-val text-green">${formatCurrencyValue(totalRev)}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL GST</div>
          <div class="card-val">${formatCurrencyValue(totalTax)}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL PROFIT</div>
          <div class="card-val text-emerald">${formatCurrencyValue(totalProfit)}</div>
        </div>
        <div class="card">
          <div class="card-label">AVG BILL VALUE</div>
          <div class="card-val">${formatCurrencyValue(avgBill)}</div>
        </div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 14%;">Invoice #</th>
        <th style="width: 10%;">Date</th>
        <th style="width: 24%;">Customer</th>
        <th style="width: 8%; text-align: center;">Items</th>
        <th style="width: 12%; text-align: right;">Total (₹)</th>
        <th style="width: 11%; text-align: right;">GST (₹)</th>
        <th style="width: 11%; text-align: right;">Profit (₹)</th>
        <th style="width: 10%; text-align: center;">Status</th>
      </tr>
    `;

    tableRowsHtml = sales.length > 0 
      ? sales.map((s: any) => `
        <tr>
          <td><strong>${s.invoice_number || '-'}</strong></td>
          <td>${formatDateValue(s.sale_date)}</td>
          <td>${s.customer?.name || 'Walk-in'}${s.customer?.mobile ? `<br><small style="color: #666;">${s.customer.mobile}</small>` : ''}</td>
          <td style="text-align: center;">${(s.sale_items || []).length}</td>
          <td style="text-align: right;"><strong>${formatCurrencyValue(s.total_amount)}</strong></td>
          <td style="text-align: right;">${formatCurrencyValue(s.tax_amount)}</td>
          <td style="text-align: right; color: #0f766e;">${formatCurrencyValue(s.profit_amount)}</td>
          <td style="text-align: center;"><span class="badge">${(s.payment_status || 'PAID').toUpperCase()}</span></td>
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
        <div class="card">
          <div class="card-label">TOTAL PRODUCTS</div>
          <div class="card-val">${products.length}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL VALUATION</div>
          <div class="card-val text-green">${formatCurrencyValue(totalVal)}</div>
        </div>
        <div class="card">
          <div class="card-label">LOW STOCK ITEMS</div>
          <div class="card-val text-red">${lowStockCount}</div>
        </div>
        <div class="card">
          <div class="card-label">HEALTHY STOCK</div>
          <div class="card-val">${products.length - lowStockCount}</div>
        </div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 25%;">Product Name</th>
        <th style="width: 12%;">SKU</th>
        <th style="width: 15%;">Category</th>
        <th style="width: 12%; text-align: center;">Stock</th>
        <th style="width: 11%; text-align: right;">Cost (₹)</th>
        <th style="width: 11%; text-align: right;">Price (₹)</th>
        <th style="width: 14%; text-align: right;">Value (₹)</th>
      </tr>
    `;

    tableRowsHtml = products.length > 0
      ? products.map((p: any) => {
        const stock = Number(p.current_stock || 0);
        const cost = Number(p.purchase_price || 0);
        const isLow = stock <= Number(p.min_stock || 5);
        return `
          <tr>
            <td><strong>${p.name || 'Unnamed'}</strong></td>
            <td>${p.sku || '-'}</td>
            <td>${p.category?.name || '-'}</td>
            <td style="text-align: center;"><strong>${stock} ${p.unit || 'Piece'}</strong></td>
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
    const grossMargin = rev > 0 ? ((gross / rev) * 100).toFixed(2) + '%' : '0.00%';
    const netMargin = rev > 0 ? ((net / rev) * 100).toFixed(2) + '%' : '0.00%';

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card">
          <div class="card-label">TOTAL REVENUE</div>
          <div class="card-val text-green">${formatCurrencyValue(rev)}</div>
        </div>
        <div class="card">
          <div class="card-label">GROSS PROFIT</div>
          <div class="card-val text-emerald">${formatCurrencyValue(gross)}</div>
        </div>
        <div class="card">
          <div class="card-label">OPERATING EXPENSES</div>
          <div class="card-val text-red">${formatCurrencyValue(exp)}</div>
        </div>
        <div class="card">
          <div class="card-label">NET PROFIT</div>
          <div class="card-val" style="color: ${net >= 0 ? '#2563eb' : '#dc2626'};">${formatCurrencyValue(net)}</div>
        </div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 60%;">Financial Breakdown Item</th>
        <th style="width: 40%; text-align: right;">Amount (₹) / Ratio</th>
      </tr>
    `;

    tableRowsHtml = `
      <tr><td>Total Completed Sales Invoices</td><td style="text-align: right;"><strong>${salesCount}</strong></td></tr>
      <tr><td>Gross Sales Revenue</td><td style="text-align: right;"><strong>${formatCurrencyValue(rev)}</strong></td></tr>
      <tr><td>Cost of Goods Sold / Margin Deductions</td><td style="text-align: right;">${formatCurrencyValue(rev - gross)}</td></tr>
      <tr><td>Gross Operating Profit</td><td style="text-align: right; color: #0f766e;"><strong>${formatCurrencyValue(gross)}</strong></td></tr>
      <tr><td>Gross Profit Margin</td><td style="text-align: right;">${grossMargin}</td></tr>
      <tr><td>Total Operating Expenses</td><td style="text-align: right; color: #dc2626;"><strong>${formatCurrencyValue(exp)}</strong></td></tr>
      <tr style="background-color: #f0fdf4;"><td><strong>Net Operating Profit / Loss</strong></td><td style="text-align: right; color: #166534;"><strong>${formatCurrencyValue(net)}</strong></td></tr>
      <tr><td>Net Profit Margin</td><td style="text-align: right;">${netMargin}</td></tr>
    `;
  }
  else if (reportType === 'customer') {
    const customers = data?.customers || (Array.isArray(data) ? data : []);
    const totalPurchases = customers.reduce((acc: number, c: any) => acc + Number(c.total_purchases || 0), 0);
    const totalPaid = customers.reduce((acc: number, c: any) => acc + Number(c.total_paid || 0), 0);
    const totalOutstanding = customers.reduce((acc: number, c: any) => acc + Number(c.outstanding || 0), 0);

    summaryCardsHtml = `
      <div class="summary-grid">
        <div class="card">
          <div class="card-label">TOTAL CUSTOMERS</div>
          <div class="card-val">${customers.length}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL PURCHASES</div>
          <div class="card-val text-green">${formatCurrencyValue(totalPurchases)}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL PAID</div>
          <div class="card-val">${formatCurrencyValue(totalPaid)}</div>
        </div>
        <div class="card">
          <div class="card-label">OUTSTANDING DUES</div>
          <div class="card-val text-red">${formatCurrencyValue(totalOutstanding)}</div>
        </div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 25%;">Customer Name</th>
        <th style="width: 15%;">Mobile</th>
        <th style="width: 18%;">Village</th>
        <th style="width: 14%; text-align: right;">Purchases (₹)</th>
        <th style="width: 14%; text-align: right;">Paid (₹)</th>
        <th style="width: 14%; text-align: right;">Outstanding (₹)</th>
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
        <div class="card">
          <div class="card-label">TOTAL SUPPLIERS</div>
          <div class="card-val">${suppliers.length}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL PURCHASES</div>
          <div class="card-val text-green">${formatCurrencyValue(totalPurchases)}</div>
        </div>
        <div class="card">
          <div class="card-label">TOTAL PAID</div>
          <div class="card-val">${formatCurrencyValue(totalPaid)}</div>
        </div>
        <div class="card">
          <div class="card-label">OUTSTANDING PAYABLE</div>
          <div class="card-val text-red">${formatCurrencyValue(totalOutstanding)}</div>
        </div>
      </div>
    `;

    tableHeadersHtml = `
      <tr>
        <th style="width: 20%;">Supplier Name</th>
        <th style="width: 18%;">Company</th>
        <th style="width: 14%;">Mobile</th>
        <th style="width: 16%;">GSTIN</th>
        <th style="width: 11%; text-align: right;">Purchases (₹)</th>
        <th style="width: 10%; text-align: right;">Paid (₹)</th>
        <th style="width: 11%; text-align: right;">Payable (₹)</th>
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

  // Build the isolated printable document
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${meta.title} - ${shop.shopName || 'Krushi OS'}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.4;
          padding: 8px;
        }
        .header {
          text-align: center;
          border-bottom: 1.5px solid #cbd5e1;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .shop-name {
          font-size: 18px;
          font-weight: 800;
          color: #166534;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .shop-sub {
          font-size: 9.5px;
          color: #475569;
          margin-top: 2px;
        }
        .report-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 12px;
        }
        .report-title {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
        }
        .report-meta {
          font-size: 9px;
          color: #64748b;
          text-align: right;
        }
        .summary-grid {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }
        .card {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 6px 8px;
        }
        .card-label {
          font-size: 8px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }
        .card-val {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
        }
        .text-green { color: #16a34a !important; }
        .text-emerald { color: #0d9488 !important; }
        .text-red { color: #dc2626 !important; }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        th {
          background-color: #166534;
          color: #ffffff;
          font-size: 9px;
          font-weight: 700;
          text-align: left;
          padding: 5px 6px;
          border: 1px solid #14532d;
        }
        td {
          font-size: 9.5px;
          padding: 5px 6px;
          border: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tbody tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .empty-cell {
          text-align: center;
          padding: 20px;
          color: #94a3b8;
          font-style: italic;
        }
        .badge {
          display: inline-block;
          padding: 2px 5px;
          font-size: 7.5px;
          font-weight: 700;
          border-radius: 3px;
          background: #e2e8f0;
          color: #334155;
        }
        .footer {
          margin-top: 20px;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
        }
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
              meta.dateRange || meta.periodLabel ? `Period: ${meta.dateRange || meta.periodLabel}` : '',
              meta.statusFilter ? `Status: ${meta.statusFilter}` : '',
              meta.searchQuery ? `Search: "${meta.searchQuery}"` : ''
            ].filter(Boolean).join(' &bull; ')}
          </div>
        </div>
        <div class="report-meta">
          <div>Generated: ${dateStr}</div>
          <div>Authorized Krushi OS System Report</div>
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

  // Use isolated hidden iframe to print
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

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
