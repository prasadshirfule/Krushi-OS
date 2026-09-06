'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShopDetails, 
  DEFAULT_SHOP_DETAILS, 
  getSavedShopDetails, 
  formatShopAddress 
} from '@/lib/shop-details';
import { getDemoProductsClient } from '@/lib/client-demo-store';
import { getShopProfileAction } from '@/actions/settings';
import { buildUpiUri, generateQrDataUrl } from '@/lib/upi';
import { InvoiceItemData, InvoiceProps, formatInvoiceExpiry } from './reference-tax-invoice';

/**
 * Formats product name for 80mm thermal receipt in the exact required structure:
 * PRODUCT_NAME  (SIZE) with TWO spaces before the opening bracket.
 */
export function formatThermalProductName(rawName?: string, packSize?: string, unit?: string): string {
  let name = (rawName || 'PRODUCT').trim().toUpperCase();
  
  // If already formatted with brackets (e.g. "UREA (45KG)" or "UREA(45KG)"), normalize to 2 spaces
  const bracketMatch = name.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (bracketMatch) {
    const base = bracketMatch[1].trim();
    const sz = bracketMatch[2].trim().toUpperCase();
    return `${base}  (${sz})`;
  }

  // Construct from size & unit
  const sizeVal = (packSize || '').trim();
  const unitVal = (unit || '').trim();
  let combinedSize = '';

  if (sizeVal) {
    if (unitVal && !sizeVal.toUpperCase().includes(unitVal.toUpperCase())) {
      combinedSize = `${sizeVal}${unitVal}`.toUpperCase();
    } else {
      combinedSize = sizeVal.toUpperCase();
    }
  } else if (unitVal) {
    combinedSize = unitVal.toUpperCase();
  }

  if (combinedSize) {
    return `${name}  (${combinedSize})`;
  }

  return name;
}

