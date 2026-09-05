'use client'

import React, { useState } from 'react'
import { InvoiceA4 } from './invoice-a4'
import { Invoice80mm } from './invoice-80mm'
import { Invoice58mm } from './invoice-58mm'
import type { SaleWithItems } from '@/types/sales'
import { printInvoiceDirectly, downloadInvoiceAsPDF } from '@/components/invoice/reference-tax-invoice'

interface Settings {
  shopName: string
  addressLine1: string
  addressLine2?: string
  phone: string
  email?: string
  gstNumber?: string
  licenseNumber?: string
  termsAndConditions?: string
}

interface PrintPreviewProps {
  sale: SaleWithItems
  shopSettings: Settings
  defaultFormat?: 'a4' | '80mm' | '58mm'
  onClose?: () => void
}

export function PrintPreview({ sale, shopSettings, defaultFormat = 'a4', onClose }: PrintPreviewProps) {
  const [format, setFormat] = useState<'a4' | '80mm' | '58mm'>(defaultFormat)

  const handlePrint = () => {
    if (format === 'a4') {
      printInvoiceDirectly('printable-tax-invoice')
    } else {
      window.print()
    }
  }

  const handleDownloadPdf = async () => {
    if (format === 'a4') {
      await downloadInvoiceAsPDF('printable-tax-invoice', `Invoice-${sale.invoice_number || sale.id}.pdf`)
    } else {
      window.open(`/api/print/invoice/${sale.id}?format=pdf`, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col no-print">
      {/* Top bar */}
      <div className="bg-white dark:bg-zinc-900 border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold">Print Preview</h2>
          <div className="flex bg-gray-100 dark:bg-zinc-800 rounded p-1">
            <button 
              className={`px-3 py-1 text-sm rounded ${format === 'a4' ? 'bg-white dark:bg-zinc-700 shadow' : ''}`}
              onClick={() => setFormat('a4')}
            >
              A4
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded ${format === '80mm' ? 'bg-white dark:bg-zinc-700 shadow' : ''}`}
              onClick={() => setFormat('80mm')}
            >
              80mm
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded ${format === '58mm' ? 'bg-white dark:bg-zinc-700 shadow' : ''}`}
              onClick={() => setFormat('58mm')}
            >
              58mm
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-sm font-medium"
          >
            Download PDF
          </button>
          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
          >
            Print
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Preview Area - non printable container */}
      <div className="flex-1 overflow-auto p-8 flex justify-center bg-gray-100 dark:bg-zinc-800">
        <div className="print-content-wrapper shadow-2xl overflow-hidden bg-white">
          <div className="print-content">
            {format === 'a4' && <InvoiceA4 sale={sale} shopSettings={shopSettings} />}
            {format === '80mm' && <Invoice80mm sale={sale} shopSettings={shopSettings} />}
            {format === '58mm' && <Invoice58mm sale={sale} shopSettings={shopSettings} />}
          </div>
        </div>
      </div>
    </div>
  )
}
