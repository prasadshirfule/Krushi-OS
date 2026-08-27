"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Eye, Plus } from 'lucide-react';

interface SupplierTableProps {
  initialData?: any[];
}

export function SupplierTable({ initialData = [] }: SupplierTableProps) {
  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Supplier / Distributor', 
      cell: ({ row }: any) => (
        <div>
          <Link href={`/suppliers/${row.original.id}`} className="font-semibold text-primary hover:underline">
            {row.original.name}
          </Link>
          {row.original.company && (
            <div className="text-xs text-muted-foreground">{row.original.company}</div>
          )}
        </div>
      ) 
    },
    { 
      accessorKey: 'mobile', 
      header: 'Contact', 
      cell: ({ row }: any) => row.original.mobile || row.original.phone || 'N/A' 
    },
    { 
      accessorKey: 'gst_number', 
      header: 'GST Number', 
      cell: ({ row }: any) => (
        <span className="font-mono text-xs">
          {row.original.gst_number || row.original.gstNumber || '-'}
        </span>
      ) 
    },
    { 
      accessorKey: 'total_purchases', 
      header: 'Total Purchases', 
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || row.original.totalPurchases || 0))
    },
    { 
      accessorKey: 'outstanding', 
      header: 'Outstanding (₹)', 
      cell: ({ row }: any) => {
        const amt = Number(row.original.outstanding || 0);
        return (
          <span className={amt > 0 ? 'text-red-600 font-bold text-base' : 'text-green-600 font-medium'}>
            {formatCurrency(amt)}
          </span>
        );
      } 
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.is_active !== false ? "default" : "secondary"}>
          {row.original.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { 
      id: 'actions', 
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-2">
          <Link href={`/suppliers/${row.original.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" /> View Details
            </Button>
          </Link>
        </div>
      ) 
    }
  ];

  if (initialData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Suppliers Registered</h3>
        <p className="text-sm max-w-sm mx-auto mb-4">
          Add seed, fertilizer, and pesticide distributors to record purchases and invoices.
        </p>
        <Link href="/suppliers/new">
          <Button className="bg-primary">
            <Plus className="h-4 w-4 mr-1" /> Add Supplier
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DataTable 
      columns={columns} 
      data={initialData} 
      searchKey="name" 
      searchPlaceholder="Search suppliers by name..." 
    />
  );
}
