'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BatchSelectorProps {
  batches: any[];
  selectedBatchId?: string;
  onSelect: (batchId: string) => void;
  disabled?: boolean;
}

export function BatchSelector({ batches, selectedBatchId, onSelect, disabled }: BatchSelectorProps) {
  if (!batches || batches.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-full h-8">
          <SelectValue placeholder="No batches" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={selectedBatchId} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="w-full h-8">
        <SelectValue placeholder="Select batch" />
      </SelectTrigger>
      <SelectContent>
        {batches.map((batch) => {
          const isExpired = new Date(batch.expiry_date) < new Date();
          const isOutOfStock = batch.stock <= 0;
          const isDisabled = isExpired || isOutOfStock;

          return (
            <SelectItem 
              key={batch.id} 
              value={batch.id} 
              disabled={isDisabled}
              className={isExpired ? 'text-destructive' : ''}
            >
              <div className="flex justify-between w-full min-w-[200px]">
                <span>{batch.batch_number}</span>
                <span className="text-xs text-muted-foreground ml-4 flex gap-2">
                  <span>Exp: {new Date(batch.expiry_date).toLocaleDateString()}</span>
                  <span>Stock: {batch.stock}</span>
                </span>
                {isExpired && <span className="text-xs font-bold text-destructive ml-2">(Expired)</span>}
                {isOutOfStock && !isExpired && <span className="text-xs font-bold text-muted-foreground ml-2">(Empty)</span>}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
