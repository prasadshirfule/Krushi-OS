import React from 'react';
import { getSalesAction } from '@/actions/sales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const safeFormatDate = (dateVal: any, formatStr: string) => {
  if (!dateVal) return '';
  try {
    const d = typeof dateVal === 'string' ? parseISO(dateVal) : new Date(dateVal);
    // fallback to new Date() if parseISO returns Invalid Date
    const validDate = isNaN(d.getTime()) ? new Date(dateVal) : d;
    return format(validDate, formatStr);
  } catch (e) {
    return '';
  }
};

export default async function SalesPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const salesRes = await getSalesAction(params);
  
  const sales: any[] = salesRes.success 
    ? (Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.sales || []) 
    : [];
  
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const todaySales = sales.filter((s: any) => {
    const val = s.sale_date || s.created_at;
    return val ? safeFormatDate(val, 'yyyy-MM-dd') === todayDateStr : false;
  });
  const todayRevenue = todaySales.reduce((acc: number, s: any) => acc + (s.grand_total ?? s.totalAmount ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <Link href="/billing">
          <Button className="bg-green-600 hover:bg-green-700">New Bill</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Today's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(todayRevenue)}</div>
            <p className="text-xs text-muted-foreground">{todaySales.length} bills today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="p-4 text-left font-medium">Invoice #</th>
                <th className="p-4 text-left font-medium">Date</th>
                <th className="p-4 text-left font-medium">Customer</th>
                <th className="p-4 text-right font-medium">Total</th>
                <th className="p-4 text-center font-medium">Status</th>
                <th className="p-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No sales found</td></tr>
              ) : (
                sales.map((sale: any) => (
                  <tr key={sale.id} className="border-b hover:bg-muted/20">
                    <td className="p-4 font-mono">{sale.invoice_number || sale.invoiceNumber || sale.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-4">{safeFormatDate(sale.sale_date || sale.created_at, 'MMM d, yyyy h:mm a')}</td>
                    <td className="p-4">{sale.customer?.name || 'Walk-in Customer'}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(sale.grand_total ?? sale.totalAmount ?? 0)}</td>
                    <td className="p-4 text-center">
                      <Badge variant={sale.status === 'COMPLETED' ? 'default' : 'secondary'} 
                             className={sale.status === 'COMPLETED' ? 'bg-green-600' : ''}>
                        {sale.status || 'COMPLETED'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/sales/${sale.id}`}>
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4 mr-2" /> View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
