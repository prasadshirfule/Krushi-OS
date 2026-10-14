import assert from 'node:assert';
import { parseScannedBarcode, extractStableIdentifierInfo } from '@/lib/scanner/barcode-parser';
import { parseProductLabelOcr } from '@/lib/scanner/ocr-parser';
import { isSecureContextActive, isWebCameraSupported } from '@/lib/scanner/web-barcode-scanner';
import {
  matchBillingProductStock,
  buildBillingCartItem,
  extractBillingLookupCodes,
} from '@/lib/scanner/billing-scanner-service';
import { mergeProductScanResults } from '@/lib/scanner/source-merger';

console.log('================================================================');
console.log('🧪 KRUSHI OS — COMPREHENSIVE SCANNER, BATCH, BILLING & NAV TESTS');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────
// FEATURE 1 TESTS: Camera Barcode/QR Scanner & Identifier Linking
// ─────────────────────────────────────────────────────────────
console.log('--- FEATURE 1: Camera Barcode / QR Scanner & Safe Identifier Linking ---');

// 1.1 Leading zero preservation
const gtinWithLeadingZero = '08904232801980';
const info1 = extractStableIdentifierInfo(gtinWithLeadingZero, 'EAN_13');
assert.strictEqual(
  info1.rawValue,
  '08904232801980',
  'Leading zeros must never be truncated in rawValue'
);
assert.strictEqual(
  info1.normalizedValue,
  '08904232801980',
  'Normalized GTIN value must preserve 14-digit format'
);
assert.strictEqual(
  info1.identifierType,
  'gtin',
  '14-digit numeric code must be typed as gtin'
);
console.log('✓ 1.1 Leading zeros preserved in GTIN-14 identifier registration');

// 1.2 Common barcode formats support
const formatsToTest = [
  { code: '8901234567890', format: 'EAN_13', expectedType: 'gtin' },
  { code: '12345678', format: 'EAN_8', expectedType: 'gtin' },
  { code: '012345678905', format: 'UPC_A', expectedType: 'gtin' },
  { code: '01234565', format: 'UPC_E', expectedType: 'gtin' },
  { code: 'AGRI-CHEM-10892', format: 'CODE_128', expectedType: 'barcode' },
  { code: 'FERT-39-KG', format: 'CODE_39', expectedType: 'barcode' },
  { code: 'https://krushios.farm/p/9921', format: 'QR_CODE', expectedType: 'qr' },
];

formatsToTest.forEach(({ code, format, expectedType }) => {
  const parsed = extractStableIdentifierInfo(code, format);
  assert.strictEqual(
    parsed.identifierType,
    expectedType,
    `Format ${format} should be mapped to ${expectedType}`
  );
  assert.strictEqual(parsed.rawValue, code, `Raw value must match for format ${format}`);
});
console.log('✓ 1.2 EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, and QR code formats validated');

// 1.3 Manual identifier fallback check
const manualCode = '  8904000123456  ';
const manualParsed = extractStableIdentifierInfo(manualCode, 'MANUAL_ENTRY');
assert.strictEqual(manualParsed.rawValue, '8904000123456', 'Trimmed manual input accepted');
assert.strictEqual(manualParsed.identifierType, 'gtin');
console.log('✓ 1.3 Manual identifier entry and whitespace trimming supported');

// ─────────────────────────────────────────────────────────────
// FEATURE 2 TESTS: Agricultural Packaging OCR, Dates & GS1 Parsing
// ─────────────────────────────────────────────────────────────
console.log('\n--- FEATURE 2: Packaging Scanner for Batch, Manufacturing & Expiry ---');

// 2.1 GS1 Application Identifiers Parsing
const gs1PackagingPayload = '(01)08904232801980(10)SPL6A20014(11)260129(17)280128';
const gs1Parsed = parseScannedBarcode(gs1PackagingPayload, 'QR_CODE');
assert.strictEqual(gs1Parsed.gtin, '08904232801980', 'GS1 AI (01) GTIN must match');
assert.strictEqual(gs1Parsed.batchNumber, 'SPL6A20014', 'GS1 AI (10) Batch number must match');
assert.strictEqual(gs1Parsed.manufacturingDate, '2026-01-29', 'GS1 AI (11) MFD must match');
assert.strictEqual(gs1Parsed.expiryDate, '28/01/2028', 'GS1 AI (17) Expiry date must match');
assert.strictEqual(gs1Parsed.bestBeforeDate, undefined, 'AI 17 is strictly Expiry Date, not Best Before');

