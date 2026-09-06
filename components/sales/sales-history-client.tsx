'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, RefreshCw, AlertCircle, ShoppingCart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { 
  isClientDemoMode, 
  getDemoSalesClient 
} from '@/lib/client-demo-store';
import { isTodayIST } from '@/services/dashboard-data.service';
import { getSalesAction } from '@/actions/sales';
import { toast } from 'sonner';

interface SalesHistoryClientProps {
  initialSales?: any[];
  initialError?: string;
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

export function SalesHistoryClient({ initialSales = [], initialError }: SalesHistoryClientProps) {
  const [sales, setSales] = useState<any[]>(initialSales);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);

  const fetchLatestSales = useCallback(async (isManual = false) => {
    if (isClientDemoMode()) {
      const storedSales = getDemoSalesClient();
      setSales(storedSales);
      setErrorMessage(null);
      if (isManual) toast.success('Sales history refreshed');
      return;
    }

    setLoading(true);
    try {
      const res = await getSalesAction({});
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.sales || [];
        setSales(list);
        setErrorMessage(null);
        if (isManual) toast.success('Sales history refreshed from cloud');
      } else {
        const err = (!res.success && res.error) ? res.error : 'Unable to load sales history.';
        setErrorMessage(err);
        if (isManual) toast.error(err);
      }
    } catch (err: any) {
      const msg = err.message || 'Error connecting to database';
      setErrorMessage(msg);
      if (isManual) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSales && initialSales.length > 0) {
      setSales(initialSales);
    } else {
      fetchLatestSales();
    }

    const syncSales = () => {
      fetchLatestSales();
    };

    window.addEventListener('krushi-sales-updated', syncSales);
    window.addEventListener('focus', syncSales);
    return () => {
      window.removeEventListener('krushi-sales-updated', syncSales);
      window.removeEventListener('focus', syncSales);
    };
  }, [initialSales, fetchLatestSales]);

  // Dynamic calculations from actual persisted sales using India Standard Time
  const todaySales = sales.filter((s: any) => {
    if (s.status?.toString().toUpperCase() === 'CANCELLED') return false;
    const val = s.sale_date || s.created_at;
    return val ? isTodayIST(val) : false;
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
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLatestSales(true)}
            disabled={loading}
            className="border-border shadow-sm text-foreground hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/billing">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
              <Receipt className="h-4 w-4 mr-2" /> New Bill
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Error Notification Banner if retrieval failed ─── */}
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center justify-between gap-3 text-destructive">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Unable to fetch latest sales</p>
              <p className="text-xs opacity-90">{errorMessage}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLatestSales(true)}
            className="border-destructive/40 hover:bg-destructive/10 text-destructive text-xs"
          >
            Retry
          </Button>
        </div>
      )}

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
              {loading && sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Loading sales history from database...</p>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-1" />
                      <p className="text-base font-semibold text-foreground">No sales found</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Complete your first bill in Billing / POS to record transactions and track sales revenue.
                      </p>
                      <Link href="/billing" className="mt-3">
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                          Go to Billing / POS
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                sales.map((sale: any) => {
                  const invNo = sale.invoice_number || sale.invoiceNumber || (sale.id ? (sale.id.startsWith('KOS-') ? sale.id : `KOS-${sale.id.substring(0, 8).toUpperCase()}`) : 'INV');
                  const custName = sale.customer?.name || (typeof sale.customer === 'string' ? sale.customer : null) || sale.customer_name || 'Walk-in Customer';
                  const totalAmt = Number(sale.grand_total ?? sale.total_amount ?? sale.totalAmount ?? sale.payableAmount ?? 0);
                  const statusUpper = (sale.status || '').toString().toUpperCase();
                  const paymentUpper = (sale.payment_status || '').toString().toUpperCase();
                  const isCompleted = statusUpper === 'COMPLETED' || paymentUpper === 'PAID';
                  const isPending = paymentUpper === 'CREDIT' || paymentUpper === 'UNPAID' || statusUpper === 'PENDING';
                  const isCancelled = statusUpper === 'CANCELLED';
                  const isRefunded = statusUpper === 'REFUNDED';
                  const displayStatus = isCancelled ? 'CANCELLED' : (isRefunded ? 'REFUNDED' : (isPending ? 'PENDING' : 'COMPLETED'));

                  return (
                    <tr key={sale.id} className="hover:bg-accent/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-foreground">{invNo}</td>
                      <td className="p-4 text-muted-foreground">{safeFormatDate(sale.sale_date || sale.created_at, 'dd MMM yyyy, hh:mm a')}</td>
                      <td className="p-4 font-semibold text-foreground">{custName}</td>
                      <td className="p-4 text-right font-black text-foreground">{formatCurrency(totalAmt)}</td>
                      <td className="p-4 text-center">
                        <Badge 
                          variant={isCompleted ? 'default' : 'secondary'} 
                          className={
                            isCancelled 
                              ? 'bg-destructive/20 text-destructive border-destructive/30 font-semibold' 
                              : isPending 
                              ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 font-semibold'
                              : isCompleted 
                              ? 'bg-primary text-primary-foreground font-semibold' 
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {displayStatus}
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
