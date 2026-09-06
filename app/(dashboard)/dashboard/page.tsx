import { getAuthAndPermissions } from '@/lib/auth-helper';
import { getDashboardStats } from '@/services/dashboard.service';
import DashboardClientWrapper from '@/components/dashboard/dashboard-client-wrapper';

export const metadata = {
  title: 'Dashboard | KRUSHI OS',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function DashboardPage() {
  try {
    const user = await getAuthAndPermissions();
    const shopId = user.shop_id;
    const stats = await getDashboardStats(shopId);

    return (
      <DashboardClientWrapper
        initialStats={stats}
        initialLowStock={stats.lowStockProducts || []}
        initialExpiring={stats.expiringBatches || []}
        initialActivities={stats.activities || []}
      />
    );
  } catch (error) {
    console.error("Failed to load dashboard page stats:", error);
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
