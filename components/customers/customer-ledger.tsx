"use client";

import { useState, useEffect } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { BookOpen } from 'lucide-react';
import {
  isClientDemoMode,
  getDemoLedgerClient,
} from '@/lib/client-demo-store';
import { getCustomerLedgerAction } from '@/actions/customers';

export function CustomerLedger({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLedger = async () => {
    try {
      if (isClientDemoMode()) {
        // Load from client-side demo store filtered by this customer
        const data = getDemoLedgerClient(customerId);
        setEntries(data);
      } else {
        // Load from server action (Supabase)
        const res = await getCustomerLedgerAction(customerId, { limit: 200 });
        if (res.success && res.data?.entries) {
          setEntries(res.data.entries);
        }
      }
    } catch (err) {
      console.error('Error loading customer ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [customerId]);

  // Listen for ledger updates in demo mode
  useEffect(() => {
    if (isClientDemoMode()) {
      const handleUpdate = () => {
        const data = getDemoLedgerClient(customerId);
        setEntries(data);
      };
      window.addEventListener('krushi-ledger-updated', handleUpdate);
      return () => window.removeEventListener('krushi-ledger-updated', handleUpdate);
    }
  }, [customerId]);

  const columns = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }: any) => {
        const d = row.original.date || row.original.created_at;
        if (!d) return '-';
        try {
          const dt = new Date(d);
          return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
          return d;
        }
      }
    },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'reference', header: 'Reference' },
    {
      accessorKey: 'debit',
      header: 'Debit (₹)',
      cell: ({ row }: any) => {
        const amt = Number(row.original.debit || 0);
        return amt > 0
          ? <span className="text-red-500 font-medium">{formatCurrency(amt)}</span>
          : <span className="text-muted-foreground">-</span>;
      }
    },
    {
      accessorKey: 'credit',
      header: 'Credit (₹)',
      cell: ({ row }: any) => {
        const amt = Number(row.original.credit || 0);
        return amt > 0
          ? <span className="text-green-600 font-medium">{formatCurrency(amt)}</span>
          : <span className="text-muted-foreground">-</span>;
      }
    },
    {
      accessorKey: 'balance',
      header: 'Running Balance (₹)',
      cell: ({ row }: any) => {
        const bal = Number(row.original.balance || 0);
        return <span className="font-semibold">{formatCurrency(bal)}</span>;
      }
    }
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading ledger...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center bg-card">
        <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">No transactions yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          This customer has no credit ledger entries. Transactions will appear here when credit sales, payments, or manual Udhari entries are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable columns={columns} data={entries} />
    </div>
  );
}
