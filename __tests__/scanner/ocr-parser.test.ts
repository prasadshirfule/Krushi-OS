import assert from 'node:assert';
import { parseProductLabelOcr } from '../../lib/scanner/ocr-parser';

console.log('--- Testing Product Label OCR Parser (Phase 1.1) ---');

// Mock raw label text from the real tested Evicent product
const mockEvicentLabel = `
Evicent
Emamectin benzoate 5% w/w +
Lufenuron 40% w/w WG
60 g
Maximum Retail Price Rs. 1569.00
Unit Sale Price per g Rs. 26.15/g
Batch No. SPL6A20014
Mfg. Date 29 JAN 2026
Expiry Date 28 JAN 2028
Syngenta
`;

const res = parseProductLabelOcr(mockEvicentLabel);

assert.strictEqual(res.productName, 'Evicent', 'Product Name must be Evicent');
assert.strictEqual(res.manufacturer, 'Syngenta', 'Manufacturer must be Syngenta');
assert.ok(res.composition?.includes('Emamectin benzoate 5% w/w'), 'Composition must contain active ingredients');
assert.strictEqual(res.formulation, 'WG', 'Formulation must be WG');
assert.strictEqual(res.packSize, '60 g', 'Pack size must be 60 g');
assert.strictEqual(res.sizeValue, 60, 'Size value must be 60');
assert.strictEqual(res.sizeUnit, 'g', 'Size unit must be g');
assert.strictEqual(res.mrp, 1569.0, 'MRP must be 1569.00');
assert.strictEqual(res.unitSalePrice, 26.15, 'Unit Sale Price must be 26.15');
assert.strictEqual(res.batchNumber, 'SPL6A20014', 'Batch No must be SPL6A20014');
assert.strictEqual(res.manufacturingDate, '2026-01-29', 'Mfg Date must be 2026-01-29');
assert.strictEqual(res.expiryDate, '28/01/2028', 'Expiry Date must be 28/01/2028');

// Ensure HSN and GST are NOT hallucinated
assert.strictEqual(res.hsnCode, undefined, 'HSN Code must not be invented when missing');
assert.strictEqual(res.gstRate, undefined, 'GST Rate must not be invented when missing');
assert.strictEqual(res.purchasePrice, undefined, 'Purchase Price must not be populated from MRP');
assert.strictEqual(res.sellingPrice, undefined, 'Selling Price must not be populated from MRP');

console.log('✓ Test 1: Real Evicent Product Label OCR parsed accurately without hallucinations');

console.log('All Product Label OCR Parser tests passed successfully!\n');
