import { getSalesReport, getInventoryReport, getFinancialReport, getCustomerReport, getSupplierReport } from "@/services/reports.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport } from "@/components/reports/sales-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { FinancialReport } from "@/components/reports/financial-report";
import { CustomerReportTab } from "@/components/reports/customer-report-tab";
import { SupplierReportTab } from "@/components/reports/supplier-report-tab";
import { getAuthAndPermissions } from "@/lib/auth-helper";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reports | KRUSHI OS',
};

export default async function ReportsPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [salesReport, inventoryReport, financialReport, customerReport, supplierReport] = await Promise.all([
    getSalesReport(shopId, {}),
    getInventoryReport(shopId),
    getFinancialReport(shopId, {}),
    getCustomerReport(shopId),
    getSupplierReport(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Report</TabsTrigger>
          <TabsTrigger value="financial">Financial Report</TabsTrigger>
          <TabsTrigger value="customer">Customer Report</TabsTrigger>
          <TabsTrigger value="supplier">Supplier Report</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales">
          <SalesReport data={salesReport} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport data={inventoryReport as any} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialReport data={financialReport} />
        </TabsContent>
        <TabsContent value="customer">
          <CustomerReportTab customers={customerReport.customers} />
        </TabsContent>
        <TabsContent value="supplier">
          <SupplierReportTab suppliers={supplierReport.suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
