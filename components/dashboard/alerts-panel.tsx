'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { Product, ProductBatch } from '@/types/database';
import { differenceInDays, parseISO } from 'date-fns';

type BatchWithProduct = ProductBatch & {
  product?: Product;
};

interface AlertsPanelProps {
  lowStockProducts: Product[];
  expiringBatches: BatchWithProduct[];
}

export default function AlertsPanel({ lowStockProducts, expiringBatches }: AlertsPanelProps) {
  
  const getExpiryColor = (days: number) => {
    if (days <= 7) return 'text-red-600 bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400';
    if (days <= 30) return 'text-orange-600 bg-orange-100 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400';
    return 'text-yellow-700 bg-yellow-100 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-400';
  };

  return (
    <div className="col-span-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* Low Stock Alerts */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base font-semibold">Low Stock Alerts</CardTitle>
          </div>
          <Link href="/inventory?filter=low-stock" className="text-xs text-muted-foreground hover:text-foreground">
            View All
          </Link>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          {lowStockProducts && lowStockProducts.length > 0 ? (
            <ul className="divide-y">
              {lowStockProducts.map((item: any) => (
                <li key={item.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <Link href={`/products/${item.id}`} className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Min stock: {item.min_stock_alert ?? item.min_stock ?? 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{item.stock_quantity ?? item.current_stock ?? item.total_stock ?? 0}</p>
                      <p className="text-xs text-muted-foreground">{item.unit || 'units'}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2 opacity-50" />
              <p className="text-sm">Stock levels are healthy</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expiry Alerts */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base font-semibold">Expiring Soon</CardTitle>
          </div>
          <Link href="/inventory?filter=expiring" className="text-xs text-muted-foreground hover:text-foreground">
            View All
          </Link>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          {expiringBatches && expiringBatches.length > 0 ? (
            <ul className="divide-y">
              {expiringBatches.map((batch) => {
                const dateStr = batch.exp_date || batch.expiry_date;
                const daysLeft = dateStr ? differenceInDays(parseISO(dateStr), new Date()) : 999;
                return (
                  <li key={batch.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <Link href={`/inventory`} className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">{batch.product?.name || 'Unknown Product'}</p>
                        <p className="text-xs text-muted-foreground mt-1">Batch: {batch.batch_number}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <Badge variant="outline" className={getExpiryColor(daysLeft)}>
                          {daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}
                        </Badge>
                        <p className="text-xs text-muted-foreground">Qty: {batch.stock_quantity ?? batch.quantity_available ?? 0}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2 opacity-50" />
              <p className="text-sm">No batches expiring soon</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
