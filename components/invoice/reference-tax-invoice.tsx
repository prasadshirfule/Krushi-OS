'use client';

import React, { useState, useEffect } from 'react';
import { numberToWords } from '@/lib/utils';
import { 
  ShopDetails, 
  DEFAULT_SHOP_DETAILS, 
  getSavedShopDetails, 
  formatShopAddress 
} from '@/lib/shop-details';
import { getDemoProductsClient } from '@/lib/client-demo-store';

export interface InvoiceItemData {
  id?: string;
  name: string;
  manufacturer?: string;
  hsn: string;
  batch: string;
  expiry: string;
  quantity: number;
  rate: number;          // Taxable rate per unit
  gstRate: number;       // e.g. 12, 18, 5
  rateWithGst: number;   // Unit price including GST
  total: number;         // Line total (Qty * RateWithGst)
  taxableAmount: number; // Line taxable total
  cgstAmount: number;
  sgstAmount: number;
}

export interface InvoiceProps {
  sale?: any;
  shopDetails?: Partial<ShopDetails>;
  customItems?: InvoiceItemData[];
}

// Helper to calculate exact reverse GST for items
export function calculateItemGst(totalAmt: number, qty: number, gstRate: number) {
  const safeQty = qty > 0 ? qty : 1;
  const safeRate = gstRate >= 0 ? gstRate : 0;
  // Taxable = Total / (1 + GST%)
  const taxable = Math.round((totalAmt / (1 + safeRate / 100)) * 100) / 100;
  const totalTax = Math.round((totalAmt - taxable) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100; // guarantee cgst + sgst === totalTax
  const taxableUnitRate = Math.round((taxable / safeQty) * 100) / 100;
  const unitWithGst = Math.round((totalAmt / safeQty) * 100) / 100;

  return {
    taxable,
    totalTax,
    cgst,
    sgst,
    taxableUnitRate,
    unitWithGst,
  };
}

export function ReferenceTaxInvoice({ sale, shopDetails: customShopDetails }: InvoiceProps) {
  // Load real configured shop details from storage
  const [persistedShop, setPersistedShop] = useState<ShopDetails>(DEFAULT_SHOP_DETAILS);

  useEffect(() => {
    setPersistedShop(getSavedShopDetails());
  }, []);

  const shop: ShopDetails = {
    ...persistedShop,
    ...(customShopDetails || {}),
  };

  const s = sale || {};
  const hasRealSale = Boolean(s.id || s.invoice_number || (s.items && s.items.length > 0) || (s.sale_items && s.sale_items.length > 0));

  // Extract Customer Details: prioritize actual customer data
  const customerName = s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || (hasRealSale ? 'Walk-in Customer' : 'Walk-in Customer');
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || '';
  const customerAddress = [s.customer?.village || s.customer?.address, s.customer?.district, s.customer?.state].filter(Boolean).join(', ');
  const customerGstin = s.customer?.gstin || '';

  // Invoice Number and Dates
  const invoiceNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : '1');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const paymentBadge = isCredit ? '[R] Credit Bill' : '[R] Cash Bill';
  const paymentMode = s.payment_method || s.payment_mode || s.paymentMethod || 'Cash';

  // Map Items: extract exact product details from the billing transaction
  const rawItems = s.items || s.sale_items || [];
  let items: InvoiceItemData[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Number(item.quantity || 1);
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 0);
      const lineTotal = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * Number(item.unit_price ?? item.selling_price ?? 0)));
      
      const { taxable, cgst, sgst, taxableUnitRate, unitWithGst } = calculateItemGst(lineTotal, qty, gst);

      // Exact product name without placeholder fallbacks
      let prodName = item.product_name || item.name;
      if (!prodName || prodName === 'Product') {
        prodName = p.name;
      }
      if (!prodName || prodName === 'Product') {
        // Look up in demo catalog if available
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) prodName = match.name;
        } catch {}
      }
      if (!prodName) {
        prodName = `Item ${idx + 1}`;
      }

      // Manufacturer / Company
      let mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      if (!mfg && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) mfg = match.manufacturer || match.brand?.manufacturer || match.brand?.name || '';
        } catch {}
      }

      // HSN
      let hsn = item.hsn_code || p.hsn_code || p.hsnCode || '';
      if (!hsn && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) hsn = match.hsn_code || match.hsnCode || '';
        } catch {}
      }

      // Batch
      let batch = item.batch_number || item.batch?.batch_number || p.batch_number || '';
      if (!batch && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match?.batches?.[0]?.batch_number) batch = match.batches[0].batch_number;
        } catch {}
      }

      // Expiry Date
      let expiryStr = item.expiry_date || item.batch?.expiry_date || p.expiry_date || '';
      if (!expiryStr && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match?.batches?.[0]?.expiry_date) expiryStr = match.batches[0].expiry_date;
        } catch {}
      }
      if (expiryStr && expiryStr.includes('T')) {
        const d = new Date(expiryStr);
        if (!isNaN(d.getTime())) {
          expiryStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      }

      return {
        id: item.id || `item-${idx}`,
        name: prodName,
        manufacturer: mfg,
        hsn: hsn,
        batch: batch,
        expiry: expiryStr,
        quantity: qty,
        rate: taxableUnitRate,
        gstRate: gst,
        rateWithGst: unitWithGst,
        taxableAmount: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        total: lineTotal,
      };
    });
  }

  // Calculate totals strictly ensuring: Taxable + CGST + SGST = Net Total
  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  // Bill adjustments from sale transaction
  const adjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  const totalAdditions = adjustments
    .filter(a => a.type === 'ADD')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments
    .filter(a => a.type === 'DEDUCT')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const netTotal = s.total_amount !== undefined && s.total_amount !== null
    ? Number(s.total_amount)
    : Math.max(0, productsTotal + totalAdditions - totalDeductions);

  const amountPaid = s.paid_amount !== undefined ? Number(s.paid_amount) : (isCredit ? 0 : netTotal);
  const balanceDue = isCredit ? Math.max(0, netTotal - amountPaid) : 0;
  const words = numberToWords(Math.round(netTotal));

  // Fill up to 5 rows so the receipt table looks realistic and dense
  const minRows = 5;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  // Dynamic address formatted as: At [VILLAGE], [TALUKA], [DISTRICT], [STATE]
  const dynamicShopAddress = formatShopAddress(shop);

  return (
    <div
      id="printable-tax-invoice"
      className="w-[194mm] mx-auto bg-white text-black font-sans text-[11px] leading-tight border-2 border-black box-border shadow-md print:shadow-none print:w-[194mm] print:m-0 print:border-2 print:border-black"
      style={{
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* ─── 1. SHOP HEADER SECTION ─── */}
      <div className="p-3 border-b-2 border-black flex justify-between items-start gap-3">
        {/* Left: Logo & Shop Details */}
        <div className="flex items-start gap-3 flex-1">
          {/* Logo: User uploaded logo or clean agricultural crest */}
          {shop.logoBase64 ? (
            <div className="w-14 h-14 shrink-0 border border-gray-400 p-0.5 bg-white flex items-center justify-center overflow-hidden">
              <img src={shop.logoBase64} alt="Shop Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-14 h-14 shrink-0 rounded-full border border-green-800 flex items-center justify-center bg-green-50 p-1">
              <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" stroke="#15803d" strokeWidth="4" fill="#f0fdf4" />
                <path d="M50 15 C45 35 25 45 25 70 C25 80 35 85 50 85 C65 85 75 80 75 70 C75 45 55 35 50 15 Z" fill="#16a34a" opacity="0.8" />
                <path d="M50 20 L50 82" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
                <path d="M50 40 Q38 32 32 45 Q44 48 50 54" fill="#ca8a04" />
                <path d="M50 40 Q62 32 68 45 Q56 48 50 54" fill="#ca8a04" />
                <path d="M50 55 Q38 48 34 60 Q45 62 50 68" fill="#ca8a04" />
                <path d="M50 55 Q62 48 66 60 Q55 62 50 68" fill="#ca8a04" />
              </svg>
            </div>
          )}

          <div className="space-y-0.5">
            <h1 className="text-xl font-black uppercase tracking-wider text-black leading-none">
              {shop.shopName || 'KRUSHI SEVA KENDRA'}
            </h1>
            {dynamicShopAddress && (
              <p className="text-[11px] font-medium text-gray-800">{dynamicShopAddress}</p>
            )}
            <div className="flex flex-wrap gap-x-4 text-[11px] font-bold">
              {shop.ownerName && <span>Pro: {shop.ownerName}</span>}
              {shop.contact1 && <span>Mob: {shop.contact1}</span>}
            </div>
            {shop.gstNumber && (
              <p className="text-[11px] font-black text-black">GSTIN: {shop.gstNumber}</p>
            )}
          </div>
        </div>

        {/* Right: License, Reg & Title Badge */}
        <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
          <div className="border border-black bg-gray-50 px-2.5 py-1 text-right text-[10px] space-y-0.5 font-medium">
            <div className="font-bold text-[10px] text-gray-700 tracking-wider">LICENSE / REGISTRATION</div>
            {shop.licenseNumber && <div>Lic No: <span className="font-bold font-mono text-black">{shop.licenseNumber}</span></div>}
            {shop.registrationNumber && <div>Reg No: <span className="font-bold font-mono text-black">{shop.registrationNumber}</span></div>}
          </div>
          <div className="mt-2 bg-black text-white font-extrabold text-xs px-3 py-1 tracking-widest uppercase border border-black">
            TAX INVOICE
          </div>
        </div>
      </div>

      {/* ─── 2. CUSTOMER / BILL INFORMATION ─── */}
      <div className="grid grid-cols-2 border-b-2 border-black text-[11px]">
        {/* Customer Information (Left) */}
        <div className="p-2 border-r-2 border-black space-y-1">
          <div className="font-bold text-[10px] text-gray-600 uppercase tracking-wider">Customer Details</div>
          <div className="flex">
            <span className="font-bold w-16 shrink-0">Name:</span>
            <span className="font-bold uppercase text-black">{customerName}</span>
          </div>
          {customerAddress && (
            <div className="flex">
              <span className="font-bold w-16 shrink-0">Address:</span>
              <span className="text-gray-900">{customerAddress}</span>
            </div>
          )}
          {customerPhone && (
            <div className="flex">
              <span className="font-bold w-16 shrink-0">Mob:</span>
              <span className="font-medium">{customerPhone}</span>
            </div>
          )}
          {customerGstin && (
            <div className="flex">
              <span className="font-bold w-16 shrink-0">GSTIN:</span>
              <span className="font-mono">{customerGstin}</span>
            </div>
          )}
        </div>

        {/* Invoice Meta Information (Right) */}
        <div className="p-2 space-y-1">
          <div className="font-bold text-[10px] text-gray-600 uppercase tracking-wider">Invoice Details</div>
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold w-16 inline-block">Bill No:</span>
              <span className="font-bold font-mono text-sm">{invoiceNo}</span>
            </div>
            <span className="bg-gray-100 border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              {paymentBadge}
            </span>
          </div>
          <div>
            <span className="font-bold w-16 inline-block">Date:</span>
            <span className="font-medium">{formattedDate}</span>
            <span className="text-gray-700 ml-2 font-mono">({formattedTime})</span>
          </div>
          <div>
            <span className="font-bold w-16 inline-block">Payment:</span>
            <span className="font-semibold uppercase">{paymentMode}</span>
          </div>
          <div>
            <span className="font-bold w-16 inline-block">Place:</span>
            <span>{shop.district ? `${shop.district}, ` : ''}{shop.state || 'Maharashtra'}</span>
          </div>
        </div>
      </div>

      {/* ─── 3. DENSE PRODUCT TABLE ─── */}
      <div className="w-full">
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-gray-100 text-black border-b border-black">
              <th className="border-r border-black py-1 px-1 text-center w-7 font-black">Sr.</th>
              <th className="border-r border-black py-1 px-2 text-left font-black">Product Details</th>
              <th className="border-r border-black py-1 px-1 text-center w-12 font-black">HSN</th>
              <th className="border-r border-black py-1 px-1 text-center w-16 font-black">BATCH</th>
              <th className="border-r border-black py-1 px-1 text-center w-16 font-black">EXPIRY</th>
              <th className="border-r border-black py-1 px-1 text-center w-10 font-black">Qty</th>
              <th className="border-r border-black py-1 px-1 text-right w-14 font-black">Rate</th>
              <th className="border-r border-black py-1 px-1 text-center w-12 font-black">GST %</th>
              <th className="border-r border-black py-1 px-1 text-right w-16 font-black">Rate (With GST)</th>
              <th className="py-1 px-2 text-right w-16 font-black">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-black/80">
                <td className="border-r border-black py-1 px-1 text-center font-bold">{idx + 1}</td>
                <td className="border-r border-black py-1 px-2 text-left">
                  <div className="font-bold text-black leading-tight">{item.name}</div>
                  {item.manufacturer && (
                    <div className="text-[9px] text-gray-700 leading-tight">Mfg: {item.manufacturer}</div>
                  )}
                </td>
                <td className="border-r border-black py-1 px-1 text-center font-mono text-[10px]">{item.hsn || '-'}</td>
                <td className="border-r border-black py-1 px-1 text-center font-mono text-[10px] uppercase font-semibold">{item.batch || '-'}</td>
                <td className="border-r border-black py-1 px-1 text-center font-mono text-[10px]">{item.expiry || '-'}</td>
                <td className="border-r border-black py-1 px-1 text-center font-bold text-black">{item.quantity}</td>
                <td className="border-r border-black py-1 px-1 text-right font-mono">{item.rate.toFixed(2)}</td>
                <td className="border-r border-black py-1 px-1 text-center font-bold">{item.gstRate}%</td>
                <td className="border-r border-black py-1 px-1 text-right font-mono font-medium">{item.rateWithGst.toFixed(2)}</td>
                <td className="py-1 px-2 text-right font-mono font-black">{item.total.toFixed(2)}</td>
              </tr>
            ))}

            {/* Empty filler rows to maintain dense pre-printed physical bill appearance */}
            {emptyRowsCount > 0 &&
              Array.from({ length: emptyRowsCount }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black/80 h-7">
                  <td className="border-r border-black py-1 px-1 text-center">&nbsp;</td>
                  <td className="border-r border-black py-1 px-2">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="border-r border-black py-1 px-1">&nbsp;</td>
                  <td className="py-1 px-2">&nbsp;</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ─── 4. BOTTOM STRUCTURED SUMMARY & OWNER BANK DETAILS ─── */}
      <div className="grid grid-cols-12 border-t-2 border-black">
        {/* Left Side (Words, Owner Bank Details, Terms) - 7 cols */}
        <div className="col-span-7 border-r-2 border-black p-2.5 flex flex-col justify-between space-y-1.5">
          {/* Amount in words */}
          <div className="border-b border-black/40 pb-1.5">
            <span className="font-bold text-[10.5px]">Amount in Words: </span>
            <span className="font-bold italic capitalize text-[10.5px]">
              {words} Rupees Only
            </span>
          </div>

          {/* Owner Bank Details Section (Replacing QR Code as requested) */}
          <div className="border border-black bg-gray-50/70 p-2 text-[10px] space-y-0.5 my-1">
            <div className="font-black text-[10.5px] uppercase tracking-wider text-black border-b border-black/30 pb-0.5 mb-1 flex items-center justify-between">
              <span>BANK DETAILS</span>
              {shop.accountType && <span className="text-[9px] font-bold text-gray-700">({shop.accountType})</span>}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <div><span className="font-bold">A/C Holder :</span> <span className="font-semibold">{shop.accountName || shop.ownerName || '-'}</span></div>
              <div><span className="font-bold">Bank :</span> <span className="font-semibold">{shop.bankName || '-'}</span></div>
              <div><span className="font-bold">A/C No. :</span> <span className="font-mono font-bold">{shop.accountNumber || '-'}</span></div>
              <div><span className="font-bold">IFSC :</span> <span className="font-mono font-bold">{shop.ifsc || '-'}</span></div>
              {(shop.branch || shop.accountType) && (
                <>
                  <div><span className="font-bold">Branch :</span> <span>{shop.branch || '-'}</span></div>
                  <div><span className="font-bold">A/C Type :</span> <span>{shop.accountType || '-'}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="text-[9px] text-gray-800 pt-1 border-t border-black/40 leading-snug">
            <div className="font-bold text-[9.5px] uppercase text-black">Terms & Conditions:</div>
            {shop.invoiceTerms ? (
              <div className="whitespace-pre-line">{shop.invoiceTerms}</div>
            ) : (
              <>
                <div>1. Goods once sold will not be accepted back or replaced.</div>
                <div>2. Interest @ 18% per annum will be charged if payment not made on time.</div>
                <div>3. Subject to {shop.district || shop.state || 'Local'} jurisdiction only.</div>
              </>
            )}
          </div>
        </div>

        {/* Right Side (Tax Breakdown & Totals) - 5 cols */}
        <div className="col-span-5 p-0 bg-white">
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr className="border-b border-black">
                <td className="p-1.5 font-bold text-gray-800">Taxable Value:</td>
                <td className="p-1.5 text-right font-mono font-semibold">₹{taxableTotal.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1.5 font-bold text-gray-800">CGST Amount:</td>
                <td className="p-1.5 text-right font-mono font-semibold">₹{cgstTotal.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1.5 font-bold text-gray-800">SGST Amount:</td>
                <td className="p-1.5 text-right font-mono font-semibold">₹{sgstTotal.toFixed(2)}</td>
              </tr>
              {/* Bill Adjustments (Additions & Deductions) */}
              {adjustments.map((adj: any, i: number) => {
                const isAdd = adj.type === 'ADD';
                return (
                  <tr key={adj.id || i} className="border-b border-black/40 text-[10px]">
                    <td className="p-1 font-semibold text-gray-800">
                      {adj.reason} {isAdd ? '(+)' : '(-)'}:
                    </td>
                    <td className={`p-1 text-right font-mono font-bold ${isAdd ? 'text-emerald-700' : 'text-amber-800'}`}>
                      {isAdd ? `+₹${Number(adj.amount || 0).toFixed(2)}` : `-₹${Number(adj.amount || 0).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-b-2 border-black bg-gray-100">
                <td className="p-2 font-black text-xs text-black">NET TOTAL:</td>
                <td className="p-2 text-right font-mono font-black text-sm text-black">₹{netTotal.toFixed(2)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="p-1.5 font-bold text-gray-700">Amount Paid:</td>
                <td className="p-1.5 text-right font-mono font-bold text-gray-900">₹{amountPaid.toFixed(2)}</td>
              </tr>
              <tr className={balanceDue > 0 ? 'bg-red-50 text-red-700' : ''}>
                <td className="p-1.5 font-bold">Balance / Udhari:</td>
                <td className="p-1.5 text-right font-mono font-black">₹{balanceDue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 5. SIGNATURE BLOCK ─── */}
      <div className="p-3 border-t-2 border-black flex justify-between items-end min-h-[60px] text-[10.5px]">
        <div className="text-center">
          <div className="w-36 border-t border-black pt-1 font-bold text-black">
            Customer Signature
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold text-[10px] text-gray-800 mb-6">
            {shop.authorizedSignatory || `For ${shop.shopName || 'Krushi Seva Kendra'}`}
          </div>
          <div className="w-44 border-t border-black pt-1 font-bold text-black">
            Authorized Signatory
          </div>
        </div>
      </div>

      {/* ─── 6. BORDERED FOOTER ─── */}
      <div className="border-t-2 border-black bg-gray-100 py-1 px-3 flex justify-between items-center text-[9.5px] font-bold text-gray-800 uppercase tracking-wider">
        <span>This Is Computer Generated Tax Invoice</span>
        <span>Subject To {shop.district ? `${shop.district} ` : ''}Jurisdiction</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}

// ─── UTILITY FOR SEAMLESS 100% ISOLATED PRINTING ───
export function printInvoiceDirectly(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  // Create isolated iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Collect active stylesheets
  let styles = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    styles += node.outerHTML;
  });

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TAX INVOICE</title>
        ${styles}
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div style="padding: 0; margin: 0 auto; width: 194mm;">
          ${element.outerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 350);
}

// ─── UTILITY FOR PIXEL-PERFECT PDF DOWNLOAD ───
export async function downloadInvoiceAsPDF(elementId: string, filename: string = 'tax-invoice.pdf') {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default || html2canvasModule;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // A4 dimensions are 210 x 297 mm
    // Center 194mm within 210mm: margin left = (210 - 194) / 2 = 8mm
    pdf.addImage(imgData, 'JPEG', 8, 8, 194, (194 * canvas.height) / canvas.width);
    pdf.save(filename);
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
