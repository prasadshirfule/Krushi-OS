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
import { getShopProfileAction } from '@/actions/settings';

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

export function formatInvoiceExpiry(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '-';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined') return '-';

  // Already in DD/MM/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // If in YYYY-MM-DD or ISO format (e.g. 2028-12-31 or 2028-12-31T00:00:00.000Z)
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    if (year > 1900 && year < 3000) {
      return `${day}/${month}/${year}`;
    }
  }

  return trimmed;
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

/* ================================================================
   mm-to-CSS helper – keeps JSX readable
   ================================================================ */
const mm = (v: number) => `${v}mm`;

/* ================================================================
   SHARED INLINE-STYLE CONSTANTS
   ================================================================ */
const BORDER_OUTER = '0.5mm solid #000';
const BORDER_MAJOR = '0.45mm solid #000';
const BORDER_INNER = '0.35mm solid #000';

const FONT_BASE: React.CSSProperties = {
  fontFamily: 'Arial, Helvetica, "Liberation Sans", sans-serif',
  color: '#000000',
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
};

/* ================================================================
   SECTION HEIGHTS (must total 142 mm)
   Header       : 19   mm
   Customer     : 19   mm
   Table header : 9    mm
   Table body   : 47   mm  (product rows – fills remainder)
   Totals       : 10.5 mm
   Bottom       : 29   mm
   Footer       : 4.5  mm
   Outer border : 2 × 0.5mm = ~1 mm consumed by border
   Remaining    :  3   mm (rounding/border thickness absorb)
   ================================================================ */
const H_HEADER   = 19;
const H_CUSTOMER = 19;
const H_TBL_HEAD = 9;
const H_TOTALS   = 7.5;
const H_BOTTOM   = 29;
const H_FOOTER   = 4.5;
// Table body gets the rest (expanded with saved totals height):
const H_TBL_BODY = 142 - H_HEADER - H_CUSTOMER - H_TBL_HEAD - H_TOTALS - H_BOTTOM - H_FOOTER; // ≈ 54 mm

/* ================================================================
   COMPONENT
   ================================================================ */
