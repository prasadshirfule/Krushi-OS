'use client';

import React, { useState, useEffect } from 'react';
import { CustomerTable } from '@/components/customers/customer-table';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { 
  isClientDemoMode, 
  getDemoCustomersClient 
} from '@/lib/client-demo-store';

interface CustomersViewProps {
  initialCustomers: any[];
  initialSummary: {
    totalCustomers: number;
    activeCustomers: number;
    totalOutstandingCredit: number;
    incomingOutstanding?: number;
    outgoingOutstanding?: number;
  };
}

export function CustomersView({ initialCustomers, initialSummary }: CustomersViewProps) {
  const [customers, setCustomers] = useState<any[]>(initialCustomers);
  const [summary, setSummary] = useState(initialSummary);

  useEffect(() => {
    if (isClientDemoMode()) {
      const syncData = () => {
        const demoCusts = getDemoCustomersClient();
        const incoming = demoCusts.reduce((sum, c) => {
          const bal = Number(c.outstanding ?? c.outstanding_balance ?? 0);
          return bal > 0 ? sum + bal : sum;
        }, 0);
        const outgoing = demoCusts.reduce((sum, c) => {
          const bal = Number(c.outstanding ?? c.outstanding_balance ?? 0);
          return bal < 0 ? sum + Math.abs(bal) : sum;
        }, 0);
        setCustomers(demoCusts);
        setSummary({
          totalCustomers: demoCusts.length,
          activeCustomers: demoCusts.filter(c => c.is_active !== false).length,
          totalOutstandingCredit: incoming,
          incomingOutstanding: incoming,
          outgoingOutstanding: outgoing,
        });
      };

      syncData();
      window.addEventListener('krushi-customers-updated', syncData);
      return () => window.removeEventListener('krushi-customers-updated', syncData);
    }
  }, [initialCustomers, initialSummary]);

  const incomingAmt = summary.incomingOutstanding !== undefined ? summary.incomingOutstanding : summary.totalOutstandingCredit;
  const outgoingAmt = summary.outgoingOutstanding || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Link href="/customers/new">
          <Button>Add Customer</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Total Customers</h3>
          <div className="text-3xl font-bold mt-2">
            {summary.totalCustomers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Registered customer accounts</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Incoming Outstanding</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(incomingAmt)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Amount receivable from customers</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Outgoing Outstanding</h3>
          <div className="text-3xl font-bold text-emerald-600 mt-2">
            {formatCurrency(outgoingAmt)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Customer advance / credit balance</p>
        </div>
      </div>

      <CustomerTable initialData={customers} />
    </div>
  );
}
