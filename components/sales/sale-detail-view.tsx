'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Printer, 
  RotateCcw, 
  Download, 
  Loader2, 
  Eye, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Layers, 
  ReceiptText 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { 
  InvoiceRenderer, 
  InvoicePrintFormat, 
  printInvoiceDirectly, 
  downloadInvoicePDF 
} from '@/components/invoice/invoice-renderer';
import { InvoiceFormatSelector } from '@/components/invoice/invoice-format-selector';
import { isClientDemoMode, getDemoSalesClient, cancelDemoSaleClient } from '@/lib/client-demo-store';
import { cancelSaleAction, getSaleAction, getSaleReturnAction } from '@/actions/sales';
import { getShopProfileAction } from '@/actions/settings';
import { getSavedShopDetails } from '@/lib/shop-details';
import SaleReturnDialog from '@/components/billing/sale-return-dialog';
import { formatCurrency } from '@/lib/utils';
import { getSaleActionAvailability } from '@/lib/sale-status';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';

interface SaleDetailViewProps {
  initialSale?: any;
  saleId?: string;
  sale?: any;
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

const REFUND_MODE_LABELS: Record<string, string> = {
  'CREDIT_ADJUSTMENT': 'Customer Balance Adjustment',
  'CASH': 'Cash Refund',
  'UPI': 'UPI Refund',
  'BANK_TRANSFER': 'Bank Transfer',
  'CARD': 'Card Refund',
};

export function SaleDetailView({ initialSale, saleId, sale: directSale }: SaleDetailViewProps) {
  const router = useRouter();
  const [currentSale, setCurrentSale] = useState<any>(directSale || initialSale);
  const [returnHistory, setReturnHistory] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Modals state
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Return Document Viewer state
  const [viewingReturnDoc, setViewingReturnDoc] = useState<any | null>(null);
  const [returnDocFormat, setReturnDocFormat] = useState<InvoicePrintFormat>('A5');
  const [isLoadingReturnDoc, setIsLoadingReturnDoc] = useState(false);

  // Format view state for main invoice
  const [viewFormat, setViewFormat] = useState<InvoicePrintFormat>('A5');

  useEffect(() => {
    const saved = getSavedShopDetails();
    if (saved?.defaultBillFormat) {
      setViewFormat(saved.defaultBillFormat);
      setReturnDocFormat(saved.defaultBillFormat);
    }

    getShopProfileAction().then((res) => {
      if (res.success && res.data?.defaultBillFormat) {
        setViewFormat(res.data.defaultBillFormat);
        setReturnDocFormat(res.data.defaultBillFormat);
      }
    }).catch(() => {});
  }, []);

  const refreshSaleData = useCallback(async () => {
    const targetId = saleId || currentSale?.id || directSale?.id || initialSale?.id;
    if (!targetId) return;

    if (isClientDemoMode()) {
      const demoSales = getDemoSalesClient();
      const found = demoSales.find((s: any) => s.id === targetId || s.invoice_number === targetId);
      if (found) {
        setCurrentSale(found);
        setReturnHistory(found.returns || found.sale_returns || []);
      }
      return;
    }

    try {
      const res = await getSaleAction(targetId);
      if (res.success && res.data) {
        setCurrentSale(res.data);
        const rets = res.data.returns || res.data.sale_returns || [];
        setReturnHistory(rets);
      }
    } catch {
      // ignore
    }
  }, [saleId, currentSale?.id, directSale?.id, initialSale?.id]);

  useEffect(() => {
    if (!currentSale && isClientDemoMode() && saleId) {
      const demoSales = getDemoSalesClient();
      const found = demoSales.find((s: any) => s.id === saleId);
      if (found) {
        setCurrentSale(found);
        setReturnHistory(found.returns || found.sale_returns || []);
      }
    } else if (directSale || initialSale) {
      const active = directSale || initialSale;
      setCurrentSale(active);
      setReturnHistory(active.returns || active.sale_returns || []);
    }
  }, [initialSale, saleId, directSale]);

  const activeSale = currentSale || { id: saleId || '1' };
  const invNo = activeSale.invoice_number || activeSale.invoiceNumber || (activeSale.id ? (activeSale.id.startsWith('KOS-') ? activeSale.id : `KOS-${activeSale.id.substring(0, 8).toUpperCase()}`) : '1');
  const customerName =
    activeSale.customer?.name ||
    activeSale.customer_name ||
    'Walk-in Customer';
  const billTotal = Number(
    activeSale.grand_total ?? activeSale.total_amount ?? activeSale.totalAmount ?? activeSale.payableAmount ?? 0
  );

  const {
    isCancelled,
    isFullyReturned,
    isPartiallyReturned,
    canReturn,
    canCancel,
  } = getSaleActionAvailability(activeSale);

  const containerId = viewFormat === 'THERMAL_80MM' ? 'printable-thermal-receipt' : 'printable-tax-invoice';

  const handlePrint = () => {
    printInvoiceDirectly(containerId, viewFormat);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadInvoicePDF(containerId, `Invoice-${invNo}.pdf`, viewFormat);
    } finally {
      setIsDownloading(false);
    }
  };

