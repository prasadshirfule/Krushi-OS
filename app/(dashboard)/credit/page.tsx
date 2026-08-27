import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

export default async function CreditPage() {
  const columns = [
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'mobile', header: 'Mobile' },
    { accessorKey: 'village', header: 'Village' },
    { accessorKey: 'outstanding', header: 'Outstanding (₹)', cell: ({ row }: any) => <span className="text-red-500 font-bold">{row.original.outstanding}</span> },
    { accessorKey: 'lastPurchaseDate', header: 'Last Purchase Date' },
    { accessorKey: 'lastPaymentDate', header: 'Last Payment Date' },
    { id: 'actions', cell: () => (
      <div className="space-x-2">
        <Button variant="outline" size="sm">View Ledger</Button>
        <Button size="sm">Collect Payment</Button>
      </div>
    )}
  ];

  const dummyData = [
    { id: '1', customerName: 'Ramesh Patel', mobile: '9876543210', village: 'Rampur', outstanding: 12000, lastPurchaseDate: '2023-10-20', lastPaymentDate: '2023-10-15' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Credit (Udhar) Overview</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 pb-2"><h3 className="text-sm font-medium">Total Outstanding</h3></div>
          <div className="p-6 pt-0"><div className="text-2xl font-bold text-red-500">₹45,000</div></div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 pb-2"><h3 className="text-sm font-medium">Customers with Credit</h3></div>
          <div className="p-6 pt-0"><div className="text-2xl font-bold">12</div></div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 pb-2"><h3 className="text-sm font-medium">Overdue Amount</h3></div>
          <div className="p-6 pt-0"><div className="text-2xl font-bold text-red-600">₹15,000</div></div>
        </div>
      </div>
      <DataTable columns={columns} data={dummyData} />
    </div>
  );
}