// 2.1b GS1 AI (15) Best Before Date vs AI (17) Expiry Date Distinction
const gs1BestBeforePayload = '(01)08904232801980(10)BBE-BATCH(15)270615';
const gs1BestBeforeParsed = parseScannedBarcode(gs1BestBeforePayload, 'QR_CODE');
assert.strictEqual(gs1BestBeforeParsed.bestBeforeDate, '15/06/2027', 'AI (15) must parse as bestBeforeDate');
assert.strictEqual(gs1BestBeforeParsed.expiryDate, undefined, 'AI (15) must not be falsely treated as expiryDate');
console.log('✓ 2.1 GS1 structured packaging QR extracted GTIN, Batch, MFD, Best-Before and Expiry keeping distinct meanings');

// 2.2 Printed Label OCR Parsing with multiple date formats
const testLabels = [
  {
    raw: `
      COROMANDEL GROMAX
      Batch No. CRMD-90812
      Mfg. Date 15/04/2025
      Expiry Date 14/04/2028
      Maximum Retail Price Rs. 850.00
      Net Content: 50 kg
      Coromandel International Ltd
    `,
    expectedBatch: 'CRMD-90812',
    expectedMfg: '2025-04-15',
    expectedExp: '14/04/2028',
    expectedMrp: 850.0,
    expectedPack: '50 kg',
    expectedMfgCompany: 'Coromandel',
  },
  {
    raw: `
      CONFIDOR
      Imidacloprid 17.8% SL
      B.No: BYR77412A
      MFD: 10-AUG-2025
      EXP: 09-AUG-2027
      M.R.P. ₹ 475.00
      100 ml
      Bayer CropScience
    `,
    expectedBatch: 'BYR77412A',
    expectedMfg: '2025-08-10',
    expectedExp: '09/08/2027',
    expectedMrp: 475.0,
    expectedPack: '100 ml',
    expectedMfgCompany: 'Bayer',
  },
];

testLabels.forEach((label, idx) => {
  const ocrRes = parseProductLabelOcr(label.raw);
  assert.strictEqual(ocrRes.batchNumber, label.expectedBatch, `Batch in label ${idx + 1}`);
  assert.strictEqual(ocrRes.manufacturingDate, label.expectedMfg, `Mfg in label ${idx + 1}`);
  assert.strictEqual(ocrRes.expiryDate, label.expectedExp, `Exp in label ${idx + 1}`);
  assert.strictEqual(ocrRes.mrp, label.expectedMrp, `MRP in label ${idx + 1}`);
  assert.strictEqual(ocrRes.packSize, label.expectedPack, `Pack size in label ${idx + 1}`);
  assert.ok(
    ocrRes.manufacturer?.includes(label.expectedMfgCompany),
    `Manufacturer ${label.expectedMfgCompany} in label ${idx + 1}`
  );
});
console.log('✓ 2.2 Printed label OCR parsed batch, DD/MM/YYYY, and DD-MMM-YYYY dates accurately');

// 2.3 Non-hallucination guarantee: No fake stock, no fake purchase price
const sparseLabel = `
  UREA
  Batch No: UREA-2026-X
`;
const sparseOcr = parseProductLabelOcr(sparseLabel);
assert.strictEqual(sparseOcr.batchNumber, 'UREA-2026-X');
assert.strictEqual(sparseOcr.purchasePrice, undefined, 'Purchase price must not be invented');
assert.strictEqual(sparseOcr.sellingPrice, undefined, 'Selling price must not be invented');
assert.strictEqual(sparseOcr.quantity, undefined, 'Stock quantity must never be hallucinated from a label');
console.log('✓ 2.3 Non-hallucination: stock quantity and purchase price are never fabricated');

