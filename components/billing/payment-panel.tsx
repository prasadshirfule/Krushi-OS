'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeSaleAction } from '@/actions/sales';
import { getShopProfileAction } from '@/actions/settings';
import { formatCurrency, generateId } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/constants';
import { CheckCircle2, Loader2, CreditCard, Banknote, QrCode, Building2, BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ShopDetails, getSavedShopDetails } from '@/lib/shop-details';
import { buildUpiUri, generateQrDataUrl } from '@/lib/upi';

import { 
  isClientDemoMode, 
  saveDemoSaleClient 
} from '@/lib/client-demo-store';

interface PaymentPanelProps {
  cart: any[];
  adjustments?: any[];
  totals: any;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerVillage?: string;
  onComplete: (saleId: string, invoiceNumber?: string, completedTotals?: any) => void;
}

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
  Cash: <Banknote className="h-5 w-5 mr-2" />,
  UPI: <QrCode className="h-5 w-5 mr-2" />,
  'Partial Payment': <CreditCard className="h-5 w-5 mr-2" />,
  'Bank Transfer': <Building2 className="h-5 w-5 mr-2" />,
  Credit: <BookOpen className="h-5 w-5 mr-2" />,
};

const METHOD_TO_ENUM: Record<string, 'CASH' | 'UPI' | 'PARTIAL' | 'BANK_TRANSFER' | 'CREDIT'> = {
  Cash: 'CASH',
  UPI: 'UPI',
  'Partial Payment': 'PARTIAL',
  'Bank Transfer': 'BANK_TRANSFER',
  Credit: 'CREDIT',
};

