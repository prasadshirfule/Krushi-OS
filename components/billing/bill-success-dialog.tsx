'use client';

import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, Printer, FileText, PlusCircle } from 'lucide-react';
import Link from 'next/link';

interface BillSuccessDialogProps {
  saleId: string;
  totals: any;
  onClose: () => void;
}

export default function BillSuccessDialog({ saleId, totals, onClose }: BillSuccessDialogProps) {
  const newBillBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Auto-focus New Bill button
    setTimeout(() => {
      newBillBtnRef.current?.focus();
    }, 100);
  }, []);

  const handlePrint = (type: string) => {
    // In a real app, this would open a new window with print styles or call a print API
    console.log(`Printing ${type} for sale ${saleId}`);
    window.open(`/api/print/sale/${saleId}?type=${type}`, '_blank');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center">Sale Completed Successfully!</DialogTitle>
          <DialogDescription className="text-center">
            Invoice #{saleId.substring(0, 8).toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted p-4 rounded-md my-4">
          <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
          <div className="text-3xl font-bold text-primary">{formatCurrency(totals.payableAmount)}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <Button variant="outline" onClick={() => handlePrint('a4')} className="w-full">
            <Printer className="mr-2 h-4 w-4" /> Print A4
          </Button>
          <Button variant="outline" onClick={() => handlePrint('80mm')} className="w-full">
            <Printer className="mr-2 h-4 w-4" /> Thermal 80mm
          </Button>
          <Button variant="outline" onClick={() => handlePrint('pdf')} className="w-full col-span-2">
            <FileText className="mr-2 h-4 w-4" /> Download PDF
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
  );
}