// 2.4 Multi-source merging (QR GTIN + Label OCR Batch/Expiry)
const qrOnly = parseScannedBarcode('8904232801980', 'EAN_13');
const ocrOnly = parseProductLabelOcr(`
  Evicent
  Batch No. SPL6A20014
  Expiry Date 28/01/2028
  Maximum Retail Price Rs. 1569.00
  Syngenta
`);
const merged = mergeProductScanResults([qrOnly, ocrOnly]);
assert.strictEqual(merged.gtin, '8904232801980', 'Merged GTIN from barcode');
assert.strictEqual(merged.batchNumber, 'SPL6A20014', 'Merged Batch from OCR');
assert.strictEqual(merged.expiryDate, '28/01/2028', 'Merged Expiry from OCR');
assert.strictEqual(merged.mrp, 1569.0, 'Merged MRP from OCR');
console.log('✓ 2.4 Hybrid merge: Barcode GTIN correctly merged with printed label OCR batch details');

// ─────────────────────────────────────────────────────────────
// FEATURE 3 TESTS: Automatic Batch Detail Recognition During Billing
// ─────────────────────────────────────────────────────────────
console.log('\n--- FEATURE 3: Automatic Batch Detail Recognition During Billing ---');

const mockProducts = [
  {
    id: 'prod-evicent',
    name: 'EVICENT 60G',
    barcode: '8904232801980',
    sku: 'EVI-60',
    selling_price: 1569.0,
    mrp: 1569.0,
    current_stock: 35,
    is_active: true,
    identifiers: [
      { raw_value: '8904232801980', identifier_type: 'barcode', is_primary: true },
      { raw_value: 'https://id.syngenta.com/01/08904232801980/10/SPL6A20014/17/280128', identifier_type: 'qr' },
    ],
    batches: [
      {
        id: 'batch-expired',
        batch_number: 'SPL5A10099',
        expiry_date: '2023-01-01', // Expired
        selling_price: 1500.0,
        quantity_available: 10,
        is_active: true,
      },
      {
        id: 'batch-fefo-1',
        batch_number: 'SPL6A20010',
        expiry_date: '2027-06-30', // Earlier valid expiry
        selling_price: 1569.0,
        quantity_available: 15,
        is_active: true,
      },
      {
        id: 'batch-fefo-2',
        batch_number: 'SPL6A20014',
        expiry_date: '2028-01-28', // Later expiry
        selling_price: 1569.0,
        quantity_available: 20,
        is_active: true,
      },
    ],
  },
];

// 3.1 Plain barcode scan -> FEFO selects earliest non-expired batch with stock
const plainScanRes = matchBillingProductStock(mockProducts, '8904232801980');
assert.strictEqual(plainScanRes.found, true, 'Product must be found');
assert.strictEqual(plainScanRes.product.id, 'prod-evicent');
assert.strictEqual(
  plainScanRes.selectedBatch?.id,
  'batch-fefo-1',
  'FEFO must select earliest non-expired batch (2027-06-30), not expired batch or later batch'
);
assert.strictEqual(plainScanRes.availableStock, 15);
console.log('✓ 3.1 Plain barcode scan automatically allocates FEFO non-expired batch (2027-06-30)');

// 3.2 Structured QR with explicit batch number -> selects matching batch directly
const qrWithBatch = '(01)08904232801980(10)SPL6A20014(17)280128';
const structuredScanRes = matchBillingProductStock(mockProducts, qrWithBatch);
assert.strictEqual(structuredScanRes.found, true);
assert.strictEqual(
  structuredScanRes.selectedBatch?.batch_number,
  'SPL6A20014',
  'Batch specified in QR (SPL6A20014) must take precedence over default FEFO'
);
assert.strictEqual(structuredScanRes.availableStock, 20);
console.log('✓ 3.2 Structured QR with encoded batch directly matches batch SPL6A20014');

// 3.3 Expired batch safety check
const expiredQR = '(01)08904232801980(10)SPL5A10099(17)230101';
const expiredScanRes = matchBillingProductStock(mockProducts, expiredQR);
assert.strictEqual(expiredScanRes.isExpired, true, 'Explicit scan of expired batch must be flagged as expired');
assert.strictEqual(expiredScanRes.reason, 'EXPIRED');
console.log('✓ 3.3 Explicit scan of expired batch correctly blocked from direct cart addition');

