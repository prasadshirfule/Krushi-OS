import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SaleInput } from '@/lib/validations';

export async function completeSale(shopId: string, data: SaleInput, userId: string) {
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

export async function getSales(shopId: string, options: { search?: string, customerId?: string, status?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('sales')
      .select('*, customer:customers(id, name, mobile), items:sale_items(*)', { count: 'exact' })
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
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('sales')
      .select('*, customer:customers(*), items:sale_items(*)')
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