export function ThermalReceiptInvoice({ sale, shopDetails: customShopDetails, customItems }: InvoiceProps) {
  const [persistedShop, setPersistedShop] = useState<ShopDetails>(DEFAULT_SHOP_DETAILS);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    const cached = getSavedShopDetails();
    if (cached) setPersistedShop(cached);

    getShopProfileAction().then(res => {
      if (res?.success && res?.data) {
        setPersistedShop(res.data);
      }
    }).catch(() => {});
  }, []);

  const shop: ShopDetails = {
    ...persistedShop,
    ...(customShopDetails || {}),
  };

  const s = sale || {};
  const hasRealSale = Boolean(s.id || s.invoice_number || (s.items && s.items.length > 0) || (s.sale_items && s.sale_items.length > 0));

  const customerName = (s.customer?.name || (typeof s.customer === 'string' ? s.customer : null) || s.customer_name || (hasRealSale ? 'WALK-IN CUSTOMER' : 'DEMO CUSTOMER NAME')).toUpperCase();
  const customerPhone = s.customer?.phone || s.customer?.mobile || s.customer_phone || '';
  const customerAddress = [
    s.customer?.village || s.customer?.address || s.customer_village || s.customer_address || '',
    s.customer?.district || '',
    s.customer?.state || ''
  ].filter(Boolean).join(', ');

  const invoiceNo = s.invoice_number || s.invoiceNumber || (s.id ? (s.id.startsWith('KOS-') ? s.id : `KOS-${s.id.substring(0, 8).toUpperCase()}`) : 'KOS-2026-001');
  const dateObj = s.sale_date || s.created_at ? new Date(s.sale_date || s.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isCredit = (s.payment_method || s.payment_mode || s.paymentMethod || '').toUpperCase() === 'CREDIT';
  const isUpi = (s.payment_method || s.payment_mode || s.paymentMethod || s.payments?.[0]?.method || '').toUpperCase() === 'UPI';
  const paymentMode = isUpi ? 'UPI' : (isCredit ? 'CREDIT' : (s.payment_method || s.payment_mode || s.paymentMethod || 'CASH').toUpperCase());

  /* ---------- Items ---------- */
  const rawItems = customItems || s.items || s.sale_items || [];
  let items: InvoiceItemData[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Math.max(1, Number(item.quantity || 1));
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      
      const unitPrice = Number(item.unit_price ?? item.selling_price ?? item.rate ?? (item.total_amount && qty ? item.total_amount / qty : 0));
      const discAmt = Number(
        item.discount_amount !== undefined 
          ? item.discount_amount 
          : (item.discount !== undefined ? item.discount : (item.discount_percent ? (qty * unitPrice * item.discount_percent / 100) : 0))
      );
      const lineTotal = Math.max(0, (qty * unitPrice) - discAmt);
      
      const taxable = Math.round((lineTotal / (1 + gst / 100)) * 100) / 100;
      const totalTax = Math.round((lineTotal - taxable) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;

      let prodRawName = item.product_name || item.name;
      if (!prodRawName || prodRawName === 'Product') prodRawName = p.name;
      if (!prodRawName || prodRawName === 'Product') {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) prodRawName = match.name;
        } catch {}
      }
      if (!prodRawName) prodRawName = 'DEMO PRODUCT';

      const packSize = item.pack_size || p.pack_size || ((item.product_size_value || p.product_size_value) ? `${item.product_size_value || p.product_size_value} ${item.product_size_unit || p.product_size_unit || 'KG'}` : '');
      const unit = item.unit || p.unit || '';
      // Exact PRODUCT_NAME  (SIZE) format with 2 spaces
      const prodName = formatThermalProductName(prodRawName, packSize, unit);

      let mfg = item.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '';
      if (!mfg && (item.product_id || item.id)) {
        try {
          const catalog = getDemoProductsClient();
          const match = catalog.find((catItem: any) => catItem.id === (item.product_id || item.id));
          if (match) mfg = match.manufacturer || match.brand?.manufacturer || match.brand?.name || '';
        } catch {}
      }
      const manufacturer = (mfg && mfg !== 'null' && mfg !== 'undefined' && String(mfg).trim() !== '-')
        ? String(mfg).trim().toUpperCase()
        : '-';

      const rawHsn = item.hsn_code || p.hsn_code || p.hsnCode || '';
      const hsn = (rawHsn && rawHsn !== 'null' && rawHsn !== 'undefined' && String(rawHsn).trim() !== '-')
        ? String(rawHsn).trim()
        : '-';

      const rawBatch = item.batch_number || item.batch?.batch_number || item.item_batches?.[0]?.batch?.batch_number || p.batches?.[0]?.batch_number || p.batch_number || '';
      const batch = (rawBatch && rawBatch !== 'null' && rawBatch !== 'undefined' && String(rawBatch).trim() !== '-')
        ? String(rawBatch).trim()
        : '-';

      const rawExpiry = item.expiry_date || item.batch?.expiry_date || item.item_batches?.[0]?.batch?.expiry_date || p.batches?.[0]?.expiry_date || p.expiry_date || '';
      const expiry = formatInvoiceExpiry(rawExpiry);

      return {
        id: item.id || `item-${idx}`,
        name: prodName,
        manufacturer: manufacturer,
        hsn: hsn,
        batch: batch,
        expiry: expiry,
        quantity: qty,
        rate: unitPrice,
        gstRate: gst,
        rateWithGst: unitPrice,
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
        name: 'UREA  (45KG)',
        manufacturer: 'IFFCO',
        hsn: '3102',
        batch: '-',
        expiry: '-',
        quantity: 1,
        rate: 266,
        gstRate: 5,
        rateWithGst: 266,
        taxableAmount: 253.33,
        cgstAmount: 6.33,
        sgstAmount: 6.34,
        total: 266,
      }
    ];
  }

  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  let rawAdjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  if (rawAdjustments.length === 0 && s.notes && typeof s.notes === 'string') {
    try {
      const trimmed = s.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.adjustments)) {
          rawAdjustments = parsed.adjustments;
        }
      } else if (trimmed.includes('__ADJUSTMENTS__:')) {
        const parts = trimmed.split('__ADJUSTMENTS__:');
        const parsed = JSON.parse(parts[1]);
        if (Array.isArray(parsed)) {
          rawAdjustments = parsed;
        }
      }
    } catch {}
  }
  const adjustments = rawAdjustments;
  const totalAdditions = adjustments.filter(a => a.type === 'ADD').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments.filter(a => a.type === 'DEDUCT').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const netTotal = Math.max(0, productsTotal + totalAdditions - totalDeductions);

  useEffect(() => {
    if (isUpi && shop.upiId && netTotal > 0) {
      const uri = buildUpiUri(shop.upiId, shop.shopName, netTotal);
      generateQrDataUrl(uri, { width: 200, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [isUpi, shop.upiId, shop.shopName, netTotal]);

  const dynamicShopAddress = formatShopAddress(shop) || shop.address || '';

  return (
    <div
      className="thermal-receipt-page"
      style={{
        width: '78mm',
        maxWidth: '78mm',
        minHeight: 'auto',
        margin: '0 auto',
        padding: '3mm 2mm',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, "Courier New", monospace',
        boxSizing: 'border-box',
        fontSize: '11px',
        lineHeight: 1.3,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        id="printable-thermal-receipt"
        className="thermal-receipt"
        style={{
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ─── 1. SHOP HEADER ─── */}
        <div style={{ textAlign: 'center', marginBottom: '2.5mm' }}>
          <div style={{ fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1.15 }}>
            {shop.shopName || 'KRUSHI SEVA KENDRA'}
          </div>
          {dynamicShopAddress && (
            <div style={{ fontSize: '9.5px', fontWeight: 600, marginTop: '1mm', lineHeight: 1.2 }}>
              {dynamicShopAddress}
            </div>
          )}
          <div style={{ fontSize: '9.5px', fontWeight: 600, marginTop: '0.5mm' }}>
            {shop.ownerName && <span>Pro: {shop.ownerName} | </span>}
            {shop.contact1 && <span>Mob: {shop.contact1}</span>}
          </div>
          {shop.gstNumber && (
            <div style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'monospace', marginTop: '0.5mm' }}>
              GSTIN: {shop.gstNumber}
            </div>
          )}
          {shop.licenseNumber && (
            <div style={{ fontSize: '8.5px', fontWeight: 600, fontFamily: 'monospace' }}>
              Lic No: {shop.licenseNumber}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000000', margin: '2mm 0' }} />

        {/* ─── 2. INVOICE & CUSTOMER INFO ─── */}
        <div style={{ fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>Bill No: <span style={{ fontFamily: 'monospace' }}>{invoiceNo}</span></span>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', padding: '0 3px', border: '1px solid #000' }}>{paymentMode}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginTop: '0.5mm' }}>
            <span>Date: {formattedDate}</span>
            <span>{formattedTime}</span>
          </div>
          <div style={{ marginTop: '1mm', fontWeight: 700 }}>
            Customer: <span style={{ textTransform: 'uppercase' }}>{customerName}</span>
          </div>
          {customerPhone && (
            <div style={{ fontSize: '9.5px' }}>
              Mob: <span style={{ fontFamily: 'monospace' }}>{customerPhone}</span>
            </div>
          )}
          {customerAddress && (
            <div style={{ fontSize: '9px', color: '#222' }}>
              Addr: {customerAddress}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000000', margin: '2mm 0' }} />

        {/* ─── 3. NEW 4-COLUMN PRODUCT TABLE ─── */}
        <div style={{ marginBottom: '2mm' }}>
          {/* Table Header: ITEM DETAILS | QTY | MRP | TOTAL */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontWeight: 900, 
              fontSize: '9.5px', 
              paddingBottom: '1mm', 
              borderBottom: '1px solid #000000',
              textTransform: 'uppercase',
              letterSpacing: '0.2px'
            }}
          >
            <span style={{ width: '46%', textAlign: 'left' }}>ITEM DETAILS</span>
            <span style={{ width: '14%', textAlign: 'center' }}>QTY</span>
            <span style={{ width: '20%', textAlign: 'right' }}>MRP</span>
            <span style={{ width: '20%', textAlign: 'right' }}>TOTAL</span>
          </div>

          {/* Table Rows */}
          <div style={{ marginTop: '1.5mm' }}>
            {items.map((item, idx) => (
              <div 
                key={item.id || idx} 
                style={{ 
                  paddingBottom: '2mm', 
                  marginBottom: '1.5mm', 
                  borderBottom: idx < items.length - 1 ? '0.5px dotted #888' : 'none' 
                }}
              >
                {/* 4-Column Row: 1. PRODUCT_NAME  (SIZE) | QTY | MRP | TOTAL */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    fontSize: '10px',
                    lineHeight: 1.25
                  }}
                >
                  {/* Product Name with Index and EXACT TWO SPACES before (SIZE) */}
                  <div 
                    style={{ 
                      width: '46%', 
                      textAlign: 'left', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word' 
                    }}
                  >
                    {idx + 1}. {item.name}
                  </div>

                  {/* Quantity (Centered) */}
                  <div 
                    style={{ 
                      width: '14%', 
                      textAlign: 'center', 
                      fontWeight: 700, 
                      fontFamily: 'monospace' 
                    }}
                  >
                    {item.quantity}
                  </div>

                  {/* MRP (Selling Price including GST - Right-Aligned) */}
                  <div 
                    style={{ 
                      width: '20%', 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      fontFamily: 'monospace',
                      fontSize: '9.5px'
                    }}
                  >
                    ₹{item.rate.toFixed(2)}
                  </div>

                  {/* Line Total (Right-Aligned) */}
                  <div 
                    style={{ 
                      width: '20%', 
                      textAlign: 'right', 
                      fontWeight: 900, 
                      fontFamily: 'monospace',
                      fontSize: '9.5px'
                    }}
                  >
                    ₹{item.total.toFixed(2)}
                  </div>
                </div>

                {/* Metadata line directly underneath: Mfg: MANUFACTURER | Batch: BATCH | Exp: EXPIRY */}
                <div 
                  style={{ 
                    fontSize: '8.5px', 
                    color: '#222', 
                    marginTop: '1mm', 
                    lineHeight: 1.2,
                    paddingLeft: '1mm'
                  }}
                >
                  <span>Mfg: {item.manufacturer}</span>
                  <span style={{ margin: '0 1mm' }}>|</span>
                  <span>Batch: {item.batch}</span>
                  <span style={{ margin: '0 1mm' }}>|</span>
                  <span>Exp: {item.expiry}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px dashed #000000', margin: '2mm 0' }} />

        {/* ─── 4. TOTALS & ADJUSTMENTS ─── */}
        <div style={{ fontSize: '10px', lineHeight: 1.4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxable Value:</span>
            <span style={{ fontFamily: 'monospace' }}>₹{taxableTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CGST:</span>
            <span style={{ fontFamily: 'monospace' }}>₹{cgstTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>SGST:</span>
            <span style={{ fontFamily: 'monospace' }}>₹{sgstTotal.toFixed(2)}</span>
          </div>

          {/* Adjustments */}
          {adjustments.map((adj, i) => {
            const isAdd = adj.type === 'ADD';
            const sign = isAdd ? '+' : '-';
            const amt = Number(adj.amount || 0).toFixed(2);
            return (
              <div key={adj.id || i} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>{adj.reason || 'Adjustment'} ({sign}):</span>
                <span style={{ fontFamily: 'monospace' }}>{sign}₹{amt}</span>
              </div>
            );
          })}

          {/* Heavy Net Total Box */}
          <div style={{ borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000', margin: '1.5mm 0', padding: '1mm 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}>NET TOTAL:</span>
            <span style={{ fontSize: '15px', fontWeight: 900, fontFamily: 'monospace' }}>₹{netTotal.toFixed(2)}</span>
          </div>

          {/* Payment Method */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '1mm' }}>
            <span>Payment Mode:</span>
            <span style={{ textTransform: 'uppercase' }}>{paymentMode}</span>
          </div>
        </div>

        {/* ─── 5. DYNAMIC UPI QR CODE (IF UPI) ─── */}
        {isUpi && shop.upiId && (
          <div style={{ textAlign: 'center', marginTop: '3mm', padding: '2mm', border: '1px dashed #000000' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1mm' }}>
              Scan to Pay (UPI)
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="UPI Payment QR"
                style={{ width: '32mm', height: '32mm', margin: '0 auto', display: 'block', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '32mm', height: '32mm', border: '1px solid #000', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>
                QR CODE
              </div>
            )}
            <div style={{ fontSize: '8.5px', fontWeight: 700, fontFamily: 'monospace', marginTop: '1mm' }}>
              UPI: {shop.upiId}
            </div>
            <div style={{ fontSize: '9.5px', fontWeight: 900, fontFamily: 'monospace' }}>
              ₹{netTotal.toFixed(2)}
            </div>
          </div>
        )}

        {/* ─── 6. RECEIPT FOOTER ─── */}
        <div style={{ textAlign: 'center', marginTop: '3mm', fontSize: '9px', fontWeight: 600, lineHeight: 1.3 }}>
          <div style={{ borderTop: '1px dashed #000000', paddingTop: '2mm', marginBottom: '1mm' }}>
            *** THANK YOU! VISIT AGAIN ***
          </div>
          <div style={{ fontSize: '8px', color: '#444' }}>
            Computer Generated Receipt | Krushi OS
          </div>
        </div>
      </div>
    </div>
  );
}
