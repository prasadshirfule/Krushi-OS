import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SaleInput } from '@/lib/validations';
import { MOCK_SALES, MOCK_CUSTOMERS } from '@/lib/mock-data';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';
import { getDemoCustomers } from '@/services/customers.service';
import { getStoredDemoSales, saveStoredDemoSales } from '@/lib/demo-storage';

/** Check if Supabase is running with placeholder credentials (demo mode). */
export function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export function normalizeSale(sale: any) {
  const items = sale.items || sale.sale_items || [];
  const total = Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? 0);
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

export function getDemoSales(): any[] {
  return getStoredDemoSales(normalizeSale);
}

export async function completeSale(shopId: string, data: any, userId: string) {
  if (isPlaceholderMode()) {
    const store = getStoredDemoSales(normalizeSale);
    const saleId = `sale-${Date.now()}`;
    
    // Generate unique invoice number, preventing collisions
    let seq = store.length + 1;
    let invoiceNum = `KOS-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    while (store.some(s => (s.invoice_number === invoiceNum || s.invoiceNumber === invoiceNum))) {
      seq++;
      invoiceNum = `KOS-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    }

    // Resolve customer info
    const customerId = data.customer_id;
    let customerObj: any = null;
    if (data.customer) {
      customerObj = data.customer;
    } else if (data.customer_name) {
      customerObj = {
        id: customerId || `cust-${Date.now()}`,
        name: data.customer_name,
        phone: data.customer_phone || '',
      };
    } else if (customerId && customerId !== 'walk-in') {
      const demoCusts = getDemoCustomers();
      const found = demoCusts.find(c => c.id === customerId) || MOCK_CUSTOMERS.find(c => c.id === customerId);
      customerObj = found
        ? { id: found.id, name: found.name, phone: found.phone || found.mobile || '' }
        : { id: customerId, name: data.customer_name || 'Customer', phone: '' };
    } else {
      customerObj = { id: 'walk-in', name: 'Walk-in Customer', phone: '' };
    }

    const items = (data.items || []).map((it: any, idx: number) => {
      const q = Math.max(1, Number(it.quantity) || 1);
      const rate = Number(it.unit_price ?? it.selling_price ?? it.rate ?? 0);
      const disc = Number(it.discount_percent ?? it.discount ?? 0);
      const gst = Number(it.gst_rate ?? it.gst ?? 0);
      const itemTotal = calculateItemTotal(q, rate, disc, gst);

      const prodName = it.product_name && it.product_name !== 'Product'
        ? it.product_name
        : (it.name && it.name !== 'Product' ? it.name : (it.product?.name || `Item ${idx + 1}`));

      return {
        id: `si-${Date.now()}-${idx + 1}`,
        sale_id: saleId,
        product_id: it.product_id || it.id,
        product_name: prodName,
        name: prodName,
        batch_id: it.batch_id || null,
        batch_number: it.batch_number || it.batch?.batch_number || it.product?.batch_number || null,
        hsn_code: it.hsn_code || it.product?.hsn_code || it.product?.hsnCode || null,
        expiry_date: it.expiry_date || it.batch?.expiry_date || it.product?.expiry_date || null,
        unit: it.unit || it.product?.unit || null,
        pack_size: it.pack_size || it.product?.pack_size || null,
        manufacturer: it.manufacturer || it.product?.manufacturer || it.product?.brand?.manufacturer || it.product?.brand?.name || null,
        product: it.product || it,
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

    const newSale = {
      id: saleId,
      saleId: saleId,
      invoice_number: invoiceNum,
      invoiceNumber: invoiceNum,
      shop_id: shopId,
      customer_id: customerId || null,
      customer: customerObj,
      customer_name: customerObj?.name || 'Walk-in Customer',
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
    };

    // Prepend to persistent demo store so it appears at top of sales history
    store.unshift(newSale);
    saveStoredDemoSales(store);
    return newSale;
  }

  // Real Supabase mode
  const supabase = await createServerSupabaseClient();
  const { data: sale, error } = await supabase.rpc('process_sale', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_customer_id: data.customer_id || null,
    p_items: data.items,
    p_payments: data.payments,
    p_notes: data.notes || null,
    p_idempotency_key: data.idempotency_key || null
  });

  if (error) {
    console.error("Failed to complete sale:", error);
    throw new Error(`Failed to complete sale: ${error.message}`);
  }
  
  return sale;
}

export async function getSales(
  shopId: string, 
  options: { search?: string, customerId?: string, status?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}
) {
  if (isPlaceholderMode()) {
    const demoCusts = getDemoCustomers();
    let list = getDemoSales().map(s => {
      if (s.customer_id && s.customer_id !== 'walk-in') {
        const found = demoCusts.find(c => c.id === s.customer_id);
        if (found) {
          return {
            ...s,
            customer: { id: found.id, name: found.name, phone: found.phone || found.mobile },
            customer_name: found.name,
          };
        }
      }
      return s;
    });

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(s => 
        (s.invoice_number && s.invoice_number.toLowerCase().includes(q)) ||
        (s.customer?.name && s.customer.name.toLowerCase().includes(q)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q))
      );
    }
    if (options.customerId) {
      list = list.filter(s => s.customer_id === options.customerId || s.customer?.id === options.customerId);
    }
    if (options.status) {
      list = list.filter(s => s.status?.toLowerCase() === options.status?.toLowerCase());
    }
    if (options.dateFrom) {
      list = list.filter(s => (s.sale_date || s.created_at) >= options.dateFrom!);
    }
    if (options.dateTo) {
      list = list.filter(s => (s.sale_date || s.created_at) <= options.dateTo!);
    }

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const paged = list.slice(offset, offset + limit);

    return { sales: paged, total: list.length };
  }

  // Real Supabase mode
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('sales')
      .select('*, customer:customers(id, name, mobile, address, village, gstin, aadhaar), items:sale_items(*, product:products(*))', { count: 'exact' })
      .eq('shop_id', shopId);
    
    if (options.customerId) query = query.eq('customer_id', options.customerId);
    if (options.status) query = query.eq('status', options.status);
    if (options.dateFrom) query = query.gte('sale_date', options.dateFrom);
    if (options.dateTo) query = query.lte('sale_date', options.dateTo);
    if (options.search) query = query.ilike('invoice_number', `%${options.search}%`);
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching sales:", error);
      return { sales: [], total: 0 };
    }
    
    return { sales: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load sales:", error);
    return { sales: [], total: 0 };
  }
}

