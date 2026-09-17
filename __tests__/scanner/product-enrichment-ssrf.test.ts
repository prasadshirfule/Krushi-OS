import assert from 'node:assert';
import {
  isPrivateOrReservedHost,
  validateSafePublicUrl,
  extractProductMetadataFromHtml,
  isBotChallengePage,
  normalizeComposition,
} from '../../services/product-enrichment.service';
import {
  isTrustedManufacturerHost,
  ManufacturerSourceResolver,
} from '../../services/manufacturer-resolver.service';
import { parseScannedBarcode } from '../../lib/scanner/barcode-parser';
import { mergeProductScanResults } from '../../lib/scanner/source-merger';
import { ProductScanResult } from '../../lib/scanner/types';

console.log('--- Testing Product Enrichment & Official Manufacturer Discovery (V2) ---');

const realSyngentaUrl = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';

// 1. Direct Digital Link Parsing: GS1 Authoritative Identifiers
const gs1Scan = parseScannedBarcode(realSyngentaUrl, 'QR_CODE');
assert.strictEqual(gs1Scan.source, 'gs1');
assert.strictEqual(gs1Scan.gtin, '08904232801980');
assert.strictEqual(gs1Scan.batchNumber, 'SPL6A20014');
assert.strictEqual(gs1Scan.serialNumber, 'U2DFSHLAEX');
assert.strictEqual(gs1Scan.manufacturingDate, '2026-01-29');
assert.strictEqual(gs1Scan.expiryDate, '28/01/2028');
assert.strictEqual(gs1Scan.expiryDateDB, '2028-01-28');
assert.strictEqual(gs1Scan.sourceUrl, realSyngentaUrl);
console.log('✓ Test 1: Direct Digital Link extracts authoritative GS1 fields');

// 2. Official Evicent Manufacturer HTML Fixture
const officialEvicentHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Evicent | Syngenta</title>
  <meta property="og:title" content="Evicent" />
  <meta property="og:description" content="Evicent is a combination of Emamectin benzoate and Lufenuron which provides dual action control against key lepidopteran pests." />
</head>
<body>
  <h1>Evicent</h1>
  <div class="field field--name-field-product-category">
    <div class="field__label">Category</div>
    <div class="field__item">Insecticide</div>
  </div>
  <div class="field field--name-field-registrant">
    <div class="field__label">Registrant</div>
    <div class="field__item">Syngenta India Ltd</div>
  </div>
  <div class="field field--name-field-pack-sizes">
    <div class="field__label">Pack sizes</div>
    <div class="field__item">5 gms, 24 gm, 60 gms, 120 gms</div>
  </div>
  <div class="field field--name-field-composition">
    <div class="field__label">Composition</div>
    <div class="field__item">5% w/w Emamectin benzoate + 40% w/w WG Lufenuron</div>
  </div>
  <a href="https://www.syngenta.co.in/sites/g/files/zhg411/f/evicent_label_leaflet.pdf" class="product-leaflet-link">Product Label Leaflet (PDF)</a>
