import { getCustomers, getCustomerSummary } from '@/services/customers.service';
import { CustomerTable } from '@/components/customers/customer-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customers | KRUSHI OS',
};

export default async function CustomersPage() {
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

  const [{ customers }, summary] = await Promise.all([
    getCustomers(shopId, { limit: 50 }),
    getCustomerSummary(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Link href="/customers/new">
          <Button>Add Customer</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Customers</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.totalCustomers}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Active Customers</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {summary.activeCustomers}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Outstanding Credit</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(summary.totalOutstandingCredit)}
          </div>
        </div>
      </div>

      <CustomerTable initialData={customers} />
    </div>
  );
}
