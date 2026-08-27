import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTodaySales, getSalesChart } from './sales.service';

export async function getDashboardStats(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Execute all independent dashboard queries in parallel to eliminate waterfalls
    const [
      todaySales,
      custRes,
      supRes,
      recentSalesRes,
      countsRes,
      salesChart,
      topProductsRes
    ] = await Promise.all([
      getTodaySales(shopId),
      supabase.from('customers').select('outstanding').eq('shop_id', shopId),
      supabase.from('suppliers').select('outstanding').eq('shop_id', shopId),
      supabase.from('sales').select('*, customer:customers(id, name, mobile)').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(10),
      supabase.rpc('get_dashboard_counts', { p_shop_id: shopId }),
      getSalesChart(shopId, 'daily'),
      supabase.rpc('get_top_products', { p_shop_id: shopId, p_limit: 5 })
    ]);

    const custData = custRes.data || [];
    const supData = supRes.data || [];
    const recentSales = recentSalesRes.data || [];
    const counts = countsRes.data;
    const topProducts = topProductsRes.data || [];

    const totalOutstanding = custData.reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0);
    const totalPayable = supData.reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0);

    return {
      todaySales,
      totalOutstanding,
      totalPayable,
      lowStockCount: counts?.low_stock_count || 0,
      expiringCount: counts?.expiring_count || 0,
      recentSales,
      topProducts,
      salesChart: salesChart || []
    };
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
    return {
      todaySales: { count: 0, total: 0, profit: 0 },
      totalOutstanding: 0,
      totalPayable: 0,
      lowStockCount: 0,
      expiringCount: 0,
      recentSales: [],
      topProducts: [],
      salesChart: []
    };
  }
}
