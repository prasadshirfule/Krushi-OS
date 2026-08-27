"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

export function CustomerTable({ initialData = [] }: { initialData?: any[] }) {
  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Name', 
      cell: ({ row }: any) => (
        <Link href={`/customers/${row.original.id}`} className="font-semibold text-blue-600 hover:underline">
          {row.original.name}
        </Link>
      ) 
    },
    { accessorKey: 'mobile', header: 'Mobile', cell: ({ row }: any) => row.original.mobile || 'N/A' },
    { accessorKey: 'village', header: 'Village', cell: ({ row }: any) => row.original.village || '-' },
    { 
      accessorKey: 'total_purchases', 
      header: 'Total Purchases',
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || row.original.totalPurchases || 0))
    },
    { 
      accessorKey: 'outstanding', 
      header: 'Outstanding Balance', 
      cell: ({ row }: any) => {
        const amt = Number(row.original.outstanding || 0);
        return (
          <span className={amt > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-medium'}>
            {formatCurrency(amt)}
          </span>
        );
      } 
    },
    { 
      accessorKey: 'is_active', 
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.is_active !== false ? "default" : "secondary"}>
          {row.original.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { 
      id: 'actions', 
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-2">
          <Link href={`/customers/${row.original.id}`}>
            <Button variant="outline" size="sm">View Ledger</Button>
          </Link>
        </div>
      ) 
    }
  ];

  if (initialData.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        No customer records found. Click &quot;Add Customer&quot; to register farmers/customers.
      </div>
    );
  }

  return <DataTable columns={columns} data={initialData} searchKey="name" searchPlaceholder="Search customers by name..." />;
}