  const openCancelModal = () => {
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleExecuteCancelSale = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('Please enter a cancellation reason');
      return;
    }
    if (isCancelling) return;

    setIsCancelling(true);
    try {
      if (isClientDemoMode()) {
        cancelDemoSaleClient(activeSale.id, reason);
        try {
          cancelSaleAction(activeSale.id, reason).catch(() => {});
        } catch {}
        toast.success(`Invoice ${invNo} cancelled successfully`);
        setIsCancelModalOpen(false);
        setCancelReason('');
        setCurrentSale({
          ...activeSale,
          status: 'cancelled',
          db_status: 'cancelled',
          payment_status: 'cancelled',
        });
        await refreshSaleData();
      } else {
        const res = await cancelSaleAction(activeSale.id, reason);
        if (res.success) {
          toast.success(`Invoice ${invNo} cancelled successfully`);
          setIsCancelModalOpen(false);
          setCancelReason('');
          await refreshSaleData();
          router.refresh();
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

  // View return document
  const handleViewReturn = async (retDoc: any) => {
    setIsLoadingReturnDoc(true);
    try {
      if (retDoc.id && !isClientDemoMode()) {
        const res = await getSaleReturnAction(retDoc.id);
        if (res.success && res.data) {
          setViewingReturnDoc({ ...res.data, is_return: true, sale: activeSale });
          setIsLoadingReturnDoc(false);
          return;
        }
      }
      // Fallback
      setViewingReturnDoc({
        ...retDoc,
        is_return: true,
        sale: activeSale,
        customer: retDoc.customer || activeSale.customer || { name: activeSale.customer_name || 'Customer' },
      });
    } finally {
      setIsLoadingReturnDoc(false);
    }
  };

  // Print return document
  const handlePrintReturn = async (retDoc: any) => {
    await handleViewReturn(retDoc);
    setTimeout(() => {
      printInvoiceDirectly('printable-return-tax-invoice', returnDocFormat);
    }, 400);
  };

  return (
    <div className="bg-muted/30 min-h-screen pb-16 print:bg-white print:p-0">
      {/* ─── ACTION BAR (NO PRINT) ─── */}
      <div className="max-w-[210mm] mx-auto p-4 no-print flex justify-between items-center gap-3 flex-wrap bg-background shadow-sm border-b mb-4 rounded-b-xl">
        <Link href="/sales">
          <Button variant="outline" className="border-border shadow-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Badges */}
          {isCancelled && (
            <Badge variant="destructive" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
              CANCELLED
            </Badge>
          )}

          {isFullyReturned && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider">
              FULLY RETURNED
            </Badge>
          )}

          {isPartiallyReturned && (
            <Badge className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider">
              PARTIALLY RETURNED
            </Badge>
          )}

          {/* Action Buttons for Completed or Partially Returned sales */}
          {(canReturn || canCancel) && (
            <>
              <Button 
                variant="outline" 
                className="text-destructive border-destructive/30 hover:bg-destructive/10 shadow-sm font-semibold" 
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-1.5" /> Cancel Bill
              </Button>
              <Button 
                variant="destructive" 
                className="shadow-sm font-semibold" 
                size="sm"
                onClick={() => setIsReturnOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Return Products
              </Button>
            </>
          )}

          <Button 
            onClick={handleDownload} 
            variant="outline" 
            className="border-primary/40 text-primary hover:bg-primary/10 font-bold shadow-sm"
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button 
            onClick={handlePrint} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
          >
            <Printer className="h-4 w-4 mr-2" /> Print Invoice
          </Button>
        </div>
      </div>

      {/* ─── FORMAT TOGGLE (TEMPORARY VIEW SWITCHER) ─── */}
      <div className="max-w-[210mm] mx-auto mb-4 no-print px-4">
        <div className="bg-background p-3.5 rounded-lg border shadow-sm flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs font-medium text-muted-foreground">
            Switch layout to preview & print in <strong className="text-foreground">A5</strong> or <strong className="text-foreground">80mm Thermal</strong>:
          </div>
          <div className="w-full sm:w-auto">
            <InvoiceFormatSelector
              value={viewFormat}
              onChange={(newFmt) => setViewFormat(newFmt)}
              showDescriptions={false}
              className="space-y-1"
            />
          </div>
        </div>
      </div>

      {/* ─── PHYSICAL INVOICE RENDERER (SCREEN PREVIEW & PRINT) ─── */}
      <div className="max-w-[210mm] mx-auto flex justify-center print:m-0 print:p-0 print:w-full">
        <InvoiceRenderer 
          format={viewFormat}
          sale={activeSale} 
        />
      </div>

      {/* ─── RETURN HISTORY SECTION (UNDERNEATH ORIGINAL INVOICE) ─── */}
      {returnHistory && returnHistory.length > 0 && (
        <div className="max-w-[210mm] mx-auto mt-8 no-print px-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">RETURN HISTORY / CREDIT NOTES</h2>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {returnHistory.length} {returnHistory.length === 1 ? 'return record' : 'return records'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {returnHistory.map((ret: any, index: number) => {
              const retNo = ret.return_number || `RET-${invNo}-0${index + 1}`;
              const retDate = ret.return_date || ret.created_at;
              const retAmount = Number(ret.total_amount ?? ret.grand_total ?? 0);
              const itemCount = Array.isArray(ret.items) ? ret.items.length : 1;
              const method = REFUND_MODE_LABELS[ret.refund_mode] || ret.refund_mode || 'Credit Adjustment';

              return (
                <div 
                  key={ret.id || index}
                  className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-primary text-base">{retNo}</span>
                      <Badge variant="outline" className="text-xs bg-muted/50">
                        {method}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {safeFormatDate(retDate, 'dd MMM yyyy, hh:mm a')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                      </span>
                      {ret.reason && (
                        <span>Reason: <strong className="text-foreground">{ret.reason}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-muted-foreground block">Return Amount</span>
                      <span className="font-mono font-black text-lg text-foreground">
                        {formatCurrency(retAmount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewReturn(ret)}
                        className="h-8 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => handlePrintReturn(ret)}
                        className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1" /> Print
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SALE RETURN DIALOG ─── */}
      {isReturnOpen && (
        <SaleReturnDialog
          sale={activeSale}
          onClose={() => setIsReturnOpen(false)}
          onSuccess={() => {
            setIsReturnOpen(false);
            refreshSaleData();
          }}
        />
      )}

      {/* ─── CANCEL BILL CONFIRMATION MODAL ─── */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md bg-card border-border rounded-2xl shadow-2xl p-6">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-1">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-center text-foreground">
              Cancel Bill?
            </DialogTitle>
            <p className="text-xs text-center text-muted-foreground font-mono">
              Invoice: <strong className="text-foreground">{invNo}</strong>
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
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
              className="w-full"
            >
              Keep Bill
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleExecuteCancelSale}
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

      {/* ─── RETURN DOCUMENT VIEWER MODAL ─── */}
      {viewingReturnDoc && (
        <Dialog open={true} onOpenChange={() => setViewingReturnDoc(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
            <DialogHeader className="p-4 border-b bg-muted/40 shrink-0 flex flex-row items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  SALES RETURN / CREDIT NOTE
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">
                  {viewingReturnDoc.return_number || 'RET'} &bull; Original: {invNo}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <InvoiceFormatSelector
                  value={returnDocFormat}
                  onChange={(f) => setReturnDocFormat(f)}
                  showDescriptions={false}
                />
                <Button 
                  size="sm" 
                  onClick={() => printInvoiceDirectly('printable-return-tax-invoice', returnDocFormat)}
                  className="bg-primary text-primary-foreground font-bold text-xs shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-muted/20">
              <div id="printable-return-tax-invoice">
                <InvoiceRenderer
                  format={returnDocFormat}
                  sale={viewingReturnDoc}
                />
              </div>
            </div>

            <DialogFooter className="p-3 border-t bg-muted/30 shrink-0">
              <Button 
                onClick={() => setViewingReturnDoc(null)} 
                variant="outline"
                className="ml-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
