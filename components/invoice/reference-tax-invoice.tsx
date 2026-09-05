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
  rate: number;          // Taxable unit price
  gstRate: number;       // GST %
  rateWithGst: number;   // Unit price including GST
  total: number;         // Line total
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
}

export interface InvoiceProps {
  sale?: any;
  shopDetails?: Partial<ShopDetails>;
  customItems?: InvoiceItemData[];
}

// Calculate reverse GST for item line totals
export function calculateItemGst(totalAmt: number, qty: number, gstRate: number) {
  const safeQty = qty > 0 ? qty : 1;
  const safeRate = gstRate >= 0 ? gstRate : 0;
  const taxable = Math.round((totalAmt / (1 + safeRate / 100)) * 100) / 100;
  const totalTax = Math.round((totalAmt - taxable) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100;
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

export function ReferenceTaxInvoice({ sale, shopDetails: customShopDetails, customItems }: InvoiceProps) {
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

  // Customer Details: fallback to Image 1 source data if not present
  const customerName = s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || (hasRealSale ? 'Walk-in Customer' : 'GOVIND DEORAYE');
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || (hasRealSale ? '' : '5412336787');
  const customerAddress = [
    s.customer?.village || s.customer?.address || (!hasRealSale ? 'At kamari, Himayatnagar' : ''),
    s.customer?.district || (!hasRealSale ? 'Nanded' : ''),
    s.customer?.state || (!hasRealSale ? 'Maharashtra - 431802' : '')
  ].filter(Boolean).join(', ');

  // Invoice Details
  const invoiceNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : 'KOS-2026-033');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date('2026-09-05T23:59:00+05:30');
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const paymentBadge = isCredit ? '[R] Credit Bill' : '[R] Cash Bill';
  const paymentMode = s.payment_method || s.payment_mode || s.paymentMethod || 'Cash';

  // Map Product Items
  const rawItems = customItems || s.items || s.sale_items || [];
  let items: InvoiceItemData[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Number(item.quantity || 1);
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      const lineTotal = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * Number(item.unit_price ?? item.selling_price ?? 550)));
      
      const { taxable, cgst, sgst, taxableUnitRate, unitWithGst } = calculateItemGst(lineTotal, qty, gst);

      let prodName = item.product_name || item.name;
      if (!prodName || prodName === 'Product') prodName = p.name;
      if (!prodName || prodName === 'Product') {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) prodName = match.name;
        } catch {}
      }
      if (!prodName) prodName = 'Confidor Insecticide 100ml';

      let mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      if (!mfg && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) mfg = match.manufacturer || match.brand?.manufacturer || match.brand?.name || '';
        } catch {}
      }
      if (!mfg && !hasRealSale) mfg = 'Bayer CropScience';

      let hsn = item.hsn_code || p.hsn_code || p.hsnCode || (!hasRealSale ? '3808' : '');
      let batch = item.batch_number || item.batch?.batch_number || p.batch_number || (!hasRealSale ? 'B-2026-01' : '-');
      let expiryStr = item.expiry_date || item.batch?.expiry_date || p.expiry_date || (!hasRealSale ? '2026-11-30' : '-');
      if (expiryStr && expiryStr.includes('T')) {
        const d = new Date(expiryStr);
        if (!isNaN(d.getTime())) {
          expiryStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }

      return {
        id: item.id || `item-${idx}`,
        name: prodName,
        manufacturer: mfg,
        hsn: hsn || '-',
        batch: batch || '-',
        expiry: expiryStr || '-',
        quantity: qty,
        rate: item.rate !== undefined ? Number(item.rate) : taxableUnitRate,
        gstRate: gst,
        rateWithGst: item.rateWithGst !== undefined ? Number(item.rateWithGst) : unitWithGst,
        taxableAmount: taxable,
        cgstAmount: cgst,
        sgstAmount: sgst,
        total: lineTotal,
      };
    });
  } else {
    // Default to Image 1 item if completely empty
    items = [
      {
        id: 'default-item-1',
        name: 'Confidor Insecticide 100ml',
        manufacturer: 'Bayer CropScience',
        hsn: '3808',
        batch: 'B-2026-01',
        expiry: '2026-11-30',
        quantity: 1,
        rate: 466.10,
        gstRate: 18,
        rateWithGst: 550.00,
        taxableAmount: 466.10,
        cgstAmount: 41.95,
        sgstAmount: 41.95,
        total: 550.00,
      }
    ];
  }

  // Totals calculations
  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

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

  // Amount in words: format cleanly without duplicate "Rupees Only"
  let rawWords = numberToWords(Math.round(netTotal));
  let cleanWords = `${rawWords} Rupees Only`
    .replace(/Rupees Only\s+Rupees Only/gi, 'Rupees Only')
    .replace(/\s+/g, ' ')
    .trim();

  // Dense row filler: target 8 total rows (occupying ~40% table height cleanly)
  const targetRowCount = Math.max(8, items.length + 7);
  const emptyRowsCount = Math.max(0, targetRowCount - items.length);

  const dynamicShopAddress = formatShopAddress(shop) || 'At kamari, Himayatnagar, NANDED, MAHARASHTRA - 431802';

  return (
    <div
      id="printable-tax-invoice"
      className="w-[287mm] max-w-[287mm] min-h-[198mm] mx-auto bg-white text-black font-sans text-xs leading-tight border border-black box-border shadow-none print:shadow-none print:w-[287mm] print:max-w-[287mm] print:min-h-[198mm] print:m-0 print:border print:border-black select-text flex flex-col justify-between"
      style={{
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      <div className="w-full">
        {/* ─── 1. HEADER SECTION (EXACT ~18% HEIGHT: 12% LOGO, 63% CENTER, 25% REGISTRATION) ─── */}
        <div className="grid grid-cols-[12%_63%_25%] border-b border-black items-stretch h-[35mm] min-h-[135px]">
          {/* Left: Logo area approximately 12% */}
          <div className="p-2 border-r border-black flex flex-col items-center justify-center bg-white">
            {shop.logoBase64 ? (
              <div className="w-20 h-20 shrink-0 flex items-center justify-center overflow-hidden">
                <img src={shop.logoBase64} alt="Shop Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-[#2e7d32] p-1 flex items-center justify-center bg-white">
                  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="44" stroke="#2e7d32" strokeWidth="4" fill="#f4fbf5" />
                    <path d="M50 16 C44 34 26 44 26 68 C26 78 36 84 50 84 C64 84 74 78 74 68 C74 44 56 34 50 16 Z" fill="#2e7d32" />
                    <path d="M50 20 L50 80" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M50 42 Q38 34 32 46 Q44 48 50 54" fill="#fff" opacity="0.9" />
                    <path d="M50 42 Q62 34 68 46 Q56 48 50 54" fill="#fff" opacity="0.9" />
                    <path d="M50 56 Q38 50 34 60 Q44 62 50 68" fill="#fff" opacity="0.9" />
                    <path d="M50 56 Q62 50 66 60 Q56 62 50 68" fill="#fff" opacity="0.9" />
                  </svg>
                </div>
                <span className="text-[11px] font-black text-[#2e7d32] tracking-wider mt-1 uppercase">MAULI</span>
              </div>
            )}
          </div>

          {/* Center: Business name large bold uppercase, address, pro & mob centered */}
          <div className="py-3 px-4 flex flex-col items-center justify-center text-center space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wide text-black leading-tight">
              {shop.shopName || 'MAULI KRUSHI SEVA KENDRA'}
            </h1>
            <p className="text-xs md:text-[13px] font-semibold text-black leading-tight">
              {dynamicShopAddress}
            </p>
            <div className="text-xs md:text-[13px] font-bold text-black flex items-center justify-center gap-8 pt-0.5">
              <span>Pro: {shop.ownerName || 'PRAMOD SHIRFULE'}</span>
              <span>Mob: {shop.contact1 || '9767631543'}</span>
            </div>
          </div>

          {/* Right: Registration box approximately 25% with exactly 3 horizontal rows */}
          <div className="flex flex-col border-l border-black text-xs md:text-[13px] justify-between bg-white">
            <div className="flex border-b border-black px-3.5 flex-1 items-center">
              <span className="font-bold text-black w-20 shrink-0">GSTIN:</span>
              <span className="font-mono font-bold text-black uppercase tracking-wider">{shop.gstNumber || 'DLGPS9782B2ZJ'}</span>
            </div>
            <div className="flex border-b border-black px-3.5 flex-1 items-center">
              <span className="font-bold text-black w-20 shrink-0">LIC NO:</span>
              <span className="font-mono font-semibold text-black">{shop.licenseNumber || ''}</span>
            </div>
            <div className="flex px-3.5 flex-1 items-center">
              <span className="font-bold text-black w-20 shrink-0">REG NO:</span>
              <span className="font-mono font-semibold text-black">{shop.registrationNumber || ''}</span>
            </div>
          </div>
        </div>

        {/* ─── 2. CUSTOMER / INVOICE DETAILS (EXACT ~14% HEIGHT: 60% LEFT, 40% RIGHT) ─── */}
        <div className="grid grid-cols-[60%_40%] border-b border-black text-xs md:text-[13px] h-[28mm] min-h-[105px]">
          {/* Left: Customer details (Name, Address, Mob) */}
          <div className="p-3.5 border-r border-black flex flex-col justify-center">
            <table className="w-full text-xs md:text-[13px] leading-relaxed">
              <tbody>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Name</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="font-bold text-black uppercase align-top py-0.5">{customerName}</td>
                </tr>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Address</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="text-black font-medium align-top py-0.5">{customerAddress || 'NANDED, MAHARASHTRA'}</td>
                </tr>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Mob</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="font-mono font-bold text-black align-top py-0.5">{customerPhone || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Invoice details (Bill No, Date, Payment) + [R] Cash Bill button */}
          <div className="p-3.5 flex justify-between items-start">
            <table className="w-full text-xs md:text-[13px] leading-relaxed">
              <tbody>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Bill No</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="font-mono font-bold text-black text-sm md:text-base align-top py-0.5">{invoiceNo}</td>
                </tr>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Date</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="font-medium text-black align-top py-0.5">
                    {formattedDate} &nbsp;({formattedTime})
                  </td>
                </tr>
                <tr>
                  <td className="w-20 font-bold text-black align-top py-0.5">Payment</td>
                  <td className="w-4 font-bold text-center align-top py-0.5">:</td>
                  <td className="font-semibold text-black uppercase align-top py-0.5">{paymentMode}</td>
                </tr>
              </tbody>
            </table>

            {/* Right Badge: [R] Cash Bill / [R] Credit Bill */}
            <div className="border border-black px-3 py-1 font-bold text-xs text-black shrink-0 ml-3 whitespace-nowrap bg-white">
              {paymentBadge}
            </div>
          </div>
        </div>

        {/* ─── 3. PRODUCT TABLE (EXACT ~40% HEIGHT: 10 COLUMNS WITH EXACT PROPORTIONS) ─── */}
        <div className="w-full">
          <table className="w-full border-collapse text-xs md:text-[13px]">
            <thead>
              <tr className="border-b border-black text-black bg-white h-10">
                <th className="border-r border-black py-2 px-1 text-center w-[4%] font-bold">Sr.</th>
                <th className="border-r border-black py-2 px-2 text-center w-[32%] font-bold">Product Details</th>
                <th className="border-r border-black py-2 px-1 text-center w-[7.5%] font-bold">HSN</th>
                <th className="border-r border-black py-2 px-1 text-center w-[8.5%] font-bold">BATCH</th>
                <th className="border-r border-black py-2 px-1 text-center w-[9.5%] font-bold">EXPIRY</th>
                <th className="border-r border-black py-2 px-1 text-center w-[5.5%] font-bold">Qty</th>
                <th className="border-r border-black py-2 px-1 text-center w-[8.5%] font-bold">Rate</th>
                <th className="border-r border-black py-2 px-1 text-center w-[6.5%] font-bold">GST %</th>
                <th className="border-r border-black py-2 px-1 text-center w-[9%] font-bold">Rate (With GST)</th>
                <th className="py-2 px-2 text-center w-[9%] font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-black h-11">
                  <td className="border-r border-black py-2 px-1 text-center font-bold">{idx + 1}</td>
                  <td className="border-r border-black py-2 px-2 text-left">
                    <div className="font-bold text-black uppercase leading-tight text-xs md:text-[13px]">{item.name}</div>
                    {item.manufacturer && (
                      <div className="text-[11px] text-gray-800 leading-tight">Mfg: {item.manufacturer}</div>
                    )}
                  </td>
                  <td className="border-r border-black py-2 px-1 text-center font-mono text-xs md:text-[13px]">{item.hsn || '-'}</td>
                  <td className="border-r border-black py-2 px-1 text-center font-mono text-xs md:text-[13px] uppercase font-semibold">{item.batch || '-'}</td>
                  <td className="border-r border-black py-2 px-1 text-center font-mono text-xs md:text-[13px]">{item.expiry || '-'}</td>
                  <td className="border-r border-black py-2 px-1 text-center font-mono font-bold text-black">
                    {typeof item.quantity === 'number' ? (Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)) : item.quantity}
                  </td>
                  <td className="border-r border-black py-2 px-1 text-right font-mono">{item.rate.toFixed(2)}</td>
                  <td className="border-r border-black py-2 px-1 text-center font-mono font-semibold">{item.gstRate.toFixed(2)}</td>
                  <td className="border-r border-black py-2 px-1 text-right font-mono font-medium">{item.rateWithGst.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{item.total.toFixed(2)}</td>
                </tr>
              ))}

              {/* Blank filler rows with continuous vertical borders to fill ~40% table height */}
              {emptyRowsCount > 0 &&
                Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="border-b border-black h-9">
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

        {/* ─── 4. TAX SUMMARY ROW (EXACT HORIZONTAL ROW: TAXABLE, CGST, SGST & LARGE NET TOTAL) ─── */}
        <div className="grid grid-cols-[12%_12%_12%_64%] border-b border-black text-xs bg-white h-[13mm] min-h-[50px]">
          <div className="border-r border-black p-2 flex flex-col justify-center">
            <span className="font-bold text-black text-xs">taxable</span>
            <span className="font-mono font-bold text-black text-sm md:text-base pt-0.5">
              ₹ {taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-r border-black p-2 flex flex-col justify-center">
            <span className="font-bold text-black text-xs">cgst</span>
            <span className="font-mono font-bold text-black text-sm md:text-base pt-0.5">
              ₹ {cgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="border-r border-black p-2 flex flex-col justify-center">
            <span className="font-bold text-black text-xs">sgst</span>
            <span className="font-mono font-bold text-black text-sm md:text-base pt-0.5">
              ₹ {sgstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-2 px-5 flex items-center justify-between">
            <span className="font-bold text-black text-base md:text-lg">Net total</span>
            <span className="font-mono font-black text-black text-xl md:text-2xl">
              ₹ {netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ─── 5. LOWER SECTION (EXACT ~19% HEIGHT: 35% BANK DETAILS, 29% AMOUNT IN WORDS, 36% SIGNATURE) ─── */}
        <div className="grid grid-cols-[35%_29%_36%] text-xs md:text-[12px] items-stretch h-[38mm] min-h-[145px]">
          {/* Area 1: Bank Details (~35% width) */}
          <div className="border-r border-black p-3 flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs md:text-[13px] text-black mb-1">Bank details</div>
              <table className="w-full text-xs md:text-[12px] leading-relaxed">
                <tbody>
                  <tr>
                    <td className="w-24 text-black font-medium">Bank Name</td>
                    <td className="w-3 text-center">:</td>
                    <td className="font-semibold text-black">{shop.bankName || 'Maharastra Gramin Bank'}</td>
                  </tr>
                  <tr>
                    <td className="w-24 text-black font-medium">A/C No</td>
                    <td className="w-3 text-center">:</td>
                    <td className="font-mono font-bold text-black">{shop.accountNumber || '80045403150'}</td>
                  </tr>
                  <tr>
                    <td className="w-24 text-black font-medium">IFSC Code</td>
                    <td className="w-3 text-center">:</td>
                    <td className="font-mono font-bold text-black">{shop.ifsc || 'MAHG0004120'}</td>
                  </tr>
                  <tr>
                    <td className="w-24 text-black font-medium">Branch</td>
                    <td className="w-3 text-center">:</td>
                    <td className="text-black">{shop.branch || 'Kamari'}</td>
                  </tr>
                  <tr>
                    <td className="w-24 text-black font-medium">A/C Type</td>
                    <td className="w-3 text-center">:</td>
                    <td className="text-black">{shop.accountType || 'Current Account'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Terms & Conditions */}
            <div className="text-[9.5px] text-gray-800 pt-1.5 mt-1 border-t border-black/20 leading-tight">
              <span className="font-bold">Terms: </span>
              <span>1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. charged after 30 days.</span>
            </div>
          </div>

          {/* Area 2: Amount In Words & Balances (~29% width) */}
          <div className="border-r border-black flex flex-col justify-between">
            {/* Top: Amount in words */}
            <div className="p-3 border-b border-black flex-1">
              <div className="font-bold text-xs md:text-[13px] text-black mb-1">Amount in words</div>
              <div className="text-xs md:text-[12px] font-semibold text-black capitalize leading-relaxed">
                {cleanWords}
              </div>
            </div>

            {/* Bottom: Amount Paid & Balance / Udhar */}
            <div className="p-3 space-y-1">
              <table className="w-full text-xs md:text-[12px] leading-relaxed">
                <tbody>
                  {adjustments.length > 0 && adjustments.map((adj: any, i: number) => {
                    const isAdd = adj.type === 'ADD';
                    return (
                      <tr key={adj.id || i}>
                        <td className="text-black font-medium">{adj.reason}</td>
                        <td className="w-3 text-center">:</td>
                        <td className={`text-right font-mono font-bold ${isAdd ? 'text-emerald-700' : 'text-amber-800'}`}>
                          {isAdd ? `+₹ ${Number(adj.amount || 0).toFixed(2)}` : `-₹ ${Number(adj.amount || 0).toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="text-black font-medium">Amount Paid</td>
                    <td className="w-3 text-center">:</td>
                    <td className="text-right font-mono font-bold text-black">
                      ₹ {amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-black font-medium">Balance / Udhar</td>
                    <td className="w-3 text-center">:</td>
                    <td className={`text-right font-mono font-bold ${balanceDue > 0 ? 'text-red-700 font-black' : 'text-black'}`}>
                      ₹ {balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Area 3: Signature Area (~36% width) */}
          <div className="p-3 flex flex-col justify-between">
            {/* Upper/Right: Business name */}
            <div className="text-right pt-1 pr-2">
              <span className="font-bold text-xs md:text-[13px] uppercase text-black">
                {shop.authorizedSignatory || shop.shopName || 'MAULI KRUSHI SEVA KENDRA'}
              </span>
            </div>

            {/* Large blank space for physical stamp & signature */}
            <div className="h-16"></div>

            {/* Bottom signature labels */}
            <div className="flex justify-between items-end px-2 pb-1">
              <span className="font-semibold text-xs md:text-[12px] text-black">Customer sign</span>
              <span className="font-semibold text-xs md:text-[12px] text-black">Authorized Sign</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6. NARROW FOOTER BAR AT ABSOLUTE BOTTOM ─── */}
      <div className="border-t border-black bg-white py-1 px-4 flex justify-between items-center text-[10px] md:text-[11px] font-bold text-black uppercase tracking-wider h-[6mm]">
        <span>THIS IS COMPUTER GENERATED TAX INVOICE</span>
        <span>SUBJECT TO {shop.district ? shop.district.toUpperCase() : 'NANDED'} JURISDICTION</span>
        <span>PAGE 1 OF 1</span>
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
            size: A4 landscape;
            margin: 5mm;
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
        <div style="padding: 0; margin: 0 auto; width: 287mm;">
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
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // A4 landscape dimensions: 297 x 210 mm. Printable width 287mm, centered.
    pdf.addImage(imgData, 'JPEG', 5, 5, 287, (287 * canvas.height) / canvas.width);
    pdf.save(filename);
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
