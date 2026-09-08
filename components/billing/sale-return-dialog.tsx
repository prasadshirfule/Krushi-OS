'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { returnSaleAction, getSaleReturnAction } from '@/actions/sales';
import { formatCurrency } from '@/lib/utils';
import { formatProductNameWithSize } from '@/lib/validations';
import { toast } from 'sonner';
import { isClientDemoMode, returnDemoSaleClient } from '@/lib/client-demo-store';
import { 
  RotateCcw, 
  CheckCircle2, 
  Printer, 
  Eye, 
  ArrowLeft, 
  AlertCircle, 
  Check, 
  Loader2, 
  Receipt 
} from 'lucide-react';
import { InvoiceRenderer, printInvoiceDirectly, InvoicePrintFormat } from '@/components/invoice/invoice-renderer';
import { InvoiceFormatSelector } from '@/components/invoice/invoice-format-selector';

interface SaleReturnDialogProps {
  sale: any;
  onClose: () => void;
  onSuccess: () => void;
}

const REFUND_METHODS = [
  { value: 'CREDIT_ADJUSTMENT', label: 'Customer Balance Adjustment' },
  { value: 'CASH', label: 'Cash Refund' },
  { value: 'UPI', label: 'UPI Refund' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CARD', label: 'Card Refund' },
];

const RETURN_REASONS = [
  'Product damaged',
  'Wrong product',
  'Customer changed requirement',
  'Excess quantity',
  'Quality issue',
  'Other',
];

export default function SaleReturnDialog({ sale, onClose, onSuccess }: SaleReturnDialogProps) {
  const [step, setStep] = useState<'input' | 'confirm' | 'success' | 'preview'>('input');
  
  // Initialize items with proper available-to-return logic
  const [returnItems, setReturnItems] = useState<any[]>(() => {
    const rawItems = sale.items || sale.sale_items || [];
    return rawItems.map((item: any) => {
      const origQty = Math.max(0, Number(item.quantity || 0));
      const alreadyReturned = Math.max(0, Number(item.returned_quantity ?? item.returnedQuantity ?? 0));
      const available = Math.max(0, item.available_to_return !== undefined 
        ? Number(item.available_to_return) 
        : (origQty - alreadyReturned)
      );
      
      const p = item.product || {};
      const prodRawName = item.product_name || item.name || p.name || 'Product';
      const packSize = item.pack_size || p.pack_size || '';
      const unit = item.unit || p.unit || '';
      const displayName = formatProductNameWithSize(prodRawName, packSize, unit) || prodRawName;

      const rate = Number(item.unit_price ?? item.selling_price ?? item.rate ?? 0);
      const discPercent = Number(item.discount_percent ?? item.discountPercent ?? 0);

      return {
        ...item,
        displayName,
        origQty,
        alreadyReturned,
        available,
        return_qty: 0,
        rate,
        discPercent,
        error: '',
      };
    });
  });

  const [refundMethod, setRefundMethod] = useState<string>('CREDIT_ADJUSTMENT');
  const [reasonCategory, setReasonCategory] = useState<string>('Customer changed requirement');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Success state payload
  const [createdReturnResult, setCreatedReturnResult] = useState<any>(null);
  const [returnDocData, setReturnDocData] = useState<any>(null);
  const [previewFormat, setPreviewFormat] = useState<InvoicePrintFormat>('A5');

  const invNo = sale.invoice_number || sale.invoiceNumber || (sale.id ? (sale.id.startsWith('KOS-') ? sale.id : `KOS-${sale.id.substring(0, 8).toUpperCase()}`) : 'INV');

  // Handle single item quantity change
  const handleQtyChange = (index: number, val: string) => {
    const item = returnItems[index];
    const newItems = [...returnItems];

    if (val === '') {
      newItems[index] = { ...item, return_qty: 0, error: '' };
      setReturnItems(newItems);
      return;
    }

    const numVal = parseInt(val, 10);
    if (isNaN(numVal) || numVal < 0) {
      newItems[index] = { ...item, return_qty: 0, error: 'Enter a valid positive whole number' };
      setReturnItems(newItems);
      return;
    }

    if (numVal > item.available) {
      newItems[index] = {
        ...item,
        return_qty: numVal,
        error: `Only ${item.available} ${item.available === 1 ? 'unit is' : 'units are'} available to return.`,
      };
    } else {
      newItems[index] = {
        ...item,
        return_qty: numVal,
        error: '',
      };
    }

    setReturnItems(newItems);
  };

  // Return Full Bill: sets every item to its remaining available quantity
  const handleReturnFullBill = () => {
    const updated = returnItems.map(item => ({
      ...item,
      return_qty: item.available,
      error: '',
    }));
    setReturnItems(updated);
    toast.info('Selected full available quantity for all items');
  };

  // Reset all quantities to 0
  const handleClearAll = () => {
    const updated = returnItems.map(item => ({
      ...item,
      return_qty: 0,
      error: '',
    }));
    setReturnItems(updated);
  };

  // Summary calculations
  const itemsToReturn = returnItems.filter(i => i.return_qty > 0);
  const totalReturnQty = itemsToReturn.reduce((sum, i) => sum + i.return_qty, 0);
  const totalReturnValue = itemsToReturn.reduce((sum, item) => {
    const lineVal = item.return_qty * item.rate * (1 - item.discPercent / 100);
    return sum + lineVal;
  }, 0);

  const hasErrors = returnItems.some(i => Boolean(i.error) || i.return_qty > i.available);
  const canProceed = itemsToReturn.length > 0 && !hasErrors;

  const effectiveReason = reasonCategory === 'Other'
    ? (customReason.trim() || 'Other')
    : reasonCategory;

  const handleProceedToConfirm = () => {
    if (!canProceed) return;
    setStep('confirm');
  };

  const handleExecuteReturn = async () => {
    if (!canProceed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payloadItems = itemsToReturn.map(i => ({
        saleItemId: i.id,
        quantity: i.return_qty,
        reason: effectiveReason,
      }));

      if (isClientDemoMode()) {
        returnDemoSaleClient(sale.id, payloadItems);
        try {
          returnSaleAction(sale.id, payloadItems, refundMethod, effectiveReason).catch(() => {});
        } catch {}

        const resData = {
          success: true,
          return_id: `ret-${Date.now()}`,
          return_number: `RET-${invNo}-01`,
          invoice_number: invNo,
          total_amount: totalReturnValue,
        };
        setCreatedReturnResult(resData);
        toast.success('Sales return completed successfully');
        setStep('success');
      } else {
        const res = await returnSaleAction(sale.id, payloadItems, refundMethod, effectiveReason);
        if (res.success) {
          setCreatedReturnResult(res.data);
          toast.success('Sales return completed successfully');
          setStep('success');
        } else {
          toast.error(res.error || 'Failed to process sales return');
          setStep('input');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Unexpected error processing return');
      setStep('input');
    } finally {
      setIsSubmitting(false);
    }
  };

  // View return bill document
  const handleViewReturnBill = async () => {
    if (!createdReturnResult) return;
    
    // Construct local or fetched return document
    const retDoc = {
      is_return: true,
      return_number: createdReturnResult.return_number || `RET-${invNo}-01`,
      invoice_number: invNo,
      return_date: new Date().toISOString(),
      refund_mode: refundMethod,
      reason: effectiveReason,
      grand_total: createdReturnResult.total_amount || totalReturnValue,
      total_amount: createdReturnResult.total_amount || totalReturnValue,
      customer: sale.customer || { name: sale.customer_name || 'Customer' },
      items: itemsToReturn.map(i => ({
        ...i,
        name: i.displayName,
        quantity: i.return_qty,
        unit_price: i.rate,
        selling_price: i.rate,
        rate: i.rate,
        gst_rate: i.gst_rate || 18,
        total_amount: i.return_qty * i.rate * (1 - i.discPercent / 100),
      })),
      sale: sale,
    };
    
    setReturnDocData(retDoc);
    setStep('preview');

    if (createdReturnResult.return_id && !isClientDemoMode()) {
      try {
        const docRes = await getSaleReturnAction(createdReturnResult.return_id);
        if (docRes.success && docRes.data) {
          setReturnDocData({ ...docRes.data, is_return: true, sale: sale });
        }
      } catch {
        // fallback to constructed
      }
    }
  };

  // Direct print return bill
  const handlePrintReturnBill = async () => {
    await handleViewReturnBill();
    setTimeout(() => {
      printInvoiceDirectly('printable-tax-invoice', 'A5');
    }, 400);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-card border-border shadow-2xl">
        
        {/* ─── HEADER ─── */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Sales Return / Credit Note
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground font-mono">
                  Original Invoice: <strong className="text-foreground">{invNo}</strong>
                </p>
              </div>
            </div>

            {step === 'input' && (
              <div className="flex items-center gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={handleReturnFullBill}
                  className="text-xs h-8 font-semibold border-primary/40 text-primary hover:bg-primary/10"
                >
                  Return Full Bill
                </Button>
                {itemsToReturn.length > 0 && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="text-xs h-8 text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ─── BODY CONTAINER (SCROLLABLE) ─── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* STEP 1: ITEM SELECTION */}
          {step === 'input' && (
            <div className="space-y-5">
              {/* Product Table / Mobile Cards */}
              <div className="border border-border rounded-xl overflow-hidden bg-background">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 border-b border-border text-muted-foreground text-xs uppercase font-semibold">
                      <tr>
                        <th className="p-3 text-left">Product</th>
                        <th className="p-3 text-center">Original</th>
                        <th className="p-3 text-center">Returned</th>
                        <th className="p-3 text-center">Available</th>
                        <th className="p-3 text-center w-36">Return Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Return Val</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {returnItems.map((item, idx) => {
                        const lineVal = item.return_qty * item.rate * (1 - item.discPercent / 100);
                        const isFullyReturned = item.available === 0;

                        return (
                          <tr 
                            key={idx} 
                            className={`transition-colors ${item.return_qty > 0 ? 'bg-primary/5' : 'hover:bg-muted/30'} ${isFullyReturned ? 'opacity-60 bg-muted/20' : ''}`}
                          >
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{item.displayName}</div>
                              {item.batch_number && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  Batch: {item.batch_number}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono">{item.origQty}</td>
                            <td className="p-3 text-center font-mono text-muted-foreground">{item.alreadyReturned}</td>
                            <td className="p-3 text-center font-mono font-bold text-foreground">
                              {item.available}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col items-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.available}
                                  value={item.return_qty === 0 ? '' : item.return_qty}
                                  placeholder="0"
                                  disabled={isFullyReturned}
                                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                                  className={`h-9 w-24 text-center font-bold text-base ${
                                    item.error 
                                      ? 'border-destructive focus-visible:ring-destructive text-destructive' 
                                      : item.return_qty > 0 
                                      ? 'border-primary text-primary bg-primary/5' 
                                      : ''
                                  }`}
                                />
                                {item.error && (
                                  <span className="text-[11px] text-destructive mt-1 font-medium text-center">
                                    {item.error}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-mono text-muted-foreground">
                              {formatCurrency(item.rate)}
                            </td>
                            <td className="p-3 text-right font-bold text-foreground font-mono">
                              {formatCurrency(lineVal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Cards */}
                <div className="md:hidden divide-y divide-border/60">
                  {returnItems.map((item, idx) => {
                    const lineVal = item.return_qty * item.rate * (1 - item.discPercent / 100);
                    const isFullyReturned = item.available === 0;

                    return (
                      <div 
                        key={idx} 
                        className={`p-3.5 space-y-2.5 ${item.return_qty > 0 ? 'bg-primary/5' : ''} ${isFullyReturned ? 'opacity-60 bg-muted/20' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-sm text-foreground">{item.displayName}</p>
                            {item.batch_number && (
                              <p className="text-xs text-muted-foreground font-mono">Batch: {item.batch_number}</p>
                            )}
                          </div>
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            Rate: {formatCurrency(item.rate)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 px-2 rounded-lg bg-muted/40 border">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Original</span>
                            <span className="font-mono font-bold">{item.origQty}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase">Returned</span>
                            <span className="font-mono">{item.alreadyReturned}</span>
                          </div>
                          <div>
                            <span className="text-primary block text-[10px] uppercase font-bold">Available</span>
                            <span className="font-mono font-black text-primary">{item.available}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex-1">
                            <Label className="text-xs font-semibold mb-1 block">Return Quantity</Label>
                            <Input
                              type="number"
                              min={0}
                              max={item.available}
                              value={item.return_qty === 0 ? '' : item.return_qty}
                              placeholder="0"
                              disabled={isFullyReturned}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              className={`h-9 w-full font-bold text-center ${
                                item.error ? 'border-destructive text-destructive' : item.return_qty > 0 ? 'border-primary text-primary' : ''
                              }`}
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-muted-foreground block">Return Value</span>
                            <span className="font-bold font-mono text-foreground text-sm">
                              {formatCurrency(lineVal)}
                            </span>
                          </div>
                        </div>

                        {item.error && (
                          <p className="text-xs text-destructive font-medium flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {item.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Refund Method & Return Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Refund / Adjustment Method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Select refund method" />
                    </SelectTrigger>
                    <SelectContent>
                      {REFUND_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {refundMethod === 'CREDIT_ADJUSTMENT' 
                      ? 'Reverses customer ledger balance/receivable amount.' 
                      : 'Records an outgoing refund payout entry.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Return Reason</Label>
                  <Select value={reasonCategory} onValueChange={setReasonCategory}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {reasonCategory === 'Other' && (
                    <Input
                      placeholder="Specify custom reason..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="mt-2 h-9 text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Items Selected</span>
                    <strong className="text-foreground text-base">{itemsToReturn.length}</strong>
                  </div>
                  <div className="border-l pl-6">
                    <span className="text-muted-foreground text-xs block">Total Quantity</span>
                    <strong className="text-foreground text-base">{totalReturnQty} units</strong>
                  </div>
                </div>

                <div className="text-right w-full sm:w-auto">
                  <span className="text-xs text-muted-foreground block font-medium">
                    Total Return Value (GST-Inclusive)
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-primary font-mono">
                    {formatCurrency(totalReturnValue)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FINAL CONFIRMATION */}
          {step === 'confirm' && (
            <div className="space-y-5 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1.5">
                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary mb-1">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Confirm Sales Return?</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Please verify the return details before submitting. Stock will be restored to exact batch allocations.
                </p>
              </div>

              <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Original Invoice:</span>
                  <span className="font-mono font-bold text-foreground">{invNo}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Returned Items:</span>
                  <span className="font-bold text-foreground">{itemsToReturn.length} items ({totalReturnQty} units)</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Refund Method:</span>
                  <span className="font-semibold text-foreground">
                    {REFUND_METHODS.find(m => m.value === refundMethod)?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                  <span className="text-muted-foreground">Reason:</span>
                  <span className="font-medium text-foreground">{effectiveReason}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base font-bold text-foreground">Total Return Amount:</span>
                  <span className="text-xl font-black text-primary font-mono">{formatCurrency(totalReturnValue)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-1">
                <p className="font-semibold text-primary">✓ Inventory Restoration</p>
                <p>Items will be added back into product batches from this sale under transaction type SALE_RETURN.</p>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS RESULT */}
          {step === 'success' && createdReturnResult && (
            <div className="space-y-6 max-w-md mx-auto text-center py-4">
              <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-foreground">Return Completed</h3>
                <p className="text-sm text-muted-foreground">
                  The sales return document and inventory adjustments were recorded.
                </p>
              </div>

              <div className="border border-border rounded-xl p-4 bg-muted/40 space-y-2.5 text-sm text-left">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Return Document:</span>
                  <span className="font-mono font-black text-primary text-base">
                    {createdReturnResult.return_number || `RET-${invNo}-01`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Invoice:</span>
                  <span className="font-mono font-bold text-foreground">{invNo}</span>
                </div>
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground font-semibold">Return Amount:</span>
                  <span className="font-mono font-black text-foreground text-lg">
                    {formatCurrency(createdReturnResult.total_amount || totalReturnValue)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button 
                  onClick={handleViewReturnBill}
                  variant="outline"
                  className="font-bold border-border shadow-sm text-foreground hover:bg-accent"
                >
                  <Eye className="h-4 w-4 mr-2" /> View Return Bill
                </Button>
                <Button 
                  onClick={handlePrintReturnBill}
                  className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  <Printer className="h-4 w-4 mr-2" /> Print Return Bill
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW RETURN BILL / CREDIT NOTE */}
          {step === 'preview' && returnDocData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setStep('success')}
                  className="text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
                </Button>

                <div className="flex items-center gap-2">
                  <InvoiceFormatSelector
                    value={previewFormat}
                    onChange={(f) => setPreviewFormat(f)}
                    showDescriptions={false}
                  />
                  <Button 
                    size="sm" 
                    onClick={() => printInvoiceDirectly(previewFormat === 'THERMAL_80MM' ? 'printable-thermal-receipt' : 'printable-tax-invoice', previewFormat)}
                    className="bg-primary text-primary-foreground font-bold text-xs shadow-sm"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                  </Button>
                </div>
              </div>

              <div className="flex justify-center overflow-x-auto p-2 bg-muted/20 rounded-xl border">
                <InvoiceRenderer
                  format={previewFormat}
                  sale={returnDocData}
                />
              </div>
            </div>
          )}

        </div>

        {/* ─── FOOTER ─── */}
        <DialogFooter className="p-4 sm:p-5 border-t bg-muted/30 shrink-0 flex items-center justify-between gap-3 flex-wrap">
          {step === 'input' && (
            <>
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleProceedToConfirm} 
                disabled={!canProceed || isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md px-6"
              >
                Proceed to Confirm ({itemsToReturn.length})
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setStep('input')} 
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
              <Button 
                onClick={handleExecuteReturn} 
                disabled={isSubmitting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-md px-6"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing Return...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> Confirm Return
                  </>
                )}
              </Button>
            </>
          )}

          {(step === 'success' || step === 'preview') && (
            <Button 
              onClick={handleFinish} 
              className="w-full sm:w-auto ml-auto bg-primary text-primary-foreground font-bold px-8 shadow-sm"
            >
              Done
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
