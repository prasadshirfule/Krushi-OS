import assert from 'node:assert';
import {
  isPrivateOrReservedHost,
  validateSafePublicUrl,
  extractProductMetadataFromHtml,
} from '../../services/product-enrichment.service';
import { parseScannedBarcode } from '../../lib/scanner/barcode-parser';
import { mergeProductScanResults } from '../../lib/scanner/source-merger';
import { ProductScanResult } from '../../lib/scanner/types';

console.log('--- Testing Product Enrichment & GS1 Digital Link Pipeline ---');

// 1. Test SSRF Host Protection
assert.strictEqual(isPrivateOrReservedHost('localhost'), true);
assert.strictEqual(isPrivateOrReservedHost('127.0.0.1'), true);
assert.strictEqual(isPrivateOrReservedHost('127.1.2.3'), true);
assert.strictEqual(isPrivateOrReservedHost('0.0.0.0'), true);
assert.strictEqual(isPrivateOrReservedHost('10.0.0.1'), true);
assert.strictEqual(isPrivateOrReservedHost('10.255.255.255'), true);
assert.strictEqual(isPrivateOrReservedHost('172.16.0.1'), true);
assert.strictEqual(isPrivateOrReservedHost('172.31.255.255'), true);
assert.strictEqual(isPrivateOrReservedHost('192.168.1.1'), true);
assert.strictEqual(isPrivateOrReservedHost('169.254.169.254'), true);
assert.strictEqual(isPrivateOrReservedHost('::1'), true);
assert.strictEqual(isPrivateOrReservedHost('service.internal'), true);
assert.strictEqual(isPrivateOrReservedHost('dev.local'), true);

assert.strictEqual(isPrivateOrReservedHost('syngenta.co.in'), false);
assert.strictEqual(isPrivateOrReservedHost('bayer.com'), false);
assert.strictEqual(isPrivateOrReservedHost('upl-ltd.com'), false);
assert.strictEqual(isPrivateOrReservedHost('example.com'), false);
assert.strictEqual(isPrivateOrReservedHost('8.8.8.8'), false);
console.log('✓ Test 1: SSRF host/IP checks pass');

// 2. Test URL Validation
assert.strictEqual(validateSafePublicUrl('http://syngenta.co.in/product').isValid, false, 'Non-HTTPS must be rejected');
assert.strictEqual(validateSafePublicUrl('file:///etc/passwd').isValid, false, 'file:// protocol must be rejected');
assert.strictEqual(validateSafePublicUrl('javascript:alert(1)').isValid, false, 'javascript: protocol must be rejected');
assert.strictEqual(validateSafePublicUrl('data:text/html,abc').isValid, false, 'data: protocol must be rejected');
assert.strictEqual(validateSafePublicUrl('https://localhost/api').isValid, false, 'Localhost HTTPS must be rejected');
assert.strictEqual(validateSafePublicUrl('https://192.168.1.1/product').isValid, false, 'Private IP HTTPS must be rejected');
assert.strictEqual(validateSafePublicUrl('https://syngenta.co.in:8080/product').isValid, false, 'Non-standard port must be rejected');

const realSyngentaUrl = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
assert.strictEqual(validateSafePublicUrl(realSyngentaUrl).isValid, true, 'Public HTTPS Syngenta URL must be valid');
console.log('✓ Test 2: URL SSRF validator pass');

// 3. Test GS1 Digital Link Parsing from Syngenta Evicent QR
const gs1Scan = parseScannedBarcode(realSyngentaUrl, 'QR_CODE');
assert.strictEqual(gs1Scan.source, 'gs1');
assert.strictEqual(gs1Scan.gtin, '08904232801980');
assert.strictEqual(gs1Scan.batchNumber, 'SPL6A20014');
assert.strictEqual(gs1Scan.serialNumber, 'U2DFSHLAEX');
assert.strictEqual(gs1Scan.expiryDate, '28/01/2028');
assert.strictEqual(gs1Scan.expiryDateDB, '2028-01-28');
assert.strictEqual(gs1Scan.sourceUrl, realSyngentaUrl);
console.log('✓ Test 3: GS1 Digital Link parse pass');

