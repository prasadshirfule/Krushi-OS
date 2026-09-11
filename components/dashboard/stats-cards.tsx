'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, TrendingUp, Receipt, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

export interface DashboardStats {
  todaySales: {
    total?: number;
    total_sales?: number;
    amount?: number;
    profit?: number;
    count?: number;
  };
  totalBills?: number;
  totalOutstanding: number;
  totalPayable: number;
  lowStockCount: number;
  expiringCount: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useLanguage();
  const salesAmount = Number(stats?.todaySales?.total ?? stats?.todaySales?.amount ?? stats?.todaySales?.total_sales ?? 0);
  const todayBillsCount = Number(stats?.todaySales?.count ?? 0);
  const totalOutstanding = Number(stats?.totalOutstanding ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Today's Sales -> /sales */}
      <Card className="hover:border-primary/50 transition-colors">
        <Link href="/sales" className="block h-full cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 hover:bg-muted/50 rounded-t-lg transition-colors">
            <CardTitle className="text-sm font-medium">{t('dashboard.todaySales', "Today's Sales")}</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="hover:bg-muted/50 rounded-b-lg transition-colors h-full">
            <div className="text-2xl font-bold">{formatCurrency(salesAmount)}</div>
            <p className="text-xs text-muted-foreground">{todayBillsCount} {t('sales.billsToday', 'bills today')}</p>
          </CardContent>
        </Link>
      </Card>

      {/* 2. Today's Bills (Only today's count) -> /sales */}
      <Card className="hover:border-purple-500/50 transition-colors">
        <Link href="/sales" className="block h-full cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 hover:bg-muted/50 rounded-t-lg transition-colors">
            <CardTitle className="text-sm font-medium">{t('sales.todayRevenue', "Today's Bills")}</CardTitle>
            <Receipt className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="hover:bg-muted/50 rounded-b-lg transition-colors h-full">
            <div className="text-2xl font-bold">{todayBillsCount}</div>
            <p className="text-xs text-muted-foreground">{t('sales.allRecords', 'Invoices today')}</p>
          </CardContent>
        </Link>
      </Card>

      {/* 3. Outstanding -> /customers */}
      <Card className="hover:border-orange-500/50 transition-colors">
        <Link href="/customers" className="block h-full cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 hover:bg-muted/50 rounded-t-lg transition-colors">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className={`h-4 w-4 ${totalOutstanding > 50000 ? 'text-red-600' : 'text-orange-600'}`} />
          </CardHeader>
          <CardContent className="hover:bg-muted/50 rounded-b-lg transition-colors h-full">
            <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">To be collected</p>
          </CardContent>
        </Link>
      </Card>

      {/* 4. Low Stock -> /inventory?filter=low-stock */}
      <Card className="hover:border-red-500/50 transition-colors">
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

      {/* 5. Expiring Soon -> /inventory?filter=expiring */}
      <Card className="hover:border-amber-500/50 transition-colors">
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
