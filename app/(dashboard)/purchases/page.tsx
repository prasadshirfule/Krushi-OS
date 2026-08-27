import { Suspense } from 'react';
import { PurchaseTable } from '@/components/purchases/purchase-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function PurchasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
        <Link href="/purchases/new">
          <Button>New Purchase</Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Purchases (This Month)</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">₹2,50,000</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Outstanding to Suppliers</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-500">₹1,25,000</div>
          </div>
        </div>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <PurchaseTable />
      </Suspense>
    </div>
  );
}
