import { getSalesReport, getInventoryReport, getFinancialReport, getCustomerReport, getSupplierReport } from "@/services/reports.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesReport } from "@/components/reports/sales-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { FinancialReport } from "@/components/reports/financial-report";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: 'Reports | KRUSHI OS',
};

export default async function ReportsPage() {
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

    if (userData?.shop_id) {
      shopId = userData.shop_id;
    }
  }

  const [salesReport, inventoryReport, financialReport, customerReport, supplierReport] = await Promise.all([
    getSalesReport(shopId, {}),
    getInventoryReport(shopId),
    getFinancialReport(shopId, {}),
    getCustomerReport(shopId),
    getSupplierReport(shopId)
  ]);

  const customerColumns = [
    { accessorKey: "name", header: "Customer Name" },
    { accessorKey: "mobile", header: "Mobile" },
    { accessorKey: "village", header: "Village" },
    { 
      accessorKey: "total_purchases", 
      header: "Total Purchases", 
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || 0)) 
    },
    { 
      accessorKey: "outstanding", 
      header: "Outstanding", 
      cell: ({ row }: any) => (
        <span className={Number(row.original.outstanding || 0) > 0 ? "text-red-600 font-bold" : ""}>
          {formatCurrency(Number(row.original.outstanding || 0))}
        </span>
      ) 
    }
  ];

  const supplierColumns = [
    { accessorKey: "name", header: "Supplier Name" },
    { accessorKey: "company", header: "Company" },
    { accessorKey: "mobile", header: "Mobile" },
    { 
      accessorKey: "total_purchases", 
      header: "Total Purchases", 
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || 0)) 
    },
    { 
      accessorKey: "outstanding", 
      header: "Outstanding Payable", 
      cell: ({ row }: any) => (
        <span className={Number(row.original.outstanding || 0) > 0 ? "text-red-600 font-bold" : ""}>
          {formatCurrency(Number(row.original.outstanding || 0))}
        </span>
      ) 
    }
  ];

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
          {customerReport.customers.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
              No customer records for reporting.
            </div>
          ) : (
            <DataTable columns={customerColumns} data={customerReport.customers} searchKey="name" />
          )}
        </TabsContent>
        <TabsContent value="supplier">
          {supplierReport.suppliers.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
              No supplier records for reporting.
            </div>
          ) : (
            <DataTable columns={supplierColumns} data={supplierReport.suppliers} searchKey="name" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
