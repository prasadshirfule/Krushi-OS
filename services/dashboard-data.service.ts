/**
 * Authoritative Centralized Dashboard Data Service
 * 
 * Provides unified, single-source-of-truth calculations for:
 * - Today's Sales & Total Bills
 * - Today's Profit (Selling value - Cost of goods - discounts/adjustments)
 * - Customer Outstanding (Credit/Udhari)
 * - Low Stock (Card & Alerts Panel list match 100%)
 * - Expiring Soon (Card & Alerts Panel list match 100%)
 * - Top Selling Products (Aggregated from actual sale items)
 * - Sales Overview Chart (7D, 30D, 90D intervals)
 * - Recent Sales & Dynamic Activity Feed
 * 
 * Accurately handles IST timezone (Asia/Kolkata) boundaries.
 */

/**
 * Format any date input to YYYY-MM-DD in India Standard Time (Asia/Kolkata).
 */
export function getISTDateString(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '';
  try {
    const trimmed = typeof dateInput === 'string' ? dateInput.trim() : '';
    if (trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
    if (!d || isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Check if a date string/object falls on today in IST.
 */
export function isTodayIST(dateInput: string | Date | number | null, referenceDate: Date = new Date()): boolean {
  const targetStr = getISTDateString(dateInput);
  const todayStr = getISTDateString(referenceDate);
  return Boolean(targetStr && todayStr && targetStr === todayStr);
}

/**
 * Calculate profit for a single sale.
 * Profit = Selling Value - Cost of Goods - Discounts + Additions - Deductions
 */
export function calculateSaleProfit(sale: any, productsMap?: Map<string, any>): number {
  if (!sale || sale.status?.toUpperCase() === 'CANCELLED') return 0;

  const items = sale.items || sale.sale_items || [];
  let calculatedProfit = 0;
  let hasValidCostData = false;

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const sellingPrice = Number(it.selling_price ?? it.unit_price ?? it.rate ?? 0);
    const itemTotal = Number(it.total_amount ?? it.total_price ?? (sellingPrice * qty));
    const discount = Number(it.discount_amount ?? it.discount ?? 0);

    // Find purchase/cost price
    let purchasePrice = 0;
    if (it.purchase_price !== undefined && it.purchase_price !== null && Number(it.purchase_price) > 0) {
      purchasePrice = Number(it.purchase_price);
    } else if (it.product?.purchase_price && Number(it.product.purchase_price) > 0) {
      purchasePrice = Number(it.product.purchase_price);
    } else if (productsMap) {
      const p = productsMap.get(String(it.product_id || it.id));
      if (p?.purchase_price && Number(p.purchase_price) > 0) {
        purchasePrice = Number(p.purchase_price);
      }
    }

    if (purchasePrice > 0) {
      hasValidCostData = true;
      const itemProfit = (sellingPrice - purchasePrice) * qty - discount;
      calculatedProfit += itemProfit;
    } else {
      // Fallback: estimate standard 15% retail margin
      calculatedProfit += Math.max(0, Math.round(itemTotal * 0.15));
    }
  }

  // Adjustments: Service additions (transport, hamali) add to profit; deductions reduce it
  const additions = Number(sale.total_additions || 0);
  const deductions = Number(sale.total_deductions || 0);
  calculatedProfit = calculatedProfit + additions - deductions;

  // If sale already has explicit profit_amount and we had no product costs
  if (!hasValidCostData && sale.profit_amount !== undefined && Number(sale.profit_amount) > 0) {
    return Number(sale.profit_amount);
  }

  // Final fallback
  if (calculatedProfit <= 0 && items.length === 0) {
    const saleTotal = Number(sale.total_amount ?? sale.grand_total ?? 0);
    if (sale.profit_amount && Number(sale.profit_amount) > 0) {
      return Number(sale.profit_amount);
    }
    return Math.round(saleTotal * 0.15);
  }

  return Math.round(calculatedProfit * 100) / 100;
}

/**
 * Calculate today's sales (count, total revenue, profit).
 */
export function calculateTodaySales(sales: any[], products: any[] = [], referenceDate: Date = new Date()) {
  const productsMap = new Map<string, any>();
  for (const p of products) {
    if (p.id) productsMap.set(String(p.id), p);
  }

  const todaySales = (sales || []).filter(s => {
    if (s.status?.toUpperCase() === 'CANCELLED') return false;
    const dateVal = s.sale_date || s.created_at;
    return isTodayIST(dateVal, referenceDate);
  });

  const total = todaySales.reduce((sum, s) => {
    const amt = Number(s.total_amount ?? s.grand_total ?? s.payableAmount ?? s.totalAmount ?? 0);
    return sum + amt;
  }, 0);

  const profit = todaySales.reduce((sum, s) => {
    return sum + calculateSaleProfit(s, productsMap);
  }, 0);

  return {
    count: todaySales.length,
    total: Math.round(total * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    sales: todaySales,
  };
}

/**
 * Calculate total number of completed/valid sales invoices.
 */
export function calculateTotalBills(sales: any[]): number {
  return (sales || []).filter(s => s.status?.toUpperCase() !== 'CANCELLED').length;
}

/**
 * Calculate total customer receivable outstanding balance.
 */
export function calculateTotalOutstanding(customers: any[]): number {
  return (customers || []).reduce((acc, c) => {
    if (c.is_active === false) return acc;
    const bal = Number(c.outstanding_balance ?? c.outstanding ?? 0);
    return acc + Math.max(0, bal);
  }, 0);
}

/**
 * Single authoritative source for Low Stock:
 * Calculates both the count for StatsCards and the product list for AlertsPanel.
 */
export function calculateLowStock(products: any[]) {
  const lowStockList = (products || []).filter(p => {
    if (p.is_active === false) return false;
    const stock = Number(p.current_stock ?? p.stock_quantity ?? p.total_stock ?? 0);
    const minStock = Number(p.min_stock ?? p.min_stock_alert ?? p.reorder_level ?? 5);
    return stock <= minStock;
  });

  return {
    count: lowStockList.length,
    products: lowStockList.slice(0, 10),
    allProducts: lowStockList,
  };
}

/**
 * Single authoritative source for Expiring Soon:
 * Calculates both the count for StatsCards and the batch list for AlertsPanel.
 * Excludes already-expired products.
 */
export function calculateExpiringBatches(products: any[], daysAhead: number = 30, referenceDate: Date = new Date()) {
  const todayStr = getISTDateString(referenceDate);
  const maxDate = new Date(referenceDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const maxDateStr = getISTDateString(maxDate);

  const expiringList: any[] = [];

  for (const prod of (products || [])) {
    if (prod.is_active === false) continue;
    const batches = Array.isArray(prod.batches) && prod.batches.length > 0 ? prod.batches : null;

    if (batches) {
      for (const b of batches) {
        const expStr = getISTDateString(b.expiry_date || b.exp_date);
        const qty = Number(b.quantity_available ?? b.stock_quantity ?? prod.current_stock ?? 0);
        if (qty > 0 && expStr) {
          // Not expired and within threshold
          if (expStr >= todayStr && expStr <= maxDateStr) {
            expiringList.push({
              id: b.id || `batch-${expStr}-${prod.id}`,
              batch_number: b.batch_number || 'Default',
              expiry_date: b.expiry_date || expStr,
              exp_date: b.expiry_date || expStr,
              stock_quantity: qty,
              quantity_available: qty,
              product: {
                id: prod.id,
                name: prod.name,
                unit: prod.unit,
              },
            });
          }
        }
      }
    } else if (prod.expiry_date) {
      const expStr = getISTDateString(prod.expiry_date);
      const qty = Number(prod.current_stock ?? prod.stock_quantity ?? 0);
      if (qty > 0 && expStr && expStr >= todayStr && expStr <= maxDateStr) {
        expiringList.push({
          id: `batch-${prod.id}`,
          batch_number: prod.batch_number || 'Default',
          expiry_date: prod.expiry_date,
          exp_date: prod.expiry_date,
          stock_quantity: qty,
          quantity_available: qty,
          product: {
            id: prod.id,
            name: prod.name,
            unit: prod.unit,
          },
        });
      }
    }
  }

  // Sort by earliest expiry first
  expiringList.sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));

  return {
    count: expiringList.length,
    batches: expiringList.slice(0, 10),
    allBatches: expiringList,
  };
}

/**
 * Top selling products aggregated from actual sale items.
 */
export function calculateTopSellingProducts(sales: any[], limit: number = 5) {
  const validSales = (sales || []).filter(s => s.status?.toUpperCase() !== 'CANCELLED');
  const productMap = new Map<string, { id: string, name: string, product_name: string, total_sold: number, quantity: number, revenue: number }>();

  for (const s of validSales) {
    const items = s.items || s.sale_items || [];
    for (const it of items) {
      const name = (it.product_name || it.name || it.product?.name || 'Product').trim();
      if (!name || name.toLowerCase() === 'product') continue;
      const key = (it.product_id || it.id || name).toString();
      const qty = Math.max(1, Number(it.quantity) || 1);
      const total = Number(it.total_amount ?? it.total_price ?? (qty * Number(it.unit_price ?? it.rate ?? 0)));

      const existing = productMap.get(key) || {
        id: key,
        name: name,
        product_name: name,
        total_sold: 0,
        quantity: 0,
        revenue: 0,
      };

      existing.total_sold += qty;
      existing.quantity += qty;
      existing.revenue += total;
      productMap.set(key, existing);
    }
  }

  const list = Array.from(productMap.values());
  // Sort descending by total sold, secondary by revenue
  list.sort((a, b) => b.total_sold - a.total_sold || b.revenue - a.revenue);
  return list.slice(0, limit);
}

/**
 * Sales overview chart data for 7D, 30D, 90D.
 */
export function calculateSalesChart(sales: any[], maxDays: number = 90, referenceDate: Date = new Date()) {
  const validSales = (sales || []).filter(s => s.status?.toUpperCase() !== 'CANCELLED');
  const dateMap = new Map<string, { date: string, sales: number, total: number, profit: number }>();

  // Initialize date points for continuous trend
  for (let i = maxDays - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getISTDateString(d);
    if (dateStr && !dateMap.has(dateStr)) {
      dateMap.set(dateStr, { date: dateStr, sales: 0, total: 0, profit: 0 });
    }
  }

  // Populate from actual sales
  for (const s of validSales) {
    const dateStr = getISTDateString(s.sale_date || s.created_at);
    if (!dateStr) continue;

    const entry = dateMap.get(dateStr) || { date: dateStr, sales: 0, total: 0, profit: 0 };
    const amt = Number(s.total_amount ?? s.grand_total ?? 0);
    const profit = calculateSaleProfit(s);

    entry.sales += amt;
    entry.total += amt;
    entry.profit += profit;
    dateMap.set(dateStr, entry);
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Recent sales list sorted by newest first.
 */
export function calculateRecentSales(sales: any[], limit: number = 10) {
  const validSales = [...(sales || [])].filter(s => s.status?.toUpperCase() !== 'CANCELLED');
  validSales.sort((a, b) => {
    const timeA = new Date(a.sale_date || a.created_at || 0).getTime();
    const timeB = new Date(b.sale_date || b.created_at || 0).getTime();
    return timeB - timeA;
  });
  return validSales.slice(0, limit);
}

/**
 * Recent activity feed synthesized from live transactions.
 */
export function calculateRecentActivities(sales: any[], customers: any[], products: any[], limit: number = 15) {
  const activities: any[] = [];

  for (const s of (sales || []).slice(0, 10)) {
    const inv = s.invoice_number || s.invoiceNumber || 'Sale';
    const cust = s.customer?.name || s.customer_name || 'Walk-in Customer';
    const total = Number(s.total_amount || s.grand_total || 0);
    activities.push({
      id: `act-sale-${s.id}`,
      action: 'SALE_COMPLETED',
      entity_type: 'SALE',
      details: `Generated bill ${inv} for ${cust} (₹${total.toLocaleString('en-IN')})`,
      user_name: 'Admin',
      created_at: s.sale_date || s.created_at || new Date().toISOString(),
    });
  }

  for (const c of (customers || []).slice(0, 5)) {
    if (c.created_at) {
      activities.push({
        id: `act-cust-${c.id}`,
        action: 'CUSTOMER_CREATED',
        entity_type: 'CUSTOMER',
        details: `Registered farmer ${c.name} (${c.village || 'Local'})`,
        user_name: 'Admin',
        created_at: c.created_at,
      });
    }
  }

  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return activities.slice(0, limit);
}
