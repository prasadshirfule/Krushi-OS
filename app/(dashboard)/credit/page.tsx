import { getCreditCustomers, getCreditSummary } from '@/services/customers.service';
import { CreditTable } from '@/components/credit/credit-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { getAuthAndPermissions } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Credit (Udhar) Management | KRUSHI OS',
};

export default async function CreditPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [{ customers }, summary] = await Promise.all([
    getCreditCustomers(shopId, { limit: 100 }),
    getCreditSummary(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit (Udhar) Overview</h1>
          <p className="text-sm text-muted-foreground">Track farmer credit balances, ledgers, and collect outstanding repayments</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/customers/new">
            <Button variant="outline">New Customer</Button>
          </Link>
          <Link href="/billing">
            <Button className="bg-green-600 hover:bg-green-700">New Bill</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Outstanding Credit</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(summary.totalOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Pending payments from farmers</p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Farmers with Active Credit</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.customersWithCredit}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Customers with non-zero balance</p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Overdue / High Balance</h3>
          <div className="text-3xl font-bold text-amber-600 mt-2">
            {formatCurrency(summary.overdueAmount)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Balances exceeding credit limit threshold</p>
        </div>
      </div>

      <CreditTable initialCustomers={customers} />
    </div>
  );
}
