import { parseScannedBarcode } from './barcode-parser';
import { formatProductNameWithSize } from '@/lib/validations';

export interface BillingScanLookupResult {
  found: boolean;
  product?: any;
  selectedBatch?: any;
  isOutOfStock?: boolean;
  isExpired?: boolean;
  availableStock?: number;
  reason?: 'NOT_FOUND' | 'OUT_OF_STOCK' | 'EXPIRED' | 'SUCCESS';
  identifier?: string;
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export interface ExtractedLookupCodes {
  primaryCode: string;
  searchCodes: string[];
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string;
}

/**
 * Extracts normalized search candidates and GS1 details from any scanned barcode/QR.
 * Local-first: zero network calls, zero OCR, zero manufacturer URL fetch.
 */
export function extractBillingLookupCodes(rawValue: string): ExtractedLookupCodes {
  const cleanRaw = (rawValue || '').trim();
  if (!cleanRaw) {
    return { primaryCode: '', searchCodes: [] };
  }

  // Parse GS1 / URL GS1 / Barcode / Structured QR
  const parsed = parseScannedBarcode(cleanRaw);
  const primary = (parsed.gtin || parsed.barcode || cleanRaw).trim();

  const codesSet = new Set<string>();
  codesSet.add(cleanRaw);
  if (primary) codesSet.add(primary);
  if (parsed.gtin) codesSet.add(parsed.gtin);
  if (parsed.barcode) codesSet.add(parsed.barcode);

  // Handle GTIN-14 vs GTIN-13 / EAN-13 (leading zeros)
  for (const c of Array.from(codesSet)) {
    if (c.startsWith('0') && c.length > 1) {
      codesSet.add(c.replace(/^0+/, ''));
    }
    if (/^\d{12,13}$/.test(c)) {
      codesSet.add(c.padStart(14, '0'));
    }
  }

  return {
    primaryCode: primary || cleanRaw,
    searchCodes: Array.from(codesSet).filter(Boolean),
    gtin: parsed.gtin,
    batchNumber: parsed.batchNumber,
    expiryDate: parsed.expiryDate || parsed.expiryDateDB,
  };
}

/**
 * Matches a scanned barcode/GTIN against local product inventory and selects the appropriate stock batch.
 * Strictly local-first and stock/expiry aware.
 */
export function matchBillingProductStock(
  products: any[],
  scannedRaw: string,
  explicitBatchNumber?: string
): BillingScanLookupResult {
  const { primaryCode, searchCodes, gtin, batchNumber: extractedBatch, expiryDate } = extractBillingLookupCodes(scannedRaw);
  const targetBatch = explicitBatchNumber || extractedBatch;

  if (!Array.isArray(products) || products.length === 0 || searchCodes.length === 0) {
    return {
      found: false,
      reason: 'NOT_FOUND',
      identifier: primaryCode || scannedRaw,
      gtin,
      batchNumber: targetBatch,
      expiryDate,
    };
  }

  // 1. Exact match search on barcode, SKU, or GTIN
  const matchedProduct = products.find((p: any) => {
    const pBarcode = (p.barcode || '').trim();
    const pSku = (p.sku || '').trim();
    const pGtin = (p.gtin || '').trim();
    
    // Check main product barcode / sku / gtin
    if (searchCodes.some(code => code === pBarcode || code === pSku || code === pGtin)) {
      return true;
    }

    // Check if any product batch has matching barcode
    if (Array.isArray(p.batches) && p.batches.length > 0) {
      return p.batches.some((b: any) => {
        const bCode = (b.barcode || '').trim();
        return searchCodes.some(code => code === bCode);
      });
    }

    return false;
  });

  if (!matchedProduct) {
    return {
      found: false,
      reason: 'NOT_FOUND',
      identifier: primaryCode || scannedRaw,
      gtin,
      batchNumber: targetBatch,
      expiryDate,
    };
  }

  // 2. Stock and Batch Resolution
  const totalStock = Number(
    matchedProduct.current_stock ??
    matchedProduct.stock_quantity ??
    matchedProduct.opening_stock ??
    0
  );

  const allBatches: any[] = Array.isArray(matchedProduct.batches) ? matchedProduct.batches : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let selectedBatch: any = null;

  // Case A: Barcode/QR explicitly provided a batch number (e.g. GS1 AI 10)
  if (targetBatch && allBatches.length > 0) {
    const exactBatch = allBatches.find(
      (b: any) => (b.batch_number || '').trim().toUpperCase() === targetBatch.trim().toUpperCase()
    );

    if (exactBatch) {
      selectedBatch = exactBatch;
      const batchQty = Number(exactBatch.quantity_available ?? exactBatch.stock_quantity ?? 0);
      const expStr = exactBatch.expiry_date || exactBatch.exp_date;
      const isExpired = expStr ? new Date(expStr) < today : false;

      if (isExpired) {
        return {
          found: true,
          product: matchedProduct,
          selectedBatch: exactBatch,
          isExpired: true,
          isOutOfStock: false,
          availableStock: batchQty,
          reason: 'EXPIRED',
          identifier: primaryCode,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
        };
      }

      if (batchQty <= 0) {
        return {
          found: true,
          product: matchedProduct,
          selectedBatch: exactBatch,
          isOutOfStock: true,
          availableStock: 0,
          reason: 'OUT_OF_STOCK',
          identifier: primaryCode,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
        };
      }
    }
  }

  // Case B: No batch encoded OR batch not found in batches list -> FEFO stock selection
  if (!selectedBatch && allBatches.length > 0) {
    // Strict FEFO (First Expired, First Out)
    const eligibleBatches = allBatches
      .filter((b: any) => {
        const isActive = b.is_active !== false;
        const qty = Number(b.quantity_available ?? b.stock_quantity ?? 0);
        const expStr = b.expiry_date || b.exp_date;
        const isNotExpired = !expStr || new Date(expStr) >= today;
        return isActive && qty > 0 && isNotExpired;
      })
      .sort((a: any, b: any) => {
        const expA = a.expiry_date || a.exp_date;
        const expB = b.expiry_date || b.exp_date;
        if (expA && expB) {
          return new Date(expA).getTime() - new Date(expB).getTime();
        }
        if (expA) return -1;
        if (expB) return 1;
        return 0;
      });

    if (eligibleBatches.length > 0) {
      selectedBatch = eligibleBatches[0];
    } else {
      // Check if all batches are expired or 0 stock
      const hasStock = allBatches.some((b: any) => Number(b.quantity_available ?? b.stock_quantity ?? 0) > 0);
      if (!hasStock || totalStock <= 0) {
        return {
          found: true,
          product: matchedProduct,
          isOutOfStock: true,
          availableStock: 0,
          reason: 'OUT_OF_STOCK',
          identifier: primaryCode,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
        };
      }
      return {
        found: true,
        product: matchedProduct,
        isExpired: true,
        availableStock: 0,
        reason: 'EXPIRED',
        identifier: primaryCode,
        gtin,
        batchNumber: targetBatch,
        expiryDate,
      };
    }
  }

  // Fallback stock check if product doesn't have batch tracking
  const availableStock = selectedBatch
    ? Number(selectedBatch.quantity_available ?? selectedBatch.stock_quantity ?? 0)
    : totalStock;

  if (availableStock <= 0) {
    return {
      found: true,
      product: matchedProduct,
      selectedBatch,
      isOutOfStock: true,
      availableStock: 0,
      reason: 'OUT_OF_STOCK',
      identifier: primaryCode,
      gtin,
      batchNumber: targetBatch,
      expiryDate,
    };
  }

  return {
    found: true,
    product: matchedProduct,
    selectedBatch,
    isOutOfStock: false,
    availableStock,
    reason: 'SUCCESS',
    identifier: primaryCode,
    gtin,
    batchNumber: selectedBatch?.batch_number || targetBatch,
    expiryDate: selectedBatch?.expiry_date || expiryDate,
  };
}

/**
 * Builds the standard Billing Cart Item from a matched product and batch.
 */
export function buildBillingCartItem(match: BillingScanLookupResult): any {
  if (!match.found || !match.product) return null;

  const product = match.product;
  const activeBatch = match.selectedBatch;
  const allBatches: any[] = Array.isArray(product.batches) ? product.batches : [];
  const prodFullName = formatProductNameWithSize(product.name, product.pack_size, product.unit);

  return {
    product_id: product.id,
    product: product,
    product_name: prodFullName,
    batch_id: activeBatch?.id || null,
    batch_number: activeBatch?.batch_number || product.batch_number || null,
    expiry_date: activeBatch?.expiry_date || activeBatch?.exp_date || product.expiry_date || null,
    batches: allBatches,
    hsn_code: product.hsn_code || product.hsnCode || null,
    manufacturer: product.manufacturer || product.brand?.manufacturer || product.brand?.name || product.brand || '',
    unit: product.unit || undefined,
    pack_size: product.pack_size || undefined,
    product_size_value: product.product_size_value ?? undefined,
    product_size_unit: product.product_size_unit ?? undefined,
    quantity: 1,
    rate: Number(activeBatch?.selling_price ?? product.selling_price ?? 0),
    gst_rate: Number(product.gst_rate ?? 0),
    discount: 0,
    available_stock: match.availableStock ?? 0,
  };
}
