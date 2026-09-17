import assert from 'node:assert';
import { parseGS1Url, isGS1Url } from '../../lib/scanner/url-gs1-parser';

console.log('--- Testing URL GS1 Parser (Phase 1.1) ---');

// 1. Test Real Product 1 (Syngenta Evicent URL)
const url1 = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
assert.strictEqual(isGS1Url(url1), true, 'Real Product 1 URL should be detected as GS1 URL');

const res1 = parseGS1Url(url1);
assert.ok(res1, 'Real Product 1 should parse successfully');
assert.strictEqual(res1.gtin, '08904232801980', 'GTIN must match 08904232801980');
assert.strictEqual(res1.batchNumber, 'SPL6A20014', 'Batch must match SPL6A20014');
assert.strictEqual(res1.serialNumber, 'U2DFSHLAEX', 'Serial must match U2DFSHLAEX');
assert.strictEqual(res1.manufacturingDate, '2026-01-29', 'Mfg date must be 2026-01-29');
assert.strictEqual(res1.expiryDate, '28/01/2028', 'Expiry date UI must be 28/01/2028');
assert.strictEqual(res1.expiryDateDB, '2028-01-28', 'Expiry date DB must be 2028-01-28');
console.log('✓ Test 1: Real Product 1 (Syngenta Evicent) Passed');

// 2. Test Real Product 2 (Syngenta Batch URL)
const url2 = 'https://syngenta.co.in/gpd/01/08904232810364/10/SPL5G20100/21/183QBVEU1Y?11=250727&17=270726';
assert.strictEqual(isGS1Url(url2), true, 'Real Product 2 URL should be detected as GS1 URL');

const res2 = parseGS1Url(url2);
assert.ok(res2, 'Real Product 2 should parse successfully');
assert.strictEqual(res2.gtin, '08904232810364', 'GTIN must match 08904232810364');
assert.strictEqual(res2.batchNumber, 'SPL5G20100', 'Batch must match SPL5G20100');
assert.strictEqual(res2.serialNumber, '183QBVEU1Y', 'Serial must match 183QBVEU1Y');
assert.strictEqual(res2.manufacturingDate, '2025-07-27', 'Mfg date must be 2025-07-27');
assert.strictEqual(res2.expiryDate, '26/07/2027', 'Expiry date UI must be 26/07/2027');
assert.strictEqual(res2.expiryDateDB, '2027-07-26', 'Expiry date DB must be 2027-07-26');
console.log('✓ Test 2: Real Product 2 (Syngenta Batch) Passed');

// 3. Test Generic GS1 Digital Link
const url3 = 'https://example.org/01/08901234567890/10/LOT42/21/SERIAL1?11=260101&17=280101';
const res3 = parseGS1Url(url3);
assert.ok(res3, 'Generic GS1 Digital Link should parse successfully');
assert.strictEqual(res3.gtin, '08901234567890', 'GTIN should be preserved');
assert.strictEqual(res3.batchNumber, 'LOT42');
assert.strictEqual(res3.serialNumber, 'SERIAL1');
assert.strictEqual(res3.manufacturingDate, '2026-01-01');
assert.strictEqual(res3.expiryDate, '01/01/2028');
console.log('✓ Test 3: Generic GS1 Digital Link URL Passed');

// 4. Test Non-GS1 URLs
const nonGs1Url = 'https://example.com/about-us';
assert.strictEqual(isGS1Url(nonGs1Url), false);
assert.strictEqual(parseGS1Url(nonGs1Url), null, 'Non-GS1 URL should return null');
console.log('✓ Test 4: Non-GS1 URL rejection Passed');

console.log('All URL GS1 Parser tests passed successfully!\n');
