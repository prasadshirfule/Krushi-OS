import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

export default async function PaymentsPage() {
  const columns = [
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'type', header: 'Type', cell: ({ row }: any) => <Badge variant={row.original.type === 'In' ? 'default' : 'secondary'}>{row.original.type}</Badge> },
    { accessorKey: 'reference', header: 'Reference' },
    { accessorKey: 'party', header: 'Party' },
    { accessorKey: 'method', header: 'Method' },
    { accessorKey: 'amount', header: 'Amount (₹)' }
  ];

  const dummyData = [
    { id: '1', date: '2023-10-27', type: 'In', reference: 'PAY-001', party: 'Ramesh Patel', method: 'UPI', amount: 5000 },
    { id: '2', date: '2023-10-27', type: 'Out', reference: 'PAY-002', party: 'Agri Seeds Ltd', method: 'Bank Transfer', amount: 25000 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Payments Log</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 pb-2"><h3 className="text-sm font-medium">Total Collected Today</h3></div>
          <div className="p-6 pt-0"><div className="text-2xl font-bold text-green-500">₹15,000</div></div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="p-6 pb-2"><h3 className="text-sm font-medium">Total Paid Today</h3></div>
          <div className="p-6 pt-0"><div className="text-2xl font-bold text-red-500">₹25,000</div></div>
        </div>
      </div>
      <DataTable columns={columns} data={dummyData} />
    </div>
  );
}
