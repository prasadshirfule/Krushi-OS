import { parseScannedBarcode } from './barcode-parser';
import { formatProductNameWithSize } from '@/lib/validations';

export interface BillingScanLookupResult {
  found: boolean;
  product?: any;
  selectedBatch?: any;
  isOutOfStock?: boolean;
  isExpired?: boolean;
  isAmbiguous?: boolean;
  matchingProducts?: any[];
  availableStock?: number;
  reason?: 'NOT_FOUND' | 'OUT_OF_STOCK' | 'EXPIRED' | 'AMBIGUOUS' | 'SUCCESS';
  identifier?: string;
  gtin?: string;
  batchNumber?: string;
  expiryDate?: string;
  matchLevel?: 'EXACT_RAW' | 'STABLE_IDENTIFIER' | 'IDENTIFIER_PROFILE' | 'BATCH_ASSOCIATION';
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
 * Matches a scanned barcode/GTIN/serialized QR against local product inventory
 * using a strict 4-level matching hierarchy with safety-first ambiguity detection.
 *
 * LEVEL 1 — EXACT RAW MATCH (Fastest, highest priority)
 * LEVEL 2 — NORMALIZED STABLE PRODUCT IDENTIFIER (GTIN, SKU, EAN)
 * LEVEL 3 — STORED PRODUCT IDENTIFIER PROFILE (Proven stable product key)
 * LEVEL 4 — EXISTING BATCH ASSOCIATION (Resolves ONLY when batch uniquely belongs to 1 product)
 */
export function matchBillingProductStock(
  products: any[],
  scannedRaw: string,
  explicitBatchNumber?: string
): BillingScanLookupResult {
  const cleanRawTrimmed = (scannedRaw || '').trim();
  const { primaryCode, searchCodes, gtin, batchNumber: extractedBatch, expiryDate } = extractBillingLookupCodes(cleanRawTrimmed);
  let targetBatch = explicitBatchNumber || extractedBatch;

  if (!Array.isArray(products) || products.length === 0 || !cleanRawTrimmed) {
    return {
      found: false,
      reason: 'NOT_FOUND',
      identifier: primaryCode || cleanRawTrimmed,
      gtin,
      batchNumber: targetBatch,
      expiryDate,
    };
  }

  const activeProducts = products.filter((p: any) => p && p.is_active !== false);
  let matchedProduct: any = null;
  let matchLevel: 'EXACT_RAW' | 'STABLE_IDENTIFIER' | 'IDENTIFIER_PROFILE' | 'BATCH_ASSOCIATION' | undefined;

  // ─────────────────────────────────────────────────────────────
  // LEVEL 1: EXACT RAW MATCH
  // ─────────────────────────────────────────────────────────────
  matchedProduct = activeProducts.find((p: any) => {
    if (Array.isArray(p.identifiers) && p.identifiers.length > 0) {
      return p.identifiers.some((i: any) => (i.raw_value || '').trim() === cleanRawTrimmed);
    }
    return false;
  });

  if (!matchedProduct) {
    matchedProduct = activeProducts.find((p: any) => {
      const pBarcode = (p.barcode || '').trim();
      const pSku = (p.sku || '').trim();
      return pBarcode === cleanRawTrimmed || pSku === cleanRawTrimmed;
    });
  }

  if (matchedProduct) {
    matchLevel = 'EXACT_RAW';
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 2: NORMALIZED STABLE PRODUCT IDENTIFIER (GTIN / SKU / EAN)
  // ─────────────────────────────────────────────────────────────
  if (!matchedProduct) {
    matchedProduct = activeProducts.find((p: any) => {
      // Check registered identifiers for normalized GTIN match
      if (Array.isArray(p.identifiers) && p.identifiers.length > 0) {
        const hasIdentMatch = p.identifiers.some((i: any) => {
          const raw = (i.raw_value || '').trim();
          const norm = (i.normalized_value || '').trim();
          const stableKey = (i.stable_product_key || '').trim();
          if (searchCodes.includes(raw) || (norm && searchCodes.includes(norm))) return true;
          if (stableKey && stableKey.startsWith('gtin:') && searchCodes.includes(stableKey.replace('gtin:', ''))) return true;
          return false;
        });
        if (hasIdentMatch) return true;
      }

      // Check product barcode / SKU / GTIN fields
      const pBarcode = (p.barcode || '').trim();
      const pSku = (p.sku || '').trim();
      const pGtin = (p.gtin || '').trim();
      if (searchCodes.some(code => code === pBarcode || code === pSku || code === pGtin)) {
        return true;
      }

      return false;
    });

    if (matchedProduct) {
      matchLevel = 'STABLE_IDENTIFIER';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 3: STORED PRODUCT IDENTIFIER PROFILE (Proven stable product key)
  // ─────────────────────────────────────────────────────────────
  if (!matchedProduct && gtin) {
    const gtinKey = `gtin:${gtin.trim()}`;
    const level3Matches = activeProducts.filter((p: any) => {
      if (Array.isArray(p.identifiers) && p.identifiers.length > 0) {
        return p.identifiers.some((i: any) => (i.stable_product_key || '').trim() === gtinKey);
      }
      return false;
    });

    if (level3Matches.length === 1) {
      matchedProduct = level3Matches[0];
      matchLevel = 'IDENTIFIER_PROFILE';
    } else if (level3Matches.length > 1) {
      return {
        found: false,
        isAmbiguous: true,
        reason: 'AMBIGUOUS',
        matchingProducts: level3Matches,
        identifier: primaryCode || cleanRawTrimmed,
        gtin,
        batchNumber: targetBatch,
        expiryDate,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // LEVEL 4: EXISTING BATCH ASSOCIATION (Authoritative product_batches check)
  // ─────────────────────────────────────────────────────────────
  if (!matchedProduct) {
    const parsed = parseScannedBarcode(cleanRawTrimmed);
    const candidateBatches = Array.from(
      new Set(
        [targetBatch, parsed.batchNumber, parsed.serialNumber]
          .filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim()))
      )
    );

    for (const cand of candidateBatches) {
      const cleanBatchUpper = cand.trim().toUpperCase();

      // Check authoritative product_batches relationship first
      let batchMatches = activeProducts.filter((p: any) => {
        if (Array.isArray(p.batches) && p.batches.length > 0) {
          return p.batches.some(
            (b: any) => (b.batch_number || '').trim().toUpperCase() === cleanBatchUpper
          );
        }
        return false;
      });

      // If not in product_batches, check supporting product_identifiers metadata
      if (batchMatches.length === 0) {
        batchMatches = activeProducts.filter((p: any) => {
          if (Array.isArray(p.identifiers) && p.identifiers.length > 0) {
            return p.identifiers.some(
              (i: any) => (i.batch_number || '').trim().toUpperCase() === cleanBatchUpper
            );
          }
          return false;
        });
      }

      if (batchMatches.length === 1) {
        // Safely resolved to exactly one product
        matchedProduct = batchMatches[0];
        matchLevel = 'BATCH_ASSOCIATION';
        // Use the matching batch as the effective targetBatch
        if (!targetBatch || targetBatch !== cand) {
          (targetBatch as any) = cand;
        }
        break;
      } else if (batchMatches.length > 1) {
        // Multiple products share this batch: NEVER GUESS -> Return AMBIGUOUS
        return {
          found: false,
          isAmbiguous: true,
          reason: 'AMBIGUOUS',
          matchingProducts: batchMatches,
          identifier: primaryCode || cleanRawTrimmed,
          gtin,
          batchNumber: cand,
          expiryDate,
        };
      }
    }
  }

  // If no product found through any level
  if (!matchedProduct) {
    return {
      found: false,
      reason: 'NOT_FOUND',
      identifier: primaryCode || cleanRawTrimmed,
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
          identifier: primaryCode || cleanRawTrimmed,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
          matchLevel,
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
          identifier: primaryCode || cleanRawTrimmed,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
          matchLevel,
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
          identifier: primaryCode || cleanRawTrimmed,
          gtin,
          batchNumber: targetBatch,
          expiryDate,
          matchLevel,
        };
      }
      return {
        found: true,
        product: matchedProduct,
        isExpired: true,
        availableStock: 0,
        reason: 'EXPIRED',
        identifier: primaryCode || cleanRawTrimmed,
        gtin,
        batchNumber: targetBatch,
        expiryDate,
        matchLevel,
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
      identifier: primaryCode || cleanRawTrimmed,
      gtin,
      batchNumber: targetBatch,
      expiryDate,
      matchLevel,
    };
  }

  return {
    found: true,
    product: matchedProduct,
    selectedBatch,
    isOutOfStock: false,
    availableStock,
    reason: 'SUCCESS',
    identifier: primaryCode || cleanRawTrimmed,
    gtin,
    batchNumber: selectedBatch?.batch_number || targetBatch,
    expiryDate: selectedBatch?.expiry_date || expiryDate,
    matchLevel,
  };
}

/**
 * Builds the standard Billing Cart Item from a matched product and batch.
 */
export function buildBillingCartItem(match: BillingScanLookupResult): any {
  if (!match.found || !match.product || match.isOutOfStock || match.isExpired || match.reason === 'OUT_OF_STOCK' || match.reason === 'EXPIRED') return null;

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
