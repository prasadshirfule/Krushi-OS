'use client'

import React from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SaleWithItems } from '@/types/sales'

interface Settings {
  shopName?: string
  addressLine1?: string
  addressLine2?: string
  phone?: string
  gstNumber?: string
  shop_name?: string
  shop_address?: string
  shop_phone?: string
  shop_gst?: string
}

interface Invoice80mmProps {
  sale: SaleWithItems
  shopSettings: Settings
}

export function Invoice80mm({ sale, shopSettings }: Invoice80mmProps) {
  const lineSeparator = "-".repeat(32)
  const shopName = shopSettings.shopName || shopSettings.shop_name || 'KRUSHI OS'
  const shopAddress = shopSettings.addressLine1 || shopSettings.shop_address || ''
  const shopPhone = shopSettings.phone || shopSettings.shop_phone || ''
  const shopGst = shopSettings.gstNumber || shopSettings.shop_gst || ''

  const invNo = sale.invoice_number || sale.invoiceNumber || sale.id
  const dateStr = sale.sale_date || sale.created_at || sale.createdAt || new Date().toISOString()
  const grandTotal = Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? 0)
  const discountTotal = Number(sale.discount_amount ?? sale.total_discount ?? sale.discountAmount ?? 0)
  const taxTotal = Number(sale.tax_amount ?? sale.total_tax ?? (sale.cgstTotal ? (sale.cgstTotal + (sale.sgstTotal || 0)) : 0))
  const subtotal = Number(sale.subtotal ?? (grandTotal + discountTotal - taxTotal))

  return (
    <div className="print-80mm bg-white text-black mx-auto p-4 leading-tight w-[80mm]">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="font-bold text-lg uppercase">{shopName}</h1>
        {shopAddress && <p className="text-xs">{shopAddress}</p>}
        {shopPhone && <p className="text-xs">Phone: {shopPhone}</p>}
        {shopGst && <p className="text-xs">GST: {shopGst}</p>}
      </div>

      <div className="text-xs text-center mb-2">{lineSeparator}</div>

      {/* Meta */}
      <div className="text-xs mb-2">
        <div className="flex justify-between">
          <span>Inv: {invNo}</span>
        </div>
        <div className="flex justify-between">
          <span>Date: {formatDate(dateStr)}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer: {sale.customer?.name || 'Walk-in'}</span>
        </div>
      </div>

      <div className="text-xs text-center mb-2">{lineSeparator}</div>

      {/* Items */}
      <div className="text-xs mb-2 w-full">
        <div className="flex justify-between font-bold mb-1">
          <span>Item</span>
          <span>Amount</span>
        </div>
        
        {sale.items.map((item: any, index: number) => {
          const product = item.product || {}
          const qty = item.quantity || 1
          const price = item.selling_price ?? item.unitPrice ?? 0
          const itemTotal = item.total_amount ?? item.totalAmount ?? (qty * price)
          return (
            <div key={item.id || index} className="mb-2">
              <div className="font-medium truncate">{product.name || item.product_name || 'Unknown'}</div>
              <div className="flex justify-between pl-2">
                <span>{qty} x {formatCurrency(price)}</span>
                <span>{formatCurrency(itemTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-xs text-center mb-2">{lineSeparator}</div>

      {/* Totals */}
      <div className="text-xs mb-2">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(sale.subtotal || grandTotal)}</span>
        </div>
        {discountTotal > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-{formatCurrency(discountTotal)}</span>
          </div>
        )}
        {taxTotal > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>{formatCurrency(taxTotal)}</span>
          </div>
        )}
      </div>

      <div className="text-xs text-center mb-1">{lineSeparator}</div>

      <div className="flex justify-between font-bold text-sm mb-1">
        <span>TOTAL:</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      <div className="text-xs text-center mb-2">{lineSeparator}</div>

      {/* Footer */}
      <div className="text-xs flex justify-between mb-4">
        <span>Paid:</span>
        <span>{formatCurrency(grandTotal)}</span>
      </div>

      <div className="text-center text-xs font-bold mt-4 mb-2">
        Thank you! Visit again.
      </div>
      <div className="text-xs text-center mb-8">{lineSeparator}</div>
    </div>
  )
}
