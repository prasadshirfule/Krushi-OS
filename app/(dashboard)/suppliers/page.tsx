import { getSuppliers, getSupplierSummary } from '@/services/suppliers.service';
import { SupplierTable } from '@/components/suppliers/supplier-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { getAuthAndPermissions } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Suppliers | KRUSHI OS',
};

export default async function SuppliersPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [{ suppliers }, summary] = await Promise.all([
    getSuppliers(shopId, { limit: 50 }),
    getSupplierSummary(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers & Distributors</h1>
          <p className="text-sm text-muted-foreground">Manage fertilizer, seed, and chemical suppliers and track payable balances</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="bg-primary">Add Supplier</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Suppliers</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.totalSuppliers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Registered product vendors</p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Active Suppliers</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {summary.activeSuppliers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Active vendor partnerships</p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Outstanding Payables</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(summary.totalOutstanding)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total pending payment to suppliers</p>
        </div>
      </div>

      <SupplierTable initialData={suppliers} />
    </div>
  );
}
