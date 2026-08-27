"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function CustomerTable() {
  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Name', 
      cell: ({ row }: any) => (
        <Link href={`/customers/${row.original.id}`} className="text-blue-600 hover:underline">
          {row.original.name}
        </Link>
      ) 
    },
    { accessorKey: 'mobile', header: 'Mobile' },
    { accessorKey: 'village', header: 'Village' },
    { accessorKey: 'totalPurchases', header: 'Total Purchases (₹)' },
    { 
      accessorKey: 'outstanding', 
      header: 'Outstanding (₹)', 
      cell: ({ row }: any) => (
        <span className={row.original.outstanding > 0 ? 'text-red-500 font-bold' : ''}>
          {row.original.outstanding}
        </span>
      ) 
    },
    { accessorKey: 'status', header: 'Status' },
    { 
      id: 'actions', 
      cell: () => (
        <div className="space-x-2">
          <Button variant="outline" size="sm">Edit</Button>
          <Button size="sm">Collect Payment</Button>
        </div>
      ) 
    }
  ];

  const dummyData = [
    { id: '1', name: 'Ramesh Patel', mobile: '9876543210', village: 'Rampur', totalPurchases: 50000, outstanding: 12000, status: 'Active' },
    { id: '2', name: 'Suresh Kumar', mobile: '8765432109', village: 'Sitapur', totalPurchases: 25000, outstanding: 0, status: 'Active' }
  ];

  return <DataTable columns={columns} data={dummyData} />;
}
