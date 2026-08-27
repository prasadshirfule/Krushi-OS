import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function recordCustomerPayment(shopId: string, data: { customerId: string, amount: number, method: string, notes?: string }, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: payment, error } = await supabase.rpc('record_customer_payment', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_customer_id: data.customerId,
    p_amount: data.amount,
    p_method: data.method,
    p_notes: data.notes
  });

  if (error) throw error;
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
    p_notes: data.notes
  });

  if (error) throw error;
  return payment;
}

export async function getPayments(shopId: string, options: { type?: 'CUSTOMER' | 'SUPPLIER', dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  const supabase = await createServerSupabaseClient();
  const page = options.page || 1;
  const limit = options.limit || 10;
  const offset = (page - 1) * limit;

  let query = supabase.from('payments').select('*, customer:customers(*), supplier:suppliers(*)', { count: 'exact' }).eq('shop_id', shopId);
  
  if (options.type === 'CUSTOMER') query = query.not('customer_id', 'is', null);
  if (options.type === 'SUPPLIER') query = query.not('supplier_id', 'is', null);
  if (options.dateFrom) query = query.gte('created_at', options.dateFrom);
  if (options.dateTo) query = query.lte('created_at', options.dateTo);
  
  query = query.order('created_at', { ascending: false });

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  
  return { payments: data, total: count || 0 };
}
