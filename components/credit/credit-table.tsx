"use client";

import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CollectPaymentDialog } from '@/components/credit/collect-payment-dialog';
import { CreditCard, Eye } from 'lucide-react';

interface CreditTableProps {
  initialCustomers?: any[];
}

export function CreditTable({ initialCustomers = [] }: CreditTableProps) {
  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Customer / Farmer', 
      cell: ({ row }: any) => (
        <div>
          <Link href={`/customers/${row.original.id}`} className="font-semibold text-primary hover:underline">
            {row.original.name}
          </Link>
          {row.original.village && (
            <div className="text-xs text-muted-foreground">{row.original.village}</div>
          )}
        </div>
      ) 
    },
    { 
      accessorKey: 'mobile', 
      header: 'Mobile', 
      cell: ({ row }: any) => row.original.mobile || 'N/A' 
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
          <span className="font-bold text-red-600 text-base">
            {formatCurrency(amt)}
          </span>
        );
      } 
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => {
        const amt = Number(row.original.outstanding || 0);
        return (
          <Badge variant={amt > 10000 ? "destructive" : "secondary"}>
            {amt > 10000 ? "High Balance" : "Active Credit"}
          </Badge>
        );
      }
    },
    { 
      id: 'actions', 
      header: 'Actions',
      cell: ({ row }: any) => {
        const customer = {
          id: row.original.id,
          name: row.original.name,
          outstanding: Number(row.original.outstanding || 0),
          mobile: row.original.mobile,
        };

        return (
          <div className="flex items-center space-x-2">
            <Link href={`/customers/${row.original.id}`}>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-1" /> Ledger
              </Button>
            </Link>
            <CollectPaymentDialog 
              customer={customer} 
              trigger={
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  <CreditCard className="h-4 w-4 mr-1" /> Collect
                </Button>
              } 
            />
          </div>
        );
      } 
    }
  ];

  if (initialCustomers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Active Credit / Udhar Accounts</h3>
        <p className="text-sm max-w-sm mx-auto mb-4">
          All farmers and customers have settled their balances, or no credit transactions are currently recorded.
        </p>
        <Link href="/billing">
          <Button className="bg-primary">Create New Bill</Button>
        </Link>
      </div>
    );
  }

  return (
    <DataTable 
      columns={columns} 
      data={initialCustomers} 
      searchKey="name" 
      searchPlaceholder="Search credit records by farmer name..." 
    />
  );
}
