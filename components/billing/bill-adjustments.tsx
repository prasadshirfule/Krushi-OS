'use client';

import React, { useState } from 'react';
import { BillAdjustment, AdjustmentType, TaxTreatment } from '@/types/sales';
import { formatCurrency, generateId } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  MinusCircle, 
  SlidersHorizontal, 
  Check, 
  X,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export const PREDEFINED_ADD_REASONS = [
  'Hamali',
  'Loading Charges',
  'Unloading Charges',
  'Transport Charges',
  'Delivery Charges',
  'Labour Charges',
  'Other Charges',
  'Other',
];

export const PREDEFINED_DEDUCT_REASONS = [
  'Previous Outstanding',
  'Advance Paid',
  'Special Discount',
  'Settlement Adjustment',
  'Round Off',
  'Other Deduction',
  'Other',
];

interface BillAdjustmentsProps {
  adjustments: BillAdjustment[];
  onChange: (adjustments: BillAdjustment[]) => void;
  productsTotal: number;
}

export default function BillAdjustments({
  adjustments,
  onChange,
  productsTotal,
}: BillAdjustmentsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formType, setFormType] = useState<AdjustmentType>('ADD');
  const [formReason, setFormReason] = useState<string>('Hamali');
  const [formCustomReason, setFormCustomReason] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formTaxTreatment, setFormTaxTreatment] = useState<TaxTreatment>('NON_TAXABLE');

  const additions = adjustments.filter(a => a.type === 'ADD');
  const deductions = adjustments.filter(a => a.type === 'DEDUCT');

  const totalAdditions = additions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = deductions.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormType('ADD');
    setFormReason('Hamali');
    setFormCustomReason('');
    setFormAmount('');
    setFormTaxTreatment('NON_TAXABLE');
  };

  const handleStartAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleStartEdit = (adj: BillAdjustment) => {
    setIsAdding(false);
    setEditingId(adj.id);
    setFormType(adj.type);

    const isPredefined = adj.type === 'ADD'
      ? PREDEFINED_ADD_REASONS.includes(adj.reason)
      : PREDEFINED_DEDUCT_REASONS.includes(adj.reason);

    if (isPredefined && adj.reason !== 'Other') {
      setFormReason(adj.reason);
      setFormCustomReason('');
    } else {
      setFormReason('Other');
      setFormCustomReason(adj.reason);
    }

    setFormAmount(String(adj.amount));
    setFormTaxTreatment(adj.taxTreatment || 'NON_TAXABLE');
  };

  const handleDelete = (id: string) => {
    onChange(adjustments.filter(a => a.id !== id));
    if (editingId === id) resetForm();
    toast.success('Adjustment removed');
  };

  const handleSave = () => {
    const num = parseFloat(formAmount);
    if (isNaN(num) || num <= 0) {
      toast.error('Please enter a valid amount greater than ₹0');
      return;
    }

    const finalReason = formReason === 'Other' ? formCustomReason.trim() : formReason;
    if (!finalReason) {
      toast.error('Please select or specify a reason');
      return;
    }

    // Validation: Deduction cannot exceed current bill total
    if (formType === 'DEDUCT') {
      const currentDeductionsWithoutEditing = adjustments
        .filter(a => a.type === 'DEDUCT' && a.id !== editingId)
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

      const maxAllowed = productsTotal + totalAdditions - currentDeductionsWithoutEditing;
      if (num > maxAllowed) {
        toast.error(`Deduction of ${formatCurrency(num)} exceeds payable total (${formatCurrency(Math.max(0, maxAllowed))})`);
        return;
      }
    }

    const adjustmentRecord: BillAdjustment = {
      id: editingId || `adj-${Date.now()}-${generateId()}`,
      type: formType,
      reason: finalReason,
      customReason: formReason === 'Other' ? formCustomReason.trim() : undefined,
      amount: num,
      taxTreatment: formTaxTreatment,
    };

    if (editingId) {
      onChange(adjustments.map(a => a.id === editingId ? adjustmentRecord : a));
      toast.success('Adjustment updated');
    } else {
      onChange([...adjustments, adjustmentRecord]);
      toast.success(`${formType === 'ADD' ? 'Charge' : 'Deduction'} added successfully`);
    }

    resetForm();
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-4 text-card-foreground">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Bill Adjustments</h2>
              {adjustments.length > 0 && (
                <span className="text-xs bg-muted font-bold px-2 py-0.5 rounded-full border border-border text-foreground">
                  {adjustments.length}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Add extra charges (Hamali, Transport) or deductions (Advance, Special Discount)
            </p>
          </div>
        </div>

        {!isAdding && !editingId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartAdd}
            className="border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary text-xs font-semibold rounded-lg"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Adjustment
          </Button>
        )}
      </div>

      {/* ─── Adjustments List (if any) ─── */}
      {adjustments.length > 0 && (
        <div className="space-y-3">
          {/* Additions list */}
          {additions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" /> Additions ({formatCurrency(totalAdditions)})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {additions.map(adj => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                        + ADD
                      </span>
                      <span className="font-semibold text-foreground">{adj.reason}</span>
                      <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60 border border-border">
                        {adj.taxTreatment === 'TAXABLE' ? 'Taxable' : 'Non-Taxable'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 font-mono">
                        +{formatCurrency(adj.amount)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(adj)}
                        title="Edit adjustment"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(adj.id)}
                        title="Delete adjustment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions list */}
          {deductions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <MinusCircle className="h-3.5 w-3.5" /> Deductions ({formatCurrency(totalDeductions)})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {deductions.map(adj => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        - DEDUCT
                      </span>
                      <span className="font-semibold text-foreground">{adj.reason}</span>
                      <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60 border border-border">
                        {adj.taxTreatment === 'TAXABLE' ? 'Taxable' : 'Non-Taxable'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400 font-mono">
                        -{formatCurrency(adj.amount)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(adj)}
                        title="Edit adjustment"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(adj.id)}
                        title="Delete adjustment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {adjustments.length === 0 && !isAdding && !editingId && (
        <div className="py-4 px-3 rounded-lg border border-dashed border-border bg-background/50 text-center text-xs text-muted-foreground flex items-center justify-between">
          <span>No adjustments added to this bill.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleStartAdd}
            className="text-primary hover:underline text-xs h-7 px-2"
          >
            + Add Hamali / Transport / Advance
          </Button>
        </div>
      )}

      {/* ─── Add / Edit Adjustment Inline Form ─── */}
      {(isAdding || editingId) && (
        <div className="p-4 rounded-xl border border-primary/30 bg-muted/40 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground uppercase tracking-wide">
              {editingId ? 'Edit Adjustment' : 'New Bill Adjustment'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={resetForm}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Type: Add vs Deduct */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Type
              </label>
              <div className="grid grid-cols-2 gap-1 bg-background p-0.5 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('ADD');
                    if (!PREDEFINED_ADD_REASONS.includes(formReason)) {
                      setFormReason('Hamali');
                    }
                  }}
                  className={`text-xs py-1.5 px-2 rounded-md font-bold transition-colors ${
                    formType === 'ADD'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('DEDUCT');
                    if (!PREDEFINED_DEDUCT_REASONS.includes(formReason)) {
                      setFormReason('Previous Outstanding');
                    }
                  }}
                  className={`text-xs py-1.5 px-2 rounded-md font-bold transition-colors ${
                    formType === 'DEDUCT'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  - Deduct
                </button>
              </div>
            </div>

            {/* 2. Reason Select */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Reason
              </label>
              <select
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {(formType === 'ADD' ? PREDEFINED_ADD_REASONS : PREDEFINED_DEDUCT_REASONS).map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Amount (₹) */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-6 h-9 text-xs font-mono font-bold bg-background border-border text-foreground"
                  autoFocus
                />
              </div>
            </div>

            {/* 4. Tax Treatment */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Tax Treatment
              </label>
              <select
                value={formTaxTreatment}
                onChange={e => setFormTaxTreatment(e.target.value as TaxTreatment)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="NON_TAXABLE">Non-Taxable (Default)</option>
                <option value="TAXABLE">Taxable</option>
              </select>
            </div>
          </div>

          {/* Custom Reason Input if 'Other' */}
          {formReason === 'Other' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Custom Reason Details
              </label>
              <Input
                type="text"
                value={formCustomReason}
                onChange={e => setFormCustomReason(e.target.value)}
                placeholder="e.g. Special loading assistance, Warehouse fee..."
                className="h-9 text-xs bg-background border-border text-foreground"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {editingId ? 'Save Adjustment' : 'Apply Adjustment'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
