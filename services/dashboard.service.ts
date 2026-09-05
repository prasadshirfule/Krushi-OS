import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTodaySales, getSalesChart, isPlaceholderMode, getDemoSales } from './sales.service';
import { getStoredDemoProducts, getStoredDemoCustomers } from '@/lib/demo-storage';
import {
  calculateTodaySales,
  calculateTotalBills,
  calculateTotalOutstanding,
  calculateLowStock,
  calculateExpiringBatches,
  calculateTopSellingProducts,
  calculateSalesChart,
  calculateRecentSales,
  getISTDateString,
} from './dashboard-data.service';

export async function getDashboardStats(shopId: string) {
  // Demo / Placeholder mode fallback
  if (isPlaceholderMode()) {
    try {
      const sales = getDemoSales();
      const products = getStoredDemoProducts((p: any) => p);
      const customers = getStoredDemoCustomers((c: any) => c);

      const todayStats = calculateTodaySales(sales, products);
      const totalBills = calculateTotalBills(sales);
      const totalOutstanding = calculateTotalOutstanding(customers);
      const lowStock = calculateLowStock(products);
      const expiring = calculateExpiringBatches(products, 30);
      const topProducts = calculateTopSellingProducts(sales, 5);
      const salesChart = calculateSalesChart(sales, 90);
      const recentSales = calculateRecentSales(sales, 10);

      return {
        todaySales: todayStats,
        totalBills,
        totalOutstanding,
        totalPayable: 0,
        lowStockCount: lowStock.count,
        expiringCount: expiring.count,
        recentSales,
        topProducts,
        salesChart,
      };
    } catch (err) {
      console.error("Error generating placeholder dashboard stats:", err);
    }
  }

  // Real Supabase mode
  try {
    const supabase = await createServerSupabaseClient();
    
    // Execute queries with graceful fallbacks
    const [
      todaySalesRes,
      custRes,
      supRes,
      recentSalesRes,
      salesCountRes,
      salesChartRes,
    ] = await Promise.allSettled([
      getTodaySales(shopId),
      supabase.from('customers').select('outstanding').eq('shop_id', shopId),
      supabase.from('suppliers').select('outstanding').eq('shop_id', shopId),
      supabase.from('sales').select('*, customer:customers(id, name, mobile)').eq('shop_id', shopId).neq('status', 'CANCELLED').order('created_at', { ascending: false }).limit(10),
      supabase.from('sales').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).neq('status', 'CANCELLED'),
      getSalesChart(shopId, 'daily'),
    ]);

    const todaySales = todaySalesRes.status === 'fulfilled' ? todaySalesRes.value : { count: 0, total: 0, profit: 0 };
    const custData = (custRes.status === 'fulfilled' && custRes.value.data) ? custRes.value.data : [];
    const supData = (supRes.status === 'fulfilled' && supRes.value.data) ? supRes.value.data : [];
    const recentSales = (recentSalesRes.status === 'fulfilled' && recentSalesRes.value.data) ? recentSalesRes.value.data : [];
    const totalBills = salesCountRes.status === 'fulfilled' ? (salesCountRes.value.count || 0) : 0;
    const salesChart = salesChartRes.status === 'fulfilled' ? (salesChartRes.value || []) : [];

    const totalOutstanding = custData.reduce((acc: number, curr: any) => acc + Math.max(0, Number(curr.outstanding || 0)), 0);
    const totalPayable = supData.reduce((acc: number, curr: any) => acc + Math.max(0, Number(curr.outstanding || 0)), 0);

    // Try RPC for counts with table-query fallback
    let lowStockCount = 0;
    let expiringCount = 0;
    try {
      const { data: counts } = await supabase.rpc('get_dashboard_counts', { p_shop_id: shopId });
      if (counts) {
        lowStockCount = counts.low_stock_count || 0;
        expiringCount = counts.expiring_count || 0;
      } else {
        throw new Error("RPC returned no data");
      }
    } catch {
      // Fallback: Query products & batches directly
      const [prodRes, batchRes] = await Promise.allSettled([
        supabase.from('products').select('current_stock, min_stock').eq('shop_id', shopId).eq('is_active', true),
        supabase.from('product_batches').select('expiry_date, quantity_available').eq('shop_id', shopId).gt('quantity_available', 0),
      ]);

      if (prodRes.status === 'fulfilled' && prodRes.value.data) {
        lowStockCount = prodRes.value.data.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5)).length;
      }

      if (batchRes.status === 'fulfilled' && batchRes.value.data) {
        const todayStr = getISTDateString();
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        const maxStr = getISTDateString(maxDate);
        expiringCount = batchRes.value.data.filter((b: any) => {
          const exp = getISTDateString(b.expiry_date);
          return exp && exp >= todayStr && exp <= maxStr;
        }).length;
      }
    }

    // Try RPC for top products with table-query fallback
    let topProducts: any[] = [];
    try {
      const { data: topRes } = await supabase.rpc('get_top_products', { p_shop_id: shopId, p_limit: 5 });
      if (topRes && topRes.length > 0) {
        topProducts = topRes;
      } else {
        throw new Error("RPC returned no data");
      }
    } catch {
      // Fallback: Query sale_items directly
      try {
        const { data: saleItems } = await supabase
          .from('sale_items')
          .select('product_name, quantity, total_amount')
          .limit(100);

        if (saleItems && saleItems.length > 0) {
          topProducts = calculateTopSellingProducts([{ items: saleItems }], 5);
        }
      } catch {}
    }

    return {
      todaySales,
      totalBills,
      totalOutstanding,
      totalPayable,
      lowStockCount,
      expiringCount,
      recentSales,
      topProducts,
      salesChart,
    };
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
    return {
      todaySales: { count: 0, total: 0, profit: 0 },
      totalBills: 0,
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