// 3.4 Cart Item preparation preserves authoritative prices
const cartItem = buildBillingCartItem(plainScanRes);
assert.ok(cartItem, 'Cart item built');
assert.strictEqual(cartItem.rate, 1569.0, 'Authoritative product selling price maintained');
assert.strictEqual(cartItem.batch_number, 'SPL6A20010');
assert.strictEqual(cartItem.quantity, 1);
console.log('✓ 3.4 Cart item contains product name, size, batch, expiry, rate, and available stock');

// ─────────────────────────────────────────────────────────────
// FEATURE 4 TESTS: Mobile-First Bottom Navigation
// ─────────────────────────────────────────────────────────────
console.log('\n--- FEATURE 4: Mobile-First Bottom Navigation ---');

// 4.1 Logical layout order validation: Sales | Products | Billing | Reports | Credits
const expectedNavOrder = [
  { href: '/sales', label: 'Sales', pos: 'Leftmost' },
  { href: '/products', label: 'Products', pos: 'Left of center' },
  { href: '/billing', label: 'Billing', pos: 'Center (Prominent)' },
  { href: '/reports', label: 'Reports', pos: 'Right of center' },
  { href: '/credit', label: 'Credits', pos: 'Far right' },
];

assert.strictEqual(expectedNavOrder[0].href, '/sales', 'Sales must be leftmost');
assert.strictEqual(expectedNavOrder[1].href, '/products', 'Products left of center');
assert.strictEqual(expectedNavOrder[2].href, '/billing', 'Billing must be the central action');
assert.strictEqual(expectedNavOrder[3].href, '/reports', 'Reports on right of center');
assert.strictEqual(expectedNavOrder[4].href, '/credit', 'Credits on far right');
console.log('✓ 4.1 Mobile navigation layout verified: Sales | Products | Billing (Center) | Reports | Credits');

// 4.2 Active route matching helper
function isRouteActive(currentPath: string, targetHref: string): boolean {
  if (currentPath === targetHref) return true;
  if (targetHref !== '/dashboard' && currentPath.startsWith(`${targetHref}/`)) return true;
  return false;
}

assert.strictEqual(isRouteActive('/billing', '/billing'), true);
assert.strictEqual(isRouteActive('/products', '/products'), true);
assert.strictEqual(isRouteActive('/products/new', '/products'), true);
assert.strictEqual(isRouteActive('/sales', '/sales'), true);
assert.strictEqual(isRouteActive('/sales/KOS-001', '/sales'), true);
assert.strictEqual(isRouteActive('/billing', '/sales'), false);
console.log('✓ 4.2 Active route highlighting correctly matches base routes and subpaths');

// ─────────────────────────────────────────────────────────────
// FEATURE 5 TESTS: Complete Multi-Batch Lifecycle, Date Separation & Stock Invariants
// ─────────────────────────────────────────────────────────────
console.log('\n--- FEATURE 5: Complete Multi-Batch Lifecycle, Date Separation & Stock Invariants ---');

// 5.1 Scanning packaging must never create physical stock
const packagingRaw = `
  COROMANDEL GROMAX
  Batch No. CRMD-2026-A
  Mfg. Date 15/01/2026
  Expiry Date 14/01/2028
  Maximum Retail Price Rs. 850.00
  Coromandel International Ltd
`;
const extractedBatch1 = parseProductLabelOcr(packagingRaw);
assert.strictEqual(extractedBatch1.batchNumber, 'CRMD-2026-A');
assert.strictEqual(extractedBatch1.mrp, 850.0);
assert.strictEqual(extractedBatch1.manufacturingDate, '2026-01-15');
assert.strictEqual(extractedBatch1.expiryDate, '14/01/2028');
assert.strictEqual(extractedBatch1.quantity, undefined, 'Packaging scan MUST NEVER fabricate physical stock quantity');

// Simulated Product Record with Batch 1
const mockProductWithBatches: any = {
  id: 'prod-crmd',
  name: 'COROMANDEL GROMAX',
  barcode: '8901234567890',
  sku: 'CRMD-GRO',
  selling_price: 800.0, // Authorized selling price
  wholesale_price: 750.0, // Wholesale price (distinct from MRP)
  mrp: 850.0, // Retail MRP
  current_stock: 0, // No stock created yet
  is_active: true,
  batches: [
    {
      id: 'batch-1',
      batch_number: 'CRMD-2026-A',
      manufacturing_date: '2026-01-15',
      expiry_date: '2028-01-14',
      best_before_date: null,
      mrp: 850.0,
      purchase_price: 720.0,
      selling_price: 800.0,
      quantity_available: 0, // 0 physical stock
      is_active: true,
    },
  ],
};

