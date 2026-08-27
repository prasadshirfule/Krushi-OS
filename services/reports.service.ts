import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getSalesReport(shopId: string, params: { period?: string, dateFrom?: string, dateTo?: string, groupBy?: string }) {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('sales').select('*, sale_items(*, products(*))').eq('shop_id', shopId);

  if (params.dateFrom) query = query.gte('sale_date', params.dateFrom);
  if (params.dateTo) query = query.lte('sale_date', params.dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const sales = data || [];
  const totalRevenue = sales.reduce((acc, s) => acc + (s.grand_total || 0), 0);
  const totalTax = sales.reduce((acc, s) => acc + (s.total_tax || 0), 0);

  return { sales, totalRevenue, totalTax, totalCount: sales.length };
}

export async function getInventoryReport(shopId: string, params: { type?: 'current' | 'low' | 'expired' | 'expiring' }) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('products').select('*, product_batches(*)').eq('shop_id', shopId);
  if (error) throw error;

  return { products: data || [] };
}

export async function getFinancialReport(shopId: string, params: { dateFrom?: string, dateTo?: string }) {
  const supabase = await createServerSupabaseClient();
  const sales = await getSalesReport(shopId, params);
  const { data: expenses } = await supabase.from('expenses').select('*').eq('shop_id', shopId);

  const totalExpenses = (expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0);
  const grossProfit = sales.totalRevenue;
  const netProfit = grossProfit - totalExpenses;

  return { revenue: sales.totalRevenue, totalExpenses, grossProfit, netProfit };
}

export async function getCustomerReport(shopId: string, params: { customerId?: string, dateFrom?: string, dateTo?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId);
  if (error) throw error;
  return { customers: data || [] };
}

export async function getSupplierReport(shopId: string, params: { supplierId?: string, dateFrom?: string, dateTo?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId);
  if (error) throw error;
  return { suppliers: data || [] };
}

export async function exportReport(shopId: string, params: any) {
  return { success: true, downloadUrl: '' };
}
