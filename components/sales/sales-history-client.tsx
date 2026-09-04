'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { 
  isClientDemoMode, 
  getDemoSalesClient, 
  isSameDay 
} from '@/lib/client-demo-store';

interface SalesHistoryClientProps {
  initialSales: any[];
}

const safeFormatDate = (dateVal: any, formatStr: string) => {
  if (!dateVal) return '';
  try {
    const d = typeof dateVal === 'string' ? parseISO(dateVal) : new Date(dateVal);
    const validDate = isNaN(d.getTime()) ? new Date(dateVal) : d;
    return format(validDate, formatStr);
  } catch {
    return '';
  }
};

export function SalesHistoryClient({ initialSales = [] }: SalesHistoryClientProps) {
  const [sales, setSales] = useState<any[]>(initialSales);

  useEffect(() => {
    if (isClientDemoMode()) {
      const syncSales = () => {
        const storedSales = getDemoSalesClient();
        setSales(storedSales);
      };

      syncSales();
      window.addEventListener('krushi-sales-updated', syncSales);
      return () => window.removeEventListener('krushi-sales-updated', syncSales);
    } else {
      setSales(initialSales);
    }
  }, [initialSales]);

  // Dynamic calculations from actual persisted sales
  const todaySales = sales.filter((s: any) => {
    if (s.status === 'CANCELLED') return false;
    const val = s.sale_date || s.created_at;
    return val ? isSameDay(val) : false;
  });

  const todayRevenue = todaySales.reduce((acc: number, s: any) => {
    const amt = Number(s.grand_total ?? s.total_amount ?? s.totalAmount ?? s.payableAmount ?? 0);
    return acc + amt;
  }, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales History</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage all customer bills and sales transactions</p>
        </div>
        <Link href="/billing">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
            <Receipt className="h-4 w-4 mr-2" /> New Bill
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-primary">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {todaySales.length} {todaySales.length === 1 ? 'bill' : 'bills'} today
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground">{sales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded in system</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="p-4 text-left">Invoice #</th>
                <th className="p-4 text-left">Date</th>
                <th className="p-4 text-left">Customer</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">No sales found</td>
                </tr>
              ) : (
                sales.map((sale: any) => {
                  const invNo = sale.invoice_number || sale.invoiceNumber || (sale.id ? sale.id.substring(0, 8).toUpperCase() : 'INV');
                  const custName = sale.customer?.name || (typeof sale.customer === 'string' ? sale.customer : null) || sale.customer_name || 'Walk-in Customer';
                  const totalAmt = Number(sale.grand_total ?? sale.total_amount ?? sale.totalAmount ?? sale.payableAmount ?? 0);
                  const isCompleted = (sale.status || sale.payment_status) === 'COMPLETED' || sale.payment_status === 'PAID';

                  return (
                    <tr key={sale.id} className="hover:bg-accent/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-foreground">{invNo}</td>
                      <td className="p-4 text-muted-foreground">{safeFormatDate(sale.sale_date || sale.created_at, 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="p-4 font-semibold text-foreground">{custName}</td>
                      <td className="p-4 text-right font-black text-foreground">{formatCurrency(totalAmt)}</td>
                      <td className="p-4 text-center">
                        <Badge 
                          variant={isCompleted ? 'default' : 'secondary'} 
                          className={isCompleted ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground'}
                        >
                          {sale.status || (isCompleted ? 'COMPLETED' : 'PENDING')}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/sales/${sale.id}`}>
                          <Button variant="ghost" size="sm" className="hover:bg-accent text-foreground">
                            <FileText className="h-4 w-4 mr-1.5" /> View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
