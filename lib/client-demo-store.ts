import { MOCK_CUSTOMERS, MOCK_SALES } from '@/lib/mock-data';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';

export const KRUSHI_DEMO_CUSTOMERS_KEY = 'krushi_demo_customers';
export const KRUSHI_DEMO_SALES_KEY = 'krushi_demo_sales';

/** Check if running in browser and with demo / placeholder credentials */
export function isClientDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes('placeholder');
}

/** Normalize customer object consistently */
export function normalizeDemoCustomer(c: any) {
  const phone = c.phone || c.mobile || '';
  const mobile = c.mobile || c.phone || '';
  const outstanding = Number(c.outstanding ?? c.outstanding_balance ?? 0);
  const creditLimit = Number(c.credit_limit ?? c.creditLimit ?? 50000);
  const totalPurchases = Number(c.total_purchases ?? c.totalPurchases ?? 0);
  const farmSize = c.farm_size || c.farmSize || (c.land_acres ? `${c.land_acres} Acres` : '');
  const crops = c.crops || c.crop_details || '';

  return {
    ...c,
    id: String(c.id),
    name: c.name,
    phone,
    mobile,
    village: c.village || '',
    address: c.address || '',
    farm_size: farmSize,
    farmSize,
    crops,
    notes: c.notes || '',
    credit_limit: creditLimit,
    creditLimit,
    outstanding,
    outstanding_balance: outstanding,
    total_purchases: totalPurchases,
    totalPurchases,
    is_active: c.is_active !== false,
    shop_id: c.shop_id || 'demo-shop-1',
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  };
}

/** Normalize sale object consistently */
export function normalizeDemoSale(sale: any) {
  const items = sale.items || sale.sale_items || [];
  const total = Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? sale.payableAmount ?? 0);
  return {
    ...sale,
    grand_total: total,
    total_amount: total,
    totalAmount: total,
    payableAmount: total,
    items: items.map((it: any) => ({
      ...it,
      unit_price: Number(it.unit_price ?? it.unitPrice ?? it.selling_price ?? it.rate ?? 0),
      selling_price: Number(it.selling_price ?? it.unit_price ?? it.unitPrice ?? it.rate ?? 0),
      rate: Number(it.rate ?? it.unit_price ?? it.selling_price ?? 0),
      discount_percent: Number(it.discount_percent ?? it.discountPercent ?? it.discount ?? 0),
      gst_rate: Number(it.gst_rate ?? it.gstRate ?? it.gst ?? 0),
      total_amount: Number(it.total_amount ?? it.totalAmount ?? it.total_price ?? ((it.quantity || 1) * (it.unit_price || 0))),
      total_price: Number(it.total_price ?? it.total_amount ?? it.totalAmount ?? ((it.quantity || 1) * (it.unit_price || 0))),
    })),
    sale_items: items,
    status: sale.status || (sale.payment_status === 'PAID' ? 'COMPLETED' : (sale.payment_status === 'UNPAID' ? 'PENDING' : 'COMPLETED')),
    sale_date: sale.sale_date || sale.created_at,
    created_at: sale.created_at || sale.sale_date,
  };
}

/** Helper to check if two dates fall on the same calendar day */
export function isSameDay(dateA: string | Date, dateB: string | Date = new Date()): boolean {
  try {
    const da = typeof dateA === 'string' ? new Date(dateA) : dateA;
    const db = typeof dateB === 'string' ? new Date(dateB) : dateB;
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return false;
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  } catch {
    return false;
  }
}

