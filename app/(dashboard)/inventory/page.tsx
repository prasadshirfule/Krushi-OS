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

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<{ filter?: string }> }) {
  const params = searchParams ? await searchParams : {};
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

  let { items, summary } = await getInventoryOverview(shopId);

  const activeFilter = params.filter;
  if (activeFilter === 'low-stock') {
    items = items.filter(i => i.is_low_stock);
  } else if (activeFilter === 'expiring') {
    items = items.filter(i => (i.batches || []).some((b: any) => {
      if (!b.expiry_date || Number(b.quantity_available || 0) <= 0) return false;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 90);
      return new Date(b.expiry_date) <= targetDate;
    }));
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Overview</h2>
          <p className="text-sm text-muted-foreground">Monitor stock balances, valuation, and low stock thresholds</p>
        </div>
        <div className="flex gap-2 items-center">
          {activeFilter && (
            <Link href="/inventory">
              <Button variant="outline" size="sm">
                Clear Filter ({activeFilter === 'low-stock' ? 'Low Stock' : 'Expiring'}) ✕
              </Button>
            </Link>
          )}
          <Link href="/products/new">
            <Button className="bg-primary">Add Product</Button>
          </Link>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/inventory" className="block">
          <div className={`rounded-xl border bg-card text-card-foreground shadow p-6 hover:bg-muted/40 transition-colors ${!activeFilter ? 'ring-2 ring-primary/20' : ''}`}>
            <h3 className="text-sm font-medium text-muted-foreground">Total Inventory Value</h3>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {formatCurrency(summary.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{summary.totalItems} active products</p>
          </div>
        </Link>
        <Link href="/inventory" className="block">
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6 hover:bg-muted/40 transition-colors">
            <h3 className="text-sm font-medium text-muted-foreground">Total Tracked Products</h3>
            <div className="text-3xl font-bold mt-2">
              {summary.totalItems}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active inventory items</p>
          </div>
        </Link>
        <Link href="/inventory?filter=low-stock" className="block">
          <div className={`rounded-xl border bg-card text-card-foreground shadow p-6 hover:bg-muted/40 transition-colors ${activeFilter === 'low-stock' ? 'ring-2 ring-red-500/50 bg-red-50/20' : ''}`}>
            <h3 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <span>Low Stock Alert</span>
              {activeFilter === 'low-stock' && <span className="text-xs text-red-600 font-semibold">● Filtered</span>}
            </h3>
            <div className="text-3xl font-bold text-red-600 mt-2">
              {summary.lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items at or below min threshold</p>
          </div>
        </Link>
      </div>

      <InventoryTable initialItems={items} />
    </div>
  );
}
