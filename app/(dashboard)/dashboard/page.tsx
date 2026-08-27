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
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard | KRUSHI OS',
};

function ChartSkeleton() {
  return (
    <Card className="h-[350px] animate-pulse bg-muted/20 flex items-center justify-center">
      <CardContent className="text-sm text-muted-foreground">Loading sales chart...</CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <Card className="h-[350px] animate-pulse bg-muted/20 flex items-center justify-center">
      <CardContent className="text-sm text-muted-foreground">Loading widget...</CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true';
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const effectiveUser = user || { id: 'demo-admin-id', email: 'admin@krushios.com' };

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
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 90);

    const [stats, expRes, lowRes, actRes] = await Promise.all([
      getDashboardStats(shopId),
      (!isPlaceholder && user)
        ? supabase.from('product_batches').select('*, product:products(*)').eq('shop_id', shopId).gt('quantity_available', 0).lte('expiry_date', targetDate.toISOString().split('T')[0]).order('expiry_date', { ascending: true }).limit(5)
        : Promise.resolve({ data: [] }),
      (!isPlaceholder && user)
        ? supabase.from('products').select('*').eq('shop_id', shopId).eq('is_active', true).order('current_stock', { ascending: true }).limit(10)
        : Promise.resolve({ data: [] }),
      (!isPlaceholder && user)
        ? supabase.from('audit_logs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [] })
    ]);

    const expiringBatches = expRes.data || [];
    const lowStockProducts = ((lowRes.data || []) as any[]).filter((p: any) => p.current_stock <= (p.min_stock || 5)).slice(0, 5);
    const activities = actRes.data || [];

    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        
        <StatsCards stats={stats as any} />
        
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4">
            <Suspense fallback={<ChartSkeleton />}>
              <SalesChart data={stats.salesChart as any} />
            </Suspense>
          </div>
          <div className="lg:col-span-3">
            <Suspense fallback={<ListSkeleton />}>
              <TopProducts products={stats.topProducts as any} />
            </Suspense>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          <div className="lg:col-span-4">
            <Suspense fallback={<ListSkeleton />}>
              <RecentSales sales={stats.recentSales as any} />
            </Suspense>
          </div>
          <div className="lg:col-span-3">
            <Suspense fallback={<ListSkeleton />}>
              <AlertsPanel 
                lowStockProducts={lowStockProducts || []} 
                expiringBatches={expiringBatches || []} 
              />
            </Suspense>
          </div>
        </div>

        <div className="grid grid-cols-1">
          <Suspense fallback={<ListSkeleton />}>
            <ActivityFeed activities={activities || []} />
          </Suspense>
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
