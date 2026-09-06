'use client';

import React from 'react';
import { InvoicePrintFormat } from './invoice-renderer';
import { Label } from '@/components/ui/label';
import { FileText, ReceiptText } from 'lucide-react';

interface InvoiceFormatSelectorProps {
  value: InvoicePrintFormat;
  onChange: (value: InvoicePrintFormat) => void;
  className?: string;
  showDescriptions?: boolean;
}

export function InvoiceFormatSelector({
  value,
  onChange,
  className = '',
  showDescriptions = true,
}: InvoiceFormatSelectorProps) {
  const isA5 = value === 'A5';
  const is80mm = value === 'THERMAL_80MM';

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Paper Format
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* A5 Option */}
        <div
          onClick={() => onChange('A5')}
          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${
            isA5
              ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-100 shadow-sm'
              : 'border-border hover:border-muted-foreground/40 bg-card text-card-foreground'
          }`}
        >
          <input
            type="radio"
            id="format-a5"
            name="invoice-format-selection"
            value="A5"
            checked={isA5}
            onChange={() => onChange('A5')}
            className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <div className="space-y-0.5">
            <Label htmlFor="format-a5" className="font-bold text-sm cursor-pointer flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-emerald-600" />
              A5
            </Label>
            {showDescriptions && (
              <p className="text-[11px] text-muted-foreground leading-tight">
                Tax Invoice (Landscape)
              </p>
            )}
          </div>
        </div>

        {/* 80mm Thermal Option */}
        <div
          onClick={() => onChange('THERMAL_80MM')}
          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all select-none ${
            is80mm
              ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-100 shadow-sm'
              : 'border-border hover:border-muted-foreground/40 bg-card text-card-foreground'
          }`}
        >
          <input
            type="radio"
            id="format-80mm"
            name="invoice-format-selection"
            value="THERMAL_80MM"
            checked={is80mm}
            onChange={() => onChange('THERMAL_80MM')}
            className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <div className="space-y-0.5">
            <Label htmlFor="format-80mm" className="font-bold text-sm cursor-pointer flex items-center gap-1.5">
              <ReceiptText className="h-4 w-4 text-emerald-600" />
              80mm Thermal
            </Label>
            {showDescriptions && (
              <p className="text-[11px] text-muted-foreground leading-tight">
                POS Receipt (Vertical)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
