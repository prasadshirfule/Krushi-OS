'use client';

import React, { useState } from 'react';
import { BillingCartItem } from '@/types/sales';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';
import { formatCurrency, numberToWords } from '@/lib/utils';
import { formatProductPackDisplay } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, ShoppingBasket, Plus, Minus, Receipt, Percent, AlertCircle } from 'lucide-react';

interface BillingCartProps {
  items: BillingCartItem[];
  onChange: (items: BillingCartItem[]) => void;
  onClear: () => void;
  totals?: any;
}

export default function BillingCart({ items, onChange, onClear, totals: propTotals }: BillingCartProps) {
  const [showDiscountIndex, setShowDiscountIndex] = useState<number | null>(null);

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
      // Remove item if decremented below 1
      removeItem(index);
      return;
    }

    if (newQty > maxStock) {
      return;
    }

    updateItem(index, { quantity: newQty });
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (showDiscountIndex === index) {
      setShowDiscountIndex(null);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-5 text-card-foreground">
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
        <div className="space-y-4">
          {/* Scrollable Table on mobile/tablet */}
          <div className="overflow-x-auto rounded-xl border border-border bg-background/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3 text-right">Rate</th>
                  <th className="py-3 px-4 text-center w-36">Quantity</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, idx) => {
                  const itemTotal = calculateItemTotal(
                    item.quantity || 1,
                    item.rate || 0,
                    item.discount || 0,
                    item.gst_rate || 0
                  );
                  const isDiscountOpen = showDiscountIndex === idx;
                  const hasDiscount = (item.discount || 0) > 0;
                  const stockExceeded = item.available_stock && item.quantity > item.available_stock;

                  return (
                    <tr key={item.id || idx} className="hover:bg-accent/30 transition-colors">
                      {/* # Index */}
                      <td className="py-3.5 px-3 text-center text-sm text-muted-foreground font-mono">
                        {idx + 1}
                      </td>

                      {/* Product Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-base">{item.product_name}</span>
                          {formatProductPackDisplay(item.product || item) && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              {formatProductPackDisplay(item.product || item)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {item.batch_number && (
                            <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border">
                              Batch: {item.batch_number}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            GST: {item.gst_rate || 0}%
                          </span>

                          {/* Discount toggle button */}
                          <button
                            type="button"
                            onClick={() => setShowDiscountIndex(isDiscountOpen ? null : idx)}
                            className={`text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors ${
                              hasDiscount
                                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                                : 'text-primary hover:underline'
                            }`}
                          >
                            <Percent className="h-2.5 w-2.5" />
                            {hasDiscount ? `${item.discount}% off` : '+ Add Discount'}
                          </button>
                        </div>

                        {/* Inline Discount Editor */}
                        {isDiscountOpen && (
                          <div className="mt-2 flex items-center gap-2 bg-muted/70 p-2 rounded-lg border border-border">
                            <span className="text-xs font-semibold text-foreground">Discount %:</span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount || ''}
                              placeholder="0"
                              onChange={e => updateItem(idx, { discount: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                              className="h-7 w-20 px-2 text-xs bg-background border-border text-foreground"
                              autoFocus
                            />
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
                          <div className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" /> Exceeds available stock ({item.available_stock})
                          </div>
                        )}
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-3 text-right font-medium text-muted-foreground">
                        {formatCurrency(item.rate || 0)}
                      </td>

                      {/* Quantity Stepper with Large + and − buttons */}
                      <td className="py-3.5 px-4">
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
                              onChange={e => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                              className="h-8 w-14 text-center font-bold text-base px-1 rounded-lg bg-background border-border text-foreground"
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
                            Pieces
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-extrabold text-base text-foreground">
                          {formatCurrency(itemTotal.total)}
                        </span>
                        {hasDiscount && (
                          <span className="block text-[11px] text-muted-foreground line-through">
                            {formatCurrency(itemTotal.subtotal)}
                          </span>
                        )}
                      </td>

                      {/* Remove Button */}
                      <td className="py-3.5 px-3 text-center">
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

          {/* ─── Bill Breakdown Summary (Dark Theme) ─── */}
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
                <span className="font-bold text-foreground text-base">
                  {formatCurrency(totals.subtotal || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Total GST</span>
                <span className="font-bold text-foreground text-base">
                  {formatCurrency(totals.totalTax || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Total Discount</span>
                <span className="font-bold text-amber-400 text-base">
                  {(totals.totalDiscount || 0) > 0 ? `-${formatCurrency(totals.totalDiscount)}` : '₹0.00'}
                </span>
              </div>
            </div>

            {/* Prominent Grand Total Display */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs uppercase font-bold text-primary tracking-wider block">
                  Total Payable Amount
                </span>
                <span className="text-xs text-muted-foreground italic">
                  {numberToWords(totals.payableAmount || 0)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-3xl md:text-4xl font-black text-primary tracking-tight">
                  {formatCurrency(totals.payableAmount || 0)}
                </span>
                {totals.roundOff !== 0 && (
                  <span className="text-[11px] text-muted-foreground block">
                    (Round off: {totals.roundOff > 0 ? `+${totals.roundOff}` : totals.roundOff})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
