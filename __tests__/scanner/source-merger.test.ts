import assert from 'node:assert';
import { mergeProductScanResults } from '../../lib/scanner/source-merger';
import { ProductScanResult } from '../../lib/scanner/types';

console.log('--- Testing Multi-Source Merger & Conflict Engine (Phase 1.1) ---');

// 1. Matching batch: No conflict
const qr1: ProductScanResult = {
  rawValue: 'test-qr',
  format: 'QR_CODE',
  source: 'gs1',
  gtin: '08904232801980',
  batchNumber: 'SPL6A20014',
  expiryDate: '28/01/2028',
};

const ocr1: ProductScanResult = {
  rawValue: 'test-ocr',
  format: 'OCR_LABEL',
  source: 'ocr',
  productName: 'Evicent',
  batchNumber: 'SPL6A20014',
  mrp: 1569.0,
  packSize: '60 g',
};

const merged1 = mergeProductScanResults([qr1, ocr1]);
assert.strictEqual(merged1.batchNumber, 'SPL6A20014');
assert.strictEqual(merged1.productName, 'Evicent');
assert.strictEqual(merged1.mrp, 1569.0);
assert.strictEqual(merged1.conflicts?.length, 0, 'No conflict should occur when batches match');
console.log('✓ Test 1: Matching sources merged without conflict');

// 2. Conflicting batch: Conflict detected
const ocr2: ProductScanResult = {
  rawValue: 'test-ocr',
  format: 'OCR_LABEL',
  source: 'ocr',
  batchNumber: 'SPL6A20099', // Mismatched batch
};

const merged2 = mergeProductScanResults([qr1, ocr2]);
assert.strictEqual(merged2.batchNumber, 'SPL6A20014', 'Higher priority GS1 batch must be chosen by default');
assert.ok(merged2.conflicts && merged2.conflicts.length > 0, 'Conflict must be recorded for mismatched batch');
assert.strictEqual(merged2.conflicts[0].field, 'batchNumber');
assert.strictEqual(merged2.conflicts[0].valueA, 'SPL6A20014');
assert.strictEqual(merged2.conflicts[0].valueB, 'SPL6A20099');
console.log('✓ Test 2: Mismatched batches recorded in conflicts');

// 3. MRP Safety: MRP does not populate purchasePrice or sellingPrice
assert.strictEqual(merged1.purchasePrice, undefined, 'MRP must NOT populate purchasePrice');
assert.strictEqual(merged1.sellingPrice, undefined, 'MRP must NOT populate sellingPrice');
console.log('✓ Test 3: MRP Safety validated');

// 4. Stock Safety: Pack size does not populate quantity/stock
assert.strictEqual(merged1.quantity, undefined, 'Pack size 60 g must NOT populate quantity/stock');
console.log('✓ Test 4: Stock Safety validated');

// 5. HSN & GST Safety: Missing HSN & GST are not hallucinated
assert.strictEqual(merged1.hsnCode, undefined, 'HSN must not be hallucinated');
assert.strictEqual(merged1.gstRate, undefined, 'GST must not be hallucinated');
console.log('✓ Test 5: HSN & GST Safety validated');

console.log('All Multi-Source Merger tests passed successfully!\n');
