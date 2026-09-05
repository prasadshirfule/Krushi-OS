import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/services/dashboard.service';
import DashboardClientWrapper from '@/components/dashboard/dashboard-client-wrapper';
import { redirect } from 'next/navigation';
import { getISTDateString } from '@/services/dashboard-data.service';

export const metadata = {
  title: 'Dashboard | KRUSHI OS',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let shopId = 'demo-shop-1';
  if (user && !isPlaceholder) {
    const { data: userData } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (!userData?.shop_id) {
      redirect('/setup');
    }
    shopId = userData.shop_id;
  }

  try {
    const todayStr = getISTDateString();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const maxDateStr = getISTDateString(targetDate);

    const [stats, expRes, lowRes, actRes] = await Promise.allSettled([
      getDashboardStats(shopId),
      supabase
        .from('product_batches')
        .select('*, product:products(*)')
        .eq('shop_id', shopId)
        .gt('quantity_available', 0)
        .gte('expiry_date', todayStr)
        .lte('expiry_date', maxDateStr)
        .order('expiry_date', { ascending: true })
        .limit(10),
      supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('current_stock', { ascending: true })
        .limit(10),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);

    const dashboardStats = stats.status === 'fulfilled' ? stats.value : {
      todaySales: { count: 0, total: 0, profit: 0 },
      totalBills: 0,
      totalOutstanding: 0,
      totalPayable: 0,
      lowStockCount: 0,
      expiringCount: 0,
      recentSales: [],
      topProducts: [],
      salesChart: [],
    };

    const expiringBatches = (expRes.status === 'fulfilled' && expRes.value.data) ? expRes.value.data : [];
    const lowStockProducts = (lowRes.status === 'fulfilled' && lowRes.value.data)
      ? ((lowRes.value.data as any[]).filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5)).slice(0, 10))
      : [];
    const activities = (actRes.status === 'fulfilled' && actRes.value.data) ? actRes.value.data : [];

    return (
      <DashboardClientWrapper
        initialStats={dashboardStats}
        initialLowStock={lowStockProducts}
        initialExpiring={expiringBatches}
        initialActivities={activities}
      />
    );
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
    return (
      <DashboardClientWrapper
        initialStats={{
          todaySales: { count: 0, total: 0, profit: 0 },
          totalBills: 0,
          totalOutstanding: 0,
          totalPayable: 0,
          lowStockCount: 0,
          expiringCount: 0,
          recentSales: [],
          topProducts: [],
          salesChart: [],
        }}
        initialLowStock={[]}
        initialExpiring={[]}
        initialActivities={[]}
      />
    );
  }
}
