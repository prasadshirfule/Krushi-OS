"use client";

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

export function CustomerLedger({ customerId }: { customerId: string }) {
  const columns = [
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'reference', header: 'Reference' },
    { 
      accessorKey: 'debit', 
      header: 'Debit (₹)',
      cell: ({ row }: any) => <span className="text-red-500 font-medium">{row.original.debit || '-'}</span>
    },
    { 
      accessorKey: 'credit', 
      header: 'Credit (₹)',
      cell: ({ row }: any) => <span className="text-green-600 font-medium">{row.original.credit || '-'}</span>
    },
    { accessorKey: 'balance', header: 'Running Balance (₹)' }
  ];

  const dummyData = [
    { id: '1', date: '2023-10-25', description: 'Opening Balance', reference: '-', debit: 5000, credit: 0, balance: 5000 },
    { id: '2', date: '2023-10-26', description: 'Purchase', reference: 'INV-001', debit: 10000, credit: 0, balance: 15000 },
    { id: '3', date: '2023-10-27', description: 'Payment Received', reference: 'PAY-001', debit: 0, credit: 3000, balance: 12000 }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end space-x-2">
        <Button variant="outline" size="sm">Print</Button>
        <Button variant="outline" size="sm">Export CSV</Button>
      </div>
      <DataTable columns={columns} data={dummyData} />
    </div>
  );
}
