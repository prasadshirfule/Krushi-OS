import { getSalesReport, getInventoryReport, getFinancialReport, getCustomerReport, getSupplierReport } from "@/services/reports.service";
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

  const [salesReport, inventoryReport, financialReport, customerReport, supplierReport, shopProfile] = await Promise.all([
    getSalesReport(shopId, {}),
    getInventoryReport(shopId),
    getFinancialReport(shopId, {}),
    getCustomerReport(shopId),
    getSupplierReport(shopId),
    getShopProfile(shopId)
  ]);

  return (
    <div className="p-6">
      <ReportsContainer
        initialSales={salesReport}
        initialInventory={inventoryReport}
        initialFinancial={financialReport}
        initialCustomer={customerReport}
        initialSupplier={supplierReport}
        shopProfile={shopProfile}
      />
    </div>
  );
}
