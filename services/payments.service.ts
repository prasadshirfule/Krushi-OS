import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function recordCustomerPayment(shopId: string, data: { customerId: string, amount: number, method: string, notes?: string }, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: payment, error } = await supabase.rpc('record_customer_payment', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_customer_id: data.customerId,
    p_amount: data.amount,
    p_method: data.method,
    p_notes: data.notes || null
  });

  if (error) {
    console.error("Error recording customer payment:", error);
    throw error;
  }
  return payment;
}

export async function recordSupplierPayment(shopId: string, data: { supplierId: string, amount: number, method: string, notes?: string }, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: payment, error } = await supabase.rpc('record_supplier_payment', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_supplier_id: data.supplierId,
    p_amount: data.amount,
    p_method: data.method,
    p_notes: data.notes || null
  });

  if (error) {
    console.error("Error recording supplier payment:", error);
    throw error;
  }
  return payment;
}

export async function getPayments(shopId: string, options: { type?: 'CUSTOMER' | 'SUPPLIER', dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('payments')
      .select('*, customer:customers(id, name, mobile), supplier:suppliers(id, name, company)', { count: 'exact' })
      .eq('shop_id', shopId);
    
    if (options.type === 'CUSTOMER') query = query.not('customer_id', 'is', null);
    if (options.type === 'SUPPLIER') query = query.not('supplier_id', 'is', null);
    if (options.dateFrom) query = query.gte('payment_date', options.dateFrom);
    if (options.dateTo) query = query.lte('payment_date', options.dateTo);
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Supabase error fetching payments:", error);
      return { payments: [], total: 0 };
    }
    
    return { payments: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load payments:", error);
    return { payments: [], total: 0 };
  }
}

export async function getTodayPaymentTotals(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('payments')
      .select('payment_type, amount')
      .eq('shop_id', shopId)
      .gte('created_at', today.toISOString());

    if (error || !data) return { collected: 0, paid: 0 };

    let collected = 0;
    let paid = 0;

    for (const p of data) {
      const amt = Number(p.amount || 0);
      if (p.payment_type === 'CUSTOMER_PAYMENT' || p.payment_type === 'SALE') {
        collected += amt;
      } else if (p.payment_type === 'SUPPLIER_PAYMENT' || p.payment_type === 'PURCHASE') {
        paid += amt;
      }
    }

    return { collected, paid };
  } catch (error) {
    console.error("Failed to fetch today payment totals:", error);
    return { collected: 0, paid: 0 };
  }
}
