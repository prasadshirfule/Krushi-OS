'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, TrendingUp, Receipt, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export interface DashboardStats {
  todaySales: {
    total?: number;
    total_sales?: number;
    amount?: number;
    profit?: number;
    count?: number;
  };
  totalOutstanding: number;
  totalPayable: number;
  lowStockCount: number;
  expiringCount: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const salesAmount = Number(stats?.todaySales?.total ?? stats?.todaySales?.amount ?? stats?.todaySales?.total_sales ?? 0);
  const salesProfit = Number(stats?.todaySales?.profit ?? 0);
  const salesCount = Number(stats?.todaySales?.count ?? 0);
  const totalOutstanding = Number(stats?.totalOutstanding ?? 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
          <IndianRupee className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(salesAmount)}</div>
          <p className="text-xs text-muted-foreground">{salesCount} bills today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Profit</CardTitle>
          <TrendingUp className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(salesProfit)}</div>
          <p className="text-xs text-muted-foreground">Estimated margin</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          <Receipt className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{salesCount}</div>
          <p className="text-xs text-muted-foreground">Invoices generated</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          <CreditCard className={`h-4 w-4 ${totalOutstanding > 50000 ? 'text-red-600' : 'text-orange-600'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
          <p className="text-xs text-muted-foreground">To be collected</p>
        </CardContent>
      </Card>

      <Card>
        <Link href="/inventory?filter=low-stock" className="block h-full cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 hover:bg-muted/50 rounded-t-lg transition-colors">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="hover:bg-muted/50 rounded-b-lg transition-colors h-full">
            <div className="text-2xl font-bold">{stats?.lowStockCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Items need reorder</p>
          </CardContent>
        </Link>
      </Card>

      <Card>
        <Link href="/inventory?filter=expiring" className="block h-full cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 hover:bg-muted/50 rounded-t-lg transition-colors">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="hover:bg-muted/50 rounded-b-lg transition-colors h-full">
            <div className="text-2xl font-bold">{stats?.expiringCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">Batches near expiry</p>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}
