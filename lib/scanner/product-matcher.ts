import { ProductScanResult } from './types';
import { isClientDemoMode, getDemoProductsClient } from '@/lib/client-demo-store';
import { getProductByBarcodeAction, searchProductsAction } from '@/actions/products';
import { mergeProductScanResults } from './source-merger';

/**
 * Searches the KRUSHI OS product database (in-memory demo store or Supabase backend)
 * to match an existing product by scanned barcode or GTIN.
 */
export async function matchScannedProduct(scanResult: ProductScanResult): Promise<ProductScanResult> {
  const searchCodes = [
    scanResult.gtin,
    scanResult.barcode,
    scanResult.rawValue,
    scanResult.gtin && scanResult.gtin.startsWith('0') ? scanResult.gtin.slice(1) : undefined,
  ].filter((c): c is string => Boolean(c && c.trim()));

  if (searchCodes.length === 0) {
    return scanResult;
  }

  // 1. Client Demo Mode lookup
  if (isClientDemoMode()) {
    const demoProducts = getDemoProductsClient();
    let found = demoProducts.find(p =>
      p.is_active !== false &&
      searchCodes.some(code => p.barcode === code || p.sku === code || (p.barcode && p.barcode.endsWith(code)))
    );

    if (found) {
      return enrichWithDbProduct(scanResult, found);
    }
    return {
      ...scanResult,
      existingProductFound: false,
      matchedExistingProduct: false,
    };
  }

  // 2. Server Action / Supabase DB lookup
  try {
    for (const code of searchCodes) {
      const res = await getProductByBarcodeAction(code);
      if (res.success && res.data) {
        return enrichWithDbProduct(scanResult, res.data);
      }
    }

    // Fallback: search by code
    for (const code of searchCodes) {
      if (code.length >= 4) {
        const searchRes = await searchProductsAction(code);
        if (searchRes.success && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const exact = searchRes.data.find(p =>
            p.barcode === code || p.sku === code || (p.barcode && p.barcode.includes(code))
          );
          if (exact) {
            return enrichWithDbProduct(scanResult, exact);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error looking up product in Krushi OS:', err);
  }

  return {
    ...scanResult,
    existingProductFound: false,
    matchedExistingProduct: false,
  };
}

/**
 * Creates a database-sourced ProductScanResult and merges it with scanResult using field-specific priority.
 */
function enrichWithDbProduct(scanResult: ProductScanResult, product: any): ProductScanResult {
  const brandName = product.brand?.name || product.brand?.manufacturer || product.brand_id;
  const categoryName = product.category?.name || product.category_id;

  const dbResult: ProductScanResult = {
    rawValue: scanResult.rawValue,
    format: scanResult.format,
    source: 'database',
    matchedProductId: product.id,
    matchedExistingProduct: true,
    existingProductFound: true,
    matchedProduct: product,
    productName: product.name,
    brand: brandName,
    manufacturer: brandName,
    category: categoryName,
    categoryId: product.category_id,
    sku: product.sku,
    barcode: product.barcode,
    hsnCode: product.hsn_code,
    gstRate: product.gst_rate,
    packSize: product.pack_size,
    sizeValue: product.product_size_value,
    sizeUnit: product.product_size_unit,
    purchasePrice: product.purchase_price,
    sellingPrice: product.selling_price,
    detectedFields: [],
    fieldSources: {},
  };

  const detected: string[] = [];
  const fieldSources: Record<string, 'database'> = {};
  [
    'productName', 'brand', 'manufacturer', 'category', 'categoryId',
    'sku', 'barcode', 'hsnCode', 'gstRate', 'packSize', 'sizeValue',
    'sizeUnit', 'purchasePrice', 'sellingPrice'
  ].forEach((k) => {
    if ((dbResult as any)[k] !== undefined && (dbResult as any)[k] !== null && (dbResult as any)[k] !== '') {
      detected.push(k);
      fieldSources[k] = 'database';
    }
  });

  dbResult.detectedFields = detected;
  dbResult.fieldSources = fieldSources;

  const merged = mergeProductScanResults([scanResult, dbResult]);
  merged.matchedProductId = product.id;
  merged.matchedExistingProduct = true;
  merged.existingProductFound = true;
  merged.matchedProduct = product;

  return merged;
}
