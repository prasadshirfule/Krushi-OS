'use client'

import React from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SaleWithItems } from '@/types/sales'

interface Settings {
  shopName?: string
  phone?: string
  shop_name?: string
  shop_phone?: string
}

interface Invoice58mmProps {
  sale: SaleWithItems
  shopSettings: Settings
}

export function Invoice58mm({ sale, shopSettings }: Invoice58mmProps) {
  const lineSeparator = "-".repeat(24)
  const shopName = shopSettings.shopName || shopSettings.shop_name || 'KRUSHI OS'
  const shopPhone = shopSettings.phone || shopSettings.shop_phone || ''
  const invNo = sale.invoice_number || sale.invoiceNumber || sale.id
  const dateStr = sale.sale_date || sale.created_at || sale.createdAt || new Date().toISOString()
  const grandTotal = sale.grand_total ?? sale.totalAmount ?? 0

  return (
    <div className="print-58mm bg-white text-black mx-auto p-2 leading-tight w-[58mm] text-[10px]">
      {/* Header */}
      <div className="text-center mb-1">
        <h1 className="font-bold text-sm uppercase truncate">{shopName}</h1>
        {shopPhone && <p>Ph: {shopPhone}</p>}
      </div>

      <div className="text-center mb-1">{lineSeparator}</div>

      {/* Meta */}
      <div className="mb-1">
        <div>Inv: {invNo}</div>
        <div>Date: {formatDate(dateStr)}</div>
      </div>

      <div className="text-center mb-1">{lineSeparator}</div>

      {/* Items */}
      <div className="mb-1 w-full">
        {sale.items.map((item: any, index: number) => {
          const product = item.product || {}
          const qty = item.quantity || 1
          const price = item.selling_price ?? item.unitPrice ?? 0
          const itemTotal = item.total_amount ?? item.totalAmount ?? (qty * price)
          return (
            <div key={item.id || index} className="mb-1">
              <div className="font-medium truncate max-w-full">{product.name || item.product_name || 'Item'}</div>
              <div className="flex justify-between pl-1 text-[9px]">
                <span>{qty}x{price}</span>
                <span>{formatCurrency(itemTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-center mb-1">{lineSeparator}</div>

      {/* Totals */}
      <div className="mb-1">
        <div className="flex justify-between">
          <span>Sub:</span>
          <span>{formatCurrency(sale.subtotal || grandTotal)}</span>
        </div>
        <div className="flex justify-between font-bold text-xs mt-1">
          <span>TOT:</span>
          <span>{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className="text-center mb-1">{lineSeparator}</div>

      <div className="text-center font-bold mt-2 mb-4">
        Thank you!
      </div>
    </div>
  )
}
