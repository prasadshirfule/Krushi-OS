'use client';

import React from 'react';
import { BillingCartItem } from '@/types/sales';
import { calculateItemTotal } from '@/lib/calculations';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BillingCartProps {
  items: BillingCartItem[];
  onChange: (items: BillingCartItem[]) => void;
  onClear: () => void;
}

export default function BillingCart({ items, onChange, onClear }: BillingCartProps) {
  const updateItem = (index: number, updates: Partial<BillingCartItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="font-semibold">Cart Items ({items.length})</h2>
        <Button variant="outline" size="sm" onClick={onClear} disabled={items.length === 0}>
          Clear All (F2)
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="w-20">Qty</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Disc %</TableHead>
              <TableHead>GST %</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-32 text-muted-foreground">
                  Cart is empty. Search for products to add.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => {
                const itemTotal = calculateItemTotal(item.quantity, item.rate, item.discount, item.gst_rate);
                return (
                  <TableRow key={item.id || idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      {item.product_name}
                      {item.quantity > (item.available_stock || 0) && (
                        <div className="text-[10px] text-destructive">Exceeds stock</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min="1" 
                        max={item.available_stock}
                        value={item.quantity} 
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                        className="h-8 w-16 px-2"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={item.rate} 
                        onChange={(e) => updateItem(idx, { rate: Number(e.target.value) || 0 })}
                        className="h-8 w-20 px-2"
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        min="0" max="100"
                        value={item.discount} 
                        onChange={(e) => updateItem(idx, { discount: Number(e.target.value) || 0 })}
                        className="h-8 w-16 px-2"
                      />
                    </TableCell>
                    <TableCell>{item.gst_rate}%</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(itemTotal.total)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
