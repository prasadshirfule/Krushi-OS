import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer, Building2, Receipt, Package, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { getPurchaseById } from '@/services/purchases.service';

export const dynamic = 'force-dynamic';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthAndPermissions();
  const purchase = await getPurchaseById(user.shop_id, id);

  if (!purchase) {
    notFound();
  }

  const supplier = purchase.supplier || {};
  const items = purchase.items || purchase.purchase_items || [];
  const total = Number(purchase.total_amount || 0);
  const paid = Number(purchase.paid_amount || 0);
  const due = Math.max(0, total - paid);
  const isPaid = total > 0 && paid >= total;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-3 sm:p-6 min-w-0">
      {/* ─── Top Header & Print ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Purchase Invoice #{purchase.invoice_number || purchase.id.substring(0, 8).toUpperCase()}
              </h1>
              <Badge variant={isPaid ? "default" : "destructive"}>
                {isPaid ? 'Fully Paid' : `Due: ${formatCurrency(due)}`}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Recorded on {formatDate(purchase.purchase_date || purchase.created_at)}
            </p>
          </div>
        </div>

        {/* Client Print Button Component */}
        <Link href={`#print`} className="inline-block">
          <Button variant="outline" size="sm" className="font-semibold gap-1.5" onClick={undefined}>
            <Printer className="h-4 w-4" /> Print Invoice
          </Button>
        </Link>
      </div>

      {/* ─── Supplier & Bill Meta Cards ─── */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Supplier Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-bold text-base text-foreground">
              {supplier.name || 'Unknown Supplier'}
            </p>
            {supplier.company && (
              <p className="text-muted-foreground">{supplier.company}</p>
            )}
            <div className="pt-1 text-xs space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Phone / Mobile:</span> {supplier.mobile || supplier.phone || 'N/A'}</p>
              <p><span className="font-medium text-foreground">GSTIN:</span> {supplier.gst_number || 'N/A'}</p>
              {supplier.address && (
                <p><span className="font-medium text-foreground">Address:</span> {supplier.address}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Bill & Transaction Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground block">Invoice / Bill #</span>
                <span className="font-bold font-mono text-foreground text-sm">
                  {purchase.invoice_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Purchase Date</span>
                <span className="font-semibold text-foreground text-sm">
                  {formatDate(purchase.purchase_date || purchase.created_at)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Status</span>
                <span className="font-semibold capitalize text-foreground text-sm">
                  {purchase.status || 'Completed'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Total Inward Units</span>
                <span className="font-bold text-foreground text-sm">
                  {items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0)} units
                </span>
              </div>
            </div>
            {purchase.notes && (
              <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Remarks:</span> {purchase.notes}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Purchased Items Table ─── */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Received Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-y border-border">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">Batch #</th>
                  <th className="py-3 px-3">Expiry</th>
                  <th className="py-3 px-3 text-right">Inward Qty</th>
                  <th className="py-3 px-3 text-right">Purchase Rate</th>
                  <th className="py-3 px-3 text-right">GST %</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((it: any, idx: number) => {
                  const prodName = it.product_name || it.product?.name || 'Product';
                  const batchNo = it.batch_number || it.batch?.batch_number || 'Default';
                  const exp = it.expiry_date || it.batch?.expiry_date;
                  const rate = Number(it.purchase_price || 0);
                  const qty = Number(it.quantity || 0);
                  const gst = Number(it.gst_rate || 0);
                  const lineTotal = Number(it.total_amount || (qty * rate));

                  return (
                    <tr key={it.id || idx} className="hover:bg-accent/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {prodName}
                        {it.product?.sku && (
                          <span className="block font-mono text-[10px] text-muted-foreground font-normal">
                            SKU: {it.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs">
                        <Badge variant="outline" className="font-mono text-[11px]">{batchNo}</Badge>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {exp ? formatDate(exp) : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-foreground">
                        {qty} {it.product?.unit || 'Units'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatCurrency(rate)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                        {gst}%
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-foreground font-mono">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Financial Summary ─── */}
      <div className="flex justify-end">
        <Card className="w-full md:w-80 border-border shadow-sm">
          <CardContent className="p-4 space-y-2.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal (Pre-tax)</span>
              <span className="font-medium text-foreground">{formatCurrency(purchase.subtotal || 0)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>GST / Tax</span>
              <span className="font-medium text-foreground">{formatCurrency(purchase.tax_amount || 0)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-bold text-base text-foreground">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Amount Paid</span>
              <span className="font-semibold text-foreground">{formatCurrency(paid)}</span>
            </div>
            {due > 0 && (
              <div className="flex justify-between text-xs font-bold text-destructive pt-1 border-t border-border/60">
                <span>Balance Payable (Credit)</span>
                <span>{formatCurrency(due)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
