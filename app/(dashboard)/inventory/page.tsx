import { getInventoryOverview } from "@/services/inventory.service";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { formatCurrency } from "@/lib/utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inventory Overview | KRUSHI OS',
};

export default async function InventoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

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

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Overview</h2>
          <p className="text-sm text-muted-foreground">Monitor stock balances, valuation, and low stock thresholds</p>
        </div>
        <Link href="/products/new">
          <Button className="bg-primary">Add Product</Button>
        </Link>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Inventory Value</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(summary.totalValue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Valuation at purchase price</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Tracked Products</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.totalItems}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Active inventory items</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Low Stock Alert</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {summary.lowStockCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Items at or below min threshold</p>
        </div>
      </div>

      <InventoryTable initialItems={items} />
    </div>
  );
}
