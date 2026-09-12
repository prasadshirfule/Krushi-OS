'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StatsCards from '@/components/dashboard/stats-cards';
import SalesChart from '@/components/dashboard/sales-chart';
import RecentSales from '@/components/dashboard/recent-sales';
import AlertsPanel from '@/components/dashboard/alerts-panel';
import TopProducts from '@/components/dashboard/top-products';
import ActivityFeed from '@/components/dashboard/activity-feed';
import { isClientDemoMode, getDemoDashboardDataClient } from '@/lib/client-demo-store';
import { getDashboardStatsAction } from '@/actions/dashboard';
import { useRouter } from 'next/navigation';

import { useLanguage } from '@/lib/i18n';

interface DashboardClientWrapperProps {
  initialStats: any;
  initialLowStock: any[];
  initialExpiring: any[];
  initialActivities: any[];
}

export default function DashboardClientWrapper({
  initialStats,
  initialLowStock = [],
  initialExpiring = [],
  initialActivities = [],
}: DashboardClientWrapperProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(initialStats);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>(initialLowStock);
  const [expiringBatches, setExpiringBatches] = useState<any[]>(initialExpiring);
  const [activities, setActivities] = useState<any[]>(initialActivities);

  const syncData = useCallback(async () => {
    if (isClientDemoMode()) {
      try {
        const liveData = getDemoDashboardDataClient();
        setStats(liveData.stats);
        setLowStockProducts(liveData.lowStockProducts);
        setExpiringBatches(liveData.expiringBatches);
        setActivities(liveData.activities);
      } catch (err) {
        console.error('Error synchronizing dashboard live data:', err);
      }
      return;
    }

    try {
      const res = await getDashboardStatsAction();
      if (res.success && res.data) {
        setStats(res.data);
        if (res.data.lowStockProducts) setLowStockProducts(res.data.lowStockProducts);
        if (res.data.expiringBatches) setExpiringBatches(res.data.expiringBatches);
        if (res.data.activities) setActivities(res.data.activities);
      }
    } catch (err) {
      console.warn('Dashboard live refresh warning:', err);
    }
  }, []);

  useEffect(() => {
    setStats(initialStats);
    setLowStockProducts(initialLowStock);
    setExpiringBatches(initialExpiring);
    setActivities(initialActivities);

    let debounceTimer: NodeJS.Timeout | null = null;
    const handleDataMutationEvent = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        syncData();
      }, 300);
    };

    window.addEventListener('krushi-sales-updated', handleDataMutationEvent);
    window.addEventListener('krushi-products-updated', handleDataMutationEvent);
    window.addEventListener('krushi-customers-updated', handleDataMutationEvent);
    window.addEventListener('krushi-ledger-updated', handleDataMutationEvent);
    window.addEventListener('storage', handleDataMutationEvent);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('krushi-sales-updated', handleDataMutationEvent);
      window.removeEventListener('krushi-products-updated', handleDataMutationEvent);
      window.removeEventListener('krushi-customers-updated', handleDataMutationEvent);
      window.removeEventListener('krushi-ledger-updated', handleDataMutationEvent);
      window.removeEventListener('storage', handleDataMutationEvent);
    };
  }, [initialStats, initialLowStock, initialExpiring, initialActivities, syncData]);

  return (
    <div className="flex flex-col gap-6 p-3 sm:p-6 min-w-0 max-w-full w-full">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t('dashboard.title', 'Dashboard')}</h1>
      
      <div className="min-w-0 max-w-full w-full">
        <StatsCards stats={stats} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 min-w-0 max-w-full w-full">
        <div className="lg:col-span-4 min-w-0 max-w-full w-full">
          <SalesChart data={stats?.salesChart || []} />
        </div>
        <div className="lg:col-span-3 min-w-0 max-w-full w-full">
          <TopProducts products={stats?.topProducts || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 min-w-0 max-w-full w-full">
        <div className="lg:col-span-4 min-w-0 max-w-full w-full">
          <RecentSales sales={stats?.recentSales || []} />
        </div>
        <div className="lg:col-span-3 min-w-0 max-w-full w-full">
          <AlertsPanel 
            lowStockProducts={lowStockProducts || []} 
            expiringBatches={expiringBatches || []} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 min-w-0 max-w-full w-full">
        <ActivityFeed activities={activities || []} />
      </div>
    </div>
  );
}
