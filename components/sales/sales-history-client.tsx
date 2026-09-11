'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Receipt, 
  RefreshCw, 
  AlertCircle, 
  ShoppingCart, 
  RotateCcw, 
  Printer, 
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { 
  isClientDemoMode, 
  getDemoSalesClient,
  cancelDemoSaleClient 
} from '@/lib/client-demo-store';
import { isTodayIST } from '@/services/dashboard-data.service';
import { getSalesAction, cancelSaleAction } from '@/actions/sales';
import { toast } from 'sonner';
import SaleReturnDialog from '@/components/billing/sale-return-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { printInvoiceDirectly, InvoiceRenderer } from '@/components/invoice/invoice-renderer';
import { exportReportToPDF, printReportDocument, ReportFilterMeta } from '@/lib/report-export';
import { getSavedShopDetails } from '@/lib/shop-details';

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

  // Return & Cancel modals state
  const [returnTargetSale, setReturnTargetSale] = useState<any | null>(null);
  const [cancelTargetSale, setCancelTargetSale] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Print hidden target
  const [printTargetSale, setPrintTargetSale] = useState<any | null>(null);

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
    const st = (s.status || '').toString().toLowerCase();
    if (st === 'cancelled') return false;
    const val = s.sale_date || s.created_at;
    return val ? isTodayIST(val) : false;
  });

  const todayRevenue = todaySales.reduce((acc: number, s: any) => {
    const amt = Number(s.grand_total ?? s.total_amount ?? s.totalAmount ?? s.payableAmount ?? 0);
    return acc + amt;
  }, 0);

  const handleExecuteCancel = async () => {
    if (!cancelTargetSale) return;
    const invNo = cancelTargetSale.invoice_number || cancelTargetSale.invoiceNumber || cancelTargetSale.id;

    setIsCancelling(true);
    try {
      if (isClientDemoMode()) {
        cancelDemoSaleClient(cancelTargetSale.id, 'User cancelled from history');
        try {
          cancelSaleAction(cancelTargetSale.id, 'User cancelled from history').catch(() => {});
        } catch {}
        toast.success(`Invoice ${invNo} cancelled successfully`);
        setCancelTargetSale(null);
        fetchLatestSales();
      } else {
        const res = await cancelSaleAction(cancelTargetSale.id, 'User cancelled from history');
        if (res.success) {
          toast.success(`Invoice ${invNo} cancelled successfully`);
          setCancelTargetSale(null);
          fetchLatestSales();
        } else {
          toast.error(res.error || 'Failed to cancel invoice');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invoice');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePrintSale = (sale: any) => {
    setPrintTargetSale(sale);
    setTimeout(() => {
      printInvoiceDirectly('printable-tax-invoice-history', 'A5');
    }, 200);
  };

  const handleDownloadPDF = async () => {
    if (sales.length === 0) {
      toast.error('No sales records to export');
      return;
    }
    try {
      const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || s.grand_total || 0), 0);
      const totalTax = sales.reduce((acc, s) => acc + Number(s.tax_amount || 0), 0);
      const totalProfit = sales.reduce((acc, s) => acc + Number(s.profit_amount || 0), 0);
      const reportData = {
        sales: sales,
        totalRevenue,
        totalCount: sales.length,
        totalTax,
        totalProfit,
      };
      const meta: ReportFilterMeta = {
        reportType: 'sales',
        title: 'Sales History Report',
        periodLabel: 'All Records',
        generatedAt: new Date().toLocaleString('en-IN'),
      };
      const shopProfile = getSavedShopDetails();
      await exportReportToPDF('sales', reportData, meta, shopProfile);
      toast.success('Sales history PDF downloaded successfully');
    } catch (err: any) {
      console.error('Failed to export sales PDF:', err);
      toast.error(err.message || 'Failed to export sales PDF');
    }
  };

  const handlePrintHistory = () => {
    if (sales.length === 0) {
      toast.error('No sales records to print');
      return;
    }
    try {
      const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || s.grand_total || 0), 0);
      const totalTax = sales.reduce((acc, s) => acc + Number(s.tax_amount || 0), 0);
      const totalProfit = sales.reduce((acc, s) => acc + Number(s.profit_amount || 0), 0);
      const reportData = {
        sales: sales,
        totalRevenue,
        totalCount: sales.length,
        totalTax,
        totalProfit,
      };
      const meta: ReportFilterMeta = {
        reportType: 'sales',
        title: 'Sales History Report',
        periodLabel: 'All Records',
        generatedAt: new Date().toLocaleString('en-IN'),
      };
      const shopProfile = getSavedShopDetails();
      printReportDocument('sales', reportData, meta, shopProfile);
    } catch (err: any) {
      console.error('Failed to print sales report:', err);
      toast.error(err.message || 'Failed to print sales report');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Sales History</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">View and manage all customer bills, returns, and sales transactions</p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={loading || sales.length === 0}
            className="border-border shadow-sm text-foreground hover:bg-accent text-xs sm:text-sm"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintHistory}
            disabled={loading || sales.length === 0}
            className="border-border shadow-sm text-foreground hover:bg-accent text-xs sm:text-sm"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchLatestSales(true)}
            disabled={loading}
            className="border-border shadow-sm text-foreground hover:bg-accent text-xs sm:text-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/billing">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm text-xs sm:text-sm">
              <Receipt className="h-4 w-4 mr-1.5" /> New Bill
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
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Today&apos;s Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-primary">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {todaySales.length} {todaySales.length === 1 ? 'bill' : 'bills'} today
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground">{sales.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded in system</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="p-3.5 text-left">Invoice #</th>
                <th className="p-3.5 text-left">Date</th>
                <th className="p-3.5 text-left">Customer</th>
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
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
                  
                  const rawStatus = (sale.status || '').toString().toLowerCase().trim();
                  const isCancelled = rawStatus === 'cancelled';
                  const isFullyReturned = rawStatus === 'returned';
                  const isPartiallyReturned = rawStatus === 'partially_returned';
                  const isCompleted = rawStatus === 'completed' || (!isCancelled && !isFullyReturned && !isPartiallyReturned);

                  return (
                    <tr key={sale.id} className="hover:bg-accent/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-foreground">
                        <Link href={`/sales/${sale.id}`} className="hover:underline text-primary">
                          {invNo}
                        </Link>
                      </td>
                      <td className="p-3.5 text-muted-foreground text-xs whitespace-nowrap">
                        {safeFormatDate(sale.sale_date || sale.created_at, 'dd MMM yyyy, hh:mm a')}
                      </td>
                      <td className="p-3.5 font-semibold text-foreground">
                        {custName}
                      </td>
                      <td className="p-3.5 text-right font-black text-foreground font-mono">
                        {formatCurrency(totalAmt)}
                      </td>
                      <td className="p-3.5 text-center">
                        {isCancelled && (
                          <Badge variant="destructive" className="font-bold text-[10px] uppercase">
                            CANCELLED
                          </Badge>
                        )}
                        {isFullyReturned && (
                          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] uppercase">
                            FULLY RETURNED
                          </Badge>
                        )}
                        {isPartiallyReturned && (
                          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase">
                            PARTIALLY RETURNED
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="bg-primary text-primary-foreground font-bold text-[10px] uppercase">
                            COMPLETED
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Link href={`/sales/${sale.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs hover:bg-accent text-foreground">
                              <FileText className="h-3.5 w-3.5 mr-1" /> View
                            </Button>
                          </Link>

                          {/* Show Return and Cancel actions only for Completed and Partially Returned */}
                          {(isCompleted || isPartiallyReturned) && !isCancelled && !isFullyReturned && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setReturnTargetSale(sale)}
                                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                title="Return Products"
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setCancelTargetSale(sale)}
                                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                title="Cancel Entire Bill"
                              >
                                Cancel
                              </Button>
                            </>
                          )}

                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handlePrintSale(sale)}
                            className="h-8 px-2 text-xs hover:bg-accent text-muted-foreground hover:text-foreground"
                            title="Print Invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── RETURN MODAL ─── */}
      {returnTargetSale && (
        <SaleReturnDialog
          sale={returnTargetSale}
          onClose={() => setReturnTargetSale(null)}
          onSuccess={() => {
            setReturnTargetSale(null);
            fetchLatestSales();
          }}
        />
      )}

      {/* ─── CANCEL CONFIRMATION MODAL ─── */}
      {cancelTargetSale && (
        <Dialog open={true} onOpenChange={() => setCancelTargetSale(null)}>
          <DialogContent className="max-w-md bg-card border-border rounded-2xl shadow-2xl p-6">
            <DialogHeader className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-1">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-center text-foreground">
                Cancel Bill?
              </DialogTitle>
              <p className="text-xs text-center text-muted-foreground font-mono">
                Invoice: <strong className="text-foreground">{cancelTargetSale.invoice_number || cancelTargetSale.id}</strong>
              </p>
            </DialogHeader>

            <div className="space-y-3 py-3 text-sm">
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border/70 space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">This cancellation will:</p>
                <ul className="space-y-1 pl-1">
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Cancel the entire invoice
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Restore sold stock to product batches
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Reverse applicable customer ledger effects
                  </li>
                  <li className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Record payment reversals where applicable
                  </li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground text-center italic">
                The original invoice will remain in Sales History with status <span className="font-bold text-destructive">CANCELLED</span>.
              </p>
            </div>

            <DialogFooter className="grid grid-cols-2 gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setCancelTargetSale(null)}
                disabled={isCancelling}
                className="w-full"
              >
                Keep Bill
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleExecuteCancel}
                disabled={isCancelling}
                className="w-full font-bold shadow-md"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelling...
                  </>
                ) : (
                  'Cancel Bill'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─── HIDDEN PRINT RENDERER FOR QUICK ROW PRINT ─── */}
      {printTargetSale && (
        <div className="hidden">
          <div id="printable-tax-invoice-history">
            <InvoiceRenderer
              format="A5"
              sale={printTargetSale}
            />
          </div>
        </div>
      )}
    </div>
  );
}
