'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, numberToWords } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { 
  isClientDemoMode, 
  getDemoSaleByIdClient 
} from '@/lib/client-demo-store';

interface SaleDetailViewProps {
  initialSale: any | null;
  saleId: string;
}

export function SaleDetailView({ initialSale, saleId }: SaleDetailViewProps) {
  const [sale, setSale] = useState<any | null>(initialSale);
  const [shopDetails, setShopDetails] = useState<any>({
    shopName: 'KRUSHI OS SEVA KENDRA',
    ownerName: '',
    address: 'Main Market Road',
    village: 'Example Village',
    district: 'Example District',
    state: 'State',
    pincode: '123456',
    contact1: '9876543210',
    contact2: '',
    email: '',
    gstNumber: '22AAAAA0000A1Z5',
    licenseNumber: '',
    registrationNumber: '',
    invoiceTerms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.',
    authorizedSignatory: 'For KRUSHI OS SEVA KENDRA',
    logoBase64: '',
  });

  useEffect(() => {
    if (!initialSale && isClientDemoMode()) {
      const found = getDemoSaleByIdClient(saleId);
      if (found) setSale(found);
    } else {
      setSale(initialSale);
    }

    try {
      const shopSettingsRaw = localStorage.getItem('krushi_demo_shop_details');
      if (shopSettingsRaw) {
        setShopDetails((prev: any) => ({ ...prev, ...JSON.parse(shopSettingsRaw) }));
      }
    } catch {}
  }, [initialSale, saleId]);

  if (!sale) {
    return (
      <div className="p-8 text-center text-muted-foreground font-medium space-y-4">
        <p>Sale not found</p>
        <Link href="/sales">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sales
          </Button>
        </Link>
      </div>
    );
  }

  const grandTotal = Number(sale.grand_total ?? sale.total_amount ?? sale.totalAmount ?? sale.payableAmount ?? 0);
  const subTotal = Number(sale.subtotal || grandTotal);
  const discountAmount = Number(sale.discount_amount || sale.total_discount || 0);
  const taxAmount = Number(sale.tax_amount || sale.total_tax || 0);
  const cgstAmount = Number(sale.cgst_total ?? (taxAmount / 2));
  const sgstAmount = Number(sale.sgst_total ?? (taxAmount / 2));
  const roundOff = Number(sale.round_off || 0);
  
  const paymentMethod = (sale.payment_method || sale.payment_mode || 'CASH').toUpperCase();
  const isCredit = paymentMethod === 'CREDIT';
  const amountPaid = Number(sale.paid_amount ?? (isCredit ? 0 : grandTotal));
  const balanceDue = Math.max(0, grandTotal - amountPaid);

  const invNo = sale.invoice_number || sale.invoiceNumber || (sale.id ? sale.id.substring(0, 8).toUpperCase() : 'INV');
  const items = sale.items || sale.sale_items || [];
  const saleDate = new Date(sale.sale_date || sale.created_at);

  const formatPackSize = (product: any, item: any) => {
    if (product?.product_size_value) return `${product.product_size_value} ${product.product_size_unit || 'KG'}`;
    if (product?.pack_size) return product.pack_size;
    if (product?.unit) return product.unit;
    if (item?.unit) return item.unit;
    return '';
  };

  const shopAddressLine = [shopDetails.address, shopDetails.village, shopDetails.district, shopDetails.state, shopDetails.pincode].filter(Boolean).join(', ');
  const customerAddressLine = [sale.customer?.village || sale.customer?.address, sale.customer?.district, sale.customer?.state].filter(Boolean).join(', ');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-muted/30 min-h-screen pb-12 print:bg-white print:p-0">
      {/* ─── ACTION BAR (NO PRINT) ─── */}
      <div className="max-w-[210mm] mx-auto p-4 no-print flex justify-between items-center gap-3 flex-wrap bg-background shadow-sm border-b mb-6 rounded-b-xl">
        <Link href="/sales">
          <Button variant="outline" className="border-border shadow-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </Link>
        <div className="space-x-2">
          {sale.status !== 'CANCELLED' && sale.status !== 'REFUNDED' && (
            <Button variant="destructive" className="shadow-sm">
              <RotateCcw className="h-4 w-4 mr-2" /> Process Return
            </Button>
          )}
          <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm">
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ─── A4 INVOICE TEMPLATE (PRINT CONTENT) ─── */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-xl print:shadow-none print:w-full print:max-w-full print:m-0 text-black">
        <div className="print-content bg-white p-[10mm]">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col items-center border-b-2 border-black pb-4 mb-4 text-center">
            {shopDetails.logoBase64 && (
              <img src={shopDetails.logoBase64} alt="Logo" className="h-16 object-contain mb-2" />
            )}
            <h1 className="text-3xl font-black text-black tracking-tight">{shopDetails.shopName.toUpperCase()}</h1>
            {shopDetails.ownerName && (
              <p className="text-sm font-semibold mt-1">Proprietor: {shopDetails.ownerName}</p>
            )}
            {shopAddressLine && (
              <p className="text-sm mt-1">{shopAddressLine}</p>
            )}
            <div className="flex flex-wrap justify-center gap-x-4 text-sm mt-1 font-medium">
              {shopDetails.contact1 && <span>Mob: {shopDetails.contact1}</span>}
              {shopDetails.contact2 && <span>Alt: {shopDetails.contact2}</span>}
            </div>
            <div className="flex flex-wrap justify-center gap-x-6 text-sm mt-1 font-bold">
              {shopDetails.gstNumber && <span>GSTIN: {shopDetails.gstNumber}</span>}
              {shopDetails.licenseNumber && <span>Licence: {shopDetails.licenseNumber}</span>}
            </div>
          </div>

          <h2 className="text-center text-lg font-bold mb-4 underline uppercase tracking-widest">Tax Invoice</h2>

          {/* INVOICE & CUSTOMER INFO */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b-2 border-black pb-4">
            <div className="space-y-1">
              <p><span className="font-bold inline-block w-24">Billed To:</span> <span className="font-semibold uppercase">{sale.customer?.name || sale.customer_name || 'Walk-in Customer'}</span></p>
              <p><span className="font-bold inline-block w-24">Mobile:</span> {sale.customer?.phone || (sale.customer as any)?.mobile || sale.customer_phone || 'N/A'}</p>
              {customerAddressLine && <p><span className="font-bold inline-block w-24">Address:</span> {customerAddressLine}</p>}
              {sale.customer?.gstin && <p><span className="font-bold inline-block w-24">GSTIN:</span> {sale.customer.gstin}</p>}
              {sale.customer?.aadhaar && <p><span className="font-bold inline-block w-24">Aadhaar:</span> XXXX XXXX {sale.customer.aadhaar.slice(-4)}</p>}
            </div>
            <div className="space-y-1 text-right">
              <p><span className="font-bold">Invoice No:</span> <span className="font-mono">{invNo}</span></p>
              <p><span className="font-bold">Date:</span> {saleDate.toLocaleDateString('en-IN')}</p>
              <p><span className="font-bold">Time:</span> {saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><span className="font-bold">Payment Mode:</span> {paymentMethod}</p>
              {(sale.status === 'CANCELLED' || sale.status === 'REFUNDED') && (
                <p className="text-red-600 font-bold mt-2 border border-red-600 p-1 inline-block">CANCELLED</p>
              )}
            </div>
          </div>

          {/* PRODUCT TABLE */}
          <div className="min-h-[300px]">
            <table className="w-full text-[13px] border-collapse border border-black mb-4">
              <thead>
                <tr className="bg-gray-100/80 border-b border-black">
                  <th className="border-r border-black py-2 px-1 text-center w-8">Sr.</th>
                  <th className="border-r border-black py-2 px-2 text-left">Product Description</th>
                  <th className="border-r border-black py-2 px-1 text-center w-16">HSN</th>
                  <th className="border-r border-black py-2 px-1 text-center w-16">Batch</th>
                  <th className="border-r border-black py-2 px-1 text-center w-16">Expiry</th>
                  <th className="border-r border-black py-2 px-1 text-center w-12">Pack</th>
                  <th className="border-r border-black py-2 px-1 text-center w-12">Qty</th>
                  <th className="border-r border-black py-2 px-1 text-right w-16">Rate</th>
                  <th className="border-r border-black py-2 px-1 text-center w-12">GST%</th>
                  <th className="border-r border-black py-2 px-1 text-right w-20">Taxable</th>
                  <th className="py-2 px-2 text-right w-20">Total</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {items.map((item: any, idx: number) => {
                  const p = item.product || {};
                  const qty = item.quantity || 1;
                  const rate = Number(item.selling_price ?? item.unit_price ?? item.unitPrice ?? item.rate ?? 0);
                  const gst = Number(item.gst_rate ?? item.gstRate ?? item.gst ?? p.gst_rate ?? 0);
                  const amt = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * rate));
                  const disc = Number(item.discount_percent ?? item.discount ?? 0);
                  
                  // Mathematically exact reverse calculation if rate is inclusive
                  const grossAmount = qty * rate;
                  const discountAmount = (grossAmount * disc) / 100;
                  const netAmount = grossAmount - discountAmount;
                  
                  // Usually KRUSHI OS is inclusive. If it's already stored, use it, else recalculate
                  const taxable = Number(item.taxable_amount ?? (netAmount / (1 + gst / 100)));
                  
                  const prodName = item.product_name || p.name || 'Unknown Product';
                  const manufacturer = p.manufacturer || p.brand?.name || '';
                  const hsn = item.hsn_code || p.hsn_code || '';
                  const batch = item.batch_number || p.batch_number || '';
                  
                  let expiry = item.expiry_date || p.expiry_date || '';
                  if (expiry && expiry.includes('T')) {
                    const ed = new Date(expiry);
                    expiry = `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}`;
                  }
                  const packSize = formatPackSize(p, item);

                  return (
                    <tr key={item.id || idx} className="border-b border-black/20 last:border-b-0">
                      <td className="border-r border-black py-2 px-1 text-center">{idx + 1}</td>
                      <td className="border-r border-black py-2 px-2">
                        <div className="font-bold">{prodName}</div>
                        {manufacturer && <div className="text-[11px] text-gray-700">{manufacturer}</div>}
                      </td>
                      <td className="border-r border-black py-2 px-1 text-center text-[12px]">{hsn}</td>
                      <td className="border-r border-black py-2 px-1 text-center text-[12px] uppercase">{batch}</td>
                      <td className="border-r border-black py-2 px-1 text-center text-[12px]">{expiry}</td>
                      <td className="border-r border-black py-2 px-1 text-center text-[12px]">{packSize}</td>
                      <td className="border-r border-black py-2 px-1 text-center font-bold">{qty}</td>
                      <td className="border-r border-black py-2 px-1 text-right">{rate.toFixed(2)}</td>
                      <td className="border-r border-black py-2 px-1 text-center">{gst > 0 ? `${gst}%` : 'NIL'}</td>
                      <td className="border-r border-black py-2 px-1 text-right">{taxable.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-bold">
                        {amt.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {/* Empty rows to maintain height if few items */}
                {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black/10 last:border-b-0">
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-2"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="border-r border-black py-4 px-1"></td>
                    <td className="py-4 px-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SUMMARY & TOTALS */}
          <div className="flex flex-col md:flex-row border-t-2 border-black pt-4 mb-4">
            {/* Left side: Amount in words & Bank Details */}
            <div className="flex-1 pr-4">
              <div className="mb-4">
                <span className="font-bold text-sm">Amount in Words:</span>
                <p className="text-sm font-semibold italic capitalize">Rupees {numberToWords(grandTotal).toLowerCase()}</p>
              </div>
              <div className="text-[11px] space-y-1 mt-6">
                <p className="font-bold underline">Terms & Conditions:</p>
                <p className="whitespace-pre-line">{shopDetails.invoiceTerms}</p>
              </div>
            </div>

            {/* Right side: Calculations */}
            <div className="w-64">
              <table className="w-full text-sm font-semibold">
                <tbody>
                  <tr>
                    <td className="py-1">Taxable Subtotal:</td>
                    <td className="py-1 text-right">{formatCurrency(subTotal)}</td>
                  </tr>
                  {discountAmount > 0 && (
                    <tr>
                      <td className="py-1">Discount:</td>
                      <td className="py-1 text-right">- {formatCurrency(discountAmount)}</td>
                    </tr>
                  )}
                  {taxAmount > 0 && (
                    <>
                      <tr>
                        <td className="py-1">CGST:</td>
                        <td className="py-1 text-right">{formatCurrency(cgstAmount)}</td>
                      </tr>
                      <tr>
                        <td className="py-1">SGST:</td>
                        <td className="py-1 text-right">{formatCurrency(sgstAmount)}</td>
                      </tr>
                    </>
                  )}
                  {roundOff !== 0 && (
                    <tr>
                      <td className="py-1">Round Off:</td>
                      <td className="py-1 text-right">{formatCurrency(roundOff)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-black text-base font-black">
                    <td className="py-2">NET TOTAL:</td>
                    <td className="py-2 text-right">{formatCurrency(grandTotal)}</td>
                  </tr>
                  
                  {/* Payment Details */}
                  <tr className="border-t border-black/30">
                    <td className="py-1 text-gray-700">Amount Paid:</td>
                    <td className="py-1 text-right text-gray-700">{formatCurrency(amountPaid)}</td>
                  </tr>
                  {balanceDue > 0 && (
                    <tr>
                      <td className="py-1 text-red-700 font-bold">Balance / Udhari:</td>
                      <td className="py-1 text-right text-red-700 font-bold">{formatCurrency(balanceDue)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex justify-between items-end mt-12 text-sm font-bold">
            <div>
              <p>Customer Signature</p>
            </div>
            <div className="text-right">
              <p>{shopDetails.authorizedSignatory}</p>
              <p className="mt-8">Authorized Signatory</p>
            </div>
          </div>
          
          <div className="text-center text-[10px] text-gray-500 mt-6 border-t border-gray-300 pt-2">
            Generated by KRUSHI OS - Smart Agriculture & Retail Solutions
          </div>

        </div>
      </div>
    </div>
  );
}
