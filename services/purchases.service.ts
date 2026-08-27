import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PurchaseInput } from '@/lib/validations';

export async function completePurchase(shopId: string, data: PurchaseInput, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: purchase, error } = await supabase.rpc('process_purchase', {
    p_shop_id: shopId,
    p_user_id: userId,
    p_supplier_id: data.supplier_id,
    p_invoice_number: data.invoice_number,
    p_purchase_date: data.purchase_date.toISOString(),
    p_items: data.items,
    p_notes: data.notes
  });

  if (error) throw new Error(`Failed to complete purchase: ${error.message}`);
  return purchase;
}

export async function getPurchases(shopId: string, options: { search?: string, supplierId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  const supabase = await createServerSupabaseClient();
  const page = options.page || 1;
  const limit = options.limit || 10;
  const offset = (page - 1) * limit;

  let query = supabase.from('purchases').select('*, supplier:suppliers(*), items:purchase_items(*)', { count: 'exact' }).eq('shop_id', shopId);
  
  if (options.supplierId) query = query.eq('supplier_id', options.supplierId);
  if (options.dateFrom) query = query.gte('purchase_date', options.dateFrom);
  if (options.dateTo) query = query.lte('purchase_date', options.dateTo);
  if (options.search) query = query.ilike('invoice_number', `%${options.search}%`);
  
  query = query.order('created_at', { ascending: false });

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  
  return { purchases: data, total: count || 0 };
}

export async function getPurchaseById(shopId: string, purchaseId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('purchases').select('*, supplier:suppliers(*), items:purchase_items(*, product:products(*))').eq('shop_id', shopId).eq('id', purchaseId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