/* ═════════════════════════════════════════════════════════
   CUSTOMER OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoCustomersClient(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_CUSTOMERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeDemoCustomer);
      }
    }
  } catch (err) {
    console.error('Error reading demo customers from localStorage:', err);
  }

  // Initialize with MOCK_CUSTOMERS if empty
  const initial = MOCK_CUSTOMERS.map(normalizeDemoCustomer);
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoCustomerClient(data: {
  name: string;
  mobile?: string | null;
  phone?: string | null;
  village?: string | null;
  address?: string | null;
  farm_size?: string | null;
  crops?: string | null;
  notes?: string | null;
}): any {
  const current = getDemoCustomersClient();
  const id = `cust-${Date.now()}`;
  const newCust = normalizeDemoCustomer({
    id,
    shop_id: 'demo-shop-1',
    name: data.name,
    phone: data.mobile || data.phone || '',
    mobile: data.mobile || data.phone || '',
    village: data.village || '',
    address: data.address || '',
    farm_size: data.farm_size || '',
    farmSize: data.farm_size || '',
    crops: data.crops || '',
    notes: data.notes || '',
    credit_limit: 50000,
    outstanding: 0,
    outstanding_balance: 0,
    total_purchases: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const updated = [newCust, ...current];
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: newCust }));
  } catch (err) {
    console.error('Error saving demo customer to localStorage:', err);
  }
  return newCust;
}

export function updateDemoCustomerClient(id: string, data: any): any {
  const current = getDemoCustomersClient();
  const idx = current.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const updated = normalizeDemoCustomer({
    ...current[idx],
    ...data,
    name: data.name !== undefined ? data.name : current[idx].name,
    phone: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : current[idx].phone),
    mobile: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : current[idx].mobile),
    updated_at: new Date().toISOString(),
  });

  current[idx] = updated;
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: updated }));
  } catch (err) {
    console.error('Error updating demo customer in localStorage:', err);
  }
  return updated;
}

export function deleteDemoCustomerClient(id: string): boolean {
  const current = getDemoCustomersClient();
  const filtered = current.filter(c => c.id !== id);
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: { id, deleted: true } }));
    return true;
  } catch (err) {
    console.error('Error deleting demo customer in localStorage:', err);
    return false;
  }
}

export function getDemoCustomerByIdClient(id: string): any | null {
  const current = getDemoCustomersClient();
  return current.find(c => c.id === id) || null;
}

/* ═════════════════════════════════════════════════════════
   SALES OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoSalesClient(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_SALES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const customers = getDemoCustomersClient();
        return parsed.map(s => {
          const norm = normalizeDemoSale(s);
          if (norm.customer_id && norm.customer_id !== 'walk-in') {
            const foundCust = customers.find(c => c.id === norm.customer_id);
            if (foundCust) {
              norm.customer = { id: foundCust.id, name: foundCust.name, phone: foundCust.phone || foundCust.mobile };
              norm.customer_name = foundCust.name;
            }
          }
          return norm;
        });
      }
    }
  } catch (err) {
    console.error('Error reading demo sales from localStorage:', err);
  }

  // Initialize with MOCK_SALES if empty
  const initial = MOCK_SALES.map(normalizeDemoSale);
  try {
    localStorage.setItem(KRUSHI_DEMO_SALES_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoSaleClient(data: any): any {
  const current = getDemoSalesClient();
  const saleId = `sale-${Date.now()}`;

  // Invoice Number generator: scans existing invoices to get highest sequence (KOS-YYYY-NNN)
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;
  for (const s of current) {
    const inv = s.invoice_number || s.invoiceNumber || '';
    const match = inv.match(/KOS-\d+-(\d+)/i);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = Math.max(maxSeq + 1, current.length + 1);
  let invoiceNum = `KOS-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
  let counter = nextSeq;
  while (current.some(s => s.invoice_number === invoiceNum || s.invoiceNumber === invoiceNum)) {
    counter++;
    invoiceNum = `KOS-${currentYear}-${String(counter).padStart(3, '0')}`;
  }

  // Resolve customer info
  const customerId = data.customer_id;
  let customerObj: any = null;
  let customerName = 'Walk-in Customer';
  let customerPhone = '';

  if (customerId && customerId !== 'walk-in') {
    const customers = getDemoCustomersClient();
    const found = customers.find(c => c.id === customerId);
    if (found) {
      customerObj = { id: found.id, name: found.name, phone: found.phone || found.mobile || '' };
      customerName = found.name;
      customerPhone = found.phone || found.mobile || '';
    } else if (data.customer_name || data.customer?.name) {
      customerName = data.customer_name || data.customer?.name;
      customerPhone = data.customer_phone || data.customer?.phone || '';
      customerObj = { id: customerId, name: customerName, phone: customerPhone };
    }
  } else if (data.customer_name && data.customer_name.toLowerCase() !== 'walk-in' && data.customer_name.toLowerCase() !== 'walk-in customer') {
    customerName = data.customer_name;
    customerPhone = data.customer_phone || '';
    customerObj = { id: `cust-${Date.now()}`, name: customerName, phone: customerPhone };
  } else {
    customerObj = { id: 'walk-in', name: 'Walk-in Customer', phone: '' };
    customerName = 'Walk-in Customer';
  }

  const items = (data.items || []).map((it: any, idx: number) => {
    const q = Math.max(1, Number(it.quantity) || 1);
    const rate = Number(it.unit_price ?? it.selling_price ?? it.rate ?? 0);
    const disc = Number(it.discount_percent ?? it.discount ?? 0);
    const gst = Number(it.gst_rate ?? it.gst ?? 0);
    const itemTotal = calculateItemTotal(q, rate, disc, gst);

    return {
      id: `si-${Date.now()}-${idx + 1}`,
      sale_id: saleId,
      product_id: it.product_id || it.id,
      product_name: it.product_name || it.name || 'Product',
      batch_id: it.batch_id || null,
      batch_number: it.batch_number || null,
      quantity: q,
      unit_price: rate,
      selling_price: rate,
      rate: rate,
      discount_percent: disc,
      gst_rate: gst,
      taxable_amount: itemTotal.taxableAmount,
      cgst: itemTotal.cgst,
      sgst: itemTotal.sgst,
      total_tax: itemTotal.totalTax,
      total_amount: itemTotal.total,
      total_price: itemTotal.total,
    };
  });

  const billTotals = data.totals || calculateBillTotal(items);
  const payable = Number(billTotals.payableAmount ?? billTotals.grandTotal ?? 0);
  const paymentMethod = data.payment_method || (data.payments?.[0]?.method) || 'Cash';
  const isCredit = paymentMethod.toUpperCase() === 'CREDIT';

  const newSale = normalizeDemoSale({
    id: saleId,
    saleId: saleId,
    invoice_number: invoiceNum,
    invoiceNumber: invoiceNum,
    shop_id: 'demo-shop-1',
    customer_id: customerObj.id === 'walk-in' ? null : customerObj.id,
    customer: customerObj,
    customer_name: customerName,
    items: items,
    sale_items: items,
    subtotal: Number(billTotals.subtotal || 0),
    discount_amount: Number(billTotals.totalDiscount || 0),
    tax_amount: Number(billTotals.totalTax || 0),
    cgst_total: Number(billTotals.totalCGST || 0),
    sgst_total: Number(billTotals.totalSGST || 0),
    round_off: Number(billTotals.roundOff || 0),
    total_amount: payable,
    grand_total: payable,
    totalAmount: payable,
    payableAmount: payable,
    paid_amount: isCredit ? 0 : payable,
    profit_amount: Math.round(payable * 0.15),
    payment_mode: paymentMethod,
    payment_method: paymentMethod,
    payments: data.payments || [{ method: paymentMethod, amount: payable }],
    status: 'COMPLETED',
    payment_status: isCredit ? 'UNPAID' : 'PAID',
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    sale_date: new Date().toISOString(),
  });

  const updatedSales = [newSale, ...current];
  try {
    localStorage.setItem(KRUSHI_DEMO_SALES_KEY, JSON.stringify(updatedSales));
    window.dispatchEvent(new CustomEvent('krushi-sales-updated', { detail: newSale }));
  } catch (err) {
    console.error('Error saving demo sale to localStorage:', err);
  }
  return newSale;
}

export function getDemoSaleByIdClient(idOrInvoice: string): any | null {
  const sales = getDemoSalesClient();
  return sales.find(s => s.id === idOrInvoice || s.invoice_number === idOrInvoice || s.invoiceNumber === idOrInvoice) || null;
}

export function getDemoSalesSummaryClient() {
  const sales = getDemoSalesClient();
  const todaySales = sales.filter(s => {
    if (s.status === 'CANCELLED') return false;
    const dateVal = s.sale_date || s.created_at;
    return dateVal ? isSameDay(dateVal) : false;
  });

  const todayRevenue = todaySales.reduce((acc: number, s: any) => {
    return acc + Number(s.total_amount ?? s.grand_total ?? 0);
  }, 0);

  return {
    todayRevenue,
    billsToday: todaySales.length,
    totalInvoices: sales.length,
    todaySales,
    sales,
  };
}
