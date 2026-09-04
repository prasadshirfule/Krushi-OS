import React from 'react';
import { getSalesAction } from '@/actions/sales';
import { SalesHistoryClient } from '@/components/sales/sales-history-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function SalesPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const salesRes = await getSalesAction(params);
  
  const sales: any[] = salesRes.success 
    ? (Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.sales || []) 
    : [];

  return <SalesHistoryClient initialSales={sales} />;
}
