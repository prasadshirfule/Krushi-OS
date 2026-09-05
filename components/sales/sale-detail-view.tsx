'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, RotateCcw, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { 
  ReferenceTaxInvoice, 
  printInvoiceDirectly, 
  downloadInvoiceAsPDF 
} from '@/components/invoice/reference-tax-invoice';
import { isClientDemoMode, getDemoSalesClient, cancelDemoSaleClient } from '@/lib/client-demo-store';
import { cancelSaleAction } from '@/actions/sales';
import SaleReturnDialog from '@/components/billing/sale-return-dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SaleDetailViewProps {
  initialSale?: any;
  saleId?: string;
  sale?: any;
}

export function SaleDetailView({ initialSale, saleId, sale: directSale }: SaleDetailViewProps) {
  const router = useRouter();
  const [currentSale, setCurrentSale] = useState<any>(directSale || initialSale);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!currentSale && isClientDemoMode() && saleId) {
      const demoSales = getDemoSalesClient();
      const found = demoSales.find((s: any) => s.id === saleId);
      if (found) setCurrentSale(found);
    } else if (directSale || initialSale) {
      setCurrentSale(directSale || initialSale);
    }
  }, [initialSale, saleId, directSale, currentSale]);

  const activeSale = currentSale || { id: saleId || '1' };
  const invNo = activeSale.invoice_number || activeSale.invoiceNumber || (activeSale.id ? (activeSale.id.startsWith('KOS-') ? activeSale.id : `KOS-${activeSale.id.substring(0, 8).toUpperCase()}`) : '1');

  const handlePrint = () => {
    printInvoiceDirectly('printable-tax-invoice');
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadInvoiceAsPDF('printable-tax-invoice', `Invoice-${invNo}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelSale = async () => {
    if (!window.confirm(`Are you sure you want to cancel invoice ${invNo}? Stock will be returned and any credit reversed.`)) {
      return;
    }

    setIsCancelling(true);
    try {
      if (isClientDemoMode()) {
        cancelDemoSaleClient(activeSale.id, 'User cancelled');
        try {
          cancelSaleAction(activeSale.id, 'User cancelled').catch(() => {});
        } catch {}
        toast.success(`Invoice ${invNo} cancelled successfully`);
        const updated = { ...activeSale, status: 'CANCELLED' };
        setCurrentSale(updated);
      } else {
        const res = await cancelSaleAction(activeSale.id, 'User cancelled');
        if (res.success) {
          toast.success(`Invoice ${invNo} cancelled successfully`);
          setCurrentSale({ ...activeSale, status: 'CANCELLED' });
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

  return (
    <div className="bg-muted/30 min-h-screen pb-12 print:bg-white print:p-0">
      {/* ─── ACTION BAR (NO PRINT) ─── */}
      <div className="max-w-[210mm] mx-auto p-4 no-print flex justify-between items-center gap-3 flex-wrap bg-background shadow-sm border-b mb-6 rounded-b-xl">
        <Link href="/sales">
          <Button variant="outline" className="border-border shadow-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {activeSale?.status !== 'CANCELLED' && activeSale?.status !== 'REFUNDED' && (
            <>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 shadow-sm" 
                size="sm"
                onClick={handleCancelSale}
                disabled={isCancelling}
              >
                {isCancelling ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                Cancel Bill
              </Button>
              <Button 
                variant="destructive" 
                className="shadow-sm" 
                size="sm"
                onClick={() => setIsReturnOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Process Return
              </Button>
            </>
          )}
          {activeSale?.status === 'CANCELLED' && (
            <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-950/40 px-2.5 py-1 rounded-full border border-red-200">
              CANCELLED
            </span>
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

      {/* ─── A4 PHYSICAL INVOICE (SCREEN PREVIEW & PRINT) ─── */}
      <div className="max-w-[210mm] mx-auto flex justify-center print:m-0 print:p-0 print:w-full">
        <ReferenceTaxInvoice sale={activeSale} />
      </div>

      {/* ─── SALE RETURN DIALOG ─── */}
      {isReturnOpen && (
        <SaleReturnDialog
          sale={activeSale}
          onClose={() => setIsReturnOpen(false)}
          onSuccess={() => {
            setIsReturnOpen(false);
            setCurrentSale({ ...activeSale, status: 'REFUNDED' });
          }}
        />
      )}
    </div>
  );
}
