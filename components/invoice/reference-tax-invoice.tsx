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
  rate: number;          
  gstRate: number;       
  rateWithGst: number;   
  total: number;         
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
}

export interface InvoiceProps {
  sale?: any;
  shopDetails?: Partial<ShopDetails>;
  customItems?: InvoiceItemData[];
}

export function calculateItemGst(totalAmt: number, qty: number, gstRate: number) {
  const safeQty = qty > 0 ? qty : 1;
  const safeRate = gstRate >= 0 ? gstRate : 0;
  const taxable = Math.round((totalAmt / (1 + safeRate / 100)) * 100) / 100;
  const totalTax = Math.round((totalAmt - taxable) * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100;
  const taxableUnitRate = Math.round((taxable / safeQty) * 100) / 100;
  const unitWithGst = Math.round((totalAmt / safeQty) * 100) / 100;

  return { taxable, totalTax, cgst, sgst, taxableUnitRate, unitWithGst };
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

  const customerName = s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || (hasRealSale ? 'Walk-in Customer' : 'Demo Customer Name');
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || (hasRealSale ? '' : '9876543210');
  const customerAddress = [
    s.customer?.village || s.customer?.address || (!hasRealSale ? 'Demo Address' : ''),
    s.customer?.district || (!hasRealSale ? 'Demo District' : ''),
    s.customer?.state || (!hasRealSale ? 'Demo State' : '')
  ].filter(Boolean).join(', ');

  const invoiceNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : 'KOS-2026-001');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const paymentBadge = isCredit ? '[R] Credit Bill' : '[R] Cash Bill';
  const paymentMode = s.payment_method || s.payment_mode || s.paymentMethod || 'Cash';

  const rawItems = customItems || s.items || s.sale_items || [];
  let items: InvoiceItemData[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Number(item.quantity || 1);
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      const lineTotal = Number(item.total_amount ?? item.totalAmount ?? item.total_price ?? (qty * Number(item.unit_price ?? item.selling_price ?? 0)));
      
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
      if (!prodName) prodName = 'Demo Product';

      let mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      if (!mfg && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) mfg = match.manufacturer || match.brand?.manufacturer || match.brand?.name || '';
        } catch {}
      }

      let hsn = item.hsn_code || p.hsn_code || p.hsnCode || '';
      let batch = item.batch_number || item.batch?.batch_number || p.batch_number || '-';
      let expiryStr = item.expiry_date || item.batch?.expiry_date || p.expiry_date || '-';
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
    items = [
      {
        id: 'default-item-1',
        name: 'Demo Product 1',
        manufacturer: 'Demo Mfg',
        hsn: '1234',
        batch: 'B-01',
        expiry: '2026-12-31',
        quantity: 1,
        rate: 100,
        gstRate: 18,
        rateWithGst: 118,
        taxableAmount: 100,
        cgstAmount: 9,
        sgstAmount: 9,
        total: 118,
      }
    ];
  }

  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  const adjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  const totalAdditions = adjustments.filter(a => a.type === 'ADD').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments.filter(a => a.type === 'DEDUCT').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const netTotal = s.total_amount !== undefined && s.total_amount !== null
    ? Number(s.total_amount)
    : Math.max(0, productsTotal + totalAdditions - totalDeductions);

  let rawWords = numberToWords(Math.round(netTotal));
  let cleanWords = `${rawWords} Rupees Only`.replace(/Rupees Only\s+Rupees Only/gi, 'Rupees Only').replace(/\s+/g, ' ').trim();

  // Ledger calculation
  const amountPaid = s.paid_amount !== undefined ? Number(s.paid_amount) : (isCredit ? 0 : netTotal);
  const openingBal = s.customer?.opening_balance ? Number(s.customer.opening_balance) : 0;
  const drInvoice = netTotal;
  const closingBalance = openingBal + drInvoice - amountPaid;

  const targetRowCount = Math.max(10, items.length + 4); 
  const emptyRowsCount = Math.max(0, targetRowCount - items.length);

  const dynamicShopAddress = formatShopAddress(shop) || 'At Post Jujarpu r, Tal Sangola, Dist Solapur, Maharashtra - 413307';

  return (
    <div
      id="printable-tax-invoice"
      className="invoice bg-white text-black font-sans box-border relative mx-auto"
      style={{ 
        width: '204mm', // 210mm (A5 landscape) - 6mm margins (3mm each side)
        height: '142mm', // 148mm (A5 height) - 6mm margins (3mm each side)
        border: '1px solid black', // Thinner border for A5
        display: 'flex',
        flexDirection: 'column',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        color: '#000000',
        backgroundColor: '#ffffff',
      }}
    >
      {/* 1. HEADER (approx 18%) */}
      <div style={{ flex: '0 0 18%', borderBottom: '1px solid black', display: 'flex', overflow: 'hidden' }}>
        {/* Left: Logo */}
        <div style={{ flex: '0 0 15%', borderRight: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
          {shop.logoBase64 ? (
            <img src={shop.logoBase64} alt="Shop Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#2e7d32' }}>LOGO</span>
              </div>
            </div>
          )}
        </div>
        {/* Center: Business Details */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '900', margin: '0', textTransform: 'uppercase', lineHeight: '1.1' }}>
            {shop.shopName || 'KRUSHI OS SEVA KENDRA'}
          </h1>
          <p style={{ fontSize: '9px', fontWeight: '600', margin: '2px 0 0 0', lineHeight: '1.2' }}>
            {dynamicShopAddress}
          </p>
          <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '4px', display: 'flex', gap: '20px' }}>
            <span>Pro: {shop.ownerName || 'Demo Owner Name'}</span>
            <span>Mob: {shop.contact1 || '9876543210'}</span>
          </div>
        </div>
        {/* Right: Registration Box */}
        <div style={{ flex: '0 0 20%', borderLeft: '1px solid black', display: 'flex', flexDirection: 'column', fontSize: '8px', overflow: 'hidden' }}>
          <div style={{ flex: '1', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
            <span style={{ fontWeight: 'bold', width: '45px' }}>GSTIN:</span>
            <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{shop.gstNumber || ''}</span>
          </div>
          <div style={{ flex: '1', borderBottom: '1px solid black', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
            <span style={{ fontWeight: 'bold', width: '45px' }}>LIC NO:</span>
            <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{shop.licenseNumber || ''}</span>
          </div>
          <div style={{ flex: '1', display: 'flex', alignItems: 'center', padding: '0 6px' }}>
            <span style={{ fontWeight: 'bold', width: '45px' }}>REG NO:</span>
            <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{shop.registrationNumber || ''}</span>
          </div>
        </div>
      </div>

      {/* 2. CUSTOMER & INVOICE DETAILS (approx 14%) */}
      <div style={{ flex: '0 0 14%', borderBottom: '1px solid black', display: 'flex', overflow: 'hidden' }}>
        {/* Left (60%) */}
        <div style={{ flex: '0 0 60%', borderRight: '1px solid black', padding: '4px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <table style={{ width: '100%', fontSize: '9px', lineHeight: '1.2', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Name</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>{customerName}</td>
              </tr>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Address</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: '600', verticalAlign: 'top' }}>{customerAddress}</td>
              </tr>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Mob</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top' }}>{customerPhone || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Right (40%) */}
        <div style={{ flex: '0 0 40%', padding: '4px 8px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: '4px', right: '4px', border: '1px solid black', padding: '1px 6px', fontSize: '8px', fontWeight: 'bold', backgroundColor: 'white' }}>
            {paymentBadge}
          </div>
          <table style={{ width: '100%', fontSize: '9px', lineHeight: '1.2', borderCollapse: 'collapse', marginTop: '8px' }}>
            <tbody>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Bill No</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top' }}>{invoiceNo}</td>
              </tr>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Date</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: '600', verticalAlign: 'top' }}>{formattedDate} ({formattedTime})</td>
              </tr>
              <tr>
                <td style={{ width: '55px', fontWeight: 'bold', verticalAlign: 'top' }}>Payment</td>
                <td style={{ width: '10px', fontWeight: 'bold', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', textTransform: 'uppercase', verticalAlign: 'top' }}>{paymentMode}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. PRODUCT TABLE (approx 40%) */}
      <div style={{ flex: '0 0 40%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', height: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid black', height: '18px' }}>
              <th style={{ borderRight: '1px solid black', width: '6%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>Sr.</th>
              <th style={{ borderRight: '1px solid black', width: '25%', fontWeight: 'bold', textAlign: 'left', padding: '2px 4px' }}>Product Details</th>
              <th style={{ borderRight: '1px solid black', width: '7%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>HSN</th>
              <th style={{ borderRight: '1px solid black', width: '9%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>BATCH</th>
              <th style={{ borderRight: '1px solid black', width: '10%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>EXPIRY</th>
              <th style={{ borderRight: '1px solid black', width: '7%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>Qty</th>
              <th style={{ borderRight: '1px solid black', width: '9%', fontWeight: 'bold', textAlign: 'right', padding: '2px' }}>Rate</th>
              <th style={{ borderRight: '1px solid black', width: '8%', fontWeight: 'bold', textAlign: 'center', padding: '2px' }}>GST %</th>
              <th style={{ borderRight: '1px solid black', width: '10%', fontWeight: 'bold', textAlign: 'right', padding: '2px' }}>Rate<br/>(W/ GST)</th>
              <th style={{ width: '9%', fontWeight: 'bold', textAlign: 'right', padding: '2px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} style={{ borderBottom: '1px solid black', height: '16px' }}>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontWeight: 'bold', padding: '1px 2px' }}>{idx + 1}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'left', padding: '1px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.name}</span>
                  {item.manufacturer && <span style={{ fontSize: '7px', display: 'block' }}>Mfg: {item.manufacturer}</span>}
                </td>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontFamily: 'monospace', padding: '1px 2px' }}>{item.hsn}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', padding: '1px 2px' }}>{item.batch}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontFamily: 'monospace', padding: '1px 2px' }}>{item.expiry}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', padding: '1px 2px' }}>
                  {typeof item.quantity === 'number' ? (Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)) : item.quantity}
                </td>
                <td style={{ borderRight: '1px solid black', textAlign: 'right', fontFamily: 'monospace', padding: '1px 2px' }}>{item.rate.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', padding: '1px 2px' }}>{item.gstRate.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid black', textAlign: 'right', fontFamily: 'monospace', padding: '1px 2px' }}>{item.rateWithGst.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: '1px 2px' }}>{item.total.toFixed(2)}</td>
              </tr>
            ))}
            {emptyRowsCount > 0 && Array.from({ length: emptyRowsCount }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ borderBottom: i === emptyRowsCount - 1 ? 'none' : '1px solid black', height: 'auto' }}>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td style={{ borderRight: '1px solid black' }}>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. TAX SUMMARY (approx 7%) */}
      <div style={{ flex: '0 0 7%', borderTop: '1px solid black', borderBottom: '1px solid black', display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: '0 0 15%', borderRight: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 6px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '8px', lineHeight: '1.2' }}>taxable</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9px' }}>₹ {taxableTotal.toFixed(2)}</span>
        </div>
        <div style={{ flex: '0 0 15%', borderRight: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 6px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '8px', lineHeight: '1.2' }}>cgst</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9px' }}>₹ {cgstTotal.toFixed(2)}</span>
        </div>
        <div style={{ flex: '0 0 15%', borderRight: '1px solid black', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2px 6px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '8px', lineHeight: '1.2' }}>sgst</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9px' }}>₹ {sgstTotal.toFixed(2)}</span>
        </div>
        <div style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>Net total</span>
          <span style={{ fontWeight: '900', fontFamily: 'monospace', fontSize: '15px' }}>₹ {netTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* 5. LOWER SECTION (approx 18%) */}
      <div style={{ flex: '0 0 18%', display: 'flex', overflow: 'hidden' }}>
        {/* Left: BANK DETAILS */}
        <div style={{ flex: '0 0 30%', borderRight: '1px solid black', padding: '4px 8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '4px' }}>BANK DETAILS</div>
          <table style={{ width: '100%', fontSize: '8.5px', lineHeight: '1.3', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '50px', fontWeight: '600' }}>Bank Name</td>
                <td style={{ fontWeight: 'bold' }}>{shop.bankName || ''}</td>
              </tr>
              <tr>
                <td style={{ width: '50px', fontWeight: '600' }}>A/C No</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{shop.accountNumber || ''}</td>
              </tr>
              <tr>
                <td style={{ width: '50px', fontWeight: '600' }}>IFSC Code</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{shop.ifsc || ''}</td>
              </tr>
              <tr>
                <td style={{ width: '50px', fontWeight: '600' }}>Branch</td>
                <td style={{ fontWeight: '600' }}>{shop.branch || ''}</td>
              </tr>
              <tr>
                <td style={{ width: '50px', fontWeight: '600' }}>A/C Type</td>
                <td style={{ fontWeight: '600' }}>{shop.accountType || ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Middle: AMOUNT IN WORDS + LEDGER */}
        <div style={{ flex: '0 0 40%', borderRight: '1px solid black', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid black', flex: '0 0 45%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '2px' }}>Amount in words</div>
            <div style={{ fontWeight: 'bold', fontSize: '8.5px', fontStyle: 'italic', textTransform: 'capitalize', lineHeight: '1.2' }}>
              {cleanWords}
            </div>
          </div>
          <div style={{ padding: '4px 8px', flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <table style={{ width: '100%', fontSize: '8.5px', lineHeight: '1.4', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '85px', fontWeight: '600' }}>Opening Bal</td>
                  <td style={{ width: '8px' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>₹ {openingBal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ width: '85px', fontWeight: '600' }}>Dr invoice</td>
                  <td style={{ width: '8px' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>₹ {drInvoice.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ width: '85px', fontWeight: '600' }}>Closing balance</td>
                  <td style={{ width: '8px' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>₹ {closingBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: SIGNATURE */}
        <div style={{ flex: '1', padding: '4px 8px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ textAlign: 'right', paddingRight: '15px', paddingTop: '6px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '9px', textTransform: 'uppercase' }}>
              {shop.shopName || 'KRUSHI OS SEVA KENDRA'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: '1', paddingBottom: '2px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '8.5px' }}>Customer sign</span>
            <span style={{ fontWeight: 'bold', fontSize: '8.5px', paddingRight: '8px' }}>Authorized Sign</span>
          </div>
        </div>
      </div>

      {/* 6. FOOTER (approx 3%) */}
      <div style={{ flex: '0 0 3%', borderTop: '1px solid black', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px', fontSize: '7.5px', fontWeight: 'bold' }}>
        <span>THIS IS COMPUTER GENERATED TAX INVOICE</span>
        <span>SUBJECT TO {shop.district ? shop.district.toUpperCase() : 'NANDED'} JURISDICTION</span>
        <span>PAGE 1 OF 1</span>
      </div>
    </div>
  );
}

// PRINT / PDF UTILS

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
            size: A5 landscape;
            margin: 0;
          }
          html, body {
            width: 210mm;
            height: 148mm;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        <div style="padding: 0; margin: 0; width: 210mm; height: 148mm; display: flex; align-items: center; justify-content: center;">
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
      format: 'a5',
    });

    // Center 204x142 inside 210x148
    pdf.addImage(imgData, 'JPEG', 3, 3, 204, (204 * canvas.height) / canvas.width);
    pdf.save(filename);
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