export function ReferenceTaxInvoice({ sale, shopDetails: customShopDetails, customItems }: InvoiceProps) {
  const [persistedShop, setPersistedShop] = useState<ShopDetails>(DEFAULT_SHOP_DETAILS);

  useEffect(() => {
    // 1. Initial synchronous cache/defaults load
    const cached = getSavedShopDetails();
    if (cached) setPersistedShop(cached);

    // 2. Fetch latest verified profile from Supabase settings
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

  /* ---------- data extraction (identical logic) ---------- */
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

  /* ---------- items ---------- */
  const rawItems = customItems || s.items || s.sale_items || [];
  let items: InvoiceItemData[] = [];

  if (rawItems.length > 0) {
    items = rawItems.map((item: any, idx: number) => {
      const p = item.product || {};
      const qty = Math.max(1, Number(item.quantity || 1));
      const gst = Number(item.gst_rate ?? item.gstRate ?? p.gst_rate ?? 18);
      
      // Selling price entered by shop owner already includes GST
      const unitPrice = Number(item.unit_price ?? item.selling_price ?? item.rate ?? (item.total_amount && qty ? item.total_amount / qty : 0));
      const discAmt = Number(
        item.discount_amount !== undefined 
          ? item.discount_amount 
          : (item.discount !== undefined ? item.discount : (item.discount_percent ? (qty * unitPrice * item.discount_percent / 100) : 0))
      );
      const lineTotal = Math.max(0, (qty * unitPrice) - discAmt);
      
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
        manufacturer: mfg,
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
        name: 'STUNNER GOLD',
        manufacturer: 'Progone',
        hsn: '3105',
        batch: 'BAC2245',
        expiry: '10/07/2028',
        quantity: 1,
        rate: 295,
        gstRate: 18,
        rateWithGst: 295,
        taxableAmount: 250,
        cgstAmount: 22.5,
        sgstAmount: 22.5,
        total: 295,
      }
    ];
  }

  /* ---------- totals ---------- */
  const taxableTotal = items.reduce((sum, item) => sum + item.taxableAmount, 0);
  const cgstTotal = items.reduce((sum, item) => sum + item.cgstAmount, 0);
  const sgstTotal = items.reduce((sum, item) => sum + item.sgstAmount, 0);
  const productsTotal = items.reduce((sum, item) => sum + item.total, 0);

  const adjustments: any[] = Array.isArray(s.adjustments) ? s.adjustments : [];
  const totalAdditions = adjustments.filter(a => a.type === 'ADD').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalDeductions = adjustments.filter(a => a.type === 'DEDUCT').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const netTotal = Math.max(0, productsTotal + totalAdditions - totalDeductions);

  let rawWords = numberToWords(Math.round(netTotal));
  let cleanWords = `${rawWords} Rupees Only`.replace(/Rupees Only\s+Rupees Only/gi, 'Rupees Only').replace(/\s+/g, ' ').trim();

  // Ledger calculation
  const amountPaid = s.paid_amount !== undefined ? Number(s.paid_amount) : (isCredit ? 0 : netTotal);
  const openingBal = s.customer?.opening_balance ? Number(s.customer.opening_balance) : 0;
  const drInvoice = netTotal;
  const closingBalance = openingBal + drInvoice - amountPaid;

  /* ---------- row count for table ---------- */
  const ROW_HEIGHT_MM = 8.5;
  const maxRowsInBody = Math.floor(H_TBL_BODY / ROW_HEIGHT_MM);
  const displayItems = items.slice(0, maxRowsInBody);
  const emptyRowsCount = Math.max(0, maxRowsInBody - displayItems.length);

  const dynamicShopAddress = formatShopAddress(shop) || shop.address || '';

  /* ================================================================
     COLUMN WIDTHS (% of 204mm table)
     ================================================================ */
  const COL = {
    sr:      '4.5%',
    product: '23.5%',
    hsn:     '7%',
    batch:   '8.5%',
    expiry:  '10%',
    qty:     '6.5%',
    rate:    '8.5%',
    gst:     '7%',
    rateGst: '13%',
    total:   '11.5%',
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <div
      className="invoice-page"
      style={{
        width: mm(210),
        height: mm(148),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        id="printable-tax-invoice"
        className="invoice"
        style={{
          ...FONT_BASE,
          width: mm(204),
          height: mm(142),
          border: BORDER_OUTER,
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          margin: '0 auto',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >
        {/* ════════════════════════════════════════════════════════
            1. HEADER – 19 mm
            ════════════════════════════════════════════════════════ */}
        <div style={{
          height: mm(H_HEADER),
          borderBottom: BORDER_MAJOR,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${mm(1.5)}`,
          boxSizing: 'border-box',
        }}>
          {/* 1A + 1B – Logo + Shop Information (ONE continuous area, NO vertical divider) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            height: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box',
            paddingRight: mm(2),
          }}>
            {/* Logo (no right border, comfortable spacing) */}
            <div style={{
              width: mm(18),
              minWidth: mm(18),
              height: mm(17),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}>
              {shop.logoBase64 ? (
                <img
                  src={shop.logoBase64}
                  alt="Logo"
                  style={{ maxWidth: mm(16), maxHeight: mm(16), objectFit: 'contain' }}
                />
              ) : (
                <div style={{
                  width: mm(15),
                  height: mm(15),
                  border: '0.3mm solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '7.5px',
                  fontWeight: 'bold',
                }}>
                  LOGO
                </div>
              )}
            </div>

            {/* Shop Details (centered in remaining shop info area) */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: `0 ${mm(1)}`,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: '17.5px',
                fontWeight: 900,
                textTransform: 'uppercase',
                lineHeight: 1.1,
                margin: 0,
                letterSpacing: '0.3px',
              }}>
                {shop.shopName || 'KRUSHI SEVA KENDRA'}
              </div>
              {dynamicShopAddress && (
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  marginTop: mm(0.5),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}>
                  {dynamicShopAddress}
                </div>
              )}
              <div style={{
                fontSize: '9.5px',
                fontWeight: 'bold',
                marginTop: mm(0.5),
                display: 'flex',
                gap: mm(6),
                justifyContent: 'center',
              }}>
                {shop.ownerName && <span>Pro: {shop.ownerName}</span>}
                {shop.contact1 && <span>Mob: {shop.contact1}</span>}
              </div>
            </div>
          </div>

          {/* 1C – Independent GSTIN / LIC / REG Table (3 Rows × 1 Column, 4-sided outer border, 2 internal dividers) */}
          <div style={{
            width: mm(52),
            minWidth: mm(52),
            height: mm(17),
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <table style={{
              width: '100%',
              height: '100%',
              border: BORDER_MAJOR,
              borderCollapse: 'collapse',
              boxSizing: 'border-box',
              fontSize: '9.2px',
              tableLayout: 'fixed',
            }}>
              <tbody>
                {/* GSTIN row */}
                <tr style={{ height: '33.33%' }}>
                  <td style={{
                    borderBottom: BORDER_INNER,
                    padding: `0 ${mm(1.5)}`,
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    <span style={{ fontWeight: 'bold', display: 'inline-block', width: mm(14) }}>GSTIN:</span>
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9.5px' }}>{shop.gstNumber || '-'}</span>
                  </td>
                </tr>
                {/* LIC NO row */}
                <tr style={{ height: '33.33%' }}>
                  <td style={{
                    borderBottom: BORDER_INNER,
                    padding: `0 ${mm(1.5)}`,
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    <span style={{ fontWeight: 'bold', display: 'inline-block', width: mm(14) }}>LIC NO:</span>
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9.5px' }}>{shop.licenseNumber || '-'}</span>
                  </td>
                </tr>
                {/* REG NO row */}
                <tr style={{ height: '33.33%' }}>
                  <td style={{
                    padding: `0 ${mm(1.5)}`,
                    verticalAlign: 'middle',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    <span style={{ fontWeight: 'bold', display: 'inline-block', width: mm(14) }}>REG NO:</span>
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '9.5px' }}>{shop.registrationNumber || '-'}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      {/* ════════════════════════════════════════════════════════
          2. CUSTOMER + BILL INFO – 19 mm
          ════════════════════════════════════════════════════════ */}
      <div style={{
        height: mm(H_CUSTOMER),
        borderBottom: BORDER_MAJOR,
        display: 'flex',
        boxSizing: 'border-box',
      }}>
        {/* 2A – Customer (60%) */}
        <div style={{
          width: '60%',
          borderRight: BORDER_MAJOR,
          padding: `${mm(1)} ${mm(2)}`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <table style={{
            width: '100%',
            fontSize: '10px',
            lineHeight: 1.25,
            borderCollapse: 'collapse',
          }}>
            <tbody>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Name</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0', fontSize: '11.5px', textTransform: 'uppercase' }}>{customerName}</td>
              </tr>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Address</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: '600', verticalAlign: 'top', padding: '0.4px 0', fontSize: '10px', lineHeight: 1.2 }}>{customerAddress || '-'}</td>
              </tr>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Mob</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top', padding: '0.4px 0', fontSize: '10.5px' }}>{customerPhone || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2B – Bill info (40%) */}
        <div style={{
          width: '40%',
          padding: `${mm(1)} ${mm(2)}`,
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* Cash/Credit badge */}
          <div style={{
            position: 'absolute',
            top: mm(1.5),
            right: mm(2),
            border: BORDER_INNER,
            padding: `${mm(0.5)} ${mm(2.5)}`,
            fontSize: '9.5px',
            fontWeight: 'bold',
            backgroundColor: '#fff',
            lineHeight: 1,
          }}>
            {paymentBadge}
          </div>
          <table style={{
            width: '100%',
            fontSize: '10px',
            lineHeight: 1.25,
            borderCollapse: 'collapse',
            marginTop: mm(1.5),
          }}>
            <tbody>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Bill No</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top', padding: '0.4px 0', fontSize: '11px' }}>{invoiceNo}</td>
              </tr>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Date</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: '600', verticalAlign: 'top', padding: '0.4px 0', fontSize: '10px' }}>{formattedDate} ({formattedTime})</td>
              </tr>
              <tr>
                <td style={{ width: mm(15), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>Payment</td>
                <td style={{ width: mm(3), fontWeight: 'bold', verticalAlign: 'top', padding: '0.4px 0' }}>:</td>
                <td style={{ fontWeight: 'bold', textTransform: 'uppercase', verticalAlign: 'top', padding: '0.4px 0', fontSize: '10.5px' }}>{paymentMode}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          3. PRODUCT TABLE
          ════════════════════════════════════════════════════════ */}

      {/* 3A – Table header – 9 mm */}
      <div style={{
        height: mm(H_TBL_HEAD),
        borderBottom: BORDER_MAJOR,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        <table style={{
          width: '100%',
          height: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: '9.5px',
          fontWeight: 'bold',
        }}>
          <thead>
            <tr style={{ height: '100%' }}>
              <th style={{ width: COL.sr, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>Sr.</th>
              <th style={{ width: COL.product, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>Product Details</th>
              <th style={{ width: COL.hsn, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>HSN</th>
              <th style={{ width: COL.batch, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>BATCH</th>
              <th style={{ width: COL.expiry, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>EXPIRY</th>
              <th style={{ width: COL.qty, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>Qty</th>
              <th style={{ width: COL.rate, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>Rate</th>
              <th style={{ width: COL.gst, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>GST %</th>
              <th style={{ width: COL.rateGst, borderRight: BORDER_INNER, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4), lineHeight: 1.15 }}>Rate<br/>(With GST)</th>
              <th style={{ width: COL.total, textAlign: 'center', verticalAlign: 'middle', padding: mm(0.4) }}>Total</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* 3B – Table body */}
      <div style={{
        height: mm(H_TBL_BODY),
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        <table style={{
          width: '100%',
          height: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: '9.5px',
        }}>
          <colgroup>
            <col style={{ width: COL.sr }} />
            <col style={{ width: COL.product }} />
            <col style={{ width: COL.hsn }} />
            <col style={{ width: COL.batch }} />
            <col style={{ width: COL.expiry }} />
            <col style={{ width: COL.qty }} />
            <col style={{ width: COL.rate }} />
            <col style={{ width: COL.gst }} />
            <col style={{ width: COL.rateGst }} />
            <col style={{ width: COL.total }} />
          </colgroup>
          <tbody>
            {displayItems.map((item, idx) => (
              <tr key={item.id || idx} style={{ height: mm(ROW_HEIGHT_MM), borderBottom: BORDER_INNER }}>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontWeight: 'bold', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.5px' }}>
                  {idx + 1}
                </td>
                <td style={{
                  borderRight: BORDER_INNER,
                  textAlign: 'left',
                  padding: `${mm(0.2)} ${mm(1)}`,
                  verticalAlign: 'middle',
                  overflow: 'hidden',
                }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10.2px', lineHeight: 1.18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  {item.manufacturer && (
                    <div style={{ fontSize: '8.2px', fontWeight: 600, color: '#222', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Mfg: {item.manufacturer}
                    </div>
                  )}
                </td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontFamily: 'monospace', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.5px' }}>{item.hsn}</td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '9.5px' }}>{item.batch}</td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.2px' }}>{item.expiry}</td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '10px' }}>
                  {typeof item.quantity === 'number' ? (Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)) : item.quantity}
                </td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'right', fontFamily: 'monospace', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.8px' }}>{item.rate.toFixed(2)}</td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.8px' }}>{item.gstRate.toFixed(2)}</td>
                <td style={{ borderRight: BORDER_INNER, textAlign: 'right', fontFamily: 'monospace', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '9.8px' }}>{item.rateWithGst.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', padding: `${mm(0.2)} ${mm(0.5)}`, verticalAlign: 'middle', fontSize: '10.8px' }}>{item.total.toFixed(2)}</td>
              </tr>
            ))}
            {/* Empty rows to fill remaining space */}
            {emptyRowsCount > 0 && Array.from({ length: emptyRowsCount }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ height: mm(ROW_HEIGHT_MM), borderBottom: i < emptyRowsCount - 1 ? BORDER_INNER : 'none' }}>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td style={{ borderRight: BORDER_INNER }}>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════════════════
          4. TOTALS – 7.5 mm
          ════════════════════════════════════════════════════════ */}
      <div style={{
        height: mm(H_TOTALS),
        borderTop: BORDER_MAJOR,
        borderBottom: BORDER_MAJOR,
        display: 'flex',
        boxSizing: 'border-box',
      }}>
        {/* Taxable (20%) */}
        <div style={{
          width: '20%',
          borderRight: BORDER_INNER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${mm(1.5)}`,
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: '9.2px', fontWeight: 'bold', textTransform: 'uppercase' }}>Taxable</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '10.5px' }}>₹ {taxableTotal.toFixed(2)}</span>
        </div>
        {/* CGST (14%) */}
        <div style={{
          width: '14%',
          borderRight: BORDER_INNER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${mm(1.5)}`,
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: '9.2px', fontWeight: 'bold', textTransform: 'uppercase' }}>CGST</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '10.5px' }}>₹ {cgstTotal.toFixed(2)}</span>
        </div>
        {/* SGST (27%) */}
        <div style={{
          width: '27%',
          borderRight: BORDER_INNER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${mm(1.5)}`,
          boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: '9.2px', fontWeight: 'bold', textTransform: 'uppercase' }}>SGST</span>
          <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '10.5px' }}>₹ {sgstTotal.toFixed(2)}</span>
        </div>
        {/* Net Total (39%) */}
        <div style={{
          width: '39%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${mm(3)}`,
          boxSizing: 'border-box',
        }}>
          <span style={{ fontWeight: 900, fontSize: '12px', textTransform: 'uppercase' }}>Net total</span>
          <span style={{ fontWeight: 900, fontFamily: 'monospace', fontSize: '15px' }}>₹ {netTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          5. BOTTOM SECTION – 29 mm
          ════════════════════════════════════════════════════════ */}
      <div style={{
        height: mm(H_BOTTOM),
        display: 'flex',
        boxSizing: 'border-box',
        borderBottom: BORDER_MAJOR,
      }}>
        {/* 5A – Bank Details (33%) */}
        <div style={{
          width: '33%',
          borderRight: BORDER_MAJOR,
          padding: `${mm(1)} ${mm(2)}`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '10.5px', marginBottom: mm(0.5) }}>Bank details</div>
          <table style={{ width: '100%', fontSize: '9.2px', lineHeight: 1.35, borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: mm(18), fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>Bank Name</td>
                <td style={{ width: mm(2), fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top', fontSize: '9.5px' }}>{shop.bankName || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>A/C No</td>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', padding: '0.2px 0', verticalAlign: 'top', fontSize: '10.5px' }}>{shop.accountNumber || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>IFSC Code</td>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 'bold', fontFamily: 'monospace', padding: '0.2px 0', verticalAlign: 'top', fontSize: '10px' }}>{shop.ifsc || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>Branch</td>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 600, padding: '0.2px 0', verticalAlign: 'top', fontSize: '9.2px' }}>{shop.branch || '-'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>A/C Type</td>
                <td style={{ fontWeight: 'bold', padding: '0.2px 0', verticalAlign: 'top' }}>:</td>
                <td style={{ fontWeight: 600, padding: '0.2px 0', verticalAlign: 'top', fontSize: '9.2px' }}>{shop.accountType || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 5B – Amount in words + Ledger (28%) */}
        <div style={{
          width: '28%',
          borderRight: BORDER_MAJOR,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}>
          {/* Amount in words */}
          <div style={{
            flex: '0 0 48%',
            borderBottom: BORDER_INNER,
            padding: `${mm(1)} ${mm(2)}`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '9.8px', marginBottom: mm(0.3) }}>Amount in words</div>
            <div style={{
              fontWeight: 'bold',
              fontSize: '9.2px',
              fontStyle: 'italic',
              textTransform: 'capitalize',
              lineHeight: 1.25,
              overflow: 'hidden',
            }}>
              {cleanWords}
            </div>
          </div>
          {/* Ledger / balance */}
          <div style={{
            flex: 1,
            padding: `${mm(1)} ${mm(2)}`,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>
            <table style={{ width: '100%', fontSize: '9.2px', lineHeight: 1.35, borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '0.2px 0' }}>Opening Bal</td>
                  <td style={{ width: mm(2), fontWeight: 'bold', padding: '0.2px 0' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', padding: '0.2px 0', fontSize: '9.8px' }}>₹ {openingBal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '0.2px 0' }}>Dr invoice</td>
                  <td style={{ fontWeight: 'bold', padding: '0.2px 0' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', padding: '0.2px 0', fontSize: '9.8px' }}>₹ {drInvoice.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '0.2px 0' }}>Closing balance</td>
                  <td style={{ fontWeight: 'bold', padding: '0.2px 0' }}>:</td>
                  <td style={{ fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right', padding: '0.2px 0', fontSize: '9.8px' }}>₹ {closingBalance.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 5C + 5D – Signatures (39%) */}
        <div style={{
          width: '39%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: `${mm(1)} ${mm(2)}`,
          position: 'relative',
        }}>
          {/* Shop name top-right */}
          <div style={{
            textAlign: 'right',
            paddingRight: mm(2),
          }}>
            <span style={{
              fontWeight: 900,
              fontSize: '11.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.2px',
            }}>
              {shop.authorizedSignatory || shop.shopName || ''}
            </span>
          </div>

          {/* Signatures at bottom */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flex: 1,
            paddingBottom: mm(0.5),
          }}>
            <span style={{ fontWeight: 'bold', fontSize: '9.5px' }}>Customer sign</span>
            <span style={{ fontWeight: 'bold', fontSize: '9.5px', paddingRight: mm(2) }}>Authorized Sign</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          6. FOOTER – 4.5 mm
          ════════════════════════════════════════════════════════ */}
      <div style={{
        height: mm(H_FOOTER),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `0 ${mm(2)}`,
        fontSize: '8.5px',
        fontWeight: 'bold',
        boxSizing: 'border-box',
      }}>
        <span>THIS IS COMPUTER GENERATED TAX INVOICE</span>
        <span>SUBJECT TO {shop.district ? shop.district.toUpperCase() : (shop.state ? shop.state.toUpperCase() : 'LOCAL')} JURISDICTION</span>
        <span>PAGE 1 OF 1</span>
      </div>
    </div>
  </div>
  );
}

/* ================================================================
   PRINT / PDF UTILITIES
   ================================================================ */

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

  const invoiceHtml = element.classList.contains('invoice-page')
    ? element.outerHTML
    : `<div class="invoice-page" style="width: 210mm; height: 148mm; display: flex; align-items: center; justify-content: center; box-sizing: border-box; margin: 0; padding: 0;">${element.outerHTML}</div>`;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>TAX INVOICE</title>
        ${styles}
        <style>
          @page {
            size: A5 landscape !important;
            margin: 0 !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            width: 210mm !important;
            height: 148mm !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }
          .invoice-page {
            width: 210mm !important;
            height: 148mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background-color: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #printable-tax-invoice,
          .invoice {
            width: 204mm !important;
            height: 142mm !important;
            margin: 0 auto !important;
            position: relative !important;
            box-sizing: border-box !important;
            background-color: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        ${invoiceHtml}
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