// 4. Test HTML Metadata Extraction (Generic Agricultural Manufacturer Page)
const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Evicent Insecticide | Syngenta India</title>
  <meta property="og:title" content="Evicent" />
  <meta property="og:description" content="Broad spectrum lepidoptera insecticide" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Evicent",
    "brand": {
      "@type": "Brand",
      "name": "Syngenta"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "Syngenta India Ltd"
    },
    "description": "Evicent is a broad spectrum insecticide for crops.",
    "gtin13": "08904232801980",
    "category": "Insecticide",
    "offers": {
      "@type": "Offer",
      "price": "1569.00",
      "priceCurrency": "INR"
    }
  }
  </script>
</head>
<body>
  <h1>Evicent</h1>
  <div class="product-details">
    <p><strong>Active Ingredient:</strong> Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG</p>
    <p><strong>Pack Sizes:</strong> 60 g, 100 g, 250 g</p>
    <p><strong>Registrant:</strong> Syngenta India Ltd</p>
    <p><strong>Category:</strong> Insecticide</p>
  </div>
</body>
</html>
`;

const extracted = extractProductMetadataFromHtml(mockHtml, realSyngentaUrl);
assert.strictEqual(extracted.productName, 'Evicent');
assert.strictEqual(extracted.brand, 'Syngenta');
assert.strictEqual(extracted.manufacturer, 'Syngenta India Ltd');
assert.strictEqual(extracted.category, 'Insecticide');
assert.strictEqual(extracted.gtin, '08904232801980');
assert.strictEqual(extracted.mrp, 1569.0);
assert.strictEqual(extracted.composition, 'Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG');
assert.strictEqual(extracted.packSize, '60 g');
console.log('✓ Test 4: Agricultural Manufacturer HTML extraction pass');

// 5. Test GS1 + Manufacturer URL Merge Priority
const manufacturerResult: ProductScanResult = {
  rawValue: realSyngentaUrl,
  format: 'QR_CODE',
  source: 'manufacturer_url',
  ...extracted,
};

const merged = mergeProductScanResults([gs1Scan, manufacturerResult]);
// GS1 must remain authoritative for GTIN, Batch, Serial, Mfg, Expiry
assert.strictEqual(merged.gtin, '08904232801980');
assert.strictEqual(merged.fieldSources?.['gtin'], 'gs1');
assert.strictEqual(merged.batchNumber, 'SPL6A20014');
assert.strictEqual(merged.fieldSources?.['batchNumber'], 'gs1');
assert.strictEqual(merged.serialNumber, 'U2DFSHLAEX');
assert.strictEqual(merged.fieldSources?.['serialNumber'], 'gs1');
assert.strictEqual(merged.expiryDate, '28/01/2028');
assert.strictEqual(merged.expiryDateDB, '2028-01-28');

// Manufacturer Page provides Product Name, Manufacturer, Composition, Pack Size, Category
assert.strictEqual(merged.productName, 'Evicent');
assert.strictEqual(merged.fieldSources?.['productName'], 'manufacturer_url');
assert.strictEqual(merged.manufacturer, 'Syngenta India Ltd');
assert.strictEqual(merged.fieldSources?.['manufacturer'], 'manufacturer_url');
assert.strictEqual(merged.composition, 'Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG');
assert.strictEqual(merged.fieldSources?.['composition'], 'manufacturer_url');
assert.strictEqual(merged.packSize, '60 g');
assert.strictEqual(merged.fieldSources?.['packSize'], 'manufacturer_url');
console.log('✓ Test 5: GS1 + Manufacturer merge priority pass');

console.log('All Product Enrichment & GS1 tests passed successfully!\n');
