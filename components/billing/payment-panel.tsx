'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeSaleAction } from '@/actions/sales';
import { formatCurrency, generateId } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/constants';
import { CheckCircle2, Loader2, CreditCard, Banknote, QrCode, Building2, BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentPanelProps {
  cart: any[];
  totals: any;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  onComplete: (saleId: string) => void;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  Cash: <Banknote className="h-5 w-5 mr-2" />,
  UPI: <QrCode className="h-5 w-5 mr-2" />,
  Card: <CreditCard className="h-5 w-5 mr-2" />,
  'Bank Transfer': <Building2 className="h-5 w-5 mr-2" />,
  Credit: <BookOpen className="h-5 w-5 mr-2" />,
};

const METHOD_TO_ENUM: Record<string, 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT'> = {
  Cash: 'CASH',
  UPI: 'UPI',
  Card: 'CARD',
  'Bank Transfer': 'BANK_TRANSFER',
  Credit: 'CREDIT',
};

export default function PaymentPanel({ cart, totals, customerId, customerName, customerPhone, onComplete }: PaymentPanelProps) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [cashTendered, setCashTendered] = useState<string>('');

  const payableAmount = Number(totals?.payableAmount || 0);
  const isCredit = paymentMethod === 'Credit';
  const effectiveCustomerName = customerName?.trim() || '';
  const hasCustomer = Boolean(
    (customerId && customerId !== 'walk-in') || 
    (effectiveCustomerName && effectiveCustomerName.toLowerCase() !== 'walk-in')
  );
  const creditError = isCredit && !hasCustomer;

  const isSaleDisabled =
    cart.length === 0 ||
    payableAmount <= 0 ||
    isSubmitting ||
    creditError;

  // Cash change calculation
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeToReturn = tenderedNum > payableAmount ? tenderedNum - payableAmount : 0;

  // F8 Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length === 0) {
          toast.warning('Cart is empty. Please add products to complete the bill.');
          return;
        }
        if (payableAmount <= 0) {
          toast.warning('Total amount must be greater than ₹0.');
          return;
        }
        if (creditError) {
          toast.error('Customer is required for credit (Udhaar) sales. Please select customer at top.');
          return;
        }
        if (!isSubmitting) {
          handleCompleteSale();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerId, paymentMethod, totals, payableAmount, isSubmitting, creditError]);

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty. Add products before completing the bill.');
      return;
    }
    if (payableAmount <= 0) {
      toast.warning('Total amount must be greater than ₹0.');
      return;
    }
    if (creditError) {
      toast.error('A registered customer is required for credit sales. Please select or add a customer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateId();

      // Format items to match saleItemSchema
      const formattedItems = cart.map(item => ({
        product_id: item.product_id || item.id,
        batch_id: item.batch_id || undefined,
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Number(item.rate) || 0,
        discount_percent: Number(item.discount) || 0,
        gst_rate: Number(item.gst_rate) || 0,
      }));

      // Format payment to match paymentSplitSchema
      const methodEnum = METHOD_TO_ENUM[paymentMethod] || 'CASH';
      const formattedPayments = [
        {
          method: methodEnum,
          amount: payableAmount,
        },
      ];

      const customerDisplayName = effectiveCustomerName || (hasCustomer ? 'Customer' : 'Walk-in Customer');

      const saleData = {
        customer_id: hasCustomer ? (customerId || `cust-${Date.now()}`) : null,
        customer_name: customerDisplayName,
        customer_phone: customerPhone || '',
        customer: {
          id: customerId || (hasCustomer ? `cust-${Date.now()}` : 'walk-in'),
          name: customerDisplayName,
          phone: customerPhone || '',
        },
        items: formattedItems,
        payments: formattedPayments,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
        // Legacy fallback fields
        payment_method: paymentMethod,
        totals,
      };

      const result = await completeSaleAction(saleData);

      if (result.success) {
        toast.success('Bill completed successfully!');
        router.refresh();
        const saleId = result.data?.id || result.data?.saleId || `sale-${Date.now()}`;
        onComplete(saleId);
      } else {
        toast.error(result.error || 'Failed to complete sale');
      }
    } catch (error) {
      toast.error('An unexpected error occurred while completing the bill');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-5 text-card-foreground">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payment Method</h2>
          <span className="text-xs text-muted-foreground font-medium">
            Select how the customer is paying
          </span>
        </div>
      </div>

      {/* ─── Payment Methods Grid ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {PAYMENT_METHODS.map(method => {
          const isSelected = paymentMethod === method;
          return (
            <Button
              key={method}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              className={`h-14 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'bg-background/60 hover:bg-accent hover:border-primary/40 text-foreground border border-border'
              }`}
              onClick={() => setPaymentMethod(method)}
            >
              {PAYMENT_METHOD_ICONS[method]}
              {method}
            </Button>
          );
        })}
      </div>

      {/* ─── Credit Warning Banner ─── */}
      {creditError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-amber-300 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <span>
            <strong>Credit (Udhaar) requires a customer.</strong> Please select or add a customer in the Customer section at the top of the page.
          </span>
        </div>
      )}

      {/* ─── Cash Tendered & Change Calculator ─── */}
      {paymentMethod === 'Cash' && payableAmount > 0 && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-foreground block mb-1">
                Cash Received from Customer (Optional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-bold">₹</span>
                <Input
                  type="number"
                  placeholder={payableAmount.toString()}
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  className="h-10 text-lg font-bold bg-background border-border text-foreground max-w-xs"
                />
              </div>
            </div>

            {/* Quick cash shortcut buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background border-border text-foreground hover:bg-accent"
                onClick={() => setCashTendered(payableAmount.toString())}
              >
                Exact (₹{payableAmount})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background border-border text-foreground hover:bg-accent"
                onClick={() => setCashTendered((Math.ceil(payableAmount / 100) * 100).toString())}
              >
                ₹{Math.ceil(payableAmount / 100) * 100}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background border-border text-foreground hover:bg-accent"
                onClick={() => setCashTendered((Math.ceil(payableAmount / 500) * 500).toString())}
              >
                ₹{Math.ceil(payableAmount / 500) * 500}
              </Button>
            </div>
          </div>

          {/* Change return result */}
          {tenderedNum >= payableAmount && (
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Change to Return:</span>
              <span className="text-xl font-black text-primary">
                {formatCurrency(changeToReturn)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Notes / Remarks Input (Optional) ─── */}
      <div>
        <Input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Bill notes / remarks (optional)..."
          className="text-sm bg-background/50 border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* ─── Massive COMPLETE BILL Action Button ─── */}
      <div className="pt-2">
        <Button
          type="button"
          onClick={handleCompleteSale}
          disabled={isSaleDisabled}
          className={`w-full h-16 rounded-xl text-xl md:text-2xl font-black transition-all flex items-center justify-center gap-3 shadow-lg ${
            isSaleDisabled
              ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 hover:shadow-xl active:scale-[0.99] cursor-pointer'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              <span>Processing Bill...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-7 w-7 stroke-[2.5]" />
              <span>
                COMPLETE BILL {payableAmount > 0 ? `• ${formatCurrency(payableAmount)}` : ''}
              </span>
              <span className="text-sm font-normal opacity-80 ml-1 hidden sm:inline">(F8)</span>
            </>
          )}
        </Button>

        {/* Helpful status messages under button */}
        {cart.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-2.5">
            Add products to the bill to enable completion
          </p>
        ) : creditError ? (
          <p className="text-xs text-amber-400 font-semibold text-center mt-2.5">
            Select a customer at the top to complete credit sale
          </p>
        ) : null}
      </div>
    </section>
  );
}
