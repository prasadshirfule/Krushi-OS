'use client'

import React from 'react'
import { formatCurrency, formatDate, numberToWords } from '@/lib/utils'
import type { SaleWithItems } from '@/types/sales'

interface Settings {
  shopName?: string
  addressLine1?: string
  addressLine2?: string
  phone?: string
  email?: string
  gstNumber?: string
  licenseNumber?: string
  termsAndConditions?: string
  shop_name?: string
  shop_address?: string
  shop_phone?: string
  shop_email?: string
  shop_gst?: string
  shop_license?: string
  invoice_terms?: string
}

interface InvoiceA4Props {
  sale: SaleWithItems
  shopSettings: Settings
}

export function InvoiceA4({ sale, shopSettings }: InvoiceA4Props) {
  const shopName = shopSettings.shopName || shopSettings.shop_name || 'KRUSHI OS'
  const shopAddress = shopSettings.addressLine1 || shopSettings.shop_address || ''
  const shopPhone = shopSettings.phone || shopSettings.shop_phone || ''
  const shopEmail = shopSettings.email || shopSettings.shop_email || ''
  const shopGst = shopSettings.gstNumber || shopSettings.shop_gst || ''
  const shopLicense = shopSettings.licenseNumber || shopSettings.shop_license || ''
  const terms = shopSettings.termsAndConditions || shopSettings.invoice_terms || ''

  const invNo = sale.invoice_number || sale.invoiceNumber || sale.id
  const dateStr = sale.sale_date || sale.created_at || sale.createdAt || new Date().toISOString()
  const grandTotal = sale.grand_total ?? sale.totalAmount ?? 0
  const discountTotal = sale.total_discount ?? sale.discountAmount ?? 0
  const taxTotal = sale.total_tax ?? (sale.cgstTotal ? (sale.cgstTotal + (sale.sgstTotal || 0)) : 0)

  return (
    <div className="print-a4 bg-white text-black p-8 mx-auto font-sans text-sm w-[210mm] min-h-[297mm]">
      {/* Header section */}
      <div className="flex justify-between items-start border-b-2 border-gray-300 pb-4 mb-4">
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">{shopName}</h1>
          {shopAddress && <p className="text-gray-700">{shopAddress}</p>}
          <p className="text-gray-700">Phone: {shopPhone} {shopEmail && `| Email: ${shopEmail}`}</p>
          {shopGst && <p className="text-gray-700 font-medium">GSTIN: {shopGst}</p>}
          {shopLicense && <p className="text-gray-700">License: {shopLicense}</p>}
        </div>
      </div>
      
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold bg-gray-200 inline-block px-4 py-1 rounded">TAX INVOICE</h2>
      </div>

      {/* Invoice meta */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div className="border border-gray-300 p-4 rounded bg-gray-50">
          <p><span className="font-semibold w-24 inline-block">Invoice No:</span> {invNo}</p>
          <p><span className="font-semibold w-24 inline-block">Date:</span> {formatDate(dateStr)}</p>
          <p><span className="font-semibold w-24 inline-block">Status:</span> <span className="uppercase">{sale.status || 'COMPLETED'}</span></p>
        </div>
        <div className="border border-gray-300 p-4 rounded bg-gray-50">
          <p><span className="font-semibold w-24 inline-block">Billed To:</span> {sale.customer?.name || 'Walk-in Customer'}</p>
          {(sale.customer as any)?.mobile && <p><span className="font-semibold w-24 inline-block">Mobile:</span> {(sale.customer as any).mobile}</p>}
          {(sale.customer as any)?.phone && <p><span className="font-semibold w-24 inline-block">Phone:</span> {(sale.customer as any).phone}</p>}
          {sale.customer?.address && <p><span className="font-semibold w-24 inline-block">Address:</span> {sale.customer.address}</p>}
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-left text-xs uppercase font-semibold">
              <th className="border border-gray-300 p-2 w-10 text-center">Sr.</th>
              <th className="border border-gray-300 p-2">Product Name</th>
              <th className="border border-gray-300 p-2 w-20 text-center">HSN</th>
              <th className="border border-gray-300 p-2 w-24 text-right">Qty</th>
              <th className="border border-gray-300 p-2 w-24 text-right">Rate</th>
              <th className="border border-gray-300 p-2 w-16 text-right">Disc%</th>
              <th className="border border-gray-300 p-2 w-28 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item: any, index: number) => {
              const product = item.product || {}
              const hsn = product.hsn_code || product.hsnCode || '-'
              const qty = item.quantity || 1
              const rate = item.selling_price ?? item.unitPrice ?? 0
              const disc = item.discount_percent ?? item.discountPercent ?? 0
              const total = item.total_amount ?? item.totalAmount ?? (qty * rate)
              const batchNum = item.batch_number || item.batchNumber || item.batch?.batch_number
              
              return (
                <tr key={item.id || index} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="border border-gray-300 p-2 text-center text-xs">{index + 1}</td>
                  <td className="border border-gray-300 p-2 text-xs">
                    <div className="font-medium">{product.name || item.product_name || 'Unknown Product'}</div>
                    {batchNum && <div className="text-[10px] text-gray-500">Batch: {batchNum}</div>}
                  </td>
                  <td className="border border-gray-300 p-2 text-center text-xs">{hsn}</td>
                  <td className="border border-gray-300 p-2 text-right text-xs">{qty} {product.unit || 'pcs'}</td>
                  <td className="border border-gray-300 p-2 text-right text-xs">{formatCurrency(rate)}</td>
                  <td className="border border-gray-300 p-2 text-right text-xs">{disc}%</td>
                  <td className="border border-gray-300 p-2 text-right text-xs font-medium">{formatCurrency(total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totals section */}
      <div className="flex justify-between items-start mb-8">
        <div className="w-1/2 pt-4">
          <p className="font-semibold mb-1 text-sm">Amount in words:</p>
          <p className="text-sm italic capitalize bg-gray-50 p-2 rounded border border-gray-200">
            {numberToWords ? numberToWords(grandTotal) : 'Amount in words not available'}
          </p>
          
          {terms && (
            <div className="mt-6 text-xs text-gray-600">
              <p className="font-semibold mb-1">Terms & Conditions:</p>
              <p className="whitespace-pre-line">{terms}</p>
            </div>
          )}
        </div>
        
        <div className="w-80 border-t-2 border-l-2 border-r-2 border-b-2 border-gray-300 rounded overflow-hidden">
          <div className="flex justify-between p-2 border-b border-gray-200">
            <span className="text-gray-600">Subtotal:</span>
            <span>{formatCurrency(sale.subtotal || grandTotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between p-2 border-b border-gray-200">
              <span className="text-gray-600">Discount:</span>
              <span>- {formatCurrency(discountTotal)}</span>
            </div>
          )}
          {taxTotal > 0 && (
            <div className="flex justify-between p-2 border-b border-gray-200">
              <span className="text-gray-600">Tax:</span>
              <span>{formatCurrency(taxTotal)}</span>
            </div>
          )}
          <div className="flex justify-between p-3 bg-gray-100 font-bold text-lg">
            <span>Grand Total:</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 flex justify-between items-end">
        <div className="text-sm text-gray-600 font-medium">
          Thank you for your business!
        </div>
        <div className="text-center w-64">
          <div className="border-b border-gray-400 h-8 mb-2"></div>
          <p className="text-sm font-semibold">Authorized Signatory</p>
          <p className="text-xs text-gray-500">For {shopName}</p>
        </div>
      </div>
    </div>
  )
}
