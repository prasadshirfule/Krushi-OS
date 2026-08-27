"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function SupplierTable() {
  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Name', 
      cell: ({ row }: any) => (
        <Link href={`/suppliers/${row.original.id}`} className="text-blue-600 hover:underline">
          {row.original.name}
        </Link>
      ) 
    },
    { accessorKey: 'company', header: 'Company' },
    { accessorKey: 'mobile', header: 'Mobile' },
    { accessorKey: 'gstNumber', header: 'GST Number' },
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
    { 
      id: 'actions', 
      cell: () => (
        <div className="space-x-2">
          <Button variant="outline" size="sm">Edit</Button>
          <Button size="sm">Make Payment</Button>
        </div>
      ) 
    }
  ];

  const dummyData = [
    { id: '1', name: 'Amit Shah', company: 'Agri Seeds Ltd', mobile: '9988776655', gstNumber: '24AAACC1206D1Z1', totalPurchases: 500000, outstanding: 125000 }
  ];

  return <DataTable columns={columns} data={dummyData} />;
}
