import { getPurchases, getPurchaseSummary } from '@/services/purchases.service';
import { PurchaseTable } from '@/components/purchases/purchase-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { getAuthAndPermissions } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Purchases | KRUSHI OS',
};

export default async function PurchasesPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [{ purchases }, summary] = await Promise.all([
    getPurchases(shopId, { limit: 50 }),
    getPurchaseSummary(shopId)
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-6 min-w-0 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
        <Link href="/purchases/new">
          <Button>New Purchase</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Purchases (This Month)</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(summary.totalMonthlyPurchases)}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Outstanding to Suppliers</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(summary.totalOutstandingPayable)}
          </div>
        </div>
      </div>

      <PurchaseTable initialData={purchases} />
    </div>
  );
}
