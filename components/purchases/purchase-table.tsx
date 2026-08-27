"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function PurchaseTable() {
  const columns = [
    { accessorKey: 'invoiceNumber', header: 'Invoice #' },
    { accessorKey: 'supplierName', header: 'Supplier' },
    { accessorKey: 'date', header: 'Date' },
    { accessorKey: 'itemsCount', header: 'Items Count' },
    { accessorKey: 'total', header: 'Total (₹)' },
    { accessorKey: 'paid', header: 'Paid (₹)' },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => {
        const isPaid = row.original.total === row.original.paid;
        return <Badge variant={isPaid ? "default" : "destructive"}>{isPaid ? 'Paid' : 'Pending'}</Badge>;
      }
    },
    { 
      id: 'actions', 
      cell: ({ row }: any) => (
        <Link href={`/purchases/${row.original.id}`}>
          <Button variant="outline" size="sm">View</Button>
        </Link>
      ) 
    }
  ];

  const dummyData = [
    { id: '1', invoiceNumber: 'INV-001', supplierName: 'Agri Seeds Ltd', date: '2023-10-27', itemsCount: 5, total: 50000, paid: 25000, status: 'Pending' }
  ];

  return <DataTable columns={columns} data={dummyData} />;
}