</body>
</html>
`;

const extractedOfficial = extractProductMetadataFromHtml(
  officialEvicentHtml,
  'https://www.syngenta.co.in/product/crop-protection/evicent'
);

// 3. Official Evicent Page: Product Name Extracted
assert.strictEqual(extractedOfficial.productName, 'Evicent');
console.log('✓ Test 3: Official Evicent page extracts product name');

// 4. Official Evicent Page: Manufacturer Extracted
assert.strictEqual(extractedOfficial.manufacturer, 'Syngenta India Ltd');
console.log('✓ Test 4: Official Evicent page extracts manufacturer');

// 5. Official Evicent Page: Category Extracted
assert.strictEqual(extractedOfficial.category, 'Insecticide');
console.log('✓ Test 5: Official Evicent page extracts category');

// 6. Official Evicent Page: Composition Normalized
assert.strictEqual(extractedOfficial.composition, 'Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG');
console.log('✓ Test 6: Official Evicent page extracts and normalizes composition');

// 7. Multiple Pack Sizes: Remains Unresolved Unless Exact GTIN Mapping Exists
assert.strictEqual(
  extractedOfficial.packSize,
  undefined,
  'Multiple pack sizes (5g, 24g, 60g, 120g) must remain unresolved on product page without GTIN binding'
);
console.log('✓ Test 7: Multiple pack sizes correctly remain unresolved');

// 8. MRP: Not Inferred
assert.strictEqual(extractedOfficial.mrp, undefined, 'MRP must remain unresolved when not published');
console.log('✓ Test 8: MRP is not inferred or fabricated');

// 9. HSN: Not Inferred
assert.strictEqual(extractedOfficial.hsnCode, undefined, 'HSN must not be inferred from category');
console.log('✓ Test 9: HSN is not inferred');

// 10. GST: Not Inferred
assert.strictEqual(extractedOfficial.gstRate, undefined, 'GST must not be inferred from category');
console.log('✓ Test 10: GST is not inferred');

// 11. Manufacturer Provenance & Field-Level Merge
const officialWebResult: ProductScanResult = {
  rawValue: realSyngentaUrl,
  format: 'QR_CODE',
  source: 'manufacturer_url',
  ...extractedOfficial,
};
const mergedOfficial = mergeProductScanResults([gs1Scan, officialWebResult]);

assert.strictEqual(mergedOfficial.productName, 'Evicent');
assert.strictEqual(mergedOfficial.fieldSources?.['productName'], 'manufacturer_url');
assert.strictEqual(mergedOfficial.manufacturer, 'Syngenta India Ltd');
assert.strictEqual(mergedOfficial.fieldSources?.['manufacturer'], 'manufacturer_url');
assert.strictEqual(mergedOfficial.category, 'Insecticide');
assert.strictEqual(mergedOfficial.fieldSources?.['category'], 'manufacturer_url');
assert.strictEqual(mergedOfficial.composition, 'Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG');
assert.strictEqual(mergedOfficial.fieldSources?.['composition'], 'manufacturer_url');
console.log('✓ Test 11: Manufacturer fields assigned [MANUFACTURER] provenance');

// 12. GS1 Identifiers Retain [GS1] Dominance
assert.strictEqual(mergedOfficial.gtin, '08904232801980');
assert.strictEqual(mergedOfficial.fieldSources?.['gtin'], 'gs1');
assert.strictEqual(mergedOfficial.batchNumber, 'SPL6A20014');
assert.strictEqual(mergedOfficial.fieldSources?.['batchNumber'], 'gs1');
assert.strictEqual(mergedOfficial.serialNumber, 'U2DFSHLAEX');
assert.strictEqual(mergedOfficial.fieldSources?.['serialNumber'], 'gs1');
assert.strictEqual(mergedOfficial.manufacturingDate, '2026-01-29');
assert.strictEqual(mergedOfficial.expiryDate, '28/01/2028');
console.log('✓ Test 12: GS1 identifiers retain [GS1] provenance');

// 13. Untrusted Third-Party Host Rejection
assert.strictEqual(isTrustedManufacturerHost('https://agriblog.com/evicent', 'syngenta.co.in'), false);
assert.strictEqual(isTrustedManufacturerHost('https://amazon.in/dp/B000', 'syngenta.co.in'), false);
assert.strictEqual(isTrustedManufacturerHost('https://indiamart.com/proddetail', 'syngenta.co.in'), false);
assert.strictEqual(isTrustedManufacturerHost('https://www.syngenta.co.in/product/evicent', 'syngenta.co.in'), true);
console.log('✓ Test 13: Untrusted third-party hosts strictly rejected');

// 14. SSRF & Redirect to Unrelated Domain Rejection
assert.strictEqual(validateSafePublicUrl('http://syngenta.co.in/evicent').isValid, false);
assert.strictEqual(validateSafePublicUrl('https://127.0.0.1/api').isValid, false);
assert.strictEqual(validateSafePublicUrl('https://169.254.169.254/latest/meta-data/').isValid, false);
console.log('✓ Test 14: SSRF & unsafe protocols rejected');

// 15. Cloudflare Challenge Handling (Does Not Crash, Gracefully Fallback)
const cfChallenge = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Turnstile challenge</body></html>';
assert.strictEqual(isBotChallengePage(cfChallenge), true);
const cfFallback = extractProductMetadataFromHtml(cfChallenge, realSyngentaUrl);
assert.notStrictEqual(cfFallback.productName, 'Just a moment...');
assert.strictEqual(cfFallback.manufacturer, 'Syngenta India Ltd');
console.log('✓ Test 15: Cloudflare challenge handled gracefully without crash or corrupted product name');

// 16. GS1 Data Remains Intact when Enrichment Fails
const failedEnrichmentFallback = extractProductMetadataFromHtml('', realSyngentaUrl);
const fallbackMerged = mergeProductScanResults([
  gs1Scan,
  {
    rawValue: realSyngentaUrl,
    format: 'QR_CODE',
    source: 'manufacturer_url',
    ...failedEnrichmentFallback,
  },
]);
assert.strictEqual(fallbackMerged.gtin, '08904232801980');
assert.strictEqual(fallbackMerged.batchNumber, 'SPL6A20014');
assert.strictEqual(fallbackMerged.fieldSources?.['batchNumber'], 'gs1');
console.log('✓ Test 16: GS1 data remains completely intact when manufacturer enrichment fails');

console.log('All 16 Product Enrichment & Official Manufacturer Discovery tests passed successfully!\n');
