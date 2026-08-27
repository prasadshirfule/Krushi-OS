import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTodaySales, getSalesChart } from './sales.service';

export async function getDashboardStats(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const todaySales = await getTodaySales(shopId);
    
    const { data: custData } = await supabase
      .from('customers')
      .select('outstanding')
      .eq('shop_id', shopId);

    const totalOutstanding = custData?.reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0) || 0;
    
    const { data: supData } = await supabase
      .from('suppliers')
      .select('outstanding')
      .eq('shop_id', shopId);

    const totalPayable = supData?.reduce((acc, curr) => acc + Number(curr.outstanding || 0), 0) || 0;

    const { data: recentSales } = await supabase
      .from('sales')
      .select('*, customer:customers(id, name, mobile)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const { data: counts } = await supabase.rpc('get_dashboard_counts', { p_shop_id: shopId });
    
    const salesChart = await getSalesChart(shopId, 'daily');
    const { data: topProducts } = await supabase.rpc('get_top_products', { p_shop_id: shopId, p_limit: 5 });

    return {
      todaySales,
      totalOutstanding,
      totalPayable,
      lowStockCount: counts?.low_stock_count || 0,
      expiringCount: counts?.expiring_count || 0,
      recentSales: recentSales || [],
      topProducts: topProducts || [],
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
