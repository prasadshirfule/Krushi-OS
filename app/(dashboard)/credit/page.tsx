import { getCreditCustomers, getCustomerSummary } from '@/services/customers.service';
import { getSupplierSummary } from '@/services/suppliers.service';
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

  const [{ customers }, custSummary, suppSummary] = await Promise.all([
    getCreditCustomers(shopId, { limit: 100 }),
    getCustomerSummary(shopId),
    getSupplierSummary(shopId)
  ]);

  const totalUsers = (custSummary.totalCustomers || 0) + (suppSummary.totalSuppliers || 0);
  const incomingOutstanding = (custSummary.incomingOutstanding !== undefined ? custSummary.incomingOutstanding : custSummary.totalOutstandingCredit || 0) + (suppSummary.incomingOutstanding || 0);
  const outgoingOutstanding = (suppSummary.outgoingOutstanding !== undefined ? suppSummary.outgoingOutstanding : suppSummary.totalOutstanding || 0) + (custSummary.outgoingOutstanding || 0);

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
          <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
          <div className="text-3xl font-bold mt-2">
            {totalUsers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {custSummary.totalCustomers || 0} Customers • {suppSummary.totalSuppliers || 0} Suppliers
          </p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Incoming Outstanding</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(incomingOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total receivables from customers & suppliers</p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Outgoing Outstanding</h3>
          <div className="text-3xl font-bold text-emerald-600 mt-2">
            {formatCurrency(outgoingOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total payables to suppliers & customers</p>
        </div>
      </div>

      <CreditTable initialCustomers={customers} />
    </div>
  );
}
