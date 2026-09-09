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

    const qty = Math.max(0, Number(it.quantity || 0));
    const retQty = Math.max(0, Number(it.returned_quantity ?? it.returnedQuantity ?? 0));
    const availQty = Math.max(0, qty - retQty);

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
      quantity: qty,
      returned_quantity: retQty,
      returnedQuantity: retQty,
      available_to_return: availQty,
      availableToReturn: availQty,
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

  // Extract adjustments and quickCustomer snapshot from sale.adjustments or serialized notes
  let rawAdjustments = Array.isArray(sale.adjustments) ? sale.adjustments : [];
  let userNotes = sale.notes || '';
  let quickCustomer: any = null;
  let partialPayment: any = sale.partial_payment || sale.partialPayment || null;

  if (sale.notes && typeof sale.notes === 'string') {
    try {
      const trimmed = sale.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.adjustments)) {
          rawAdjustments = parsed.adjustments;
        }
        if (parsed.userNote !== undefined) {
          userNotes = parsed.userNote || '';
        }
        if (parsed.quickCustomer) {
          quickCustomer = parsed.quickCustomer;
        }
        if (parsed.partialPayment) {
          partialPayment = parsed.partialPayment;
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

  // Resolve customer object from sale or quickCustomer snapshot
  let resolvedCustomer = sale.customer || null;
  if (!resolvedCustomer && quickCustomer) {
    resolvedCustomer = {
      id: 'quick-customer',
      name: (quickCustomer.name || '').toUpperCase().trim(),
      phone: quickCustomer.phone || '',
      mobile: quickCustomer.phone || '',
      village: quickCustomer.village || quickCustomer.address || '',
      address: quickCustomer.address || quickCustomer.village || '',
    };
  } else if (!resolvedCustomer && sale.customer_name) {
    resolvedCustomer = {
      id: 'walk-in',
      name: (sale.customer_name || '').toUpperCase().trim(),
      phone: sale.customer_phone || '',
      mobile: sale.customer_phone || '',
      village: sale.customer_village || sale.customer_address || '',
      address: sale.customer_address || sale.customer_village || '',
    };
  }

  const totalAdditions = rawAdjustments.filter((a: any) => a.type === 'ADD').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = rawAdjustments.filter((a: any) => a.type === 'DEDUCT').reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);

  const effectiveTotal = normalizedItems.length > 0
    ? Math.max(0, calculatedGrandTotal + totalAdditions - totalDeductions)
    : Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? 0);

  const rawStatus = (sale.status || '').toString().toLowerCase().trim();
  const rawPaymentStatus = (sale.payment_status || '').toString().toLowerCase().trim();
  const rawPaymentMethod = (sale.payment_method || sale.payment_mode || '').toString().toUpperCase().trim();

  // Normalize payment_status cleanly
  let normalizedPaymentStatus = 'PAID';
  if (rawStatus === 'cancelled' || rawPaymentStatus === 'cancelled') {
    normalizedPaymentStatus = 'CANCELLED';
  } else if (rawPaymentStatus === 'partial' || rawPaymentMethod === 'PARTIAL' || partialPayment) {
    normalizedPaymentStatus = 'PARTIAL';
  } else if (rawPaymentStatus === 'credit' || rawPaymentStatus === 'unpaid' || rawPaymentMethod === 'CREDIT') {
    normalizedPaymentStatus = 'CREDIT';
  } else if (rawPaymentStatus === 'paid' || rawPaymentStatus === 'completed') {
    normalizedPaymentStatus = 'PAID';
  } else {
    normalizedPaymentStatus = (rawPaymentMethod === 'CREDIT') ? 'CREDIT' : 'PAID';
  }

  // Resolve sale-level lifecycle status
  let resolvedStatus = 'COMPLETED';
  if (rawStatus === 'cancelled') {
    resolvedStatus = 'CANCELLED';
  } else if (rawStatus === 'returned') {
    resolvedStatus = 'RETURNED';
  } else if (rawStatus === 'partially_returned') {
    resolvedStatus = 'PARTIALLY RETURNED';
  } else if (rawStatus === 'refunded') {
    resolvedStatus = 'REFUNDED';
  } else if (normalizedPaymentStatus === 'CREDIT') {
    resolvedStatus = 'PENDING';
  } else {
    resolvedStatus = 'COMPLETED';
  }

  // Resolve payment_method/mode
  let resolvedPaymentMethod = sale.payment_method || sale.payment_mode || '';
  if (!resolvedPaymentMethod && Array.isArray(sale.payments) && sale.payments.length > 0) {
    if (sale.payments.length > 1) {
      resolvedPaymentMethod = 'PARTIAL';
    } else {
      resolvedPaymentMethod = sale.payments[0].payment_method || sale.payments[0].method || 'CASH';
    }
  }
  if (!resolvedPaymentMethod) {
    resolvedPaymentMethod = normalizedPaymentStatus === 'CREDIT' ? 'CREDIT' : 'CASH';
  }

  const custObj = resolvedCustomer || sale.customer || null;
  const custName = custObj?.name || sale.customer_name || (sale.customer_id ? 'CUSTOMER' : 'WALK-IN CUSTOMER');
  const returnsList = Array.isArray(sale.returns) ? sale.returns : (Array.isArray(sale.sale_returns) ? sale.sale_returns : []);

  return {
    ...sale,
    customer: custObj,
    customer_name: custName,
    customer_phone: custObj?.phone || custObj?.mobile || sale.customer_phone || '',
    customer_village: custObj?.village || custObj?.address || sale.customer_village || sale.customer_address || '',
    customer_address: custObj?.address || custObj?.village || sale.customer_address || sale.customer_village || '',
    adjustments: rawAdjustments,
    partial_payment: partialPayment,
    partialPayment: partialPayment,
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
    returns: returnsList,
    sale_returns: returnsList,
    status: resolvedStatus,
    payment_status: normalizedPaymentStatus,
    payment_method: resolvedPaymentMethod,
    payment_mode: resolvedPaymentMethod,
    db_status: rawStatus || 'completed',
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
      customerObj = {
        ...data.customer,
        name: (data.customer.name || 'WALK-IN CUSTOMER').toUpperCase(),
      };
    } else if (data.customer_name) {
      customerObj = {
        id: customerId || `cust-${Date.now()}`,
        name: data.customer_name.trim().toUpperCase(),
        phone: data.customer_phone || '',
      };
    } else if (customerId && customerId !== 'walk-in') {
      const demoCusts = getDemoCustomers();
      const found = demoCusts.find(c => c.id === customerId) || MOCK_CUSTOMERS.find(c => c.id === customerId);
      customerObj = found
        ? { id: found.id, name: (found.name || 'CUSTOMER').toUpperCase(), phone: found.phone || found.mobile || '' }
        : { id: customerId, name: (data.customer_name || 'CUSTOMER').trim().toUpperCase(), phone: '' };
    } else {
      customerObj = { id: 'walk-in', name: 'WALK-IN CUSTOMER', phone: '' };
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
      customer_name: customerObj?.name || 'WALK-IN CUSTOMER',
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

  // Clean payments - preserve individual amounts for partial payment splits or credit
  const hasMultiplePayments = Array.isArray(data.payments) && data.payments.length > 1;
  const isPartial = Boolean(data.partial_payment || data.partialPayment) || hasMultiplePayments;

  const cleanPayments = (data.payments || []).map((p: any) => {
    const isCreditPayment = String(p.method).toUpperCase() === 'CREDIT';
    return {
      method: p.method,
      amount: (isCreditPayment || isPartial) ? (Number(p.amount) || 0) : verifiedGrandTotal
    };
  });

  // Format notes to include adjustments and customer snapshot metadata so it persists in Supabase
  let notesPayload = data.notes || null;
  const metadataObj: any = {};
  if (data.notes) metadataObj.userNote = data.notes;
  if (rawAdjustments.length > 0) metadataObj.adjustments = rawAdjustments;
  if (data.partial_payment || data.partialPayment) {
    metadataObj.partialPayment = data.partial_payment || data.partialPayment;
  }
  if (data.customer_name || data.customer_phone || data.customer_village || data.customer_address || data.customer) {
    const custName = (data.customer_name || data.customer?.name || '').toUpperCase().trim();
    const custPhone = (data.customer_phone || data.customer?.phone || data.customer?.mobile || '').trim();
    const custVill = (data.customer_village || data.customer_address || data.customer?.village || data.customer?.address || '').toUpperCase().trim();
    if (custName || custPhone || custVill) {
      metadataObj.quickCustomer = {
        name: custName,
        phone: custPhone,
        village: custVill,
        address: custVill,
      };
    }
  }
  if (Object.keys(metadataObj).length > 0) {
    notesPayload = JSON.stringify(metadataObj);
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
    items: data.items || cleanItems,
    sale_items: data.items || cleanItems,
    adjustments: rawAdjustments,
    total_amount: verifiedGrandTotal,
    grand_total: verifiedGrandTotal,
    payableAmount: verifiedGrandTotal,
    subtotal: verifiedSubtotal,
  };
}

