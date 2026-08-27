import { getPurchases, getPurchaseSummary } from '@/services/purchases.service';
import { PurchaseTable } from '@/components/purchases/purchase-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Purchases | KRUSHI OS',
};

export default async function PurchasesPage() {
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

  const [{ purchases }, summary] = await Promise.all([
    getPurchases(shopId, { limit: 50 }),
    getPurchaseSummary(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
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
