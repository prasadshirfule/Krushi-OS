import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDashboardStats } from '@/services/dashboard.service';
import StatsCards from '@/components/dashboard/stats-cards';
import SalesChart from '@/components/dashboard/sales-chart';
import RecentSales from '@/components/dashboard/recent-sales';
import AlertsPanel from '@/components/dashboard/alerts-panel';
import TopProducts from '@/components/dashboard/top-products';
import ActivityFeed from '@/components/dashboard/activity-feed';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const metadata = {
  title: 'Dashboard | KRUSHI OS',
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true';
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const effectiveUser = user || ((isDemo || isPlaceholder) ? { id: 'demo-admin-id', email: 'admin@krushios.com' } : null);

  if (!effectiveUser) {
    redirect('/login');
  }

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
    const stats = await getDashboardStats(shopId);

    let expiringBatches: any[] = [];
    let lowStockProducts: any[] = [];
    let activities: any[] = [];

    if (!isPlaceholder && user) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 90);

      const { data: exp } = await supabase
        .from('product_batches')
        .select('*, product:products(*)')
        .eq('shop_id', shopId)
        .gt('quantity_available', 0)
        .lte('expiry_date', targetDate.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(5);
      expiringBatches = exp || [];

      const { data: low } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('current_stock', { ascending: true })
        .limit(10);
      lowStockProducts = (low || []).filter((p: any) => p.current_stock <= (p.min_stock || 5)).slice(0, 5);

      const { data: act } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(20);
      activities = act || [];
    }

    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        
        <StatsCards stats={stats as any} />
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4">
            <SalesChart data={stats.salesChart as any} />
          </div>
          <div className="lg:col-span-3">
            <TopProducts products={stats.topProducts as any} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4">
            <RecentSales sales={stats.recentSales as any} />
          </div>
          <div className="lg:col-span-3">
            <AlertsPanel 
              lowStockProducts={lowStockProducts || []} 
              expiringBatches={expiringBatches || []} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1">
          <ActivityFeed activities={activities || []} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold tracking-tight text-red-600 mb-4">Error loading dashboard</h1>
        <p className="text-muted-foreground">Please try again later or contact support if the issue persists.</p>
      </div>
    );
  }
}
