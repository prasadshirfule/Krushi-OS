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
import { formatProductNameWithSize } from '@/lib/validations';
import { buildUpiUri, generateQrDataUrl } from '@/lib/upi';
import { InvoiceItemData, InvoiceProps, formatInvoiceExpiry } from './reference-tax-invoice';

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

  const rawPaymentMethod = (s.payment_method || s.payment_mode || s.paymentMethod || s.payments?.[0]?.method || 'CASH').toString().toUpperCase();
  const isCredit = rawPaymentMethod === 'CREDIT';
  const isUpi = rawPaymentMethod === 'UPI';
  const isPartial = rawPaymentMethod.includes('PARTIAL') || (Array.isArray(s.payments) && s.payments.length > 1);
  const paymentMode = isPartial ? 'PARTIAL' : (isUpi ? 'UPI' : (isCredit ? 'CREDIT' : (rawPaymentMethod === 'BANK_TRANSFER' ? 'BANK TRANSFER' : rawPaymentMethod)));

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
      // Exact PRODUCT_NAME (SIZE UNIT) format with single space before ( and between size & unit, no "PIECE"
      const prodName = formatProductNameWithSize(prodRawName, packSize, unit);

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
        name: 'STUNNER GOLD (50 ML)',
        manufacturer: 'PROGENE',
        hsn: '3808',
        batch: '100',
        expiry: '10/07/2028',
        quantity: 1,
        rate: 250,
        gstRate: 18,
        rateWithGst: 250,
        taxableAmount: 211.86,
        cgstAmount: 19.07,
        sgstAmount: 19.07,
        total: 250,
      }
    ];
  }

  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  let rawAdjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  let parsedMetadata: any = {};
  if (s.notes && typeof s.notes === 'string') {
    try {
      const trimmed = s.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsedMetadata = JSON.parse(trimmed);
        if (Array.isArray(parsedMetadata.adjustments)) {
          rawAdjustments = parsedMetadata.adjustments;
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

  // Partial payment breakdown calculation
  let partialCash = 0;
  let partialUpi = 0;
  let partialBank = 0;
  let partialPaidTotal = 0;
  let partialRemaining = 0;

  if (isPartial) {
    if (s.partial_payment) {
      partialCash = Number(s.partial_payment.cash || 0);
      partialUpi = Number(s.partial_payment.upi || 0);
      partialBank = Number(s.partial_payment.bank_transfer || s.partial_payment.bankTransfer || 0);
      partialPaidTotal = Number(s.partial_payment.total_paid || s.partial_payment.totalPaid || (partialCash + partialUpi + partialBank));
      partialRemaining = Number(s.partial_payment.remaining !== undefined ? s.partial_payment.remaining : Math.max(0, netTotal - partialPaidTotal));
    } else if (parsedMetadata.partialPayment) {
      const pp = parsedMetadata.partialPayment;
      partialCash = Number(pp.cash || 0);
      partialUpi = Number(pp.upi || 0);
      partialBank = Number(pp.bank_transfer || pp.bankTransfer || 0);
      partialPaidTotal = Number(pp.total_paid || pp.totalPaid || (partialCash + partialUpi + partialBank));
      partialRemaining = Number(pp.remaining !== undefined ? pp.remaining : Math.max(0, netTotal - partialPaidTotal));
    } else if (Array.isArray(s.payments) && s.payments.length > 0) {
      for (const p of s.payments) {
        const m = String(p.method).toUpperCase();
        const amt = Number(p.amount || 0);
        if (m === 'CASH') partialCash += amt;
        else if (m === 'UPI') partialUpi += amt;
        else if (m === 'BANK_TRANSFER' || m === 'BANK TRANSFER') partialBank += amt;
      }
      partialPaidTotal = partialCash + partialUpi + partialBank;
      partialRemaining = Math.max(0, netTotal - partialPaidTotal);
    }
  }

  // Determine UPI QR amount: for full UPI = netTotal; for Partial Payment = ONLY UPI portion (if > 0)
  const upiQrAmount = isPartial ? partialUpi : (isUpi ? netTotal : 0);

  useEffect(() => {
    if (upiQrAmount > 0 && shop.upiId) {
      const uri = buildUpiUri(shop.upiId, shop.shopName, upiQrAmount);
      generateQrDataUrl(uri, { width: 200, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [upiQrAmount, shop.upiId, shop.shopName]);

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

        {/* ─── 3. 4-COLUMN PRODUCT TABLE (COMPACT 1-LINE PRODUCT NAME FIT) ─── */}
        <div style={{ marginBottom: '2mm' }}>
          {/* Table Header: ITEM DETAILS | QTY | MRP | TOTAL */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontWeight: 900, 
              fontSize: '9px', 
              paddingBottom: '1mm', 
              borderBottom: '1px solid #000000',
              textTransform: 'uppercase',
              letterSpacing: '0.1px'
            }}
          >
            <span style={{ width: '50%', textAlign: 'left' }}>ITEM DETAILS</span>
            <span style={{ width: '12%', textAlign: 'center' }}>QTY</span>
            <span style={{ width: '19%', textAlign: 'right' }}>MRP</span>
            <span style={{ width: '19%', textAlign: 'right' }}>TOTAL</span>
          </div>

          {/* Table Rows */}
          <div style={{ marginTop: '1.5mm' }}>
            {items.map((item, idx) => (
              <div 
                key={item.id || idx} 
                style={{ 
                  paddingBottom: '1.5mm', 
                  marginBottom: '1.5mm', 
                  borderBottom: idx < items.length - 1 ? '0.5px dotted #888' : 'none' 
                }}
              >
                {/* 4-Column Row: 1. PRODUCT_NAME (SIZE UNIT) | QTY | MRP | TOTAL */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    fontSize: '9.2px',
                    lineHeight: 1.2
                  }}
                >
                  {/* Product Name (Clean 1-line fit for normal names) */}
                  <div 
                    style={{ 
                      width: '50%', 
                      textAlign: 'left', 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      wordBreak: 'break-word',
                      letterSpacing: '-0.1px',
                      paddingRight: '1mm'
                    }}
                  >
                    {idx + 1}. {item.name}
                  </div>

                  {/* Quantity (Centered) */}
                  <div 
                    style={{ 
                      width: '12%', 
                      textAlign: 'center', 
                      fontWeight: 700, 
                      fontFamily: 'monospace',
                      fontSize: '9.2px'
                    }}
                  >
                    {item.quantity}
                  </div>

                  {/* MRP (Right-Aligned) */}
                  <div 
                    style={{ 
                      width: '19%', 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      fontFamily: 'monospace',
                      fontSize: '9px'
                    }}
                  >
                    ₹{item.rate.toFixed(2)}
                  </div>

                  {/* Line Total (Right-Aligned) */}
                  <div 
                    style={{ 
                      width: '19%', 
                      textAlign: 'right', 
                      fontWeight: 900, 
                      fontFamily: 'monospace',
                      fontSize: '9px'
                    }}
                  >
                    ₹{item.total.toFixed(2)}
                  </div>
                </div>

                {/* Metadata line directly underneath: Mfg: MANUFACTURER | Batch: BATCH | Exp: EXPIRY */}
                <div 
                  style={{ 
                    fontSize: '8px', 
                    color: '#222', 
                    marginTop: '0.5mm', 
                    lineHeight: 1.15,
                    paddingLeft: '0.5mm'
                  }}
                >
                  <span>Mfg: {item.manufacturer}</span>
                  <span style={{ margin: '0 0.8mm' }}>|</span>
                  <span>Batch: {item.batch}</span>
                  <span style={{ margin: '0 0.8mm' }}>|</span>
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

          {/* Payment Method & Partial Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '1mm' }}>
            <span>Payment Mode:</span>
            <span style={{ textTransform: 'uppercase' }}>{paymentMode}</span>
          </div>

          {isPartial && (
            <div style={{ marginTop: '1mm', padding: '1.5mm 2mm', backgroundColor: '#f5f5f5', borderRadius: '3px', fontSize: '9px', lineHeight: 1.35, border: '0.5px solid #ddd' }}>
              <div style={{ fontWeight: 800, textTransform: 'uppercase', borderBottom: '0.5px solid #ccc', paddingBottom: '0.5mm', marginBottom: '0.5mm' }}>
                Payment Breakdown
              </div>
              {partialCash > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{partialCash.toFixed(2)}</span>
                </div>
              )}
              {partialUpi > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>UPI:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{partialUpi.toFixed(2)}</span>
                </div>
              )}
              {partialBank > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bank Transfer:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{partialBank.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px dotted #aaa', paddingTop: '0.5mm', marginTop: '0.5mm', fontWeight: 800 }}>
                <span>Total Paid:</span>
                <span style={{ fontFamily: 'monospace' }}>₹{partialPaidTotal.toFixed(2)}</span>
              </div>
              {partialRemaining > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 800 }}>
                  <span>Remaining Balance:</span>
                  <span style={{ fontFamily: 'monospace' }}>₹{partialRemaining.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── 5. DYNAMIC UPI QR CODE (FOR FULL UPI OR PARTIAL UPI PORTION > 0) ─── */}
        {upiQrAmount > 0 && shop.upiId && (
          <div style={{ textAlign: 'center', marginTop: '2.5mm', padding: '2mm', border: '1px dashed #000000' }}>
            <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1mm' }}>
              {isPartial ? `Scan to Pay UPI (₹${upiQrAmount.toFixed(2)})` : 'Scan to Pay (UPI)'}
            </div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="UPI Payment QR"
                style={{ width: '30mm', height: '30mm', margin: '0 auto', display: 'block', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '30mm', height: '30mm', border: '1px solid #000', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>
                QR CODE
              </div>
            )}
            <div style={{ fontSize: '8.5px', fontWeight: 700, fontFamily: 'monospace', marginTop: '1mm' }}>
              UPI: {shop.upiId}
            </div>
            <div style={{ fontSize: '9.5px', fontWeight: 900, fontFamily: 'monospace' }}>
              ₹{upiQrAmount.toFixed(2)}
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
