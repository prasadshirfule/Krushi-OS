import { getInventoryOverview } from "@/services/inventory.service";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: 'Inventory Overview | KRUSHI OS',
};

export default async function InventoryPage() {
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

    if (userData?.shop_id) {
      shopId = userData.shop_id;
    }
  }

  const { items, summary } = await getInventoryOverview(shopId);

  const columns = [
    { 
      accessorKey: "name", 
      header: "Product Name",
      cell: ({ row }: any) => (
        <div>
          <div className="font-semibold text-foreground">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.category?.name || 'Uncategorized'}</div>
        </div>
      )
    },
    { 
      accessorKey: "sku", 
      header: "SKU",
      cell: ({ row }: any) => <span className="font-mono text-xs">{row.original.sku || 'N/A'}</span>
    },
    { 
      accessorKey: "total_stock", 
      header: "Current Stock",
      cell: ({ row }: any) => (
        <span className="font-bold">
          {row.original.total_stock} {row.original.unit}
        </span>
      )
    },
    { 
      accessorKey: "min_stock", 
      header: "Min Stock",
      cell: ({ row }: any) => <span>{row.original.min_stock} {row.original.unit}</span>
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }: any) => {
        const status = row.original.status;
        const variant = status === 'In Stock' ? 'default' : status === 'Low Stock' ? 'secondary' : 'destructive';
        return <Badge variant={variant}>{status}</Badge>;
      }
    },
    { 
      accessorKey: "inventory_value", 
      header: "Inventory Value",
      cell: ({ row }: any) => (
        <span className="font-semibold text-green-700">
          {formatCurrency(row.original.inventory_value)}
        </span>
      )
    },
    {
      accessorKey: "batches",
      header: "Active Batches",
      cell: ({ row }: any) => {
        const batchCount = (row.original.batches || []).filter((b: any) => b.quantity_available > 0).length;
        return <span className="text-xs text-muted-foreground">{batchCount} active batch(es)</span>;
      }
    }
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Inventory Overview</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Inventory Value</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(summary.totalValue)}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Products</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.totalItems}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Low Stock Alert</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {summary.lowStockCount}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No inventory products found. Add products to populate inventory tracking.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          searchKey="name"
          searchPlaceholder="Filter inventory products..."
        />
      )}
    </div>
  );
}
