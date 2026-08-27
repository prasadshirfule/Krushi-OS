import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

export default async function InventoryPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Inventory Overview</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-4">
        {/* Summary cards would go here */}
      </div>

      <DataTable
        columns={[
          { accessorKey: "product.name", header: "Product" },
          { accessorKey: "total_stock", header: "Total Stock" },
          { accessorKey: "value", header: "Value" },
        ]}
        data={[]}
        searchKey="product.name"
      />
    </div>
  );
}
