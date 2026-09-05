'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Printer, FileText, PlusCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { generateInvoicePDF } from '@/lib/invoice';
import { isClientDemoMode } from '@/lib/client-demo-store';
import { getSaleAction } from '@/actions/sales';
import { toast } from 'sonner';
import { 
  ReferenceTaxInvoice, 
  printInvoiceDirectly, 
  downloadInvoiceAsPDF 
} from '@/components/invoice/reference-tax-invoice';

interface BillSuccessDialogProps {
  saleId: string;
  invoiceNumber?: string;
  totals: any;
  onClose: () => void;
}

export default function BillSuccessDialog({ saleId, invoiceNumber, totals, onClose }: BillSuccessDialogProps) {
  const newBillBtnRef = useRef<HTMLButtonElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saleData, setSaleData] = useState<any>(null);

  useEffect(() => {
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
          const s = sales.find((item: any) => item.id === saleId);
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

  const handlePrint = async (type: string) => {
    setIsGenerating(true);
    try {
      let currentSale = saleData;

      if (!currentSale) {
        if (isClientDemoMode()) {
          const { getDemoSalesClient } = await import('@/lib/client-demo-store');
          const sales = getDemoSalesClient();
          currentSale = sales.find((s: any) => s.id === saleId);
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
        if (invoiceElement) {
          await downloadInvoiceAsPDF('bill-success-invoice', `Invoice-${currentSale.invoice_number || displayInv}.pdf`);
        } else {
          const pdf = generateInvoicePDF(currentSale);
          pdf.save(`${currentSale.invoice_number || displayInv}.pdf`);
        }
      } else {
        // Direct print
        if (invoiceElement) {
          printInvoiceDirectly('bill-success-invoice');
        } else {
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

  const displayInv = invoiceNumber || (saleId.startsWith('KOS-') ? saleId : `KOS-${saleId.substring(0, 8).toUpperCase()}`);

  return (
    <>
      {/* Hidden invoice container in DOM for instant printing & canvas PDF capture */}
      <div 
        className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div id="bill-success-invoice">
          <ReferenceTaxInvoice sale={saleData || { id: saleId, invoice_number: displayInv }} />
        </div>
      </div>

      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">Sale Completed Successfully!</DialogTitle>
            <DialogDescription className="text-center font-mono font-bold text-foreground text-sm">
              Invoice #{displayInv}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted p-4 rounded-md my-4">
            <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totals.payableAmount)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <Button variant="outline" onClick={() => handlePrint('a4')} className="w-full" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} Print Bill
            </Button>
            <Button variant="outline" onClick={() => handlePrint('pdf')} className="w-full" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} Download PDF
            </Button>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
            <Button 
              ref={newBillBtnRef}
              onClick={onClose} 
              className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
            >
              <PlusCircle className="mr-2 h-5 w-5" /> New Bill (Enter)
            </Button>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Link href={`/sales/${saleId}`} className="w-full">
                <Button variant="outline" className="w-full">
                  View Invoice
                </Button>
              </Link>
              <Link href="/sales" className="w-full">
                <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10">
                  Sales History
                </Button>
              </Link>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
