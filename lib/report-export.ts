import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
   1. EXCEL EXPORT ENGINE (.xlsx)
   ========================================================================== */

export function exportReportToExcel(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
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
      'Payment Status', 'Status'
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

  const filename = getReportFilename(reportType, 'xlsx');
  XLSX.writeFile(wb, filename);
}

/* ==========================================================================
   2. PDF EXPORT ENGINE (Clean A4 Document - Free of Unicode corruptions)
   ========================================================================== */

export function exportReportToPDF(
  reportType: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'product_sales',
  data: any,
  meta: ReportFilterMeta,
  shop: ShopDetails
) {
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
    const tableHeaders = ['Invoice #', 'Date', 'Customer', 'Items', 'Total (Rs.)', 'GST (Rs.)', 'Profit (Rs.)', 'Payment'];
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
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59], overflow: 'linebreak' },
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 48, halign: 'left' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
        7: { cellWidth: 14, halign: 'center' }
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
    // 50 + 20 + 26 + 22 + 20 + 20 + 24 = 182mm
    const tableHeaders = ['Product Name', 'SKU', 'Category', 'Stock Level', 'Cost (Rs.)', 'Price (Rs.)', 'Value (Rs.)'];
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
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'left' },
        2: { cellWidth: 26, halign: 'left' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
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
      head: [['Financial Performance Metric / Statement Item', 'Amount / Ratio']],
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
        (e.payment_method || 'CASH').toUpperCase(),
        formatPDFNumber(e.amount)
      ]);

      renderAutoTable(doc, {
        startY: lastY,
        head: [['Date', 'Category', 'Description', 'Payment Mode', 'Amount (Rs.)']],
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
    // 44 + 26 + 32 + 28 + 26 + 26 = 182mm
    const tableHeaders = ['Customer Name', 'Mobile', 'Village', 'Purchases (Rs.)', 'Paid (Rs.)', 'Outstanding (Rs.)'];
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
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 44, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'left' },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
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
    // 36 + 32 + 24 + 28 + 22 + 20 + 20 = 182mm
    const tableHeaders = ['Supplier Name', 'Company', 'Mobile', 'GSTIN', 'Purchases (Rs.)', 'Paid (Rs.)', 'Payable (Rs.)'];
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
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 36, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 32, halign: 'left' },
        2: { cellWidth: 24, halign: 'left' },
        3: { cellWidth: 28, halign: 'left' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
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
    // 24 + 18 + 48 + 14 + 24 + 20 + 20 + 14 = 182mm
    const tableHeaders = ['Invoice #', 'Date', 'Customer', 'Qty', 'Selling Price (Rs.)', 'GST (Rs.)', 'Total (Rs.)', 'Payment'];
    const tableBody = items.map((it: any) => [
      it.invoice_number || '-',
      formatDateValue(it.sale_date),
      it.customer_name || 'Walk-in Customer',
      String(it.quantity || 1),
      formatPDFNumber(it.unit_price),
      formatPDFNumber(it.gst_amount),
      formatPDFNumber(it.total_amount),
      (it.payment_status || 'PAID').toUpperCase()
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
      headStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, halign: 'left', fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 48, halign: 'left' },
        3: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 20, halign: 'right' },
        6: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        7: { cellWidth: 14, halign: 'center' }
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
        <th style="width: 14%;">Invoice #</th>
        <th style="width: 10%;">Date</th>
        <th style="width: 24%;">Customer</th>
        <th style="width: 8%; text-align: center;">Items</th>
        <th style="width: 12%; text-align: right;">Total</th>
        <th style="width: 11%; text-align: right;">GST</th>
        <th style="width: 11%; text-align: right;">Profit</th>
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
        <th style="width: 14%;">Invoice #</th>
        <th style="width: 10%;">Date</th>
        <th style="width: 24%;">Customer</th>
        <th style="width: 8%; text-align: center;">Qty</th>
        <th style="width: 12%; text-align: right;">Price</th>
        <th style="width: 11%; text-align: right;">GST</th>
        <th style="width: 11%; text-align: right;">Total</th>
        <th style="width: 10%; text-align: center;">Payment</th>
      </tr>
    `;

    tableRowsHtml = items.length > 0
      ? items.map((it: any) => `
        <tr>
          <td><strong>${it.invoice_number || '-'}</strong></td>
          <td>${formatDateValue(it.sale_date)}</td>
          <td>${it.customer_name || 'Walk-in'}</td>
          <td style="text-align: center;"><strong>${it.quantity}</strong></td>
          <td style="text-align: right;">${formatCurrencyValue(it.unit_price)}</td>
          <td style="text-align: right;">${formatCurrencyValue(it.gst_amount)}</td>
          <td style="text-align: right;"><strong>${formatCurrencyValue(it.total_amount)}</strong></td>
          <td style="text-align: center;"><span class="badge">${(it.payment_status || 'PAID').toUpperCase()}</span></td>
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
