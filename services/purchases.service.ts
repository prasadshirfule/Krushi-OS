import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PurchaseInput } from '@/lib/validations';
import { isPlaceholderMode } from '@/services/products.service';
import { getStoredDemoProducts, saveStoredDemoProducts } from '@/lib/demo-storage';

export async function completePurchase(shopId: string, data: PurchaseInput, userId: string) {
  // 1. Placeholder / Demo Mode Handling
  if (isPlaceholderMode()) {
    const purchaseId = `purch-${Date.now()}`;
    const products = getStoredDemoProducts((p: any) => p);
    
    let subtotal = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const normalizedItems = (data.items || []).map((it, idx) => {
      const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
      const rate = Number(it.purchase_price || 0);
      const gstRate = Number(it.gst_rate || 0);
      const itemSubtotal = qty * rate;
      const gstAmt = Math.round((itemSubtotal * (gstRate / 100)) * 100) / 100;
      const itemTotal = itemSubtotal + gstAmt;

      subtotal += itemSubtotal;
      totalTax += gstAmt;
      grandTotal += itemTotal;

      // Update product in demo store
      const prodIndex = products.findIndex(p => p.id === it.product_id);
      if (prodIndex > -1) {
        const prod = products[prodIndex];
        const oldStock = Number(prod.current_stock || prod.stock_quantity || 0);
        const newStock = oldStock + qty;
        
        let batches = Array.isArray(prod.batches) ? [...prod.batches] : [];
        const batchNo = it.batch_number?.trim();
        let batchIndex = it.batch_id ? batches.findIndex(b => b.id === it.batch_id) : -1;
        if (batchIndex === -1 && batchNo) {
          batchIndex = batches.findIndex(b => b.batch_number === batchNo);
        }

        if (batchIndex > -1) {
          const oldBatch = batches[batchIndex];
          const oldReceived = Number(oldBatch.quantity_received || oldBatch.quantity_available || 0);
          const oldAvail = Number(oldBatch.quantity_available || 0);
          batches[batchIndex] = {
            ...oldBatch,
            quantity_received: oldReceived + qty,
            quantity_available: oldAvail + qty,
            purchase_price: rate,
            selling_price: it.selling_price ? Number(it.selling_price) : oldBatch.selling_price,
            expiry_date: it.expiry_date ? new Date(it.expiry_date).toISOString().split('T')[0] : oldBatch.expiry_date,
          };
        } else if (batchNo) {
          batches.push({
            id: `batch-${Date.now()}-${idx}`,
            product_id: it.product_id,
            batch_number: batchNo,
            manufacturing_date: it.manufacturing_date ? new Date(it.manufacturing_date).toISOString().split('T')[0] : null,
            expiry_date: it.expiry_date ? new Date(it.expiry_date).toISOString().split('T')[0] : new Date(Date.now() + 63072000000).toISOString().split('T')[0],
            purchase_price: rate,
            selling_price: it.selling_price ? Number(it.selling_price) : Number(prod.selling_price || 0),
            quantity_received: qty,
            quantity_available: qty,
            is_active: true,
          });
        }

        products[prodIndex] = {
          ...prod,
          current_stock: newStock,
          stock_quantity: newStock,
          purchase_price: rate,
          selling_price: it.selling_price ? Number(it.selling_price) : prod.selling_price,
          batches,
        };
      }

      return {
        id: `pi-${Date.now()}-${idx}`,
        purchase_id: purchaseId,
        product_id: it.product_id,
        product_name: it.product_name || 'Product',
        batch_id: it.batch_id || null,
        batch_number: it.batch_number || null,
        expiry_date: it.expiry_date ? new Date(it.expiry_date).toISOString().split('T')[0] : null,
        quantity: qty,
        purchase_price: rate,
        selling_price: it.selling_price ? Number(it.selling_price) : null,
        gst_rate: gstRate,
        gst_amount: gstAmt,
        total_amount: itemTotal,
      };
    });

    saveStoredDemoProducts(products);

    return {
      success: true,
      purchase_id: purchaseId,
      total_amount: grandTotal,
      subtotal,
      tax_amount: totalTax,
      items: normalizedItems,
    };
  }

  // 2. Real Supabase Mode
  const supabase = await createServerSupabaseClient();

  const cleanedItems = (data.items || []).map(it => ({
    product_id: it.product_id,
    product_name: it.product_name || null,
    batch_id: it.batch_id || null,
    batch_number: it.batch_number ? it.batch_number.trim() : null,
    manufacturing_date: it.manufacturing_date ? new Date(it.manufacturing_date).toISOString().split('T')[0] : null,
    expiry_date: it.expiry_date ? new Date(it.expiry_date).toISOString().split('T')[0] : null,
    quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
    unit_price: Number(it.purchase_price || 0),
    purchase_price: Number(it.purchase_price || 0),
    selling_price: it.selling_price !== null && it.selling_price !== undefined ? Number(it.selling_price) : null,
    gst_rate: Number(it.gst_rate || 0),
    gst_amount: Number(it.gst_amount || 0),
    total_amount: Number(it.total_amount || (Number(it.quantity) * Number(it.purchase_price))),
  }));

  const purchaseDateStr = data.purchase_date instanceof Date 
    ? data.purchase_date.toISOString() 
    : new Date(data.purchase_date).toISOString();

  // Try calling enhanced process_purchase (9 parameters)
  let { data: purchase, error } = await supabase.rpc('process_purchase', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_supplier_id: data.supplier_id,
    p_invoice_number: data.invoice_number?.trim() || null,
    p_purchase_date: purchaseDateStr,
    p_items: cleanedItems,
    p_notes: data.notes || null,
    p_paid_amount: Number(data.paid_amount || 0),
    p_idempotency_key: data.idempotency_key || null,
  });

  // Backward-compatibility fallback if database still runs 7-parameter version
  if (error && (error.message?.includes('function process_purchase') || error.code === 'PGRST202')) {
    console.warn("Retrying with legacy 7-parameter process_purchase signature:", error.message);
    const legacyRes = await supabase.rpc('process_purchase', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_supplier_id: data.supplier_id,
      p_invoice_number: data.invoice_number?.trim() || null,
      p_purchase_date: purchaseDateStr,
      p_items: cleanedItems,
      p_notes: data.notes || null,
    });
    purchase = legacyRes.data;
    error = legacyRes.error;
  }

  // Fallback transaction engine if RPC is missing or fails due to constraint
  if (error) {
    console.warn("RPC process_purchase failed, executing fallback server transaction:", error);
    
    // Idempotency check in fallback
    if (data.idempotency_key) {
      const { data: existing } = await supabase
        .from('purchases')
        .select('id, total_amount')
        .eq('shop_id', shopId)
        .eq('idempotency_key', data.idempotency_key)
        .maybeSingle();

      if (existing) {
        return { success: true, purchase_id: existing.id, total_amount: existing.total_amount, duplicate: true };
      }
    }

    if (data.invoice_number && data.supplier_id) {
      const { data: existingInv } = await supabase
        .from('purchases')
        .select('id, total_amount')
        .eq('shop_id', shopId)
        .eq('supplier_id', data.supplier_id)
        .eq('invoice_number', data.invoice_number.trim())
        .eq('status', 'completed')
        .maybeSingle();

      if (existingInv) {
        return { success: true, purchase_id: existingInv.id, total_amount: existingInv.total_amount, duplicate: true };
      }
    }

    // Insert purchase record
    let subtotal = 0;
    let totalTax = 0;
    let grandTotal = 0;

    for (const it of cleanedItems) {
      const itSub = it.quantity * it.unit_price;
      const itTax = Math.round((itSub * (it.gst_rate / 100)) * 100) / 100;
      subtotal += itSub;
      totalTax += itTax;
      grandTotal += (itSub + itTax);
    }

    const paidAmt = Number(data.paid_amount || 0);

    const { data: newPurch, error: purchErr } = await supabase
      .from('purchases')
      .insert({
        shop_id: shopId,
        supplier_id: data.supplier_id,
        invoice_number: data.invoice_number?.trim() || null,
        purchase_date: purchaseDateStr.split('T')[0],
        subtotal,
        tax_amount: totalTax,
        total_amount: grandTotal,
        paid_amount: paidAmt,
        status: 'completed',
        notes: data.notes || null,
        idempotency_key: data.idempotency_key || null,
        created_by: userId,
      })
      .select('id')
      .single();

    if (purchErr || !newPurch) {
      throw new Error(`Failed to create purchase invoice: ${purchErr?.message || 'Unknown database error'}`);
    }

    const purchaseId = newPurch.id;

    for (const it of cleanedItems) {
      let batchId: string | null = it.batch_id || null;
      const batchNo = it.batch_number;

      // Resolve Batch
      if (batchId) {
        // Fetch current batch received
        const { data: existingBatch } = await supabase
          .from('product_batches')
          .select('quantity_received, quantity_available')
          .eq('id', batchId)
          .single();

        if (existingBatch) {
          await supabase
            .from('product_batches')
            .update({
              quantity_received: (existingBatch.quantity_received || 0) + it.quantity,
              purchase_price: it.unit_price,
              selling_price: it.selling_price || undefined,
              expiry_date: it.expiry_date || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);
        }
      } else if (batchNo) {
        const { data: existingBatch } = await supabase
          .from('product_batches')
          .select('id, quantity_received, quantity_available')
          .eq('shop_id', shopId)
          .eq('product_id', it.product_id)
          .eq('batch_number', batchNo)
          .maybeSingle();

        if (existingBatch) {
          batchId = existingBatch.id;
          await supabase
            .from('product_batches')
            .update({
              quantity_received: (existingBatch.quantity_received || 0) + it.quantity,
              purchase_price: it.unit_price,
              selling_price: it.selling_price || undefined,
              expiry_date: it.expiry_date || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);
        } else {
          // Insert new batch with quantity_available = 0 (process_stock_movement will add it)
          const defaultExp = it.expiry_date || new Date(Date.now() + 63072000000).toISOString().split('T')[0];
          const { data: newBatch } = await supabase
            .from('product_batches')
            .insert({
              shop_id: shopId,
              product_id: it.product_id,
              batch_number: batchNo,
              manufacturing_date: it.manufacturing_date || null,
              expiry_date: defaultExp,
              purchase_price: it.unit_price,
              selling_price: it.selling_price || null,
              quantity_received: it.quantity,
              quantity_available: 0,
              supplier_id: data.supplier_id,
              is_active: true,
            })
            .select('id')
            .single();

          if (newBatch) {
            batchId = newBatch.id;
          }
        }
      }

      // Insert purchase item line
      const itSub = it.quantity * it.unit_price;
      const itTax = Math.round((itSub * (it.gst_rate / 100)) * 100) / 100;
      await supabase
        .from('purchase_items')
        .insert({
          purchase_id: purchaseId,
          product_id: it.product_id,
          batch_id: batchId,
          quantity: it.quantity,
          purchase_price: it.unit_price,
          gst_rate: it.gst_rate,
          gst_amount: itTax,
          total_amount: itSub + itTax,
          product_name: it.product_name || undefined,
          batch_number: it.batch_number || undefined,
          expiry_date: it.expiry_date || undefined,
          selling_price: it.selling_price || undefined,
        });

      // Update product master prices
      await supabase
        .from('products')
        .update({
          purchase_price: it.unit_price,
          selling_price: it.selling_price && it.selling_price > 0 ? it.selling_price : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', it.product_id);

      // Trigger Central Stock Movement
      await supabase.rpc('process_stock_movement', {
        p_shop_id: shopId,
        p_product_id: it.product_id,
        p_batch_id: batchId,
        p_transaction_type: 'PURCHASE_IN',
        p_quantity_change: it.quantity,
        p_reason: `Purchase Invoice #${data.invoice_number || 'N/A'}`,
        p_reference_type: 'PURCHASE',
        p_reference_id: purchaseId,
        p_user_id: userId,
      });
    }

    // Update supplier balance and ledger
    if (data.supplier_id) {
      const { data: supp } = await supabase
        .from('suppliers')
        .select('total_purchases, total_paid, outstanding')
        .eq('id', data.supplier_id)
        .single();

      if (supp) {
        const newTotalPurch = Number(supp.total_purchases || 0) + grandTotal;
        const newTotalPaid = Number(supp.total_paid || 0) + paidAmt;
        const newOutstanding = Number(supp.outstanding || 0) + (grandTotal - paidAmt);

        await supabase
          .from('suppliers')
          .update({
            total_purchases: newTotalPurch,
            total_paid: newTotalPaid,
            outstanding: newOutstanding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.supplier_id);

        await supabase
          .from('supplier_ledger')
          .insert({
            shop_id: shopId,
            supplier_id: data.supplier_id,
            description: `Purchase Invoice #${data.invoice_number || 'N/A'}`,
            reference_type: 'PURCHASE',
            reference_id: purchaseId,
            credit: grandTotal,
            debit: paidAmt,
            balance: newOutstanding,
            notes: data.notes || null,
            created_by: userId,
          });
      }
    }

    // Upfront payment
    if (paidAmt > 0) {
      await supabase
        .from('payments')
        .insert({
          shop_id: shopId,
          payment_type: 'PURCHASE',
          reference_type: 'PURCHASE',
          reference_id: purchaseId,
          supplier_id: data.supplier_id,
          payment_method: data.payment_method || 'BANK_TRANSFER',
          amount: paidAmt,
          notes: `Payment for Purchase Invoice #${data.invoice_number || 'N/A'}`,
          created_by: userId,
        });
    }

    return {
      success: true,
      purchase_id: purchaseId,
      total_amount: grandTotal,
      subtotal,
      tax_amount: totalTax,
    };
  }

  return purchase;
}

export async function getPurchases(shopId: string, options: { search?: string, supplierId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('purchases')
      .select('*, supplier:suppliers(id, name, company), items:purchase_items(*)', { count: 'exact' })
      .eq('shop_id', shopId);
    
    if (options.supplierId) query = query.eq('supplier_id', options.supplierId);
    if (options.dateFrom) query = query.gte('purchase_date', options.dateFrom);
    if (options.dateTo) query = query.lte('purchase_date', options.dateTo);
    if (options.search) query = query.ilike('invoice_number', `%${options.search}%`);
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching purchases:", error);
      return { purchases: [], total: 0 };
    }
    
    return { purchases: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load purchases:", error);
    return { purchases: [], total: 0 };
  }
}

export async function getPurchaseById(shopId: string, purchaseId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('purchases')
      .select('*, supplier:suppliers(*), items:purchase_items(*, product:products(*), batch:product_batches(*))')
      .eq('shop_id', shopId)
      .eq('id', purchaseId)
      .single();
    if (error) {
      console.error("Error fetching purchase by ID:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load purchase by ID:", error);
    return null;
  }
}

export async function getPurchaseSummary(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // First day of current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: monthPurchases } = await supabase
      .from('purchases')
      .select('total_amount')
      .eq('shop_id', shopId)
      .gte('created_at', monthStart);

    const totalMonthlyPurchases = (monthPurchases || []).reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('outstanding')
      .eq('shop_id', shopId);

    const totalOutstandingPayable = (suppliers || []).reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0);

    return {
      totalMonthlyPurchases,
      totalOutstandingPayable
    };
  } catch (error) {
    console.error("Failed to load purchase summary:", error);
    return { totalMonthlyPurchases: 0, totalOutstandingPayable: 0 };
  }
}
