'use client';

import React, { useState, useCallback } from 'react';
import { BillingCartItem } from '@/types/sales';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';
import { formatCurrency, formatDate } from '@/lib/utils';
import { formatProductNameWithSize } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, ShoppingBasket, Plus, Minus, Receipt, Tag, 
  AlertCircle, Layers, Check, X, Loader2 
} from 'lucide-react';
import { getBatchesAction } from '@/actions/inventory';
import { toast } from 'sonner';

interface BillingCartProps {
  items: BillingCartItem[];
  onChange: (items: BillingCartItem[]) => void;
  onClear: () => void;
  totals?: any;
}

export default function BillingCart({ items, onChange, onClear, totals: propTotals }: BillingCartProps) {
  const [showDiscountIndex, setShowDiscountIndex] = useState<number | null>(null);
  const [batchSelectorIndex, setBatchSelectorIndex] = useState<number | null>(null);
  const [rowBatches, setRowBatches] = useState<Record<string, any[]>>({});
  const [loadingBatchesRow, setLoadingBatchesRow] = useState<number | null>(null);

  // Use passed totals or calculate on the fly
  const totals = propTotals || calculateBillTotal(items);

  const updateItem = (index: number, updates: Partial<BillingCartItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const handleQtyChange = (index: number, delta: number) => {
    const item = items[index];
    const newQty = (item.quantity || 1) + delta;
    const maxStock = item.available_stock || 9999;

    if (newQty < 1) {
      removeItem(index);
      return;
    }

    if (newQty > maxStock) {
      toast.warning(`Cannot exceed available batch stock (${maxStock} units)`);
      return;
    }

    updateItem(index, { quantity: newQty });
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (showDiscountIndex === index) setShowDiscountIndex(null);
    if (batchSelectorIndex === index) setBatchSelectorIndex(null);
  };

  // Open / toggle batch switcher for a cart item
  const handleToggleBatchSelector = async (index: number) => {
    if (batchSelectorIndex === index) {
      setBatchSelectorIndex(null);
      return;
    }

    const item = items[index];
    const prodId = item.product_id || (item.product as any)?.id;

    if (!prodId) {
      toast.error('Product information not available');
      return;
    }

    setBatchSelectorIndex(index);

    // If batches already loaded on row, don't re-fetch
    if (rowBatches[prodId] && rowBatches[prodId].length > 0) {
      return;
    }

    // Check if batches are embedded in item.batches
    if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
      setRowBatches(prev => ({ ...prev, [prodId]: item.batches || [] }));
      return;
    }

    setLoadingBatchesRow(index);
    try {
      const res = await getBatchesAction(prodId);
      if (res.success && Array.isArray(res.data)) {
        setRowBatches(prev => ({ ...prev, [prodId]: res.data }));
      }
    } catch (err) {
      console.warn('Failed to load batches for switcher:', err);
    } finally {
      setLoadingBatchesRow(null);
    }
  };

  // Switch cart item to a different batch
  const handleSelectBatch = (index: number, newBatch: any) => {
    const item = items[index];
    const maxStock = Number(newBatch.quantity_available ?? newBatch.stock_quantity ?? 0);
    const currentQty = item.quantity || 1;
    const clampedQty = Math.max(1, Math.min(currentQty, maxStock));

    if (currentQty > maxStock) {
      toast.info(`Adjusted quantity to ${maxStock} (max available in batch "${newBatch.batch_number}")`);
    } else {
      toast.success(`Switched to batch "${newBatch.batch_number}"`);
    }

    updateItem(index, {
      batch_id: newBatch.id,
      batch_number: newBatch.batch_number,
      expiry_date: newBatch.expiry_date || null,
      available_stock: maxStock,
      rate: Number(newBatch.selling_price || item.rate),
      quantity: clampedQty,
    });

    setBatchSelectorIndex(null);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-5 text-card-foreground min-w-0 max-w-full">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Current Bill</h2>
            <span className="text-xs text-muted-foreground font-medium">
              {items.length} {items.length === 1 ? 'item' : 'items'} added
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs"
          >
            Clear All (F2)
          </Button>
        )}
      </div>

      {/* ─── Table / Item List ─── */}
      {items.length === 0 ? (
        <div className="py-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center p-6 gap-2">
          <ShoppingBasket className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-base font-semibold text-foreground">Your bill is empty</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Select products from the list above or type in the search box to add items to this bill.
          </p>
        </div>
      ) : (
        <div className="space-y-4 min-w-0 max-w-full">
          {/* Scrollable Table on mobile/tablet */}
          <div className="overflow-x-auto rounded-xl border border-border bg-background/40 w-full max-w-full">
            <table className="w-full text-left border-collapse min-w-[580px] sm:min-w-[620px]">
              <thead>
                <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">Product Name & Batch</th>
                  <th className="py-3 px-3 text-right">Rate</th>
                  <th className="py-3 px-4 text-center w-36">Quantity</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, idx) => {
                  const effectiveDiscount = item.discount_amount !== undefined ? item.discount_amount : (item.discount || 0);
                  const itemTotal = calculateItemTotal(
                    item.quantity || 1,
                    item.rate || 0,
                    effectiveDiscount,
                    item.gst_rate || 0,
                    true,
                    { discountAmount: effectiveDiscount }
                  );
                  const isDiscountOpen = showDiscountIndex === idx;
                  const isBatchSelectorOpen = batchSelectorIndex === idx;
                  const hasDiscount = effectiveDiscount > 0;
                  const stockExceeded = item.available_stock && item.quantity > item.available_stock;
                  const prodId = item.product_id || (item.product as any)?.id || '';

                  // Get eligible batches for this row (active, quantity > 0, not expired)
                  const rawBatches = rowBatches[prodId] || item.batches || [];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const eligibleBatches = rawBatches
                    .filter((b: any) => {
                      const isActive = b.is_active !== false;
                      const qty = Number(b.quantity_available ?? b.stock_quantity ?? 0);
                      const expStr = b.expiry_date || b.exp_date;
                      const isNotExpired = !expStr || new Date(expStr) >= today;
                      return isActive && qty > 0 && isNotExpired;
                    })
                    .sort((a: any, b: any) => {
                      const expA = a.expiry_date || a.exp_date;
                      const expB = b.expiry_date || b.exp_date;
                      if (expA && expB) return new Date(expA).getTime() - new Date(expB).getTime();
                      if (expA) return -1;
                      if (expB) return 1;
                      return 0;
                    });

                  return (
                    <tr key={item.id || idx} className="hover:bg-accent/30 transition-colors">
                      {/* # Index */}
                      <td className="py-3.5 px-3 text-center text-sm text-muted-foreground font-mono align-top">
                        {idx + 1}
                      </td>

                      {/* Product Name & Batch Controls */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm sm:text-base">
                            {formatProductNameWithSize(item.product_name || (item as any).name, item.pack_size || item.product?.pack_size, item.unit || item.product?.unit)}
                          </span>
                        </div>

                        {/* Batch, GST, Discount, and "Change Batch" Trigger */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Selected Batch Badge */}
                          <Badge variant="outline" className="font-mono text-[11px] bg-muted/60 text-foreground border-border px-1.5 py-0.5">
                            Batch: {item.batch_number || 'Default'}
                          </Badge>

                          {/* Change Batch compact button */}
                          <button
                            type="button"
                            onClick={() => handleToggleBatchSelector(idx)}
                            className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold transition-colors"
                            title="Change inventory stock batch"
                          >
                            <Layers className="h-3 w-3" />
                            <span>Change Batch</span>
                          </button>

                          <span className="text-[11px] text-muted-foreground">
                            GST: {item.gst_rate || 0}%
                          </span>

                          {/* Discount toggle button (in ₹) */}
                          <button
                            type="button"
                            onClick={() => setShowDiscountIndex(isDiscountOpen ? null : idx)}
                            className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                              hasDiscount
                                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                : 'text-primary hover:underline'
                            }`}
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {hasDiscount ? `₹${effectiveDiscount.toFixed(2)} off` : '+ Add Discount (₹)'}
                          </button>
                        </div>

                        {/* ─── Compact Batch Selector Panel ─── */}
                        {isBatchSelectorOpen && (
                          <div className="mt-2.5 p-3 bg-card border border-primary/40 rounded-xl shadow-lg space-y-2 max-w-md animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between border-b border-border pb-1.5">
                              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-primary" /> Select Stock Batch (FEFO)
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={() => setBatchSelectorIndex(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {loadingBatchesRow === idx ? (
                              <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading available batches...
                              </div>
                            ) : eligibleBatches.length === 0 ? (
                              <div className="py-2 text-xs text-muted-foreground italic">
                                No other active batches with available stock for this product.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {eligibleBatches.map((b: any) => {
                                  const isCurrent = (b.id === item.batch_id || b.batch_number === item.batch_number);
                                  const bQty = Number(b.quantity_available ?? b.stock_quantity ?? 0);
                                  const bRate = Number(b.selling_price || item.rate);

                                  return (
                                    <div
                                      key={b.id}
                                      onClick={() => handleSelectBatch(idx, b)}
                                      className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                                        isCurrent
                                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                                          : 'border-border/80 hover:bg-muted/70 text-foreground'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono font-bold text-foreground">{b.batch_number}</span>
                                          {isCurrent && (
                                            <Badge className="text-[9px] h-4 px-1 bg-primary text-primary-foreground">
                                              Current
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                          <span>Exp: {b.expiry_date ? formatDate(b.expiry_date) : 'No Expiry'}</span>
                                          <span>Rate: {formatCurrency(bRate)}</span>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="font-mono font-extrabold text-foreground text-sm">{bQty}</span>
                                        <span className="block text-[10px] text-muted-foreground">avail</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Inline Discount Editor in ₹ */}
                        {isDiscountOpen && (
                          <div className="mt-2 flex items-center gap-2 bg-muted/80 p-2.5 rounded-lg border border-border flex-wrap">
                            <span className="text-xs font-semibold text-foreground">Discount (₹):</span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                              <Input
                                type="number"
                                min="0"
                                max={(item.quantity || 1) * (item.rate || 0)}
                                step="any"
                                value={item.discount_amount !== undefined ? (item.discount_amount || '') : (item.discount || '')}
                                placeholder="0.00"
                                onChange={e => {
                                  const lineMax = (item.quantity || 1) * (item.rate || 0);
                                  const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0);
                                  const clamped = Math.min(lineMax, val);
                                  updateItem(idx, { discount_amount: clamped, discount: clamped });
                                }}
                                className="h-7 w-28 pl-6 pr-2 text-xs bg-background border-border text-foreground font-mono font-bold"
                                autoFocus
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              (Max: {formatCurrency((item.quantity || 1) * (item.rate || 0))})
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-foreground hover:bg-accent"
                              onClick={() => setShowDiscountIndex(null)}
                            >
                              Done
                            </Button>
                          </div>
                        )}

                        {stockExceeded && (
                          <div className="text-[11px] text-destructive flex items-center gap-1 mt-1 font-semibold">
                            <AlertCircle className="h-3 w-3" /> Exceeds available batch stock ({item.available_stock})
                          </div>
                        )}
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-3 text-right font-medium text-muted-foreground align-top font-mono">
                        {formatCurrency(item.rate || 0)}
                      </td>

                      {/* Quantity Stepper */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 shrink-0"
                              onClick={() => handleQtyChange(idx, -1)}
                              title="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5 stroke-[3]" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={item.available_stock}
                              value={item.quantity}
                              onChange={e => {
                                const val = Number(e.target.value) || 1;
                                const maxStock = item.available_stock || 9999;
                                if (val > maxStock) {
                                  toast.warning(`Cannot exceed available batch stock (${maxStock} units)`);
                                }
                                updateItem(idx, { quantity: Math.min(maxStock, Math.max(1, val)) });
                              }}
                              className="h-8 w-14 text-center font-bold text-base px-1 rounded-lg bg-background border-border text-foreground font-mono"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-primary/10 hover:text-primary hover:border-primary/40 shrink-0"
                              onClick={() => handleQtyChange(idx, 1)}
                              disabled={Boolean(item.available_stock && item.quantity >= item.available_stock)}
                              title="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5 stroke-[3]" />
                            </Button>
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {item.available_stock ? `${item.available_stock} avail` : 'Units'}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right align-top">
                        <span className="font-extrabold text-base text-foreground font-mono">
                          {formatCurrency(itemTotal.total)}
                        </span>
                        {hasDiscount && (
                          <span className="block text-[11px] text-muted-foreground line-through font-mono">
                            {formatCurrency(itemTotal.subtotal)}
                          </span>
                        )}
                      </td>

                      {/* Remove Button */}
                      <td className="py-3.5 px-3 text-center align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Bill Breakdown Summary ─── */}
          <div className="bg-muted/30 rounded-xl border border-border p-4 md:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pb-4 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Total Items</span>
                <span className="font-bold text-foreground text-base">
                  {items.length} items ({items.reduce((sum, it) => sum + (it.quantity || 1), 0)} units)
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Subtotal</span>
                <span className="font-bold text-foreground text-base font-mono">
                  {formatCurrency(totals.subtotal || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Total GST</span>
                <span className="font-bold text-foreground text-base font-mono">
                  {formatCurrency(totals.totalTax || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Product Discount</span>
                <span className="font-bold text-amber-400 text-base font-mono">
                  {(totals.totalDiscount || 0) > 0 ? `-${formatCurrency(totals.totalDiscount)}` : '₹0.00'}
                </span>
              </div>
            </div>

            {/* Final Grand Total */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-4">
              <div>
                <span className="text-xs text-muted-foreground block">Net Payable Amount</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-primary font-mono">
                  {formatCurrency(totals.payableAmount ?? totals.grandTotal ?? 0)}
                </span>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {(totals.roundOff || 0) !== 0 && (
                  <span>Round off adjustment: {formatCurrency(totals.roundOff || 0)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
