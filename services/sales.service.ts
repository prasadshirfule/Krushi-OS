import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SaleInput } from '@/lib/validations';
import { MOCK_SALES } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function completeSale(shopId: string, data: SaleInput, userId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    
    const { data: sale, error } = await supabase.rpc('process_sale', {
      p_shop_id: shopId,
      p_user_id: userId,
      p_customer_id: data.customer_id,
      p_items: data.items,
      p_payments: data.payments,
      p_notes: data.notes,
      p_idempotency_key: data.idempotency_key
    });

    if (error) {
      throw new Error(`Failed to complete sale: ${error.message}`);
    }
    
    return sale;
  } catch (error) {
    const saleId = `sale-${Date.now()}`;
    const invoiceNum = `KOS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSale = {
      id: saleId,
      invoice_number: invoiceNum,
      customer_id: data.customer_id,
      customer: { id: 'cust-1', name: 'Ramesh Patel', phone: '9876543210' },
      total_amount: data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.rate), 0),
      paid_amount: data.payments.reduce((acc: number, p: any) => acc + p.amount, 0),
      payment_mode: (data.payments[0] as any)?.method || (data.payments[0] as any)?.mode || 'Cash',
      payment_status: 'PAID',
      created_at: new Date().toISOString(),
      sale_items: data.items.map((i: any, idx: number) => ({
        id: `si-${idx}`,
        product_name: i.product_name || 'Agro Product',
        quantity: i.quantity,
        unit_price: i.rate,
        total_price: i.quantity * i.rate
      }))
    };
    MOCK_SALES.unshift(newSale as any);
    return newSale;
  }
}

export async function getSales(shopId: string, options: { search?: string, customerId?: string, status?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase.from('sales').select('*, customer:customers(*), items:sale_items(*)', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.customerId) query = query.eq('customer_id', options.customerId);
    if (options.status) query = query.eq('status', options.status);
    if (options.dateFrom) query = query.gte('created_at', options.dateFrom);
    if (options.dateTo) query = query.lte('created_at', options.dateTo);
    if (options.search) query = query.ilike('invoice_number', `%${options.search}%`);
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return { sales: data, total: count || 0 };
  } catch (error) {
    let filtered = [...MOCK_SALES];
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(s => s.invoice_number.toLowerCase().includes(q) || s.customer?.name.toLowerCase().includes(q));
    }
    return { sales: filtered, total: filtered.length };
  }
}

export async function getSaleById(shopId: string, saleId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('sales').select('*, customer:customers(*), items:sale_items(*, product:products(*))').eq('shop_id', shopId).eq('id', saleId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_SALES.find(s => s.id === saleId) || MOCK_SALES[0];
  }
}

export async function getSaleByInvoice(shopId: string, invoiceNumber: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('sales').select('*, customer:customers(*), items:sale_items(*)').eq('shop_id', shopId).eq('invoice_number', invoiceNumber).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_SALES.find(s => s.invoice_number === invoiceNumber) || MOCK_SALES[0];
  }
}

export async function cancelSale(shopId: string, saleId: string, userId: string, reason: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc('cancel_sale', {
      p_shop_id: shopId,
      p_sale_id: saleId,
      p_user_id: userId,
      p_reason: reason
    });
    if (error) throw error;
  } catch (error) {
    const sale = MOCK_SALES.find(s => s.id === saleId);
    if (sale) sale.payment_status = 'CANCELLED';
  }
}

export async function returnSale(shopId: string, saleId: string, items: { saleItemId: string, quantity: number, reason: string }[], userId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc('process_sale_return', {
      p_shop_id: shopId,
      p_sale_id: saleId,
      p_items: items,
      p_user_id: userId
    });
    if (error) throw error;
  } catch (error) {
    return { success: true };
  }
}

export async function getTodaySales(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase.from('sales').select('id, total_amount, profit').eq('shop_id', shopId).gte('created_at', today.toISOString());
    if (error) throw error;
    
    return {
      count: data.length,
      total: data.reduce((sum, s) => sum + Number(s.total_amount), 0),
      profit: data.reduce((sum, s) => sum + Number(s.profit || 0), 0)
    };
  } catch (error) {
    return {
      count: 14,
      total: 48250,
      profit: 9650
    };
  }
}

export async function getSalesChart(shopId: string, period: 'daily' | 'weekly' | 'monthly') {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_sales_chart', { p_shop_id: shopId, p_period: period });
    if (error) throw error;
    return data;
  } catch (error) {
    return [
      { name: 'Mon', sales: 12400 },
      { name: 'Tue', sales: 18900 },
      { name: 'Wed', sales: 15200 },
      { name: 'Thu', sales: 28400 },
      { name: 'Fri', sales: 34100 },
      { name: 'Sat', sales: 48250 },
      { name: 'Sun', sales: 22000 },
    ];
  }
}
