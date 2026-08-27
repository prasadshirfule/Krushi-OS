'use client';

import React, { useState, useEffect } from 'react';
import { CustomerSelector } from '@/components/customers/customer-selector';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { completeSaleAction } from '@/actions/sales';
import { formatCurrency, numberToWords, generateId } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/constants';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentPanelProps {
  cart: any[];
  totals: any;
  onComplete: (saleId: string) => void;
}

export default function PaymentPanel({ cart, totals, onComplete }: PaymentPanelProps) {
  const [customerId, setCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        handleCompleteSale();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerId, paymentMethod, totals]);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'Credit' && !customerId) {
      toast.error('Customer is required for credit sales');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateId();
      const saleData = {
        customer_id: customerId || null,
        items: cart,
        totals,
        payment_method: paymentMethod,
        notes,
        idempotency_key: idempotencyKey
      };

      const result = await completeSaleAction(saleData);
      
      if (result.success) {
        toast.success('Sale completed successfully');
        onComplete(result.data?.id || result.data?.saleId || '');
      } else {
        toast.error(result.error || 'Failed to complete sale');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <Label className="mb-2 block">Customer (Optional)</Label>
        <CustomerSelector value={customerId} onChange={setCustomerId} />
      </div>

      <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm border">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(totals.subtotal || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discount</span>
          <span className="text-destructive">-{formatCurrency(totals.totalDiscount || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CGST</span>
          <span>{formatCurrency(totals.cgst || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SGST</span>
          <span>{formatCurrency(totals.sgst || 0)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 mt-2">
          <span className="text-muted-foreground">Round Off</span>
          <span>{formatCurrency(totals.roundOff || 0)}</span>
        </div>
        <div className="flex justify-between items-end border-t pt-2 mt-2">
          <span className="font-semibold text-lg">Grand Total</span>
          <span className="font-bold text-3xl text-green-700">{formatCurrency(totals.payableAmount || 0)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground italic text-right mt-1">
          {numberToWords(totals.payableAmount || 0)}
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <Label>Payment Method</Label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(method => (
            <Button
              key={method}
              type="button"
              variant={paymentMethod === method ? 'default' : 'outline'}
              className={paymentMethod === method ? 'bg-primary' : ''}
              onClick={() => setPaymentMethod(method)}
            >
              {method}
            </Button>
          ))}
        </div>
        {paymentMethod === 'Credit' && !customerId && (
          <div className="text-xs text-destructive mt-1">
            ⚠️ Please select a customer for credit sale.
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button 
          className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700" 
          onClick={handleCompleteSale}
          disabled={cart.length === 0 || isSubmitting || (paymentMethod === 'Credit' && !customerId)}
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Processing...</>
          ) : (
            <><CheckCircle2 className="mr-2 h-6 w-6" /> COMPLETE SALE (F8)</>
          )}
        </Button>
      </div>
    </div>
  );
}
