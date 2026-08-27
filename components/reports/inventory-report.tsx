"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function InventoryReport({ data }: { data?: { products: any[], totalValue: number, lowStockCount: number } }) {
  const products = data?.products || [];
  const lowStock = products.filter(p => Number(p.current_stock || 0) <= Number(p.min_stock || 5));

  const columns = [
    { accessorKey: "name", header: "Product Name" },
    { accessorKey: "sku", header: "SKU", cell: ({ row }: any) => row.original.sku || 'N/A' },
    { 
      accessorKey: "current_stock", 
      header: "Stock Level",
      cell: ({ row }: any) => (
        <span className="font-bold">{row.original.current_stock} {row.original.unit || 'Piece'}</span>
      )
    },
    {
      accessorKey: "purchase_price",
      header: "Purchase Cost",
      cell: ({ row }: any) => formatCurrency(Number(row.original.purchase_price || 0))
    },
    {
      accessorKey: "value",
      header: "Inventory Value",
      cell: ({ row }: any) => formatCurrency(Number(row.original.current_stock || 0) * Number(row.original.purchase_price || 0))
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const isLow = Number(row.original.current_stock || 0) <= Number(row.original.min_stock || 5);
        return <Badge variant={isLow ? "destructive" : "default"}>{isLow ? 'Low Stock' : 'In Stock'}</Badge>;
      }
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-2">
        <div className="p-4 border rounded-md bg-card flex-1">
          <div className="text-sm font-medium text-muted-foreground">Total Inventory Value</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data?.totalValue || 0)}</div>
        </div>
        <div className="p-4 border rounded-md bg-card flex-1">
          <div className="text-sm font-medium text-muted-foreground">Low Stock Count</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{data?.lowStockCount || 0}</div>
        </div>
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Stock ({products.length})</TabsTrigger>
          <TabsTrigger value="low">Low Stock ({lowStock.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          {products.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">No inventory records.</div>
          ) : (
            <DataTable columns={columns} data={products} searchKey="name" />
          )}
        </TabsContent>
        <TabsContent value="low">
          {lowStock.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">No low stock items.</div>
          ) : (
            <DataTable columns={columns} data={lowStock} searchKey="name" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
