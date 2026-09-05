'use client';

import React from 'react';
import type { SaleWithItems } from '@/types/sales';
import { ReferenceTaxInvoice } from '@/components/invoice/reference-tax-invoice';

interface Settings {
  shopName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  licenseNumber?: string;
  termsAndConditions?: string;
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
  shop_email?: string;
  shop_gst?: string;
  shop_license?: string;
  invoice_terms?: string;
}

interface InvoiceA4Props {
  sale: SaleWithItems;
  shopSettings?: Settings;
}

export function InvoiceA4({ sale }: InvoiceA4Props) {
  return <ReferenceTaxInvoice sale={sale} />;
}