async function enrichSaleItemsWithMetadata(supabase: any, items: any[]) {
  if (!Array.isArray(items) || items.length === 0) return items;

  const productIds = Array.from(new Set(items.map(it => it.product_id).filter(Boolean)));
  const batchIds = Array.from(new Set(items.map(it => it.batch_id).filter(Boolean)));
  const saleItemIds = items.map(it => it.id).filter(Boolean);

  let productsMap = new Map<string, any>();
  let batchesMap = new Map<string, any>();
  let saleItemBatchesMap = new Map<string, any[]>();

  // 1. Fetch products with brands and their batches
  if (productIds.length > 0) {
    try {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, hsn_code, unit, pack_size, brand_id, brand:brands(id, name, manufacturer), batches:product_batches(id, batch_number, expiry_date)')
        .in('id', productIds);
      if (Array.isArray(prods)) {
        for (const p of prods) {
          productsMap.set(p.id, p);
        }
      }
    } catch (e) {
      console.warn('Failed to enrich products for sale items:', e);
    }
  }

  // 2. Fetch specific batches if referenced directly
  if (batchIds.length > 0) {
    try {
      const { data: dbBatches } = await supabase
        .from('product_batches')
        .select('id, product_id, batch_number, expiry_date')
        .in('id', batchIds);
      if (Array.isArray(dbBatches)) {
        for (const b of dbBatches) {
          batchesMap.set(b.id, b);
        }
      }
    } catch (e) {
      console.warn('Failed to enrich batches for sale items:', e);
    }
  }

  // 3. Fetch sale_item_batches if present
  if (saleItemIds.length > 0) {
    try {
      const { data: sibs } = await supabase
        .from('sale_item_batches')
        .select('sale_item_id, batch:product_batches(id, batch_number, expiry_date)')
        .in('sale_item_id', saleItemIds);
      if (Array.isArray(sibs)) {
        for (const sib of sibs) {
          const list = saleItemBatchesMap.get(sib.sale_item_id) || [];
          list.push(sib);
          saleItemBatchesMap.set(sib.sale_item_id, list);
        }
      }
    } catch {
      // optional
    }
  }

  return items.map(it => {
    const prod = productsMap.get(it.product_id) || it.product || {};
    const directBatch = it.batch_id ? batchesMap.get(it.batch_id) : null;
    const sibBatch = saleItemBatchesMap.get(it.id)?.[0]?.batch;
    const prodBatch = prod.batches?.[0];
    const resolvedBatch = directBatch || sibBatch || it.batch || prodBatch || null;

    const hsn = it.hsn_code || prod.hsn_code || null;
    const batchNo = it.batch_number || resolvedBatch?.batch_number || null;
    const expDate = it.expiry_date || resolvedBatch?.expiry_date || null;
    const mfg = it.manufacturer || prod.brand?.manufacturer || prod.brand?.name || prod.manufacturer || null;

    return {
      ...it,
      product: prod,
      batch: resolvedBatch,
      hsn_code: hsn,
      batch_number: batchNo,
      expiry_date: expDate,
      manufacturer: mfg,
    };
  });
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

      // Batch enrich items with product and batch metadata
      const allItemsList = data.flatMap((s: any) => s.items || s.sale_items || []);
      if (allItemsList.length > 0) {
        const enrichedList = await enrichSaleItemsWithMetadata(supabase, allItemsList);
        const itemsBySale = new Map<string, any[]>();
        for (const it of enrichedList) {
          const list = itemsBySale.get(it.sale_id) || [];
          list.push(it);
          itemsBySale.set(it.sale_id, list);
        }
        data = data.map((s: any) => ({
          ...s,
          items: itemsBySale.get(s.id) || s.items || s.sale_items || [],
        }));
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

    if (data) {
      if (!data.items || data.items.length === 0) {
        const { data: dbItems } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', data.id);
        if (dbItems) data.items = dbItems;
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        data.items = await enrichSaleItemsWithMetadata(supabase, data.items);
      }

      if (data.customer_id && !data.customer) {
        const { data: dbCust } = await supabase
          .from('customers')
          .select('*')
          .eq('id', data.customer_id)
          .maybeSingle();
        if (dbCust) data.customer = dbCust;
      }

      // Fetch return documents for this sale
      try {
        const { data: returnsData } = await supabase
          .from('sale_returns')
          .select('*, items:sale_return_items(*, product:products(name, sku, unit)), batches:sale_return_item_batches(*)')
          .eq('shop_id', shopId)
          .eq('sale_id', data.id)
          .order('return_date', { ascending: false });

        data.returns = returnsData || [];
        data.sale_returns = returnsData || [];

        // Ensure returned_quantity is aggregated accurately from return items if present
        if (Array.isArray(data.items) && Array.isArray(returnsData) && returnsData.length > 0) {
          const retQtyByItem = new Map<string, number>();
          for (const retDoc of returnsData) {
            for (const retItem of (retDoc.items || [])) {
              const current = retQtyByItem.get(retItem.sale_item_id) || 0;
              retQtyByItem.set(retItem.sale_item_id, current + Number(retItem.quantity || 0));
            }
          }
          data.items = data.items.map((it: any) => {
            const sumRet = retQtyByItem.get(it.id);
            if (sumRet !== undefined) {
              return { ...it, returned_quantity: Math.max(Number(it.returned_quantity || 0), sumRet) };
            }
            return it;
          });
        }
      } catch (err) {
        console.warn("Could not load return history for sale:", err);
        data.returns = [];
        data.sale_returns = [];
      }
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

    if (data) {
      if (!data.items || data.items.length === 0) {
        const { data: dbItems } = await supabase
          .from('sale_items')
          .select('*')
          .eq('sale_id', data.id);
        if (dbItems) data.items = dbItems;
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        data.items = await enrichSaleItemsWithMetadata(supabase, data.items);
      }

      if (data.customer_id && !data.customer) {
        const { data: dbCust } = await supabase
          .from('customers')
          .select('*')
          .eq('id', data.customer_id)
          .maybeSingle();
        if (dbCust) data.customer = dbCust;
      }

      try {
        const { data: returnsData } = await supabase
          .from('sale_returns')
          .select('*, items:sale_return_items(*, product:products(name, sku, unit)), batches:sale_return_item_batches(*)')
          .eq('shop_id', shopId)
          .eq('sale_id', data.id)
          .order('return_date', { ascending: false });

        data.returns = returnsData || [];
        data.sale_returns = returnsData || [];
      } catch {
        data.returns = [];
        data.sale_returns = [];
      }
    }

    return data ? normalizeSale(data) : null;
  } catch (error) {
    console.error("Failed to load sale by invoice:", error);
    return null;
  }
}

export async function getSaleReturns(shopId: string, saleId: string) {
  if (isPlaceholderMode()) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('sale_returns')
    .select('*, customer:customers(*), items:sale_return_items(*, product:products(name, sku, unit, hsn_code), batch:product_batches(batch_number, expiry_date)), batches:sale_return_item_batches(*, batch:product_batches(batch_number, expiry_date))')
    .eq('shop_id', shopId)
    .eq('sale_id', saleId)
    .order('return_date', { ascending: false });

  if (error) {
    console.error("Error fetching sale returns:", error);
    throw new Error(error.message || 'Unable to load return history');
  }

  return data || [];
}

export async function getSaleReturnById(shopId: string, returnId: string) {
  if (isPlaceholderMode()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('sale_returns')
    .select('*, sale:sales(*, customer:customers(*)), customer:customers(*), items:sale_return_items(*, product:products(name, sku, unit, hsn_code, category:categories(name), brand:brands(name)), batch:product_batches(batch_number, expiry_date)), batches:sale_return_item_batches(*, batch:product_batches(batch_number, expiry_date))')
    .eq('shop_id', shopId)
    .eq('id', returnId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching sale return by ID:", error);
    throw new Error(error.message || 'Unable to load return document');
  }

  return data || null;
}

/** Parse JSONB RPC payloads that may arrive as object or JSON string. */
function parseRpcJson(data: any): any {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { success: true, raw: data };
    }
  }
  return data;
}