export default function PaymentPanel({ cart, adjustments = [], totals, customerId, customerName, customerPhone, customerVillage, onComplete }: PaymentPanelProps) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [creditPaidAmount, setCreditPaidAmount] = useState<string>('');
  
  // Partial payment split inputs
  const [partialCash, setPartialCash] = useState<string>('');
  const [partialUpi, setPartialUpi] = useState<string>('');
  const [partialBankTransfer, setPartialBankTransfer] = useState<string>('');

  const [shopProfile, setShopProfile] = useState<ShopDetails | null>(null);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState<string>('');

  const payableAmount = Number(totals?.payableAmount || 0);

  // Reset payment split values when cart becomes empty (e.g. on New Bill)
  useEffect(() => {
    if (cart.length === 0) {
      setPartialCash('');
      setPartialUpi('');
      setPartialBankTransfer('');
      setCashTendered('');
      setCreditPaidAmount('');
      setNotes('');
    }
  }, [cart.length]);

  // Load shop profile for dynamic UPI QR code
  useEffect(() => {
    const cached = getSavedShopDetails();
    if (cached) setPersistedShopProfile(cached);

    getShopProfileAction().then(res => {
      if (res?.success && res?.data) {
        setPersistedShopProfile(res.data);
      }
    }).catch(() => {});
  }, []);

  const setPersistedShopProfile = (profile: ShopDetails) => {
    setShopProfile(profile);
  };

  const isPartial = paymentMethod === 'Partial Payment';
  const isCredit = paymentMethod === 'Credit';
  const isPureUpi = paymentMethod === 'UPI';

  // Partial payment calculations
  const partialCashNum = parseFloat(partialCash) || 0;
  const partialUpiNum = parseFloat(partialUpi) || 0;
  const partialBankNum = parseFloat(partialBankTransfer) || 0;
  const partialTotalPaid = partialCashNum + partialUpiNum + partialBankNum;
  const partialRemaining = Math.max(0, payableAmount - partialTotalPaid);
  const isPartialOverpaid = isPartial && partialTotalPaid > payableAmount;

  // Determine UPI QR amount: for Pure UPI = full payableAmount; for Partial Payment = ONLY UPI portion (if > 0)
  const upiQrTargetAmount = isPureUpi ? payableAmount : (isPartial && partialUpiNum > 0 ? partialUpiNum : 0);

  // Dynamically generate QR code
  useEffect(() => {
    const upiId = shopProfile?.upiId?.trim();
    if (!upiId || upiQrTargetAmount <= 0) {
      setUpiQrDataUrl('');
      return;
    }

    const upiUri = buildUpiUri(upiId, shopProfile?.shopName, upiQrTargetAmount);
    generateQrDataUrl(upiUri, { width: 220, margin: 1 }).then(url => {
      setUpiQrDataUrl(url);
    }).catch(err => {
      console.error('Failed to generate UPI QR code:', err);
    });
  }, [upiQrTargetAmount, shopProfile?.upiId, shopProfile?.shopName]);

  const effectiveCustomerName = customerName?.trim() || '';
  const hasCustomer = Boolean(
    (customerId && customerId !== 'walk-in') || 
    (effectiveCustomerName && effectiveCustomerName.toLowerCase() !== 'walk-in')
  );

  // A customer is required if full credit, OR if partial payment has remaining balance > 0
  const creditError = (isCredit || (isPartial && partialRemaining > 0)) && !hasCustomer;

  const isSaleDisabled =
    cart.length === 0 ||
    payableAmount <= 0 ||
    isSubmitting ||
    creditError ||
    isPartialOverpaid ||
    (isPartial && partialTotalPaid === 0);

  // Cash change calculation
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeToReturn = tenderedNum > payableAmount ? tenderedNum - payableAmount : 0;

  // Credit partial payment calculation
  const creditPaidNum = parseFloat(creditPaidAmount) || 0;
  const currentUdhari = isCredit ? Math.max(0, payableAmount - creditPaidNum) : 0;

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
    if (isCredit && creditPaidNum > payableAmount) {
      toast.warning('Amount paid cannot exceed bill total.');
      return;
    }
    if (isPartial) {
      if (partialTotalPaid > payableAmount) {
        toast.error('Payment amount cannot exceed the final bill amount.');
        return;
      }
      if (partialTotalPaid === 0 && !hasCustomer) {
        toast.warning('Please enter payment amounts for partial payment.');
        return;
      }
    }
    if (creditError) {
      toast.error('A registered customer is required for credit / outstanding sales. Please select or add a customer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = generateId();

      // Format items to match saleItemSchema while preserving complete transaction product metadata
      const formattedItems = cart.map(item => {
        const discAmt = Number(item.discount_amount !== undefined ? item.discount_amount : (item.discount || 0));
        return {
          product_id: item.product_id || item.id,
          product: item.product || item,
          product_name: item.product_name || item.name || item.product?.name || 'Product',
          batch_id: item.batch_id || undefined,
          batch_number: item.batch_number || item.batch?.batch_number || item.product?.batch_number || '',
          hsn_code: item.hsn_code || item.product?.hsn_code || item.product?.hsnCode || '',
          expiry_date: item.expiry_date || item.batch?.expiry_date || item.product?.expiry_date || '',
          unit: item.unit || item.product?.unit || '',
          pack_size: item.pack_size || item.product?.pack_size || '',
          product_size_value: item.product_size_value ?? item.product?.product_size_value,
          product_size_unit: item.product_size_unit ?? item.product?.product_size_unit,
          manufacturer: item.product?.manufacturer || item.product?.brand?.manufacturer || item.product?.brand?.name || item.manufacturer || '',
          quantity: Math.max(1, Number(item.quantity) || 1),
          unit_price: Number(item.rate) || 0,
          selling_price: Number(item.rate) || 0,
          rate: Number(item.rate) || 0,
          discount_amount: discAmt,
          discount: discAmt,
          discount_percent: Number(item.discount_percent || 0),
          gst_rate: Number(item.gst_rate) || 0,
        };
      });

      // Format bill adjustments
      const formattedAdjustments = (adjustments || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        reason: a.reason === 'Other' && a.customReason ? a.customReason : a.reason,
        amount: Number(a.amount) || 0,
        tax_treatment: a.taxTreatment || 'NON_TAXABLE',
        taxTreatment: a.taxTreatment || 'NON_TAXABLE',
      }));

      // Format payment splits
      let formattedPayments: Array<{ method: 'CASH' | 'UPI' | 'PARTIAL' | 'BANK_TRANSFER' | 'CREDIT'; amount: number }> = [];
      let actualPaidAmount = payableAmount;
      let partialPaymentObj: any = null;

      if (isPartial) {
        actualPaidAmount = partialTotalPaid;
        if (partialCashNum > 0) {
          formattedPayments.push({ method: 'CASH', amount: partialCashNum });
        }
        if (partialUpiNum > 0) {
          formattedPayments.push({ method: 'UPI', amount: partialUpiNum });
        }
        if (partialBankNum > 0) {
          formattedPayments.push({ method: 'BANK_TRANSFER', amount: partialBankNum });
        }
        if (partialRemaining > 0) {
          formattedPayments.push({ method: 'CREDIT', amount: partialRemaining });
        }
        if (formattedPayments.length === 0) {
          formattedPayments.push({ method: 'CASH', amount: payableAmount });
        }

        partialPaymentObj = {
          cash: partialCashNum,
          upi: partialUpiNum,
          bank_transfer: partialBankNum,
          bankTransfer: partialBankNum,
          total_paid: partialTotalPaid,
          totalPaid: partialTotalPaid,
          remaining: partialRemaining,
        };
      } else if (isCredit) {
        actualPaidAmount = creditPaidNum;
        formattedPayments = [
          {
            method: 'CREDIT',
            amount: creditPaidNum,
          },
        ];
      } else {
        const methodEnum = METHOD_TO_ENUM[paymentMethod] || 'CASH';
        actualPaidAmount = payableAmount;
        formattedPayments = [
          {
            method: methodEnum,
            amount: payableAmount,
          },
        ];
      }

      const customerDisplayName = effectiveCustomerName ? effectiveCustomerName.toUpperCase() : (hasCustomer ? 'CUSTOMER' : 'WALK-IN CUSTOMER');
      const cleanVillage = (customerVillage || '').toUpperCase().trim();

      const isUuidCustomer = customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
      const saleData = {
        customer_id: hasCustomer && isUuidCustomer ? customerId : null,
        customer_name: customerDisplayName,
        customer_phone: customerPhone || '',
        customer_village: cleanVillage,
        customer: {
          id: customerId || (hasCustomer ? `cust-${Date.now()}` : 'walk-in'),
          name: customerDisplayName,
          phone: customerPhone || '',
          village: cleanVillage,
        },
        items: formattedItems,
        adjustments: formattedAdjustments,
        payments: formattedPayments,
        partial_payment: partialPaymentObj,
        partialPayment: partialPaymentObj,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
        // Legacy fallback fields
        payment_method: isPartial ? 'PARTIAL' : paymentMethod,
        payment_mode: isPartial ? 'PARTIAL' : paymentMethod,
        totals,
        paid_amount: actualPaidAmount,
      };

      if (isClientDemoMode()) {
        const savedSale = saveDemoSaleClient(saleData);
        // Safely invoke server action for any server cache invalidation
        try {
          completeSaleAction(saleData).catch(() => {});
        } catch {}

        toast.success('Bill completed successfully!');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('krushi-sales-updated'));
          window.dispatchEvent(new CustomEvent('krushi-products-updated'));
          window.dispatchEvent(new CustomEvent('krushi-customers-updated'));
        }
        router.refresh();
        const saleId = savedSale.id || `sale-${Date.now()}`;
        const invNo = savedSale.invoice_number || savedSale.invoiceNumber;
        onComplete(saleId, invNo, { ...totals, partial_payment: partialPaymentObj, payment_method: isPartial ? 'PARTIAL' : paymentMethod });
      } else {
        const result = await completeSaleAction(saleData);

        if (result.success) {
          toast.success('Bill completed successfully!');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('krushi-sales-updated', { detail: result.data }));
            window.dispatchEvent(new CustomEvent('krushi-products-updated'));
            window.dispatchEvent(new CustomEvent('krushi-customers-updated'));
          }
          router.refresh();
          const saleId = result.data?.sale_id || result.data?.id || result.data?.saleId;
          const invNo = result.data?.invoice_number || result.data?.invoiceNumber;
          onComplete(saleId, invNo, { ...totals, partial_payment: partialPaymentObj, payment_method: isPartial ? 'PARTIAL' : paymentMethod });
        } else {
          toast.error(result.error || 'Unable to complete bill. Please try again.');
        }
      }
    } catch (error) {
      toast.error('Unable to complete bill. Please try again.');
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
              className={`h-14 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'bg-background/60 hover:bg-accent hover:border-primary/40 text-foreground border border-border'
              }`}
              onClick={() => {
                setPaymentMethod(method);
              }}
            >
              {PAYMENT_METHOD_ICONS[method]}
              {method}
            </Button>
          );
        })}
      </div>

      {/* ─── Partial Payment Overpaid Error Banner ─── */}
      {isPartialOverpaid && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3.5 flex items-center gap-2.5 text-destructive text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <span>Payment amount cannot exceed the final bill amount.</span>
        </div>
      )}

      {/* ─── Credit / Partial Remaining Warning Banner ─── */}
      {creditError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-amber-300 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <span>
            <strong>Customer required for remaining balance (Credit / Udhaar).</strong> Please select or add a customer in the Customer section at the top.
          </span>
        </div>
      )}

      {/* ─── Partial Payment Breakdown Section ─── */}
      {isPartial && payableAmount > 0 && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                PARTIAL PAYMENT BREAKDOWN
              </h3>
              <p className="text-xs text-muted-foreground">
                Enter amount paid through each payment method
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
              Total Bill: {formatCurrency(payableAmount)}
            </span>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Cash Input */}
            <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  Cash Amount
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-primary hover:underline"
                  onClick={() => {
                    const otherPaid = partialUpiNum + partialBankNum;
                    const rem = Math.max(0, payableAmount - otherPaid);
                    setPartialCash(rem > 0 ? rem.toString() : '');
                  }}
                >
                  Fill Balance
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-bold">₹</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={partialCash}
                  onChange={e => setPartialCash(e.target.value)}
                  className="h-10 text-base font-bold font-mono bg-card border-border text-foreground"
                />
              </div>
            </div>

            {/* UPI Input */}
            <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-blue-600" />
                  UPI Amount
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-primary hover:underline"
                  onClick={() => {
                    const otherPaid = partialCashNum + partialBankNum;
                    const rem = Math.max(0, payableAmount - otherPaid);
                    setPartialUpi(rem > 0 ? rem.toString() : '');
                  }}
                >
                  Fill Balance
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-bold">₹</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={partialUpi}
                  onChange={e => setPartialUpi(e.target.value)}
                  className="h-10 text-base font-bold font-mono bg-card border-border text-foreground"
                />
              </div>
            </div>

            {/* Bank Transfer Input */}
            <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  Bank Transfer
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] text-primary hover:underline"
                  onClick={() => {
                    const otherPaid = partialCashNum + partialUpiNum;
                    const rem = Math.max(0, payableAmount - otherPaid);
                    setPartialBankTransfer(rem > 0 ? rem.toString() : '');
                  }}
                >
                  Fill Balance
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-bold">₹</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={partialBankTransfer}
                  onChange={e => setPartialBankTransfer(e.target.value)}
                  className="h-10 text-base font-bold font-mono bg-card border-border text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Partial Payment Summary Card */}
          <div className="bg-background/80 border border-border rounded-lg p-3.5 space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted-foreground font-medium">
              <span>Total Bill (Final with GST & Adjustments):</span>
              <span className="font-mono font-bold text-foreground">{formatCurrency(payableAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground font-medium">
              <span>Total Paid:</span>
              <span className="font-mono font-bold text-emerald-600">{formatCurrency(partialTotalPaid)}</span>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between font-bold">
              <span>Remaining Balance:</span>
              <span className={`font-mono text-base ${partialRemaining > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                {formatCurrency(partialRemaining)}
              </span>
            </div>
            {partialRemaining > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                * Remaining ₹{partialRemaining.toFixed(2)} will be recorded under customer&apos;s Credit/Udhar ledger.
              </p>
            )}
          </div>

          {/* Dynamic UPI QR for Partial Payment portion */}
          {partialUpiNum > 0 && shopProfile?.upiId && (
            <div className="bg-white text-slate-900 border-2 border-slate-300 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col items-center justify-center shrink-0">
                {upiQrDataUrl ? (
                  <img
                    src={upiQrDataUrl}
                    alt="UPI Partial QR Code"
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-[11px] mt-1 font-semibold">Generating QR...</span>
                  </div>
                )}
                <span className="text-[10px] font-black tracking-wider uppercase mt-1 text-slate-800">
                  Scan to Pay UPI Portion
                </span>
              </div>
              <div className="space-y-1.5 text-left flex-1">
                <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded">
                  UPI Portion QR Code
                </div>
                <div className="text-xs text-slate-600 font-semibold">
                  UPI ID: <span className="font-mono text-slate-900 font-bold">{shopProfile.upiId}</span>
                </div>
                <div className="text-xl font-black text-blue-700 font-mono">
                  {formatCurrency(partialUpiNum)}
                </div>
                <p className="text-[11px] text-slate-500">
                  This QR code is configured for ONLY the UPI portion (₹{partialUpiNum.toFixed(2)}). Cash and Bank Transfer portions are paid separately.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Dynamic UPI Payment & QR Code Section (Pure UPI) ─── */}
      {paymentMethod === 'UPI' && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                UPI PAYMENT
              </h3>
              <p className="text-xs text-muted-foreground">
                Scan to Pay using any UPI App (GPay, PhonePe, Paytm, BHIM)
              </p>
            </div>
            {shopProfile?.upiId && (
              <span className="text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                Exact Bill QR
              </span>
            )}
          </div>

          {shopProfile?.upiId ? (
            <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
              {/* Dynamic QR Display */}
              <div className="bg-white p-3 rounded-xl border-2 border-slate-300 shadow-sm flex flex-col items-center justify-center shrink-0">
                {upiQrDataUrl ? (
                  <img
                    src={upiQrDataUrl}
                    alt="UPI Payment QR Code"
                    className="w-44 h-44 object-contain rounded-md"
                  />
                ) : (
                  <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-semibold">Generating QR...</span>
                  </div>
                )}
                <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase mt-1">
                  Scan to Pay
                </span>
              </div>

              {/* Payment Details */}
              <div className="flex-1 space-y-3 w-full text-left">
                <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold block">UPI ID:</span>
                  <span className="text-base font-black font-mono text-foreground break-all">
                    {shopProfile.upiId}
                  </span>
                </div>

                <div className="bg-background border border-border rounded-lg p-3 space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold block">Amount:</span>
                  <span className="text-2xl font-black text-primary font-mono">
                    {formatCurrency(payableAmount)}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    (Final bill total including GST and all adjustments)
                  </span>
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  Amount updates automatically with items or adjustments.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3 text-amber-300">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-300">UPI ID Not Configured</h4>
                  <p className="text-xs text-amber-200/90 mt-0.5">
                    UPI ID not configured. Please add your UPI ID in Settings → Shop Profile.
                  </p>
                </div>
              </div>
              <div className="pt-1">
                <Link href="/settings?tab=shop">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-400/50 text-amber-300 hover:bg-amber-400/10 text-xs font-semibold"
                  >
                    Configure UPI in Settings
                  </Button>
                </Link>
              </div>
            </div>
          )}
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

      {/* ─── Credit Partial Payment Calculator ─── */}
      {isCredit && payableAmount > 0 && !creditError && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-foreground block mb-1">
                Amount Paid Now (Optional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-bold">₹</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={creditPaidAmount}
                  onChange={e => setCreditPaidAmount(e.target.value)}
                  className="h-10 text-lg font-bold bg-background border-border text-foreground max-w-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter the amount received now. Remaining amount will be added to Udhari.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border space-y-1">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Bill Total:</span>
              <span>{formatCurrency(payableAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Amount Paid:</span>
              <span>{formatCurrency(creditPaidNum)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-foreground pt-1">
              <span>Remaining Udhari:</span>
              <span className="text-red-600 font-bold">{formatCurrency(currentUdhari)}</span>
            </div>
          </div>
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
