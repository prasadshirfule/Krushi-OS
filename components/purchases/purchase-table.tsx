"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';

export function PurchaseTable({ initialData = [] }: { initialData?: any[] }) {
  const columns = [
    { 
      accessorKey: 'invoice_number', 
      header: 'Invoice #',
      cell: ({ row }: any) => (
        <span className="font-semibold">{row.original.invoice_number || row.original.invoiceNumber || 'N/A'}</span>
      )
    },
    { 
      accessorKey: 'supplier', 
      header: 'Supplier',
      cell: ({ row }: any) => row.original.supplier?.name || row.original.supplierName || 'Unknown Supplier'
    },
    { 
      accessorKey: 'purchase_date', 
      header: 'Date',
      cell: ({ row }: any) => formatDate(row.original.purchase_date || row.original.created_at || row.original.date)
    },
    { 
      accessorKey: 'items', 
      header: 'Items Count',
      cell: ({ row }: any) => (row.original.items || row.original.purchase_items || []).length || row.original.itemsCount || 0
    },
    { 
      accessorKey: 'total_amount', 
      header: 'Total Amount',
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_amount || row.original.total || 0))
    },
    { 
      accessorKey: 'paid_amount', 
      header: 'Paid Amount',
      cell: ({ row }: any) => formatCurrency(Number(row.original.paid_amount || row.original.paid || 0))
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => {
        const total = Number(row.original.total_amount || row.original.total || 0);
        const paid = Number(row.original.paid_amount || row.original.paid || 0);
        const isPaid = total > 0 && paid >= total;
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

  if (initialData.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        No purchase records found. Click &quot;New Purchase&quot; to log stock received from suppliers.
      </div>
    );
  }

  return <DataTable columns={columns} data={initialData} searchKey="invoice_number" searchPlaceholder="Search invoice #..." />;
}
