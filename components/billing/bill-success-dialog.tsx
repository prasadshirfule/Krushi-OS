'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Printer, FileText, PlusCircle, Loader2, Download, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { isClientDemoMode } from '@/lib/client-demo-store';
import { getSaleAction } from '@/actions/sales';
import { getShopProfileAction } from '@/actions/settings';
import { getSavedShopDetails } from '@/lib/shop-details';
import { toast } from 'sonner';
import { 
  InvoiceRenderer, 
  InvoicePrintFormat, 
  printInvoiceDirectly, 
  downloadInvoicePDF 
} from '@/components/invoice/invoice-renderer';
import { InvoiceFormatSelector } from '@/components/invoice/invoice-format-selector';

import { useLanguage } from '@/lib/i18n';

interface BillSuccessDialogProps {
  saleId: string;
  invoiceNumber?: string;
  totals: any;
  onClose: () => void;
}

export default function BillSuccessDialog({ saleId, invoiceNumber, totals, onClose }: BillSuccessDialogProps) {
  const { t } = useLanguage();
  const newBillBtnRef = useRef<HTMLButtonElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);

  // Temporary print format state for THIS current bill only (NOT saved to Supabase or localStorage)
  const [selectedFormat, setSelectedFormat] = useState<InvoicePrintFormat>('A5');

  useEffect(() => {
    // 1. Initialise temporary format with shop's saved default preference
    const saved = getSavedShopDetails();
    if (saved?.defaultBillFormat) {
      setSelectedFormat(saved.defaultBillFormat);
    }

    getShopProfileAction().then((res) => {
      if (res.success && res.data?.defaultBillFormat) {
        setSelectedFormat(res.data.defaultBillFormat);
      }
    }).catch(() => {});

    // Auto-focus New Bill button
    setTimeout(() => {
      newBillBtnRef.current?.focus();
    }, 100);

    // Pre-fetch sale data for instant printing & PDF generation
    const loadSale = async () => {
      try {
        if (isClientDemoMode()) {
          const { getDemoSalesClient } = await import('@/lib/client-demo-store');
          const sales = getDemoSalesClient();
          const s = sales.find((item: any) => item.id === saleId || item.invoice_number === saleId || item.invoiceNumber === saleId);
          if (s) setSaleData(s);
        } else {
          const res = await getSaleAction(saleId);
          if (res.success && res.data) {
            setSaleData(res.data);
          }
        }
      } catch (e) {
        console.warn('Error loading sale for invoice dialog:', e);
      }
    };

    loadSale();
  }, [saleId]);

  const handlePrint = async (type: 'print' | 'pdf') => {
    setIsGenerating(true);
    try {
      let currentSale = saleData;

      if (!currentSale) {
        if (isClientDemoMode()) {
          const { getDemoSalesClient } = await import('@/lib/client-demo-store');
          const sales = getDemoSalesClient();
          currentSale = sales.find((s: any) => s.id === saleId || s.invoice_number === saleId || s.invoiceNumber === saleId);
        } else {
          const res = await getSaleAction(saleId);
          if (res.success && res.data) {
            currentSale = res.data;
          }
        }
      }

      if (!currentSale) {
        toast.error('Sale not found. Cannot generate invoice.');
        setIsGenerating(false);
        return;
      }

      if (!saleData && currentSale) {
        setSaleData(currentSale);
        await new Promise((r) => setTimeout(r, 60));
      }

      // Check if rendered DOM node is present
      const invoiceElement = document.getElementById('bill-success-invoice');

      if (type === 'pdf') {
        await downloadInvoicePDF(
          'bill-success-invoice',
          `Invoice-${currentSale.invoice_number || displayInv}.pdf`,
          selectedFormat,
          currentSale
        );
      } else {
        // Direct print
        if (invoiceElement) {
          printInvoiceDirectly('bill-success-invoice', selectedFormat);
        } else {
          const { generateInvoicePDF } = await import('@/lib/invoice');
          const pdf = generateInvoicePDF(currentSale);
          const blobUrl = pdf.output('bloburl');
          window.open(blobUrl, '_blank');
        }
      }
    } catch (err) {
      console.error('Print error:', err);
      toast.error('Failed to generate invoice.');
    } finally {
      setIsGenerating(false);
    }
  };

  const displayInv = invoiceNumber || saleData?.invoice_number || (saleId.startsWith('KOS-') ? saleId : `KOS-${saleId.substring(0, 8).toUpperCase()}`);
  const displayTotal = Number(totals?.payableAmount ?? totals?.total_amount ?? totals?.grand_total ?? saleData?.total_amount ?? saleData?.grand_total ?? 0);
  const rawPayment = saleData?.payment_method || saleData?.payment_mode || totals?.payment_method || saleData?.payments?.[0]?.method || 'Cash';
  const isPartial = String(rawPayment).toUpperCase().includes('PARTIAL') || (Array.isArray(saleData?.payments) && saleData.payments.length > 1) || Boolean(totals?.partial_payment || saleData?.partial_payment);
  const displayPayment = isPartial ? 'PARTIAL' : (String(rawPayment).toUpperCase() === 'UPI' ? 'UPI' : String(rawPayment).toUpperCase());

  // Partial breakdown
  const pp = totals?.partial_payment || totals?.partialPayment || saleData?.partial_payment || saleData?.partialPayment;
  const partialCash = Number(pp?.cash || 0);
  const partialUpi = Number(pp?.upi || 0);
  const partialBank = Number(pp?.bank_transfer || pp?.bankTransfer || 0);
  const partialPaid = Number(pp?.total_paid || pp?.totalPaid || (partialCash + partialUpi + partialBank));
  const partialRemaining = Number(pp?.remaining !== undefined ? pp.remaining : Math.max(0, displayTotal - partialPaid));

  const preparedSale = saleData || {
    id: saleId,
    invoice_number: displayInv,
    total_amount: displayTotal,
    grand_total: displayTotal,
    adjustments: totals?.adjustments || [],
    customer_name: totals?.customer_name,
    customer_phone: totals?.customer_phone,
    payment_method: displayPayment,
    partial_payment: pp,
  };

  return (
    <>
      {/* Hidden invoice container in DOM for instant printing & canvas PDF capture */}
      <div 
        className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div id="bill-success-invoice">
          <InvoiceRenderer 
            format={selectedFormat} 
            sale={preparedSale} 
          />
        </div>
      </div>

      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-3">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">Sale Completed Successfully!</DialogTitle>
            <DialogDescription className="text-center font-mono font-bold text-foreground text-sm">
              Invoice #{displayInv}
            </DialogDescription>
          </DialogHeader>

          {/* Amount & Payment Info */}
          <div className="bg-muted/80 p-3.5 rounded-lg my-2 space-y-2 border">
            <div>
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="text-2xl font-black text-primary">{formatCurrency(displayTotal)}</div>
            </div>
            <div className="pt-1.5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">Payment:</span>
              <span className="font-bold text-foreground uppercase tracking-wider">{displayPayment}</span>
            </div>

            {isPartial && (
              <div className="pt-1 border-t border-border/70 space-y-1 text-xs text-left">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(partialPaid > 0 ? partialPaid : displayTotal)}</span>
                </div>
                {partialCash > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Cash:</span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(partialCash)}</span>
                  </div>
                )}
                {partialUpi > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>UPI:</span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(partialUpi)}</span>
                  </div>
                )}
                {partialBank > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Bank Transfer:</span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(partialBank)}</span>
                  </div>
                )}
                {partialRemaining > 0 && (
                  <div className="flex items-center justify-between font-bold text-red-600 pt-0.5 border-t border-dashed border-border/70">
                    <span>Remaining (Credit):</span>
                    <span className="font-mono">{formatCurrency(partialRemaining)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Print Format Selector (Temporary Choice for this Bill) */}
          <div className="text-left bg-card p-3 rounded-lg border my-2">
            <InvoiceFormatSelector
              value={selectedFormat}
              onChange={(newFormat) => setSelectedFormat(newFormat)}
            />
          </div>

          {/* Direct Action Buttons: Download PDF + Print Bill */}
          <div className="grid grid-cols-2 gap-2.5 w-full mb-2">
            <Button
              onClick={() => handlePrint('pdf')}
              disabled={isGenerating}
              variant="outline"
              className="h-11 border-border hover:bg-accent text-foreground font-bold shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 text-rose-500" />
              )}
              {t('billing.downloadPdf', 'Download PDF')}
            </Button>

            <Button
              onClick={() => handlePrint('print')}
              disabled={isGenerating}
              className="h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {t('billing.printInvoice', 'Print Bill')}
            </Button>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 mt-3">
            <Button 
              ref={newBillBtnRef}
              onClick={onClose} 
              className="w-full h-11 text-base bg-green-600 hover:bg-green-700 font-bold"
            >
              <PlusCircle className="mr-2 h-5 w-5" /> {t('billing.newBillEnter', 'New Bill (Enter)')}
            </Button>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Link href={`/sales/${saleId}`} className="w-full">
                <Button variant="outline" size="sm" className="w-full">
                  {t('billing.viewInvoice', 'View Invoice')}
                </Button>
              </Link>
              <Link href="/sales" className="w-full">
                <Button variant="outline" size="sm" className="w-full border-primary/50 text-primary hover:bg-primary/10">
                  {t('billing.salesHistory', 'Sales History')}
                </Button>
              </Link>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
