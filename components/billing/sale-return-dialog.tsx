'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { returnSaleAction } from '@/actions/sales';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface SaleReturnDialogProps {
  sale: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SaleReturnDialog({ sale, onClose, onSuccess }: SaleReturnDialogProps) {
  const [returnItems, setReturnItems] = useState<any[]>(
    (sale.items || []).map((item: any) => ({ ...item, return_qty: 0 }))
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQtyChange = (index: number, val: string) => {
    const qty = Math.max(0, Math.min(Number(val) || 0, returnItems[index].quantity));
    const newItems = [...returnItems];
    newItems[index].return_qty = qty;
    setReturnItems(newItems);
  };

  const totalRefund = returnItems.reduce((acc, item) => {
    const rate = item.selling_price ?? item.unitPrice ?? item.rate ?? 0;
    const gst = item.gst_rate ?? item.gstRate ?? 0;
    const disc = item.discount_percent ?? item.discountPercent ?? item.discount ?? 0;
    return acc + (item.return_qty * rate * (1 + gst / 100) * (1 - disc / 100));
  }, 0);

  const hasReturns = returnItems.some(item => item.return_qty > 0);

  const handleProcessReturn = async () => {
    if (!hasReturns) return;
    if (!reason) {
      toast.error('Please select a return reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToReturn = returnItems
        .filter(i => i.return_qty > 0)
        .map(i => ({
          saleItemId: i.id,
          quantity: i.return_qty,
          reason: reason
        }));

      const result = await returnSaleAction(sale.id, itemsToReturn);

      if (result.success) {
        toast.success('Return processed successfully');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to process return');
      }
    } catch (error) {
      toast.error('Unexpected error processing return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Return - Invoice #{sale.invoice_number || sale.invoiceNumber || sale.id.substring(0,8)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-center">Orig Qty</th>
                  <th className="p-2 text-center">Return Qty</th>
                  <th className="p-2 text-right">Refund</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, idx) => {
                  const rate = item.selling_price ?? item.unitPrice ?? item.rate ?? 0;
                  const gst = item.gst_rate ?? item.gstRate ?? 0;
                  const disc = item.discount_percent ?? item.discountPercent ?? item.discount ?? 0;
                  return (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.product_name || item.product?.name || 'Item'}</td>
                      <td className="p-2 text-right">{formatCurrency(rate)}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 w-32">
                        <Input 
                          type="number" 
                          min="0" 
                          max={item.quantity}
                          value={item.return_qty || ''}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          className="h-8 text-center"
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        {formatCurrency(item.return_qty * rate * (1 + gst/100) * (1 - disc/100))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-2 block">Return Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Wrong Product">Wrong Product</SelectItem>
                  <SelectItem value="Customer Request">Customer Request</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md flex flex-col justify-center items-end">
              <span className="text-sm text-muted-foreground">Total Refund</span>
              <span className="text-2xl font-bold text-destructive">{formatCurrency(totalRefund)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button 
            variant="destructive" 
            onClick={handleProcessReturn} 
            disabled={!hasReturns || !reason || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Process Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
