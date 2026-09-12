import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSales, isPlaceholderMode, getDemoSales } from './sales.service';
import { getStoredDemoProducts, getStoredDemoCustomers } from '@/lib/demo-storage';
import {
  calculateTodaySales,
  calculateTotalBills,
  calculateTotalOutstanding,
  calculateTodayOutstanding,
  calculateLowStock,
  calculateExpiringBatches,
  calculateTopSellingProducts,
  calculateSalesChart,
  calculateRecentSales,
  calculateRecentActivities,
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
      const todayOutstandingData = calculateTodayOutstanding(sales);
      const totalBills = calculateTotalBills(sales);
      const totalOutstanding = calculateTotalOutstanding(customers);
      const lowStock = calculateLowStock(products);
      const expiring = calculateExpiringBatches(products, 30);
      const topProducts = calculateTopSellingProducts(sales, 5);
      const salesChart = calculateSalesChart(sales, 90);
      const recentSales = calculateRecentSales(sales, 10);
      const activities = calculateRecentActivities(sales, customers, products, 15);

      return {
        todaySales: todayStats,
        todayOutstanding: todayOutstandingData.total,
        todayOutstandingCount: todayOutstandingData.count,
        totalBills,
        totalOutstanding,
        totalPayable: 0,
        lowStockCount: lowStock.count,
        expiringCount: expiring.count,
        recentSales,
        topProducts,
        salesChart,
        lowStockProducts: lowStock.products,
        expiringBatches: expiring.batches,
        activities,
      };
    } catch (err) {
      console.error("Error generating placeholder dashboard stats:", err);
    }
  }

  // Real Supabase mode — authoritative unified queries
  try {
    const supabase = await createServerSupabaseClient();
    
    // Fetch all unified real data for this shop in parallel
    const [
      salesRes,
      prodRes,
      batchRes,
      custRes,
      supRes,
      auditRes,
    ] = await Promise.allSettled([
      getSales(shopId, { limit: 1000 }),
      supabase.from('products').select('*').eq('shop_id', shopId).eq('is_active', true),
      supabase.from('product_batches').select('*, product:products(*)').eq('shop_id', shopId).gt('quantity_available', 0),
      supabase.from('customers').select('*').eq('shop_id', shopId),
      supabase.from('suppliers').select('outstanding').eq('shop_id', shopId),
      supabase.from('audit_logs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20),
    ]);

    const sales = salesRes.status === 'fulfilled' ? (salesRes.value.sales || []) : [];
    const products = (prodRes.status === 'fulfilled' && prodRes.value.data) ? prodRes.value.data : [];
    const batches = (batchRes.status === 'fulfilled' && batchRes.value.data) ? batchRes.value.data : [];
    const customers = (custRes.status === 'fulfilled' && custRes.value.data) ? custRes.value.data : [];
    const suppliers = (supRes.status === 'fulfilled' && supRes.value.data) ? supRes.value.data : [];
    const rawActivities = (auditRes.status === 'fulfilled' && auditRes.value.data) ? auditRes.value.data : [];

    // Attach batches to products for expiring batches calculation
    const productsWithBatches = products.map((p: any) => ({
      ...p,
      batches: batches.filter((b: any) => b.product_id === p.id),
    }));

    // Authoritative calculations using India Standard Time and real sales data
    const todaySales = calculateTodaySales(sales, products);
    const todayOutstandingData = calculateTodayOutstanding(sales);
    const totalBills = calculateTotalBills(sales);
    const totalOutstanding = calculateTotalOutstanding(customers);
    const totalPayable = calculateTotalOutstanding(suppliers);
    const lowStock = calculateLowStock(products);
    const expiring = calculateExpiringBatches(productsWithBatches, 30);
    const topProducts = calculateTopSellingProducts(sales, 5);
    const salesChart = calculateSalesChart(sales, 90);
    const recentSales = calculateRecentSales(sales, 10);
    const activities = rawActivities.length > 0 
      ? rawActivities 
      : calculateRecentActivities(sales, customers, products, 15);

    return {
      todaySales,
      todayOutstanding: todayOutstandingData.total,
      todayOutstandingCount: todayOutstandingData.count,
      totalBills,
      totalOutstanding,
      totalPayable,
      lowStockCount: lowStock.count,
      expiringCount: expiring.count,
      recentSales,
      topProducts,
      salesChart,
      lowStockProducts: lowStock.products,
      expiringBatches: expiring.batches,
      activities,
    };
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
    return {
      todaySales: { count: 0, total: 0, profit: 0 },
      todayOutstanding: 0,
      todayOutstandingCount: 0,
      totalBills: 0,
      totalOutstanding: 0,
      totalPayable: 0,
      lowStockCount: 0,
      expiringCount: 0,
      recentSales: [],
      topProducts: [],
      salesChart: [],
      lowStockProducts: [],
      expiringBatches: [],
      activities: [],
    };
  }
}