export async function getSaleById(shopId: string, saleId: string) {
  if (isPlaceholderMode()) {
    const list = getDemoSales();
    const found = list.find(s => s.id === saleId || s.invoice_number === saleId || s.invoiceNumber === saleId);
    return found || null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*, product:products(*))')
      .eq('shop_id', shopId)
      .eq('id', saleId)
      .single();
    if (error) {
      console.error("Error fetching sale by ID:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load sale by ID:", error);
    return null;
  }
}

export async function getSaleByInvoice(shopId: string, invoiceNumber: string) {
  if (isPlaceholderMode()) {
    const list = getDemoSales();
    const found = list.find(s => s.invoice_number === invoiceNumber || s.invoiceNumber === invoiceNumber || s.id === invoiceNumber);
    return found || null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*, product:products(*))')
      .eq('shop_id', shopId)
      .eq('invoice_number', invoiceNumber)
      .single();
    if (error) {
      console.error("Error fetching sale by invoice:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load sale by invoice:", error);
    return null;
  }
}

export async function cancelSale(shopId: string, saleId: string, userId: string, reason: string) {
  if (isPlaceholderMode()) {
    const store = getStoredDemoSales(normalizeSale);
    const found = store.find(s => s.id === saleId || s.invoice_number === saleId);
    if (found) {
      found.status = 'CANCELLED';
      found.cancel_reason = reason;
      saveStoredDemoSales(store);
    }
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('cancel_sale', {
    p_shop_id: shopId,
    p_sale_id: saleId,
    p_user_id: userId,
    p_reason: reason
  });
  if (error) {
    console.error("Error cancelling sale:", error);
    throw error;
  }
}

export async function returnSale(shopId: string, saleId: string, items: { saleItemId: string, quantity: number, reason: string }[], userId: string) {
  if (isPlaceholderMode()) {
    const store = getStoredDemoSales(normalizeSale);
    const found = store.find(s => s.id === saleId);
    if (found) {
      found.status = 'REFUNDED';
      saveStoredDemoSales(store);
    }
    return { success: true };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc('process_sale_return', {
    p_shop_id: shopId,
    p_sale_id: saleId,
    p_items: items,
    p_user_id: userId
  });
  if (error) {
    console.error("Error processing sale return:", error);
    throw error;
  }
  return { success: true };
}

export async function getTodaySales(shopId: string) {
  if (isPlaceholderMode()) {
    const list = getDemoSales();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayList = list.filter(s => {
      const d = (s.sale_date || s.created_at || '').split('T')[0];
      return d === todayStr && s.status !== 'CANCELLED';
    });

    return {
      count: todayList.length,
      total: todayList.reduce((sum, s) => sum + Number(s.total_amount || s.grand_total || 0), 0),
      profit: todayList.reduce((sum, s) => sum + Number(s.profit_amount || Math.round(Number(s.total_amount || 0) * 0.15)), 0)
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('sales')
      .select('id, total_amount, profit_amount')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .gte('sale_date', `${todayStr}T00:00:00.000Z`);

    if (error || !data) {
      return { count: 0, total: 0, profit: 0 };
    }
    
    return {
      count: data.length,
      total: data.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
      profit: data.reduce((sum, s) => sum + Number(s.profit_amount || 0), 0)
    };
  } catch (error) {
    console.error("Error fetching today sales:", error);
    return { count: 0, total: 0, profit: 0 };
  }
}

export async function getSalesChart(shopId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  if (isPlaceholderMode()) {
    const list = getDemoSales();
    const dateMap = new Map<string, { date: string, sales: number, profit: number, total: number }>();
    for (const sale of list) {
      if (sale.status === 'CANCELLED') continue;
      const isoDate = (sale.sale_date || sale.created_at || '').split('T')[0];
      if (!isoDate) continue;
      const current = dateMap.get(isoDate) || { date: isoDate, sales: 0, profit: 0, total: 0 };
      const amt = Number(sale.total_amount || sale.grand_total || 0);
      const prf = Number(sale.profit_amount || Math.round(amt * 0.15));
      current.sales += amt;
      current.total += amt;
      current.profit += prf;
      dateMap.set(isoDate, current);
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const daysAgo = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const { data, error } = await supabase
      .from('sales')
      .select('sale_date, total_amount, profit_amount')
      .eq('shop_id', shopId)
      .eq('status', 'completed')
      .gte('sale_date', startDate.toISOString())
      .order('sale_date', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    const dateMap = new Map<string, { date: string, sales: number, profit: number, total: number }>();

    for (const sale of data) {
      const isoDate = new Date(sale.sale_date).toISOString().split('T')[0];
      const current = dateMap.get(isoDate) || { date: isoDate, sales: 0, profit: 0, total: 0 };
      const amt = Number(sale.total_amount || 0);
      const prf = Number(sale.profit_amount || 0);
      current.sales += amt;
      current.total += amt;
      current.profit += prf;
      dateMap.set(isoDate, current);
    }

    return Array.from(dateMap.values());
  } catch (error) {
    console.error("Error fetching sales chart data:", error);
    return [];
  }
}
