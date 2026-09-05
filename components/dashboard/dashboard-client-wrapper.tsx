'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StatsCards from '@/components/dashboard/stats-cards';
import SalesChart from '@/components/dashboard/sales-chart';
import RecentSales from '@/components/dashboard/recent-sales';
import AlertsPanel from '@/components/dashboard/alerts-panel';
import TopProducts from '@/components/dashboard/top-products';
import ActivityFeed from '@/components/dashboard/activity-feed';
import { isClientDemoMode, getDemoDashboardDataClient } from '@/lib/client-demo-store';

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
  const [stats, setStats] = useState<any>(initialStats);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>(initialLowStock);
  const [expiringBatches, setExpiringBatches] = useState<any[]>(initialExpiring);
  const [activities, setActivities] = useState<any[]>(initialActivities);

  const syncData = useCallback(() => {
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
    }
  }, []);

  useEffect(() => {
    if (isClientDemoMode()) {
      syncData();

      const handleStorageOrEvent = () => {
        syncData();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          syncData();
        }
      };

      window.addEventListener('krushi-sales-updated', handleStorageOrEvent);
      window.addEventListener('krushi-products-updated', handleStorageOrEvent);
      window.addEventListener('krushi-customers-updated', handleStorageOrEvent);
      window.addEventListener('krushi-ledger-updated', handleStorageOrEvent);
      window.addEventListener('storage', handleStorageOrEvent);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('krushi-sales-updated', handleStorageOrEvent);
        window.removeEventListener('krushi-products-updated', handleStorageOrEvent);
        window.removeEventListener('krushi-customers-updated', handleStorageOrEvent);
        window.removeEventListener('krushi-ledger-updated', handleStorageOrEvent);
        window.removeEventListener('storage', handleStorageOrEvent);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      setStats(initialStats);
      setLowStockProducts(initialLowStock);
      setExpiringBatches(initialExpiring);
      setActivities(initialActivities);
    }
  }, [initialStats, initialLowStock, initialExpiring, initialActivities, syncData]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <StatsCards stats={stats} />
      
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-4">
          <SalesChart data={stats?.salesChart || []} />
        </div>
        <div className="lg:col-span-3">
          <TopProducts products={stats?.topProducts || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <div className="lg:col-span-4">
          <RecentSales sales={stats?.recentSales || []} />
        </div>
        <div className="lg:col-span-3">
          <AlertsPanel 
            lowStockProducts={lowStockProducts || []} 
            expiringBatches={expiringBatches || []} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1">
        <ActivityFeed activities={activities || []} />
      </div>
    </div>
  );
}