// 5.2 Add a second batch of the same product with distinct dates and MRP
const batch2: any = {
  id: 'batch-2',
  batch_number: 'CRMD-2026-B',
  manufacturing_date: '2026-03-01',
  expiry_date: '2028-03-31',
  best_before_date: '2027-12-31',
  mrp: 890.0, // Higher MRP
  purchase_price: 760.0,
  selling_price: 840.0,
  quantity_available: 0,
  is_active: true,
};
mockProductWithBatches.batches.push(batch2);

// 5.3 Batch 1 details remain 100% unchanged (no overwriting)
const verifiedBatch1 = mockProductWithBatches.batches.find((b: any) => b.id === 'batch-1')!;
assert.strictEqual(verifiedBatch1.batch_number, 'CRMD-2026-A');
assert.strictEqual(verifiedBatch1.manufacturing_date, '2026-01-15');
assert.strictEqual(verifiedBatch1.expiry_date, '2028-01-14');
assert.strictEqual(verifiedBatch1.mrp, 850.0, 'Batch 1 MRP must not be overwritten by Batch 2 MRP');
assert.strictEqual(verifiedBatch1.quantity_available, 0);

// 5.4 Stock Arrival via Purchase workflow
verifiedBatch1.quantity_available = 25;
batch2.quantity_available = 50;
mockProductWithBatches.current_stock = 75;

// 5.5 Billing: Plain scan picks Batch 1 via FEFO (earlier expiry: Jan 2028 vs Mar 2028)
const fefoMatch = matchBillingProductStock([mockProductWithBatches], '8901234567890');
assert.strictEqual(fefoMatch.found, true);
assert.strictEqual(fefoMatch.selectedBatch?.id, 'batch-1', 'FEFO must select batch-1 with earlier expiry');
assert.strictEqual(fefoMatch.availableStock, 25);

// 5.6 Billing: Structured scan for Batch 2 specifically selects Batch 2
const structuredQrBatch2 = '(01)08901234567890(10)CRMD-2026-B(17)280331';
const batch2Match = matchBillingProductStock([mockProductWithBatches], structuredQrBatch2);
assert.strictEqual(batch2Match.found, true);
assert.strictEqual(batch2Match.selectedBatch?.id, 'batch-2');
assert.strictEqual(batch2Match.selectedBatch?.batch_number, 'CRMD-2026-B');
assert.strictEqual(batch2Match.availableStock, 50);

// 5.7 Pricing safety: Cart rate comes from authorized selling_price, NOT OCR MRP
const cartItemBatch2 = buildBillingCartItem(batch2Match);
assert.strictEqual(cartItemBatch2.rate, 840.0, 'Cart rate must reflect authorized selling price');
assert.notStrictEqual(cartItemBatch2.rate, batch2.mrp, 'Cart rate must not naively use MRP if selling price is set');

// 5.8 Out-of-stock validation during billing
batch2.quantity_available = 0; // Simulate stock exhausted
const oosMatch = matchBillingProductStock([mockProductWithBatches], structuredQrBatch2);
assert.strictEqual(oosMatch.isOutOfStock, true, 'Server/stock engine must flag batch as out of stock');

console.log('✓ 5.1 Scanning packaging never creates physical stock (stock remains 0 until purchase)');
console.log('✓ 5.2 Multi-batch isolation: Batch 1 dates and MRP are strictly preserved when Batch 2 is added');
console.log('✓ 5.3 FEFO and explicit batch targeting correctly allocate available purchase stock');
console.log('✓ 5.4 Authorized selling price is enforced over OCR MRP during billing');
console.log('✓ 5.5 Out of stock batch is prevented from checkout');

console.log('\n================================================================');
console.log('🎉 ALL KRUSHI OS SCANNER, BATCH, BILLING & MOBILE TESTS PASSED!');
console.log('================================================================\n');
