"use client";

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PaymentTableProps {
  initialPayments?: any[];
}

export function PaymentTable({ initialPayments = [] }: PaymentTableProps) {
  const columns = [
    { 
      accessorKey: 'payment_date', 
      header: 'Date & Time',
      cell: ({ row }: any) => formatDate(row.original.payment_date || row.original.created_at)
    },
    { 
      accessorKey: 'payment_type', 
      header: 'Type', 
      cell: ({ row }: any) => {
        const type = row.original.payment_type;
        const isIncoming = type === 'SALE' || type === 'CUSTOMER_PAYMENT';
        return (
          <Badge variant={isIncoming ? 'default' : 'secondary'} className={isIncoming ? 'bg-green-600' : 'bg-amber-600'}>
            {isIncoming ? 'Incoming' : 'Outgoing'} ({type})
          </Badge>
        );
      } 
    },
    { 
      accessorKey: 'party', 
      header: 'Party / Account',
      cell: ({ row }: any) => {
        const partyName = row.original.customer?.name || row.original.supplier?.name || row.original.reference_type || 'General Account';
        return <span className="font-medium">{partyName}</span>;
      }
    },
    { 
      accessorKey: 'payment_method', 
      header: 'Payment Method',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.payment_method || 'CASH'}
        </Badge>
      )
    },
    { 
      accessorKey: 'amount', 
      header: 'Amount (₹)',
      cell: ({ row }: any) => (
        <span className="font-bold text-base">
          {formatCurrency(Number(row.original.amount || 0))}
        </span>
      )
    },
    { 
      accessorKey: 'notes', 
      header: 'Notes / Reference', 
      cell: ({ row }: any) => row.original.notes || '-' 
    }
  ];

  if (initialPayments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Payment Records Found</h3>
        <p className="text-sm max-w-sm mx-auto">
          Incoming sales payments and outgoing vendor disbursements will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <DataTable 
      columns={columns} 
      data={initialPayments} 
      searchKey="payment_method" 
      searchPlaceholder="Search payments by method..." 
    />
  );
}
