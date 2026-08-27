import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getSalesReport(shopId: string, params: { period?: string, dateFrom?: string, dateTo?: string } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from('sales')
      .select('*, customer:customers(name), sale_items(*, product:products(name))')
      .eq('shop_id', shopId)
      .eq('status', 'completed');

    if (params.dateFrom) query = query.gte('sale_date', params.dateFrom);
    if (params.dateTo) query = query.lte('sale_date', params.dateTo);

    query = query.order('sale_date', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching sales report:", error);
      return { sales: [], totalRevenue: 0, totalTax: 0, totalProfit: 0, avgBillValue: 0, totalCount: 0, chartData: [] };
    }

    const sales = data || [];
    const totalCount = sales.length;
    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
    const totalTax = sales.reduce((acc, s) => acc + Number(s.tax_amount || 0), 0);
    const totalProfit = sales.reduce((acc, s) => acc + Number(s.profit_amount || 0), 0);
    const avgBillValue = totalCount > 0 ? totalRevenue / totalCount : 0;

    // Group for chart
    const dateMap = new Map<string, { date: string, revenue: number, profit: number }>();
    for (const sale of sales) {
      const dateStr = new Date(sale.sale_date).toISOString().split('T')[0];
      const current = dateMap.get(dateStr) || { date: dateStr, revenue: 0, profit: 0 };
      current.revenue += Number(sale.total_amount || 0);
      current.profit += Number(sale.profit_amount || 0);
      dateMap.set(dateStr, current);
    }

    const chartData = Array.from(dateMap.values()).reverse();

    return { sales, totalRevenue, totalTax, totalProfit, avgBillValue, totalCount, chartData };
  } catch (error) {
    console.error("Failed to load sales report:", error);
    return { sales: [], totalRevenue: 0, totalTax: 0, totalProfit: 0, avgBillValue: 0, totalCount: 0, chartData: [] };
  }
}

export async function getInventoryReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), batches:product_batches(*)')
      .eq('shop_id', shopId);

    if (error) {
      console.error("Error fetching inventory report:", error);
      return { products: [], totalValue: 0, lowStockCount: 0 };
    }

    const products = data || [];
    const totalValue = products.reduce((acc, p) => acc + (Number(p.current_stock || 0) * Number(p.purchase_price || 0)), 0);
    const lowStockCount = products.filter(p => Number(p.current_stock || 0) <= Number(p.min_stock || 5)).length;

    return { products, totalValue, lowStockCount };
  } catch (error) {
    console.error("Failed to load inventory report:", error);
    return { products: [], totalValue: 0, lowStockCount: 0 };
  }
}

export async function getFinancialReport(shopId: string, params: { dateFrom?: string, dateTo?: string } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    let expenseQuery = supabase.from('expenses').select('amount').eq('shop_id', shopId);
    if (params.dateFrom) expenseQuery = expenseQuery.gte('date', params.dateFrom);
    if (params.dateTo) expenseQuery = expenseQuery.lte('date', params.dateTo);

    const [salesReport, expenseRes] = await Promise.all([
      getSalesReport(shopId, params),
      expenseQuery
    ]);

    const totalExpenses = (expenseRes.data || []).reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const grossProfit = salesReport.totalProfit;
    const netProfit = grossProfit - totalExpenses;

    return { 
      revenue: salesReport.totalRevenue, 
      totalExpenses, 
      grossProfit, 
      netProfit,
      salesCount: salesReport.totalCount
    };
  } catch (error) {
    console.error("Failed to load financial report:", error);
    return { revenue: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0, salesCount: 0 };
  }
}

export async function getCustomerReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_purchases', { ascending: false });

    if (error) {
      console.error("Error fetching customer report:", error);
      return { customers: [] };
    }
    return { customers: data || [] };
  } catch (error) {
    console.error("Failed to load customer report:", error);
    return { customers: [] };
  }
}

export async function getSupplierReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_purchases', { ascending: false });

    if (error) {
      console.error("Error fetching supplier report:", error);
      return { suppliers: [] };
    }
    return { suppliers: data || [] };
  } catch (error) {
    console.error("Failed to load supplier report:", error);
    return { suppliers: [] };
  }
}

export async function exportReport(shopId: string, params: any = {}) {
  return { success: true, downloadUrl: '' };
}
