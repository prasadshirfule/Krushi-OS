'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Printer,
  Download,
  Loader2,
  Store,
  Calendar,
  CreditCard,
  FileText,
  AlertCircle,
  RotateCcw,
  Receipt,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { getCustomerBillDetailAction } from '@/actions/customer-portal';
import {
  InvoiceRenderer,
  InvoicePrintFormat,
  printInvoiceDirectly,
  downloadInvoicePDF,
} from '@/components/invoice/invoice-renderer';
import { formatCurrency } from '@/lib/utils';
import { formatDisplayMobile } from '@/lib/phone-utils';

interface CustomerBillDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerBillDetailPage({ params }: CustomerBillDetailPageProps) {
  const resolvedParams = use(params);
  const billId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat>('A5');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function loadBill() {
      if (!billId) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await getCustomerBillDetailAction(billId);
        if (res.success && res.data) {
          setData(res.data);
          if (res.data.shop?.defaultBillFormat) {
            setPrintFormat(res.data.shop.defaultBillFormat);
          }
        } else {
          setError(res.error || 'Bill not found or you are not authorized to view it.');
        }
      } catch (err: any) {
        console.error('Failed to load bill detail:', err);
        setError(err.message || 'An unexpected error occurred while loading the bill.');
      } finally {
        setIsLoading(false);
      }
    }

    loadBill();
  }, [billId]);

  const handlePrint = () => {
    printInvoiceDirectly('customer-printable-invoice', printFormat);
  };

  const handleDownloadPDF = async () => {
    if (!data?.sale?.invoice_number) return;
    setIsDownloading(true);
    try {
      const filename = `Invoice-${data.sale.invoice_number}.pdf`;
      await downloadInvoicePDF('customer-printable-invoice', filename, printFormat, data.sale, data.shop);
      toast.success('Invoice PDF downloaded.');
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error('Failed to download invoice PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading bill details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 p-4">
        <div className="max-w-md w-full bg-card border rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || 'This bill could not be found or does not belong to your customer account.'}
          </p>
          <Button
            onClick={() => router.push('/customer/dashboard')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Customer Portal
          </Button>
        </div>
      </div>
    );
  }

  const { sale, shop, items, payments, returns, customer } = data;
  const isCancelled = sale.status === 'CANCELLED';
  const isReturned = sale.status === 'RETURNED';
  const isPartiallyReturned = sale.status === 'PARTIALLY_RETURNED';
  const isCredit = sale.payment_status === 'CREDIT' || sale.payment_status === 'UNPAID';
  const isPartial = sale.payment_status === 'PARTIAL';

  const saleDateFormatted = sale.sale_date
    ? new Date(sale.sale_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/customer/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold text-foreground font-mono">
                {sale.invoice_number}
              </h1>
              {isCancelled && (
                <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                  Cancelled
                </Badge>
              )}
              {isReturned && (
                <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                  Returned
                </Badge>
              )}
              {isPartiallyReturned && (
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 border-amber-500/30">
                  Partial Return
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">{shop.shopName}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPrintFormat('A5')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                printFormat === 'A5'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              A5
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('THERMAL_80MM')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                printFormat === 'THERMAL_80MM'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              80mm
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">

        {/* Shop & Bill Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shop Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
              <Store className="h-5 w-5" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">
                {shop.shopName}
              </h2>
            </div>

            <div className="text-xs space-y-1 text-muted-foreground">
              {shop.address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {[shop.address, shop.village, shop.taluka, shop.district, shop.state]
                      .filter(Boolean)
                      .join(', ')}
                    {shop.pincode ? ` - ${shop.pincode}` : ''}
                  </span>
                </p>
              )}
              {shop.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{shop.phone}</span>
                </p>
              )}
              {shop.gstin && (
                <p className="font-mono text-[11px] pt-1 text-foreground/80">
                  <span className="text-muted-foreground">GSTIN:</span> {shop.gstin}
                </p>
              )}
            </div>
          </div>

          {/* Invoice Summary Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Receipt className="h-5 w-5" />
                <h2 className="text-sm font-bold text-foreground">Invoice Summary</h2>
              </div>
              <div className="flex items-center gap-1.5">
                {sale.payment_status === 'PAID' && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                  </Badge>
                )}
                {isPartial && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] uppercase font-bold">
                    <Clock className="h-3 w-3 mr-1" /> Partial
                  </Badge>
                )}
                {isCredit && (
                  <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 text-[10px] uppercase font-bold">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Credit / Udhar
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground block text-[11px]">Invoice Date</span>
                <span className="font-semibold text-foreground">{saleDateFormatted}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Payment Mode</span>
                <span className="font-semibold text-foreground">{sale.payment_mode || sale.payment_method || 'Cash'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Billed To</span>
                <span className="font-semibold text-foreground truncate block">{customer.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Customer Mobile</span>
                <span className="font-semibold font-mono text-foreground">
                  {formatDisplayMobile(customer.mobile || customer.phone) || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Breakdown */}
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-foreground">Purchased Items ({items.length})</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3 min-w-[200px]">Product</th>
                  <th className="px-4 py-3">Batch / Expiry</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground text-xs">{item.displayName}</p>
                      {item.manufacturer && item.manufacturer !== '-' && (
                        <p className="text-[10px] text-muted-foreground">{item.manufacturer}</p>
                      )}
                      {item.returned_quantity > 0 && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Returned: {item.returned_quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      <div>{item.batch_number || '-'}</div>
                      {item.expiry_date && (
                        <div className="text-[10px] text-muted-foreground/80">{item.expiry_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono">
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(item.unit_price || item.rate || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {item.gst_rate > 0 ? `${item.gst_rate}%` : '0%'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-foreground">
                      {formatCurrency(item.total_amount || item.total || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="p-5 border-t bg-muted/10">
            <div className="max-w-xs ml-auto space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (Items):</span>
                <span className="font-mono">{formatCurrency(sale.total_amount)}</span>
              </div>

              <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(sale.total_amount)}
                </span>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid Amount:</span>
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(sale.paid_amount || 0)}
                </span>
              </div>

              {sale.balance_due > 0 && (
                <div className="flex justify-between text-xs font-bold text-rose-600 dark:text-rose-400 pt-1 border-t">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatCurrency(sale.balance_due)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Records Section (Multi-mode & Partial breakdown) */}
        {payments && payments.length > 0 && (
          <div className="bg-card border rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-foreground">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold">Payment Transactions ({payments.length})</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {payments.map((pmt: any, idx: number) => (
                <div
                  key={pmt.id || idx}
                  className="rounded-xl border bg-muted/30 p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground uppercase tracking-tight">
                      {pmt.payment_method || pmt.method || 'Payment'}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(pmt.amount || 0)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      {pmt.payment_date
                        ? new Date(pmt.payment_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                    {pmt.reference_number && (
                      <span className="font-mono text-[10px]">Ref: {pmt.reference_number}</span>
                    )}
                  </div>
                  {pmt.notes && (
                    <p className="text-[10px] text-muted-foreground italic border-t pt-1">
                      {pmt.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Returns & Credit Notes Section */}
        {returns && returns.length > 0 && (
          <div className="bg-card border border-amber-500/30 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <RotateCcw className="h-4 w-4" />
              <h3 className="text-sm font-bold">Return & Credit Notes ({returns.length})</h3>
            </div>

            <div className="space-y-3">
              {returns.map((ret: any, idx: number) => (
                <div
                  key={ret.id || idx}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-mono font-bold text-foreground text-sm">
                        {ret.return_number || `RET-${idx + 1}`}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Date:{' '}
                        {ret.return_date
                          ? new Date(ret.return_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">Refund Amount</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        {formatCurrency(ret.total_amount || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-amber-500/10 pt-2">
                    <span>
                      Refund Mode:{' '}
                      <strong className="text-foreground">
                        {ret.refund_mode === 'CREDIT_ADJUSTMENT'
                          ? 'Customer Balance Adjustment'
                          : ret.refund_mode || 'Cash'}
                      </strong>
                    </span>
                    {ret.reason && <span>Reason: {ret.reason}</span>}
                  </div>

                  {ret.items && ret.items.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/10">
                      <span className="text-[11px] font-semibold text-foreground block mb-1.5">
                        Returned Items:
                      </span>
                      <div className="divide-y divide-amber-500/10 bg-background/60 rounded-lg border border-amber-500/20">
                        {ret.items.map((rIt: any, rIdx: number) => (
                          <div
                            key={rIt.id || rIdx}
                            className="p-2.5 flex items-center justify-between text-[11px]"
                          >
                            <span className="font-medium text-foreground">{rIt.displayName}</span>
                            <span className="font-mono font-bold text-muted-foreground">
                              {rIt.quantity} qty • {formatCurrency(rIt.total_amount || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Hidden printable invoice container rendered via InvoiceRenderer for pixel-perfect A5 / 80mm printing & PDF */}
      <div
        id="customer-printable-invoice"
        className="fixed -left-[9999px] -top-[9999px] w-auto h-auto opacity-0 pointer-events-none"
      >
        <InvoiceRenderer
          format={printFormat}
          sale={sale}
          shopDetails={shop}
        />
      </div>
    </div>
  );
}
