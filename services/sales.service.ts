import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SaleInput } from '@/lib/validations';
import { MOCK_SALES, MOCK_CUSTOMERS } from '@/lib/mock-data';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';
import { getDemoCustomers } from '@/services/customers.service';
import { getStoredDemoSales, saveStoredDemoSales, getStoredDemoProducts } from '@/lib/demo-storage';
import { calculateTodaySales, calculateSalesChart } from '@/services/dashboard-data.service';

/** Check if Supabase is running with placeholder credentials (demo mode). */
export function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export function normalizeSale(sale: any) {
  const items = sale.items || sale.sale_items || [];
  
  let calculatedGrandTotal = 0;
  const normalizedItems = items.map((it: any) => {
    const p = it.product || {};
    const b = it.batch || it.item_batches?.[0]?.batch || p.batches?.[0] || {};

    const hsnCode = it.hsn_code || p.hsn_code || p.hsnCode || null;
    const batchNumber = it.batch_number || b.batch_number || p.batch_number || p.batches?.[0]?.batch_number || null;
    const expiryDate = it.expiry_date || b.expiry_date || p.expiry_date || p.batches?.[0]?.expiry_date || null;
    const mfg = it.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || null;

    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPrice = Number(it.unit_price ?? it.unitPrice ?? it.selling_price ?? it.rate ?? 0);
    const discPercent = Number(it.discount_percent ?? it.discountPercent ?? 0);
    const discAmt = Number(
      it.discount_amount !== undefined 
        ? it.discount_amount 
        : (it.discount !== undefined ? it.discount : (qty * unitPrice * discPercent / 100))
    );
    const lineTotal = Math.max(0, (qty * unitPrice) - discAmt);
    const gstRate = Number(it.gst_rate ?? it.gstRate ?? it.gst ?? p.gst_rate ?? 0);
    
    const taxable = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100;
    const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
    const cgst = Math.round((totalTax / 2) * 100) / 100;
    const sgst = Math.round((totalTax - cgst) * 100) / 100;

    calculatedGrandTotal += lineTotal;

    return {
      ...it,
      hsn_code: hsnCode,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      manufacturer: mfg,
      unit_price: unitPrice,
      selling_price: unitPrice,
      rate: unitPrice,
      discount_percent: discPercent,
      discount_amount: discAmt,
      discount: discAmt,
      gst_rate: gstRate,
      taxable_amount: taxable,
      cgst,
      sgst,
      total_tax: totalTax,
      total_amount: lineTotal,
      total_price: lineTotal,
    };
  });

  // Extract adjustments from sale.adjustments or serialized notes
  let rawAdjustments = Array.isArray(sale.adjustments) ? sale.adjustments : [];
  let userNotes = sale.notes || '';

  if (rawAdjustments.length === 0 && sale.notes && typeof sale.notes === 'string') {
    try {
      const trimmed = sale.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.adjustments)) {
          rawAdjustments = parsed.adjustments;
          userNotes = parsed.userNote || parsed.notes || '';
        }
      } else if (trimmed.includes('__ADJUSTMENTS__:')) {
        const parts = trimmed.split('__ADJUSTMENTS__:');
        userNotes = parts[0].trim();
        const parsed = JSON.parse(parts[1]);
        if (Array.isArray(parsed)) {
          rawAdjustments = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  const totalAdditions = rawAdjustments.filter((a: any) => a.type === 'ADD').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = rawAdjustments.filter((a: any) => a.type === 'DEDUCT').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);

  const effectiveTotal = normalizedItems.length > 0
    ? Math.max(0, calculatedGrandTotal + totalAdditions - totalDeductions)
    : Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? 0);

  const rawStatus = (sale.status || '').toString().toUpperCase();
  const rawPaymentStatus = (sale.payment_status || '').toString().toUpperCase();

  let resolvedStatus = 'COMPLETED';
  if (rawStatus === 'CANCELLED') {
    resolvedStatus = 'CANCELLED';
  } else if (rawStatus === 'REFUNDED' || rawStatus === 'RETURNED') {
    resolvedStatus = 'REFUNDED';
  } else if (rawPaymentStatus === 'CREDIT' || rawPaymentStatus === 'UNPAID') {
    resolvedStatus = 'PENDING';
  } else if (rawPaymentStatus === 'PAID' || rawStatus === 'COMPLETED') {
    resolvedStatus = 'COMPLETED';
  }

  return {
    ...sale,
    adjustments: rawAdjustments,
    notes: userNotes,
    raw_notes: sale.notes,
    total_additions: totalAdditions,
    total_deductions: totalDeductions,
    grand_total: effectiveTotal,
    total_amount: effectiveTotal,
    totalAmount: effectiveTotal,
    payableAmount: effectiveTotal,
    items: normalizedItems,
    sale_items: normalizedItems,
    status: resolvedStatus,
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
      const disc = Number(it.discount_amount !== undefined ? it.discount_amount : (it.discount !== undefined ? it.discount : (it.discount_percent || 0)));
      const gst = Number(it.gst_rate ?? it.gst ?? 0);
      const itemTotal = calculateItemTotal(q, rate, disc, gst, true, {
        discountAmount: it.discount_amount !== undefined ? Number(it.discount_amount) : undefined,
      });

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
        discount_amount: itemTotal.discountAmount,
        discount: itemTotal.discountAmount,
        discount_percent: it.discount_percent !== undefined ? Number(it.discount_percent) : (q * rate > 0 ? (itemTotal.discountAmount / (q * rate)) * 100 : 0),
        gst_rate: gst,
        taxable_amount: itemTotal.taxableAmount,
        cgst: itemTotal.cgst,
        sgst: itemTotal.sgst,
        total_tax: itemTotal.totalTax,
        total_amount: itemTotal.total,
        total_price: itemTotal.total,
      };
    });

    const rawAdjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
    const billTotals = data.totals || calculateBillTotal(items, rawAdjustments);
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
      adjustments: rawAdjustments,
      subtotal: Number(billTotals.subtotal || 0),
      discount_amount: Number(billTotals.totalDiscount || 0),
      total_additions: Number(billTotals.totalAdditions || 0),
      total_deductions: Number(billTotals.totalDeductions || 0),
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

  // Validate customer_id: pass null if not a valid UUID (e.g. 'walk-in' or 'cust-123')
  const isUuidCustomer = data.customer_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.customer_id);
  const realCustomerId = isUuidCustomer ? data.customer_id : null;

  // Clean items: ensure quantity, unit_price, discount_percent, gst_rate are valid numbers and batch_id is UUID or null
  const cleanItems = (data.items || []).map((it: any) => {
    const isUuidBatch = it.batch_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(it.batch_id);
    return {
      product_id: it.product_id || it.id,
      batch_id: isUuidBatch ? it.batch_id : null,
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
      unit_price: Number(it.unit_price ?? it.rate ?? it.selling_price ?? 0),
      discount_percent: Number(it.discount_percent || 0),
      gst_rate: Number(it.gst_rate ?? it.gst ?? 0)
    };
  });

  // Pre-calculate verified GST-inclusive totals
  let verifiedSubtotal = 0;
  let verifiedTotalTax = 0;
  let verifiedTotalDiscount = 0;
  let verifiedProductsTotal = 0;

  for (const it of cleanItems) {
    const q = it.quantity;
    const up = it.unit_price;
    const dp = it.discount_percent || 0;
    const disc = (q * up * dp) / 100;
    const lt = Math.max(0, (q * up) - disc);
    const gst = it.gst_rate;
    const taxable = Math.round((lt / (1 + gst / 100)) * 100) / 100;
    const tax = Math.round((lt - taxable) * 100) / 100;

    verifiedSubtotal += taxable;
    verifiedTotalTax += tax;
    verifiedTotalDiscount += disc;
    verifiedProductsTotal += lt;
  }

  const rawAdjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  const totalAdditions = rawAdjustments.filter((a: any) => a.type === 'ADD').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = rawAdjustments.filter((a: any) => a.type === 'DEDUCT').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const verifiedGrandTotal = Math.max(0, verifiedProductsTotal + totalAdditions - totalDeductions);

  // Clean payments - ensure full payment amount reflects final total including adjustments if not credit
  const cleanPayments = (data.payments || []).map((p: any) => {
    const isCreditPayment = String(p.method).toUpperCase() === 'CREDIT';
    return {
      method: p.method,
      amount: isCreditPayment ? (Number(p.amount) || 0) : verifiedGrandTotal
    };
  });

  // Format notes to include adjustments metadata so it persists in Supabase
  let notesPayload = data.notes || null;
  if (rawAdjustments.length > 0) {
    notesPayload = JSON.stringify({
      userNote: data.notes || null,
      adjustments: rawAdjustments,
    });
  }

  const { data: saleRes, error } = await supabase.rpc('process_sale', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_customer_id: realCustomerId,
    p_items: cleanItems,
    p_payments: cleanPayments,
    p_notes: notesPayload,
    p_idempotency_key: data.idempotency_key || null
  });

  if (error) {
    console.error("Failed to complete sale RPC:", error);
    throw new Error(`Failed to complete sale: ${error.message}`);
  }

  const realSaleId = saleRes?.sale_id || saleRes?.id;
  const invoiceNum = saleRes?.invoice_number || saleRes?.invoiceNumber;

  // Post-sale sync to ensure stored database record strictly matches GST-inclusive accounting and adjustments
  if (realSaleId) {
    try {
      await supabase
        .from('sales')
        .update({
          subtotal: verifiedSubtotal,
          tax_amount: verifiedTotalTax,
          discount_amount: verifiedTotalDiscount,
          total_amount: verifiedGrandTotal,
          notes: notesPayload,
        })
        .eq('id', realSaleId);

      // Sync customer ledger if registered customer and adjustment modified the grand total
      if (realCustomerId && verifiedGrandTotal !== verifiedProductsTotal) {
        const netAdjustment = totalAdditions - totalDeductions;
        await supabase
          .from('customer_ledger')
          .update({ debit: verifiedGrandTotal })
          .eq('reference_id', realSaleId)
          .eq('reference_type', 'SALE');

        const { data: custRow } = await supabase
          .from('customers')
          .select('balance')
          .eq('id', realCustomerId)
          .single();

        if (custRow) {
          await supabase
            .from('customers')
            .update({ balance: (Number(custRow.balance) || 0) + netAdjustment })
            .eq('id', realCustomerId);
        }
      }

      const { data: dbItems } = await supabase
        .from('sale_items')
        .select('id, product_id, quantity, unit_price, gst_rate, discount_percent')
        .eq('sale_id', realSaleId);

      if (Array.isArray(dbItems) && dbItems.length > 0) {
        for (const dbIt of dbItems) {
          const q = Math.max(1, Number(dbIt.quantity || 1));
          const up = Number(dbIt.unit_price || 0);
          const dp = Number(dbIt.discount_percent || 0);
          const disc = (q * up * dp) / 100;
          const lt = Math.max(0, (q * up) - disc);
          const gst = Number(dbIt.gst_rate || 0);
          const taxVal = Math.round((lt / (1 + gst / 100)) * 100) / 100;
          const taxAmt = Math.round((lt - taxVal) * 100) / 100;
          const cgstAmt = Math.round((taxAmt / 2) * 100) / 100;
          const sgstAmt = Math.round((taxAmt - cgstAmt) * 100) / 100;

          await supabase
            .from('sale_items')
            .update({
              total_amount: lt,
              tax_amount: taxAmt,
              cgst_amount: cgstAmt,
              sgst_amount: sgstAmt,
            })
            .eq('id', dbIt.id);
        }
      }
    } catch (syncErr) {
      console.warn('Post-sale tax sync warning:', syncErr);
    }
  }

  return {
    ...saleRes,
    id: realSaleId,
    sale_id: realSaleId,
    saleId: realSaleId,
    invoice_number: invoiceNum,
    invoiceNumber: invoiceNum,
    adjustments: rawAdjustments,
    total_amount: verifiedGrandTotal,
    grand_total: verifiedGrandTotal,
    payableAmount: verifiedGrandTotal,
    subtotal: verifiedSubtotal,
  };
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

    const applyFilters = (queryBuilder: any) => {
      let q = queryBuilder.eq('shop_id', shopId);
      if (options.customerId) q = q.eq('customer_id', options.customerId);
      if (options.status) q = q.ilike('status', options.status);
      if (options.dateFrom) q = q.gte('sale_date', options.dateFrom);
      if (options.dateTo) q = q.lte('sale_date', options.dateTo);
      if (options.search) q = q.ilike('invoice_number', `%${options.search}%`);
      return q.order('created_at', { ascending: false });
    };

    // Primary attempt: join with customers and sale_items
    let query = applyFilters(
      supabase
        .from('sales')
        .select('*, customer:customers(*), items:sale_items(*)', { count: 'exact' })
    );

    let { data, count, error } = await query.range(offset, offset + limit - 1);

    // Fallback attempt: if customer relation or nested join failed, select all sales directly
    if (error) {
      console.warn("Primary sales join query warning, falling back to base table:", error.message);
      let fallbackQuery = applyFilters(
        supabase.from('sales').select('*', { count: 'exact' })
      );
      const fallbackRes = await fallbackQuery.range(offset, offset + limit - 1);
      if (fallbackRes.error) {
        console.error("Error fetching sales from Supabase fallback:", fallbackRes.error);
        throw new Error(fallbackRes.error.message || 'Unable to fetch sales from database');
      }
      data = fallbackRes.data;
      count = fallbackRes.count;
    }

    // Enrich missing customer or items if not joined
    if (Array.isArray(data) && data.length > 0) {
      const missingItems = data.some((s: any) => !s.items && !s.sale_items);
      if (missingItems) {
        const saleIds = data.map((s: any) => s.id);
        const { data: allItems } = await supabase
          .from('sale_items')
          .select('*')
          .in('sale_id', saleIds);
        
        if (Array.isArray(allItems)) {
          data = data.map((s: any) => ({
            ...s,
            items: allItems.filter((it: any) => it.sale_id === s.id),
          }));
        }
      }
    }
    
    return { sales: (data || []).map(normalizeSale), total: count || 0 };
  } catch (error: any) {
    console.error("Failed to load sales:", error);
    throw error;
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId);
    
    let query = supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*)')
      .eq('shop_id', shopId);

    if (isUuid) {
      query = query.eq('id', saleId);
    } else {
      query = query.eq('invoice_number', saleId);
    }

    let { data, error } = await query.maybeSingle();
    
    // Fallback if join failed
    if (error) {
      let fallbackQuery = supabase
        .from('sales')
        .select('*')
        .eq('shop_id', shopId);
      if (isUuid) fallbackQuery = fallbackQuery.eq('id', saleId);
      else fallbackQuery = fallbackQuery.eq('invoice_number', saleId);
      
      const res = await fallbackQuery.maybeSingle();
      data = res.data;
    }

    if (data && (!data.items || data.items.length === 0)) {
      const { data: dbItems } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', data.id);
      if (dbItems) data.items = dbItems;
    }

    if (data && data.customer_id && !data.customer) {
      const { data: dbCust } = await supabase
        .from('customers')
        .select('*')
        .eq('id', data.customer_id)
        .maybeSingle();
      if (dbCust) data.customer = dbCust;
    }

    return data ? normalizeSale(data) : null;
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
    let { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*)')
      .eq('shop_id', shopId)
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (error) {
      const fallbackRes = await supabase
        .from('sales')
        .select('*')
        .eq('shop_id', shopId)
        .eq('invoice_number', invoiceNumber)
        .maybeSingle();
      data = fallbackRes.data;
    }

    if (data && (!data.items || data.items.length === 0)) {
      const { data: dbItems } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', data.id);
      if (dbItems) data.items = dbItems;
    }

    if (data && data.customer_id && !data.customer) {
      const { data: dbCust } = await supabase
        .from('customers')
        .select('*')
        .eq('id', data.customer_id)
        .maybeSingle();
      if (dbCust) data.customer = dbCust;
    }

    return data ? normalizeSale(data) : null;
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
  try {
    const { sales } = await getSales(shopId, { limit: 1000 });
    const result = calculateTodaySales(sales);
    return {
      count: result.count,
      total: result.total,
      profit: result.profit,
    };
  } catch (error) {
    console.error("Error fetching today sales:", error);
    return { count: 0, total: 0, profit: 0 };
  }
}

export async function getSalesChart(shopId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  try {
    const maxDays = period === 'weekly' ? 30 : (period === 'monthly' ? 90 : 90);
    const { sales } = await getSales(shopId, { limit: 1000 });
    return calculateSalesChart(sales, maxDays);
  } catch (error) {
    console.error("Error fetching sales chart data:", error);
    return [];
  }
}
