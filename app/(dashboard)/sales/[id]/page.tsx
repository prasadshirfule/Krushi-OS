import React from 'react';
import { getSaleAction } from '@/actions/sales';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, numberToWords } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getSaleAction(id);

  if (!res.success || !res.data) {
    return <div className="p-8 text-center text-muted-foreground font-medium">{!res.success ? res.error : 'Sale not found'}</div>;
  }

  const sale = res.data;
  const grandTotal = sale.grand_total ?? sale.totalAmount ?? 0;
  const invNo = sale.invoice_number || sale.invoiceNumber || sale.id;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/sales">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>
        <div className="space-x-2">
          <Button variant="outline"><Printer className="h-4 w-4 mr-2" /> Print A4</Button>
          <Button variant="outline"><Printer className="h-4 w-4 mr-2" /> Print 80mm</Button>
          {sale.status !== 'CANCELLED' && sale.status !== 'REFUNDED' && (
            <Button variant="destructive" className="ml-4">
              <RotateCcw className="h-4 w-4 mr-2" /> Process Return
            </Button>
          )}
        </div>
      </div>

      {(sale.status === 'CANCELLED' || sale.status === 'REFUNDED') && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md font-bold text-center border border-destructive/20">
          THIS INVOICE HAS BEEN RETURNED / CANCELLED
        </div>
      )}

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="text-center border-b pb-6">
          <CardTitle className="text-3xl text-green-700">KRUSHI OS</CardTitle>
          <CardDescription className="text-md">Agricultural Shop & Services</CardDescription>
          <div className="mt-4 grid grid-cols-2 text-left text-sm gap-4">
            <div>
              <p className="font-bold">Invoice To:</p>
              <p>{sale.customer?.name || 'Walk-in Customer'}</p>
              <p>{sale.customer?.phone || (sale.customer as any)?.mobile}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">Invoice #:</span> {invNo}</p>
              <p><span className="font-bold">Date:</span> {new Date(sale.sale_date || sale.created_at).toLocaleString()}</p>
              <p><span className="font-bold">Status:</span> {sale.status}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <table className="w-full text-sm mb-6">
            <thead className="border-b">
              <tr>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Disc%</th>
                <th className="py-2 text-right">GST%</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="border-b">
              {sale.items?.map((item: any) => {
                const qty = item.quantity || 1;
                const rate = item.selling_price ?? item.unitPrice ?? item.rate ?? 0;
                const disc = item.discount_percent ?? item.discountPercent ?? item.discount ?? 0;
                const gst = item.gst_rate ?? item.gstRate ?? 0;
                const amt = item.total_amount ?? item.totalAmount ?? (qty * rate);
                return (
                  <tr key={item.id}>
                    <td className="py-2">{item.product_name || item.product?.name}</td>
                    <td className="py-2 text-center">{qty}</td>
                    <td className="py-2 text-right">{formatCurrency(rate)}</td>
                    <td className="py-2 text-right">{disc}%</td>
                    <td className="py-2 text-right">{gst}%</td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span> <span>{formatCurrency(sale.subtotal || grandTotal)}</span></div>
              {(sale.total_discount || 0) > 0 && (
                <div className="flex justify-between text-destructive"><span>Discount:</span> <span>-{formatCurrency(sale.total_discount)}</span></div>
              )}
              {(sale.total_tax || 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span> <span>{formatCurrency(sale.total_tax)}</span></div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                <span>Grand Total:</span> <span className="text-green-700">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t text-sm italic text-muted-foreground">
            Amount in words: {numberToWords(grandTotal)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
