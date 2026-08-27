import { Suspense } from 'react';
import { CustomerTable } from '@/components/customers/customer-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Link href="/customers/new">
          <Button>Add Customer</Button>
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Customers</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">120</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">95</div>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Outstanding Credit</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-500">₹45,000</div>
          </div>
        </div>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <CustomerTable />
      </Suspense>
    </div>
  );
}
