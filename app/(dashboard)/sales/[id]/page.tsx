import React from 'react';
import { getSaleAction } from '@/actions/sales';
import { SaleDetailView } from '@/components/sales/sale-detail-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getSaleAction(id);
  const sale = res.success ? res.data : null;

  return <SaleDetailView initialSale={sale} saleId={id} />;
}