function getSaleLifecycleStatus(sale: any): string {
  const raw = (sale?.db_status || sale?.status || '').toString().toLowerCase().trim();
  if (raw === 'cancelled' || raw === 'cancel') return 'cancelled';
  if (raw === 'returned' || raw === 'fully returned' || raw === 'fully_returned') return 'returned';
  if (raw === 'partially_returned' || raw === 'partially returned') return 'partially_returned';
  return 'completed';
}

/**
 * Cancel a sale via the atomic `cancel_sale` RPC.
 * Bills are never deleted — status becomes `cancelled`.
 * Stock/ledger/payment reversal is performed once inside the RPC
 * (skips units already restored by prior returns).
 */
export async function cancelSale(shopId: string, saleId: string, userId: string, reason: string = 'Sale Cancelled') {
  if (!shopId) {
    throw new Error('Authenticated shop context is required.');
  }
  if (!saleId) {
    throw new Error('Sale ID is required');
  }
  if (!reason || !String(reason).trim()) {
    throw new Error('Cancellation reason is required');
  }

  if (isPlaceholderMode()) {
    const store = getStoredDemoSales(normalizeSale);
    const found = store.find(s => s.id === saleId || s.invoice_number === saleId);
    if (!found) {
      throw new Error('Sale not found');
    }
    const lifecycle = getSaleLifecycleStatus(found);
    if (lifecycle === 'cancelled') {
      throw new Error('This bill has already been cancelled.');
    }
    if (lifecycle === 'returned') {
      throw new Error('Cannot cancel a fully returned bill.');
    }
    found.status = 'cancelled';
    found.db_status = 'cancelled';
    found.payment_status = 'cancelled';
    found.cancel_reason = reason;
    saveStoredDemoSales(store);
    return { success: true, sale_id: saleId, invoice_number: found.invoice_number, status: 'cancelled' };
  }

  // Pre-flight integrity checks (authoritative enforcement remains in cancel_sale RPC)
  const existing = await getSaleById(shopId, saleId);
  if (!existing) {
    throw new Error('Sale not found in this shop.');
  }
  const lifecycle = getSaleLifecycleStatus(existing);
  if (lifecycle === 'cancelled') {
    throw new Error('This bill has already been cancelled.');
  }
  if (lifecycle === 'returned') {
    // Prevent double financial reversal after a full return credit-note/refund cycle
    throw new Error('Cannot cancel a fully returned bill.');
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('cancel_sale', {
    p_shop_id: shopId,
    p_sale_id: saleId,
    p_user_id: userId,
    p_reason: reason || 'Sale Cancelled',
  });

  if (error) {
    console.error("Error cancelling sale:", error);
    const msg = error.message || '';
    if (msg.includes('is already cancelled')) {
      throw new Error('This bill has already been cancelled.');
    }
    if (msg.includes('not found')) {
      throw new Error('Sale not found in this shop.');
    }
    throw new Error(error.message || 'Unable to cancel bill. Please try again.');
  }

  return parseRpcJson(data) || { success: true, sale_id: saleId, status: 'cancelled' };
}

/**
 * Process a partial/full product return via the atomic `process_sale_return` RPC.
 * Creates a linked sale_returns document, restores EXACT original batch allocations
 * (never FEFO), and adjusts ledger/payments exactly once inside the RPC.
 */
export async function returnSale(
  shopId: string,
  saleId: string,
  items: { saleItemId: string; quantity: number; reason?: string }[],
  userId: string,
  refundMode: string = 'CREDIT_ADJUSTMENT',
  reason: string = 'Customer Return'
) {
  if (!shopId) {
    throw new Error('Authenticated shop context is required.');
  }
  if (!saleId) {
    throw new Error('Sale ID is required');
  }
  if (!items || items.length === 0) {
    throw new Error('At least one item must be selected for return');
  }

  // Validate items
  for (const it of items) {
    if (!it.saleItemId) {
      throw new Error('Sale item ID is required for each return item');
    }
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new Error('Return quantity must be a positive whole number');
    }
  }

  const validModes = ['CREDIT_ADJUSTMENT', 'CASH', 'UPI', 'BANK_TRANSFER', 'CARD'];
  const effectiveMode = validModes.includes(refundMode) ? refundMode : 'CREDIT_ADJUSTMENT';

  if (isPlaceholderMode()) {
    const store = getStoredDemoSales(normalizeSale);
    const foundIndex = store.findIndex(s => s.id === saleId || s.invoice_number === saleId);
    if (foundIndex < 0) {
      throw new Error('Sale not found');
    }
    const found = store[foundIndex];
    const lifecycle = getSaleLifecycleStatus(found);
    if (lifecycle === 'cancelled') {
      throw new Error('This bill has already been cancelled.');
    }
    if (lifecycle === 'returned') {
      throw new Error('This bill has already been fully returned.');
    }

    const saleItems = Array.isArray(found.items) ? found.items : (found.sale_items || []);
    let refundTotal = 0;
    for (const req of items) {
      const target = saleItems.find((si: any) => si.id === req.saleItemId);
      if (!target) {
        throw new Error('Sale or item not found in this shop.');
      }
      const soldQty = Number(target.quantity || 0);
      const already = Number(target.returned_quantity || 0);
      const available = Math.max(0, soldQty - already);
      if (req.quantity > available) {
        throw new Error(
          `Cannot return ${req.quantity} units of ${target.product_name || 'item'}. Maximum available to return is ${available} units`
        );
      }
      target.returned_quantity = already + req.quantity;
      const unitPrice = Number(target.unit_price ?? target.selling_price ?? target.rate ?? 0);
      refundTotal += req.quantity * unitPrice;
    }

    const allReturned = saleItems.every(
      (si: any) => Number(si.returned_quantity || 0) >= Number(si.quantity || 0)
    );
    const saleStatus = allReturned ? 'returned' : 'partially_returned';
    found.status = saleStatus;
    found.db_status = saleStatus;
    found.items = saleItems;
    found.sale_items = saleItems;

    const returnId = `ret-${Date.now()}`;
    const returnNumber = `RET-${String(found.invoice_number || '1').replace(/^INV-|^KOS-/i, '')}-01`;
    const returnDoc = {
      id: returnId,
      return_number: returnNumber,
      sale_id: found.id,
      total_amount: refundTotal,
      refund_mode: effectiveMode,
      reason: reason || 'Customer Return',
      items: items.map((i) => ({ ...i })),
    };
    found.returns = [...(found.returns || found.sale_returns || []), returnDoc];
    found.sale_returns = found.returns;
    store[foundIndex] = found;
    saveStoredDemoSales(store);

    return {
      success: true,
      return_id: returnId,
      return_number: returnNumber,
      invoice_number: found.invoice_number || 'INV',
      total_amount: refundTotal,
      refund_mode: effectiveMode,
      sale_status: saleStatus,
    };
  }

  // Pre-flight integrity checks (authoritative enforcement remains in process_sale_return RPC)
  const existing = await getSaleById(shopId, saleId);
  if (!existing) {
    throw new Error('Sale not found in this shop.');
  }
  const lifecycle = getSaleLifecycleStatus(existing);
  if (lifecycle === 'cancelled') {
    throw new Error('This bill has already been cancelled.');
  }
  if (lifecycle === 'returned') {
    throw new Error('This bill has already been fully returned.');
  }

  // Ensure requested quantities do not exceed available_to_return before hitting the RPC
  const existingItems = Array.isArray(existing.items) ? existing.items : [];
  for (const req of items) {
    const target = existingItems.find((si: any) => si.id === req.saleItemId);
    if (!target) {
      throw new Error('Sale or item not found in this shop.');
    }
    const available = Number(
      target.available_to_return ??
        Math.max(0, Number(target.quantity || 0) - Number(target.returned_quantity || 0))
    );
    if (req.quantity > available) {
      throw new Error(
        `Cannot return ${req.quantity} units of ${target.product_name || 'item'}. Maximum available to return is ${available} units`
      );
    }
  }

  const supabase = await createServerSupabaseClient();
  // Source of truth: process_sale_return restores exact original sale_item_batches
  // (never FEFO), writes sale_returns / sale_return_items, and adjusts ledger/payments once.
  const { data, error } = await supabase.rpc('process_sale_return', {
    p_shop_id: shopId,
    p_sale_id: saleId,
    p_items: items.map(i => ({
      saleItemId: i.saleItemId,
      quantity: i.quantity,
      reason: i.reason || reason || 'Customer Return',
    })),
    p_user_id: userId,
    p_refund_mode: effectiveMode,
    p_reason: reason || 'Customer Return',
  });

  if (error) {
    console.error("Error processing sale return:", error);
    const msg = error.message || '';
    if (msg.includes('Cannot return products from a cancelled sale')) {
      throw new Error('This bill has already been cancelled.');
    }
    if (msg.includes('already fully returned')) {
      throw new Error('This bill has already been fully returned.');
    }
    if (msg.includes('Maximum available to return is')) {
      throw new Error(msg.replace(/^.*Cannot return/i, 'Cannot return'));
    }
    if (msg.includes('not found')) {
      throw new Error('Sale or item not found in this shop.');
    }
    throw new Error(error.message || 'Unable to process return. Please try again.');
  }

  const parsed = parseRpcJson(data);
  if (!parsed) {
    throw new Error('Return processed but no confirmation was returned from the database.');
  }
  return parsed;
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
