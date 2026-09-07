import { getSalesReport } from "@/services/reports.service";
import { getShopProfile } from "@/services/settings.service";
import { getAuthAndPermissions } from "@/lib/auth-helper";
import { ReportsContainer } from "@/components/reports/reports-container";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reports | KRUSHI OS',
};

export default async function ReportsPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [salesReport, shopProfile] = await Promise.all([
    getSalesReport(shopId, {}),
    getShopProfile(shopId)
  ]);

  return (
    <div className="p-3 sm:p-4 md:p-6 w-full max-w-full overflow-hidden">
      <ReportsContainer
        initialSales={salesReport}
        shopProfile={shopProfile}
      />
    </div>
  );
}
