'use client';

import React from 'react';
import type { SaleWithItems } from '@/types/sales';
import { ThermalReceiptInvoice } from '@/components/invoice/thermal-receipt-invoice';

interface Settings {
  shopName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  gstNumber?: string;
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
  shop_gst?: string;
}

interface Invoice80mmProps {
  sale: SaleWithItems;
  shopSettings?: Settings;
}

export function Invoice80mm({ sale }: Invoice80mmProps) {
  return <ThermalReceiptInvoice sale={sale} />;
}
