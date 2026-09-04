'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, numberToWords } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { 
  isClientDemoMode, 
  getDemoSaleByIdClient 
} from '@/lib/client-demo-store';

interface SaleDetailViewProps {
  initialSale: any | null;
  saleId: string;
}

export function SaleDetailView({ initialSale, saleId }: SaleDetailViewProps) {
  const [sale, setSale] = useState<any | null>(initialSale);

  useEffect(() => {
    if (!initialSale && isClientDemoMode()) {
      const found = getDemoSaleByIdClient(saleId);
      if (found) setSale(found);
    } else {
      setSale(initialSale);
    }
  }, [initialSale, saleId]);

  if (!sale) {
    return (
      <div className="p-8 text-center text-muted-foreground font-medium space-y-4">
        <p>Sale not found</p>
        <Link href="/sales">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>
      </div>
    );
  }

  const grandTotal = Number(sale.grand_total ?? sale.total_amount ?? sale.totalAmount ?? sale.payableAmount ?? 0);
  const invNo = sale.invoice_number || sale.invoiceNumber || (sale.id ? sale.id.substring(0, 8).toUpperCase() : 'INV');
  const items = sale.items || sale.sale_items || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <Link href="/sales">
          <Button variant="outline" className="border-border">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>
        <div className="space-x-2">
          <Button variant="outline" className="border-border"><Printer className="h-4 w-4 mr-2" /> Print A4</Button>
          <Button variant="outline" className="border-border"><Printer className="h-4 w-4 mr-2" /> Print 80mm</Button>
          {sale.status !== 'CANCELLED' && sale.status !== 'REFUNDED' && (
            <Button variant="destructive" className="ml-4">
              <RotateCcw className="h-4 w-4 mr-2" /> Process Return
            </Button>
          )}
        </div>
      </div>

      {(sale.status === 'CANCELLED' || sale.status === 'REFUNDED') && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl font-bold text-center border border-destructive/20">
          THIS INVOICE HAS BEEN RETURNED / CANCELLED
        </div>
      )}

      <Card className="border border-border bg-card print:shadow-none print:border-none">
        <CardHeader className="text-center border-b border-border pb-6">
          <CardTitle className="text-3xl text-primary font-black">KRUSHI OS</CardTitle>
          <CardDescription className="text-md">Smart Agriculture & Retail Solutions</CardDescription>
          <div className="mt-4 grid grid-cols-2 text-left text-sm gap-4">
            <div>
              <p className="font-bold text-foreground">Invoice To:</p>
              <p className="text-foreground font-semibold">{sale.customer?.name || sale.customer_name || 'Walk-in Customer'}</p>
              <p className="text-muted-foreground">{sale.customer?.phone || (sale.customer as any)?.mobile || ''}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold text-foreground">Invoice #:</span> <span className="font-mono">{invNo}</span></p>
              <p><span className="font-bold text-foreground">Date:</span> {new Date(sale.sale_date || sale.created_at).toLocaleString('en-IN')}</p>
              <p><span className="font-bold text-foreground">Status:</span> <span className="font-semibold text-primary">{sale.status || 'COMPLETED'}</span></p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <table className="w-full text-sm mb-6">
            <thead className="border-b border-border text-muted-foreground uppercase text-xs">
              <tr>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Disc%</th>
                <th className="py-2 text-right">GST%</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {items.map((item: any, idx: number) => {
                const qty = item.quantity || 1;
                const rate = Number(item.selling_price ?? item.unit_price ?? item.unitPrice ?? item.rate ?? 0);
                const disc = Number(item.discount_percent ?? item.discountPercent ?? item.discount ?? 0);
                const gst = Number(item.gst_rate ?? item.gstRate ?? item.gst ?? 0);
                const amt = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * rate));
                return (
                  <tr key={item.id || idx}>
                    <td className="py-3 font-medium text-foreground">{item.product_name || item.product?.name || 'Item'}</td>
                    <td className="py-3 text-center">{qty}</td>
                    <td className="py-3 text-right text-muted-foreground">{formatCurrency(rate)}</td>
                    <td className="py-3 text-right text-muted-foreground">{disc}%</td>
                    <td className="py-3 text-right text-muted-foreground">{gst}%</td>
                    <td className="py-3 text-right font-bold text-foreground">
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span> 
                <span className="font-medium text-foreground">{formatCurrency(Number(sale.subtotal || grandTotal))}</span>
              </div>
              {Number(sale.discount_amount || sale.total_discount || 0) > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Discount:</span> 
                  <span>-{formatCurrency(Number(sale.discount_amount || sale.total_discount))}</span>
                </div>
              )}
              {Number(sale.tax_amount || sale.total_tax || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST:</span> 
                  <span className="font-medium text-foreground">{formatCurrency(Number(sale.tax_amount || sale.total_tax))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-bold text-lg">
                <span className="text-foreground">Grand Total:</span> 
                <span className="text-primary font-black text-xl">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-border text-xs italic text-muted-foreground">
            Amount in words: {numberToWords(grandTotal)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
